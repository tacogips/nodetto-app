import {
  TABLE_SHEET_LIMITS,
  type TableSheetColumn,
  type TableSheetColumnType,
  type TableSheetSemantic,
} from "@nodetto/ir";
import type { IdSource } from "../ids.ts";
import type { TableSheetEditResult } from "./types.ts";
export const TABLE_SHEET_DEFAULT_COLUMN_WIDTH = 120;
export function nextTableSheetColumnName(
  columns: readonly TableSheetColumn[],
): string {
  const names = new Set(columns.map((c) => c.name));
  let n = 1;
  while (names.has(`Column ${n}`)) n++;
  return `Column ${n}`;
}
export function insertColumn(
  s: TableSheetSemantic,
  at: number,
  ids: IdSource,
  type: TableSheetColumnType = "text",
): TableSheetEditResult {
  if (s.columns.length >= TABLE_SHEET_LIMITS.maxColumns)
    return { ok: false, code: "table.limit", message: "Column limit exceeded" };
  const columns = [...s.columns];
  columns.splice(Math.max(0, Math.min(columns.length, at)), 0, {
    id: ids(),
    name: nextTableSheetColumnName(columns),
    type,
    width: TABLE_SHEET_DEFAULT_COLUMN_WIDTH,
  });
  return { ok: true, semantic: { ...s, columns }, skipped: 0 };
}
