import { expect, test } from "bun:test";
import { hasErrors, validateDocument } from "@nodetto/ir";
import { parseDocument } from "@nodetto/io";
import type { Editor } from "../editor.ts";
import { document, erdFixture, makeEditor } from "../test-helpers.ts";

const plateSource = await Bun.file(
  new URL("../../../io/src/__fixtures__/cad3d.jsonl", import.meta.url),
).text();

function plateEditor(): Editor {
  return makeEditor({ document: parseDocument(plateSource) });
}

function expectValid(editor: Editor): void {
  expect(hasErrors(validateDocument(editor.getSnapshot()))).toBe(false);
}

test("duplicating a sketch entity keeps its sketch", () => {
  const editor = plateEditor();
  editor.selection.set(["circle-bore"]);
  const [copy] = editor.duplicateSelection();
  if (!copy) throw new Error("Expected a circle copy");
  expect(editor.store.get(copy)?.type).toBe("cad.circle");
  expect(editor.store.get(copy)?.semantic).toEqual(
    editor.store.get("circle-bore")?.semantic,
  );
  expectValid(editor);
});

test("duplicating a cut preserves its sketch, loop and body references", () => {
  const editor = plateEditor();
  editor.selection.set(["cut"]);
  const [copy] = editor.duplicateSelection();
  if (!copy) throw new Error("Expected an extrude copy");
  expect(editor.store.get(copy)?.type).toBe("cad.extrude");
  expect(editor.store.get(copy)?.semantic).toEqual(
    editor.store.get("cut")?.semantic,
  );
  expectValid(editor);
});

test("pasting a sketch with entities on a CAD page remaps the sketch id", () => {
  const editor = plateEditor();
  editor.selection.set(["sketch-top", "circle-bore"]);
  expect(editor.copySelection()).toBe(true);
  const page = editor.createPage({ kind: "cad3d" });
  const [sketch, circle] = editor.paste();
  if (!sketch || !circle) throw new Error("Expected a sketch and a circle");
  expect(editor.store.get(sketch)).toMatchObject({ type: "cad.sketch", page });
  expect(editor.store.get(circle)).toMatchObject({
    type: "cad.circle",
    page,
    semantic: { sketch, c: [30, 10], r: 2.125001 },
  });
  expectValid(editor);
});

test("a lone circle whose sketch is on another page is skipped", () => {
  const editor = plateEditor();
  editor.selection.set(["circle-bore"]);
  expect(editor.copySelection()).toBe(true);
  const target = editor.createPage({ kind: "cad3d" });
  const existing = editor.createElement("cad.sketch");
  editor.selection.set([existing]);
  const before = editor.getSnapshot();

  expect(editor.paste()).toEqual([]);
  expect(editor.getSnapshot()).toBe(before);
  expect([...editor.selection.ids()]).toEqual([existing]);
  expect(editor.store.getPageElements(target).map(({ id }) => id)).toEqual([
    existing,
  ]);
  expectValid(editor);
});

test("pasting between CAD and freeform skips incompatible shapes in both directions", () => {
  const editor = plateEditor();
  const cadPage = editor.currentPageId;
  editor.selection.set(["sketch-top", "circle-bore"]);
  expect(editor.copySelection()).toBe(true);
  const freeform = editor.createPage({ kind: "freeform" });
  let before = editor.getSnapshot();
  expect(editor.paste()).toEqual([]);
  expect(editor.getSnapshot()).toBe(before);

  const box = editor.createElement("shape.geo", { visual: { x: 20, y: 40 } });
  editor.selection.set([box]);
  expect(editor.copySelection()).toBe(true);
  editor.setCurrentPage(cadPage);
  before = editor.getSnapshot();
  expect(editor.paste()).toEqual([]);
  expect(editor.getSnapshot()).toBe(before);
  editor.setCurrentPage(freeform);
  const [copy] = editor.paste();
  if (!copy) throw new Error("Expected a freeform copy");
  expect(editor.store.get(copy)?.visual).toMatchObject({ x: 36, y: 56 });
  expectValid(editor);
});

test("pasting a cut on a different CAD page retains unresolved feature references", () => {
  const editor = plateEditor();
  editor.selection.set(["cut"]);
  expect(editor.copySelection()).toBe(true);
  const page = editor.createPage({ kind: "cad3d" });
  const [copy] = editor.paste();
  if (!copy) throw new Error("Expected a cut copy");
  expect(editor.store.get(copy)?.page).toBe(page);
  expect(editor.store.get(copy)?.semantic).toEqual(
    editor.store.get("cut")?.semantic,
  );
  expectValid(editor);
});

test("copy still drops a relation without its tables", () => {
  const editor = makeEditor({ document: document(erdFixture()) });
  editor.selection.set(["rel"]);
  expect(editor.copySelection()).toBe(false);
  expect(editor.paste()).toEqual([]);
  expect(editor.store.listElements()).toHaveLength(3);
});

test("pasting a sketch entity skips a reference to an element of the wrong type", () => {
  const editor = plateEditor();
  const id = editor.createElement("cad.line", {
    semantic: { sketch: "plate", a: [0, 0], b: [10, 20] },
  });
  editor.selection.set([id]);
  expect(editor.copySelection()).toBe(true);
  expect(editor.paste()).toEqual([]);
});
