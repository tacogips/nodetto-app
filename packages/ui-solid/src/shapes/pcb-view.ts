import {
  arcCenter,
  arcIsClockwise,
  footprintToBoard,
  padCopperOutline,
  padPrimitiveOutlines,
  strokeTextBlock,
} from "@nodetto/core";
import type { PcbOutline } from "@nodetto/core";
import type {
  Element,
  PcbFootprintSemantic,
  PcbGraphicItem,
  PcbPad,
  PcbTrackSemantic,
  PcbViaSemantic,
  PcbZoneSemantic,
  PcbXY,
} from "@nodetto/ir";
import { PCB_PAGE_SCALE, pcbRotate } from "@nodetto/ir";
import { isPcbLayerHidden } from "../pcb-state.ts";

export interface PcbViewPath {
  readonly kind: "path";
  readonly d: string;
  readonly stroke: string;
  readonly width: number;
  readonly fill: string;
  readonly layer: string;
}
export interface PcbViewCircle {
  readonly kind: "circle";
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly stroke: string;
  readonly width: number;
  readonly fill: string;
  readonly layer: string;
}
export type PcbViewPrimitive = PcbViewPath | PcbViewCircle;
export const PCB_LAYER_COLORS: Readonly<Record<string, string>> = {
  "F.Cu": "#c83434",
  "B.Cu": "#3466c8",
  "F.SilkS": "#f2eecb",
  "B.SilkS": "#f2eecb",
  "F.Fab": "#9a9a9a",
  "B.Fab": "#9a9a9a",
  "Edge.Cuts": "#d0d0d0",
};
export const PCB_HOLES_COLOR = "#202020";
/** Display colour of a PCB layer on the canvas. */
export const pcbLayerColor = (layer: string): string =>
  layer.endsWith(".Cu")
    ? (PCB_LAYER_COLORS[layer] ?? "#c8a034")
    : (PCB_LAYER_COLORS[layer] ?? "#d0d0d0");
const page = ([x, y]: PcbXY): PcbXY => [x * PCB_PAGE_SCALE, y * PCB_PAGE_SCALE];
const path = (
  d: string,
  layer: string,
  width = 0.12,
  fill = "none",
): PcbViewPath => ({
  kind: "path",
  d,
  stroke: pcbLayerColor(layer),
  width: width * PCB_PAGE_SCALE,
  fill,
  layer,
});
function outlinePath(outline: PcbOutline): string {
  if (outline.kind === "circle") {
    const [x, y] = page(outline.center);
    const r = outline.radius * PCB_PAGE_SCALE;
    return `M ${x + r} ${y} A ${r} ${r} 0 1 0 ${x - r} ${y} A ${r} ${r} 0 1 0 ${x + r} ${y}`;
  }
  let d = `M ${page(outline.start).join(" ")}`;
  let from = outline.start;
  for (const segment of outline.segments) {
    if (segment.arc) {
      const radius =
        Math.hypot(
          from[0] - segment.arc.center[0],
          from[1] - segment.arc.center[1],
        ) * PCB_PAGE_SCALE;
      d += ` A ${radius} ${radius} 0 0 ${segment.arc.clockwise ? 1 : 0} ${page(segment.to).join(" ")}`;
    } else d += ` L ${page(segment.to).join(" ")}`;
    from = segment.to;
  }
  return d;
}
function boardPoint(
  fp: PcbFootprintSemantic,
  local: PcbXY,
  rotation = 0,
): PcbXY {
  return footprintToBoard(
    { at: fp.at, rotation: fp.rotation },
    pcbRotate(local, rotation),
  );
}
function graphicPaths(
  item: PcbGraphicItem,
  fp?: PcbFootprintSemantic,
): PcbViewPrimitive[] {
  const transform = (pt: PcbXY) =>
    page(
      fp
        ? boardPoint(
            fp,
            pt,
            item.shape.kind === "text" ? item.shape.rotation : 0,
          )
        : pt,
    );
  const s = item.shape;
  if (s.kind === "text") {
    if (s.hidden) return [];
    const lines = strokeTextBlock(s.text, s.size[1], s.justify?.horizontal);
    const paths: PcbViewPrimitive[] = [];
    for (const polyline of lines) {
      const points = polyline.map(({ x, y }) => {
        const yUp: PcbXY = [x, -y];
        const mirrored: PcbXY = s.justify?.mirror ? [-yUp[0], yUp[1]] : yUp;
        const rotated = pcbRotate(mirrored, s.rotation);
        const local: PcbXY = [s.at[0] + rotated[0], s.at[1] + rotated[1]];
        const placed = fp ? footprintToBoard(fp, local) : local;
        return page(placed);
      });
      paths.push(
        path(
          `M ${points.map((p) => `${p[0]} ${p[1]}`).join(" L ")}`,
          item.layer,
          s.thickness,
        ),
      );
    }
    return paths;
  }
  if (s.kind === "line") {
    const a = transform(s.start);
    const b = transform(s.end);
    return [
      path(`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`, item.layer, item.width),
    ];
  }
  if (s.kind === "arc") {
    const a = transform(s.start);
    const m = transform(s.mid);
    const b = transform(s.end);
    const center = arcCenter(a, m, b);
    if (!center)
      return [
        path(`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`, item.layer, item.width),
      ];
    const radius = Math.hypot(a[0] - center[0], a[1] - center[1]);
    return [
      path(
        `M ${a[0]} ${a[1]} A ${radius} ${radius} 0 0 ${arcIsClockwise(a, m, b) ? 1 : 0} ${b[0]} ${b[1]}`,
        item.layer,
        item.width,
      ),
    ];
  }
  if (s.kind === "circle") {
    const c = transform(s.center);
    return [
      {
        kind: "circle",
        cx: c[0],
        cy: c[1],
        r: s.radius * PCB_PAGE_SCALE,
        stroke: pcbLayerColor(item.layer),
        width: item.width * PCB_PAGE_SCALE,
        fill: item.fill ? pcbLayerColor(item.layer) : "none",
        layer: item.layer,
      },
    ];
  }
  const pts =
    s.kind === "rect"
      ? [
          s.start,
          [s.end[0], s.start[1]] as PcbXY,
          s.end,
          [s.start[0], s.end[1]] as PcbXY,
          s.start,
        ]
      : s.points;
  return [
    path(
      `M ${pts.map((pt) => transform(pt).join(" ")).join(" L ")} Z`,
      item.layer,
      item.width,
      item.fill ? pcbLayerColor(item.layer) : "none",
    ),
  ];
}
function padPaths(fp: PcbFootprintSemantic, pad: PcbPad): PcbViewPrimitive[] {
  const out: PcbViewPrimitive[] = [];
  for (const layer of pad.layers.filter((value) => value.endsWith(".Cu"))) {
    const outline = padCopperOutline(fp, pad);
    if (outline.kind === "circle") {
      const c = page(outline.center);
      out.push({
        kind: "circle",
        cx: c[0],
        cy: c[1],
        r: outline.radius * PCB_PAGE_SCALE,
        stroke: pcbLayerColor(layer),
        width: 0,
        fill: pcbLayerColor(layer),
        layer,
      });
    } else {
      out.push(path(outlinePath(outline), layer, 0, pcbLayerColor(layer)));
    }
    for (const primitive of padPrimitiveOutlines(fp, pad))
      out.push(path(outlinePath(primitive), layer, 0, pcbLayerColor(layer)));
  }
  if ((pad.type === "thru_hole" || pad.type === "np_thru_hole") && pad.drill) {
    const [x, y] = page(footprintToBoard(fp, pad.at));
    if (pad.drill.slot) {
      const [sx, sy] = pad.drill.slot;
      const minor = Math.min(sx, sy) * PCB_PAGE_SCALE;
      const major = Math.max(sx, sy) * PCB_PAGE_SCALE;
      const half = Math.max(0, major - minor) / 2;
      const angle = fp.rotation + pad.rotation + (sx >= sy ? 0 : 90);
      const vector = pcbRotate([half, 0], angle);
      const radius = minor / 2;
      const normal = pcbRotate([0, radius], angle);
      const start = [x - vector[0], y - vector[1]] as const;
      const end = [x + vector[0], y + vector[1]] as const;
      out.push({
        kind: "path",
        d: `M ${start[0] + normal[0]} ${start[1] + normal[1]} L ${end[0] + normal[0]} ${end[1] + normal[1]} A ${radius} ${radius} 0 0 0 ${end[0] - normal[0]} ${end[1] - normal[1]} L ${start[0] - normal[0]} ${start[1] - normal[1]} A ${radius} ${radius} 0 0 0 ${start[0] + normal[0]} ${start[1] + normal[1]} Z`,
        stroke: PCB_HOLES_COLOR,
        width: 0,
        fill: PCB_HOLES_COLOR,
        layer: "holes",
      });
    } else
      out.push({
        kind: "circle",
        cx: x,
        cy: y,
        r: (pad.drill.diameter * PCB_PAGE_SCALE) / 2,
        stroke: PCB_HOLES_COLOR,
        width: 0,
        fill: PCB_HOLES_COLOR,
        layer: "holes",
      });
  }
  return out;
}
export function pcbViewModel(
  element: Element,
  hidden: ReadonlySet<string> = new Set(),
): readonly PcbViewPrimitive[] {
  const s = element.semantic as PcbFootprintSemantic &
    PcbTrackSemantic &
    PcbViaSemantic &
    PcbZoneSemantic &
    PcbGraphicItem;
  if (element.visual.hidden === true || element.type === "pcb.board") return [];
  const off = (layer: string): boolean => isPcbLayerHidden(hidden, layer);
  if (element.type === "pcb.footprint") {
    const fp = s as PcbFootprintSemantic;
    const layers = new Set([
      ...fp.graphics.map((g) => g.layer),
      ...fp.pads.flatMap((p) => p.layers),
    ]);
    if ([...layers].every((layer) => off(layer))) return [];
    const result: PcbViewPrimitive[] = [];
    const graphics = [...fp.graphics].sort(
      (a, b) =>
        Number(a.layer.startsWith("F.")) - Number(b.layer.startsWith("F.")),
    );
    for (const graphic of graphics)
      if (!off(graphic.layer)) result.push(...graphicPaths(graphic, fp));
    for (const pad of fp.pads)
      if (!pad.layers.every((layer) => off(layer)))
        result.push(...padPaths(fp, pad));
    return result;
  }
  if (element.type === "pcb.track") {
    if (off(s.layer)) return [];
    const points = s.points.map(page);
    if (s.mid && points.length === 2) {
      const mid = page(s.mid);
      const center = arcCenter(points[0] ?? [0, 0], mid, points[1] ?? [0, 0]);
      if (center) {
        const start = points[0] ?? [0, 0];
        const end = points[1] ?? [0, 0];
        const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
        const d = `M ${start.join(" ")} A ${radius} ${radius} 0 0 ${arcIsClockwise(start, mid, end) ? 1 : 0} ${end.join(" ")}`;
        return [path(d, s.layer, s.width)];
      }
    }
    return [
      path(`M ${points.map((p) => p.join(" ")).join(" L ")}`, s.layer, s.width),
    ];
  }
  if (element.type === "pcb.via") {
    if (s.layers.every((layer) => off(layer))) return [];
    const [x, y] = page(s.at);
    return [
      {
        kind: "circle",
        cx: x,
        cy: y,
        r: (s.diameter * PCB_PAGE_SCALE) / 2,
        stroke: "#e0c674",
        width: 1.2,
        fill: "none",
        layer: s.layers[0] ?? "F.Cu",
      },
      {
        kind: "circle",
        cx: x,
        cy: y,
        r: (s.drill * PCB_PAGE_SCALE) / 2,
        stroke: PCB_HOLES_COLOR,
        width: 0,
        fill: PCB_HOLES_COLOR,
        layer: "holes",
      },
    ];
  }
  if (element.type === "pcb.zone") {
    const result: PcbViewPrimitive[] = [];
    if (!s.layers.every((layer) => off(layer))) {
      const points = s.outline.map(page);
      result.push(
        path(
          `M ${points.map((p) => p.join(" ")).join(" L ")} Z`,
          s.layers[0] ?? "F.Cu",
          0.12,
        ),
      );
      for (const filled of s.filled)
        if (!off(filled.layer))
          for (const polygon of filled.polygons) {
            const ps = polygon.map(page);
            const item = path(
              `M ${ps.map((p) => p.join(" ")).join(" L ")} Z`,
              filled.layer,
              0,
              pcbLayerColor(filled.layer),
            );
            result.push({ ...item, fill: `${pcbLayerColor(filled.layer)}59` });
          }
    }
    return result;
  }
  if (element.type === "pcb.graphic")
    return off(s.layer) ? [] : graphicPaths(s);
  return [];
}
