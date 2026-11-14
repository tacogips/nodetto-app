import {
  TABLE_SHEET_LIMITS,
  type TableSheetAlign,
  type TableSheetCell,
  type TableSheetColumn,
  type TableSheetSemantic,
} from "@nodetto/ir";
import type { IdSource } from "../ids.ts";
import type { TableSheetEditCode, TableSheetEditResult } from "./types.ts";

const success = (
  semantic: TableSheetSemantic,
  skipped = 0,
): TableSheetEditResult => ({ ok: true, semantic, skipped });
const failure = (code: TableSheetEditCode): TableSheetEditResult => ({
  ok: false,
  code,
  message: code,
});
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const columnDefault = (c: TableSheetColumn): TableSheetAlign =>
  c.align ??
  (c.type === "number" ? "right" : c.type === "checkbox" ? "center" : "left");

export function setCellStyle(
  s: TableSheetSemantic,
  rowId: string,
  columnId: string,
  style: {
    bold?: boolean | null;
    align?: TableSheetAlign | null;
    fill?: string | null;
  },
): TableSheetEditResult {
  const row = s.rows.find((r) => r.id === rowId);
  if (!row) return failure("table.unknownRow");
  const col = s.columns.find((c) => c.id === columnId);
  if (!col) return failure("table.unknownColumn");
  const old = Object.hasOwn(row.cells, columnId)
    ? row.cells[columnId]
    : undefined;
  const cell: {
    value?: TableSheetCell["value"];
    bold?: boolean;
    align?: TableSheetAlign;
    fill?: string;
  } = { ...old };
  if (style.bold !== undefined) {
    if (style.bold) cell.bold = true;
    else Reflect.deleteProperty(cell, "bold");
  }
  if (style.align !== undefined) {
    if (style.align && style.align !== columnDefault(col))
      cell.align = style.align;
    else Reflect.deleteProperty(cell, "align");
  }
  if (style.fill !== undefined) {
    if (style.fill) cell.fill = style.fill;
    else Reflect.deleteProperty(cell, "fill");
  }
  if (same(old ?? {}, cell)) return success(s);
  const cells = { ...row.cells };
  if (Object.keys(cell).length) cells[columnId] = cell;
  else delete cells[columnId];
  return success({
    ...s,
    rows: s.rows.map((r) => (r === row ? { ...r, cells } : r)),
  });
}
export function insertRow(
  s: TableSheetSemantic,
  at: number,
  ids: IdSource,
): TableSheetEditResult {
  if (s.rows.length >= TABLE_SHEET_LIMITS.maxRows)
    return failure("table.limit");
  const rows = [...s.rows];
  rows.splice(clamp(Math.trunc(at), 0, rows.length), 0, {
    id: ids(),
    cells: {},
  });
  return success({ ...s, rows });
}
export function deleteRows(
  s: TableSheetSemantic,
  rowIds: readonly string[],
): TableSheetEditResult {
  const ids = new Set(rowIds);
  if ([...ids].some((id) => !s.rows.some((r) => r.id === id)))
    return failure("table.unknownRow");
  return ids.size
    ? success({ ...s, rows: s.rows.filter((r) => !ids.has(r.id)) })
    : success(s);
}
export function deleteColumns(
  s: TableSheetSemantic,
  columnIds: readonly string[],
): TableSheetEditResult {
  const ids = new Set(columnIds);
  if ([...ids].some((id) => !s.columns.some((c) => c.id === id)))
    return failure("table.unknownColumn");
  if (!ids.size) return success(s);
  if (ids.size === s.columns.length) return failure("table.lastColumn");
  const rows = s.rows.map((row) => {
    if (![...ids].some((id) => Object.hasOwn(row.cells, id))) return row;
    const cells = { ...row.cells };
    for (const id of ids) delete cells[id];
    return { ...row, cells };
  });
  return success({
    ...s,
    columns: s.columns.filter((c) => !ids.has(c.id)),
    rows,
  });
}
export function moveColumn(
  s: TableSheetSemantic,
  from: number,
  to: number,
): TableSheetEditResult {
  const source = clamp(Math.trunc(from), 0, s.columns.length - 1);
  const target = clamp(Math.trunc(to), 0, s.columns.length - 1);
  if (source === target) return success(s);
  const columns = [...s.columns];
  const [column] = columns.splice(source, 1);
  if (!column) return success(s);
  columns.splice(target, 0, column);
  return success({ ...s, columns });
}
function changeColumn(
  s: TableSheetSemantic,
  id: string,
  change: (c: TableSheetColumn) => TableSheetColumn,
): TableSheetEditResult {
  const col = s.columns.find((c) => c.id === id);
  if (!col) return failure("table.unknownColumn");
  const next = change(col);
  return same(col, next)
    ? success(s)
    : success({ ...s, columns: s.columns.map((c) => (c === col ? next : c)) });
}
export function renameColumn(
  s: TableSheetSemantic,
  id: string,
  name: string,
): TableSheetEditResult {
  if (!s.columns.some((c) => c.id === id))
    return failure("table.unknownColumn");
  if (name.length > TABLE_SHEET_LIMITS.maxColumnName)
    return failure("table.limit");
  return changeColumn(s, id, (c) => ({ ...c, name }));
}
export function setColumnOptions(
  s: TableSheetSemantic,
  id: string,
  options: readonly string[],
): TableSheetEditResult {
  const col = s.columns.find((c) => c.id === id);
  if (!col) return failure("table.unknownColumn");
  if (col.type !== "select") return failure("table.cellType");
  const unique = [...new Set(options.filter(Boolean))];
  if (
    unique.length > TABLE_SHEET_LIMITS.maxOptions ||
    unique.some((o) => o.length > TABLE_SHEET_LIMITS.maxOptionLength)
  )
    return failure("table.limit");
  let skipped = 0;
  const rows = s.rows.map((row) => {
    const cell = Object.hasOwn(row.cells, id) ? row.cells[id] : undefined;
    if (
      !cell ||
      cell.value === undefined ||
      unique.includes(String(cell.value))
    )
      return row;
    skipped++;
    const { value: _value, ...rest } = cell;
    const cells = { ...row.cells };
    if (Object.keys(rest).length) cells[id] = rest;
    else delete cells[id];
    return { ...row, cells };
  });
  if (same(col.options ?? [], unique) && skipped === 0) return success(s);
  return success(
    {
      ...s,
      columns: s.columns.map((c) =>
        c === col ? { ...c, options: unique } : c,
      ),
      rows,
    },
    skipped,
  );
}
export function setColumnAlign(
  s: TableSheetSemantic,
  id: string,
  align: TableSheetAlign | undefined,
): TableSheetEditResult {
  return changeColumn(s, id, (c) => {
    const next = { ...c };
    if (align === undefined) Reflect.deleteProperty(next, "align");
    else next.align = align;
    return next;
  });
}
export function resizeColumn(
  s: TableSheetSemantic,
  id: string,
  width: number,
): TableSheetEditResult {
  return changeColumn(s, id, (c) => ({
    ...c,
    width: clamp(Math.round(width), 24, 2000),
  }));
}
export function resizeRow(
  s: TableSheetSemantic,
  id: string,
  height: number,
): TableSheetEditResult {
  const row = s.rows.find((r) => r.id === id);
  if (!row) return failure("table.unknownRow");
  const nextHeight = clamp(Math.round(height), 20, 2000);
  if (row.height === nextHeight) return success(s);
  return success({
    ...s,
    rows: s.rows.map((r) => (r === row ? { ...r, height: nextHeight } : r)),
  });
}
export function setHeaderRow(
  s: TableSheetSemantic,
  on: boolean,
): TableSheetEditResult {
  if (on ? s.headerRow === undefined : s.headerRow === false) return success(s);
  const next = { ...s };
  if (on) Reflect.deleteProperty(next, "headerRow");
  else next.headerRow = false;
  return success(next);
}
export function setStriped(
  s: TableSheetSemantic,
  on: boolean,
): TableSheetEditResult {
  if (on ? s.striped === true : s.striped === undefined) return success(s);
  const next = { ...s };
  if (on) next.striped = true;
  else Reflect.deleteProperty(next, "striped");
  return success(next);
}
