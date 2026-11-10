import {
  TABLE_SHEET_LIMITS,
  type TableSheetColumn,
  type TableSheetColumnType,
  type TableSheetSemantic,
} from "@nodetto/ir";
import type { IdSource } from "../ids.ts";
import { clipboardCellText, setCellText } from "./coerce.ts";
import {
  nextTableSheetColumnName,
  TABLE_SHEET_DEFAULT_COLUMN_WIDTH,
} from "./columns.ts";
import type { TableSheetEditResult, TableSheetRange } from "./types.ts";
const limit = (message: string): TableSheetEditResult => ({
  ok: false,
  code: "table.limit",
  message,
});
export function clipboardGrid(
  s: TableSheetSemantic,
  range: TableSheetRange,
): string[][] {
  const result: string[][] = [];
  for (
    let r = Math.max(0, range.top);
    r <= Math.min(range.bottom, s.rows.length - 1);
    r++
  ) {
    const row = s.rows[r];
    if (!row) continue;
    const line: string[] = [];
    for (
      let c = Math.max(0, range.left);
      c <= Math.min(range.right, s.columns.length - 1);
      c++
    ) {
      const col = s.columns[c];
      if (col)
        line.push(
          clipboardCellText(
            col,
            Object.hasOwn(row.cells, col.id) ? row.cells[col.id] : undefined,
          ),
        );
    }
    result.push(line);
  }
  return result;
}
export function pasteGrid(
  s: TableSheetSemantic,
  at: { row: number; column: number },
  grid: readonly (readonly string[])[],
  ids: IdSource,
): TableSheetEditResult {
  if (!grid.length || !grid.some((row) => row.length))
    return { ok: true, semantic: s, skipped: 0 };
  const startRow = Math.max(
    0,
    Math.min(at.row, Math.max(0, s.rows.length - 1)),
  );
  const startCol = Math.max(
    0,
    Math.min(at.column, Math.max(0, s.columns.length - 1)),
  );
  const rowCount = Math.max(s.rows.length, startRow + grid.length);
  const colCount = Math.max(
    s.columns.length,
    startCol + Math.max(...grid.map((r) => r.length)),
  );
  if (
    rowCount > TABLE_SHEET_LIMITS.maxRows ||
    colCount > TABLE_SHEET_LIMITS.maxColumns
  )
    return limit("Table size limit exceeded");
  // Apply to a temporary table with placeholder IDs first so all limits are checked before consuming IDs.
  const columns = [...s.columns];
  while (columns.length < colCount)
    columns.push({
      id: `__newcol${columns.length}`,
      name: nextTableSheetColumnName(columns),
      type: "text",
      width: TABLE_SHEET_DEFAULT_COLUMN_WIDTH,
    });
  const rows = [...s.rows];
  while (rows.length < rowCount)
    rows.push({ id: `__newrow${rows.length}`, cells: {} });
  let next: TableSheetSemantic = { ...s, columns, rows };
  let skipped = 0;
  for (let r = 0; r < grid.length; r++) {
    const line = grid[r];
    if (!line) continue;
    for (let c = 0; c < line.length; c++) {
      const row = next.rows[startRow + r];
      const col = next.columns[startCol + c];
      if (!row || !col) continue;
      const result = setCellText(next, row.id, col.id, line[c] ?? "");
      if (!result.ok) return result;
      next = result.semantic;
      skipped += result.skipped;
    }
  }
  if (
    next.rows.length === s.rows.length &&
    next.columns.length === s.columns.length &&
    next.rows.every((r, i) => r === s.rows[i]) &&
    next.columns.every((c, i) => c === s.columns[i])
  )
    return { ok: true, semantic: s, skipped };
  const mapping = new Map<string, string>();
  for (let i = s.columns.length; i < next.columns.length; i++) {
    const col = next.columns[i];
    if (col) mapping.set(col.id, ids());
  }
  const finalColumns = next.columns.map((col) =>
    mapping.has(col.id) ? { ...col, id: mapping.get(col.id) as string } : col,
  );
  const finalRows = next.rows.map((row, i) => {
    const cells = { ...row.cells };
    let changed = false;
    for (const [before, after] of mapping)
      if (Object.hasOwn(cells, before)) {
        changed = true;
        cells[after] = cells[before] as NonNullable<(typeof cells)[string]>;
        delete cells[before];
      }
    return i >= s.rows.length
      ? { ...row, id: ids(), cells }
      : changed
        ? { ...row, cells }
        : row;
  });
  return {
    ok: true,
    semantic: { ...next, columns: finalColumns, rows: finalRows },
    skipped,
  };
}
export function tableSheetFromGrid(
  grid: readonly (readonly string[])[],
  options: {
    header: boolean;
    types?: readonly TableSheetColumnType[];
    widths?: readonly number[];
  },
): TableSheetEditResult {
  const count = Math.max(1, ...grid.map((r) => r.length));
  const records = options.header ? grid.slice(1) : grid;
  if (
    count > TABLE_SHEET_LIMITS.maxColumns ||
    records.length > TABLE_SHEET_LIMITS.maxRows ||
    (options.types?.length ?? 0) > count ||
    (options.widths?.length ?? 0) > count
  )
    return limit("Grid dimensions or column settings exceed limit");
  const columns: TableSheetColumn[] = [];
  for (let i = 0; i < count; i++) {
    const width = options.widths?.[i] ?? TABLE_SHEET_DEFAULT_COLUMN_WIDTH;
    const name =
      options.header && i < (grid[0]?.length ?? 0)
        ? (grid[0]?.[i] ?? "")
        : nextTableSheetColumnName(columns);
    if (
      name.length > TABLE_SHEET_LIMITS.maxColumnName ||
      !Number.isFinite(width)
    )
      return limit("Column name or width exceeds limit");
    columns.push({
      id: `c${i + 1}`,
      name,
      type: options.types?.[i] ?? "text",
      width: Math.max(
        TABLE_SHEET_LIMITS.minColumnWidth,
        Math.min(TABLE_SHEET_LIMITS.maxColumnWidth, Math.round(width)),
      ),
    });
  }
  let semantic: TableSheetSemantic = {
    columns,
    rows: records.map((_, i) => ({ id: `r${i + 1}`, cells: {} })),
  };
  for (let r = 0; r < records.length; r++)
    for (let c = 0; c < count; c++) {
      const col = semantic.columns[c];
      const row = semantic.rows[r];
      if (!col || !row) continue;
      const result = setCellText(
        semantic,
        row.id,
        col.id,
        records[r]?.[c] ?? "",
      );
      if (!result.ok) return result;
      if (result.skipped)
        return {
          ok: false,
          code: "table.cellType",
          message: `Invalid value at row ${r + 1}, column ${col.name}`,
        };
      semantic = result.semantic;
    }
  return { ok: true, semantic, skipped: 0 };
}
