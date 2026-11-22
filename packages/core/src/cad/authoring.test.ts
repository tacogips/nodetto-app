import { expect, test } from "bun:test";
import { hasErrors, validateDocument } from "@nodetto/ir";
import { applyCommands, type Command, CommandError } from "../commands.ts";
import { Store } from "../store.ts";
import { counterIds, document, TEST_PAGE } from "../test-helpers.ts";
import {
  arcCommands,
  type CadIds,
  circleCommands,
  defaultExtrude,
  extrudeCommands,
  extrudeIntent,
  lineCommands,
  pcbReferenceCommands,
  rectangleCommands,
  sketchCommands,
  sketchFrameOf,
} from "./authoring.ts";
import { baseFrame, faceFrame } from "./frames.ts";
import { buildLoops } from "./loops.ts";
import { CAD_TEST_PAGE, plateElements, sketch } from "./testing/documents.ts";
import { extrudeFaceCases } from "./testing/extrude-faces.ts";
import { boardReference, PCB_TEST_PAGE, testBoard } from "./testing/pcb.ts";
import { faceName, parseFaceName } from "./tool-solid.ts";

const page = CAD_TEST_PAGE.id;
const ids = (last?: string): CadIds => ({
  next: counterIds("feature"),
  indexAfter: (previous) => `${previous ?? ""}a1`,
  lastEntityIndex: () => last,
});

test("sketch and entity builders apply and round geometry to the nanometre grid", () => {
  const store = new Store(document([], [CAD_TEST_PAGE]));
  const source = ids();
  const { id, commands } = sketchCommands(
    page,
    { base: "yz", offset: 2.1234567 },
    "Bracket",
    source,
  );
  applyCommands(store, commands);
  const sketch = store.get(id);
  if (!sketch) throw new Error("Missing sketch");
  expect(sketchFrameOf(store.listElements(), id)).toEqual(
    baseFrame("yz", 2.123457),
  );
  applyCommands(store, [
    ...lineCommands(page, sketch, [0, 0], [4.0000001, 0], source),
    ...circleCommands(page, sketch, [2, 1], 0.6250001, source),
    ...arcCommands(page, sketch, [0, 0], [3, 2], [4, 0], source),
  ]);
  expect(store.listElements().map(({ type }) => type)).toEqual([
    "cad.sketch",
    "cad.line",
    "cad.circle",
    "cad.arc",
  ]);
  expect(store.get("feature-2")?.semantic).toMatchObject({ b: [4, 0] });
  expect(store.get("feature-3")?.semantic).toMatchObject({ r: 0.625 });
  expect(hasErrors(validateDocument(store.getSnapshot()))).toBe(false);
});

test("rectangle shares exact corners and starts indexing after the last sketch entity", () => {
  const store = new Store(document([], [CAD_TEST_PAGE]));
  const created = sketchCommands(page, { base: "xy" }, "Plate", ids());
  applyCommands(store, created.commands);
  const sketch = store.get(created.id);
  if (!sketch) throw new Error("Missing sketch");
  const source = ids("a5");
  source.next();
  const commands = rectangleCommands(page, sketch, [1, 2], [6, 8], source);
  expect(commands).toHaveLength(4);
  applyCommands(store, commands);
  const edges = store.listElements().filter(({ type }) => type === "cad.line");
  expect(edges.map(({ index }) => index)).toEqual([
    "a5a1",
    "a5a1a1",
    "a5a1a1a1",
    "a5a1a1a1a1",
  ]);
  const profile = buildLoops(edges);
  expect(profile).toMatchObject({
    loops: [{ depth: 0, members: edges.map(({ id }) => id) }],
  });
  expect(hasErrors(validateDocument(store.getSnapshot()))).toBe(false);
});

test("frame resolution uses analytic caps and planar sides through feature history", () => {
  const source = ids();
  const elements = plateElements();
  const sideId = "base-edge-0";
  const end = sketchCommands(
    page,
    { face: { feature: "ex1", role: "end" } },
    "End",
    source,
    "a2",
  );
  const side = sketchCommands(
    page,
    { face: { feature: "ex1", role: "side", entity: sideId } },
    "Side",
    source,
    "a2",
  );
  const store = new Store(document(elements, [CAD_TEST_PAGE]));
  applyCommands(store, [...end.commands, ...side.commands]);
  const span = { t0: 0, t1: 5 };
  expect(sketchFrameOf(store.listElements(), end.id)).toEqual(
    faceFrame(baseFrame("xy"), span, "end"),
  );
  expect(sketchFrameOf(store.listElements(), side.id)).toEqual(
    faceFrame(baseFrame("xy"), span, "side", { a: [0, 0], b: [100, 0] }),
  );
  expect(
    sketchFrameOf(
      store.listElements().filter(({ id }) => id !== "ex1"),
      end.id,
    ),
  ).toBeNull();
  expect(parseFaceName(faceName("side:wall%3A", "side", "edge%:1"))).toEqual({
    feature: "side:wall%3A",
    role: "side",
    entity: "edge%:1",
  });
  expect(parseFaceName("wall:side")).toBeNull();
});

test("degenerate geometry and partially out-of-bounds rectangles emit no commands", () => {
  const sketch = plateElements()[0];
  const source = ids();
  expect(rectangleCommands(page, sketch, [1, 1], [1, 5], source)).toEqual([]);
  expect(rectangleCommands(page, sketch, [1, 1], [10001, 5], source)).toEqual(
    [],
  );
  expect(lineCommands(page, sketch, [0, 0], [0, 0], source)).toEqual([]);
  expect(circleCommands(page, sketch, [0, 0], 0, source)).toEqual([]);
  expect(arcCommands(page, sketch, [0, 0], [1, 0], [2, 0], source)).toEqual([]);
});

test("every builder reaches the page content rule even for a non-CAD target", () => {
  const source = ids();
  const freeform = TEST_PAGE.id;
  const store = new Store(document());
  const sketch = { ...plateElements()[0], page: freeform };
  const batches: Command[][] = [
    sketchCommands(freeform, { base: "xy" }, "Wrong page", source).commands,
    lineCommands(freeform, sketch, [0, 0], [1, 0], source),
    rectangleCommands(freeform, sketch, [0, 0], [1, 1], source),
    circleCommands(freeform, sketch, [0, 0], 1, source),
    arcCommands(freeform, sketch, [0, 0], [1, 1], [2, 0], source),
    pcbReferenceCommands(freeform, "board", "PCB board", source),
    extrudeCommands(
      freeform,
      sketch,
      {
        op: "new",
        distance: 10,
        bodies: [],
        name: "Wrong page",
      },
      source,
    ).commands,
  ];
  for (const commands of batches) {
    expect(commands.length).toBeGreaterThan(0);
    try {
      applyCommands(store, commands);
      throw new Error("CAD content was accepted on a freeform page");
    } catch (error) {
      if (!(error instanceof CommandError)) throw error;
      expect(error.issues[0]?.code).toBe("page.contentKind");
    }
  }
  expect(store.listElements()).toEqual([]);
});

test("a PCB reference appends to the CAD history and leaves the board on its page", () => {
  const board = testBoard();
  const store = new Store(document([board], [CAD_TEST_PAGE, PCB_TEST_PAGE]));
  const commands = pcbReferenceCommands(
    page,
    board.id,
    "PCB board",
    ids(),
    "a1",
  );
  expect(commands).toHaveLength(1);
  applyCommands(store, commands);
  expect(store.get("feature-1")).toMatchObject({
    type: "cad.pcb",
    page,
    index: "a1a1",
    semantic: { name: "PCB board", board: board.id },
  });
  expect(store.get(board.id)).toEqual(board);
  expect(hasErrors(validateDocument(store.getSnapshot()))).toBe(false);
});

test("a drag keeps the selected cut or add when the sketch lies on a PCB cap", () => {
  const reference = boardReference();
  for (const role of ["start", "end"] as const) {
    const owner = sketch("pocket", "a1", {
      face: { feature: reference.id, role },
    });
    for (const op of ["cut", "add"] as const) {
      for (const distance of [-9, 9]) {
        expect(extrudeIntent([reference, owner], owner, distance, op)).toBe(op);
      }
    }
    expect(extrudeIntent([reference, owner], owner, 9)).toBe("new");
  }
});

test("base extrudes default to a new body and preserve an explicit operation", () => {
  const first = sketch("first", "a1");
  const second = sketch("second", "a3", { base: "zx", offset: 5 });
  const elements = [first, second];
  for (const owner of elements) {
    expect(defaultExtrude(elements, owner.id)).toEqual({
      op: "new",
      distance: 10,
      bodies: [],
    });
    expect(extrudeIntent(elements, owner, -5, "intersect")).toBe("intersect");
  }
  expect(
    defaultExtrude(
      [sketch("detached", "a1", { face: { role: "end" } })],
      "detached",
    ),
  ).toEqual({ op: "new", distance: 10, bodies: [] });
  const store = new Store(document(elements, [CAD_TEST_PAGE]));
  const { id, commands } = extrudeCommands(
    page,
    first,
    { op: "new", distance: 10.1234567, bodies: [], name: "Bracket" },
    ids("a2"),
  );
  applyCommands(store, commands);
  expect(store.get(id)).toMatchObject({
    index: "a2a1",
    semantic: {
      sketch: first.id,
      distance: 10.123457,
      op: "new",
      name: "Bracket",
    },
  });
  expect(hasErrors(validateDocument(store.getSnapshot()))).toBe(false);
  for (const distance of [Number.NaN, Number.POSITIVE_INFINITY, 0, 10_001])
    expect(
      extrudeCommands(
        page,
        first,
        { ...defaultExtrude(elements, first.id), name: "Bracket", distance },
        ids(),
      ).commands,
    ).toEqual([]);
});

for (const item of extrudeFaceCases()) {
  test(`default and drag intent follow the outward normal on the ${item.label}`, () => {
    const owner = sketch("face", "a5", { face: item.face });
    const elements = [...item.elements, owner];
    const params = defaultExtrude(elements, owner.id);
    expect(params).toEqual({
      op: "add",
      distance: 10 * item.sign,
      bodies: ["ex1"],
    });
    expect(extrudeIntent(elements, owner, item.sign)).toBe("add");
    expect(extrudeIntent(elements, owner, -item.sign)).toBe("cut");
    const store = new Store(document(elements, [CAD_TEST_PAGE]));
    const { id, commands } = extrudeCommands(
      page,
      owner,
      { ...params, name: "Boss" },
      ids("a1"),
    );
    applyCommands(store, commands);
    expect(store.get(id)).toMatchObject({
      index: "a5a1",
      semantic: { ...params, sketch: owner.id, name: "Boss" },
    });
    expect(hasErrors(validateDocument(store.getSnapshot()))).toBe(false);
  });
}
