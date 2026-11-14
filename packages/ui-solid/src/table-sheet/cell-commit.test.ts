import { expect, test } from "bun:test";
import { defaultTableSheetSemantic, Editor } from "@nodetto/core";
import type { TableSheetSemantic } from "@nodetto/ir";
import { cellEditorInitialText, commitCellText } from "./cell-commit.ts";
import { createTableSheetSelection } from "./selection.ts";

function setup(semantic = defaultTableSheetSemantic()) {
  const editor = new Editor();
  const id = editor.createElement("table.sheet", {
    semantic,
    visual: { x: 0, y: 0 },
  });
  editor.selection.set([id]);
  const selection = createTableSheetSelection();
  selection.activate(id, { rowId: "r1", columnId: "c1" });
  const current = () => editor.store.get(id)?.semantic as TableSheetSemantic;
  return { editor, id, selection, current };
}
test("commit records one edit and moves down", () => {
  const { editor, selection, current } = setup();
  const n = editor.history.undoSize;
  selection.startEditing();
  expect(commitCellText(editor, selection, "Widget", "down")?.ok).toBe(true);
  expect(current().rows[0]?.cells.c1?.value).toBe("Widget");
  expect(selection.state()?.active.rowId).toBe("r2");
  expect(editor.history.undoSize).toBe(n + 1);
  editor.undo();
  expect(current().rows[0]?.cells.c1).toBeUndefined();
});
test("down at last row does not grow", () => {
  const { editor, id, selection, current } = setup();
  selection.activate(id, { rowId: "r3", columnId: "c1" });
  commitCellText(editor, selection, "Widget", "down");
  expect(selection.state()?.active.rowId).toBe("r3");
  expect(current().rows).toHaveLength(3);
});
test("right wraps to next row", () => {
  const { editor, id, selection } = setup();
  selection.activate(id, { rowId: "r1", columnId: "c3" });
  commitCellText(editor, selection, "TRUE", "right");
  expect(selection.state()?.active).toEqual({ rowId: "r2", columnId: "c1" });
});
test("invalid number clears value and reports skipped", () => {
  const base = defaultTableSheetSemantic();
  const semantic: TableSheetSemantic = {
    ...base,
    columns: base.columns.map((c, i) =>
      i === 0 ? { ...c, type: "number" } : c,
    ),
    rows: base.rows.map((r, i) =>
      i === 0 ? { ...r, cells: { c1: { value: 12 } } } : r,
    ),
  };
  const { editor, selection, current } = setup(semantic);
  const result = commitCellText(editor, selection, "x", "none");
  expect(result?.ok && result.skipped).toBe(1);
  expect(current().rows[0]?.cells.c1).toBeUndefined();
});
test("unchanged text creates no history", () => {
  const { editor, selection } = setup();
  const n = editor.history.undoSize;
  expect(commitCellText(editor, selection, "", "none")).toBeNull();
  expect(editor.history.undoSize).toBe(n);
});
test("initial text preserves stored newlines and seed", () => {
  const base = defaultTableSheetSemantic();
  const semantic: TableSheetSemantic = {
    ...base,
    rows: base.rows.map((r, i) =>
      i === 0 ? { ...r, cells: { c1: { value: "alpha\nbeta" } } } : r,
    ),
  };
  const { editor, selection } = setup(semantic);
  expect(cellEditorInitialText(editor, selection)).toBe("alpha\nbeta");
  selection.startEditing("z");
  expect(cellEditorInitialText(editor, selection)).toBe("z");
});
