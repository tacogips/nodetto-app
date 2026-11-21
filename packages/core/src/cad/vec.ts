export type Vec3 = readonly [number, number, number];

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export const NM_PER_MM = 1_000_000;

export function coordinate(points: ArrayLike<number>, index: number): number {
  const value = points[index];
  if (value === undefined) throw new RangeError("Missing polygon coordinate");
  return value;
}

/** Cross product of two vectors in integer nanometres.
 * The products can exceed the safe integer range on a valid sketch.
 */
export function gridCross(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const left = ax * by;
  const right = ay * bx;
  const cross = left - right;
  if (
    (Number.isSafeInteger(left) && Number.isSafeInteger(right)) ||
    left === 0 ||
    right === 0 ||
    Math.abs(cross) > (Math.abs(left) + Math.abs(right)) * Number.EPSILON
  ) {
    return cross;
  }
  return Number(BigInt(ax) * BigInt(by) - BigInt(ay) * BigInt(bx));
}

export function orientation(
  grid: readonly number[],
  a: number,
  b: number,
  c: number,
): number {
  const ax = coordinate(grid, a);
  const ay = coordinate(grid, a + 1);
  return gridCross(
    coordinate(grid, b) - ax,
    coordinate(grid, b + 1) - ay,
    coordinate(grid, c) - ax,
    coordinate(grid, c + 1) - ay,
  );
}
