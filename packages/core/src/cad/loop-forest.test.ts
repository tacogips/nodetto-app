import { expect, test } from "bun:test";
import { loopForest, type ForestStats } from "./loop-forest.ts";

type Point = readonly [number, number];
const rectangle = (a: number, b: number, c: number, d: number): Point[] => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const flat = (points: Point[]) => points.flat();
function area(points: Point[]): bigint {
  let sum = 0n;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) throw new Error("missing point");
    sum += BigInt(a[0]) * BigInt(b[1]) - BigInt(b[0]) * BigInt(a[1]);
  }
  return sum;
}
function contains(polygon: Point[], p: Point): boolean {
  let inside = false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (!a || !b) throw new Error("missing point");
    if (a[1] > p[1] === b[1] > p[1]) continue;
    const determinant =
      BigInt(b[0] - a[0]) * BigInt(p[1] - a[1]) -
      BigInt(b[1] - a[1]) * BigInt(p[0] - a[0]);
    if (determinant > 0n === b[1] > a[1]) inside = !inside;
  }
  return inside;
}
function check(polygons: Point[][]) {
  const areas = polygons.map((p) => {
    const a = area(p);
    return a < 0n ? -a : a;
  });
  const parents: number[] = [];
  const depths: number[] = [];
  for (let i = 0; i < polygons.length; i++) {
    const point = polygons[i]?.[0];
    if (!point) throw new Error("missing polygon");
    const containers = polygons
      .map((p, j) => (j !== i && contains(p, point) ? j : -1))
      .filter((j) => j >= 0);
    containers.sort((a, b) => Number((areas[a] ?? 0n) - (areas[b] ?? 0n)));
    parents.push(containers[0] ?? -1);
    depths.push(containers.length);
  }
  expect(
    loopForest(
      polygons.map(flat),
      polygons.map((p) => (area(p) < 0n ? -1 : 1)),
    ),
  ).toEqual({ parents, depths });
}

test("matches independent containment oracle for nested and sibling contours", () => {
  const nested = Array.from({ length: 5 }, (_, i) =>
    rectangle(i, i, 30 - i, 30 - i),
  );
  check(nested);
  check(nested.map((p) => [...p].reverse()));
  check([
    rectangle(0, 0, 100, 100),
    rectangle(10, 10, 90, 90),
    rectangle(20, 20, 30, 30),
    rectangle(50, 20, 60, 30),
  ]);
  check([rectangle(0, 0, 10, 10)]);
});

test("handles shared heights and rays through local extrema in both windings", () => {
  const fixtures: Point[][][] = [
    [
      rectangle(0, 0, 10, 10),
      rectangle(20, 0, 30, 10),
      rectangle(40, 0, 50, 10),
    ],
    [
      [
        [0, 5],
        [5, 0],
        [10, 5],
        [5, 10],
      ],
      rectangle(20, 0, 25, 3),
      rectangle(20, 10, 25, 13),
    ],
    [
      rectangle(-20, -20, 40, 40),
      [
        [0, 0],
        [10, 0],
        [5, 10],
      ],
      [
        [15, 0],
        [20, 5],
        [15, 10],
        [10, 5],
      ],
    ],
  ];
  for (const fixture of fixtures) {
    check(fixture);
    check(fixture.map((p, i) => (i % 2 ? [...p].reverse() : p)));
    check(fixture.map((p) => [...p].reverse()));
  }
});

test("zero winding is treated as positive", () => {
  const grids = [rectangle(0, 0, 20, 20), rectangle(2, 2, 10, 10)].map(flat);
  expect(loopForest(grids, [0, 0])).toEqual(loopForest(grids, [1, 1]));
});

test("nested sweep work grows subquadratically", () => {
  const work: number[] = [];
  for (const size of [256, 512, 1024]) {
    const polygons = Array.from({ length: size }, (_, i) =>
      rectangle(
        i * 1_000_000,
        i * 1_000_000,
        (2 * size - i) * 1_000_000,
        (2 * size - i) * 1_000_000,
      ),
    );
    const stats: ForestStats = { events: 0, steps: 0 };
    const result = loopForest(
      polygons.map(flat),
      polygons.map(() => 1),
      stats,
    );
    expect(result.depths).toEqual(Array.from({ length: size }, (_, i) => i));
    expect(result.parents).toEqual(
      Array.from({ length: size }, (_, i) => i - 1),
    );
    work.push(stats.events + stats.steps);
  }
  console.log("forest work:", work.join(", "));
  expect(
    (work[1] ?? Number.POSITIVE_INFINITY) / (work[0] ?? 1),
  ).toBeLessThanOrEqual(2.5);
  expect(
    (work[2] ?? Number.POSITIVE_INFINITY) / (work[1] ?? 1),
  ).toBeLessThanOrEqual(2.5);
});
