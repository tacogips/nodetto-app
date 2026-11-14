import {
  applyTableSheetEdit,
  clipboardCellText,
  readTableSheet,
  setCellText,
  type Editor,
  type TableSheetEditResult,
} from "@nodetto/core";
import type { TableSheetSelection } from "./selection.ts";

export function cellEditorInitialText(
  editor: Editor,
  selection: TableSheetSelection,
): string {
  const state = selection.state();
  if (!state) return "";
  if (state.seed !== undefined) return state.seed;
  const element = editor.store.get(state.elementId);
  if (!element || element.type !== "table.sheet") return "";
  const semantic = readTableSheet(element.semantic);
  const column = semantic.columns.find((c) => c.id === state.active.columnId);
  const row = semantic.rows.find((r) => r.id === state.active.rowId);
  return column && row
    ? clipboardCellText(
        column,
        Object.hasOwn(row.cells, column.id) ? row.cells[column.id] : undefined,
      )
    : "";
}

export function commitCellText(
  editor: Editor,
  selection: TableSheetSelection,
  text: string,
  move: "down" | "right" | "left" | "none",
): TableSheetEditResult | null {
  const state = selection.state();
  if (!state) return null;
  const element = editor.store.get(state.elementId);
  if (!element || element.type !== "table.sheet") {
    selection.stopEditing();
    return null;
  }
  const semantic = readTableSheet(element.semantic);
  const column = semantic.columns.find((c) => c.id === state.active.columnId);
  const row = semantic.rows.find((r) => r.id === state.active.rowId);
  if (!column || !row) {
    selection.stopEditing();
    return null;
  }
  const initial = clipboardCellText(
    column,
    Object.hasOwn(row.cells, column.id) ? row.cells[column.id] : undefined,
  );
  const result =
    text === initial
      ? null
      : applyTableSheetEdit(editor, state.elementId, (s) =>
          setCellText(s, row.id, column.id, text),
        );
  selection.stopEditing();
  if (move === "down") selection.move(editor, 1, 0);
  if (move === "right") selection.move(editor, 0, 1, { wrap: true });
  if (move === "left") selection.move(editor, 0, -1, { wrap: true });
  return result;
}
