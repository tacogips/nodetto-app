import type { CadFrame } from "./frames.ts";
import { coordinate, type Vec3 } from "./vec.ts";

export type MutableVec3 = [number, number, number];
export interface MutableBounds3 {
  min: MutableVec3;
  max: MutableVec3;
}

const AXES = [0, 1, 2] as const;

/** A box that any included point or box replaces. */
export function emptyBounds(): MutableBounds3 {
  return {
    min: [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ],
    max: [
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ],
  };
}

export function isEmptyBounds({ min }: MutableBounds3): boolean {
  return min[0] === Number.POSITIVE_INFINITY;
}

export function includeBounds(
  box: MutableBounds3,
  { min, max }: { readonly min: Vec3; readonly max: Vec3 },
): void {
  for (const axis of AXES) {
    box.min[axis] = Math.min(box.min[axis], min[axis]);
    box.max[axis] = Math.max(box.max[axis], max[axis]);
  }
}

/** Bounds of profile loops swept from `t0` to `t1` along the frame normal. */
export function sweptBounds(
  { o, u, v, n }: CadFrame,
  t0: number,
  t1: number,
  loops: readonly { readonly points: ArrayLike<number> }[],
): MutableBounds3 {
  const min: MutableVec3 = [0, 0, 0];
  const max: MutableVec3 = [0, 0, 0];
  for (const axis of AXES) {
    const origin = o[axis];
    const alongX = u[axis];
    const alongY = v[axis];
    let lower = origin;
    let upper = origin;
    // On a constant axis all profile vertices have the same projection.
    if (alongX !== 0 || alongY !== 0) {
      lower = Number.POSITIVE_INFINITY;
      upper = Number.NEGATIVE_INFINITY;
      for (const { points } of loops) {
        for (let i = 0; i < points.length; i += 2) {
          const base =
            origin +
            alongX * coordinate(points, i) +
            alongY * coordinate(points, i + 1);
          lower = Math.min(lower, base);
          upper = Math.max(upper, base);
        }
      }
    }
    // The same endpoint offsets apply to every vertex on this axis.
    const start = n[axis] * t0;
    const end = n[axis] * t1;
    min[axis] = lower + Math.min(start, end);
    max[axis] = upper + Math.max(start, end);
  }
  return { min, max };
}

/** Bounds of packed x, y, z triples; empty for no points. */
export function pointBounds(positions: ArrayLike<number>): MutableBounds3 {
  const box = emptyBounds();
  for (let i = 0; i < positions.length; i += 3) {
    for (const axis of AXES) {
      const value = coordinate(positions, i + axis);
      box.min[axis] = Math.min(box.min[axis], value);
      box.max[axis] = Math.max(box.max[axis], value);
    }
  }
  return box;
}
