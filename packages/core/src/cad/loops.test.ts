import { expect, test } from "bun:test";
import type { CadXY, Element } from "@nodetto/ir";
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

test("holes along two perpendicular edges have near-linear candidate counts", () => {
  const fixture = (holes: number, tangent = false) => {
    const side = 9 + 3 * (holes / 2);
    const entities: Element[] = [...rectangle("plate", 0, 0, side, side)];
    for (let k = 0; k < holes / 2; k += 1) {
      entities.push(
        circle(`h-${k}`, [6 + 3 * k, tangent && k === 0 ? 1 : 2.5], 1),
      );
      entities.push(circle(`v-${k}`, [2.5, 6 + 3 * k], 1));
    }
    return entities;
  };
  const counts = [128, 256, 512].map((holes) => {
    const stats = { segmentPairs: 0, containmentPairs: 0 };
    const result = buildLoops(fixture(holes), undefined, stats);
    if (!("loops" in result)) throw new Error(result.error);
    expect(result.loops).toHaveLength(holes + 1);
    expect(result.loops.filter((loop) => loop.depth === 0)).toHaveLength(1);
    expect(result.loops.find((loop) => loop.depth === 0)?.members).toContain(
      "plate-a",
    );
    expect(result.loops.filter((loop) => loop.depth === 1)).toHaveLength(holes);
    return stats;
  });
  console.log("two-row counts", JSON.stringify(counts));
  for (let i = 1; i < counts.length; i += 1) {
    const previous = counts[i - 1];
    const current = counts[i];
    if (!previous || !current) throw new Error("Missing counts");
    for (const key of ["segmentPairs", "containmentPairs"] as const) {
      expect(previous[key]).toBeGreaterThan(0);
      expect(current[key]).toBeGreaterThan(0);
      expect(current[key]).toBeLessThanOrEqual(previous[key] * 2.5);
    }
  }
  const tangent = buildLoops(fixture(128, true));
  expect(tangent).toMatchObject({ error: "cad.profile.intersect" });
  if ("error" in tangent) expect(tangent.at).toBeDefined();
});

test("a detailed rim with many holes queries the perimeter through one edge index", () => {
  const counts = [256, 512, 1024].map((holes) => {
    const height = (i: number) => (i % 2 === 0 ? 512 : 513);
    const entities: Element[] = [];
    for (let i = 0; i < holes; i += 1) {
      entities.push(
        line(
          `rim-${i}`,
          [(256 * i) / holes, height(i)],
          [(256 * (i + 1)) / holes, height(i + 1)],
        ),
      );
    }
    entities.push(
      line("right", [256, height(holes)], [256, 0]),
      line("bottom", [256, 0], [0, 0]),
      line("left", [0, 0], [0, 512]),
    );
    for (let k = 0; k < holes; k += 1) {
      entities.push(
        circle(
          `hole-${k}`,
          [2.5 + 3 * (k % 64), 2.5 + 3 * Math.floor(k / 64)],
          1,
        ),
      );
    }
    const stats = {
      segmentPairs: 0,
      containmentPairs: 0,
      edges: { builds: 0, visits: 0, inspections: 0 },
    };
    const result = buildLoops(entities, undefined, stats);
    if (!("loops" in result)) throw new Error(result.error);
    expect(result.loops).toHaveLength(holes + 1);
    const outer = result.loops.filter((loop) => loop.depth === 0);
    expect(outer).toHaveLength(1);
    expect(outer[0]?.members).toContain("rim-0");
    expect(result.loops.filter((loop) => loop.depth === 1)).toHaveLength(holes);
    expect(stats.edges.builds).toBeGreaterThan(0);
    expect(stats.edges.visits).toBeGreaterThan(0);
    expect(stats.edges.inspections).toBeGreaterThan(0);
    expect(stats.edges.builds).toBeLessThanOrEqual(
      result.loops.reduce((sum, loop) => sum + loop.points.length / 2, 0),
    );
    expect(stats.edges.inspections).toBeLessThanOrEqual(4 * holes);
    return stats.edges;
  });
  console.log("detailed rim edge counts", JSON.stringify(counts));
  for (let i = 1; i < counts.length; i += 1) {
    const previous = counts[i - 1];
    const current = counts[i];
    if (!previous || !current) throw new Error("Missing counts");
    expect(
      current.builds + current.visits + current.inspections,
    ).toBeLessThanOrEqual(
      2.5 * (previous.builds + previous.visits + previous.inspections),
    );
  }
});

test("a slotted rim resolves hole containment without scanning crossings behind the ray", () => {
  for (const mirrored of [false, true]) {
    const counts: number[] = [];
    for (const [slots, holes] of [
      [256, 256],
      [512, 256],
      [256, 512],
      [512, 512],
    ] as const) {
      const width = 2 * slots + 136;
      const plate: CadXY[] = [
        [0, 0],
        [width, 0],
        [width, 100],
        [2 * slots, 100],
      ];
      for (let i = slots - 1; i >= 0; i -= 1)
        plate.push(
          [2 * i + 2, 10],
          [2 * i + 1, 10],
          [2 * i + 1, 100],
          [2 * i, 100],
        );
      const vertices: CadXY[][] = [plate];
      for (let k = 0; k < holes; k += 1) {
        const x = 2 * slots + 4 + 2 * (k % 64);
        const y = 12 + 2 * Math.floor(k / 64);
        vertices.push([
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
        ]);
      }
      const entities: Element[] = [];
      const expected = vertices.map((points, k) => {
        const transformed: CadXY[] = points.map(([x, y]) => [
          mirrored ? width - x : x,
          y,
        ]);
        for (let j = 0; j < transformed.length; j += 1) {
          const a = transformed[j];
          const b = transformed[(j + 1) % transformed.length];
          if (!a || !b) throw new Error("Missing vertex");
          entities.push(
            line(
              k === 0
                ? `a${String(j).padStart(5, "0")}`
                : `h${String(k - 1).padStart(5, "0")}-${j}`,
              a,
              b,
            ),
          );
        }
        const ordered = mirrored
          ? [transformed[0], ...transformed.slice(1).reverse()]
          : transformed;
        return ordered.flatMap((point) => point ?? []);
      });
      const stats = {
        segmentPairs: 0,
        containmentPairs: 0,
        edges: { builds: 0, visits: 0, inspections: 0, bulk: 0 },
      };
      const result = buildLoops(entities, undefined, stats);
      if (!("loops" in result)) throw new Error(result.error);
      expect(result.loops).toHaveLength(holes + 1);
      for (let k = 0; k < result.loops.length; k += 1) {
        expect(result.loops[k]?.depth).toBe(k === 0 ? 0 : 1);
        expect(result.loops[k]?.points).toEqual(expected[k]);
      }
      const q = stats.edges.visits + stats.edges.bulk + stats.edges.inspections;
      counts.push(q);
      console.log(
        "slotted rim",
        JSON.stringify({ mirrored, slots, holes, ...stats.edges, q }),
      );
      expect(q).toBeLessThanOrEqual(16 * holes * Math.log2(4 * slots + 4));
      expect(stats.edges.builds).toBeLessThanOrEqual(
        vertices.reduce((sum, points) => sum + points.length, 0),
      );
    }
    expect(counts[1] ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      1.5 * (counts[0] ?? 0),
    );
    expect(counts[3] ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      2.5 * (counts[0] ?? 0),
    );
  }
});

test("nested chains derive depth from immediate parents", () => {
  const series: number[][] = [[], [], []];
  for (const n of [1025, 2049, 4097]) {
    const size = 2 * n + 2;
    const entities: ReturnType<typeof line>[] = [];
    const points: number[][] = [];
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const vertices: CadXY[] = [
        [i, i],
        [size - i, i],
        [size - i, size - i],
        [i, size - i],
      ];
      const id = `r${String(i).padStart(5, "0")}`;
      ids.push(`${id}-0`);
      points.push(vertices.flat());
      for (let j = 0; j < 4; j++) {
        const a = vertices[j];
        const b = vertices[(j + 1) % 4];
        if (a === undefined || b === undefined)
          throw new Error("missing vertex");
        entities.push(line(`${id}-${j}`, a, b));
      }
    }
    const selections = [
      undefined,
      ids.filter((_, i) => i !== Math.floor(n / 2)),
      [ids[0] ?? "", ids[n - 1] ?? ""],
    ];
    for (const [selectionIndex, selection] of selections.entries()) {
      const stats = {
        segmentPairs: 0,
        containmentPairs: 0,
        edges: { builds: 0, visits: 0, inspections: 0, bulk: 0 },
        forest: { events: 0, steps: 0 },
      };
      const result = buildLoops(entities, selection, stats);
      if (!("loops" in result)) throw new Error(result.error);
      const indices =
        selectionIndex === 0
          ? ids.map((_, i) => i)
          : selectionIndex === 1
            ? ids.map((_, i) => i).filter((i) => i !== Math.floor(n / 2))
            : [0, n - 1];
      expect(result.loops.length).toBe(indices.length);
      for (const [j, i] of indices.entries()) {
        expect(result.loops[j]?.depth).toBe(i);
        expect(result.loops[j]?.points).toEqual(points[i]);
      }
      const { builds, visits, inspections, bulk } = stats.edges;
      const work =
        stats.containmentPairs +
        builds +
        visits +
        inspections +
        bulk +
        stats.forest.events +
        stats.forest.steps;
      series[selectionIndex]?.push(work);
    }
  }
  console.log("nested chain work", JSON.stringify(series));
  for (const values of series) {
    expect(
      (values[1] ?? Number.POSITIVE_INFINITY) / (values[0] ?? 1),
    ).toBeLessThanOrEqual(2.5);
    expect(
      (values[2] ?? Number.POSITIVE_INFINITY) / (values[1] ?? 1),
    ).toBeLessThanOrEqual(2.5);
  }
});
