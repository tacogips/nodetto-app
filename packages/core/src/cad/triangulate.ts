import { coordinate, NM_PER_MM, orientation } from "./vec.ts";

function lowestVertex(grid: readonly number[]): number {
  let lowest = 0;
  for (let i = 2; i < grid.length; i += 2) {
    const x = coordinate(grid, i);
    const lowestX = coordinate(grid, lowest);
    if (
      x < lowestX ||
      (x === lowestX && coordinate(grid, i + 1) < coordinate(grid, lowest + 1))
    ) {
      lowest = i;
    }
  }
  return lowest / 2;
}

export const triangulateWork = { candidateVisits: 0, queries: 0 };

function isEar(
  grid: readonly number[],
  candidateNext: Int32Array,
  head: number,
  a: number,
  b: number,
  c: number,
): boolean {
  if (orientation(grid, a * 2, b * 2, c * 2) <= 0) return false;

  triangulateWork.queries += 1;
  triangulateWork.candidateVisits += 1;
  // Include the edge of the ear. A collinear vertex on the new diagonal
  // must stay on the boundary so the cap and the prism sides meet.
  const minX = Math.min(
    coordinate(grid, a * 2),
    coordinate(grid, b * 2),
    coordinate(grid, c * 2),
  );
  const maxX = Math.max(
    coordinate(grid, a * 2),
    coordinate(grid, b * 2),
    coordinate(grid, c * 2),
  );
  const minY = Math.min(
    coordinate(grid, a * 2 + 1),
    coordinate(grid, b * 2 + 1),
    coordinate(grid, c * 2 + 1),
  );
  const maxY = Math.max(
    coordinate(grid, a * 2 + 1),
    coordinate(grid, b * 2 + 1),
    coordinate(grid, c * 2 + 1),
  );
  for (let p = head; p !== -1; p = candidateNext[p] ?? -1) {
    triangulateWork.candidateVisits += 1;
    if (p === a || p === c) continue;
    const x = coordinate(grid, p * 2);
    const y = coordinate(grid, p * 2 + 1);
    if (
      x >= minX &&
      x <= maxX &&
      y >= minY &&
      y <= maxY &&
      orientation(grid, a * 2, b * 2, p * 2) >= 0 &&
      orientation(grid, b * 2, c * 2, p * 2) >= 0 &&
      orientation(grid, c * 2, a * 2, p * 2) >= 0
    )
      return false;
  }
  return true;
}

/** Triangulate a simple CAD polygon on the nanometre grid. Indices refer to the original vertices. */
export function triangulateSimplePolygon(points: readonly number[]): number[] {
  if (points.length < 6 || points.length % 2 !== 0) return [];
  const count = points.length / 2;
  const grid = points.map((value) => Math.round(value * NM_PER_MM));
  const first = lowestVertex(grid);
  const direction = Math.sign(
    orientation(
      grid,
      ((first + count - 1) % count) * 2,
      first * 2,
      ((first + 1) % count) * 2,
    ),
  );
  if (direction === 0) return [];

  const prev = Array.from(
    { length: count },
    (_, i) => (i - direction + count) % count,
  );
  const next = Array.from(
    { length: count },
    (_, i) => (i + direction + count) % count,
  );
  const triangles: number[] = [];
  if (
    next.every(
      (after, i) =>
        orientation(grid, coordinate(prev, i) * 2, i * 2, after * 2) > 0,
    )
  ) {
    let b = coordinate(next, 0);
    for (let i = 2; i < count; i += 1) {
      const c = coordinate(next, b);
      triangles.push(0, b, c);
      b = c;
    }
    return triangles;
  }

  const candPrev = new Int32Array(count).fill(-1);
  const candNext = new Int32Array(count).fill(-1);
  const isCandidate = new Uint8Array(count);
  let head = -1;
  let tail = -1;
  for (let i = 0; i < count; i += 1) {
    if (
      orientation(
        grid,
        coordinate(prev, i) * 2,
        i * 2,
        coordinate(next, i) * 2,
      ) <= 0
    ) {
      isCandidate[i] = 1;
      candPrev[i] = tail;
      if (tail === -1) head = i;
      else candNext[tail] = i;
      tail = i;
    }
  }
  function reclassify(v: number): void {
    triangulateWork.candidateVisits += 1;
    const candidate =
      orientation(
        grid,
        coordinate(prev, v) * 2,
        v * 2,
        coordinate(next, v) * 2,
      ) <= 0;
    if (candidate === (isCandidate[v] === 1)) return;
    if (!candidate) {
      const before = candPrev[v] ?? -1;
      const after = candNext[v] ?? -1;
      if (before === -1) head = after;
      else candNext[before] = after;
      if (after === -1) tail = before;
      else candPrev[after] = before;
      isCandidate[v] = 0;
      return;
    }
    let after = head;
    let before = -1;
    while (after !== -1 && after < v) {
      triangulateWork.candidateVisits += 1;
      before = after;
      after = candNext[after] ?? -1;
    }
    candPrev[v] = before;
    candNext[v] = after;
    if (before === -1) head = v;
    else candNext[before] = v;
    if (after === -1) tail = v;
    else candPrev[after] = v;
    isCandidate[v] = 1;
  }

  let b = first;
  let remaining = count;
  let misses = 0;
  while (remaining > 3) {
    const a = coordinate(prev, b);
    const c = coordinate(next, b);
    if (isEar(grid, candNext, head, a, b, c)) {
      triangles.push(a, b, c);
      next[a] = c;
      prev[c] = a;
      reclassify(a);
      reclassify(c);
      remaining -= 1;
      misses = 0;
    } else {
      misses += 1;
      if (misses === remaining) return [];
    }
    b = c;
  }
  triangles.push(coordinate(prev, b), b, coordinate(next, b));
  return triangles;
}
