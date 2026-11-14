import { expect, test } from "bun:test";
import {
  applyTableSheetEdit,
  defaultTableSheetSemantic,
  deleteColumns,
  Editor,
} from "@nodetto/core";
import type { TableSheetSemantic } from "@nodetto/ir";
import { createTableSheetSelection, tableSheetCellClick } from "./selection.ts";

function setup(checkbox = false) {
  const editor = new Editor();
  const s = defaultTableSheetSemantic();
  const semantic: TableSheetSemantic = checkbox
    ? {
        ...s,
        columns: s.columns.map((c, i) =>
          i === 0 ? { ...c, type: "checkbox" } : c,
        ),
      }
    : s;
  const id = editor.createElement("table.sheet", {
    semantic,
    visual: { x: 0, y: 0 },
  });
  editor.selection.set([id]);
  const selection = createTableSheetSelection();
  selection.activate(id, { rowId: "r1", columnId: "c1" });
  return { editor, id, selection };
}
test("movement clamps to edges", () => {
  const { editor, selection } = setup();
  selection.move(editor, 0, 1);
  expect(selection.state()?.active).toEqual({ rowId: "r1", columnId: "c2" });
  selection.move(editor, 0, 20);
  expect(selection.state()?.active.columnId).toBe("c3");
});
test("wrapped movement advances and clamps at corners", () => {
  const { editor, id, selection } = setup();
  selection.activate(id, { rowId: "r1", columnId: "c3" });
  selection.move(editor, 0, 1, { wrap: true });
  expect(selection.state()?.active).toEqual({ rowId: "r2", columnId: "c1" });
  selection.activate(id, { rowId: "r1", columnId: "c1" });
  selection.move(editor, 0, -1, { wrap: true });
  expect(selection.state()?.active).toEqual({ rowId: "r1", columnId: "c1" });
});
test("extension retains anchor and produces inclusive range", () => {
  const { editor, selection } = setup();
  selection.move(editor, 1, 1, { extend: true });
  expect(selection.range(editor)).toEqual({
    top: 0,
    left: 0,
    bottom: 1,
    right: 1,
  });
});
test("reconcile clears deleted cell ids and deselection", () => {
  const { editor, id, selection } = setup();
  applyTableSheetEdit(editor, id, (s) => deleteColumns(s, ["c1"]));
  selection.reconcile(editor);
  expect(selection.state()).toBeNull();
  selection.activate(id, { rowId: "r1", columnId: "c2" });
  editor.selection.clear();
  selection.reconcile(editor);
  expect(selection.state()).toBeNull();
});
test("active checkbox click toggles in one undo entry", () => {
  const { editor, id, selection } = setup(true);
  const undo = editor.history.undoSize;
  tableSheetCellClick(
    editor,
    selection,
    id,
    { rowId: "r1", columnId: "c1" },
    { shift: false },
  );
  expect(
    (editor.store.get(id)?.semantic as TableSheetSemantic).rows[0]?.cells.c1
      ?.value,
  ).toBe(true);
  expect(editor.history.undoSize).toBe(undo + 1);
  editor.undo();
  expect(
    (editor.store.get(id)?.semantic as TableSheetSemantic).rows[0]?.cells.c1,
  ).toBeUndefined();
});
