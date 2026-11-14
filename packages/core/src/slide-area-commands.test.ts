import { expect, test } from "bun:test";
import { CommandError } from "./commands.ts";
import { document, makeEditor, TEST_PAGE } from "./test-helpers.ts";
const a = { width: 1920, height: 1080 };
const b = { width: 100, height: 200 };
test("document slide size sets, clears and undoes with metadata notifications", () => {
  const editor = makeEditor();
  let changed = false;
  editor.store.subscribe((diff) => {
    changed = diff.pagesChanged;
  });
  editor.apply([{ type: "updateDocument", document: { slideSize: a } }]);
  expect(changed).toBe(true);
  expect(editor.store.getMeta().slideSize).toEqual(a);
  editor.undo();
  expect(editor.store.getMeta()).not.toHaveProperty("slideSize");
  editor.redo();
  expect(editor.store.getMeta().slideSize).toEqual(a);
  editor.apply([{ type: "updateDocument", document: { slideSize: b } }]);
  editor.undo();
  expect(editor.store.getMeta().slideSize).toEqual(a);
  editor.apply([{ type: "updateDocument", document: { slideSize: null } }]);
  expect(editor.store.getMeta()).not.toHaveProperty("slideSize");
  const snapshot = editor.store.getSnapshot();
  expect(() =>
    editor.apply([
      {
        type: "updateDocument",
        document: { slideSize: { width: 0, height: 2 } },
      },
    ]),
  ).toThrow(CommandError);
  expect(editor.store.getSnapshot()).toEqual(snapshot);
});
test("page origin survives unrelated edits and undo restores cleared value", () => {
  const editor = makeEditor();
  const id = TEST_PAGE.id;
  const origin = { x: -50, y: 100 };
  editor.apply([{ type: "updatePage", id, page: { slideOrigin: origin } }]);
  editor.apply([{ type: "updatePage", id, page: { name: "renamed" } }]);
  expect(editor.store.getPage(id)?.slideOrigin).toEqual(origin);
  editor.apply([{ type: "updatePage", id, page: { slideOrigin: null } }]);
  expect(editor.store.getPage(id)).not.toHaveProperty("slideOrigin");
  editor.undo();
  expect(editor.store.getPage(id)?.slideOrigin).toEqual(origin);
  expect(() =>
    editor.apply([
      {
        type: "updatePage",
        id,
        page: { slideOrigin: { x: Number.POSITIVE_INFINITY, y: 0 } },
      },
    ]),
  ).toThrow(CommandError);
});
test("editor load and snapshots retain only present slide size", () => {
  expect(
    makeEditor({
      document: { ...document([]), slideSize: a },
    }).store.getSnapshot().slideSize,
  ).toEqual(a);
  expect(makeEditor().getSnapshot()).not.toHaveProperty("slideSize");
});
