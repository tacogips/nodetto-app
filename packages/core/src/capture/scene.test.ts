import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  canonicalize,
  decodeCaptureMeshWith,
  encodeNmesh,
  toInline,
} from "@nodetto/io/nmesh";
import type { CadXY, Element, PageId } from "@nodetto/ir";
import { checkCadPage } from "../cad/check.ts";
import { buildLoops, type CadLoop } from "../cad/loops.ts";
import {
  bossOnFace,
  CAD_TEST_PAGE,
  cadElement,
  extrude,
  plateElements,
  rectangle,
  sketch,
} from "../cad/testing/documents.ts";
import { generateCadDocument } from "../cad/testing/generate.ts";
import { boardReference, edge, testBoard } from "../cad/testing/pcb.ts";
import { coordinate } from "../cad/vec.ts";
import { compareFractional } from "../fractional.ts";
import { prepareCadCapture } from "./cad-request.ts";
import {
  buildCadCaptureModel,
  CAPTURE_THEMES,
  normaliseToolLoops,
  writeCaptureScene,
} from "./index.ts";

function modelOf(
  elements: readonly Element[],
  page: PageId = CAD_TEST_PAGE.id,
) {
  const model = buildCadCaptureModel(elements, page);
  const { errors } = checkCadPage(elements, page);
  expect(model.errors).toEqual(
    [...errors].sort((a, b) => compareFractional(a.id, b.id)),
  );
  return model;
}

function circle(id: string, sketchId: string, c: CadXY, r: number) {
  return cadElement(id, "cad.circle", "a1", { sketch: sketchId, c, r });
}

test("a cut is one shared tool for two bodies and does not enlarge their bounds", () => {
  const plate = plateElements();
  const opening = [
    sketch("opening", "a4"),
    circle("rim", "opening", [10, 12], 2),
    extrude("opening-cut", "a5", {
      sketch: "opening",
      distance: -12,
      symmetric: true,
      op: "cut",
      bodies: ["puck", "ex1"],
    }),
  ];
  const one = modelOf([
    ...plate,
    ...opening.slice(0, -1),
    extrude("opening-cut", "a5", {
      sketch: "opening",
      distance: 5,
      op: "cut",
      bodies: ["ex1"],
    }),
  ]);
  expect(one.bodies).toHaveLength(1);
  expect(one.bodies[0]?.steps).toEqual([
    { op: "union", tool: 0 },
    { op: "difference", tool: 1 },
  ]);

  // The input arrives out of order. Tools and bodies follow feature history.
  const elements = [
    ...opening,
    extrude("puck", "a3", { sketch: "base", distance: 3, op: "new" }),
    ...plate,
  ];
  const model = modelOf(elements);
  expect(model.tools.map(({ feature }) => feature)).toEqual([
    "ex1",
    "puck",
    "opening-cut",
  ]);
  expect(model.tools[2]).toMatchObject({ t0: 6, t1: -6 });
  expect(model.bodies).toEqual([
    {
      id: "ex1",
      name: "ex1",
      reference: false,
      steps: [
        { op: "union", tool: 0 },
        { op: "difference", tool: 2 },
      ],
      bounds: { min: [0, 0, 0], max: [100, 60, 5] },
    },
    {
      id: "puck",
      name: "puck",
      reference: false,
      steps: [
        { op: "union", tool: 1 },
        { op: "difference", tool: 2 },
      ],
      bounds: { min: [0, 0, 0], max: [100, 60, 3] },
    },
  ]);
  expect(model.bounds).toEqual({ min: [0, 0, 0], max: [100, 60, 5] });
  expect(modelOf([...elements].reverse())).toEqual(model);
});

test("union expands the swept box and intersection leaves it conservative", () => {
  const model = modelOf([
    ...bossOnFace().elements,
    sketch("slice", "a5", { base: "zx", offset: 15 }),
    ...rectangle("slice", -10, -10, 30, 30),
    extrude("clip", "a6", {
      sketch: "slice",
      distance: 25,
      op: "intersect",
      bodies: ["ex1"],
    }),
  ]);
  expect(model.bodies[0]?.steps).toEqual([
    { op: "union", tool: 0 },
    { op: "union", tool: 1 },
    { op: "intersection", tool: 2 },
  ]);
  expect(model.bodies[0]?.bounds).toEqual({
    min: [0, 0, 0],
    max: [100, 60, 15],
  });
  expect(model.bounds).toEqual({ min: [0, 0, 0], max: [100, 60, 15] });
});

test("sweeps visible creation tools along a side plane and unions distinct body boxes", () => {
  const model = modelOf([
    ...plateElements(),
    sketch("side", "a3", {
      face: { feature: "ex1", role: "side", entity: "base-edge-0" },
    }),
    ...rectangle("side", 1, 1, 2, 2),
    extrude("bracket", "a4", {
      sketch: "side",
      distance: -8,
      symmetric: true,
      op: "new",
    }),
  ]);
  expect(model.bodies[1]?.bounds).toEqual({ min: [1, -4, 1], max: [3, 4, 3] });
  expect(model.bounds).toEqual({ min: [0, -4, 0], max: [100, 60, 5] });
});

test("propagates failed features, includes bad sketch entities, and omits suppressed geometry", () => {
  const elements = [
    ...plateElements(),
    sketch("bad-plane", "a3", {
      face: { feature: "ex1", role: "side", entity: "stray" },
    }),
    extrude("failed-cut", "a4", {
      sketch: "bad-plane",
      distance: 4,
      op: "cut",
      bodies: ["ex1"],
    }),
    extrude("quiet-cut", "a5", {
      sketch: "base",
      distance: 4,
      op: "cut",
      bodies: ["ex1"],
      suppressed: true,
    }),
    extrude("quiet-body", "a6", {
      sketch: "base",
      distance: 4,
      op: "new",
      suppressed: true,
    }),
    extrude("quiet-target", "a7", {
      sketch: "base",
      distance: 4,
      op: "cut",
      bodies: ["quiet-body"],
    }),
    sketch("quiet-face", "a8", {
      face: { feature: "quiet-body", role: "end" },
    }),
    circle("stray", "gone", [0, 0], 1),
  ];
  const model = modelOf(elements);
  expect(model.tools).toHaveLength(1);
  expect(model.bodies[0]?.steps).toEqual([{ op: "union", tool: 0 }]);
  expect(model.sketches).toBe(1);
  expect(model.errors).toEqual([
    { id: "bad-plane", code: "cad.reference.missing" },
    { id: "failed-cut", code: "cad.reference.failed" },
    { id: "quiet-face", code: "cad.reference.failed" },
    { id: "quiet-target", code: "cad.reference.failed" },
    { id: "stray", code: "cad.reference.missing" },
  ]);
  expect(modelOf([...elements].reverse()).errors).toEqual(model.errors);
});

test("hidden creators stay available to feature references and do not contribute capture bounds", () => {
  const model = modelOf([
    ...bossOnFace().elements.map((item) =>
      item.id === "ex1" ? { ...item, visual: { hidden: true } } : item,
    ),
    extrude("pin", "a5", { sketch: "boss", distance: 3, op: "new" }),
  ]);
  expect(model.tools.map(({ feature }) => feature)).toEqual([
    "ex1",
    "ex2",
    "pin",
  ]);
  expect(model.bodies.map(({ id }) => id)).toEqual(["pin"]);
  expect(model.bodies[0]?.steps).toEqual([{ op: "union", tool: 2 }]);
  expect(model.bounds).toEqual({ min: [20, 15, 5], max: [60, 35, 8] });
});

test("prism loops store flat typed vertices and one side face per source across loops", () => {
  const model = modelOf([
    ...plateElements(),
    circle("bore", "base", [25, 25], 3),
  ]);
  const loops = model.tools[0]?.loops ?? [];
  expect(loops).toHaveLength(2);
  for (const { points, faces } of loops) {
    expect(points).toBeInstanceOf(Float64Array);
    expect(faces).toBeInstanceOf(Uint32Array);
    expect(points.length).toBe(faces.length * 2);
    expect(new Set(faces).size).toBe(faces.length === 4 ? 4 : 1);
  }
  const firstUse = new Set(loops.flatMap(({ faces }) => [...faces]));
  expect([...firstUse]).toEqual([2, 3, 4, 5, 6]);
});

test("builds a reference body using another page's PCB geometry", () => {
  const board = testBoard(1.2);
  const outline = edge("rim", { kind: "rect", start: [5, 10], end: [35, 50] });
  const model = modelOf([outline, ...plateElements(), boardReference(), board]);
  expect(model.bodies[0]).toEqual({
    id: "board-reference",
    name: boardReference().semantic.name,
    reference: true,
    steps: [{ op: "union", tool: 0 }],
    bounds: { min: [0, 0, 0], max: [30, 40, 1.2] },
  });
  expect(model.tools[0]).toMatchObject({
    feature: "board-reference",
    t0: 0,
    t1: 1.2,
  });
  expect(modelOf([boardReference(), board]).errors).toEqual([
    { id: "board-reference", code: "cad.pcb.noOutline" },
  ]);
});

test("counts successful sketches without solids and tracks meshes accepted by cad check", () => {
  const model = modelOf([
    cadElement("mesh", "cad.mesh", "a0", {
      name: "Imported prism",
      data: toInline(
        encodeNmesh(
          canonicalize({
            positions: new Float64Array([0, 0, 0, 4, 0, 0, 0, 6, 0, 0, 0, 3]),
            triangles: new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]),
          }),
        ),
      ),
    }),
    sketch("profile", "a1"),
    { ...sketch("foreign", "a1"), page: "other" },
    ...rectangle("profile", 0, 0, 5, 6),
    extrude("mesh-cut", "a2", {
      sketch: "profile",
      distance: 3,
      op: "cut",
      bodies: ["mesh"],
    }),
  ]);
  expect(model.sketches).toBe(1);
  expect(model.bounds).toBeNull();
  expect(model.bodies).toEqual([]);
  expect(model.tools.map(({ feature }) => feature)).toEqual(["mesh-cut"]);
  expect(model.skipped).toEqual([{ id: "mesh", reason: "mesh" }]);
  expect(modelOf([sketch("profile", "a1")])).toMatchObject({
    sketches: 1,
    tools: [],
    bodies: [],
    bounds: null,
  });
});

test("reports a failed mesh dependency as a missing target body", () => {
  const model = modelOf([
    ...plateElements(),
    cadElement("broken-shell", "cad.mesh", "a3", {
      name: "Broken shell",
      data: "not-an-nmesh-payload",
    }),
    extrude("shell-cut", "a4", {
      sketch: "base",
      distance: 2,
      op: "cut",
      bodies: ["broken-shell"],
    }),
  ]);
  expect(model.errors).toEqual([
    { id: "broken-shell", code: "cad.mesh.invalid" },
    { id: "shell-cut", code: "cad.body.missing" },
  ]);
});

test("keeps display-only mesh bodies and rejects cuts; decoder errors fail the mesh", () => {
  const mesh = cadElement("mesh", "cad.mesh", "a0", {
    name: "Imported",
    data: "nmesh1:UExBVEU=",
  });
  const elements = [
    mesh,
    sketch("profile", "a1"),
    ...rectangle("profile", 0, 0, 1, 1),
    extrude("cut", "a2", {
      sketch: "profile",
      distance: 1,
      op: "cut",
      bodies: ["mesh"],
    }),
  ];
  const positions = new Float64Array([0, 0, 0, 2, 0, 0, 0, 2, 2]);
  const triangles = new Uint32Array([0, 1, 2]);
  const model = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, {
    decodeMesh: () => ({
      positions,
      triangles,
      vertexCount: 3,
      triangleCount: 1,
      booleanTarget: false,
      bounds: { min: [0, 0, 0], max: [2, 2, 2] },
    }),
  });
  expect(model.tools[0]).toMatchObject({
    kind: "mesh",
    feature: "mesh",
    positions,
    triangles,
  });
  expect(model.bodies[0]).toMatchObject({
    id: "mesh",
    bounds: { min: [0, 0, 0], max: [2, 2, 2] },
    steps: [{ op: "union", tool: 0 }],
  });
  expect(model.errors).toEqual([{ id: "cut", code: "cad.body.missing" }]);
  expect(model.skipped).toEqual([]);
  const failed = buildCadCaptureModel([mesh], CAD_TEST_PAGE.id, {
    decodeMesh: () => {
      throw new Error("bad");
    },
  });
  expect(failed.errors).toEqual([{ id: "mesh", code: "cad.mesh.invalid" }]);
  expect(failed.bodies).toEqual([]);
  // A mesh without triangles has no bounds and must not become a body.
  const empty = buildCadCaptureModel([mesh], CAD_TEST_PAGE.id, {
    decodeMesh: () => ({
      vertexCount: 0,
      triangleCount: 0,
      bounds: null,
      positions: new Float64Array(0),
      triangles: new Uint32Array(0),
    }),
  });
  expect(empty.errors).toEqual([{ id: "mesh", code: "cad.mesh.invalid" }]);
  expect(empty.bodies).toEqual([]);
  expect(empty.tools).toEqual([]);
  for (const decoded of [
    {
      vertexCount: 3,
      triangleCount: 0,
      bounds: { min: [0, 0, 0] as const, max: [2, 2, 2] as const },
      positions,
      triangles,
    },
    {
      vertexCount: 3,
      triangleCount: 1,
      bounds: { min: [0, 0, 0] as const, max: [2, 2, 2] as const },
      triangles,
    },
    {
      vertexCount: 3,
      triangleCount: 1,
      bounds: { min: [0, 0, 0] as const, max: [2, 2, 2] as const },
      positions,
    },
  ]) {
    const invalid = buildCadCaptureModel([mesh], CAD_TEST_PAGE.id, {
      decodeMesh: () => decoded,
    });
    expect(invalid.errors).toEqual([{ id: "mesh", code: "cad.mesh.invalid" }]);
    expect(invalid.bodies).toEqual([]);
  }
});

function selectedLoops(entities: readonly Element[], pick?: readonly string[]) {
  const profile = buildLoops(entities, pick);
  if ("error" in profile) throw new Error(profile.error);
  return profile.loops;
}

// Winding-number containment gives an independent reference for the
// deepest-selected-loop rule. Lattice points are offset from the axes.
function contains({ points }: CadLoop, x: number, y: number): boolean {
  let winding = 0;
  for (let i = 0; i < points.length; i += 2) {
    const next = (i + 2) % points.length;
    const ax = coordinate(points, i);
    const ay = coordinate(points, i + 1);
    const bx = coordinate(points, next);
    const by = coordinate(points, next + 1);
    const side = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (ay <= y && by > y && side > 0) winding += 1;
    if (ay > y && by <= y && side < 0) winding -= 1;
  }
  return winding !== 0;
}

function compareRegions(selected: readonly CadLoop[]): readonly CadLoop[] {
  const kept = normaliseToolLoops(selected);
  const keptSet = new Set(kept);
  expect(kept).toEqual(selected.filter((loop) => keptSet.has(loop)));
  for (let iy = 0; iy < 200; iy += 1) {
    for (let ix = 0; ix < 200; ix += 1) {
      const x = -55 + (ix + 0.39) * 0.55;
      const y = -55 + (iy + 0.64) * 0.55;
      let deepest = -1;
      let parity = 0;
      for (const loop of selected) {
        if (!contains(loop, x, y)) continue;
        deepest = Math.max(deepest, loop.depth);
        if (keptSet.has(loop)) parity ^= 1;
      }
      if ((deepest % 2 === 0) !== (parity === 1))
        throw new Error(`Loop rules differ at ${x}, ${y}.`);
    }
  }
  return kept;
}

const outer = rectangle("profile", -50, -50, 100, 100);
const outerId = "profile-edge-0";
const hole = circle("hole", "profile", [0, 0], 35);
const island = circle("island", "profile", [0, 0], 20);
const well = circle("well", "profile", [0, 0], 9);

test("omits leading odd levels and redundant islands with an unselected hole", () => {
  const entities = [...outer, hole, island];
  expect(
    compareRegions(selectedLoops(entities, [hole.id, island.id])).map(
      ({ depth }) => depth,
    ),
  ).toEqual([2]);
  expect(
    compareRegions(selectedLoops(entities, [outerId, island.id])).map(
      ({ depth }) => depth,
    ),
  ).toEqual([0]);
  expect(compareRegions(selectedLoops(entities))).toHaveLength(3);
  expect(compareRegions(selectedLoops(entities, [hole.id]))).toEqual([]);
  const model = modelOf([
    sketch("profile", "a1"),
    ...entities,
    extrude("disc", "a2", {
      sketch: "profile",
      loops: [hole.id, island.id],
      distance: 5,
      op: "new",
    }),
  ]);
  expect(model.tools[0]?.loops).toHaveLength(1);
  expect(model.bounds).toEqual({ min: [-20, -20, 0], max: [20, 20, 5] });
});

const nestedSelections: string[][] = [
  [outerId, hole.id],
  [outerId, island.id],
  [outerId, well.id],
  [hole.id, island.id],
  [hole.id, well.id],
  [island.id, well.id],
  [outerId, hole.id, island.id],
  [outerId, hole.id, well.id],
  [outerId, island.id, well.id],
  [hole.id, island.id, well.id],
];

test.each(nestedSelections.map((pick) => [pick] as const))(
  "agrees with the deepest selected depth for %j",
  (pick) => {
    compareRegions(selectedLoops([...outer, hole, island, well], pick));
  },
);

test("finds the containing ancestor among two disjoint islands inside a hole", () => {
  const left = circle("left-island", "profile", [-13, 0], 10);
  const right = circle("right-island", "profile", [13, 0], 10);
  const inner = circle("inner-hole", "profile", [13, 0], 5);
  const entities = [...outer, hole, left, right, inner];
  expect(
    compareRegions(selectedLoops(entities, [outerId, left.id])),
  ).toHaveLength(1);
  expect(
    compareRegions(
      selectedLoops(entities, [hole.id, left.id, right.id, inner.id]),
    ),
  ).toHaveLength(3);
});

test("keeps an island inside another loop's bounding box but outside its polygon", () => {
  const disc = circle("disc", "profile", [0, 0], 40);
  const corner = rectangle("profile", 32, 32, 7, 7);
  const pocket = circle("pocket", "profile", [35.5, 35.5], 2.5);
  const inset = circle("inset", "profile", [35.5, 35.5], 1.25);
  const selected = selectedLoops(
    [disc, ...corner, pocket, inset],
    [disc.id, inset.id],
  );
  expect(selected.map(({ depth }) => depth)).toEqual([0, 2]);
  expect(compareRegions(selected)).toEqual(selected);
});

test("builds 20,000 CAD elements in under 1,000 ms", () => {
  const doc = generateCadDocument({ features: 1_000, entitiesPerSketch: 18 });
  const page = doc.pages[0];
  if (!page) throw new Error("Expected a generated CAD page.");
  expect(doc.elements).toHaveLength(20_000);
  const start = performance.now();
  const model = buildCadCaptureModel(doc.elements, page.id);
  const elapsed = performance.now() - start;
  console.log(`CAD capture scene, 20,000 elements: ${elapsed.toFixed(1)} ms`);
  expect(elapsed).toBeLessThan(1_000);
  expect(model.tools).toHaveLength(1_000);
  expect(model.bodies).toHaveLength(1_000);
  expect(model.sketches).toBe(1_000);
  expect(model.errors).toEqual(checkCadPage(doc.elements, page.id).errors);
  expect(model.errors).toEqual([]);
});

function perforated(count: number): Element[] {
  const holes = Array.from({ length: count }, (_, i) =>
    circle(
      `perforation-${i}`,
      "profile",
      [(i % 50) * 3 + 2, Math.floor(i / 50) * 3 + 2],
      0.5,
    ),
  );
  return [
    ...holes,
    ...rectangle("profile", 0, 0, 151, Math.ceil(count / 50) * 3 + 1),
  ];
}

// Original implementation retained as a selection oracle.
function loopBounds({ points }: CadLoop) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < points.length; i += 2) {
    const x = coordinate(points, i);
    const y = coordinate(points, i + 1);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function containsPoint(
  points: readonly number[],
  x: number,
  y: number,
): boolean {
  let inside = false;
  let ax = coordinate(points, points.length - 2);
  let ay = coordinate(points, points.length - 1);
  for (let i = 0; i < points.length; i += 2) {
    const bx = coordinate(points, i);
    const by = coordinate(points, i + 1);
    if (ay > y !== by > y && x < ax + ((bx - ax) * (y - ay)) / (by - ay))
      inside = !inside;
    ax = bx;
    ay = by;
  }
  return inside;
}

function oracleNormalise(loops: readonly CadLoop[]): readonly CadLoop[] {
  // Disjoint profiles already describe the same region by either rule.
  if (loops.every(({ depth }) => depth === 0)) return loops;
  const candidates = loops.map((loop) => ({ loop, ...loopBounds(loop) }));
  return loops.filter(({ points, depth }) => {
    if (depth === 0) return true;
    const x = coordinate(points, 0);
    const y = coordinate(points, 1);
    let ancestorDepth = -1;
    for (const { loop, minX, minY, maxX, maxY } of candidates) {
      if (
        loop.depth < depth &&
        loop.depth > ancestorDepth &&
        x >= minX &&
        x <= maxX &&
        y >= minY &&
        y <= maxY &&
        containsPoint(loop.points, x, y)
      ) {
        ancestorDepth = loop.depth;
        if (ancestorDepth === depth - 1) break;
      }
    }
    return (depth - ancestorDepth) % 2 === 1;
  });
}

test("normalisation probes scale linearly for perforated plates", () => {
  const counts: number[] = [];
  for (const n of [500, 1000, 2000]) {
    const loops = selectedLoops(perforated(n));
    const stats = { ancestorProbes: 0 };
    normaliseToolLoops(loops, stats);
    counts.push(stats.ancestorProbes);
    expect(stats.ancestorProbes).toBeGreaterThanOrEqual(n);
    expect(stats.ancestorProbes).toBeLessThanOrEqual(n + 2);
  }
  expect(counts[1] ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    (counts[0] ?? 0) * 2.2,
  );
  expect(counts[2] ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    (counts[1] ?? 0) * 2.2,
  );
});

function indexedLoop(points: number[], depth: number): CadLoop {
  return { points, depth, sources: [], reversed: [], members: [] };
}

function indexedSceneBytes(loops: readonly CadLoop[]): Uint8Array {
  return writeCaptureScene(
    {
      bodies: [],
      tools: [
        {
          kind: "prism",
          feature: "fixture",
          frame: { o: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] },
          t0: 0,
          t1: 1,
          loops: loops.map(({ points }) => ({
            points: new Float64Array(points),
            faces: new Uint32Array(points.length / 2),
          })),
        },
      ],
    },
    {
      width: 64,
      height: 64,
      supersample: 1,
      camera: {
        right: [1, 0, 0],
        up: [0, 1, 0],
        forward: [0, 0, -1],
        centre: [0, 0, 0],
        mmPerPixel: 1,
        view: "top",
      },
      colours: CAPTURE_THEMES.light,
      referenceOpacity: 0.5,
      interference: null,
    },
  );
}

function checkIndexedLoops(loops: CadLoop[]) {
  const stats = { ancestorProbes: 0, indexEntries: 0 };
  const actual = normaliseToolLoops(loops, stats);
  const expected = oracleNormalise(loops);
  expect(actual.length).toBe(loops.length);
  expect(actual.length).toBe(expected.length);
  actual.forEach((loop, i) => expect(loop).toBe(expected[i]));
  expect(indexedSceneBytes(actual)).toEqual(indexedSceneBytes(expected));
  return stats;
}

function rectangleLoop(
  x: number,
  y: number,
  size: number,
  depth: number,
): CadLoop {
  return indexedLoop(
    [x, y, x + size, y, x + size, y + size, x, y + size],
    depth,
  );
}

function stripLoop(i: number): CadLoop {
  const s = i * 0.01;
  return indexedLoop(
    [0, s, 1000, 1000 + s, 1000, 1000 + s + 0.005, 0, s + 0.005],
    0,
  );
}

test("normalisation indexes rings, diagonal strips and mixed bounds", () => {
  for (const layout of ["square", "row"] as const) {
    let previous = { ancestorProbes: 0, indexEntries: 0 };
    for (const n of [500, 1000, 2000]) {
      const loops: CadLoop[] = [];
      for (let i = 0; i < n; i++) {
        const x = (layout === "row" ? i : i % 50) * 4;
        const y = layout === "row" ? 0 : Math.floor(i / 50) * 4;
        loops.push(
          rectangleLoop(x, y, 3, 0),
          rectangleLoop(x + 1, y + 1, 1, 1),
        );
      }
      const stats = checkIndexedLoops(loops);
      if (previous.ancestorProbes) {
        expect(stats.ancestorProbes).toBeLessThanOrEqual(
          previous.ancestorProbes * 2.5,
        );
        expect(stats.indexEntries).toBeLessThanOrEqual(
          previous.indexEntries * 2.5,
        );
      }
      console.log(`rings ${layout} ${n}: ${JSON.stringify(stats)}`);
      previous = stats;
    }
  }
  let previousWork = 0;
  for (const n of [1200, 2400, 4800]) {
    const loops = Array.from({ length: n }, (_, i) => stripLoop(i));
    loops.push(indexedLoop([1, 1.001, 2, 2.001, 2, 2.004, 1, 1.004], 1));
    const stats = checkIndexedLoops(loops);
    expect(stats.indexEntries).toBeLessThanOrEqual(17 * n);
    const work = stats.indexEntries + stats.ancestorProbes;
    if (previousWork) expect(work).toBeLessThanOrEqual(previousWork * 2.5);
    console.log(`strips ${n}: ${JSON.stringify(stats)}`);
    previousWork = work;
  }
  for (const n of [500, 1000, 2000]) {
    const loops = [
      rectangleLoop(500, 0, 4, 0),
      ...Array.from({ length: n }, (_, i) => stripLoop(i)),
    ];
    for (let i = 0; i < n; i++)
      loops.push(
        rectangleLoop(
          500.01 + (i % 50) * 0.07,
          0.01 + Math.floor(i / 50) * 0.07,
          0.02,
          1,
        ),
      );
    const stats = checkIndexedLoops(loops);
    expect(stats.ancestorProbes).toBe(n);
    expect(stats.indexEntries).toBeLessThanOrEqual(17 * (2 * n + 1));
    console.log(`mixed ${n}: ${JSON.stringify(stats)}`);
  }
});

test("normalisation preserves oracle identities and order across selections", () => {
  const entities = perforated(5);
  const selections = [
    selectedLoops(entities),
    selectedLoops(
      entities,
      entities.slice(0, 5).map(({ id }) => id),
    ),
    selectedLoops(
      entities,
      entities.filter(({ id }) => id !== "perforation-0").map(({ id }) => id),
    ),
  ];
  const nested = [...outer, hole, island, well];
  const ids = [outerId, hole.id, island.id, well.id];
  selections.push(selectedLoops(nested));
  for (const id of ids)
    selections.push(
      selectedLoops(
        nested,
        ids.filter((item) => item !== id),
      ),
    );
  for (const selected of selections) {
    const expected = oracleNormalise(selected);
    const actual = normaliseToolLoops(selected);
    expect(actual).toHaveLength(expected.length);
    actual.forEach((loop, i) => expect(loop).toBe(expected[i]));
  }
});

test("perforated plate capture preserves NCS1 bytes", () => {
  const model = buildCadCaptureModel(
    [
      sketch("profile", "a1"),
      ...perforated(20),
      extrude("plate", "a2", { sketch: "profile", distance: 5, op: "new" }),
    ],
    CAD_TEST_PAGE.id,
  );
  const bytes = writeCaptureScene(model, {
    width: 64,
    height: 128,
    supersample: 2,
    camera: {
      right: [1, 0, 0],
      up: [0, 1, 0],
      forward: [0, 0, -1],
      centre: [1, 2, 0],
      mmPerPixel: 0.5,
      view: "top",
    },
    colours: CAPTURE_THEMES.light,
    referenceOpacity: 0.5,
    interference: null,
  });
  const digest = createHash("sha256").update(bytes).digest("hex");
  console.log(`perforated digest: ${digest}`);
  expect(digest).toBe(
    "f66e95cd114f0cb905c75c6382dd9795d435bc745d85545aa7a70c994177c531",
  );
});

test("targeted mesh eligibility rejects the entire shared cut", async () => {
  for (const [fixture, eligible] of [
    ["triangle", false],
    ["tetrahedron-mixed", false],
    ["double-sided-triangle", false],
    ["coplanar-tetrahedron", false],
    ["translated-flat-shell", false],
    ["tetrahedron", true],
    ["tetrahedron-reversed", true],
    ["thin-bar", true],
    ["translated-thin-bar", true],
  ] as const) {
    const data = (
      await Bun.file(
        new URL(
          `../../../../crates/capture/tests/fixtures/${fixture}.nmesh.txt`,
          import.meta.url,
        ),
      ).text()
    ).trim();
    const cut = extrude("cut", "a5", {
      sketch: "opening",
      distance: 5,
      op: "cut",
      bodies: ["block", "mesh"],
    });
    const elements = [
      sketch("base", "a1"),
      ...rectangle("base", 0, 0, 10, 10),
      extrude("block", "a2", { sketch: "base", distance: 5, op: "new" }),
      cadElement("mesh", "cad.mesh", "a3", { name: fixture, data }),
      sketch("opening", "a4"),
      ...rectangle("opening", 2, 2, 2, 3),
      cut,
      sketch("face", "a6", { face: { feature: "cut", role: "end" } }),
    ];
    const options = { decodeMesh: decodeCaptureMeshWith };
    const model = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, options);
    expect(model.errors).toEqual(
      eligible
        ? []
        : [
            { id: "cut", code: "cad.body.missing" },
            { id: "face", code: "cad.reference.failed" },
          ],
    );
    expect(
      model.bodies.map((body) => body.steps.map((step) => step.op)),
    ).toEqual(
      eligible
        ? [
            ["union", "difference"],
            ["union", "difference"],
          ]
        : [["union"], ["union"]],
    );
    if (!eligible) {
      const suppressed = elements.map((element) =>
        element.id === "cut"
          ? { ...cut, semantic: { ...cut.semantic, suppressed: true } }
          : element,
      );
      const twin = buildCadCaptureModel(suppressed, CAD_TEST_PAGE.id, options);
      const request = {
        width: 320,
        height: 240,
        theme: "dark",
        camera: { view: "iso" },
        ...options,
      } as const;
      expect(
        prepareCadCapture(elements, CAD_TEST_PAGE.id, request).scene,
      ).toEqual(prepareCadCapture(suppressed, CAD_TEST_PAGE.id, request).scene);
      expect(twin.bodies).toHaveLength(2);
    }
  }
});

test("point overflow switches the remaining construction walk to metadata", async () => {
  const triangle = (
    await Bun.file(
      new URL(
        "../../../../crates/capture/tests/fixtures/triangle.nmesh.txt",
        import.meta.url,
      ),
    ).text()
  ).trim();
  const tetrahedron = (
    await Bun.file(
      new URL(
        "../../../../crates/capture/tests/fixtures/tetrahedron.nmesh.txt",
        import.meta.url,
      ),
    ).text()
  ).trim();
  const seed = cadElement("seed", "cad.mesh", "a1", {
    name: "Seed",
    data: tetrahedron,
  });
  const target = cadElement("target", "cad.mesh", "d1", {
    name: "Target",
    data: triangle,
  });
  const elements = [
    seed,
    sketch("tail-profile", "b1"),
    ...rectangle("tail-profile", 0, 0, 2, 2),
    ...Array.from({ length: 1001 }, (_, i) =>
      extrude(`tail-${i}`, `c${String(i).padStart(4, "0")}1`, {
        sketch: "tail-profile",
        distance: 1,
        op: "new",
      }),
    ),
    target,
    extrude("target-cut", "e1", {
      sketch: "tail-profile",
      distance: 1,
      op: "cut",
      bodies: ["target"],
    }),
  ];
  const allocations: string[] = [];
  const limits: number[] = [];
  const decodeMesh: Parameters<typeof buildCadCaptureModel>[2]["decodeMesh"] = (
    data,
    options,
  ) => {
    limits.push(options.maxVertices ?? -1);
    if (data === tetrahedron)
      return {
        vertexCount: 3_999_999,
        triangleCount: 1,
        bounds: { min: [0, 0, 0], max: [1, 1, 1] },
        positions: new Float64Array(3),
        triangles: new Uint32Array(3),
      };
    return decodeCaptureMeshWith(data, {
      ...options,
      onAllocate: (kind) => allocations.push(kind),
    });
  };
  const stats = { captureVisits: 0, toolArrays: 0, metadataVisits: 0 };
  const model = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, {
    decodeMesh,
    stats,
  });
  expect(model.overLimit).toBe(
    "Capture scene total point count must be an integer in 0..4000000.",
  );
  expect(stats).toEqual({
    captureVisits: 2,
    toolArrays: 1,
    metadataVisits: 1001,
  });
  expect(limits).toEqual([4_000_000, 0]);
  expect(allocations.length).toBeGreaterThan(0);
  expect(new Set(allocations)).toEqual(new Set(["target"]));
  expect(model.errors).toContainEqual({
    id: "target-cut",
    code: "cad.body.missing",
  });
  const admitted = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, {
    decodeMesh: decodeCaptureMeshWith,
  });
  expect(admitted.overLimit).toBeUndefined();
  expect(model.errors.filter(({ id }) => id === "target-cut")).toEqual(
    admitted.errors.filter(({ id }) => id === "target-cut"),
  );
  expect(model.bodies.some(({ id }) => id === "tail-1000")).toBe(true);

  const request = {
    width: 320,
    height: 240,
    theme: "dark",
    camera: { view: "iso" },
    decodeMesh,
  } as const;
  expect(() =>
    prepareCadCapture(elements, CAD_TEST_PAGE.id, {
      ...request,
      interference: { cellMm: 0.25, bodies: ["unknown", "tail-1000"] },
    }),
  ).toThrow('Body query "unknown" is unknown or ambiguous');
  expect(() =>
    prepareCadCapture(elements, CAD_TEST_PAGE.id, {
      ...request,
      interference: { cellMm: 0.25, bodies: ["Seed", "tail-1000"] },
    }),
  ).toThrow(
    "Capture scene total point count must be an integer in 0..4000000.",
  );
});

test("overflowing and subsequent untargeted meshes allocate no geometry", async () => {
  const fixture = async (name: string) =>
    (
      await Bun.file(
        new URL(
          `../../../../crates/capture/tests/fixtures/${name}.nmesh.txt`,
          import.meta.url,
        ),
      ).text()
    ).trim();
  const seedData = await fixture("tetrahedron");
  const triangle = await fixture("triangle");
  const allocations: string[] = [];
  const limits: number[] = [];
  const decodeMesh: Parameters<typeof buildCadCaptureModel>[2]["decodeMesh"] = (
    data,
    options,
  ) => {
    limits.push(options.maxVertices ?? -1);
    if (data === seedData)
      return {
        vertexCount: 3_999_999,
        triangleCount: 1,
        bounds: { min: [0, 0, 0], max: [1, 1, 1] },
        positions: new Float64Array(3),
        triangles: new Uint32Array(3),
      };
    return decodeCaptureMeshWith(data, {
      ...options,
      onAllocate: (kind) => allocations.push(kind),
    });
  };
  const elements = [
    cadElement("seed", "cad.mesh", "a1", { name: "Seed", data: seedData }),
    cadElement("overflow", "cad.mesh", "a2", {
      name: "Overflow",
      data: triangle,
    }),
    cadElement("sentinel", "cad.mesh", "a3", {
      name: "Sentinel",
      data: triangle,
    }),
  ];
  const stats = { captureVisits: 0, toolArrays: 0, metadataVisits: 0 };
  const model = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, {
    decodeMesh,
    stats,
  });
  expect(model.overLimit).toBe(
    "Capture scene total point count must be an integer in 0..4000000.",
  );
  expect(stats).toEqual({ captureVisits: 2, toolArrays: 1, metadataVisits: 1 });
  expect(limits).toEqual([4_000_000, 1, 0]);
  expect(allocations).toEqual([]);
  expect(model.bodies.map(({ id }) => id)).toEqual([
    "seed",
    "overflow",
    "sentinel",
  ]);

  const hidden = elements.map((element) => ({
    ...element,
    visual: { hidden: true },
  }));
  expect(() =>
    prepareCadCapture(hidden, CAD_TEST_PAGE.id, {
      width: 320,
      height: 240,
      theme: "dark",
      camera: { view: "iso" },
      decodeMesh,
    }),
  ).toThrow("has no solid body yet (0 sketches, 0 features failed)");
});

test("exactly four million points retain the original NCS1 bytes", () => {
  const point = (index: number): CadXY => {
    const i = index % 2000;
    if (i < 500) return [i, 0];
    if (i < 1000) return [500, i - 500];
    if (i < 1500) return [1500 - i, 500];
    return [0, 2000 - i];
  };
  const elements = [
    sketch("large-profile", "a1"),
    ...Array.from({ length: 2000 }, (_, i) =>
      cadElement(`edge-${i}`, "cad.line", "a1", {
        sketch: "large-profile",
        a: point(i),
        b: point(i + 1),
      }),
    ),
    ...Array.from({ length: 2000 }, (_, i) =>
      extrude(`solid-${i}`, `b${String(i).padStart(5, "0")}`, {
        sketch: "large-profile",
        distance: 1,
        op: "new",
      }),
    ),
  ];
  const stats = { captureVisits: 0, toolArrays: 0, metadataVisits: 0 };
  const model = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, { stats });
  expect(model.errors).toEqual([]);
  expect(model.tools).toHaveLength(2000);
  expect(
    model.tools.reduce(
      (sum, tool) =>
        sum +
        (tool.kind === "prism"
          ? tool.loops.reduce((n, loop) => n + loop.points.length / 2, 0)
          : tool.positions.length / 3),
      0,
    ),
  ).toBe(4_000_000);
  expect(stats.metadataVisits).toBe(0);
  const bytes = writeCaptureScene(model, {
    width: 64,
    height: 128,
    supersample: 2,
    camera: {
      right: [1, 0, 0],
      up: [0, 1, 0],
      forward: [0, 0, -1],
      centre: [1, 2, 0],
      mmPerPixel: 0.5,
      view: "top",
    },
    colours: CAPTURE_THEMES.light,
    referenceOpacity: 0.5,
    interference: null,
  });
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "82d5ae99cce242a6503702b85e0e508cb2a1ff6b5b5a644f07d31907f43933b3",
  );
});

test("shared cuts retain hidden target history without affecting visible bounds", () => {
  const fixture = (targets: string[]) => [
    sketch("wide-sketch", "a1"),
    ...rectangle("wide-sketch", 0, 0, 20, 10),
    extrude("wide", "a2", { sketch: "wide-sketch", distance: 4, op: "new" }),
    sketch("hidden-sketch", "a3"),
    ...rectangle("hidden-sketch", 1, 1, 2, 2),
    {
      ...extrude("hidden", "a4", {
        sketch: "hidden-sketch",
        distance: 4,
        op: "new",
      }),
      visual: { hidden: true },
    },
    sketch("trim-sketch", "a5"),
    ...rectangle("trim-sketch", 0, 0, 5, 10),
    extrude("trim", "a6", {
      sketch: "trim-sketch",
      distance: 4,
      op: "cut",
      bodies: targets,
    }),
  ];
  const request = {
    width: 64,
    height: 64,
    theme: "light" as const,
    camera: { view: "top" as const },
    interference: null,
  };
  const shared = prepareCadCapture(
    fixture(["wide", "hidden"]),
    CAD_TEST_PAGE.id,
    request,
  );
  const control = prepareCadCapture(
    fixture(["wide"]),
    CAD_TEST_PAGE.id,
    request,
  );
  expect(shared.model.bodies.map(({ id }) => id)).toEqual(["wide"]);
  expect(shared.model.hiddenTargets).toEqual([
    {
      id: "hidden",
      steps: [
        { op: "union", tool: 1 },
        { op: "difference", tool: 2 },
      ],
    },
  ]);
  expect(control.model.hiddenTargets).toEqual([]);
  expect(shared.model.bounds).toEqual(control.model.bounds);
  expect(shared.scene).not.toEqual(control.scene);
  expect(new DataView(control.scene.buffer).getUint32(36, true)).toBe(0);
  expect(shared.scene.length).toBe(control.scene.length + 24);
});
