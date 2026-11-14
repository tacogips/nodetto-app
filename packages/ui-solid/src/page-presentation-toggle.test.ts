import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  PRESENTATION_HIDDEN_TAB_CLASS,
  PRESENTATION_HIDDEN_TITLE_SUFFIX,
  presentationToggleLabel,
} from "./page-presentation-toggle.ts";

test("presentation toggle labels and tab markers", () => {
  expect(presentationToggleLabel(false)).toBe("Hide in presentation");
  expect(presentationToggleLabel(true)).toBe("Show in presentation");
  expect(PRESENTATION_HIDDEN_TITLE_SUFFIX).toBe(" (hidden in presentation)");
  expect(PRESENTATION_HIDDEN_TAB_CLASS).toBe(
    "nodetto-page-tab-presentation-hidden",
  );
});

test("presentation toggle removes the flag and undo restores the previous page", () => {
  const editor = new Editor();
  const id = editor.currentPageId;
  const before = editor.getSnapshot();
  editor.setPageHiddenInPresentation(id, true);
  expect(editor.store.getPage(id)?.hiddenInPresentation).toBe(true);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
  editor.setPageHiddenInPresentation(id, true);
  editor.setPageHiddenInPresentation(id, false);
  expect(Object.hasOwn(editor.store.getPage(id)!, "hiddenInPresentation")).toBe(
    false,
  );
});
