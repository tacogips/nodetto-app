import { expect, test } from "bun:test";
import { tessellateCircle, triangulateSimplePolygon } from "./index.ts";
import { coordinate, NM_PER_MM, orientation } from "./vec.ts";
import { triangulateWork } from "./triangulate.ts";

function assertTiling(points: readonly number[], area: number): void {
  const triangles = triangulateSimplePolygon(points);
  expect(triangles).toHaveLength((points.length / 2 - 2) * 3);
  let tiledArea = 0;
  const edges = new Map<string, number>();
  function recordEdge(a: number, b: number): void {
    const key = `${Math.min(a, b)},${Math.max(a, b)}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  for (let i = 0; i < triangles.length; i += 3) {
    const a = coordinate(triangles, i);
    const b = coordinate(triangles, i + 1);
    const c = coordinate(triangles, i + 2);
    const x = coordinate(points, a * 2);
    const y = coordinate(points, a * 2 + 1);
    const twice =
      (coordinate(points, b * 2) - x) * (coordinate(points, c * 2 + 1) - y) -
      (coordinate(points, b * 2 + 1) - y) * (coordinate(points, c * 2) - x);
    expect(twice).toBeGreaterThan(0);
    tiledArea += twice / 2;
    recordEdge(a, b);
    recordEdge(b, c);
    recordEdge(c, a);
  }
  expect(tiledArea).toBeCloseTo(area, 8);
  const count = points.length / 2;
  for (let i = 1; i < count; i += 1) expect(edges.get(`${i - 1},${i}`)).toBe(1);
  expect(edges.get(`0,${count - 1}`)).toBe(1);
  expect([...edges.values()].filter((n) => n === 1)).toHaveLength(count);
  expect([...edges.values()].every((n) => n <= 2)).toBe(true);
}

test("convex polygons use a fan", () => {
  const circle = tessellateCircle([0, 0], 10);
  const triangles = triangulateSimplePolygon(circle);
  expect(triangles).toHaveLength((circle.length / 2 - 2) * 3);
  for (let i = 0; i < triangles.length; i += 3) {
    expect(triangles.slice(i, i + 3)).toEqual([0, i / 3 + 1, i / 3 + 2]);
  }
});

test("triangulation covers a concave L with either input winding", () => {
  assertTiling([0, 0, 4, 0, 4, 1, 1, 1, 1, 4, 0, 4], 7);
  assertTiling([0, 0, 0, 4, 1, 4, 1, 1, 4, 1, 4, 0], 7);
});

test("collinear boundary vertices survive triangulation", () => {
  assertTiling([0, 0, 2, 0, 4, 0, 4, 2, 4, 4, 0, 4, 0, 2], 16);
});

test("ear clipping tiles a comb with 200 teeth", () => {
  const points = [0, 0, 400, 0, 400, 3];
  for (let x = 400; x > 0; x -= 2) {
    points.push(x - 1, 3, x - 1, 1, x - 2, 1);
    if (x > 2) points.push(x - 2, 3);
  }
  assertTiling(points, 800);
});

function oracleLowestVertex(grid: readonly number[]): number {
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

function oracleIsEar(
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
function oracleTriangulate(points: readonly number[]): number[] {
  if (points.length < 6 || points.length % 2 !== 0) return [];
  const count = points.length / 2;
  const grid = points.map((value) => Math.round(value * NM_PER_MM));
  const first = oracleLowestVertex(grid);
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
    if (oracleIsEar(grid, next, a, b, c)) {
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

function notch(count: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (2 * Math.PI * i) / count;
    const radius = i === 0 ? 50 : 100;
    points.push(radius * Math.cos(angle), radius * Math.sin(angle));
  }
  return points;
}

function reversed(points: readonly number[]): number[] {
  const result: number[] = [];
  for (let i = points.length - 2; i >= 0; i -= 2)
    result.push(coordinate(points, i), coordinate(points, i + 1));
  return result;
}

test("candidate growth and ordered triangles match the old scan", () => {
  for (const reverse of [false, true]) {
    const counts: number[] = [];
    const queries: number[] = [];
    for (const size of [300, 3000, 6000, 12000]) {
      const input = notch(size);
      const points = reverse ? reversed(input) : input;
      triangulateWork.candidateVisits = 0;
      triangulateWork.queries = 0;
      expect(triangulateSimplePolygon(points)).toEqual(
        oracleTriangulate(points),
      );
      if (size >= 3000) {
        counts.push(triangulateWork.candidateVisits);
        queries.push(triangulateWork.queries);
      }
    }
    console.log(
      `winding=${reverse} candidateVisits=${counts} queries=${queries}`,
    );
    expect(
      counts[1],
      `counts=${counts} queries=${queries}`,
    ).toBeLessThanOrEqual(coordinate(counts, 0) * 2.5);
    expect(
      counts[2],
      `counts=${counts} queries=${queries}`,
    ).toBeLessThanOrEqual(coordinate(counts, 1) * 2.5);
  }
}, 30000);

test("old scan parity for concave, collinear, diagonal and comb polygons", () => {
  const comb = [0, 0, 400, 0, 400, 3];
  for (let x = 400; x > 0; x -= 2) {
    comb.push(x - 1, 3, x - 1, 1, x - 2, 1);
    if (x > 2) comb.push(x - 2, 3);
  }
  for (const input of [
    [0, 0, 4, 0, 4, 1, 1, 1, 1, 4, 0, 4],
    [0, 0, 2, 0, 4, 0, 4, 2, 4, 4, 0, 4, 0, 2],
    [0, 0, 4, 0, 4, 4, 2, 2, 0, 4],
    comb,
  ]) {
    for (const points of [input, reversed(input)]) {
      expect(triangulateSimplePolygon(points)).toEqual(
        oracleTriangulate(points),
      );
    }
  }
});
