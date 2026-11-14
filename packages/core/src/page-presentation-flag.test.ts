import { expect, test } from "bun:test";
import { CommandError } from "./commands.ts";
import { document, element, makeEditor, TEST_PAGE } from "./test-helpers.ts";

test("presentation flag setter is undoable, removes keys and skips no-ops", () => {
  const editor = makeEditor();
  const id = TEST_PAGE.id;
  expect(editor.setPageHiddenInPresentation(id, true)).toBe(true);
  expect(editor.store.getPage(id)?.hiddenInPresentation).toBe(true);
  const revision = editor.revision;
  expect(editor.setPageHiddenInPresentation(id, true)).toBe(false);
  expect(editor.revision).toBe(revision);
  editor.undo();
  expect(editor.store.getPage(id)).not.toHaveProperty("hiddenInPresentation");
  editor.redo();
  expect(editor.store.getPage(id)?.hiddenInPresentation).toBe(true);
  expect(editor.setPageHiddenInPresentation(id, false)).toBe(true);
  expect(editor.store.getPage(id)).not.toHaveProperty("hiddenInPresentation");
  expect(editor.setPageHiddenInPresentation("missing", true)).toBe(false);
});

test("explicit false is restored by undo and unrelated rename retains flag", () => {
  const editor = makeEditor({
    document: document([], [{ ...TEST_PAGE, hiddenInPresentation: false }]),
  });
  editor.setPageHiddenInPresentation(TEST_PAGE.id, true);
  editor.undo();
  expect(editor.store.getPage(TEST_PAGE.id)?.hiddenInPresentation).toBe(false);
  editor.setPageHiddenInPresentation(TEST_PAGE.id, true);
  editor.renamePage(TEST_PAGE.id, "Renamed");
  editor.undo();
  expect(editor.store.getPage(TEST_PAGE.id)?.hiddenInPresentation).toBe(true);
  expect(() =>
    editor.apply([
      {
        type: "updatePage",
        id: TEST_PAGE.id,
        page: { hiddenInPresentation: "x" as unknown as boolean },
      },
    ]),
  ).toThrow(CommandError);
  const copy = editor.duplicatePage(TEST_PAGE.id);
  expect(copy).not.toBeNull();
  expect(editor.store.getPage(copy!)?.hiddenInPresentation).toBe(true);
});

test("exportPageSvgOf renders a non-current page", () => {
  const second = { id: "second", name: "Second", kind: "freeform" as const };
  const editor = makeEditor({
    document: document(
      [
        element({
          id: "on-second",
          page: second.id,
          type: "node.generic",
          semantic: { label: "Widget" },
        }),
      ],
      [TEST_PAGE, second],
    ),
  });
  expect(editor.currentPageId).toBe(TEST_PAGE.id);
  expect(editor.exportPageSvgOf(second.id)).toContain('data-id="on-second"');
});
