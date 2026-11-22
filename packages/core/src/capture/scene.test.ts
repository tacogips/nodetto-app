import { expect, test } from "bun:test";
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
import { buildCadCaptureModel, normaliseToolLoops } from "./index.ts";

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
  const model = modelOf([
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
    circle("stray", "gone", [0, 0], 1),
  ]);
  expect(model.tools).toHaveLength(1);
  expect(model.bodies[0]?.steps).toEqual([{ op: "union", tool: 0 }]);
  expect(model.sketches).toBe(1);
  expect(model.errors).toEqual([
    { id: "bad-plane", code: "cad.reference.missing" },
    { id: "failed-cut", code: "cad.reference.failed" },
    { id: "quiet-target", code: "cad.reference.failed" },
    { id: "stray", code: "cad.reference.missing" },
  ]);
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
      data: "nmesh1:UExBVEU=",
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
