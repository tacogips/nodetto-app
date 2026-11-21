import type { CadExtrudeSemantic, CadXY, ElementId } from "@nodetto/ir";
import type { CadLoop } from "./loops.ts";
import { cross3, type Vec3 } from "./vec.ts";

export interface CadFrame {
  readonly o: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
  readonly n: Vec3;
}

interface Span {
  t0: number;
  t1: number;
}

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];

export function baseFrame(base: "xy" | "yz" | "zx", offset = 0): CadFrame {
  switch (base) {
    case "xy":
      return { o: [0, 0, offset], u: X, v: Y, n: Z };
    case "yz":
      return { o: [offset, 0, 0], u: Y, v: Z, n: X };
    case "zx":
      return { o: [0, offset, 0], u: Z, v: X, n: Y };
  }
}

export function extrudeSpan(e: CadExtrudeSemantic): Span {
  return e.symmetric
    ? { t0: -e.distance / 2, t1: e.distance / 2 }
    : { t0: 0, t1: e.distance };
}

export function toWorld({ o, u, v, n }: CadFrame, p: CadXY, t = 0): Vec3 {
  return [
    o[0] + u[0] * p[0] + v[0] * p[1] + n[0] * t,
    o[1] + u[1] * p[0] + v[1] * p[1] + n[1] * t,
    o[2] + u[2] * p[0] + v[2] * p[1] + n[2] * t,
  ];
}

export function faceFrame(
  parent: CadFrame,
  span: Span,
  role: "start" | "end" | "side",
  line?: { a: CadXY; b: CadXY },
): CadFrame {
  if (role !== "side") {
    return {
      ...parent,
      o: toWorld(parent, [0, 0], span[role === "start" ? "t0" : "t1"]),
    };
  }
  if (line === undefined) throw new RangeError("A side frame requires a line");
  const dx = line.b[0] - line.a[0];
  const dy = line.b[1] - line.a[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0)
    throw new RangeError("A side frame requires a nonzero line");
  const x = dx / length;
  const y = dy / length;
  const u: Vec3 = [
    parent.u[0] * x + parent.v[0] * y,
    parent.u[1] * x + parent.v[1] * y,
    parent.u[2] * x + parent.v[2] * y,
  ];
  const v = parent.n;
  return { o: toWorld(parent, line.a, span.t0), u, v, n: cross3(u, v) };
}

/** +1: outward is +n of the face frame; -1: outward is -n. */
export function capOutwardSign(span: Span, role: "start" | "end"): 1 | -1 {
  return span.t1 < span.t0 === (role === "start") ? 1 : -1;
}

export function sideOutwardSign(loop: CadLoop, entity: ElementId): 1 | -1 | 0 {
  const index = loop.sources.indexOf(entity);
  if (index < 0) return 0;
  return Boolean(loop.reversed[index]) === (loop.depth % 2 === 1) ? 1 : -1;
}
