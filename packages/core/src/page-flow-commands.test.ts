import { expect, test } from "bun:test";
import { CommandError } from "./commands.ts";
import { document, makeEditor, TEST_PAGE } from "./test-helpers.ts";
test("page flow updates preserve omission and invert exactly", () => {
  const editor = makeEditor();
  const id = TEST_PAGE.id;
  editor.apply([{ type: "updatePage", id, page: { pageFlow: "horizontal" } }]);
  editor.undo();
  expect(editor.store.getPage(id)).not.toHaveProperty("pageFlow");
  editor.redo();
  editor.apply([{ type: "updatePage", id, page: { name: "renamed" } }]);
  expect(editor.store.getPage(id)?.pageFlow).toBe("horizontal");
  editor.apply([{ type: "updatePage", id, page: { pageFlow: null } }]);
  expect(editor.store.getPage(id)).not.toHaveProperty("pageFlow");
  editor.undo();
  expect(editor.store.getPage(id)?.pageFlow).toBe("horizontal");
  try {
    editor.apply([
      {
        type: "updatePage",
        id,
        page: { pageFlow: "diagonal" as "horizontal" },
      },
    ]);
    throw new Error("expected error");
  } catch (e) {
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).issues).toContainEqual(
      expect.objectContaining({ code: "type.enum", path: "page.pageFlow" }),
    );
  }
});
test("duplicate page retains explicit flow", () => {
  const page = { ...TEST_PAGE, pageFlow: "vertical" as const };
  const editor = makeEditor({ document: document([], [page]) });
  const copy = editor.duplicatePage(page.id);
  if (!copy) throw new Error("duplicate failed");
  expect(editor.store.getPage(copy)?.pageFlow).toBe("vertical");
});
