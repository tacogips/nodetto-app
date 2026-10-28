import type {
  PcbElementType,
  PcbFootprintSemantic,
  PcbGraphicItem,
  PcbPad,
  PcbPadPrimitive,
  PcbShape,
  PcbXY,
  PcbBoardSemantic,
} from "@nodetto/ir";
import { pcbRotate, roundNm } from "@nodetto/ir";
import { strokeTextWidth } from "../pcb/font.ts";

export interface PcbBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}
export interface PcbOutlineSegment {
  readonly to: PcbXY;
  readonly arc?: { readonly center: PcbXY; readonly clockwise: boolean };
}
export type PcbOutline =
  | { readonly kind: "circle"; readonly center: PcbXY; readonly radius: number }
  | {
      readonly kind: "contour";
      readonly start: PcbXY;
      readonly segments: readonly PcbOutlineSegment[];
    };

type Transform = { readonly at: PcbXY; readonly rotation: number };
const add = (a: PcbXY, b: PcbXY): PcbXY => [a[0] + b[0], a[1] + b[1]];
const sub = (a: PcbXY, b: PcbXY): PcbXY => [a[0] - b[0], a[1] - b[1]];
const length = (x: number, y: number): number => Math.sqrt(x * x + y * y);
const transform = (t: Transform, p: PcbXY): PcbXY =>
  add(t.at, pcbRotate(p, t.rotation));
const pointLineDistanceSquared = (p: PcbXY, a: PcbXY, b: PcbXY): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d2 = dx * dx + dy * dy;
  const amount =
    d2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d2),
        );
  const x = a[0] + amount * dx - p[0];
  const y = a[1] + amount * dy - p[1];
  return x * x + y * y;
};

export function footprintToBoard(fp: Transform, local: PcbXY): PcbXY {
  return add(fp.at, pcbRotate(local, fp.rotation));
}
export function padShapeCenter(
  fp: { readonly at: PcbXY; readonly rotation: number },
  pad: PcbPad,
): PcbXY {
  return add(
    footprintToBoard(fp, pad.at),
    pcbRotate(pad.drill?.offset ?? [0, 0], fp.rotation + pad.rotation),
  );
}
export function boardToFootprint(fp: Transform, board: PcbXY): PcbXY {
  return pcbRotate(sub(board, fp.at), -fp.rotation);
}

function contour(points: readonly PcbXY[]): PcbOutline {
  const [start = [0, 0]] = points;
  return {
    kind: "contour",
    start,
    segments: points.slice(1).map((to) => ({ to })),
  };
}
function mapOutline(outline: PcbOutline, t: Transform): PcbOutline {
  return outline.kind === "circle"
    ? { ...outline, center: transform(t, outline.center) }
    : {
        kind: "contour",
        start: transform(t, outline.start),
        segments: outline.segments.map((segment) => ({
          to: transform(t, segment.to),
          ...(segment.arc
            ? {
                arc: {
                  ...segment.arc,
                  center: transform(t, segment.arc.center),
                },
              }
            : {}),
        })),
      };
}

export function padCopperOutline(
  fp: Transform,
  pad: PcbPad,
  grow = 0,
): PcbOutline {
  const [w, h] = pad.size;
  const width = w + 2 * grow;
  const height = h + 2 * grow;
  const center = padShapeCenter(fp, pad);
  const t = { at: center, rotation: fp.rotation + pad.rotation };
  if (pad.shape === "circle" || (pad.shape === "custom" && width === height))
    return { kind: "circle", center, radius: width / 2 };
  if (pad.shape === "custom" || pad.shape === "rect")
    return mapOutline(
      contour([
        [-width / 2, -height / 2],
        [width / 2, -height / 2],
        [width / 2, height / 2],
        [-width / 2, height / 2],
        [-width / 2, -height / 2],
      ]),
      t,
    );
  if (pad.shape === "trapezoid") {
    const [dx = 0, dy = 0] = pad.trapezoidDelta ?? [0, 0];
    return mapOutline(
      contour([
        [-width / 2 + dx, -height / 2 + dy],
        [width / 2 - dx, -height / 2 - dy],
        [width / 2 + dx, height / 2 + dy],
        [-width / 2 - dx, height / 2 - dy],
        [-width / 2 + dx, -height / 2 + dy],
      ]),
      t,
    );
  }
  const radius =
    pad.shape === "roundrect"
      ? Math.min(width, height) * (pad.roundrectRatio ?? 0.25) + grow
      : Math.min(width, height) / 2;
  if (pad.shape === "roundrect") {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    const x = width / 2 - r;
    const y = height / 2 - r;
    const local: PcbOutline = {
      kind: "contour",
      start: [-x, -height / 2],
      segments: [
        { to: [x, -height / 2] },
        { to: [width / 2, -y], arc: { center: [x, -y], clockwise: true } },
        { to: [width / 2, y] },
        { to: [x, height / 2], arc: { center: [x, y], clockwise: true } },
        { to: [-x, height / 2] },
        { to: [-width / 2, y], arc: { center: [-x, y], clockwise: true } },
        { to: [-width / 2, -y] },
        { to: [-x, -height / 2], arc: { center: [-x, -y], clockwise: true } },
      ],
    };
    return mapOutline(local, t);
  }
  if (width === height) return { kind: "circle", center, radius };
  const horizontal = width > height;
  const halfStraight = Math.abs(width - height) / 2;
  const r = Math.min(width, height) / 2;
  const local: PcbOutline = horizontal
    ? {
        kind: "contour",
        start: [-halfStraight, -r],
        segments: [
          { to: [halfStraight, -r] },
          {
            to: [halfStraight, r],
            arc: { center: [halfStraight, 0], clockwise: true },
          },
          { to: [-halfStraight, r] },
          {
            to: [-halfStraight, -r],
            arc: { center: [-halfStraight, 0], clockwise: true },
          },
        ],
      }
    : {
        kind: "contour",
        start: [-r, -halfStraight],
        segments: [
          {
            to: [r, -halfStraight],
            arc: { center: [0, -halfStraight], clockwise: true },
          },
          { to: [r, halfStraight] },
          {
            to: [-r, halfStraight],
            arc: { center: [0, halfStraight], clockwise: true },
          },
          { to: [-r, -halfStraight] },
        ],
      };
  return mapOutline(local, t);
}

export function padPrimitiveOutlines(fp: Transform, pad: PcbPad): PcbOutline[] {
  const center = padShapeCenter(fp, pad);
  return (pad.primitives ?? []).map((primitive: PcbPadPrimitive) =>
    primitive.shape.kind === "polygon"
      ? mapOutline(contour(primitive.shape.points), {
          at: center,
          rotation: fp.rotation + pad.rotation,
        })
      : shapeOutline(primitive.shape, {
          at: center,
          rotation: fp.rotation + pad.rotation,
        }),
  );
}

function shapeOutline(shape: PcbShape, t: Transform): PcbOutline {
  switch (shape.kind) {
    case "circle":
      return {
        kind: "circle",
        center: transform(t, shape.center),
        radius: shape.radius,
      };
    case "rect":
      return mapOutline(
        contour([
          shape.start,
          [shape.end[0], shape.start[1]],
          shape.end,
          [shape.start[0], shape.end[1]],
          shape.start,
        ]),
        t,
      );
    case "line":
      return mapOutline(contour([shape.start, shape.end]), t);
    case "polygon":
      return mapOutline(contour(shape.points), t);
    case "arc":
      return {
        kind: "contour",
        start: transform(t, shape.start),
        segments: [
          {
            to: transform(t, shape.end),
            arc: {
              center: transform(
                t,
                arcCenter(shape.start, shape.mid, shape.end) ?? shape.mid,
              ),
              clockwise: arcIsClockwise(shape.start, shape.mid, shape.end),
            },
          },
        ],
      };
    case "text":
      return mapOutline(
        contour([
          [shape.at[0], shape.at[1]],
          [
            shape.at[0] + strokeTextWidth(shape.text, shape.size[1]),
            shape.at[1],
          ],
        ]),
        t,
      );
  }
}

function contourPoints(
  outline: Extract<PcbOutline, { kind: "contour" }>,
  tolerance: number,
): PcbXY[] {
  const result: PcbXY[] = [outline.start];
  let start = outline.start;
  for (const segment of outline.segments) {
    if (!segment.arc) result.push(segment.to);
    else {
      const center = segment.arc.center;
      const radius = length(start[0] - center[0], start[1] - center[1]);
      const appendArc = (a: PcbXY, b: PcbXY, depth: number): void => {
        const va = sub(a, center);
        const vb = sub(b, center);
        let bisector: PcbXY = [va[0] + vb[0], va[1] + vb[1]];
        let norm = length(bisector[0], bisector[1]);
        if (norm < 1e-12) {
          bisector = segment.arc?.clockwise ? [-va[1], va[0]] : [va[1], -va[0]];
          norm = length(bisector[0], bisector[1]);
        }
        const middle: PcbXY = [
          center[0] + (bisector[0] * radius) / norm,
          center[1] + (bisector[1] * radius) / norm,
        ];
        if (
          depth >= 24 ||
          pointLineDistanceSquared(middle, a, b) <= tolerance * tolerance
        ) {
          result.push(b);
          return;
        }
        appendArc(a, middle, depth + 1);
        appendArc(middle, b, depth + 1);
      };
      appendArc(start, segment.to, 0);
    }
    start = segment.to;
  }
  return result;
}

export function outlineContains(
  outline: PcbOutline,
  point: PcbXY,
  tolerance = 1e-6,
): boolean {
  if (outline.kind === "circle") {
    const dx = point[0] - outline.center[0];
    const dy = point[1] - outline.center[1];
    return dx * dx + dy * dy <= (outline.radius + tolerance) ** 2;
  }
  const vertices = contourPoints(outline, 0.001);
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[j] as PcbXY;
    const b = vertices[i] as PcbXY;
    if (pointLineDistanceSquared(point, a, b) <= tolerance * tolerance)
      return true;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

export function arcCenter(
  start: PcbXY,
  mid: PcbXY,
  end: PcbXY,
): PcbXY | undefined {
  const [ax, ay] = start;
  const [bx, by] = mid;
  const [cx, cy] = end;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-12) return undefined;
  const aa = ax * ax + ay * ay;
  const bb = bx * bx + by * by;
  const cc = cx * cx + cy * cy;
  return [
    (aa * (by - cy) + bb * (cy - ay) + cc * (ay - by)) / d,
    (aa * (cx - bx) + bb * (ax - cx) + cc * (bx - ax)) / d,
  ];
}
export function arcIsClockwise(start: PcbXY, mid: PcbXY, end: PcbXY): boolean {
  return (
    (mid[0] - start[0]) * (end[1] - mid[1]) -
      (mid[1] - start[1]) * (end[0] - mid[0]) >
    0
  );
}

function bounds(points: readonly PcbXY[]): PcbBounds {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}
function include(a: PcbBounds | undefined, b: PcbBounds): PcbBounds {
  return a
    ? {
        minX: Math.min(a.minX, b.minX),
        minY: Math.min(a.minY, b.minY),
        maxX: Math.max(a.maxX, b.maxX),
        maxY: Math.max(a.maxY, b.maxY),
      }
    : b;
}
export function outlineBounds(outline: PcbOutline): PcbBounds {
  if (outline.kind === "circle")
    return {
      minX: outline.center[0] - outline.radius,
      minY: outline.center[1] - outline.radius,
      maxX: outline.center[0] + outline.radius,
      maxY: outline.center[1] + outline.radius,
    };
  const all: PcbXY[] = [outline.start];
  let start = outline.start;
  for (const segment of outline.segments) {
    all.push(segment.to);
    if (segment.arc) {
      const center = segment.arc.center;
      const radius = length(start[0] - center[0], start[1] - center[1]);
      for (const candidate of [
        [center[0] + radius, center[1]],
        [center[0], center[1] + radius],
        [center[0] - radius, center[1]],
        [center[0], center[1] - radius],
      ] as PcbXY[])
        if (
          arcSweepContains(
            start,
            segment.to,
            segment.arc.clockwise,
            center,
            candidate,
          )
        )
          all.push(candidate);
    }
    start = segment.to;
  }
  return bounds(all);
}
function angleHalf(v: PcbXY): number {
  return v[1] > 0 || (v[1] === 0 && v[0] >= 0) ? 0 : 1;
}
function angleCompare(a: PcbXY, b: PcbXY): number {
  const ah = angleHalf(a);
  const bh = angleHalf(b);
  if (ah !== bh) return ah - bh;
  const cross = a[0] * b[1] - a[1] * b[0];
  return cross > 0 ? -1 : cross < 0 ? 1 : 0;
}
function angleIncreasingBetween(
  start: PcbXY,
  end: PcbXY,
  value: PcbXY,
): boolean {
  const se = angleCompare(start, end);
  const sv = angleCompare(start, value);
  const ve = angleCompare(value, end);
  return se <= 0 ? sv <= 0 && ve <= 0 : sv <= 0 || ve <= 0;
}
function arcSweepContains(
  start: PcbXY,
  end: PcbXY,
  clockwise: boolean,
  center: PcbXY,
  point: PcbXY,
): boolean {
  const vector = (p: PcbXY): PcbXY => sub(p, center);
  return clockwise
    ? angleIncreasingBetween(vector(start), vector(end), vector(point))
    : angleIncreasingBetween(vector(end), vector(start), vector(point));
}

export function shapeBounds(shape: PcbShape, width: number): PcbBounds {
  let box: PcbBounds;
  switch (shape.kind) {
    case "line":
      box = bounds([shape.start, shape.end]);
      break;
    case "rect":
      box = bounds([shape.start, shape.end]);
      break;
    case "polygon":
      box = bounds(shape.points);
      break;
    case "circle":
      box = {
        minX: shape.center[0] - shape.radius,
        minY: shape.center[1] - shape.radius,
        maxX: shape.center[0] + shape.radius,
        maxY: shape.center[1] + shape.radius,
      };
      break;
    case "arc": {
      const center = arcCenter(shape.start, shape.mid, shape.end);
      box = center
        ? outlineBounds({
            kind: "contour",
            start: shape.start,
            segments: [
              {
                to: shape.end,
                arc: {
                  center,
                  clockwise: arcIsClockwise(shape.start, shape.mid, shape.end),
                },
              },
            ],
          })
        : bounds([shape.start, shape.mid, shape.end]);
      break;
    }
    case "text": {
      const textWidth = strokeTextWidth(shape.text, shape.size[1]);
      const half = shape.justify?.horizontal === "right" ? -textWidth : 0;
      const corners = [
        [half, 0],
        [half + textWidth, 0],
        [half + textWidth, shape.size[1]],
        [half, shape.size[1]],
      ] as PcbXY[];
      box = bounds(
        corners.map((point) => add(shape.at, pcbRotate(point, shape.rotation))),
      );
      break;
    }
  }
  const halfWidth = width / 2;
  return {
    minX: box.minX - halfWidth,
    minY: box.minY - halfWidth,
    maxX: box.maxX + halfWidth,
    maxY: box.maxY + halfWidth,
  };
}

export function footprintBounds(fp: PcbFootprintSemantic): PcbBounds {
  let result: PcbBounds | undefined;
  const includeOutline = (outline: PcbOutline) => {
    result = include(result, outlineBounds(outline));
  };
  for (const pad of fp.pads) {
    includeOutline(padCopperOutline(fp, pad));
    for (const primitive of padPrimitiveOutlines(fp, pad))
      includeOutline(primitive);
  }
  for (const graphic of fp.graphics)
    result = include(result, graphicBounds(fp, graphic));
  return (
    result ?? { minX: fp.at[0], minY: fp.at[1], maxX: fp.at[0], maxY: fp.at[1] }
  );
}
function graphicBounds(fp: Transform, graphic: PcbGraphicItem): PcbBounds {
  const shape = graphic.shape;
  const transformPoint = (p: PcbXY) => footprintToBoard(fp, p);
  const mapped: PcbShape =
    shape.kind === "line" || shape.kind === "rect"
      ? {
          ...shape,
          start: transformPoint(shape.start),
          end: transformPoint(shape.end),
        }
      : shape.kind === "arc"
        ? {
            ...shape,
            start: transformPoint(shape.start),
            mid: transformPoint(shape.mid),
            end: transformPoint(shape.end),
          }
        : shape.kind === "circle"
          ? { ...shape, center: transformPoint(shape.center) }
          : shape.kind === "polygon"
            ? { ...shape, points: shape.points.map(transformPoint) }
            : {
                ...shape,
                at: transformPoint(shape.at),
                rotation: shape.rotation + fp.rotation,
              };
  return shapeBounds(mapped, graphic.width);
}

export function expandCopperLayers(
  layers: readonly string[],
  copper: readonly string[],
): string[] {
  const result = new Set<string>();
  for (const layer of layers) {
    if (layer === "*.Cu") {
      for (const name of copper) result.add(name);
    } else if (layer === "F&B.Cu") {
      result.add("F.Cu");
      result.add("B.Cu");
    } else if (layer.endsWith(".Cu")) result.add(layer);
  }
  return [
    ...copper.filter((layer) => result.has(layer)),
    ...[...result].filter((layer) => !copper.includes(layer)),
  ];
}
export function padHasCopperLayer(
  pad: PcbPad,
  layer: string,
  copper: readonly string[],
): boolean {
  return expandCopperLayers(pad.layers, copper).includes(layer);
}
export function pageCopperLayers(
  board: PcbBoardSemantic | undefined,
): string[] {
  return board
    ? board.layers
        .filter((layer) => layer.name.endsWith(".Cu"))
        .map((layer) => layer.name)
    : ["F.Cu", "B.Cu"];
}
export function viaCopperLayers(
  via: { readonly layers: readonly [string, string] },
  copper: readonly string[],
): string[] {
  const start = copper.indexOf(via.layers[0]);
  const end = copper.indexOf(via.layers[1]);
  if (start < 0 || end < 0) return [];
  return copper.slice(Math.min(start, end), Math.max(start, end) + 1);
}

export class PcbGrid<T> {
  private readonly cells = new Map<string, T[]>();
  constructor(readonly cell = 2.54) {}
  insert(item: T, box: PcbBounds): void {
    for (
      let ix = Math.floor(box.minX / this.cell);
      ix <= Math.floor(box.maxX / this.cell);
      ix++
    )
      for (
        let iy = Math.floor(box.minY / this.cell);
        iy <= Math.floor(box.maxY / this.cell);
        iy++
      ) {
        const key = `${ix},${iy}`;
        const items = this.cells.get(key);
        if (items) items.push(item);
        else this.cells.set(key, [item]);
      }
  }
  query(box: PcbBounds): T[] {
    const seen = new Set<T>();
    const result: T[] = [];
    for (
      let ix = Math.floor(box.minX / this.cell);
      ix <= Math.floor(box.maxX / this.cell);
      ix++
    )
      for (
        let iy = Math.floor(box.minY / this.cell);
        iy <= Math.floor(box.maxY / this.cell);
        iy++
      )
        for (const item of this.cells.get(`${ix},${iy}`) ?? [])
          if (!seen.has(item)) {
            seen.add(item);
            result.push(item);
          }
    return result;
  }
}

export function pcbAnchor(
  type: PcbElementType,
  semantic: Record<string, unknown>,
): PcbXY | undefined {
  switch (type) {
    case "pcb.board":
      return undefined;
    case "pcb.footprint":
    case "pcb.via":
      return semantic["at"] as PcbXY;
    case "pcb.track":
      return (semantic["points"] as readonly PcbXY[] | undefined)?.[0];
    case "pcb.zone":
      return (semantic["outline"] as readonly PcbXY[] | undefined)?.[0];
    case "pcb.graphic": {
      const shape = semantic["shape"] as PcbShape | undefined;
      if (!shape) return undefined;
      switch (shape.kind) {
        case "line":
        case "arc":
        case "rect":
          return shape.start;
        case "circle":
          return shape.center;
        case "polygon":
          return shape.points[0];
        case "text":
          return shape.at;
      }
    }
  }
}

export function translatePcbSemantic(
  type: PcbElementType,
  semantic: Record<string, unknown>,
  dx: number,
  dy: number,
): Record<string, unknown> {
  const move = (p: PcbXY): PcbXY => [roundNm(p[0] + dx), roundNm(p[1] + dy)];
  switch (type) {
    case "pcb.board":
      return { ...semantic };
    case "pcb.footprint":
      return { ...semantic, at: move(semantic["at"] as PcbXY) };
    case "pcb.via":
      return { ...semantic, at: move(semantic["at"] as PcbXY) };
    case "pcb.track":
      return {
        ...semantic,
        points: (semantic["points"] as readonly PcbXY[]).map(move),
        ...(semantic["mid"] ? { mid: move(semantic["mid"] as PcbXY) } : {}),
      };
    case "pcb.zone":
      return {
        ...semantic,
        outline: (semantic["outline"] as readonly PcbXY[]).map(move),
        filled: (
          semantic["filled"] as readonly {
            readonly layer: string;
            readonly polygons: readonly (readonly PcbXY[])[];
          }[]
        ).map((filled) => ({
          ...filled,
          polygons: filled.polygons.map((polygon) => polygon.map(move)),
        })),
      };
    case "pcb.graphic":
      return {
        ...semantic,
        shape: translateShape(semantic["shape"] as PcbShape, move),
      };
  }
}
function translateShape(shape: PcbShape, move: (p: PcbXY) => PcbXY): PcbShape {
  switch (shape.kind) {
    case "line":
    case "rect":
      return { ...shape, start: move(shape.start), end: move(shape.end) };
    case "arc":
      return {
        ...shape,
        start: move(shape.start),
        mid: move(shape.mid),
        end: move(shape.end),
      };
    case "circle":
      return { ...shape, center: move(shape.center) };
    case "polygon":
      return { ...shape, points: shape.points.map(move) };
    case "text":
      return { ...shape, at: move(shape.at) };
  }
}
