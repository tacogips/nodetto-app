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

function isEar(
  grid: readonly number[],
  next: readonly number[],
  a: number,
  b: number,
  c: number,
): boolean {
  if (orientation(grid, a * 2, b * 2, c * 2) <= 0) return false;

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
  for (let p = coordinate(next, c); p !== a; p = coordinate(next, p)) {
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

  let b = first;
  let remaining = count;
  let misses = 0;
  while (remaining > 3) {
    const a = coordinate(prev, b);
    const c = coordinate(next, b);
    if (isEar(grid, next, a, b, c)) {
      triangles.push(a, b, c);
      next[a] = c;
      prev[c] = a;
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
