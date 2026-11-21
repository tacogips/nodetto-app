import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { duplicatePageAction, pageMenuItems } from "./page-actions.ts";
import { isShapeEntryEnabled, newPageOptionsFor } from "./page-kind-ui.ts";

test("add-page uses the current CAD kind and counts only existing CAD pages", () => {
  const freeform = { kind: "freeform" } as const;
  const cad = { kind: "cad3d" } as const;
  expect(newPageOptionsFor(cad, [freeform, cad], true)).toEqual({
    kind: "cad3d",
    name: "3D CAD 2",
  });
  expect(newPageOptionsFor(cad, [freeform, cad, cad], true)).toEqual({
    kind: "cad3d",
    name: "3D CAD 3",
  });
  expect(newPageOptionsFor(freeform, [freeform, cad], true)).toEqual({});
  expect(newPageOptionsFor(cad, [freeform, cad], false)).toEqual({});
  expect(newPageOptionsFor(undefined, [freeform, cad], false)).toEqual({});
  expect(isShapeEntryEnabled(cad)).toBe(false);
  expect(isShapeEntryEnabled(freeform)).toBe(true);
});

test("the page menu cannot duplicate a CAD page when CAD creation is disabled", () => {
  const editor = new Editor();
  const freeform = editor.currentPageId;
  const cad = editor.createPage({ kind: "cad3d" });
  const duplicateItem = (id: string) =>
    pageMenuItems(editor, id, {
      axis: "horizontal",
      copyShapes: false,
      cadAllowed: false,
    }).find(({ key }) => key === "duplicate");
  expect(duplicateItem(cad)?.disabled).toBe(true);
  expect(duplicateItem(freeform)?.disabled).toBe(false);
  expect(duplicatePageAction(editor, cad, false)).toBe(false);
  expect(editor.store.listPages()).toHaveLength(2);
  expect(duplicatePageAction(editor, cad)).toBe(true);
  expect(editor.store.getPage(editor.currentPageId)?.kind).toBe("cad3d");
});
