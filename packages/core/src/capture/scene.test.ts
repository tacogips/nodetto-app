import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  canonicalize,
  decodeCaptureMeshWith,
  encodeNmesh,
  toInline,
} from "@nodetto/io/nmesh";
import { readStl, writeBinaryStl } from "@nodetto/io/stl";
import type { CadXY, Element, PageId } from "@nodetto/ir";
import { checkCadPage } from "../cad/check.ts";
import { collectCadInput } from "../cad/engine.ts";
import { pcbBoardOutline } from "../cad/pcb-outline.ts";
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
import {
  boardReference,
  edge,
  PCB_TEST_PAGE,
  testBoard,
} from "../cad/testing/pcb.ts";
import { coordinate } from "../cad/vec.ts";
import { compareFractional } from "../fractional.ts";
import { prepareCadCapture } from "./cad-request.ts";
import {
  buildCadCaptureModel,
  CAPTURE_THEMES,
  normaliseToolLoops,
  PROFILE_CACHE_MIN_WORK,
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
function loopBounds(points: readonly number[]) {
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
    const cross =
      (BigInt(bx) - BigInt(ax)) * (BigInt(y) - BigInt(ay)) -
      (BigInt(by) - BigInt(ay)) * (BigInt(x) - BigInt(ax));
    if (ay > y !== by > y && cross > 0n === by > ay) inside = !inside;
    ax = bx;
    ay = by;
  }
  return inside;
}

function oracleNormalise(loops: readonly CadLoop[]): readonly CadLoop[] {
  // Disjoint profiles already describe the same region by either rule.
  if (loops.every(({ depth }) => depth === 0)) return loops;
  const candidates = loops.map((loop) => {
    const grid = loop.points.map((v) => Math.round(v * 1_000_000));
    return { loop, grid, ...loopBounds(grid) };
  });
  return candidates
    .filter(({ loop, grid }) => {
      const { depth } = loop;
      if (depth === 0) return true;
      const x = coordinate(grid, 0);
      const y = coordinate(grid, 1);
      let ancestorDepth = -1;
      for (const {
        loop,
        grid: candidateGrid,
        minX,
        minY,
        maxX,
        maxY,
      } of candidates) {
        if (
          loop.depth < depth &&
          loop.depth > ancestorDepth &&
          x >= minX &&
          x <= maxX &&
          y >= minY &&
          y <= maxY &&
          containsPoint(candidateGrid, x, y)
        ) {
          ancestorDepth = loop.depth;
          if (ancestorDepth === depth - 1) break;
        }
      }
      return (depth - ancestorDepth) % 2 === 1;
    })
    .map(({ loop }) => loop);
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
  return sceneBytesOfPoints(loops.map(({ points }) => points));
}

function sceneBytesOfPoints(
  points: readonly (readonly number[])[],
): Uint8Array {
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
          loops: points.map((points) => ({
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

test("normalisation queries the detailed rim through one edge index", () => {
  let previous = 0;
  for (const h of [256, 512, 1024]) {
    const entities: Element[] = [];
    const top = (i: number): CadXY => [(256 * i) / h, i % 2 === 0 ? 512 : 513];
    for (let i = 0; i < h; i += 1) {
      entities.push(
        cadElement(`rim-${i}`, "cad.line", "a1", {
          sketch: "profile",
          a: top(i),
          b: top(i + 1),
        }),
      );
    }
    const sides: [CadXY, CadXY][] = [
      [top(h), [256, 0]],
      [
        [256, 0],
        [0, 0],
      ],
      [[0, 0], top(0)],
    ];
    for (const [i, [a, b]] of sides.entries()) {
      entities.push(
        cadElement(`side-${i}`, "cad.line", "a1", { sketch: "profile", a, b }),
      );
    }
    for (let k = 0; k < h; k += 1) {
      entities.push(
        circle(
          `hole-${k}`,
          "profile",
          [2.5 + 3 * (k % 64), 2.5 + 3 * Math.floor(k / 64)],
          1,
        ),
      );
    }
    const loops = selectedLoops(entities);
    const stats = {
      ancestorProbes: 0,
      indexEntries: 0,
      edges: { builds: 0, visits: 0, inspections: 0 },
    };
    const actual = normaliseToolLoops(loops, stats);
    const expected = oracleNormalise(loops);
    expect(actual.length).toBe(expected.length);
    actual.forEach((loop, i) => expect(loop).toBe(expected[i]));
    expect(indexedSceneBytes(actual)).toEqual(indexedSceneBytes(expected));
    const { builds, visits, inspections } = stats.edges;
    console.log(
      `detailed rim ${h}: builds=${builds} visits=${visits} inspections=${inspections}`,
    );
    expect(builds).toBeGreaterThan(0);
    expect(visits).toBeGreaterThan(0);
    expect(inspections).toBeGreaterThan(0);
    expect(builds).toBeLessThanOrEqual(
      loops.reduce((sum, loop) => sum + loop.points.length / 2, 0),
    );
    expect(inspections).toBeLessThanOrEqual(4 * h);
    const total = builds + visits + inspections;
    if (previous) expect(total).toBeLessThanOrEqual(previous * 2.5);
    previous = total;
  }
});

test("capture keeps a sloped-rim triangular hole decided on the nanometre grid", () => {
  const rim: CadXY[] = [
    [970, 0],
    [1000, 0],
    [1100.000003, 100.000001],
    [970, 100.000001],
  ];
  const hole: CadXY[] = [
    [1050.000002, 50.000001],
    [1010, 65],
    [1000, 35],
  ];
  const lines = (prefix: string, points: CadXY[]) =>
    points.map((a, i) =>
      cadElement(`${prefix}-${i}`, "cad.line", "a1", {
        sketch: "tri",
        a,
        b: points[(i + 1) % points.length],
      }),
    );
  const capture = (triangle: CadXY[]) =>
    prepareCadCapture(
      [
        sketch("tri", "a1"),
        ...lines("rim", rim),
        ...lines("hole", triangle),
        extrude("plate", "a2", { sketch: "tri", distance: 5, op: "new" }),
      ],
      CAD_TEST_PAGE.id,
      {
        width: 256,
        height: 256,
        theme: "light",
        camera: { view: "top" },
        interference: null,
      },
    );
  const determinant =
    (1100000003n - 1000000000n) * 50000001n -
    100000001n * (1050000002n - 1000000000n);
  expect(determinant).toBe(1n);
  const control = capture([]);
  for (const triangle of [hole, [...hole.slice(1), ...hole.slice(0, 1)]]) {
    const result = capture(triangle);
    const tool = result.model.tools[0];
    expect(tool?.kind).toBe("prism");
    if (!tool || tool.kind !== "prism") throw new Error("expected prism");
    expect(tool.loops.map((loop) => loop.points.length / 2)).toEqual([3, 4]);
    expect(result.scene).not.toEqual(control.scene);
  }
});

test("normalisation resolves slotted-rim holes without scanning crossings behind the ray", () => {
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
            cadElement(
              k === 0
                ? `a${String(j).padStart(5, "0")}`
                : `h${String(k - 1).padStart(5, "0")}-${j}`,
              "cad.line",
              "a1",
              { sketch: "profile", a, b },
            ),
          );
        }
        const ordered = mirrored
          ? [transformed[0], ...transformed.slice(1).reverse()]
          : transformed;
        return ordered.flatMap((point) => point ?? []);
      });
      const loops = selectedLoops(entities);
      const stats = {
        ancestorProbes: 0,
        indexEntries: 0,
        edges: { builds: 0, visits: 0, inspections: 0, bulk: 0 },
      };
      const actual = normaliseToolLoops(loops, stats);
      const oracle = oracleNormalise(loops);
      expect(actual.map((loop) => [...loop.points])).toEqual(expected);
      expect(indexedSceneBytes(actual)).toEqual(sceneBytesOfPoints(expected));
      expect(actual.length).toBe(oracle.length);
      actual.forEach((loop, i) => expect(loop).toBe(oracle[i]));
      const q = stats.edges.visits + stats.edges.bulk + stats.edges.inspections;
      counts.push(q);
      console.log(
        "scene slotted rim",
        JSON.stringify({ mirrored, slots, holes, ...stats.edges, q }),
      );
      expect(q).toBeLessThanOrEqual(16 * holes * Math.log2(4 * slots + 4));
      expect(stats.edges.builds).toBeLessThanOrEqual(
        loops.reduce((sum, loop) => sum + loop.points.length / 2, 0),
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

test("a sparse nested-chain selection keeps the 400-byte outer prism", () => {
  const n = 1025;
  const size = 2 * n + 2;
  const elements: Element[] = [sketch("chain", "a1")];
  for (let i = 0; i < n; i++) {
    const vertices: CadXY[] = [
      [i, i],
      [size - i, i],
      [size - i, size - i],
      [i, size - i],
    ];
    for (let j = 0; j < 4; j++) {
      elements.push(
        cadElement(`r${String(i).padStart(5, "0")}-${j}`, "cad.line", "a1", {
          sketch: "chain",
          a: vertices[j],
          b: vertices[(j + 1) % 4],
        }),
      );
    }
  }
  elements.push(
    extrude("chain-solid", "a2", {
      sketch: "chain",
      loops: ["r00000-0", "r01024-0"],
      distance: 1,
      op: "new",
    }),
  );
  const result = prepareCadCapture(elements, CAD_TEST_PAGE.id, {
    width: 256,
    height: 256,
    theme: "light",
    camera: { view: "top" },
    interference: null,
  });
  expect(result.scene.length).toBe(400);
  const tool = result.model.tools[0];
  if (!tool || tool.kind !== "prism") throw new Error("expected prism");
  expect(tool.loops.map((loop) => Array.from(loop.points))).toEqual([
    [0, 0, size, 0, size, size, 0, size],
  ]);
});

interface AncestryFixture {
  entities: Element[];
  selected: string[];
  elements: Element[];
}

function ancestryFixture(
  shape: "deep" | "shallow",
  n: number,
  outer = false,
): AncestryFixture {
  const entities: Element[] = [];
  const selected: string[] = [];
  const polygon = (id: string, points: CadXY[], pick: boolean) => {
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (!a || !b) throw new Error("Missing fixture vertex");
      entities.push(
        cadElement(`${id}-${i}`, "cad.line", "a1", {
          sketch: "ancestry",
          a,
          b,
        }),
      );
    }
    if (pick) selected.push(`${id}-0`);
  };
  const square = (
    id: string,
    x: number,
    y: number,
    size: number,
    pick: boolean,
  ) =>
    polygon(
      id,
      [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
      ],
      pick,
    );
  if (shape === "deep") {
    const size = 2 * n + 70;
    for (let i = 0; i < n; i++)
      square(`rim-${i}`, i, i, size - 2 * i, outer && i === 0);
    for (let i = 0; i < n; i++)
      square(
        `island-${i}`,
        n + 2 + 2 * (i % 32),
        n + 2 + 2 * Math.floor(i / 32),
        1,
        true,
      );
  } else {
    for (let i = 0; i < n; i++) {
      const y = i * 2;
      polygon(
        `rim-${i}`,
        [
          [0, y],
          [1000, y + 1000],
          [1000, y + 1001],
          [0, y + 1],
        ],
        true,
      );
      square(`hole-${i}`, 500, y + 500.5, 0.125, true);
    }
  }
  return {
    entities,
    selected,
    elements: [
      sketch("ancestry", "a1"),
      ...entities,
      extrude("solid", "a2", {
        sketch: "ancestry",
        loops: selected,
        distance: 5,
        op: "new",
      }),
    ],
  };
}

function ancestryStats() {
  return {
    ancestorProbes: 0,
    indexEntries: 0,
    depthLookups: 0,
    forestFallbacks: 0,
    edges: { builds: 0, visits: 0, inspections: 0, bulk: 0 },
    forest: { events: 0, steps: 0 },
  };
}

function ancestryWork(stats: ReturnType<typeof ancestryStats>): number {
  const { edges, forest } = stats;
  return (
    stats.ancestorProbes +
    stats.indexEntries +
    stats.depthLookups +
    edges.builds +
    edges.visits +
    edges.inspections +
    edges.bulk +
    forest.events +
    forest.steps
  );
}

function checkAncestryFixture(fixture: AncestryFixture) {
  const ancestry = ancestryStats();
  const model = buildCadCaptureModel(fixture.elements, CAD_TEST_PAGE.id, {
    stats: { captureVisits: 0, toolArrays: 0, metadataVisits: 0, ancestry },
  });
  expect(model.errors).toEqual([]);
  expect(ancestry.forestFallbacks).toBeGreaterThanOrEqual(1);
  const request = {
    width: 256,
    height: 256,
    theme: "light" as const,
    camera: { view: "top" as const },
    interference: null,
  };
  const capture = prepareCadCapture(
    fixture.elements,
    CAD_TEST_PAGE.id,
    request,
  );
  const oracle = oracleNormalise(
    selectedLoops(fixture.entities, fixture.selected),
  );
  const sourceFaces = new Map<string, number>();
  const oracleLoops = oracle.map(({ points, sources }) => ({
    points: new Float64Array(points),
    faces: new Uint32Array(
      sources.map((source) => {
        let face = sourceFaces.get(source);
        if (face === undefined) {
          face = 2 + sourceFaces.size;
          sourceFaces.set(source, face);
        }
        return face;
      }),
    ),
  }));
  const expected = {
    ...capture.model,
    tools: capture.model.tools.map((tool) =>
      tool.kind === "prism" ? { ...tool, loops: oracleLoops } : tool,
    ),
  };
  expect(capture.scene).toEqual(
    writeCaptureScene(expected, {
      width: request.width,
      height: request.height,
      supersample: 2,
      camera: capture.camera,
      colours: CAPTURE_THEMES[request.theme],
      referenceOpacity: 0.45,
      interference: null,
    }),
  );
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const loop of oracle) {
    const bounds = loopBounds(loop.points);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }
  expect(capture.model.bodies.map(({ bounds }) => bounds)).toEqual([
    { min: [minX, minY, 0], max: [maxX, maxY, 5] },
  ]);
  return ancestryWork(ancestry);
}

test("capture ancestry work stays bounded for omitted deep and shallow selections", () => {
  for (const [shape, sizes] of [
    ["deep", [256, 512, 1024]],
    ["shallow", [1024, 2048]],
  ] as const) {
    let previous = 0;
    for (const n of sizes) {
      const work = checkAncestryFixture(ancestryFixture(shape, n));
      console.log(`ancestry document ${shape} ${n}: ${work}`);
      if (previous) expect(work).toBeLessThanOrEqual(previous * 2.5);
      previous = work;
    }
  }
  checkAncestryFixture(ancestryFixture("deep", 256, true));
}, 120_000);

test("shallow raw ancestry work and ordinary baseline remain bounded", () => {
  let previous = 0;
  for (const n of [1024, 2048, 4096]) {
    const loops: CadLoop[] = [];
    for (let i = 0; i < n; i++) {
      const y = i * 2;
      loops.push(
        indexedLoop([0, y, 1000, y + 1000, 1000, y + 1001, 0, y + 1], 0),
      );
      loops.push(rectangleLoop(500, y + 500.5, 0.125, 1));
    }
    const stats = ancestryStats();
    const actual = normaliseToolLoops(loops, stats);
    expect(actual).toHaveLength(loops.length);
    expect(stats.forestFallbacks).toBeGreaterThanOrEqual(1);
    const work = ancestryWork(stats);
    console.log(`ancestry raw shallow ${n}: ${work}`);
    if (previous) expect(work).toBeLessThanOrEqual(previous * 2.5);
    previous = work;
  }
  const doc = generateCadDocument({ features: 500, entitiesPerSketch: 18 });
  const page = doc.pages[0];
  if (!page) throw new Error("Missing fixture page");
  const ancestry = ancestryStats();
  buildCadCaptureModel(doc.elements, page.id, {
    stats: { captureVisits: 0, toolArrays: 0, metadataVisits: 0, ancestry },
  });
  console.log(`ancestry ordinary: ${JSON.stringify(ancestry)}`);
  expect(ancestry.forestFallbacks).toBe(0);
  expect(ancestry.ancestorProbes).toBe(5000);
  expect(ancestry.indexEntries).toBe(5500);
}, 120_000);

function contactBox(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  crossed = false,
) {
  return {
    positions: Float64Array.of(
      x0,
      y0,
      0,
      x1,
      y0,
      0,
      x1,
      y1,
      0,
      x0,
      y1,
      0,
      x0,
      y0,
      5,
      x1,
      y0,
      5,
      x1,
      y1,
      5,
      x0,
      y1,
      5,
    ),
    triangles: Uint32Array.from([
      0,
      2,
      1,
      0,
      3,
      2,
      4,
      5,
      6,
      4,
      6,
      7,
      0,
      1,
      5,
      0,
      5,
      4,
      1,
      2,
      6,
      1,
      6,
      5,
      2,
      3,
      7,
      2,
      7,
      6,
      ...(crossed ? [3, 0, 7, 0, 4, 7] : [3, 0, 4, 3, 4, 7]),
    ]),
  };
}

test("touching shell cuts survive capture as a whole", () => {
  const a = contactBox(0, 10, 0, 10);
  const triangle = {
    positions: Float64Array.of(0, 0, 0, 10, 0, 0, 5, -2, 0),
    triangles: Uint32Array.of(0, 1, 2),
  };
  const cases = [
    ["edge", contactBox(10, 20, 10, 20), true],
    ["face", contactBox(10, 20, 0, 10), true],
    ["crossed", contactBox(10, 20, 0, 10, true), true],
    ["separated", contactBox(12, 22, 0, 10), true],
    ["open", triangle, false],
    ["overlap", contactBox(0, 6, 0, 6), false],
  ] as const;
  for (const [name, other, eligible] of cases) {
    const data = toInline(
      encodeNmesh(canonicalize(readStl(writeBinaryStl([a, other])))),
    );
    const uncut = [
      cadElement("mesh", "cad.mesh", "a0", { name, data }),
      sketch("base", "a1", { base: "xy", offset: 5 }),
      ...rectangle("base", 0, 0, 10, 10),
      extrude("plate", "a2", { sketch: "base", distance: 5, op: "new" }),
      sketch("opening", "a3"),
      ...rectangle("opening", 1, 1, 2, 2),
    ];
    const elements = [
      ...uncut,
      extrude("cut", "a4", {
        sketch: "opening",
        distance: 10,
        op: "cut",
        bodies: ["mesh", "plate"],
      }),
    ];
    const options = { decodeMesh: decodeCaptureMeshWith };
    const model = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, options);
    expect(
      model.errors.some((error) => error.code === "cad.body.missing"),
      name,
    ).toBe(!eligible);
    expect(
      model.bodies.map((body) => body.steps.at(-1)?.op),
      name,
    ).toEqual(eligible ? ["difference", "difference"] : ["union", "union"]);
    const request = {
      width: 320,
      height: 240,
      theme: "dark",
      camera: { view: "iso" },
      ...options,
    } as const;
    const bytes = prepareCadCapture(elements, CAD_TEST_PAGE.id, request).scene;
    const control = prepareCadCapture(uncut, CAD_TEST_PAGE.id, request).scene;
    if (eligible) expect(bytes, name).not.toEqual(control);
    else expect(bytes, name).toEqual(control);
  }
});

test("touching bracket with a second overlap stays display-only", () => {
  const outline = [
    [0, 0],
    [10, 0],
    [10, 2],
    [2, 2],
    [2, 5],
    [15, 5],
    [15, 1],
    [18, 1],
    [18, 7],
    [0, 7],
  ] as const;
  const tops = [
    [0, 1, 2],
    [0, 2, 3],
    [0, 3, 4],
    [0, 4, 9],
    [9, 4, 5],
    [9, 5, 8],
    [5, 6, 7],
    [5, 7, 8],
  ] as const;
  const positions = Float64Array.from(
    outline.flatMap(([x, y]) => [x, y, 0, x, y, 5]),
  );
  const triangles: number[] = [];
  for (const [a, b, c] of tops) {
    triangles.push(a * 2 + 1, b * 2 + 1, c * 2 + 1);
    triangles.push(c * 2, b * 2, a * 2);
  }
  for (let a = 0; a < outline.length; a++) {
    const b = (a + 1) % outline.length;
    triangles.push(a * 2, b * 2, b * 2 + 1, a * 2, b * 2 + 1, a * 2 + 1);
  }
  const bracket = { positions, triangles: Uint32Array.from(triangles) };
  for (const [name, crossed] of [
    ["A", true],
    ["B", false],
  ] as const) {
    const block = contactBox(10, 20, 0, 2, crossed);
    const data = toInline(
      encodeNmesh(canonicalize(readStl(writeBinaryStl([bracket, block])))),
    );
    const uncut = [
      cadElement("mesh", "cad.mesh", "a0", { name, data }),
      sketch("base", "a1", { base: "xy", offset: 5 }),
      ...rectangle("base", 0, 0, 10, 10),
      extrude("plate", "a2", { sketch: "base", distance: 5, op: "new" }),
      sketch("opening", "a3"),
      ...rectangle("opening", 1, 1, 2, 2),
    ];
    const elements = [
      ...uncut,
      extrude("cut", "a4", {
        sketch: "opening",
        distance: 10,
        op: "cut",
        bodies: ["mesh", "plate"],
      }),
    ];
    const options = { decodeMesh: decodeCaptureMeshWith };
    const model = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, options);
    expect(
      model.errors.some((error) => error.code === "cad.body.missing"),
      name,
    ).toBe(true);
    expect(
      model.bodies.map((body) => body.steps.at(-1)?.op),
      name,
    ).toEqual(["union", "union"]);
    const request = {
      width: 320,
      height: 240,
      theme: "dark",
      camera: { view: "iso" },
      ...options,
    } as const;
    expect(
      prepareCadCapture(elements, CAD_TEST_PAGE.id, request).scene,
      name,
    ).toEqual(prepareCadCapture(uncut, CAD_TEST_PAGE.id, request).scene);
  }
});

function profileCacheStats() {
  return {
    lookups: 0,
    admitted: 0,
    hits: 0,
    prepared: 0,
    maxDirectWork: 0,
    depthVisits: 0,
    pendingUpdates: 0,
  };
}

function sharedProfileRun(
  entities: Element[],
  selections: (string[] | undefined)[],
) {
  const elements = [
    sketch("ancestry", "a1"),
    ...entities,
    ...selections.map((loops, i) =>
      extrude(`shared-${i}`, `b${String(i).padStart(3, "0")}`, {
        sketch: "ancestry",
        distance: i + 1,
        op: "new",
        ...(loops === undefined ? {} : { loops }),
      }),
    ),
  ];
  const ancestry = ancestryStats();
  const profileCache = profileCacheStats();
  const model = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, {
    stats: {
      captureVisits: 0,
      toolArrays: 0,
      metadataVisits: 0,
      ancestry,
      profileCache,
    },
  });
  expect(model.errors).toEqual([]);
  expect(model.overLimit).toBeUndefined();
  return { elements, model, ancestry, profileCache };
}

function checkSharedOracle(
  run: ReturnType<typeof sharedProfileRun>,
  entities: Element[],
  selections: (string[] | undefined)[],
) {
  const request = {
    width: 256,
    height: 256,
    theme: "light" as const,
    camera: { view: "top" as const },
    interference: null,
  };
  const capture = prepareCadCapture(run.elements, CAD_TEST_PAGE.id, request);
  const tools = capture.model.tools.map((tool, i) => {
    if (tool.kind !== "prism") throw new Error("Expected prism");
    const sourceFaces = new Map<string, number>();
    const loops = oracleNormalise(selectedLoops(entities, selections[i])).map(
      ({ points, sources }) => ({
        points: new Float64Array(points),
        faces: new Uint32Array(
          sources.map((source) => {
            let face = sourceFaces.get(source);
            if (face === undefined) {
              face = 2 + sourceFaces.size;
              sourceFaces.set(source, face);
            }
            return face;
          }),
        ),
      }),
    );
    return { ...tool, loops };
  });
  expect(capture.scene).toEqual(
    writeCaptureScene(
      { ...capture.model, tools },
      {
        width: request.width,
        height: request.height,
        supersample: 2,
        camera: capture.camera,
        colours: CAPTURE_THEMES[request.theme],
        referenceOpacity: 0.45,
        interference: null,
      },
    ),
  );
  for (let i = 0; i < selections.length; i++) {
    expect(capture.model.bodies[i]?.bounds.max[2]).toBe(i + 1);
    expect(capture.model.bodies[i]?.bounds.min[2]).toBe(0);
  }
}

function depthZeroGrid(n: number) {
  return Array.from({ length: n }, (_, i) =>
    circle(`c${i}`, "ancestry", [3 * (i % 64), 3 * Math.floor(i / 64)], 1),
  );
}

test("depth-zero whole profiles admit single and cumulative work", () => {
  const largeEntities = depthZeroGrid(4096);
  const two = Array(2).fill(undefined);
  const large = sharedProfileRun(largeEntities, two);
  expect(large.profileCache).toMatchObject({
    depthVisits: 4096,
    admitted: 1,
    lookups: 1,
    hits: 1,
  });
  checkSharedOracle(large, largeEntities, two);

  const entities = depthZeroGrid(256);
  const thirtyTwo = Array(32).fill(undefined);
  const cumulative = sharedProfileRun(entities, thirtyTwo);
  expect(cumulative.profileCache).toMatchObject({
    depthVisits: 4096,
    admitted: 1,
    lookups: 16,
    hits: 16,
  });
  expect(cumulative.profileCache.pendingUpdates).toBeGreaterThan(0);
  checkSharedOracle(cumulative, entities, thirtyTwo);
  const sixtyFour = sharedProfileRun(entities, Array(64).fill(undefined));
  expect(sixtyFour.profileCache).toMatchObject({ depthVisits: 4096, hits: 48 });
}, 120_000);

test("depth-zero pending work floor and one-use profiles", () => {
  const small = sharedProfileRun(depthZeroGrid(63), Array(2).fill(undefined));
  expect(small.profileCache).toMatchObject({
    pendingUpdates: 0,
    depthVisits: 126,
    admitted: 0,
  });
  const eligible = sharedProfileRun(
    depthZeroGrid(64),
    Array(2).fill(undefined),
  );
  expect(eligible.profileCache.pendingUpdates).toBeGreaterThan(0);
  expect(eligible.profileCache.admitted).toBe(0);
  const doc = generateCadDocument({ features: 500, entitiesPerSketch: 1 });
  const page = doc.pages[0];
  if (!page) throw new Error("Missing fixture page");
  const profileCache = profileCacheStats();
  buildCadCaptureModel(doc.elements, page.id, {
    stats: { captureVisits: 0, toolArrays: 0, metadataVisits: 0, profileCache },
  });
  expect(profileCache).toMatchObject({
    pendingUpdates: 0,
    lookups: 0,
    admitted: 0,
    hits: 0,
    depthVisits: 500,
    maxDirectWork: 1,
  });
}, 120_000);

test("shared whole profiles reuse ancestry and preserve scene bytes", () => {
  const shallow = ancestryFixture("shallow", 1024);
  const sparse = [
    ...rectangle("ancestry", 0, 0, 10, 10),
    circle("inner", "ancestry", [5, 5], 1),
    ...Array.from({ length: 64 }, (_, i) =>
      circle(
        `far-${i}`,
        "ancestry",
        [300 + 300 * (i % 8), 300 + 300 * Math.floor(i / 8)],
        100,
      ),
    ),
  ];
  for (const entities of [shallow.entities, sparse]) {
    const one = sharedProfileRun(entities, [undefined]);
    const many = sharedProfileRun(entities, Array(32).fill(undefined));
    expect(ancestryWork(many.ancestry)).toBe(ancestryWork(one.ancestry));
    expect(many.ancestry.forestFallbacks).toBe(one.ancestry.forestFallbacks);
    expect(many.profileCache.prepared).toBe(one.profileCache.prepared);
    expect(many.profileCache).toMatchObject({
      admitted: 1,
      lookups: 31,
      hits: 31,
    });
    console.log(`shared profile prepared: ${many.profileCache.prepared}`);
    if (entities === sparse) {
      expect(many.ancestry.forestFallbacks).toBe(0);
      expect(many.profileCache.prepared).toBeGreaterThanOrEqual(
        PROFILE_CACHE_MIN_WORK,
      );
    }
    checkSharedOracle(many, entities, Array(32).fill(undefined));
  }
  const subsets = [
    shallow.selected.filter((_, i) => i < shallow.selected.length / 2),
    shallow.selected.filter((_, i) => i >= shallow.selected.length / 2),
  ];
  const both = sharedProfileRun(shallow.entities, subsets);
  const first = sharedProfileRun(shallow.entities, [subsets[0]]);
  const second = sharedProfileRun(shallow.entities, [subsets[1]]);
  expect(ancestryWork(both.ancestry)).toBe(
    ancestryWork(first.ancestry) + ancestryWork(second.ancestry),
  );
  expect(both.profileCache).toMatchObject({ lookups: 0, admitted: 0, hits: 0 });
  checkSharedOracle(both, shallow.entities, subsets);
}, 120_000);

test("ordinary capture avoids profile cache work", () => {
  const doc = generateCadDocument({ features: 500, entitiesPerSketch: 18 });
  const page = doc.pages[0];
  if (!page) throw new Error("Missing fixture page");
  const ancestry = ancestryStats();
  const profileCache = profileCacheStats();
  buildCadCaptureModel(doc.elements, page.id, {
    stats: {
      captureVisits: 0,
      toolArrays: 0,
      metadataVisits: 0,
      ancestry,
      profileCache,
    },
  });
  console.log(`ordinary profile cache: ${JSON.stringify(profileCache)}`);
  expect(profileCache).toMatchObject({ lookups: 0, admitted: 0, hits: 0 });
  expect(profileCache).toMatchObject({ pendingUpdates: 0, depthVisits: 500 });
  expect(profileCache.maxDirectWork * 4).toBeLessThanOrEqual(
    PROFILE_CACHE_MIN_WORK,
  );
  expect(ancestry).toMatchObject({
    ancestorProbes: 5000,
    indexEntries: 5500,
    forestFallbacks: 0,
  });
}, 120_000);

function sharedBoardRun(n: number, k: number) {
  const graphics = Array.from({ length: n }, (_, i) => {
    const y = 2 * i;
    return [
      edge(`rim-${i}`, {
        kind: "polygon",
        points: [
          [0, y],
          [1000, y + 1000],
          [1000, y + 1001],
          [0, y + 1],
          [0, y],
        ],
      }),
      edge(`hole-${i}`, {
        kind: "polygon",
        points: [
          [500, y + 500.5],
          [500.125, y + 500.5],
          [500.125, y + 500.625],
          [500, y + 500.625],
          [500, y + 500.5],
        ],
      }),
    ];
  }).flat();
  const references = Array.from({ length: k }, (_, i) =>
    cadElement(`ref-${i}`, "cad.pcb", `b${String(i).padStart(3, "0")}`, {
      name: `ref-${i}`,
      board: "board",
      thickness: 1 + i / 8,
    }),
  );
  const elements = collectCadInput(
    {
      pages: [CAD_TEST_PAGE, PCB_TEST_PAGE],
      elements: [testBoard(), ...graphics, ...references],
    },
    CAD_TEST_PAGE.id,
    0,
  ).elements;
  const ancestry = ancestryStats();
  const profileCache = profileCacheStats();
  const model = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, {
    stats: {
      captureVisits: 0,
      toolArrays: 0,
      metadataVisits: 0,
      ancestry,
      profileCache,
    },
  });
  expect(model.errors).toEqual([]);
  expect(model.overLimit).toBeUndefined();
  return { elements, ancestry, profileCache, model };
}

test("shared PCB outlines reuse ancestry and preserve scene bytes", () => {
  for (const [n, k] of [
    [256, 8],
    [512, 16],
    [1024, 32],
  ] as const) {
    const one = sharedBoardRun(n, 1);
    const many = sharedBoardRun(n, k);
    console.log(
      `shared PCB ${n},${k}: work=${ancestryWork(many.ancestry)} baseline=${ancestryWork(one.ancestry)} index=${many.ancestry.indexEntries} forests=${many.ancestry.forestFallbacks} prepared=${many.profileCache.prepared}`,
    );
    expect(ancestryWork(many.ancestry)).toBe(ancestryWork(one.ancestry));
    expect(many.ancestry.indexEntries).toBe(one.ancestry.indexEntries);
    expect(many.ancestry.forestFallbacks).toBe(one.ancestry.forestFallbacks);
    expect(many.profileCache.prepared).toBe(one.profileCache.prepared);
    expect(many.profileCache).toMatchObject({
      admitted: 1,
      lookups: k - 1,
      hits: k - 1,
    });
    if (n !== 256) continue;
    const request = {
      width: 256,
      height: 256,
      theme: "light" as const,
      camera: { view: "top" as const },
      interference: null,
    };
    const capture = prepareCadCapture(many.elements, CAD_TEST_PAGE.id, request);
    const outline = pcbBoardOutline(many.elements, "board");
    if ("error" in outline) throw new Error(outline.error);
    const tools = capture.model.tools.map((tool) => {
      if (tool.kind !== "prism") throw new Error("Expected prism");
      const sourceFaces = new Map<string, number>();
      const loops = oracleNormalise(outline.loops).map(
        ({ points, sources }) => ({
          points: new Float64Array(points),
          faces: new Uint32Array(
            sources.map((source) => {
              let face = sourceFaces.get(source);
              if (face === undefined) {
                face = 2 + sourceFaces.size;
                sourceFaces.set(source, face);
              }
              return face;
            }),
          ),
        }),
      );
      return { ...tool, loops };
    });
    expect(capture.scene).toEqual(
      writeCaptureScene(
        { ...capture.model, tools },
        {
          width: request.width,
          height: request.height,
          supersample: 2,
          camera: capture.camera,
          colours: CAPTURE_THEMES[request.theme],
          referenceOpacity: 0.45,
          interference: null,
        },
      ),
    );
    for (let i = 0; i < k; i++) {
      expect(many.model.bodies[i]?.reference).toBe(true);
      expect(many.model.bodies[i]?.bounds.min[2]).toBe(0);
      expect(many.model.bodies[i]?.bounds.max[2]).toBe(1 + i / 8);
    }
    const points = (model: typeof many.model) =>
      model.tools.reduce(
        (sum, tool) =>
          sum +
          (tool.kind === "prism"
            ? tool.loops.reduce(
                (total, loop) => total + loop.points.length / 2,
                0,
              )
            : 0),
        0,
      );
    expect(points(many.model)).toBe(k * points(one.model));
  }
}, 120_000);
