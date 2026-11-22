import { expect, test } from "bun:test";
import { type Element, type Page, validateDocument } from "@nodetto/ir";
import {
  applyCommands,
  CommandError,
  planElementRelocations,
} from "../commands.ts";
import { Store } from "../store.ts";
import { document, element, makeEditor } from "../test-helpers.ts";
import {
  planContentRepair,
  recoveredCadPageId,
  recoveredShapesPageId,
} from "./content-repair.ts";

const cadPage: Page = {
  id: "housing",
  kind: "cad3d",
  name: "Housing",
  order: "A",
};
const drawing: Page = {
  id: "notes",
  kind: "freeform",
  name: "Notes",
  order: "C",
};
const mislabeled = { ...cadPage, kind: "freeform" } as const;
const sketch = element({
  id: "profile",
  type: "cad.sketch",
  page: cadPage.id,
  semantic: { name: "Flange profile", plane: { base: "xy" } },
});
const circle = element({
  id: "rim",
  type: "cad.circle",
  page: cadPage.id,
  semantic: { sketch: sketch.id, c: [4, 6], r: 2 },
});
const future = element({
  id: "flange",
  type: "cad.future",
  page: cadPage.id,
  semantic: { direction: [0, 1, 0] },
});
const box = element({
  id: "legend",
  type: "shape.geo",
  page: cadPage.id,
  semantic: { geo: "rect", label: "Assembly guide" },
  visual: { x: 17, y: 23, locked: true },
});
const group = element({
  id: "legend-group",
  type: "group",
  page: cadPage.id,
  semantic: { memberIds: [box.id] },
});
const comment = element({
  id: "thread",
  type: "review.comment",
  page: cadPage.id,
  semantic: {
    target: box.id,
    messages: [
      {
        id: "note",
        author: "Review",
        body: "Check the flange dimensions.",
        createdAt: "2026-03-06T09:00:00.000Z",
      },
    ],
  },
});
const token = element({
  id: "finish",
  type: "design.token",
  page: cadPage.id,
  semantic: { kind: "color", name: "Finish", value: "#266066" },
});

function repair(
  pages: readonly Page[],
  before: readonly Element[],
  expected: readonly Element[],
): Store {
  const store = new Store(document(before, pages));
  const commands = planContentRepair(store);
  expect(commands.length).toBeGreaterThan(0);
  applyCommands(store, commands);
  expect(store.listElements()).toHaveLength(before.length);
  for (const record of expected) expect(store.get(record.id)).toEqual(record);
  expect(
    validateDocument(store.getSnapshot()).filter(
      ({ severity }) => severity === "error",
    ),
  ).toEqual([]);
  expect(planContentRepair(store)).toEqual([]);
  return store;
}

test("restores a mislabeled CAD-only page, including unknown CAD types", () => {
  const store = new Store(document([future, token], [mislabeled]));
  expect(planContentRepair(store)).toEqual([
    { type: "updatePage", id: cadPage.id, page: { kind: "cad3d" } },
  ]);
  expect(
    repair([mislabeled], [future, token], [future, token]).listPages(),
  ).toEqual([cadPage]);
});

test("moves refused content together and preserves references from resources", () => {
  const destination = recoveredShapesPageId(cadPage.id);
  const before = [sketch, circle, box, group, comment, token];
  const expected = before.map((record) =>
    record === box || record === group
      ? { ...record, page: destination }
      : record,
  );
  const repaired = repair([cadPage, drawing], before, expected);
  expect(repaired.listPages()).toEqual([
    cadPage,
    { id: destination, name: "Housing shapes", kind: "freeform", order: "B" },
    drawing,
  ]);
});

test("moves all CAD records off a mixed page and reuses its recovery page", () => {
  const destination = recoveredCadPageId(cadPage.id);
  const before = [sketch, circle, future, box, comment, token];
  const expected = before.map((record) =>
    record === sketch || record === circle || record === future
      ? { ...record, page: destination }
      : record,
  );
  const recovery: Page = {
    id: destination,
    name: "Housing 3D CAD",
    kind: "cad3d",
    order: "B",
  };
  const pages = [mislabeled, recovery, drawing];
  expect(repair(pages, before, expected).listPages()).toEqual(pages);
  expect(repair([mislabeled, drawing], before, expected).listPages()).toEqual(
    pages,
  );
});

test("produces the same commands in any insertion order with legacy and tied page keys", () => {
  const legacy: Page = { id: "legacy", name: "Legacy", kind: "freeform" };
  const pages = [cadPage, { ...drawing, order: cadPage.order }, legacy];
  const before = [group, token, box, circle, sketch, comment];
  const forward = new Store(document(before, pages));
  const reverse = new Store(
    document([...before].reverse(), [...pages].reverse()),
  );
  const commands = planContentRepair(forward);
  expect(planContentRepair(reverse)).toEqual(commands);
  expect(commands.filter(({ type }) => type === "deleteElements")).toEqual([
    expect.objectContaining({ ids: [box.id, group.id] }),
  ]);
  applyCommands(forward, commands);
  expect(forward.listPages().map(({ id }) => id)).toEqual([
    legacy.id,
    cadPage.id,
    recoveredShapesPageId(cadPage.id),
    drawing.id,
  ]);
  expect(planContentRepair(forward)).toEqual([]);
});

test("uses a deterministic alternate when an existing recovery page refuses the move", () => {
  const id = recoveredShapesPageId(cadPage.id);
  const occupied: Page = { ...drawing, id, kind: "cad3d" };
  const pages = [cadPage, occupied];
  const before = [sketch, box];
  const expected = [sketch, { ...box, page: `${id}-2` }];
  const store = repair(pages, before, expected);
  expect(store.getPage(id)).toEqual(occupied);
  expect(store.getPage(`${id}-2`)?.kind).toBe("freeform");
});

test.each(["8", "B"])(
  "moves shapes away from a recovery page restored to CAD at order %s",
  (order) => {
    const id = recoveredShapesPageId(cadPage.id);
    const occupied: Page = { ...drawing, id, order };
    const recoveredSketch = { ...sketch, page: id };
    const destination = `${id}-2`;
    const store = repair(
      [cadPage, occupied, drawing],
      [recoveredSketch, box],
      [recoveredSketch, { ...box, page: destination }],
    );
    expect(store.getPage(id)).toEqual({ ...occupied, kind: "cad3d" });
    expect(store.getPage(destination)?.kind).toBe("freeform");
  },
);

test("reuses a CAD recovery page after restoring its kind", () => {
  const id = recoveredCadPageId(cadPage.id);
  const occupied: Page = { ...drawing, id, order: "B" };
  const recoveredSketch = { ...sketch, id: "spare-profile", page: id };
  const store = repair(
    [mislabeled, occupied],
    [sketch, box, recoveredSketch],
    [{ ...sketch, page: id }, box, recoveredSketch],
  );
  expect(store.listPages()).toEqual([
    mislabeled,
    { ...occupied, kind: "cad3d" },
  ]);
});

test("reconciles auto-sized text and CAD page content without undo history", () => {
  const note = element({
    id: "size-note",
    page: cadPage.id,
    type: "text.note",
    semantic: { text: "Rim" },
    visual: {
      width: 1,
      height: 1,
      textResize: "auto-width",
      style: { fontSize: 20, lineHeight: 1.5 },
    },
  });
  const editor = makeEditor({
    document: document([sketch, circle, note], [cadPage, drawing]),
  });

  editor.reconcileDerivedState();

  expect(editor.store.size).toBe(3);
  expect(editor.store.get(sketch.id)).toEqual(sketch);
  expect(editor.store.get(circle.id)).toEqual(circle);
  expect(editor.store.get(note.id)).toEqual({
    ...note,
    page: recoveredShapesPageId(cadPage.id),
    visual: { ...note.visual, width: 49, height: 42 },
  });
  expect(
    validateDocument(editor.getSnapshot()).filter(
      ({ severity }) => severity === "error",
    ),
  ).toEqual([]);
  expect(editor.canUndo()).toBe(false);
});

test("a relocation missing a matching create fails without changing the store", () => {
  const store = new Store(document([box, group, comment], [cadPage, drawing]));
  const before = store.getSnapshot();
  const incomplete = planElementRelocations([box, group], drawing.id).slice(
    0,
    -1,
  );
  expect(() => applyCommands(store, incomplete)).toThrow(CommandError);
  expect(store.getSnapshot()).toBe(before);
});

test("valid content and rejected local edits need no repair", () => {
  const shape = { ...box, page: drawing.id };
  const editor = makeEditor({
    document: document([sketch, circle, shape, token], [cadPage, drawing]),
  });
  expect(planContentRepair(editor.store)).toEqual([]);
  expect(() =>
    editor.apply([
      { type: "createElement", element: { ...box, id: "rejected-shape" } },
    ]),
  ).toThrow(CommandError);
  expect(() =>
    editor.apply([
      { type: "createElement", element: { ...future, page: drawing.id } },
    ]),
  ).toThrow(CommandError);
  expect(() =>
    editor.apply([
      {
        type: "convertElement",
        id: sketch.id,
        elementType: box.type,
        semantic: box.semantic,
        visual: box.visual,
      },
    ]),
  ).toThrow(CommandError);
  expect(editor.setPageKind(cadPage.id, "freeform")).toBe(false);
  expect(editor.setPageKind(drawing.id, "cad3d")).toBe(false);
  editor.setCurrentPage(drawing.id);
  editor.selection.set([shape.id]);
  expect(editor.copySelection()).toBe(true);
  editor.setCurrentPage(cadPage.id);
  expect(editor.paste()).toEqual([]);
  expect(planContentRepair(editor.store)).toEqual([]);
  editor.createElement("cad.sketch");
  expect(planContentRepair(editor.store)).toEqual([]);
});
