import {
  applyTableSheetEdit,
  setCellValue,
  type Editor,
  type TableSheetRange,
} from "@nodetto/core";
import type { ElementId, TableSheetSemantic } from "@nodetto/ir";
import { createSignal } from "solid-js";

export interface TableSheetCellRef {
  readonly rowId: string;
  readonly columnId: string;
}
export interface TableSheetSelectionState {
  readonly elementId: ElementId;
  readonly active: TableSheetCellRef;
  readonly anchor: TableSheetCellRef;
  readonly editing: boolean;
  readonly seed?: string;
}
export interface TableSheetSelection {
  state(): TableSheetSelectionState | null;
  activate(elementId: ElementId, cell: TableSheetCellRef): void;
  extend(cell: TableSheetCellRef): void;
  move(
    editor: Editor,
    dRow: number,
    dCol: number,
    options?: { extend?: boolean; wrap?: boolean },
  ): void;
  range(editor: Editor): TableSheetRange | null;
  startEditing(seed?: string): void;
  stopEditing(): void;
  clear(): void;
  reconcile(editor: Editor): void;
}

function semantic(editor: Editor, id: ElementId): TableSheetSemantic | null {
  const element = editor.store.get(id);
  return element?.type === "table.sheet"
    ? (element.semantic as TableSheetSemantic)
    : null;
}
function indices(
  s: TableSheetSemantic,
  cell: TableSheetCellRef,
): [number, number] {
  return [
    s.rows.findIndex((row) => row.id === cell.rowId),
    s.columns.findIndex((col) => col.id === cell.columnId),
  ];
}
export function createTableSheetSelection(): TableSheetSelection {
  const [state, setState] = createSignal<TableSheetSelectionState | null>(null);
  return {
    state,
    activate(elementId, cell) {
      setState({ elementId, active: cell, anchor: cell, editing: false });
    },
    extend(cell) {
      setState(
        (s) => s && { ...s, active: cell, editing: false, seed: undefined },
      );
    },
    move(editor, dRow, dCol, options) {
      const current = state();
      const s = current && semantic(editor, current.elementId);
      if (!current || !s || !s.rows.length || !s.columns.length) return;
      let [row, col] = indices(s, current.active);
      if (row < 0 || col < 0) return;
      row += dRow;
      col += dCol;
      if (options?.wrap) {
        while (col >= s.columns.length) {
          col -= s.columns.length;
          row++;
        }
        while (col < 0) {
          col += s.columns.length;
          row--;
        }
        if (row < 0) {
          row = 0;
          col = 0;
        }
        if (row >= s.rows.length) {
          row = s.rows.length - 1;
          col = s.columns.length - 1;
        }
      }
      row = Math.max(0, Math.min(s.rows.length - 1, row));
      col = Math.max(0, Math.min(s.columns.length - 1, col));
      const nextRow = s.rows[row];
      const nextCol = s.columns[col];
      if (!nextRow || !nextCol) return;
      const active = { rowId: nextRow.id, columnId: nextCol.id };
      setState({
        ...current,
        active,
        anchor: options?.extend ? current.anchor : active,
        editing: false,
        seed: undefined,
      });
    },
    range(editor) {
      const current = state();
      const s = current && semantic(editor, current.elementId);
      if (!current || !s) return null;
      const [ar, ac] = indices(s, current.active);
      const [br, bc] = indices(s, current.anchor);
      if (Math.min(ar, ac, br, bc) < 0) return null;
      return {
        top: Math.min(ar, br),
        left: Math.min(ac, bc),
        bottom: Math.max(ar, br),
        right: Math.max(ac, bc),
      };
    },
    startEditing(seed) {
      setState((s) => s && { ...s, editing: true, seed });
    },
    stopEditing() {
      setState((s) => s && { ...s, editing: false, seed: undefined });
    },
    clear() {
      setState(null);
    },
    reconcile(editor) {
      const current = state();
      if (!current) return;
      const s = semantic(editor, current.elementId);
      if (
        !s ||
        !editor.selection.has(current.elementId) ||
        [...indices(s, current.active), ...indices(s, current.anchor)].some(
          (i) => i < 0,
        )
      )
        setState(null);
    },
  };
}
export function tableSheetCellClick(
  editor: Editor,
  selection: TableSheetSelection,
  elementId: ElementId,
  cell: TableSheetCellRef,
  options: { shift: boolean },
): void {
  const current = selection.state();
  const s = semantic(editor, elementId);
  const row = s?.rows.find((r) => r.id === cell.rowId);
  const col = s?.columns.find((c) => c.id === cell.columnId);
  if (
    !options.shift &&
    current?.elementId === elementId &&
    current.active.rowId === cell.rowId &&
    current.active.columnId === cell.columnId &&
    col?.type === "checkbox" &&
    row
  ) {
    applyTableSheetEdit(editor, elementId, (fresh) => {
      const currentRow = fresh.rows.find((r) => r.id === cell.rowId);
      const value =
        currentRow && Object.hasOwn(currentRow.cells, cell.columnId)
          ? currentRow.cells[cell.columnId]?.value
          : undefined;
      return setCellValue(fresh, cell.rowId, cell.columnId, value !== true);
    });
  } else if (options.shift && current?.elementId === elementId)
    selection.extend(cell);
  else selection.activate(elementId, cell);
}
