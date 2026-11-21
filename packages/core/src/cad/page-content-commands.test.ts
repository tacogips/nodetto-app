import { expect, test } from "bun:test";
import { hasErrors, type Page, validateDocument } from "@nodetto/ir";
import { applyCommands, CommandError } from "../commands.ts";
import { Store } from "../store.ts";
import { document, element, makeEditor, TEST_PAGE } from "../test-helpers.ts";

const cad: Page = { id: "part", name: "Plate", kind: "cad3d" };
const outline = element({
  id: "outline",
  type: "cad.sketch",
  page: cad.id,
  semantic: { name: "Outline", plane: { base: "xy" } },
});
const line = element({
  id: "rim",
  type: "cad.line",
  page: cad.id,
  semantic: { sketch: outline.id, a: [0, 0], b: [20, 0] },
});
const shape = element({
  id: "rectangle",
  type: "shape.geo",
  semantic: { geo: "rect" },
});

function expectIssue(run: () => unknown, code: string, path: string): void {
  try {
    run();
  } catch (failure) {
    if (!(failure instanceof CommandError)) throw failure;
    expect(failure.issues).toEqual([
      expect.objectContaining({ severity: "error", code, path }),
    ]);
    return;
  }
  throw new Error(`Expected CommandError with issue ${code}`);
}

test("createElement rejects a 2D shape on a CAD page", () => {
  const store = new Store(document([], [cad]));
  expectIssue(
    () =>
      applyCommands(store, [
        { type: "createElement", element: { ...shape, page: cad.id } },
      ]),
    "page.contentKind",
    "element.type",
  );
  expect(store.listElements()).toEqual([]);
});

test.each(["freeform", "pcb", "breadboard"] as const)(
  "createElement rejects CAD elements on a %s page",
  (kind) => {
    const store = new Store(document([], [{ ...TEST_PAGE, kind }]));
    expectIssue(
      () =>
        applyCommands(store, [
          { type: "createElement", element: { ...line, page: TEST_PAGE.id } },
        ]),
      "page.contentKind",
      "element.type",
    );
    expect(store.listElements()).toEqual([]);
  },
);

test("convertElement checks the new type on the element's own page", () => {
  const store = new Store(document([outline, shape], [TEST_PAGE, cad]));
  const before = store.getSnapshot();
  for (const [from, to] of [
    [outline, shape],
    [shape, outline],
  ] as const) {
    expectIssue(
      () =>
        applyCommands(store, [
          {
            type: "convertElement",
            id: from.id,
            elementType: to.type,
            semantic: to.semantic,
            visual: to.visual,
          },
        ]),
      "page.contentKind",
      "element.type",
    );
  }
  expect(store.getSnapshot()).toEqual(before);
});

test("updatePage locks CAD kind in both directions", () => {
  for (const elements of [[], [shape]]) {
    const store = new Store(document(elements, [TEST_PAGE, cad]));
    const before = store.getSnapshot();
    for (const [id, kind] of [
      [TEST_PAGE.id, "cad3d"],
      [cad.id, "freeform"],
    ] as const) {
      expectIssue(
        () =>
          applyCommands(store, [{ type: "updatePage", id, page: { kind } }]),
        "page.kindLocked",
        "page.kind",
      );
    }
    expect(store.getSnapshot()).toEqual(before);
  }
});

test("updatePage restores CAD kind using current batch contents and checks the inverse", () => {
  const wrongKind = { ...cad, kind: "freeform" } as const;
  const token = element({
    id: "paint",
    page: cad.id,
    type: "design.token",
    semantic: { name: "Paint", kind: "color", value: "#456789" },
  });
  const foreignShape = { ...shape, page: cad.id };
  const store = new Store(
    document([outline, token, foreignShape], [wrongKind]),
  );
  const restore = {
    type: "updatePage",
    id: cad.id,
    page: { kind: "cad3d" },
  } as const;
  expectIssue(
    () => applyCommands(store, [restore]),
    "page.kindLocked",
    "page.kind",
  );
  expectIssue(
    () =>
      applyCommands(store, [
        { type: "deleteElements", ids: [foreignShape.id] },
        { type: "createElement", element: { ...foreignShape, id: "new-2d" } },
        restore,
      ]),
    "page.kindLocked",
    "page.kind",
  );
  expect(store.has(foreignShape.id)).toBe(true);
  expect(store.has("new-2d")).toBe(false);
  const result = applyCommands(store, [
    { type: "deleteElements", ids: [foreignShape.id] },
    restore,
    { type: "createElement", element: line },
  ]);
  expect(store.getPage(cad.id)?.kind).toBe("cad3d");
  expect(hasErrors(validateDocument(store.getSnapshot()))).toBe(false);
  const restored = store.getSnapshot();
  expectIssue(
    () => applyCommands(store, result.undo),
    "page.kindLocked",
    "page.kind",
  );
  expect(store.getSnapshot()).toEqual(restored);
});

test("a CAD page can be created and renamed and CAD creation is undoable", () => {
  const editor = makeEditor();
  const page = editor.createPage({ kind: "cad3d" });
  expect(editor.renamePage(page, "Bracket")).toBe(true);
  const id = editor.createElement("cad.sketch");
  const created = editor.store.get(id);
  expect(created?.page).toBe(page);
  expect(editor.undo()).toBe(true);
  expect(editor.store.has(id)).toBe(false);
  expect(editor.redo()).toBe(true);
  expect(editor.store.get(id)).toEqual(created);
  expect(editor.store.getPage(page)?.name).toBe("Bracket");
  expect(hasErrors(validateDocument(editor.getSnapshot()))).toBe(false);
});
