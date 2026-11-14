import { expect, test } from "bun:test";
import { document, makeEditor, TEST_PAGE } from "./test-helpers.ts";

test("duplicate preserves an optional slide origin and is undoable", () => {
  for (const origin of [{ x: 10, y: 20 }, undefined]) {
    const page = { ...TEST_PAGE, ...(origin ? { slideOrigin: origin } : {}) };
    const editor = makeEditor({ document: document([], [page]) });
    const copy = editor.duplicatePage(page.id);
    if (!copy) throw new Error("duplicate failed");
    if (origin) expect(editor.store.getPage(copy)?.slideOrigin).toEqual(origin);
    else expect(editor.store.getPage(copy)).not.toHaveProperty("slideOrigin");
    editor.undo();
    expect(editor.store.getPage(copy)).toBeUndefined();
  }
});
