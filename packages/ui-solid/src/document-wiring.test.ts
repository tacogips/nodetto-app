import { expect, test } from "bun:test";
import { createDefaultRegistry, Editor } from "@nodetto/core";
import { COMMON_SHAPES } from "./shape-palette.ts";
import { type ActionContext, getAction, runAction } from "./shortcuts.ts";
import { Tool } from "./tools.ts";

function context(editor: Editor): ActionContext {
  return {
    editor,
    viewport: { width: 800, height: 600 },
    requestEdit: () => {},
    exportSvg: () => {},
  };
}

test("document palette tiles are consecutive and ordered", () => {
  const start = COMMON_SHAPES.findIndex(
    (item) => item.tool === Tool.CodeSnippet,
  );
  expect(start).toBeGreaterThanOrEqual(0);
  expect(COMMON_SHAPES.slice(start, start + 3)).toMatchObject([
    { tool: Tool.CodeSnippet, label: "Code snippet" },
    { tool: Tool.MarkdownSnippet, label: "Markdown snippet" },
    { label: "Page", action: "add-page-frame" },
  ]);
});

test("add page is undoable in one step and disabled in read-only mode", () => {
  const editor = new Editor({ registry: createDefaultRegistry() });
  const ctx = context(editor);
  const action = getAction("addPageFrame");
  const before = editor.getSnapshot();
  const historyBefore = editor.history.undoSize;
  expect(action.label).toBe("Add page");
  expect(action.enabled(ctx)).toBe(true);
  expect(runAction(action, ctx)).toBe(true);
  const [id] = editor.selection.ids();
  if (!id) throw new Error("Page frame was not selected");
  const frame = editor.store.get(id);
  expect(frame?.type).toBe("frame");
  expect(frame?.semantic).toMatchObject({ page: expect.any(Object) });
  expect(editor.history.undoSize).toBe(historyBefore + 1);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
  editor.setReadOnly(true);
  expect(action.enabled(ctx)).toBe(false);
  expect(runAction(action, ctx)).toBe(false);
  expect(editor.getSnapshot()).toEqual(before);
});

test("page navigation is available to viewers and does not change history", () => {
  const editor = new Editor({ registry: createDefaultRegistry() });
  const ctx = context(editor);
  const next = getAction("nextPageFrame");
  const previous = getAction("previousPageFrame");
  expect([next.label, previous.label]).toEqual([
    "Next page frame",
    "Previous page frame",
  ]);
  expect([next.shortcut, previous.shortcut]).toEqual(["PageDown", "PageUp"]);
  expect(next.enabled(ctx)).toBe(false);
  expect(previous.enabled(ctx)).toBe(false);
  expect(runAction(getAction("addPageFrame"), ctx)).toBe(true);
  const [a] = editor.selection.ids();
  expect(runAction(getAction("addPageFrame"), ctx)).toBe(true);
  const [b] = editor.selection.ids();
  if (!a || !b) throw new Error("Page frames were not selected");
  const first = editor.store.get(a);
  const second = editor.store.get(b);
  if (!first || !second) throw new Error("Page frames missing from store");
  expect(next.enabled(ctx)).toBe(true);
  expect(previous.enabled(ctx)).toBe(true);
  const box = (visual: typeof first.visual) => {
    const { x, y, width, height } = visual;
    if (
      x === undefined ||
      y === undefined ||
      width === undefined ||
      height === undefined
    )
      throw new Error("Page frame bounds are incomplete");
    return { x, y, width, height };
  };
  const firstBox = box(first.visual);
  const secondBox = box(second.visual);
  editor.camera.fitBox(firstBox, ctx.viewport, { maxZoom: 4 });
  const historyBefore = editor.history.undoSize;
  editor.setReadOnly(true);
  expect(next.enabled(ctx)).toBe(true);
  expect(previous.enabled(ctx)).toBe(true);
  const center = () => editor.camera.screenToPage({ x: 400, y: 300 });
  expect(runAction(next, ctx)).toBe(true);
  expect(center().x).toBeCloseTo(secondBox.x + secondBox.width / 2);
  expect(center().y).toBeCloseTo(secondBox.y + secondBox.height / 2);
  expect(runAction(previous, ctx)).toBe(true);
  expect(center().x).toBeCloseTo(firstBox.x + firstBox.width / 2);
  expect(center().y).toBeCloseTo(firstBox.y + firstBox.height / 2);
  expect(editor.history.undoSize).toBe(historyBefore);
});
