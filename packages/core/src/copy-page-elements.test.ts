import { expect, test } from "bun:test";
import type { Page } from "@nodetto/ir";
import { document, element, makeEditor, TEST_PAGE } from "./test-helpers.ts";

const target: Page = {
  id: "target",
  name: "Target",
  kind: "freeform",
  order: "a2",
  hiddenInPresentation: true,
};
const empty: Page = {
  id: "empty",
  name: "Empty",
  kind: "freeform",
  order: "a3",
};
const sourceElements = [
  element({
    id: "a",
    type: "shape.geo",
    index: "a1",
    semantic: { geo: "rect" },
    visual: { x: 10, y: 20 },
  }),
  element({
    id: "b",
    type: "shape.geo",
    index: "a2",
    semantic: { geo: "rect" },
    visual: { x: 30, y: 40 },
  }),
  element({
    id: "edge",
    type: "edge.generic",
    index: "a3",
    semantic: { from: "a", to: "b" },
  }),
  element({
    id: "group",
    type: "group",
    index: "a4",
    semantic: { memberIds: ["a"] },
  }),
];
const existing = element({
  id: "existing",
  page: target.id,
  type: "shape.geo",
  index: "a1",
  semantic: { geo: "rect" },
});
const fixture = () =>
  makeEditor({
    document: document(
      [...sourceElements, existing],
      [{ ...TEST_PAGE, order: "a1" }, target, empty],
    ),
  });

test("copy remaps all elements above target, selects them, and undoes exactly", () => {
  const editor = fixture();
  const before = structuredClone(editor.store.getPageElements(target.id));
  const sourceBefore = structuredClone(
    editor.store.getPageElements(TEST_PAGE.id),
  );
  const ids = editor.copyPageElements(TEST_PAGE.id, target.id);
  expect(ids).toHaveLength(4);
  if (!ids) throw new Error("copy failed");
  expect(
    ids.every((id) => !sourceElements.some((entry) => entry.id === id)),
  ).toBe(true);
  const [a, b, edge, group] = ids;
  expect(editor.store.get(edge ?? "")?.semantic).toEqual({ from: a, to: b });
  expect(editor.store.get(group ?? "")?.semantic).toEqual({ memberIds: [a] });
  expect(editor.store.get(a ?? "")?.visual).toEqual(sourceElements[0]?.visual);
  expect(editor.store.get(b ?? "")?.visual).toEqual(sourceElements[1]?.visual);
  expect(
    editor.store.getPageElements(target.id).map((entry) => entry.id),
  ).toEqual([existing.id, ...ids]);
  expect(editor.currentPageId).toBe(target.id);
  expect([...editor.selection.ids()]).toEqual(ids);
  editor.undo();
  expect(editor.store.getPageElements(target.id)).toEqual(before);
  expect(editor.store.getPageElements(TEST_PAGE.id)).toEqual(sourceBefore);
  expect(editor.canUndo()).toBe(false);
});

test("invalid and empty sources do not create history", () => {
  const editor = fixture();
  const revision = editor.revision;
  expect(editor.copyPageElements(TEST_PAGE.id, TEST_PAGE.id)).toBeNull();
  expect(editor.copyPageElements("missing", target.id)).toBeNull();
  expect(editor.copyPageElements(TEST_PAGE.id, "missing")).toBeNull();
  expect(editor.copyPageElements(empty.id, target.id)).toEqual([]);
  expect(editor.revision).toBe(revision);
  expect(editor.canUndo()).toBe(false);
});

test("neighbors include hidden pages and stop at edges", () => {
  const editor = fixture();
  expect(editor.adjacentPageId(TEST_PAGE.id, "prev")).toBeNull();
  expect(editor.adjacentPageId(empty.id, "next")).toBeNull();
  expect(editor.adjacentPageId(TEST_PAGE.id, "next")).toBe(target.id);
  expect(editor.adjacentPageId(empty.id, "prev")).toBe(target.id);
  expect(editor.adjacentPageId(target.id, "prev")).toBe(TEST_PAGE.id);
  expect(editor.adjacentPageId(target.id, "next")).toBe(empty.id);
  expect(editor.adjacentPageId("missing", "next")).toBeNull();
});

test("duplicate page still remaps its connector", () => {
  const editor = fixture();
  const copy = editor.duplicatePage(TEST_PAGE.id);
  if (!copy) throw new Error("duplicate failed");
  const elements = editor.store.getPageElements(copy);
  expect(elements).toHaveLength(4);
  const [a, b, edge] = elements;
  expect(edge?.semantic).toEqual({ from: a?.id, to: b?.id });
});
