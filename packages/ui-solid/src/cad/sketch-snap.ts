import type { CadFrame, Vec3 } from "@nodetto/core";
import { type CadXY, roundNm } from "@nodetto/ir";

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function sketchCoordinates(frame: CadFrame, point: Vec3): CadXY {
  const offset: Vec3 = [
    point[0] - frame.o[0],
    point[1] - frame.o[1],
    point[2] - frame.o[2],
  ];
  return [dot(offset, frame.u), dot(offset, frame.v)];
}

export function intersectSketch(
  frame: CadFrame,
  { origin, dir }: { origin: Vec3; dir: Vec3 },
): CadXY | null {
  const denominator = dot(frame.n, dir);
  if (Math.abs(denominator) < 1e-12) return null;
  const offset: Vec3 = [
    frame.o[0] - origin[0],
    frame.o[1] - origin[1],
    frame.o[2] - origin[2],
  ];
  const t = dot(frame.n, offset) / denominator;
  if (!Number.isFinite(t) || t < 0) return null;
  return sketchCoordinates(frame, [
    origin[0] + dir[0] * t,
    origin[1] + dir[1] * t,
    origin[2] + dir[2] * t,
  ]);
}

export function snapSketchPoint(
  p: CadXY,
  {
    grid,
    endpoints,
    anchor,
    tolerance,
  }: {
    grid: number;
    endpoints: readonly CadXY[];
    anchor?: CadXY;
    tolerance: number;
  },
): { p: CadXY; kind: "endpoint" | "axis" | "grid" } {
  const snap = (x: number) => roundNm(Math.round(x / grid) * grid);
  let closest: CadXY | undefined;
  let best = tolerance * tolerance;
  for (const endpoint of endpoints) {
    const dx = endpoint[0] - p[0];
    const dy = endpoint[1] - p[1];
    const distance = dx * dx + dy * dy;
    if (distance > best || (closest && distance === best)) continue;
    best = distance;
    closest = endpoint;
  }
  if (closest)
    return { p: [roundNm(closest[0]), roundNm(closest[1])], kind: "endpoint" };
  if (anchor) {
    const dx = Math.abs(anchor[0] - p[0]);
    const dy = Math.abs(anchor[1] - p[1]);
    if (dx <= tolerance && dx <= dy)
      return { p: [roundNm(anchor[0]), snap(p[1])], kind: "axis" };
    if (dy <= tolerance)
      return { p: [snap(p[0]), roundNm(anchor[1])], kind: "axis" };
  }
  return { p: [snap(p[0]), snap(p[1])], kind: "grid" };
}
