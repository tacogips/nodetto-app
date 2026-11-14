import { expect, test } from "bun:test";
import { createDefaultRegistry, Editor } from "@nodetto/core";
import {
  canDeletePage,
  deletePagePrompt,
  deletePageWithConfirm,
  duplicatePageAction,
  pageMenuItems,
  togglePagePresentation,
} from "./page-actions.ts";

const horizontal = { copyShapes: true, axis: "horizontal" } as const;

test("menu descriptors preserve order, labels, titles and boundary rules", () => {
  const editor = new Editor();
  const first = editor.currentPageId;
  const middle = editor.createPage({ name: "Middle" });
  const last = editor.createPage({ name: "Last" });
  expect(pageMenuItems(editor, middle, horizontal)).toEqual([
    { key: "rename", label: "Rename", title: "Rename page", disabled: false },
    {
      key: "duplicate",
      label: "Duplicate",
      title: "Duplicate page and everything on it",
      disabled: false,
    },
    { key: "copyShapes", label: "Copy shapes from page...", disabled: false },
    { key: "presentation", label: "Hide in presentation", disabled: false },
    { key: "delete", label: "Delete", title: "Delete page", disabled: false },
    { key: "moveBack", label: "Move left", disabled: false },
    { key: "moveForward", label: "Move right", disabled: false },
  ]);
  const vertical = pageMenuItems(editor, middle, {
    copyShapes: false,
    axis: "vertical",
  });
  expect(vertical.map((item) => item.key)).not.toContain("copyShapes");
  expect(vertical.slice(-2).map((item) => item.label)).toEqual([
    "Move up",
    "Move down",
  ]);
  expect(
    pageMenuItems(editor, first, horizontal).find(
      (item) => item.key === "moveBack",
    )?.disabled,
  ).toBe(true);
  expect(
    pageMenuItems(editor, last, horizontal).find(
      (item) => item.key === "moveForward",
    )?.disabled,
  ).toBe(true);
});

test("single page and read-only disable the specified actions", () => {
  const editor = new Editor();
  const id = editor.currentPageId;
  const single = pageMenuItems(editor, id, horizontal);
  expect(single.find((item) => item.key === "copyShapes")?.disabled).toBe(true);
  expect(single.find((item) => item.key === "delete")).toEqual({
    key: "delete",
    label: "Delete",
    title: "The last page cannot be deleted",
    disabled: true,
  });
  expect(canDeletePage(editor)).toBe(false);
  expect(deletePageWithConfirm(editor, id, () => true)).toBe("unavailable");
  editor.createPage();
  editor.setReadOnly(true);
  const before = editor.getSnapshot();
  const items = pageMenuItems(editor, id, horizontal);
  for (const key of ["copyShapes", "presentation", "delete"])
    expect(items.find((item) => item.key === key)?.disabled).toBe(true);
  expect(duplicatePageAction(editor, id)).toBe(false);
  togglePagePresentation(editor, id);
  expect(deletePageWithConfirm(editor, id, () => true)).toBe("unavailable");
  expect(editor.getSnapshot()).toEqual(before);
});

test("duplicate and presentation changes are undoable", () => {
  const editor = new Editor();
  const id = editor.currentPageId;
  const before = editor.getSnapshot();
  expect(duplicatePageAction(editor, id)).toBe(true);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
  editor.setPageHiddenInPresentation(id, true);
  expect(
    pageMenuItems(editor, id, horizontal).find(
      (item) => item.key === "presentation",
    )?.label,
  ).toBe("Show in presentation");
  togglePagePresentation(editor, id);
  expect(editor.store.getPage(id)?.hiddenInPresentation === true).toBe(false);
  editor.undo();
  expect(editor.store.getPage(id)?.hiddenInPresentation).toBe(true);
});

test("deletion confirms only nonempty pages and supports undo", () => {
  const editor = new Editor({ registry: createDefaultRegistry() });
  const first = editor.currentPageId;
  const empty = editor.createPage({ name: "Empty" });
  const before = editor.getSnapshot();
  let calls = 0;
  expect(
    deletePageWithConfirm(editor, empty, () => {
      calls++;
      return true;
    }),
  ).toBe("deleted");
  expect(calls).toBe(0);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
  editor.setCurrentPage(first);
  editor.createElement("text.note", { semantic: { text: "Checkout" } });
  const page = editor.store.getPage(first);
  if (!page) throw new Error("missing page");
  const withElement = editor.getSnapshot();
  let prompt = "";
  expect(
    deletePageWithConfirm(editor, first, (message) => {
      prompt = message;
      return false;
    }),
  ).toBe("cancelled");
  expect(prompt).toBe(deletePagePrompt(page, 1));
  expect(prompt).toBe(`Delete page "${page.name}" and the 1 element on it?`);
  expect(deletePagePrompt(page, 2)).toBe(
    `Delete page "${page.name}" and the 2 elements on it?`,
  );
  expect(editor.getSnapshot()).toEqual(withElement);
  expect(deletePageWithConfirm(editor, "missing", () => true)).toBe(
    "unavailable",
  );
  expect(deletePageWithConfirm(editor, first, () => true)).toBe("deleted");
  editor.undo();
  expect(editor.getSnapshot()).toEqual(withElement);
});
