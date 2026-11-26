import { expect, test } from "bun:test";
import {
  diagonalBudgetLimit,
  diagonalCandidates,
  type DiagonalSegment,
  type IntPoint,
} from "./diagonal-lookup";

function check(
  points: IntPoint[],
  segments: DiagonalSegment[],
  budget?: number,
) {
  const found = new Set<string>();
  const stats = { diagonalWork: 0 };
  const result = diagonalCandidates(
    points,
    segments,
    (s, p) => found.add(`${s}:${p}`),
    stats,
    budget,
  );
  if (!result.exceeded)
    for (const s of segments)
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (!p) continue;
        const cross =
          (s.b.x - s.a.x) * (p.y - s.a.y) - (s.b.y - s.a.y) * (p.x - s.a.x);
        if (
          Math.abs(cross) <= 1 &&
          p.x >= Math.min(s.a.x, s.b.x) - 1 &&
          p.x <= Math.max(s.a.x, s.b.x) + 1 &&
          p.y >= Math.min(s.a.y, s.b.y) - 1 &&
          p.y <= Math.max(s.a.y, s.b.y) + 1
        )
          expect(found.has(`${s.id}:${i}`)).toBe(true);
      }
  return { ...result, ...stats, found };
}

test("empty segments and budget formula", () => {
  expect(check([{ x: 1, y: 2 }], []).diagonalWork).toBe(0);
  const l = Math.ceil(Math.log2(4001));
  expect(diagonalBudgetLimit(2000, 4000)).toBe(
    4000 * (2 * l + 2) * (l + 1) + 16 * 6000,
  );
});

test("exact candidates include tolerance edges, duplicates and reversed directions", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: -1, y: -1 },
    { x: 20, y: 30 },
  ];
  check(points, [
    { id: 1, a: { x: 0, y: 0 }, b: { x: 3, y: 2 } },
    { id: 2, a: { x: 3, y: 3 }, b: { x: 0, y: 0 } },
  ]);
});

test("large coordinates use conservative box reporting", () => {
  const result = check(
    [{ x: 1050000003, y: 1050000004 }],
    [
      {
        id: 1,
        a: { x: 1000000000, y: 1000000003 },
        b: { x: 1100000006, y: 1100000005 },
      },
    ],
  );
  expect(result.found.has("1:0")).toBe(true);
});

test("mixed short lattice and parallel directions remain bounded", () => {
  const n = 500;
  const points = Array.from({ length: n }, (_, i) => ({ x: 0, y: 10 * i }));
  const mixed = points.map((p, i) => ({
    id: i,
    a: p,
    b: { x: 100 * n, y: 100 * n + 11 * i + 1 },
  }));
  expect(check(points, mixed).diagonalWork).toBeLessThan(1_000_000);
  const parallel = points.map((p, i) => ({
    id: i,
    a: p,
    b: { x: 100 * n, y: 100 * n + 10 * i },
  }));
  expect(check(points, parallel).diagonalWork).toBeLessThan(200_000);
});

test("budget stops counted work immediately", () => {
  const points = Array.from({ length: 100 }, (_, i) => ({ x: i, y: i }));
  const segments = points.map((p, i) => ({
    id: i,
    a: p,
    b: { x: p.x + 100, y: p.y + 100 },
  }));
  const budget = 50;
  const result = check(points, segments, budget);
  expect(result.exceeded).toBe(true);
  expect(result.diagonalWork).toBe(budget + 1);
});

test("full-scale disjoint, parallel, mixed and budgeted lookups", () => {
  const n = 2000;
  const points = Array.from({ length: n }, (_, i) => ({ x: 0, y: 10 * n * i }));
  const l = Math.ceil(Math.log2(points.length + 1));
  const disjoint = points.map((a, i) => ({
    id: i,
    a,
    b: { x: n, y: a.y + n + i + 1 },
  }));
  expect(check(points, disjoint).diagonalWork).toBeLessThanOrEqual(
    n * (2 * l + 2) * (l + 1) + 2 * n,
  );
  const clustered = Array.from({ length: n }, (_, i) => ({ x: 0, y: 10 * i }));
  const parallel = clustered.map((a, i) => ({
    id: i,
    a,
    b: { x: 100 * n, y: 100 * n + 10 * i },
  }));
  expect(check(clustered, parallel).diagonalWork).toBeLessThanOrEqual(
    n + n * (2 * l + 2) * (l + 1) + n * (l + 1) + 2 * n,
  );
  const mixed = clustered.map((a, i) => ({
    id: i,
    a,
    b: { x: 100 * n, y: 100 * n + 11 * i + 1 },
  }));
  expect(check(clustered, mixed).diagonalWork).toBeLessThan(1_000_000);
  const g = n + 1;
  const long = clustered.map((a, i) => ({
    id: i,
    a,
    b: { x: g * n, y: a.y + g * (n + i) },
  }));
  const dense = Array.from({ length: 2 * n }, (_, i) => ({
    x: i * 1000,
    y: i * 1000,
  }));
  const budget = diagonalBudgetLimit(n, dense.length);
  const result = check(dense, long, budget);
  expect(result.exceeded).toBe(true);
  expect(result.diagonalWork).toBeLessThanOrEqual(budget + 1);
});
