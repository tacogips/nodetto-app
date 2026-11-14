// Gerber and Excellon import: draws a board's fabrication layers on a
// freeform page, one group per layer, as filled vector paths. The format
// readers and geometry live in ./pcb; this adapter places their outlines on
// the page, applies clear polarity and picks layer colours.

import {
  type Document,
  type Element,
  type ElementId,
  type FreehandPoint,
  MAX_PATH_CONTOURS,
  MAX_PATH_POINTS,
  type Page,
  type PageId,
  SCHEMA_VERSION,
  assertValidDocument,
} from "@nodetto/ir";
import { isZip, readZip } from "@nodetto/io";
import polygonClipping, {
  type MultiPolygon,
  type Polygon,
} from "polygon-clipping";
import {
  flattenContour,
  type GerberShape,
  gerberShape,
  identifyLayer,
  isExcellon,
  layerName,
  type OutlineArea,
  type OutlineContour,
  outlineBounds,
  type PcbLayerRole,
  type PcbPoint,
  readExcellon,
  readGerber,
} from "./pcb/index.ts";

export interface PcbImportFile {
  readonly name: string;
  readonly text: string;
}

/** Fabrication data: Gerber (a `%FS` format) or Excellon (an `M48` header). */
export function isFabricationText(text: string): boolean {
  return /%FS[LTD]?[AI]/.test(text) || isExcellon(text);
}

/**
 * The Gerber and drill files in a board house ZIP. Other entries (READMEs,
 * pick-and-place tables, BOMs) are skipped by content, not by name.
 */
export function pcbFilesFromZip(bytes: Uint8Array): PcbImportFile[] {
  if (!isZip(bytes)) throw new PcbImportError("not a ZIP archive");
  const decoder = new TextDecoder();
  const files: PcbImportFile[] = [];
  for (const entry of readZip(bytes)) {
    const text = decoder.decode(entry.contents);
    if (isFabricationText(text)) files.push({ name: entry.path, text });
  }
  return files;
}

export interface PcbImportOptions {
  readonly documentId?: string;
  readonly title?: string;
  readonly pageId?: PageId;
  readonly pageName?: string;
  /** Page units per millimetre; 10 keeps 1 µm at the 0.01 unit precision. */
  readonly unitsPerMm?: number;
  /** Element ids already in use, for adding the page to a document. */
  readonly reservedIds?: ReadonlySet<string>;
}

export interface PcbImportWarning {
  readonly file?: string;
  readonly message: string;
}

export interface PcbImportLayer {
  readonly file: string;
  readonly name: string;
  readonly role: PcbLayerRole;
  readonly objects: number;
}

export interface PcbImportPage {
  readonly page: Page;
  readonly elements: readonly Element[];
  readonly layers: readonly PcbImportLayer[];
  readonly warnings: readonly PcbImportWarning[];
  /** Board size in millimetres (the outline layer's, else all content's). */
  readonly size: { readonly width: number; readonly height: number };
  /**
   * The board area in board millimetres (y up). Page point (x, y) is board
   * point (minX + x / unitsPerMm - margin, maxY - y / unitsPerMm + margin),
   * with the 5 mm margin around the board.
   */
  readonly bounds: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  };
}

export interface PcbImportReport
  extends Omit<PcbImportPage, "page" | "elements"> {
  readonly document: Document;
}

export class PcbImportError extends Error {
  override readonly name = "PcbImportError";
}

/**
 * Flattening tolerance where geometry must become polygons for clipping
 * (mm); a tenth of a page unit at the default scale.
 */
const FLATTEN_TOLERANCE = 0.01;
/** Space around the board on the page, in millimetres. */
const PAGE_MARGIN_MM = 5;
const BOARD_BACKDROP = "#001023";

/** Rounds millimetres to nanometres, dropping floating-point noise. */
function nanometres(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

interface LayerStyle {
  readonly fill: string;
  readonly opacity?: number;
  readonly hidden?: boolean;
  /** Painting order, bottom first. */
  readonly order: number;
}

/** Colours after KiCad's default theme, on its dark board background. */
function layerStyle(role: PcbLayerRole): LayerStyle {
  const top = role.side === "top";
  switch (role.kind) {
    case "copper":
      if (role.side === "inner")
        return {
          fill: "#7fc87f",
          opacity: 0.8,
          hidden: true,
          order: 40 + (role.inner ?? 0) / 100,
        };
      return top
        ? { fill: "#c83434", order: 50 }
        : { fill: "#4d7fc4", order: 30 };
    case "soldermask":
      return top
        ? { fill: "#d864ff", opacity: 0.4, hidden: true, order: 60 }
        : { fill: "#02ffee", opacity: 0.4, hidden: true, order: 20 };
    case "paste":
      return top
        ? { fill: "#b4a09a", opacity: 0.9, hidden: true, order: 61 }
        : { fill: "#00c2c2", opacity: 0.9, hidden: true, order: 21 };
    case "silkscreen":
      return top
        ? { fill: "#f2eda1", order: 70 }
        : { fill: "#e8b2a7", hidden: true, order: 10 };
    case "drill":
      // Holes go through the board, so they show the page behind it.
      return { fill: "#ffffff", order: 80 };
    case "outline":
      return { fill: "#d0d2cd", order: 90 };
    case "other":
      return { fill: "#bdbdbd", opacity: 0.8, hidden: true, order: 5 };
  }
}

function partName(role: PcbLayerRole, source: GerberShape["source"]): string {
  const copper = role.kind === "copper";
  const pads = copper || role.kind === "soldermask" || role.kind === "paste";
  if (source === "flash") return pads ? "Pads" : "Flashes";
  if (source === "draw") return copper ? "Tracks" : "Lines";
  return copper ? "Zones" : "Regions";
}

/**
 * Polygons for polygon-clipping: each counterclockwise contour starts a
 * polygon and the clockwise contours after it are its holes.
 */
function toPolygons(area: OutlineArea): MultiPolygon {
  const polygons: Polygon[] = [];
  for (const contour of area) {
    const ring = flattenContour(contour, FLATTEN_TOLERANCE).map(
      (point) => [point.x, point.y] as [number, number],
    );
    let doubled = 0;
    for (let index = 0; index < ring.length; index++) {
      const [ax, ay] = ring[index] as [number, number];
      const [bx, by] = ring[(index + 1) % ring.length] as [number, number];
      doubled += ax * by - bx * ay;
    }
    const last = polygons[polygons.length - 1];
    if (doubled < 0 && last) last.push(ring);
    else polygons.push([ring]);
  }
  return polygons;
}

function fromMultiPolygon(result: MultiPolygon): OutlineArea {
  return result.flatMap((polygon) =>
    polygon.map((ring) =>
      // polygon-clipping repeats the first point at the end of each ring.
      ring
        .slice(0, -1)
        .map(([x, y]) => ({ x, y })),
    ),
  );
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
  );
}

/** Dark areas of one Gerber layer, with clear polarity already applied. */
interface DarkShape {
  readonly source: GerberShape["source"];
  readonly area: OutlineArea;
  readonly box: Box;
}

/** Resolves one object's own pieces (aperture holes, exposure-off macro parts). */
function objectArea(shape: GerberShape): OutlineArea {
  if (shape.pieces.every((piece) => piece.exposed))
    return shape.pieces.flatMap((piece) => piece.area);
  let result: MultiPolygon = [];
  for (const piece of shape.pieces) {
    const polygon = toPolygons(piece.area);
    result = piece.exposed
      ? polygonClipping.union(result, polygon)
      : polygonClipping.difference(result, polygon);
  }
  return fromMultiPolygon(result);
}

const GRID_MM = 5;

function cellsOf(box: Box): string[] {
  const cells: string[] = [];
  for (
    let x = Math.floor(box.minX / GRID_MM);
    x <= Math.floor(box.maxX / GRID_MM);
    x++
  )
    for (
      let y = Math.floor(box.minY / GRID_MM);
      y <= Math.floor(box.maxY / GRID_MM);
      y++
    )
      cells.push(`${x},${y}`);
  return cells;
}

const SOURCES = ["region", "draw", "flash"] as const;

/**
 * Applies clear objects to the dark objects drawn before them. Each run of
 * consecutive clear objects is one clipping operation per kind of dark
 * object, over just the dark objects it touches: one large operation is far
 * cheaper than one per object, above all in the native CLI's interpreter.
 */
function darkShapes(shapes: readonly GerberShape[]): DarkShape[] {
  let dark: DarkShape[] = [];
  let run: { readonly area: OutlineArea; readonly box: Box }[] = [];
  const flush = (): void => {
    if (run.length === 0) return;
    const grid = new Map<string, number[]>();
    run.forEach((clear, index) => {
      for (const cell of cellsOf(clear.box)) {
        const bucket = grid.get(cell);
        if (bucket) bucket.push(index);
        else grid.set(cell, [index]);
      }
    });
    const touched = new Set<number>();
    const cuts = new Map<GerberShape["source"], Set<number>>();
    dark.forEach((shape, index) => {
      for (const cell of cellsOf(shape.box))
        for (const clear of grid.get(cell) ?? []) {
          if (!overlaps(shape.box, (run[clear] as (typeof run)[number]).box))
            continue;
          touched.add(index);
          const set = cuts.get(shape.source);
          if (set) set.add(clear);
          else cuts.set(shape.source, new Set([clear]));
        }
    });
    if (touched.size > 0) {
      const kept = dark.filter((_, index) => !touched.has(index));
      for (const source of SOURCES) {
        const clears = cuts.get(source);
        if (!clears) continue;
        const subject = [...touched]
          .map((index) => dark[index] as DarkShape)
          .filter((shape) => shape.source === source)
          .flatMap((shape) => toPolygons(shape.area));
        const result = polygonClipping.difference(
          subject,
          ...[...clears].map((clear) =>
            toPolygons((run[clear] as (typeof run)[number]).area),
          ),
        );
        for (const polygon of result) {
          const area = fromMultiPolygon([polygon]);
          const box = outlineBounds([area]);
          if (box) kept.push({ source, area, box });
        }
      }
      dark = kept;
    }
    run = [];
  };
  for (const shape of shapes) {
    const area = objectArea(shape);
    const box = outlineBounds([area]);
    if (!box || area.length === 0) continue;
    if (shape.polarity === "clear") run.push({ area, box });
    else {
      flush();
      dark.push({ source: shape.source, area, box });
    }
  }
  flush();
  return dark;
}

/**
 * Bounds of a path's points and Bezier handles. A `draw.path` element maps
 * its contours from this box onto its visual box, so the two must agree;
 * exact curve bounds would shift and stretch paths whose handles overshoot.
 */
function handleBounds(
  contours: readonly (readonly FreehandPoint[])[],
): Box | undefined {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const contour of contours)
    for (const point of contour)
      for (const sample of [point, point.controlIn, point.controlOut]) {
        if (!sample) continue;
        minX = Math.min(minX, sample.x);
        minY = Math.min(minY, sample.y);
        maxX = Math.max(maxX, sample.x);
        maxY = Math.max(maxY, sample.y);
      }
  return minX <= maxX ? { minX, minY, maxX, maxY } : undefined;
}

/**
 * Splits contours into runs a single `draw.path` may hold. An area's holes
 * follow its outer contour, so a run never ends between them.
 */
function pathChunks(
  contours: readonly FreehandPoint[][],
  warn: (message: string) => void,
): FreehandPoint[][][] {
  const chunks: FreehandPoint[][][] = [];
  let chunk: FreehandPoint[][] = [];
  let points = 0;
  for (const contour of contours) {
    if (contour.length > MAX_PATH_POINTS) {
      warn(
        `a shape with ${contour.length} points exceeds ${MAX_PATH_POINTS} and is left out`,
      );
      continue;
    }
    const hole = contour !== contours[0] && isHole(contour);
    if (
      !hole &&
      chunk.length > 0 &&
      (chunk.length >= MAX_PATH_CONTOURS ||
        points + contour.length > MAX_PATH_POINTS)
    ) {
      chunks.push(chunk);
      chunk = [];
      points = 0;
    }
    chunk.push(contour);
    points += contour.length;
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

/**
 * Holes wind clockwise in board coordinates (y up). Flipping y for the page
 * flips the sign of the shoelace sum, so a hole's page sum is positive.
 */
function isHole(contour: readonly FreehandPoint[]): boolean {
  let doubled = 0;
  for (let index = 0; index < contour.length; index++) {
    const a = contour[index] as FreehandPoint;
    const b = contour[(index + 1) % contour.length] as FreehandPoint;
    doubled += a.x * b.y - b.x * a.y;
  }
  return doubled > 0;
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "layer"
  );
}

interface ParsedLayer {
  readonly file: string;
  readonly role: PcbLayerRole;
  readonly plating?: "plated" | "nonPlated";
  readonly shapes: readonly GerberShape[];
  readonly objects: number;
}

function parseLayer(
  file: PcbImportFile,
  warn: (message: string) => void,
): ParsedLayer {
  if (isExcellon(file.text)) {
    const drill = readExcellon(file.text);
    for (const warning of drill.warnings) warn(warning);
    const shapes: GerberShape[] = [
      ...drill.holes.map((hole) =>
        gerberShape({
          kind: "flash",
          polarity: "dark",
          aperture: { kind: "circle", diameter: hole.diameter },
          at: hole.at,
        }),
      ),
      ...drill.slots.map((slot) =>
        gerberShape({
          kind: "draw",
          polarity: "dark",
          aperture: { kind: "circle", diameter: slot.diameter },
          from: slot.from,
          to: slot.to,
        }),
      ),
    ];
    return {
      file: file.name,
      role: { kind: "drill", side: "board" },
      ...(drill.plating ? { plating: drill.plating } : {}),
      shapes,
      objects: drill.holes.length + drill.slots.length,
    };
  }
  const image = readGerber(file.text);
  for (const warning of image.warnings) warn(warning);
  return {
    file: file.name,
    role: identifyLayer(file.name, image.attributes.get(".FileFunction")),
    shapes: image.objects.map(gerberShape),
    objects: image.objects.length,
  };
}

/**
 * Draws Gerber and Excellon files on one freeform page. Throws
 * PcbImportError when no file can be read.
 */
export function importPcbPage(
  files: readonly PcbImportFile[],
  options: PcbImportOptions = {},
): PcbImportPage {
  const warnings: PcbImportWarning[] = [];
  const parsed: ParsedLayer[] = [];
  for (const file of files) {
    try {
      parsed.push(
        parseLayer(file, (message) =>
          warnings.push({ file: file.name, message }),
        ),
      );
    } catch (cause) {
      warnings.push({
        file: file.name,
        message: `skipped: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }
  }
  if (parsed.length === 0)
    throw new PcbImportError("no Gerber or drill file could be read");

  const layers = parsed
    .map((layer) => ({
      ...layer,
      dark: darkShapes(layer.shapes),
      style: layerStyle(layer.role),
    }))
    .sort((left, right) => left.style.order - right.style.order);
  const outline = layers.find(
    (layer) => layer.role.kind === "outline" && layer.dark.length,
  );
  const extent = outlineBounds(
    (outline ? [outline] : layers).flatMap((layer) =>
      layer.dark.map((shape) => shape.area),
    ),
  );
  if (!extent) throw new PcbImportError("the files draw nothing");
  const scale = options.unitsPerMm ?? 10;
  const margin = PAGE_MARGIN_MM * scale;
  const round = (value: number) => Math.round(value * 100) / 100;
  const place = (point: PcbPoint) => ({
    x: round((point.x - extent.minX) * scale + margin),
    y: round((extent.maxY - point.y) * scale + margin),
  });
  const pageContour = (contour: OutlineContour): FreehandPoint[] =>
    contour.map((point) => ({
      ...place(point),
      ...(point.controlIn ? { controlIn: place(point.controlIn) } : {}),
      ...(point.controlOut ? { controlOut: place(point.controlOut) } : {}),
    }));

  const pageId = options.pageId ?? "pcb-page-1";
  const elements: Element[] = [];
  const used = new Set<string>(options.reservedIds);
  const id = (stem: string): ElementId => {
    let candidate = stem;
    for (let suffix = 2; used.has(candidate); suffix++)
      candidate = `${stem}-${suffix}`;
    used.add(candidate);
    return candidate;
  };
  const add = (element: Omit<Element, "index" | "page">): void => {
    elements.push({
      ...element,
      page: pageId,
      index: `a${String(elements.length + 1).padStart(6, "0")}`,
    } as Element);
  };
  const width = extent.maxX - extent.minX;
  const height = extent.maxY - extent.minY;
  add({
    id: id("pcb-board"),
    type: "shape.geo",
    semantic: { geo: "rect", label: "" },
    visual: {
      x: 0,
      y: 0,
      width: round(width * scale + 2 * margin),
      height: round(height * scale + 2 * margin),
      locked: true,
      layerName: "Board background",
      style: { fill: BOARD_BACKDROP, stroke: "none" },
    },
  });

  const summary: PcbImportLayer[] = [];
  for (const layer of layers) {
    const name = layerName(layer.role);
    summary.push({
      file: layer.file,
      name,
      role: layer.role,
      objects: layer.objects,
    });
    const members: ElementId[] = [];
    const layerId = slug(name);
    const parts = new Map<GerberShape["source"], OutlineArea[]>();
    for (const shape of layer.dark) {
      const list = parts.get(shape.source);
      if (list) list.push(shape.area);
      else parts.set(shape.source, [shape.area]);
    }
    for (const source of ["region", "draw", "flash"] as const) {
      const areas = parts.get(source);
      if (!areas) continue;
      const contours = areas
        .flatMap((area) => area.map(pageContour))
        .filter((contour) => contour.length >= 3);
      for (const chunk of pathChunks(contours, (message) =>
        warnings.push({ file: layer.file, message }),
      )) {
        const box = handleBounds(chunk);
        if (!box) continue;
        const memberId = id(`pcb-${layerId}-${source}`);
        members.push(memberId);
        add({
          id: memberId,
          type: "draw.path",
          semantic: {
            name: partName(layer.role, source),
            contours: chunk.map((points) => ({ points })),
            fillRule: "nonzero",
          },
          visual: {
            x: box.minX,
            y: box.minY,
            width: round(Math.max(box.maxX - box.minX, 0.01)),
            height: round(Math.max(box.maxY - box.minY, 0.01)),
            ...(layer.style.hidden ? { hidden: true } : {}),
            style: {
              fill: layer.style.fill,
              stroke: "none",
              ...(layer.style.opacity === undefined
                ? {}
                : { opacity: layer.style.opacity }),
            },
          },
        });
      }
    }
    if (members.length === 0) continue;
    const file = layer.file.split(/[\\/]/).at(-1) ?? layer.file;
    add({
      id: id(`pcb-${layerId}`),
      type: "group",
      semantic: {
        memberIds: members,
        fabricationLayer: {
          kind: layer.role.kind,
          side: layer.role.side,
          ...(layer.role.inner === undefined || layer.role.inner < 1
            ? {}
            : { inner: layer.role.inner }),
          ...(layer.plating ? { plating: layer.plating } : {}),
          file,
          unitsPerMm: scale,
          originX: nanometres(extent.minX - PAGE_MARGIN_MM),
          originY: nanometres(extent.maxY + PAGE_MARGIN_MM),
        },
      },
      visual: {
        layerName: `${name} (${file})`,
        ...(layer.style.hidden ? { hidden: true } : {}),
      },
    });
  }
  return {
    page: {
      id: pageId,
      name: options.pageName?.trim() || "PCB",
      kind: "freeform",
    },
    elements,
    layers: summary,
    warnings,
    size: { width, height },
    bounds: extent,
  };
}

/** A new document holding one PCB page. */
export function importPcbFiles(
  files: readonly PcbImportFile[],
  options: PcbImportOptions = {},
): PcbImportReport {
  const { page, elements, layers, warnings, size, bounds } = importPcbPage(
    files,
    options,
  );
  const document: Document = {
    schemaVersion: SCHEMA_VERSION,
    id: options.documentId?.trim() || "pcb-document",
    title: options.title?.trim() || page.name,
    pages: [page],
    elements,
  };
  assertValidDocument(document);
  return { document, layers, warnings, size, bounds };
}
