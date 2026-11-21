import { expect, test } from "bun:test";
import { tessellateCircle, triangulateSimplePolygon } from "./index.ts";
import { coordinate } from "./vec.ts";

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
