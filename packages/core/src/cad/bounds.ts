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

export const cadBoundsWork = { vertexProjections: 0, extremaReads: 0 };

const extremaCache = new WeakMap<
  object,
  { frame: CadFrame; min: Vec3; max: Vec3 }
>();

export function loopExtents(
  points: ArrayLike<number>,
  frame: CadFrame,
): { min: Vec3; max: Vec3 } {
  const cached = extremaCache.get(points);
  if (cached?.frame === frame) return cached;
  const min: MutableVec3 = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: MutableVec3 = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  const { o, u, v } = frame;
  for (let i = 0; i < points.length; i += 2) {
    const x = coordinate(points, i);
    const y = coordinate(points, i + 1);
    cadBoundsWork.vertexProjections += 1;
    for (const axis of AXES) {
      const base = o[axis] + u[axis] * x + v[axis] * y;
      min[axis] = Math.min(min[axis], base);
      max[axis] = Math.max(max[axis], base);
    }
  }
  const result = { frame, min, max };
  extremaCache.set(points, result);
  return result;
}

const profileExtremaCache = new WeakMap<
  object,
  { frame: CadFrame; min: Vec3; max: Vec3 }
>();

export function profileExtents(
  loops: readonly { readonly points: ArrayLike<number> }[],
  frame: CadFrame,
): { readonly min: Vec3; readonly max: Vec3 } {
  const single = loops.length === 1 ? loops[0] : undefined;
  if (single) {
    cadBoundsWork.extremaReads += 1;
    return loopExtents(single.points, frame);
  }
  const cached = profileExtremaCache.get(loops);
  if (cached?.frame === frame) return cached;
  const { min, max } = emptyBounds();
  for (const { points } of loops) {
    cadBoundsWork.extremaReads += 1;
    const extents = loopExtents(points, frame);
    for (const axis of AXES) {
      min[axis] = Math.min(min[axis], extents.min[axis]);
      max[axis] = Math.max(max[axis], extents.max[axis]);
    }
  }
  const result = { frame, min, max };
  profileExtremaCache.set(loops, result);
  return result;
}

/** Bounds of profile loops swept from `t0` to `t1` along the frame normal. */
export function sweptBounds(
  frame: CadFrame,
  t0: number,
  t1: number,
  loops: readonly { readonly points: ArrayLike<number> }[],
): MutableBounds3 {
  const { o, u, v, n } = frame;
  const min: MutableVec3 = [0, 0, 0];
  const max: MutableVec3 = [0, 0, 0];
  const extents = profileExtents(loops, frame);
  for (const axis of AXES) {
    const origin = o[axis];
    const alongX = u[axis];
    const alongY = v[axis];
    let lower = origin;
    let upper = origin;
    // On a constant axis all profile vertices have the same projection.
    if (alongX !== 0 || alongY !== 0) {
      lower = extents.min[axis];
      upper = extents.max[axis];
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
  // Plain indexed loops with the length read once: the native CLI's
  // interpreter builds an iterator for every `for...of` and looks the
  // length up on every pass, which costs seconds on a large mesh.
  const { min, max } = box;
  const count = positions.length;
  for (let i = 0; i < count; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = positions[i + axis];
      if (value === undefined)
        throw new RangeError("Missing polygon coordinate");
      // The fallbacks only satisfy strict indexed access: axis is 0 to 2.
      min[axis] = Math.min(min[axis] ?? value, value);
      max[axis] = Math.max(max[axis] ?? value, value);
    }
  }
  return box;
}
