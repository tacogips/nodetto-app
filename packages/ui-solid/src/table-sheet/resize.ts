import {
  applyTableSheetEdit,
  resizeColumn,
  resizeRow,
  TABLE_SHEET_DEFAULT_COLUMN_WIDTH,
  TABLE_SHEET_DEFAULT_ROW_HEIGHT,
  type Editor,
  type TableSheetLayout,
  type Vec,
} from "@nodetto/core";
import type { ElementId, TableSheetSemantic } from "@nodetto/ir";

export type TableSheetRegion =
  | { kind: "column-border"; columnId: string }
  | { kind: "row-border"; rowId: string }
  | { kind: "cell"; rowId: string; columnId: string };

export function tableSheetRegionAt(
  layout: TableSheetLayout,
  point: Vec,
  zoom: number,
): TableSheetRegion | null {
  const { box } = layout;
  if (
    point.x < box.x ||
    point.y < box.y ||
    point.x > box.x + box.width ||
    point.y > box.y + box.height
  )
    return null;
  const band = 4 / zoom;
  for (const column of layout.columns) {
    if (Math.abs(point.x - column.x - column.width) <= band)
      return { kind: "column-border", columnId: column.id };
  }
  for (const row of layout.rows) {
    if (Math.abs(point.y - row.y - row.height) <= band)
      return { kind: "row-border", rowId: row.id };
  }
  const row = layout.rows.find(
    (r) => point.y >= r.y && point.y < r.y + r.height,
  );
  const column = layout.columns.find(
    (c) => point.x >= c.x && point.x < c.x + c.width,
  );
  return row && column
    ? { kind: "cell", rowId: row.id, columnId: column.id }
    : null;
}

export function beginTableSheetResize(
  editor: Editor,
  elementId: ElementId,
  region: Extract<TableSheetRegion, { kind: "column-border" | "row-border" }>,
  start: Vec,
): { move(point: Vec): void; end(): void; cancel(): void } {
  const element = editor.store.get(elementId);
  const semantic =
    element?.type === "table.sheet"
      ? (element.semantic as TableSheetSemantic)
      : undefined;
  const initial =
    region.kind === "column-border"
      ? semantic?.columns.find((c) => c.id === region.columnId)?.width
      : semantic?.rows.find((r) => r.id === region.rowId)
        ? (semantic.rows.find((r) => r.id === region.rowId)?.height ??
          TABLE_SHEET_DEFAULT_ROW_HEIGHT)
        : undefined;
  let closed = false;
  editor.beginBatch();
  return {
    move(point) {
      if (closed || initial === undefined) return;
      if (region.kind === "column-border")
        applyTableSheetEdit(editor, elementId, (s) =>
          resizeColumn(s, region.columnId, initial + point.x - start.x),
        );
      else
        applyTableSheetEdit(editor, elementId, (s) =>
          resizeRow(s, region.rowId, initial + point.y - start.y),
        );
    },
    end() {
      if (closed) return;
      closed = true;
      const current = editor.store.get(elementId)?.semantic as
        | TableSheetSemantic
        | undefined;
      const size =
        region.kind === "column-border"
          ? current?.columns.find((c) => c.id === region.columnId)?.width
          : (current?.rows.find((r) => r.id === region.rowId)?.height ??
            TABLE_SHEET_DEFAULT_ROW_HEIGHT);
      if (size === initial) editor.abortBatch();
      else editor.endBatch();
    },
    cancel() {
      if (!closed) {
        closed = true;
        editor.abortBatch();
      }
    },
  };
}

export function resetColumnWidth(
  editor: Editor,
  elementId: ElementId,
  columnId: string,
): boolean {
  const before = editor.store.get(elementId)?.semantic;
  const result = applyTableSheetEdit(editor, elementId, (s) =>
    resizeColumn(s, columnId, TABLE_SHEET_DEFAULT_COLUMN_WIDTH),
  );
  return result.ok && result.semantic !== before;
}
