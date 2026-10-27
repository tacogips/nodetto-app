import type {
  Document,
  Element,
  PageId,
  PcbFootprintSemantic,
  PcbGraphicItem,
  PcbPad,
  PcbBoardSemantic,
  PcbTrackSemantic,
  PcbViaSemantic,
  PcbZoneSemantic,
  PcbShape,
  PcbXY,
} from "@nodetto/ir";
import { pcbRotate, roundNm } from "@nodetto/ir";
import { encodeStoredZip } from "../zip.ts";
import {
  arcCenter,
  arcIsClockwise,
  expandCopperLayers,
  footprintToBoard,
  pageCopperLayers,
  padCopperOutline,
  padHasCopperLayer,
  padPrimitiveOutlines,
  shapeBounds,
} from "./geometry.ts";
import {
  excellonDrill,
  GerberLayer,
  strokeFontSupports,
  strokeText,
  strokeTextWidth,
  type GerberRegionContour,
  type PcbFile,
  type PcbPoint,
} from "../pcb/index.ts";

export interface PcbBoardExport {
  readonly width: number;
  readonly height: number;
  readonly files: readonly PcbFile[];
  readonly warnings: readonly string[];
  readonly notes: readonly string[];
}

const GENERATOR = "Nodetto,Breadboard PCB";
const DRILL_TITLE = "Nodetto PCB";
const round = (n: number): number => roundNm(n);
const point = ([x, y]: PcbXY): PcbPoint => ({ x, y });
const add = (a: PcbXY, b: PcbXY): PcbXY => [a[0] + b[0], a[1] + b[1]];
const mapName = (name: string | undefined): string => {
  const cleaned = (name ?? "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "pcb";
};
function ordered(elements: readonly Element[]): Element[] {
  return [...elements].sort((a, b) =>
    a.index < b.index ? -1 : a.index > b.index ? 1 : a.id.localeCompare(b.id),
  );
}
function semantic<T>(element: Element): T {
  return element.semantic as T;
}
function footprintShape(shape: PcbShape, fp: PcbFootprintSemantic): PcbShape {
  const transform = (p: PcbXY): PcbXY => footprintToBoard(fp, p);
  switch (shape.kind) {
    case "line":
    case "rect":
      return {
        ...shape,
        start: transform(shape.start),
        end: transform(shape.end),
      };
    case "arc":
      return {
        ...shape,
        start: transform(shape.start),
        mid: transform(shape.mid),
        end: transform(shape.end),
      };
    case "circle":
      return { ...shape, center: transform(shape.center) };
    case "polygon":
      return { ...shape, points: shape.points.map(transform) };
    case "text":
      return {
        ...shape,
        at: transform(shape.at),
        rotation: shape.rotation + fp.rotation,
      };
  }
}
function allGraphics(elements: readonly Element[]): PcbGraphicItem[] {
  const result: PcbGraphicItem[] = [];
  for (const element of elements) {
    if (element.visual.hidden === true) continue;
    if (element.type === "pcb.graphic") result.push(semantic(element));
    else if (element.type === "pcb.footprint") {
      const fp = semantic<PcbFootprintSemantic>(element);
      for (const graphic of fp.graphics) {
        const transformed = {
          ...graphic,
          shape: footprintShape(graphic.shape, fp),
        };
        textFootprints.set(transformed, fp);
        result.push(transformed);
      }
    }
  }
  return result;
}
function outlineContour(
  outline: ReturnType<typeof padCopperOutline>,
  map: (p: PcbXY) => PcbXY,
): GerberRegionContour {
  if (outline.kind === "circle") {
    const c = outline.center;
    const r = outline.radius;
    const start: PcbXY = [c[0] + r, c[1]];
    const opposite: PcbXY = [c[0] - r, c[1]];
    return {
      start: point(map(start)),
      segments: [opposite, start].map((to) => ({
        to: point(map(to)),
        arc: { center: point(map(c)), clockwise: false },
      })),
    };
  }
  const segments = outline.segments.map((segment) => {
    const converted = {
      to: point(map(segment.to)),
      ...(segment.arc
        ? {
            arc: {
              center: point(map(segment.arc.center)),
              clockwise: segment.arc.clockwise,
            },
          }
        : {}),
    };
    return converted;
  });
  return { start: point(map(outline.start)), segments };
}
function contour(
  points: readonly PcbXY[],
  map: (p: PcbXY) => PcbXY,
): GerberRegionContour {
  const [start = [0, 0]] = points;
  return {
    start: point(map(start)),
    segments: points.slice(1).map((p) => ({ to: point(map(p)) })),
  };
}
function drawShape(
  layer: GerberLayer,
  graphic: PcbGraphicItem,
  map: (p: PcbXY) => PcbXY,
): void {
  const shape = graphic.shape;
  const p = (xy: PcbXY): PcbPoint => point(map(xy));
  switch (shape.kind) {
    case "line":
      layer.stroke(graphic.width, [p(shape.start), p(shape.end)]);
      return;
    case "arc": {
      const center = arcCenter(shape.start, shape.mid, shape.end);
      if (center)
        layer.arc(
          graphic.width,
          p(shape.start),
          p(shape.end),
          p(center),
          arcIsClockwise(shape.start, shape.mid, shape.end),
        );
      else
        layer.stroke(graphic.width, [
          p(shape.start),
          p(shape.mid),
          p(shape.end),
        ]);
      return;
    }
    case "circle": {
      const c = shape.center;
      const r = shape.radius;
      const a: PcbXY = [c[0] + r, c[1]];
      const b: PcbXY = [c[0] - r, c[1]];
      layer.arc(graphic.width, p(a), p(b), p(c), false);
      layer.arc(graphic.width, p(b), p(a), p(c), false);
      return;
    }
    case "rect": {
      const points: PcbXY[] = [
        shape.start,
        [shape.end[0], shape.start[1]],
        shape.end,
        [shape.start[0], shape.end[1]],
        shape.start,
      ];
      layer.stroke(graphic.width, points.map(p));
      return;
    }
    case "polygon": {
      if (graphic.fill) layer.region([contour(shape.points, map)]);
      else {
        const points = [...shape.points];
        if (points.length) points.push(points[0] as PcbXY);
        layer.stroke(graphic.width, points.map(p));
      }
      return;
    }
    case "text": {
      if (shape.hidden) return;
      const text = resolvedText(shape, graphic);
      const width = strokeTextWidth(text, shape.size[1]);
      const justification =
        shape.justify?.horizontal === "left"
          ? width / 2
          : shape.justify?.horizontal === "right"
            ? -width / 2
            : 0;
      const strokes = strokeText(text, 0, 0, shape.size[1]);
      for (const stroke of strokes) {
        const transformed = stroke.map(({ x, y }) => {
          let sx = x;
          const sy = -y;
          sx += justification;
          if (shape.justify?.mirror) sx = -sx;
          const rotated = pcbRotate([sx, sy], shape.rotation);
          return p([shape.at[0] + rotated[0], shape.at[1] + rotated[1]]);
        });
        layer.stroke(shape.thickness, transformed);
      }
      return;
    }
  }
}
// Text role lookup is attached by exportGraphicText before this renderer runs.
const textFootprints = new WeakMap<PcbGraphicItem, PcbFootprintSemantic>();
function findTextFootprint(
  _shape: Extract<PcbShape, { kind: "text" }>,
  graphic: PcbGraphicItem,
): PcbFootprintSemantic | undefined {
  return textFootprints.get(graphic);
}
function resolvedText(
  shape: Extract<PcbShape, { kind: "text" }>,
  graphic: PcbGraphicItem,
): string {
  const footprint = findTextFootprint(shape, graphic);
  if (shape.role === "reference" && footprint) return footprint.reference;
  if (shape.role === "value" && footprint) return footprint.value;
  return shape.text;
}
function flashPad(
  layer: GerberLayer,
  fp: PcbFootprintSemantic,
  pad: PcbPad,
  map: (p: PcbXY) => PcbXY,
  copper: readonly string[],
  grow = 0,
): void {
  const at = footprintToBoard(fp, pad.at);
  const r = round(fp.rotation + pad.rotation);
  const normalized = ((r % 360) + 360) % 360;
  const dims = [pad.size[0] + grow * 2, pad.size[1] + grow * 2] as const;
  const simpleRotation = normalized % 90 === 0;
  if (pad.shape === "circle") {
    layer.flashAperture({ kind: "circle", diameter: dims[0] }, point(map(at)));
    return;
  }
  if (simpleRotation && (pad.shape === "rect" || pad.shape === "oval")) {
    const swapped = normalized === 90 || normalized === 270;
    const width = swapped ? dims[1] : dims[0];
    const height = swapped ? dims[0] : dims[1];
    layer.flashAperture(
      { kind: pad.shape === "rect" ? "rectangle" : "obround", width, height },
      point(map(at)),
    );
    return;
  }
  const outline = padCopperOutline(fp, pad, grow);
  layer.region([outlineContour(outline, map)]);
  if (pad.shape === "custom")
    for (const primitive of padPrimitiveOutlines(fp, pad))
      layer.region([outlineContour(primitive, map)]);
  void copper;
}
function layerGraphic(graphic: PcbGraphicItem, layerName: string): boolean {
  return (
    graphic.layer === layerName &&
    !(graphic.shape.kind === "text" && graphic.shape.hidden === true)
  );
}
export function exportPcbBoard(
  document: Document,
  pageId: PageId,
  options: { readonly name?: string } = {},
): PcbBoardExport | string {
  const elements = ordered(
    document.elements.filter(
      (element) => element.page === pageId && element.visual.hidden !== true,
    ),
  );
  const page = document.pages.find((item) => item.id === pageId);
  if (!page || page.kind !== "pcb") return "The page is not a PCB page.";
  const boardElement = elements.find((element) => element.type === "pcb.board");
  const board = boardElement
    ? semantic<PcbBoardSemantic>(boardElement)
    : undefined;
  const graphics = allGraphics(elements);
  const edgeGraphics = graphics.filter(
    (graphic) => graphic.layer === "Edge.Cuts",
  );
  if (!edgeGraphics.length) return "The board has no Edge.Cuts outline.";
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const graphic of edgeGraphics) {
    const bounds = shapeBounds(graphic.shape, 0);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }
  const width = round(maxX - minX);
  const height = round(maxY - minY);
  const map = (p: PcbXY): PcbXY => [round(p[0] - minX), round(maxY - p[1])];
  const copper = pageCopperLayers(board);
  const warnings: string[] = [];
  const inner = new Set<string>();
  const noteInner = (layers: readonly string[]) => {
    for (const name of expandCopperLayers(layers, copper))
      if (name !== "F.Cu" && name !== "B.Cu") inner.add(name);
  };
  const footprints = elements
    .filter((e) => e.type === "pcb.footprint")
    .map(semantic<PcbFootprintSemantic>);
  const tracks = elements
    .filter((e) => e.type === "pcb.track")
    .map(semantic<PcbTrackSemantic>);
  const vias = elements
    .filter((e) => e.type === "pcb.via")
    .map(semantic<PcbViaSemantic>);
  const zones = elements
    .filter((e) => e.type === "pcb.zone")
    .map(semantic<PcbZoneSemantic>);
  for (const zone of zones) {
    noteInner(zone.layers);
    for (const layer of zone.layers) {
      const fill = zone.filled.find((item) => item.layer === layer);
      if (!fill?.polygons.length)
        warnings.push(
          `Zone on ${zone.net || "no net"} has no fill; refill it in KiCad.`,
        );
    }
  }
  for (const track of tracks) noteInner([track.layer]);
  for (const via of vias) noteInner(via.layers);
  for (const fp of footprints) for (const pad of fp.pads) noteInner(pad.layers);
  if (inner.size) {
    const names = copper.filter((name) => inner.has(name));
    warnings.unshift(
      `The board has inner copper layers (${names.join(", ")}); only F.Cu and B.Cu are exported.`,
    );
  }
  const top = new GerberLayer("Copper,L1,Top");
  const bottom = new GerberLayer("Copper,L2,Bot");
  const copperLayers = new Map([
    ["F.Cu", top],
    ["B.Cu", bottom],
  ]);
  for (const name of ["F.Cu", "B.Cu"]) {
    const layer = copperLayers.get(name);
    if (!layer) continue;
    for (const zone of zones) {
      for (const fill of zone.filled)
        if (fill.layer === name)
          for (const polygon of fill.polygons)
            layer.region([contour(polygon, map)]);
    }
    for (const graphic of graphics)
      if (layerGraphic(graphic, name)) drawShape(layer, graphic, map);
    for (const track of tracks)
      if (track.layer === name) {
        const pts = track.points.map(map).map(point);
        if (track.mid && track.points.length === 2) {
          const [from, to] = pts;
          const center = arcCenter(
            track.points[0] as PcbXY,
            track.mid,
            track.points[1] as PcbXY,
          );
          if (from && to && center)
            layer.arc(
              track.width,
              from,
              to,
              point(map(center)),
              arcIsClockwise(
                track.points[0] as PcbXY,
                track.mid,
                track.points[1] as PcbXY,
              ),
            );
          else layer.stroke(track.width, pts);
        } else layer.stroke(track.width, pts);
      }
    for (const via of vias)
      if (expandCopperLayers(via.layers, copper).includes(name))
        layer.flashAperture(
          { kind: "circle", diameter: via.diameter },
          point(map(via.at)),
        );
    for (const fp of footprints)
      for (const pad of fp.pads)
        if (padHasCopperLayer(pad, name, copper))
          flashPad(layer, fp, pad, map, copper);
  }
  const maskTop = new GerberLayer("Soldermask,Top", "Negative");
  const maskBottom = new GerberLayer("Soldermask,Bot", "Negative");
  for (const [layerName, layer] of [
    ["F.Mask", maskTop],
    ["B.Mask", maskBottom],
  ] as const) {
    for (const graphic of graphics)
      if (layerGraphic(graphic, layerName)) drawShape(layer, graphic, map);
    for (const fp of footprints)
      for (const pad of fp.pads)
        if (pad.layers.includes("*.Mask") || pad.layers.includes(layerName))
          flashPad(
            layer,
            fp,
            pad,
            map,
            copper,
            pad.maskMargin ?? board?.maskExpansion ?? 0,
          );
  }
  const topLegend = new GerberLayer("Legend,Top");
  const bottomLegend = new GerberLayer("Legend,Bot");
  for (const [layerName, layer] of [
    ["F.SilkS", topLegend],
    ["B.SilkS", bottomLegend],
  ] as const) {
    for (const graphic of graphics)
      if (layerGraphic(graphic, layerName)) {
        const shape = graphic.shape;
        if (
          shape.kind === "text" &&
          [...resolvedText(shape, graphic)].some((c) => !strokeFontSupports(c))
        )
          warnings.push(
            `${resolvedText(shape, graphic)} has characters the silkscreen font cannot draw; they are omitted.`,
          );
        drawShape(layer, graphic, map);
      }
  }
  const outline = new GerberLayer("Profile,NP");
  for (const graphic of edgeGraphics)
    drawShape(
      outline,
      { ...graphic, width: graphic.width > 0 ? graphic.width : 0.1 },
      map,
    );
  const hits: { diameter: number; at: PcbPoint }[] = [];
  const slots: { diameter: number; from: PcbPoint; to: PcbPoint }[] = [];
  const npthHits: { diameter: number; at: PcbPoint }[] = [];
  const npthSlots: { diameter: number; from: PcbPoint; to: PcbPoint }[] = [];
  for (const via of vias)
    hits.push({ diameter: via.drill, at: point(map(via.at)) });
  for (const fp of footprints)
    for (const pad of fp.pads) {
      if (
        !pad.drill ||
        (pad.type !== "thru_hole" && pad.type !== "np_thru_hole")
      )
        continue;
      const total = fp.rotation + pad.rotation;
      const center = add(
        footprintToBoard(fp, pad.at),
        pcbRotate(pad.drill.offset ?? [0, 0], total),
      );
      const targetHits = pad.type === "np_thru_hole" ? npthHits : hits;
      const targetSlots = pad.type === "np_thru_hole" ? npthSlots : slots;
      if (pad.drill.slot) {
        const [sx, sy] = pad.drill.slot;
        const diameter = Math.min(sx, sy);
        const half = Math.max(0, (Math.max(sx, sy) - diameter) / 2);
        const axis: PcbXY = sx >= sy ? [half, 0] : [0, half];
        const delta = pcbRotate(axis, total);
        targetSlots.push({
          diameter,
          from: point(map([center[0] - delta[0], center[1] - delta[1]])),
          to: point(map([center[0] + delta[0], center[1] + delta[1]])),
        });
      } else
        targetHits.push({
          diameter: pad.drill.diameter,
          at: point(map(center)),
        });
    }
  const name = mapName(options.name);
  const gerberFile = (extension: string, layer: GerberLayer): PcbFile => ({
    path: `${name}.${extension}`,
    text: layer.text(GENERATOR),
  });
  const files: PcbFile[] = [
    gerberFile("GTL", top),
    gerberFile("GBL", bottom),
    gerberFile("GTS", maskTop),
    gerberFile("GBS", maskBottom),
    gerberFile("GTO", topLegend),
  ];
  if (!bottomLegend.empty) files.push(gerberFile("GBO", bottomLegend));
  files.push(gerberFile("GKO", outline));
  files.push({
    path: `${name}.DRL`,
    text: excellonDrill(hits, DRILL_TITLE, 2, { slots }),
  });
  if (npthHits.length || npthSlots.length)
    files.push({
      path: `${name}-NPTH.DRL`,
      text: excellonDrill(npthHits, DRILL_TITLE, 2, {
        plating: "nonPlated",
        slots: npthSlots,
      }),
    });
  const platedCount = hits.length + slots.length;
  const notes = [
    `Board ${width.toFixed(2)} x ${height.toFixed(2)} mm, 2 layers, ${platedCount} plated holes, ${footprints.length} footprints.`,
  ];
  if (zones.length)
    notes.push(
      "Zone fills are exported as read from the KiCad file; they are not refilled after edits.",
    );
  return { width, height, files, warnings, notes };
}

export function encodePcbBoardZip(result: PcbBoardExport): Uint8Array {
  const encoder = new TextEncoder();
  return encodeStoredZip(
    result.files.map((file) => ({
      path: file.path,
      contents: encoder.encode(file.text),
    })),
    "PCB archive",
  );
}
