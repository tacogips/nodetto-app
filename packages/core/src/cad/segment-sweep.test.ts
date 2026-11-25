import { expect, test } from "bun:test";
import { provesDisjoint, type SweepStats } from "./segment-sweep.ts";

type Segment = {
  a: readonly [number, number];
  b: readonly [number, number];
  loop: number;
  index: number;
  size: number;
};
const stats = (): SweepStats => ({
  events: 0,
  steps: 0,
  tests: 0,
  collapsed: 0,
});
const cross = (
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const equal = (a: readonly [number, number], b: readonly [number, number]) =>
  a[0] === b[0] && a[1] === b[1];
const box = (a: Segment, b: Segment) =>
  Math.min(a.a[0], a.b[0]) <= Math.max(b.a[0], b.b[0]) &&
  Math.min(b.a[0], b.b[0]) <= Math.max(a.a[0], a.b[0]) &&
  Math.min(a.a[1], a.b[1]) <= Math.max(b.a[1], b.b[1]) &&
  Math.min(b.a[1], b.b[1]) <= Math.max(a.a[1], a.b[1]);
function contact(a: Segment, b: Segment): boolean {
  const p = cross(a.a, a.b, b.a);
  const q = cross(a.a, a.b, b.b);
  const r = cross(b.a, b.b, a.a);
  const s = cross(b.a, b.b, a.b);
  if (
    !((p <= 0 && q >= 0) || (p >= 0 && q <= 0)) ||
    !((r <= 0 && s >= 0) || (r >= 0 && s <= 0))
  )
    return false;
  const adjacent =
    a.loop === b.loop &&
    ((a.index + 1) % a.size === b.index || (b.index + 1) % b.size === a.index);
  if (adjacent) {
    const shared = [a.a, a.b].filter(
      (point) => equal(point, b.a) || equal(point, b.b),
    );
    if (shared.length === 1) {
      if (p !== 0 || q !== 0 || r !== 0 || s !== 0) return false;
      const axis = a.a[0] === a.b[0] ? 1 : 0;
      const overlap =
        Math.min(
          Math.max(a.a[axis], a.b[axis]),
          Math.max(b.a[axis], b.b[axis]),
        ) -
        Math.max(
          Math.min(a.a[axis], a.b[axis]),
          Math.min(b.a[axis], b.b[axis]),
        );
      if (overlap === 0) return false;
    }
  }
  return true;
}
function run(segments: Segment[], counters: SweepStats): boolean {
  return provesDisjoint(
    segments.length,
    (i) => {
      const segment = segments[i];
      if (!segment) throw new Error("Missing segment");
      return [segment.a[0], segment.a[1], segment.b[0], segment.b[1]];
    },
    (i, j) => {
      const a = segments[i];
      const b = segments[j];
      if (!a || !b) throw new Error("Missing segment");
      expect(box(a, b)).toBe(true);
      return contact(a, b);
    },
    counters,
  );
}
function loop(
  points: readonly (readonly [number, number])[],
  id: number,
): Segment[] {
  return points.map((a, index) => {
    const b = points[(index + 1) % points.length];
    if (!b) throw new Error("Missing point");
    return { a, b, loop: id, index, size: points.length };
  });
}
test("seeded differential against all pairs", () => {
  let seed = 0x42c0ffee;
  const random = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  let proved = 0;
  let contactCount = 0;
  let collapsed = 0;
  let disjoint = 0;
  for (let trial = 0; trial < 3000; trial++) {
    const segments: Segment[] = [];
    const loops = 1 + random(4);
    for (let l = 0; l < loops; l++) {
      const points: [number, number][] = [];
      const size = 3 + random(5);
      for (let i = 0; i < size; i++) points.push([random(7), random(7)]);
      segments.push(...loop(points, l));
    }
    let oracle = false;
    for (let i = 0; i < segments.length; i++)
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i];
        const b = segments[j];
        if (a && b && box(a, b) && contact(a, b)) oracle = true;
      }
    const counters = stats();
    const result = run(segments, counters);
    if (result) proved++;
    if (oracle && !result) contactCount++;
    if (counters.collapsed) collapsed++;
    if (!oracle) disjoint++;
    expect(result && oracle).toBe(false);
    if (!counters.collapsed) expect(result).toBe(!oracle);
  }
  console.log({
    seed: "0x42c0ffee",
    proved,
    contactCount,
    collapsed,
    disjoint,
  });
  expect(Math.min(proved, contactCount, collapsed, disjoint)).toBeGreaterThan(
    0,
  );
});
test("collapsed edge stops before events", () => {
  const counters = stats();
  expect(
    run(
      loop(
        [
          [0, 0],
          [4, 0],
          [4, 0],
          [4, 4],
          [0, 4],
        ],
        0,
      ),
      counters,
    ),
  ).toBe(false);
  expect(counters.collapsed).toBe(1);
  expect(counters.events).toBe(0);
});
test("T contact in both orders", () => {
  const segments: Segment[] = [
    { a: [0, 0], b: [0, 4], loop: 0, index: 0, size: 1 },
    { a: [0, 2], b: [1, 3], loop: 1, index: 0, size: 1 },
  ];
  for (const items of [segments, [...segments].reverse()]) {
    const counters = stats();
    expect(run(items, counters)).toBe(false);
    expect(counters.collapsed).toBe(0);
  }
});
test("parallel diagonals have subquadratic work", () => {
  const work: number[] = [];
  for (const n of [1024, 2048, 4096]) {
    const counters = stats();
    expect(
      provesDisjoint(
        n,
        (i) => [0, i, 10000, 10000 + i],
        () => false,
        counters,
      ),
    ).toBe(true);
    expect(counters.tests).toBeLessThanOrEqual(3 * n);
    work.push(counters.events + counters.steps + counters.tests);
  }
  console.log({ work });
  expect(
    (work[1] ?? Number.POSITIVE_INFINITY) / (work[0] ?? 1),
  ).toBeLessThanOrEqual(2.5);
  expect(
    (work[2] ?? Number.POSITIVE_INFINITY) / (work[1] ?? 1),
  ).toBeLessThanOrEqual(2.5);
});
