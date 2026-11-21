import { expect, test } from "bun:test";
import { isOnCadGrid } from "@nodetto/ir";
import { tessellateArc, tessellateCircle } from "./index.ts";
import { coordinate } from "./vec.ts";

test.each([
  [1.6, 32],
  [50, 256],
])("circle of radius %d has %i grid vertices", (r, count) => {
  const points = tessellateCircle([2, -3], r);
  expect(points).toHaveLength(count * 2);
  expect(points.slice(0, 2)).toEqual([2 + r, -3]);
  expect(points.slice(count / 2, count / 2 + 2)).toEqual([2, -3 + r]);
  expect(points.slice(-2)).not.toEqual(points.slice(0, 2));
  expect(points.every(isOnCadGrid)).toBe(true);
  for (let i = 0; i < points.length; i += 2) {
    const x = coordinate(points, i) - 2;
    const y = coordinate(points, i + 1) + 3;
    expect(Math.abs(Math.sqrt(x * x + y * y) - r)).toBeLessThan(0.000001);
  }
});

test("a semicircle preserves its three stored points in either direction", () => {
  const forward = tessellateArc([10, 0], [0, 10], [-10, 0]);
  const backwards = tessellateArc([-10, 0], [0, 10], [10, 0]);
  if (!forward || !backwards) throw new Error("Expected both arcs");
  expect(forward.slice(0, 2)).toEqual([10, 0]);
  expect(forward.slice(-2)).toEqual([-10, 0]);
  const mid = (forward.length - 2) / 2;
  expect(forward.slice(mid, mid + 2)).toEqual([0, 10]);
  expect(backwards).toEqual(
    forward.flatMap((_, i) =>
      i % 2 === 0
        ? forward.slice(forward.length - i - 2, forward.length - i)
        : [],
    ),
  );
});

test("an arc can sweep more than half a turn before reaching its middle point", () => {
  const points = tessellateArc([10, 0], [0, -10], [6, -8]);
  if (!points) throw new Error("Expected a major arc");
  expect(points.slice(0, 2)).toEqual([10, 0]);
  expect(points.slice(-2)).toEqual([6, -8]);
  let hasTop = false;
  let middle = false;
  for (let i = 0; i < points.length; i += 2) {
    const x = coordinate(points, i);
    const y = coordinate(points, i + 1);
    if (x === 0 && y === -10) middle = true;
    if (y > 9 && !middle) hasTop = true;
    expect(Math.abs(Math.sqrt(x * x + y * y) - 10)).toBeLessThan(0.000001);
  }
  expect(hasTop && middle).toBe(true);
});

test("collinear and shallow grid arcs are distinguished at model scale", () => {
  expect(tessellateArc([-10, -10], [0, 0], [10, 10])).toBeNull();
  expect(
    tessellateArc([0, 0], [9999.999999, 9999.999998], [10000, 9999.999999]),
  ).toEqual([0, 0, 9999.999999, 9999.999998, 10000, 9999.999999]);
});

test("an almost diametric chord stays on the circle at the model scale", () => {
  const points = tessellateArc([-9999, 0], [9999, 0.000001], [0, -9999]);
  if (!points) throw new Error("Expected an arc");
  let highest = coordinate(points, 1);
  for (let i = 0; i < points.length; i += 2) {
    const x = coordinate(points, i);
    const y = coordinate(points, i + 1);
    highest = Math.max(highest, y);
    expect(Math.abs(Math.sqrt(x * x + y * y) - 9999)).toBeLessThan(0.000002);
  }
  expect(highest).toBeGreaterThan(9998);
});
