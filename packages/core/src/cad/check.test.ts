import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import { canonicalize, encodeNmesh, toInline } from "@nodetto/io/nmesh";
import { isFractionalKey } from "../fractional.ts";
import { isElementIdFormat } from "../ids.ts";
import {
  cadBoundsWork,
  emptyBounds,
  includeBounds,
  loopExtents,
  sweptBounds,
} from "./bounds.ts";
import { visitCadConstruction } from "./construction.ts";
import type { CadFrame } from "./frames.ts";
import { checkCadPage } from "./check.ts";
import { createCadMemo, evaluateCadPage, releaseCadMemo } from "./evaluate.ts";
import {
  CAD_TEST_PAGE,
  bossOnFace,
  cadElement,
  extrude,
  plateElements,
  rectangle,
  sketch,
} from "./testing/documents.ts";
import { generateCadDocument } from "./testing/generate.ts";
import { RecordingKernel } from "./testing/recording-kernel.ts";

const report = (elements: readonly Element[]) =>
  checkCadPage(elements, CAD_TEST_PAGE.id);

test("check reports Plate, counts only local known CAD records, and has no bounds for an empty page", () => {
  expect(
    report([
      ...plateElements(),
      { ...sketch("foreign", "a1"), page: "elsewhere" },
      cadElement("future", "cad.future", "a3", {}),
      cadElement("color", "design.token", "a4", {
        name: "Finish",
        kind: "color",
        value: "#627385",
      }),
    ]),
  ).toEqual({
    pageId: CAD_TEST_PAGE.id,
    features: 2,
    entities: 4,
    errors: [],
    bounds: { min: [0, 0, 0], max: [100, 60, 5] },
  });
  expect(report([])).toEqual({
    pageId: CAD_TEST_PAGE.id,
    features: 0,
    entities: 0,
    errors: [],
    bounds: null,
  });
});

test("bounds follow face frames and include negative and symmetric tool spans", () => {
  const elements = [
    ...bossOnFace().elements,
    sketch("side", "a5", {
      face: { feature: "ex1", role: "side", entity: "base-edge-0" },
    }),
    ...rectangle("side", 1, 1, 2, 2),
    extrude("cut", "a6", {
      sketch: "side",
      distance: -8,
      symmetric: true,
      op: "cut",
      bodies: ["ex1"],
    }),
  ];
  expect(report(elements)).toMatchObject({
    bounds: { min: [0, -4, 0], max: [100, 60, 15] },
    errors: [],
  });
});

test("check includes structural, semantic and dependent failures from history", () => {
  const elements = [
    ...plateElements(),
    extrude("missing", "b1", { distance: 2, op: "new" }),
    sketch("failed", "b2", { face: { feature: "missing", role: "end" } }),
    sketch("forward", "b3", { face: { feature: "later", role: "end" } }),
    extrude("later", "b4", { sketch: "base", distance: 2, op: "new" }),
    sketch("cycle-sketch", "b5", {
      face: { feature: "cycle-extrude", role: "start" },
    }),
    extrude("cycle-extrude", "b6", {
      sketch: "cycle-sketch",
      distance: 2,
      op: "new",
    }),
    extrude("body-absent", "b7", {
      sketch: "base",
      distance: 2,
      op: "cut",
      bodies: [],
    }),
    extrude("body-reference", "b8", {
      sketch: "base",
      distance: 2,
      op: "add",
      bodies: ["ex1", "missing-body"],
    }),
    cadElement("invalid-mesh", "cad.mesh", "b9", {
      name: "Mesh",
      data: "invalid",
    }),
    extrude("invalid-mesh-target", "bA", {
      sketch: "base",
      distance: 1,
      op: "cut",
      bodies: ["invalid-mesh"],
    }),
    cadElement("round", "cad.circle", "bB", {
      sketch: "base",
      c: [10, 10],
      r: 2,
    }),
    sketch("curved-face", "bC", {
      face: { feature: "ex1", role: "side", entity: "round" },
    }),
    cadElement("invalid-sketch", "cad.sketch", "bD", { name: "Sketch" }),
    cadElement("invalid-entity", "cad.circle", "bE", {
      sketch: "different",
      c: [0, 0],
      r: 0,
    }),
    cadElement("detached-entity", "cad.circle", "bF", { c: [0, 0], r: 1 }),
  ];
  expect(report(elements).errors).toEqual([
    { id: "missing", code: "cad.reference.missing" },
    { id: "failed", code: "cad.reference.failed" },
    { id: "forward", code: "cad.order.forward" },
    { id: "cycle-sketch", code: "cad.cycle" },
    { id: "cycle-extrude", code: "cad.cycle" },
    { id: "body-absent", code: "cad.body.missing" },
    { id: "body-reference", code: "cad.body.reference" },
    { id: "invalid-mesh", code: "cad.mesh.invalid" },
    { id: "invalid-mesh-target", code: "cad.body.missing" },
    { id: "curved-face", code: "cad.plane.notPlanar" },
    { id: "invalid-sketch", code: "cad.feature.invalid" },
    { id: "invalid-entity", code: "cad.profile.invalid" },
    { id: "detached-entity", code: "cad.reference.missing" },
  ]);
});

test.each([
  ["cad.profile.empty", []],
  ["cad.profile.open", rectangle("base", 0, 0, 4, 4).slice(1)],
  [
    "cad.profile.branch",
    [
      ...rectangle("base", 0, 0, 4, 4),
      cadElement("branch", "cad.line", "a1", {
        sketch: "base",
        a: [0, 0],
        b: [1, 1],
      }),
    ],
  ],
  [
    "cad.profile.intersect",
    [
      ...rectangle("base", 0, 0, 4, 4),
      cadElement("crossing", "cad.circle", "a1", {
        sketch: "base",
        c: [4, 2],
        r: 1,
      }),
    ],
  ],
] as const)("check reports %s on the extrude", (code, entities) => {
  expect(
    report([
      sketch("base", "a1"),
      ...entities,
      extrude("tool", "a2", { sketch: "base", distance: 2, op: "new" }),
    ]),
  ).toMatchObject({ errors: [{ id: "tool", code }], bounds: null });
});

test("extent limits apply after transforming the tool and suppressed bodies are unavailable", () => {
  expect(
    report([
      sketch("base", "a1", { base: "xy", offset: 9999 }),
      ...rectangle("base", 0, 0, 4, 4),
      extrude("limit", "a2", { sketch: "base", distance: 2, op: "new" }),
      extrude("suppressed", "a3", {
        sketch: "base",
        distance: 2,
        op: "new",
        suppressed: true,
      }),
      extrude("cut", "a4", {
        sketch: "base",
        distance: -2,
        op: "cut",
        bodies: ["suppressed"],
      }),
    ]),
  ).toMatchObject({
    errors: [
      { id: "limit", code: "cad.limit" },
      { id: "cut", code: "cad.reference.failed" },
    ],
    bounds: null,
  });
});

test.each([
  ["suppressed cut, suppressed body", true, true, false, []],
  ["active cut, suppressed body", false, true, false, ["cut"]],
  ["suppressed cut, failed body", true, false, true, ["body", "cut"]],
] as const)(
  "check and evaluator agree for a %s",
  (_label, suppressed, suppressBody, failBody, failedIds) => {
    const elements = [
      sketch("base", "a1"),
      ...rectangle("base", 0, 0, 4, 4),
      ...(failBody ? [sketch("empty", "a2")] : []),
      extrude("body", "a3", {
        sketch: failBody ? "empty" : "base",
        distance: 2,
        op: "new",
        suppressed: suppressBody,
      }),
      extrude("cut", "a4", {
        sketch: "base",
        distance: -2,
        op: "cut",
        bodies: ["body"],
        suppressed,
      }),
    ];
    const kernel = new RecordingKernel();
    const memo = createCadMemo(kernel);
    try {
      const { status } = evaluateCadPage(elements, kernel, memo);
      const errors = [...status].flatMap(([id, result]) =>
        result.ok ? [] : [{ id, code: result.code }],
      );
      expect(errors.map(({ id }) => id)).toEqual([...failedIds]);
      expect(report(elements).errors).toEqual(errors);
    } finally {
      releaseCadMemo(memo);
    }
  },
);

test("CAD document generator is repeatable and uses unique production-format IDs", () => {
  const options = { features: 4, entitiesPerSketch: 19 };
  const doc = generateCadDocument(options);
  expect(generateCadDocument(options)).toEqual(doc);
  const ids = [
    doc.id,
    ...doc.pages.map(({ id }) => id),
    ...doc.elements.map(({ id }) => id),
  ];
  expect(doc.elements).toHaveLength(84);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every(isElementIdFormat)).toBe(true);
  expect(doc.elements.filter(({ type }) => type === "cad.line")).toHaveLength(
    32,
  );
  expect(doc.elements.filter(({ type }) => type === "cad.circle")).toHaveLength(
    44,
  );
  expect(
    doc.elements.filter(({ type }) => type === "cad.extrude"),
  ).toHaveLength(4);
  const indexes = doc.elements.map(({ index }) => index);
  expect(indexes.every(isFractionalKey)).toBe(true);
  expect([...new Set(indexes)].sort()).toEqual(indexes);
});

test("check handles 20,000 CAD elements in under one second", () => {
  const doc = generateCadDocument({ features: 1_000, entitiesPerSketch: 18 });
  const page = doc.pages[0];
  if (!page) throw new Error("Expected the generated CAD page");
  expect(doc.elements).toHaveLength(20_000);
  const start = performance.now();
  const result = checkCadPage(doc.elements, page.id);
  const elapsed = performance.now() - start;
  console.log(`CAD check, 20,000 elements: ${elapsed.toFixed(1)} ms`);
  expect(result).toMatchObject({
    features: 2_000,
    entities: 18_000,
    errors: [],
  });
  expect(elapsed).toBeLessThan(1000);
});

test("check decodes imported meshes and fails a corrupt payload and its dependents", () => {
  const data = toInline(
    encodeNmesh(
      canonicalize({
        positions: new Float64Array([0, 0, 0, 4, 0, 0, 0, 6, 0, 0, 0, 3]),
        triangles: new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]),
      }),
    ),
  );
  const mesh = (id: string, order: string, payload: string) =>
    cadElement(id, "cad.mesh", order, { name: "Imported", data: payload });
  const cut = (id: string, order: string, body: string) =>
    extrude(id, order, {
      sketch: "base",
      distance: 1,
      op: "cut",
      bodies: [body],
    });
  expect(
    report([
      ...plateElements(),
      mesh("sound", "b1", data),
      cut("sound-cut", "b2", "sound"),
      mesh("corrupt", "b3", "nmesh1:AAAA"),
      cut("corrupt-cut", "b4", "corrupt"),
    ]).errors,
  ).toEqual([
    { id: "corrupt", code: "cad.mesh.invalid" },
    { id: "corrupt-cut", code: "cad.body.missing" },
  ]);
});

test("shared outline projection work is independent of extrusion count", () => {
  const vertices = Array.from({ length: 1000 }, (_, i) => {
    const angle = (2 * Math.PI * i) / 1000;
    return [
      Math.round(1000 * Math.cos(angle)),
      Math.round(1000 * Math.sin(angle)),
    ];
  });
  const edges = vertices.map((a, i) =>
    cadElement(`edge-${i}`, "cad.line", "a1", {
      sketch: "profile",
      a,
      b: vertices[(i + 1) % vertices.length],
    }),
  );
  const run = (count: number) => {
    cadBoundsWork.vertexProjections = 0;
    const result = report([
      sketch("profile", "a"),
      ...edges,
      ...Array.from({ length: count }, (_, i) =>
        extrude(`tool-${i}`, "b", {
          sketch: "profile",
          distance: 1 + i,
          op: "new",
        }),
      ),
    ]);
    expect(result.errors).toEqual([]);
    return cadBoundsWork.vertexProjections;
  };
  const single = run(1);
  const repeated = run(1000);
  console.log(`Shared outline projections: ${single} and ${repeated}`);
  expect(single).toBeGreaterThan(0);
  expect(repeated).toBe(single);
});

test("swept bounds retain the original projection formula", () => {
  const frames: CadFrame[] = [
    { o: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] },
    {
      o: [1.25, -2.5, 4],
      u: [0.6, 0.8, 0],
      v: [-0.4, 0.3, 0.866025403784],
      n: [0.692820323, -0.519615242, 0.5],
    },
  ];
  const loops = [
    { points: [1.1, -2.2, 3.3, 4.4, -5.5, 6.6] },
    { points: [-9, 7, 2, -3] },
  ];
  for (const frame of frames)
    for (const [t0, t1] of [
      [0, 8],
      [-8, 0],
      [-4, 4],
    ] as const) {
      const min: number[] = [];
      const max: number[] = [];
      for (const axis of [0, 1, 2] as const) {
        const { o, u, v, n } = frame;
        let lower = o[axis];
        let upper = o[axis];
        if (u[axis] !== 0 || v[axis] !== 0) {
          lower = Number.POSITIVE_INFINITY;
          upper = Number.NEGATIVE_INFINITY;
          for (const { points } of loops)
            for (let i = 0; i < points.length; i += 2) {
              const base =
                o[axis] + u[axis] * points[i]! + v[axis] * points[i + 1]!;
              lower = Math.min(lower, base);
              upper = Math.max(upper, base);
            }
        }
        min.push(lower + Math.min(n[axis] * t0, n[axis] * t1));
        max.push(upper + Math.max(n[axis] * t0, n[axis] * t1));
      }
      expect<unknown>(sweptBounds(frame, t0, t1, loops)).toEqual({ min, max });
    }
});

test("shared multi-loop extrema work scales with profile size", () => {
  const counts: number[] = [];
  for (const size of [128, 256, 512, 1024]) {
    const run = (count: number) => {
      cadBoundsWork.extremaReads = 0;
      cadBoundsWork.vertexProjections = 0;
      const result = report([
        sketch("profile", "a"),
        ...Array.from({ length: size }, (_, i) =>
          cadElement(`circle-${i}`, "cad.circle", "a1", {
            sketch: "profile",
            c: [3 * i, 0],
            r: 1,
          }),
        ),
        ...Array.from({ length: count }, (_, i) =>
          extrude(`tool-${i}`, "b", {
            sketch: "profile",
            distance: i + 1,
            op: "new",
          }),
        ),
      ]);
      expect(result.errors).toEqual([]);
      return { ...cadBoundsWork };
    };
    const single = run(1);
    const repeated = run(size);
    console.log(
      `extrema size=${size}: single=${single.extremaReads} repeated=${repeated.extremaReads} projections=${repeated.vertexProjections}`,
    );
    expect(repeated.vertexProjections).toBe(single.vertexProjections);
    counts.push(repeated.extremaReads);
  }
  expect(counts).toEqual([128, 256, 512, 1024]);
});

test("ordinary document extrema work is pinned", () => {
  const doc = generateCadDocument({ features: 500, entitiesPerSketch: 18 });
  cadBoundsWork.extremaReads = 0;
  cadBoundsWork.vertexProjections = 0;
  checkCadPage(doc.elements, doc.pages[0]?.id ?? "");
  expect(cadBoundsWork.extremaReads).toBe(5500);
  expect(cadBoundsWork.extremaReads).toBeLessThanOrEqual(16500);
  expect(cadBoundsWork.vertexProjections).toBe(164000);
});

test("profile bounds and limit decisions match per-loop oracles", () => {
  const loops = [
    { points: [0, 0, 1, 0, 1, 1, 0, 1] },
    { points: [9999.5, 0, 9999.9, 0, 9999.9, 1, 9999.5, 1] },
  ];
  const frame: CadFrame = {
    o: [0, 0, 0],
    u: [1, 0, 0],
    v: [0, 1, 0],
    n: [0, 0, 1],
  };
  const oracleWithin = (
    selected: typeof loops,
    f: CadFrame,
    t0: number,
    t1: number,
  ) =>
    selected.every(({ points }) => {
      const { min, max } = loopExtents(points, f);
      return ([0, 1, 2] as const).every((axis) =>
        [min[axis], max[axis]].every((base) =>
          [t0, t1].every((t) => Math.abs(base + f.n[axis] * t) <= 10000 + 1e-9),
        ),
      );
    });
  const oracleSwept = (
    selected: readonly { readonly points: ArrayLike<number> }[],
    f: CadFrame,
    t0: number,
    t1: number,
  ) => {
    const box = emptyBounds();
    for (const axis of [0, 1, 2] as const) {
      let lower = f.o[axis];
      let upper = lower;
      if (f.u[axis] !== 0 || f.v[axis] !== 0) {
        lower = Number.POSITIVE_INFINITY;
        upper = Number.NEGATIVE_INFINITY;
        for (const loop of selected) {
          const extents = loopExtents(loop.points, f);
          lower = Math.min(lower, extents.min[axis]);
          upper = Math.max(upper, extents.max[axis]);
        }
      }
      box.min[axis] = lower + Math.min(f.n[axis] * t0, f.n[axis] * t1);
      box.max[axis] = upper + Math.max(f.n[axis] * t0, f.n[axis] * t1);
    }
    return box;
  };
  const circles = [
    cadElement("near", "cad.circle", "a1", {
      sketch: "profile",
      c: [0, 0],
      r: 1,
    }),
    cadElement("far", "cad.circle", "a1", {
      sketch: "profile",
      c: [4, 0],
      r: 1,
    }),
  ];
  const cases = [
    [
      sketch("profile", "a"),
      ...circles,
      extrude("tool", "b", { sketch: "profile", distance: 3, op: "new" }),
    ],
    [
      sketch("profile", "a"),
      ...circles,
      extrude("tool", "b", {
        sketch: "profile",
        loops: ["near"],
        distance: -3,
        op: "new",
      }),
    ],
    [
      sketch("profile", "a"),
      ...circles,
      extrude("tool", "b", {
        sketch: "profile",
        distance: 4,
        symmetric: true,
        op: "new",
      }),
    ],
    [
      ...bossOnFace().elements,
      sketch("side", "a5", {
        face: { feature: "ex1", role: "side", entity: "base-edge-0" },
      }),
      ...rectangle("side", 1, 1, 2, 2),
      extrude("side-tool", "a6", { sketch: "side", distance: -8, op: "new" }),
    ],
  ];
  for (const elements of cases) {
    const expected = emptyBounds();
    const visited = visitCadConstruction(elements, CAD_TEST_PAGE.id, {
      tool(feature, { frame: f, span, loops: selected }) {
        if (feature.type === "cad.extrude")
          includeBounds(expected, oracleSwept(selected, f, span.t0, span.t1));
      },
    });
    expect(visited.errors).toEqual([]);
    expect(report(elements).bounds).toEqual(expected);
  }
  const square = (id: string, x: number) =>
    rectangle("limit-profile", x, 0, id === "far" ? 0.4 : 1, 1).map((e, i) => ({
      ...e,
      id: `${id}-${i}`,
    }));
  for (const subset of [false, true]) {
    const elements = [
      sketch("base", "a"),
      ...rectangle("base", 1, 0, 2, 2),
      extrude("base-tool", "b", { sketch: "base", distance: 1, op: "new" }),
      sketch("limit-profile", "c", {
        face: { feature: "base-tool", role: "side", entity: "base-edge-0" },
      }),
      ...square("near", 0),
      ...square("far", 9999.5),
      extrude("limit-tool", "d", {
        sketch: "limit-profile",
        ...(subset ? { loops: ["near-0"] } : {}),
        distance: 1,
        op: "new",
      }),
    ];
    const actual = report(elements);
    const selected = subset ? loops.slice(0, 1) : loops;
    expect(actual.errors.some((e) => e.code === "cad.limit")).toBe(
      !oracleWithin(
        selected,
        { o: [1, 0, 0], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] },
        0,
        1,
      ),
    );
  }
  const rotated: CadFrame = {
    o: [2, -3, 4],
    u: [0, 1, 0],
    v: [0, 0, 1],
    n: [1, 0, 0],
  };
  for (const f of [frame, rotated, frame])
    for (const [t0, t1] of [
      [0, 3],
      [-3, 0],
      [-2, 2],
    ] as const)
      expect(sweptBounds(f, t0, t1, loops)).toEqual(
        oracleSwept(loops, f, t0, t1),
      );
});
