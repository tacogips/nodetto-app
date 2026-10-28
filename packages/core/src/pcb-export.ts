// Gerber and Excellon export of an imported board: the reverse of
// pcb-import.ts. Each group that Gerber import tagged with a fabrication
// layer becomes one file again, drawn from its members as they are now, so
// moved, resized, rotated, deleted and added shapes reach the files. Filled
// areas become Gerber regions; drill shapes become holes and slots. The
// export checks nothing: spacing, connectivity and drill sizes are the
// user's responsibility.

import type {
  Document,
  Element,
  ElementId,
  FabricationLayer,
  FreehandPoint,
  GeoShapeSemantic,
  GroupSemantic,
  PageId,
  PathSemantic,
} from "@nodetto/ir";
import polygonClipping, {
  type MultiPolygon,
  type Polygon,
} from "polygon-clipping";
import { boxCenter, rotatePoint, type Vec } from "./geometry.ts";
import {
  type Area,
  areasOf,
  type Contour,
  contourOf,
  drillHits,
  excellonDrill,
  GerberLayer,
  layerName,
  type OutlinePoint,
  type PcbFile,
  type PcbPoint,
  polygonContour,
  signedArea,
  writeOutline,
} from "./pcb/index.ts";
import { geoOutlinePolygon } from "./shapes/outline.ts";
import { encodeStoredZip } from "./zip.ts";

const GENERATOR = "Nodetto,Gerber export";

export interface PcbExportOptions {
  /** File base name for layers without an imported file name. */
  readonly name?: string;
}

export interface PcbExportLayer {
  readonly path: string;
  readonly name: string;
  /** Exported areas (Gerber) or holes and slots (drill). */
  readonly objects: number;
}

export interface PcbExportReport {
  readonly files: readonly PcbFile[];
  readonly layers: readonly PcbExportLayer[];
  readonly warnings: readonly string[];
}

export class PcbExportError extends Error {
  override readonly name = "PcbExportError";
}

function fabricationLayerOf(element: Element): FabricationLayer | undefined {
  return element.type === "group"
    ? (element.semantic as GroupSemantic).fabricationLayer
    : undefined;
}

/** The page's groups that Gerber import tagged with a fabrication layer. */
export function fabricationLayerGroups(
  document: Pick<Document, "elements">,
  pageId: PageId,
): Element[] {
  return document.elements.filter(
    (element) =>
      element.page === pageId && fabricationLayerOf(element) !== undefined,
  );
}

/** The leaf members of a group, nested groups expanded. */
function leaves(
  group: Element,
  byId: ReadonlyMap<ElementId, Element>,
  seen: Set<ElementId> = new Set(),
): Element[] {
  const out: Element[] = [];
  for (const id of (group.semantic as GroupSemantic).memberIds) {
    const member = byId.get(id);
    if (!member || seen.has(id)) continue;
    seen.add(id);
    if (member.type === "group") out.push(...leaves(member, byId, seen));
    else out.push(member);
  }
  return out;
}

type PointMap = (point: Vec) => PcbPoint;

function mapPoint(point: FreehandPoint, map: PointMap): OutlinePoint {
  return {
    ...map(point),
    ...(point.controlIn ? { controlIn: map(point.controlIn) } : {}),
    ...(point.controlOut ? { controlOut: map(point.controlOut) } : {}),
  };
}

/** A draw.path's contours, placed as the renderer places them. */
function pathContours(element: Element, toBoard: PointMap): Contour[] {
  const contours = (element.semantic as PathSemantic).contours;
  const samples = contours.flatMap((contour) =>
    contour.points.flatMap((point) =>
      [point, point.controlIn, point.controlOut].filter(
        (sample): sample is Vec => sample !== undefined,
      ),
    ),
  );
  if (samples.length === 0) return [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const sample of samples) {
    minX = Math.min(minX, sample.x);
    minY = Math.min(minY, sample.y);
    maxX = Math.max(maxX, sample.x);
    maxY = Math.max(maxY, sample.y);
  }
  const box = {
    x: element.visual.x ?? minX,
    y: element.visual.y ?? minY,
    width: element.visual.width ?? maxX - minX,
    height: element.visual.height ?? maxY - minY,
  };
  const scaleX = maxX > minX ? box.width / (maxX - minX) : 1;
  const scaleY = maxY > minY ? box.height / (maxY - minY) : 1;
  const rotation = element.visual.rotation ?? 0;
  const center = boxCenter(box);
  const map = (point: Vec): PcbPoint => {
    const page = {
      x: box.x + (point.x - minX) * scaleX,
      y: box.y + (point.y - minY) * scaleY,
    };
    return toBoard(rotation ? rotatePoint(page, center, rotation) : page);
  };
  return contours.flatMap((contour) => {
    if (contour.points.length < 3) return [];
    const mapped = contourOf(
      contour.points.map((point) => mapPoint(point, map)),
    );
    return mapped ? [mapped] : [];
  });
}

/** A geometric shape's outline. */
function geoContour(element: Element, toBoard: PointMap): Contour | undefined {
  const { x, y, width, height } = element.visual;
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined
  )
    return undefined;
  const box = { x, y, width, height };
  const kind = (element.semantic as GeoShapeSemantic).geo;
  if (kind === "ellipse" && Math.abs(width - height) < 1e-6 && width > 0) {
    // A circle: four exact quarter arcs, so drill sizes stay exact.
    const center = toBoard(boxCenter(box));
    const radius =
      Math.abs(toBoard({ x: x + width, y }).x - toBoard({ x, y }).x) / 2;
    const ends = [0, 1, 2, 3].map((quarter) => ({
      x: center.x + radius * Math.cos((quarter * Math.PI) / 2),
      y: center.y + radius * Math.sin((quarter * Math.PI) / 2),
    }));
    const start = ends[0] as PcbPoint;
    return {
      start,
      segments: [...ends.slice(1), start].map((to) => ({
        to,
        center,
        clockwise: false,
      })),
      flat: Array.from({ length: 64 }, (_, index) => ({
        x: center.x + radius * Math.cos((index * Math.PI) / 32),
        y: center.y + radius * Math.sin((index * Math.PI) / 32),
      })),
    };
  }
  // A plain rectangle has no outline polygon: its box is its outline.
  const polygon =
    geoOutlinePolygon(kind, box) ??
    (kind === "rect"
      ? [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
        ]
      : undefined);
  if (!polygon) return undefined;
  const rotation = element.visual.rotation ?? 0;
  const center = boxCenter(box);
  return polygonContour(
    polygon.map((point) =>
      toBoard(rotation ? rotatePoint(point, center, rotation) : point),
    ),
  );
}

/** The filled areas of a layer group's members, in board millimetres. */
function layerAreas(
  group: Element,
  layer: FabricationLayer,
  byId: ReadonlyMap<ElementId, Element>,
  warn: (message: string) => void,
): Area[] {
  const scale = layer.unitsPerMm;
  const toBoard: PointMap = (point) => ({
    x: layer.originX + point.x / scale,
    y: layer.originY - point.y / scale,
  });
  const areas: Area[] = [];
  const skipped = new Map<string, number>();
  for (const element of leaves(group, byId)) {
    let contours: Contour[] = [];
    if (element.type === "draw.path") contours = pathContours(element, toBoard);
    else if (element.type === "shape.geo") {
      const contour = geoContour(element, toBoard);
      if (contour) contours = [contour];
    }
    if (contours.length === 0) {
      skipped.set(element.type, (skipped.get(element.type) ?? 0) + 1);
      continue;
    }
    areas.push(...areasOf(contours));
  }
  for (const [type, count] of skipped)
    warn(`${count} ${type} element(s) have no filled outline and are left out`);
  return areas;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsOf(ring: readonly PcbPoint[]): Box {
  const box = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  for (const point of ring) {
    box.minX = Math.min(box.minX, point.x);
    box.minY = Math.min(box.minY, point.y);
    box.maxX = Math.max(box.maxX, point.x);
    box.maxY = Math.max(box.maxY, point.y);
  }
  return box;
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
  );
}

function toPolygon(area: Area): Polygon {
  return [area.outer, ...area.holes].map((contour) =>
    contour.flat.map((point): [number, number] => [point.x, point.y]),
  );
}

function fromMultiPolygon(result: MultiPolygon): Area[] {
  return result.flatMap((polygon) => {
    const [outer, ...holes] = polygon.map((ring) =>
      // polygon-clipping repeats the first point at the end of each ring.
      polygonContour(ring.slice(0, -1).map(([x, y]) => ({ x, y }))),
    );
    if (!outer) return [];
    return [
      {
        outer,
        holes: holes.filter((hole): hole is Contour => hole !== undefined),
      },
    ];
  });
}

/**
 * Writes areas as regions. A hole is a clear region drawn right after its
 * outer contour, which also clears whatever lies under it, so areas with
 * holes are drawn first, largest first, and areas whose boxes overlap are
 * merged into disjoint polygons beforehand. Areas without holes come last;
 * dark regions simply add up.
 */
function writeAreas(gerber: GerberLayer, areas: readonly Area[]): void {
  const holed = areas.filter((area) => area.holes.length > 0);
  const solid = areas.filter((area) => area.holes.length === 0);
  const boxes = holed.map((area) => boundsOf(area.outer.flat));
  const parent = holed.map((_, index) => index);
  const find = (start: number): number => {
    let index = start;
    while (parent[index] !== index) {
      const next = parent[index] as number;
      parent[index] = parent[next] as number;
      index = next;
    }
    return index;
  };
  for (let a = 0; a < holed.length; a++)
    for (let b = a + 1; b < holed.length; b++)
      if (overlaps(boxes[a] as Box, boxes[b] as Box)) parent[find(a)] = find(b);
  const components = new Map<number, Area[]>();
  holed.forEach((area, index) => {
    const root = find(index);
    const list = components.get(root);
    if (list) list.push(area);
    else components.set(root, [area]);
  });
  const merged: Area[] = [];
  for (const members of components.values()) {
    if (members.length === 1) merged.push(...members);
    else {
      const [first, ...rest] = members.map(toPolygon);
      if (first)
        merged.push(...fromMultiPolygon(polygonClipping.union(first, ...rest)));
    }
  }
  merged.sort(
    (left, right) =>
      Math.abs(signedArea(right.outer.flat)) -
      Math.abs(signedArea(left.outer.flat)),
  );
  for (const area of merged) {
    gerber.region(area.outer.start, area.outer.segments);
    for (const hole of area.holes)
      gerber.region(hole.start, hole.segments, "clear");
  }
  for (const area of solid)
    gerber.region(area.outer.start, area.outer.segments);
}

const EXTENSIONS: Record<string, string> = {
  "copper:top": "GTL",
  "copper:bottom": "GBL",
  "soldermask:top": "GTS",
  "soldermask:bottom": "GBS",
  "silkscreen:top": "GTO",
  "silkscreen:bottom": "GBO",
  "paste:top": "GTP",
  "paste:bottom": "GBP",
  "outline:board": "GKO",
  "drill:board": "DRL",
};

function extensionOf(layer: FabricationLayer): string {
  if (layer.kind === "copper" && layer.side === "inner")
    return `G${layer.inner ?? 1}`;
  return EXTENSIONS[`${layer.kind}:${layer.side}`] ?? "GBR";
}

function fileFunction(layer: FabricationLayer, copperLayers: number): string {
  const side = layer.side === "bottom" ? "Bot" : "Top";
  switch (layer.kind) {
    case "copper":
      if (layer.side === "inner")
        return `Copper,L${(layer.inner ?? 1) + 1},Inr`;
      return layer.side === "bottom"
        ? `Copper,L${copperLayers},Bot`
        : "Copper,L1,Top";
    case "soldermask":
      return `Soldermask,${side}`;
    case "silkscreen":
      return `Legend,${side}`;
    case "paste":
      return `Paste,${side}`;
    case "outline":
      return "Profile,NP";
    default:
      return "Other,Drawing";
  }
}

function safeBase(name: string | undefined): string {
  const base = (name ?? "").replace(/[\\/:*?"<>|]+/g, "-").trim();
  return base || "board";
}

/**
 * Gerber and drill files for the fabrication layer groups on a page. Throws
 * PcbExportError when the page has none.
 */
export function exportPcbPage(
  document: Pick<Document, "elements">,
  pageId: PageId,
  options: PcbExportOptions = {},
): PcbExportReport {
  const groups = fabricationLayerGroups(document, pageId);
  if (groups.length === 0)
    throw new PcbExportError(
      "the page has no Gerber layers; import a board's Gerber files first",
    );
  const byId = new Map(
    document.elements.map((element) => [element.id, element] as const),
  );
  const copperLayers = Math.max(
    2,
    groups.filter((group) => fabricationLayerOf(group)?.kind === "copper")
      .length,
  );
  const warnings: string[] = [];
  const files: PcbFile[] = [];
  const layers: PcbExportLayer[] = [];
  const usedPaths = new Set<string>();
  const base = safeBase(options.name);
  for (const group of groups) {
    const layer = fabricationLayerOf(group) as FabricationLayer;
    const name = layerName(layer);
    let path = layer.file
      ? safeBase(layer.file.split(/[\\/]/).at(-1))
      : `${base}.${extensionOf(layer)}`;
    for (let suffix = 2; usedPaths.has(path.toLowerCase()); suffix++) {
      const dot = path.lastIndexOf(".");
      path =
        dot > 0
          ? `${path.slice(0, dot)}-${suffix}${path.slice(dot)}`
          : `${path}-${suffix}`;
    }
    usedPaths.add(path.toLowerCase());
    const warn = (message: string): void => {
      warnings.push(`${path}: ${message}`);
    };
    const areas = layerAreas(group, layer, byId, warn);
    if (layer.kind === "drill") {
      const { holes, slots, unreadable } = drillHits(areas);
      if (unreadable)
        warn(`${unreadable} drill shape(s) have no size and are left out`);
      files.push({
        path,
        text: excellonDrill(holes, "Nodetto Gerber export", copperLayers, {
          plating: layer.plating ?? "plated",
          slots,
        }),
      });
      layers.push({ path, name, objects: holes.length + slots.length });
      continue;
    }
    const gerber = new GerberLayer(
      fileFunction(layer, copperLayers),
      layer.kind === "soldermask" ? "Negative" : "Positive",
    );
    if (layer.kind === "outline") writeOutline(gerber, areas, warn);
    else writeAreas(gerber, areas);
    if (areas.length === 0) warn("the layer is empty");
    files.push({ path, text: gerber.text(GENERATOR) });
    layers.push({ path, name, objects: areas.length });
  }
  return { files, layers, warnings };
}

/** The exported files as one ZIP, the upload format board houses take. */
export function encodePcbExportZip(report: PcbExportReport): Uint8Array {
  const encoder = new TextEncoder();
  return encodeStoredZip(
    report.files.map((file) => ({
      path: file.path,
      contents: encoder.encode(file.text),
    })),
    "PCB archive",
  );
}
