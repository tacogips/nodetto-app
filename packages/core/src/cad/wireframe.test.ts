import { expect, test } from "bun:test";
import { canonicalize, encodeNmesh, toInline } from "@nodetto/io/nmesh";
import { buildLoops } from "./loops.ts";
import {
  CAD_TEST_PAGE,
  cadElement,
  extrude,
  plateElements,
  rectangle,
  sketch,
} from "./testing/documents.ts";
import { generateCadDocument } from "./testing/generate.ts";
import { boardReference, edge, testBoard } from "./testing/pcb.ts";
import { cadPageWireframe } from "./wireframe.ts";

const page = CAD_TEST_PAGE.id;

test("extrudes project caps and source joins, deduplicating shared segments", () => {
  const elements = plateElements();
  const box = cadPageWireframe(elements, page);
  expect(box.segments.length / 4).toBe(12);
  expect(box.bounds?.minX).toBeCloseTo(-42.4264);
  expect(box.bounds?.minY).toBeCloseTo(-4.08248);
  expect(box.bounds?.maxX).toBeCloseTo(70.7107);
  expect(box.bounds?.maxY).toBeCloseTo(65.3197);
  const repeat = extrude("duplicate", "a3", {
    sketch: "base",
    distance: 5,
    op: "new",
  });
  expect(cadPageWireframe([...elements, repeat].reverse(), page)).toEqual(box);

  const circle = cadElement("rim", "cad.circle", "a1", {
    sketch: "circle",
    c: [0, 0],
    r: 5,
  });
  const profile = buildLoops([circle]);
  if ("error" in profile) throw new Error(profile.error);
  const cylinder = cadPageWireframe(
    [
      sketch("circle", "a1", { base: "yz" }),
      circle,
      extrude("cylinder", "a2", { sketch: "circle", distance: -7, op: "new" }),
    ],
    page,
  );
  expect(cylinder.segments.length / 4).toBe(
    2 * (profile.loops[0]?.sources.length ?? 0),
  );
});

test("invalid or suppressed tools and sketches alone contribute no geometry", () => {
  const result = cadPageWireframe(
    [
      sketch("sketch", "a1"),
      extrude("empty", "a2", { sketch: "sketch", distance: 5, op: "new" }),
      extrude("missing", "a3", { sketch: "other", distance: 5, op: "new" }),
      ...plateElements().slice(0, -1),
      extrude("hidden", "a4", {
        sketch: "base",
        distance: 5,
        op: "new",
        suppressed: true,
      }),
    ],
    page,
  );
  expect(result.bounds).toBeNull();
  expect(result.segments).toHaveLength(0);
});

test("PCB edges and mesh bounds are projected without solids", () => {
  const board = [
    testBoard(),
    edge("rim", { kind: "rect", start: [0, 0], end: [20, 9] }),
    boardReference(),
  ];
  expect(cadPageWireframe(board, page).segments.length / 4).toBe(8);
  expect(cadPageWireframe([boardReference()], page).bounds).toBeNull();

  const mesh = canonicalize({
    positions: new Float64Array([0, 0, 0, 4, 0, 0, 0, 6, 0, 0, 0, 3]),
    triangles: new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]),
  });
  const imported = cadElement("import", "cad.mesh", "a2", {
    name: "Tetrahedron",
    data: toInline(encodeNmesh(mesh)),
  });
  expect(cadPageWireframe([imported], page).segments.length / 4).toBe(12);
  expect(
    cadPageWireframe(
      [{ ...imported, semantic: { name: "Bad", data: "nmesh1:AAAA" } }],
      page,
    ).bounds,
  ).toBeNull();
});

test("projects 20,000 elements within one second", () => {
  const { elements, pages } = generateCadDocument({
    features: 1_000,
    entitiesPerSketch: 18,
  });
  expect(elements).toHaveLength(20_000);
  const started = performance.now();
  const result = cadPageWireframe(elements, pages[0]?.id ?? "");
  const elapsed = performance.now() - started;
  expect(result.segments.length).toBeGreaterThan(0);
  console.log(
    `CAD construction projection, 20,000 elements: ${elapsed.toFixed(1)} ms`,
  );
  expect(elapsed).toBeLessThan(1_000);
});

test("invalid and empty meshes do not admit dependent cuts", () => {
  const valid = cadElement("import", "cad.mesh", "a2", {
    name: "Mesh",
    data: toInline(
      encodeNmesh(
        canonicalize({
          positions: new Float64Array([0, 0, 0, 4, 0, 0, 0, 6, 0, 0, 0, 3]),
          triangles: new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]),
        }),
      ),
    ),
  });
  const cut = [
    sketch("cut", "a3"),
    ...rectangle("cut", 1, 1, 2, 2),
    extrude("cut-feature", "a4", {
      sketch: "cut",
      distance: 1,
      op: "cut",
      bodies: ["import"],
    }),
  ];
  const empty = toInline(
    encodeNmesh(
      canonicalize({
        positions: new Float64Array(),
        triangles: new Uint32Array(),
      }),
    ),
  );
  for (const data of ["nmesh1:AAAA", empty]) {
    const result = cadPageWireframe(
      [{ ...valid, semantic: { ...valid.semantic, data } }, ...cut],
      page,
    );
    expect(result.segments).toHaveLength(0);
    expect(result.bounds).toBeNull();
  }
  const alone = cadPageWireframe([valid], page);
  expect(alone.segments.length / 4).toBe(12);
  expect(
    cadPageWireframe([valid, ...cut], page).segments.length,
  ).toBeGreaterThan(alone.segments.length);
});

test("bounds hook matches decoded asymmetric mesh and rejects failures", () => {
  const data = toInline(
    encodeNmesh(
      canonicalize({
        positions: new Float64Array([
          -4, -2, -3, 7, -2, -3, -4, 6, -3, -4, -2, 5,
        ]),
        triangles: new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]),
      }),
    ),
  );
  const mesh = cadElement("import", "cad.mesh", "a2", { name: "Mesh", data });
  const stats = { decodes: 0 };
  const fallback = cadPageWireframe([mesh], page, { stats });
  expect(stats.decodes).toBe(1);
  let calls = 0;
  stats.decodes = 0;
  const result = cadPageWireframe([mesh], page, {
    stats,
    meshBounds: () => {
      calls++;
      return { min: [-4, -2, -3], max: [7, 6, 5] };
    },
  });
  expect(result).toEqual(fallback);
  expect(stats.decodes).toBe(0);
  expect(calls).toBe(1);
  const cut = [
    sketch("cut", "a3"),
    ...rectangle("cut", 1, 1, 2, 2),
    extrude("cut-feature", "a4", {
      sketch: "cut",
      distance: 1,
      op: "cut",
      bodies: ["import"],
    }),
  ];
  for (const meshBounds of [
    () => null,
    () => {
      throw new Error("invalid");
    },
  ]) {
    const failed = cadPageWireframe([mesh, ...cut], page, { meshBounds });
    expect(failed.segments).toHaveLength(0);
    expect(failed.bounds).toBeNull();
  }
});
