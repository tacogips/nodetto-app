import {
  isTableSheetDate,
  TABLE_SHEET_LIMITS,
  tableSheetValueMatches,
  type TableSheetCell,
  type TableSheetCellValue,
  type TableSheetColumn,
  type TableSheetColumnType,
  type TableSheetSemantic,
} from "@nodetto/ir";
import type { TableSheetEditResult, TableSheetRange } from "./types.ts";

const fail = (
  code:
    | "table.limit"
    | "table.cellType"
    | "table.unknownRow"
    | "table.unknownColumn",
  message: string,
): TableSheetEditResult => ({ ok: false, code, message });
export function coerceCellText(
  column: TableSheetColumn,
  text: string,
): { ok: boolean; value?: TableSheetCellValue; newOption?: string } {
  if (column.type === "text")
    return text === "" ? { ok: true } : { ok: true, value: text };
  if (column.type === "select" && column.options?.includes(text))
    return { ok: true, value: text };
  const value = text.trim();
  if (!value) return { ok: true };
  switch (column.type) {
    case "number": {
      const n = Number(value);
      return /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(value) &&
        Number.isFinite(n)
        ? { ok: true, value: n }
        : { ok: false };
    }
    case "checkbox": {
      const v = value.toLowerCase();
      return ["true", "1", "yes", "x"].includes(v)
        ? { ok: true, value: true }
        : ["false", "0", "no"].includes(v)
          ? { ok: true, value: false }
          : { ok: false };
    }
    case "date":
      return isTableSheetDate(value) ? { ok: true, value } : { ok: false };
    case "select":
      return column.options?.includes(value)
        ? { ok: true, value }
        : { ok: true, value, newOption: value };
  }
}
export function clipboardCellText(
  _column: TableSheetColumn,
  cell: TableSheetCell | undefined,
): string {
  const value = cell?.value;
  return value === undefined
    ? ""
    : typeof value === "boolean"
      ? value
        ? "TRUE"
        : "FALSE"
      : String(value);
}
export function setCellValue(
  s: TableSheetSemantic,
  rowId: string,
  columnId: string,
  value: TableSheetCellValue | undefined,
): TableSheetEditResult {
  const row = s.rows.find((r) => r.id === rowId);
  if (!row) return fail("table.unknownRow", "Unknown row");
  const column = s.columns.find((c) => c.id === columnId);
  if (!column) return fail("table.unknownColumn", "Unknown column");
  if (
    typeof value === "string" &&
    value.length > TABLE_SHEET_LIMITS.maxCellText
  )
    return fail("table.limit", "Cell text exceeds limit");
  if (value !== undefined && !tableSheetValueMatches(column, value))
    return fail("table.cellType", "Value does not match column type");
  const cell = Object.hasOwn(row.cells, columnId)
    ? row.cells[columnId]
    : undefined;
  if (cell?.value === value) return { ok: true, semantic: s, skipped: 0 };
  const cells = { ...row.cells };
  const { value: _previousValue, ...style } = cell ?? {};
  const next: { -readonly [K in keyof TableSheetCell]: TableSheetCell[K] } =
    style;
  if (value !== undefined) next.value = value;
  if (Object.keys(next).length) cells[columnId] = next;
  else delete cells[columnId];
  return {
    ok: true,
    semantic: {
      ...s,
      rows: s.rows.map((r) => (r === row ? { ...r, cells } : r)),
    },
    skipped: 0,
  };
}
export function setCellText(
  s: TableSheetSemantic,
  rowId: string,
  columnId: string,
  text: string,
): TableSheetEditResult {
  if (!s.rows.some((r) => r.id === rowId))
    return fail("table.unknownRow", "Unknown row");
  const column = s.columns.find((c) => c.id === columnId);
  if (!column) return fail("table.unknownColumn", "Unknown column");
  const result = coerceCellText(column, text);
  let next = s;
  if (result.newOption !== undefined) {
    if (
      (column.options?.length ?? 0) >= TABLE_SHEET_LIMITS.maxOptions ||
      result.newOption.length > TABLE_SHEET_LIMITS.maxOptionLength
    )
      return fail("table.limit", "Select option limit exceeded");
    next = {
      ...s,
      columns: s.columns.map((c) =>
        c === column
          ? {
              ...c,
              options: [...(c.options ?? []), result.newOption as string],
            }
          : c,
      ),
    };
  }
  const edited = setCellValue(next, rowId, columnId, result.value);
  return edited.ok ? { ...edited, skipped: result.ok ? 0 : 1 } : edited;
}
export function clearRange(
  s: TableSheetSemantic,
  range: TableSheetRange,
): TableSheetEditResult {
  let next = s;
  for (
    let r = Math.max(0, range.top);
    r <= Math.min(range.bottom, s.rows.length - 1);
    r++
  )
    for (
      let c = Math.max(0, range.left);
      c <= Math.min(range.right, s.columns.length - 1);
      c++
    ) {
      const row = s.rows[r];
      const col = s.columns[c];
      if (!row || !col) continue;
      const result = setCellValue(next, row.id, col.id, undefined);
      if (result.ok) next = result.semantic;
    }
  return { ok: true, semantic: next, skipped: 0 };
}
export function retypeColumn(
  s: TableSheetSemantic,
  id: string,
  type: TableSheetColumnType,
): TableSheetEditResult {
  const old = s.columns.find((c) => c.id === id);
  if (!old) return fail("table.unknownColumn", "Unknown column");
  if (old.type === type) return { ok: true, semantic: s, skipped: 0 };
  const { options: _options, ...base } = old;
  let column: TableSheetColumn = { ...base, type };
  if (type === "select") {
    const options: string[] = [];
    for (const row of s.rows) {
      const text = clipboardCellText(
        old,
        Object.hasOwn(row.cells, id) ? row.cells[id] : undefined,
      ).trim();
      if (
        text &&
        !options.includes(text) &&
        options.length < TABLE_SHEET_LIMITS.maxOptions &&
        text.length <= TABLE_SHEET_LIMITS.maxOptionLength
      )
        options.push(text);
    }
    column = { ...column, options };
  }
  let skipped = 0;
  const rows = s.rows.map((row) => {
    const cell = Object.hasOwn(row.cells, id) ? row.cells[id] : undefined;
    if (cell?.value === undefined) return row;
    const converted = coerceCellText(column, clipboardCellText(old, cell));
    const value =
      converted.newOption !== undefined ? undefined : converted.value;
    if (!converted.ok || converted.newOption !== undefined) skipped++;
    if (cell.value === value) return row;
    const cells = { ...row.cells };
    const { value: _previousValue, ...style } = cell;
    const copy: { -readonly [K in keyof TableSheetCell]: TableSheetCell[K] } =
      style;
    if (value !== undefined) copy.value = value;
    if (Object.keys(copy).length) cells[id] = copy;
    else delete cells[id];
    return { ...row, cells };
  });
  return {
    ok: true,
    semantic: {
      ...s,
      columns: s.columns.map((c) => (c === old ? column : c)),
      rows,
    },
    skipped,
  };
}
