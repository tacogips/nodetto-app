import { describe, expect, test } from "bun:test";
import { Editor } from "./editor.ts";

describe("page modes", () => {
  test("a page remembers its mode, and undoing other page edits keeps it", () => {
    const editor = new Editor();
    const page = editor.currentPageId;
    expect(editor.setPageMode(page, "erd", { history: "ignore" })).toBe(true);
    expect(editor.setPageMode(page, "erd")).toBe(false);
    editor.renamePage(page, "Schema");
    editor.setPageMode(page, "class", { history: "ignore" });
    editor.undo();
    expect(editor.store.getPage(page)).toMatchObject({
      name: "Page 1",
      mode: "class",
    });
    expect(editor.setPageMode(page, null)).toBe(true);
    expect(editor.store.getPage(page)?.mode).toBeUndefined();
    editor.undo();
    expect(editor.store.getPage(page)?.mode).toBe("class");
  });

  test("new and duplicated pages carry a mode; unknown modes are rejected", () => {
    const editor = new Editor();
    const page = editor.createPage({ name: "Use cases", mode: "usecase" });
    expect(editor.store.getPage(page)?.mode).toBe("usecase");
    const copy = editor.duplicatePage(page);
    expect(editor.store.getPage(copy ?? "")?.mode).toBe("usecase");
    expect(() =>
      editor.apply([
        {
          type: "updatePage",
          id: page,
          page: { mode: "nonsense" as never },
        },
      ]),
    ).toThrow();
  });
});
