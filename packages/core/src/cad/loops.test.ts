import { expect, test } from "bun:test";
import type { CadXY } from "@nodetto/ir";
import { element } from "../test-helpers.ts";
import {
  baseFrame,
  buildLoops,
  faceFrame,
  sideOutwardSign,
  toWorld,
} from "./index.ts";
import { coordinate } from "./vec.ts";

function line(id: string, a: CadXY, b: CadXY, construction = false) {
  const semantic = { a, b, construction };
  return { ...element({ id, type: "cad.line", semantic }), semantic };
}

function circle(id: string, c: CadXY, r: number) {
  return element({ id, type: "cad.circle", semantic: { c, r } });
}

function rectangle(name: string, x: number, y: number, w: number, h: number) {
  return [
    line(`${name}-a`, [x + w, y], [x, y]),
    line(`${name}-b`, [x + w, y], [x + w, y + h]),
    line(`${name}-c`, [x, y + h], [x + w, y + h]),
    line(`${name}-d`, [x, y + h], [x, y]),
  ];
}

test("a mixed-direction rectangle is counter-clockwise with edge provenance", () => {
  const lines = rectangle("rim", 0, 0, 20, 12);
  const result = buildLoops([
    line("construction", [0, 0], [20, 12], true),
    ...lines.slice().reverse(),
  ]);
  expect(result).toEqual(buildLoops(lines));
  expect(result).toEqual({
    loops: [
      {
        points: [20, 0, 20, 12, 0, 12, 0, 0],
        sources: ["rim-b", "rim-c", "rim-d", "rim-a"],
        reversed: [false, true, false, true],
        members: ["rim-a", "rim-d", "rim-c", "rim-b"],
        depth: 0,
      },
    ],
  });
});

test("nesting is even-odd and picking a loop keeps its sketch depth", () => {
  const entities = [
    ...rectangle("rim", 0, 0, 20, 12),
    circle("bore-a", [5, 5], 2),
    circle("bore-b", [15, 5], 2),
  ];
  const result = buildLoops(entities);
  if (!("loops" in result)) throw new Error(result.error);
  expect(result.loops.map((loop) => loop.depth).sort()).toEqual([0, 1, 1]);
  const selected = result.loops.find((loop) => loop.members.includes("bore-b"));
  if (!selected) throw new Error("Missing selected hole");
  expect(buildLoops(entities, ["bore-b"])).toEqual({ loops: [selected] });
  expect(buildLoops(entities, ["unknown"])).toEqual({
    error: "cad.profile.empty",
  });
  const island = buildLoops([...entities, circle("island", [5, 5], 1)]);
  if (!("loops" in island)) throw new Error(island.error);
  expect(
    island.loops.find((loop) => loop.members.includes("island"))?.depth,
  ).toBe(2);
});

test("a line and a backwards arc form a loop with every arc facet labelled", () => {
  const straight = line("a", [-5, 0], [5, 0]);
  const arc = element({
    id: "b",
    type: "cad.arc",
    semantic: { a: [-5, 0], m: [0, 5], b: [5, 0] },
  });
  const result = buildLoops([arc, straight]);
  if (!("loops" in result)) throw new Error(result.error);
  const [loop] = result.loops;
  if (!loop) throw new Error("Missing loop");
  expect(loop.sources.filter((id) => id === "a")).toHaveLength(1);
  expect(loop.sources.filter((id) => id === "b").length).toBeGreaterThan(2);
  expect(loop.sources.length * 2).toBe(loop.points.length);
  for (const [i, id] of loop.sources.entries())
    expect(loop.reversed[i]).toBe(id === "b");
});

test("profile reports open, branching, intersecting and empty geometry", () => {
  expect(buildLoops([line("a", [0, 0], [2, 0])])).toMatchObject({
    error: "cad.profile.open",
  });
  expect(
    buildLoops([
      line("a", [0, 0], [2, 0]),
      line("b", [0, 0], [-2, 0]),
      line("c", [0, 0], [0, 2]),
    ]),
  ).toMatchObject({ error: "cad.profile.branch" });
  expect(
    buildLoops([...rectangle("a", 0, 0, 4, 4), ...rectangle("b", 2, 2, 4, 4)]),
  ).toMatchObject({ error: "cad.profile.intersect" });
  expect(
    buildLoops([
      line("a", [0, 0], [4, 4]),
      line("b", [4, 4], [0, 4]),
      line("c", [0, 4], [4, 0]),
      line("d", [4, 0], [0, 0]),
    ]),
  ).toMatchObject({ error: "cad.profile.intersect" });
  expect(
    buildLoops([
      line("a", [0, 0], [2, 0]),
      line("b", [2, 0], [1, 0]),
      line("c", [1, 0], [0, 0]),
    ]),
  ).toMatchObject({ error: "cad.profile.empty" });
  expect(buildLoops([line("guide", [0, 0], [2, 0], true)])).toEqual({
    error: "cad.profile.empty",
  });
});

test("touching or overlapping contours count as an intersection", () => {
  const outer = rectangle("outer", 0, 0, 10, 10);
  expect(
    buildLoops([...outer, ...rectangle("corner", 10, 6, 2, 2)]),
  ).toMatchObject({ error: "cad.profile.intersect" });
  expect(buildLoops([...outer, circle("tangent", [5, 5], 5)])).toMatchObject({
    error: "cad.profile.intersect",
  });
  expect(
    buildLoops([
      line("a", [0, 0], [3, 0]),
      line("b", [3, 0], [1, 0]),
      line("c", [1, 0], [1, 1]),
      line("d", [1, 1], [0, 0]),
    ]),
  ).toMatchObject({ error: "cad.profile.intersect" });
});

test("a triangle with one square nanometre of doubled area survives grid cancellation", () => {
  const a: CadXY = [0, 0];
  const b: CadXY = [10000, 9999.999999];
  const c: CadXY = [9999.999999, 9999.999998];
  const result = buildLoops([
    line("a", a, b),
    line("b", b, c),
    line("c", c, a),
  ]);
  if (!("loops" in result)) throw new Error(result.error);
  expect(result.loops[0]?.points).toEqual([...a, ...c, ...b]);
});

test("a closed chain exceeding the vertex limit is reported before intersection work", () => {
  const count = 20_001;
  const entities = Array.from({ length: count }, (_, i) => {
    const point = (index: number): CadXY => [
      index % 10000,
      Math.floor(index / 10000),
    ];
    return line(`e${i}`, point(i), point((i + 1) % count));
  });
  expect(buildLoops(entities)).toMatchObject({ error: "cad.limit" });
});

test("side outward directions step out of the material on all eight edges", () => {
  const outer = rectangle("rim", 0, 0, 20, 12);
  const hole = rectangle("hole", 6, 4, 8, 4);
  const result = buildLoops([...outer, ...hole]);
  if (!("loops" in result)) throw new Error(result.error);
  const xy = baseFrame("xy");
  const span = { t0: 0, t1: 4 };
  for (const edge of [...outer, ...hole]) {
    const { a, b } = edge.semantic;
    const loop = result.loops.find((l) => l.members.includes(edge.id));
    if (!loop) throw new Error("Missing side loop");
    const side = faceFrame(xy, span, "side", { a, b });
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const along: CadXY = [Math.sqrt(dx * dx + dy * dy) / 2, 2];
    const [x, y] = toWorld(side, along, sideOutwardSign(loop, edge.id) * 0.001);
    if (loop.depth === 0) expect(x < 0 || x > 20 || y < 0 || y > 12).toBe(true);
    else expect(x > 6 && x < 14 && y > 4 && y < 8).toBe(true);
    expect(sideOutwardSign(loop, "absent")).toBe(0);
  }
});

test("each edge joins the end of the previous edge", () => {
  const result = buildLoops(rectangle("rim", 1, 2, 7, 11));
  if (!("loops" in result)) throw new Error(result.error);
  const [loop] = result.loops;
  if (!loop) throw new Error("Missing loop");
  const lines = rectangle("rim", 1, 2, 7, 11);
  for (const [i, source] of loop.sources.entries()) {
    const edge = lines.find((line) => line.id === source);
    if (!edge) throw new Error("Missing source");
    const point = (index: number): CadXY => [
      coordinate(loop.points, (index * 2) % loop.points.length),
      coordinate(loop.points, (index * 2 + 1) % loop.points.length),
    ];
    const { a, b } = edge.semantic;
    expect(point(i)).toEqual(loop.reversed[i] ? b : a);
    expect(point(i + 1)).toEqual(loop.reversed[i] ? a : b);
  }
});

test("disjoint circle rows have near-linear candidate counts on either axis", () => {
  for (const vertical of [false, true]) {
    const counts = [160, 320, 640].map((count) => {
      const stats = { segmentPairs: 0, containmentPairs: 0 };
      const entities = Array.from({ length: count }, (_, i) =>
        circle(`circle-${i}`, vertical ? [0, i * 4] : [i * 4, 0], 1),
      );
      expect(buildLoops(entities, undefined, stats)).toHaveProperty("loops");
      return stats;
    });
    for (let i = 1; i < counts.length; i += 1) {
      const previous = counts[i - 1];
      const current = counts[i];
      if (!previous || !current) throw new Error("Missing counts");
      expect(previous.segmentPairs).toBeGreaterThan(0);
      expect(current.segmentPairs).toBeLessThanOrEqual(
        previous.segmentPairs * 2.5,
      );
      expect(current.containmentPairs).toBeLessThanOrEqual(
        previous.containmentPairs * 2.5,
      );
    }
  }
});

test("intersection reports the first segment in the original nested scan", () => {
  const entities = [
    ...rectangle("a", 0, 0, 10, 10),
    ...rectangle("b", 2, -2, 4, 14),
    ...rectangle("c", -2, 3, 14, 4),
  ];
  const segments = entities
    .map(({ id, semantic: { a, b } }) => ({
      id,
      a,
      b,
      minX: Math.min(a[0], b[0]),
      minY: Math.min(a[1], b[1]),
      maxX: Math.max(a[0], b[0]),
      maxY: Math.max(a[1], b[1]),
    }))
    .sort((a, b) => a.minX - b.minX || a.minY - b.minY);
  const cross = (a: CadXY, b: CadXY, c: CadXY) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let expected: string | undefined;
  outer: for (const [i, a] of segments.entries()) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const b = segments[j];
      if (!b || b.minX > a.maxX) break;
      if (b.minY > a.maxY || a.minY > b.maxY) continue;
      const sides = [
        cross(a.a, a.b, b.a),
        cross(a.a, a.b, b.b),
        cross(b.a, b.b, a.a),
        cross(b.a, b.b, a.b),
      ];
      if (
        (sides[0] ?? 0) * (sides[1] ?? 0) <= 0 &&
        (sides[2] ?? 0) * (sides[3] ?? 0) <= 0
      ) {
        // Shared endpoints of neighbouring rectangle edges are allowed.
        if (a.id[0] === b.id[0]) continue;
        expected = a.id;
        break outer;
      }
    }
  }
  expect(expected).toBeDefined();
  expect(buildLoops(entities)).toEqual({
    error: "cad.profile.intersect",
    at: expected,
  });
});
