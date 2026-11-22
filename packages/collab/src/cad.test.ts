import { afterEach, beforeEach, expect, test } from "bun:test";
import { analyzeCadPage, Store } from "@nodetto/core";
import {
  type CadCircleSemantic,
  type CadExtrudeSemantic,
  type CadLineSemantic,
  type CadXY,
  type Document,
  type Element,
  isPlainObject,
  type Page,
  validateDocument,
} from "@nodetto/ir";
import * as Y from "yjs";
import {
  elementIn,
  type Peer,
  peer,
  WIRE,
  Wire,
} from "./binding-test-helpers.ts";
import { ELEMENTS_KEY, elementToY, PAGES_KEY, ydocToIr } from "./ydoc.ts";

const model = {
  id: "valve",
  name: "Valve",
  kind: "cad3d",
  order: "F",
} satisfies Page;
const drawing = {
  id: "assembly",
  name: "Assembly",
  kind: "freeform",
  order: "L",
} satisfies Page;
const base: Element = {
  id: "rim-profile",
  page: model.id,
  type: "cad.sketch",
  index: "G",
  semantic: { name: "Rim", plane: { base: "xy" } },
  visual: {},
};
const circle: Element<CadCircleSemantic> = {
  ...base,
  id: "rim-circle",
  type: "cad.circle",
  semantic: { sketch: base.id, c: [10, 11], r: 6 },
};
const line: Element<CadLineSemantic> = {
  ...base,
  id: "axis-line",
  type: "cad.line",
  semantic: { sketch: base.id, a: [2, 3], b: [15, 11], construction: true },
};
const extrude: Element<CadExtrudeSemantic> = {
  ...base,
  id: "wall",
  type: "cad.extrude",
  index: "N",
  semantic: { name: "Wall", sketch: base.id, distance: 9, op: "new" },
};
const shape: Element = {
  ...base,
  id: "boxed-note",
  type: "shape.geo",
  semantic: { geo: "rect", label: "Tighten by hand" },
  visual: { x: 18, y: 24 },
};
const drawingShape = { ...shape, id: "callout", page: drawing.id };
const cadElements = [base, circle, line, extrude];
const input: Document = {
  schemaVersion: 1,
  id: "valve-assembly",
  title: "Valve assembly",
  pages: [model, drawing],
  elements: [...cadElements, drawingShape],
};

let wire: Wire;
let a: Peer;
let b: Peer;

beforeEach(() => {
  wire = new Wire();
  a = peer(wire, input);
  a.binding.attach();
  b = peer(wire);
  b.binding.attach();
  wire.flush();
});

afterEach(() => {
  for (const side of [a, b]) {
    side.binding.detach();
    side.doc.destroy();
  }
});

function change(side: Peer, id: string, patch: Record<string, unknown>): void {
  const { semantic } = elementIn(side, id);
  if (!isPlainObject(semantic))
    throw new Error(`Invalid fixture semantic for ${id}`);
  side.editor.apply([
    { type: "updateSemantic", id, semantic: { ...semantic, ...patch } },
  ]);
}

function expectValid(side: Peer): void {
  const snapshot = side.editor.getSnapshot();
  expect(
    validateDocument(snapshot).filter(({ severity }) => severity === "error"),
  ).toEqual([]);
  expect(new Store(ydocToIr(side.doc)).getSnapshot()).toEqual(snapshot);
}

function converge(): void {
  wire.flush();
  expect(wire.queued).toBe(0);
  expect(a.editor.getSnapshot()).toEqual(b.editor.getSnapshot());
  expectValid(a);
  expectValid(b);
}

test("concurrent circle radius and extrusion distance both survive", () => {
  change(a, circle.id, { r: 8 });
  change(b, extrude.id, { distance: 13 });
  converge();
  expect(elementIn(a, circle.id).semantic).toEqual({
    ...circle.semantic,
    r: 8,
  });
  expect(elementIn(a, extrude.id).semantic).toEqual({
    ...extrude.semantic,
    distance: 13,
  });
});

test("concurrent writes of the same radius converge to one value", () => {
  change(a, circle.id, { r: 8 });
  change(b, circle.id, { r: 12 });
  converge();
  expect([8, 12]).toContain(
    (elementIn(a, circle.id).semantic as CadCircleSemantic).r,
  );
});

test("separate line endpoints merge and competing coordinate pairs stay atomic", () => {
  change(a, line.id, { a: [13, 9] });
  change(b, line.id, { b: [19, 8] });
  converge();
  expect(elementIn(a, line.id).semantic).toEqual({
    ...line.semantic,
    a: [13, 9],
    b: [19, 8],
  });

  change(a, line.id, { a: [14, 2] });
  change(b, line.id, { a: [3, 16] });
  converge();
  const semantic = elementIn(a, line.id).semantic as CadLineSemantic;
  const candidates: readonly CadXY[] = [
    [14, 2],
    [3, 16],
  ];
  expect(candidates).toContainEqual(semantic.a);
  expect(semantic.b).toEqual([19, 8]);
});

test("deleting the sketch detaches an extrusion during a concurrent distance edit", () => {
  a.editor.apply([{ type: "deleteElements", ids: [base.id] }]);
  change(b, extrude.id, { distance: 14 });
  converge();
  expect(
    a.editor.store
      .listElements()
      .map(({ id }) => id)
      .sort(),
  ).toEqual([drawingShape.id, extrude.id]);
  expect(elementIn(a, extrude.id).semantic).toEqual({
    name: "Wall",
    distance: 14,
    op: "new",
  });
  expect(
    analyzeCadPage(a.editor.store.getPageElements(model.id)).status.get(
      extrude.id,
    ),
  ).toMatchObject({
    code: "cad.reference.missing",
  });
});

test("concurrent reorders of a feature agree", () => {
  a.editor.apply([{ type: "reorder", id: extrude.id, index: "J" }]);
  b.editor.apply([{ type: "reorder", id: extrude.id, index: "R" }]);
  converge();
  expect(["J", "R"]).toContain(elementIn(a, extrude.id).index);
  const featureIds = (side: Peer) =>
    analyzeCadPage(side.editor.store.getPageElements(model.id)).features.map(
      ({ id }) => id,
    );
  expect(featureIds(a)).toEqual(featureIds(b));
});

function elementMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap<Y.Map<unknown>>(ELEMENTS_KEY);
}

function setKind(doc: Y.Doc, id: string, kind: Page["kind"]): void {
  const page = doc.getMap<Y.Map<unknown>>(PAGES_KEY).get(id);
  if (!page) throw new Error(`Missing fixture page ${id}`);
  page.set("kind", kind);
}

function expectLegacyRepair(
  edit: (doc: Y.Doc) => void,
  expectedPages: readonly Page[],
  expectedElements: readonly Element[],
): void {
  const legacy = new Y.Doc();
  Y.applyUpdate(legacy, Y.encodeStateAsUpdate(a.doc));
  const clock = Y.encodeStateVector(legacy);
  legacy.transact(() => edit(legacy));
  const update = Y.encodeStateAsUpdate(legacy, clock);
  legacy.destroy();

  // Each peer sees only the legacy transaction before producing its repair.
  // Delay both repairs on the wire until both peers have published one.
  const stableMaps = [a, b].map(
    (side) => new Map(elementMap(side.doc).entries()),
  );
  for (const [index, side] of [a, b].entries()) {
    const queued = wire.queued;
    Y.applyUpdate(side.doc, update, WIRE);
    expect(wire.queued).toBeGreaterThan(queued);
    expect(side.editor.store.listPages()).toEqual(expectedPages);
    expectValid(side);
    for (const record of expectedElements)
      expect(elementIn(side, record.id)).toEqual(record);
    expect(side.editor.store.size).toBe(expectedElements.length);
    for (const [id, original] of stableMaps[index] ?? [])
      expect(elementMap(side.doc).get(id)).toBe(original);
    expect(side.editor.canUndo()).toBe(false);
    expect(side.binding.canUndo()).toBe(false);
  }
  converge();
  for (const side of [a, b]) {
    expect(side.editor.store.listPages()).toEqual(expectedPages);
    expect(side.editor.store.size).toBe(expectedElements.length);
    for (const record of expectedElements)
      expect(elementIn(side, record.id)).toEqual(record);
    expect(side.editor.canUndo()).toBe(false);
    expect(side.binding.canUndo()).toBe(false);
  }
}

test("independent repairs move an old client's shape to one recovery page", () => {
  const recovery = {
    id: "valve-shapes",
    kind: "freeform",
    name: "Valve shapes",
    order: "I",
  } satisfies Page;
  expectLegacyRepair(
    (doc) => elementMap(doc).set(shape.id, elementToY(shape)),
    [model, recovery, drawing],
    [...cadElements, drawingShape, { ...shape, page: recovery.id }],
  );
});

test("independent repairs restore the kind of an old client's mislabeled CAD page", () => {
  expectLegacyRepair(
    (doc) => setKind(doc, model.id, "freeform"),
    input.pages,
    input.elements,
  );
});

test("independent repairs preserve a CAD model and its references when an old client changes kind and adds a shape", () => {
  const recovery = {
    id: "valve-cad",
    kind: "cad3d",
    name: "Valve 3D CAD",
    order: "I",
  } satisfies Page;
  const history = analyzeCadPage(a.editor.store.getPageElements(model.id));
  expect(history.status.get(extrude.id)).toEqual({ ok: true });
  expectLegacyRepair(
    (doc) => {
      setKind(doc, model.id, "freeform");
      elementMap(doc).set(shape.id, elementToY(shape));
    },
    [{ ...model, kind: "freeform" }, recovery, drawing],
    [
      ...cadElements.map((record) => ({ ...record, page: recovery.id })),
      drawingShape,
      shape,
    ],
  );
  for (const side of [a, b])
    expect(
      analyzeCadPage(side.editor.store.getPageElements(recovery.id)).status,
    ).toEqual(history.status);
});

test("independent repairs move shapes when an old client relabels a drawing as CAD", () => {
  const recovery = {
    id: "assembly-shapes",
    kind: "freeform",
    name: "Assembly shapes",
    order: "g",
  } satisfies Page;
  expectLegacyRepair(
    (doc) => setKind(doc, drawing.id, "cad3d"),
    [model, { ...drawing, kind: "cad3d" }, recovery],
    [...cadElements, { ...drawingShape, page: recovery.id }],
  );
});

test("concurrent CAD page creation and 2D drawing converge", () => {
  const page = a.editor.createPage({ kind: "cad3d", name: "Mount" });
  const sketchId = a.editor.createElement("cad.sketch", {
    semantic: { name: "Mount profile", plane: { base: "yz" } },
  });
  const extrudeId = a.editor.createElement("cad.extrude", {
    semantic: { name: "Mount post", sketch: sketchId, distance: 4, op: "new" },
  });
  b.editor.setCurrentPage(drawing.id);
  const shapeId = b.editor.createElement("shape.geo", {
    semantic: { geo: "ellipse" },
  });
  converge();
  expect(a.editor.store.getPage(page)?.kind).toBe("cad3d");
  expect(elementIn(a, sketchId).page).toBe(page);
  expect(elementIn(a, extrudeId).page).toBe(page);
  expect(elementIn(a, shapeId).page).toBe(drawing.id);
  expect(a.editor.store.size).toBe(input.elements.length + 3);
});
