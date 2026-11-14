export const TABLE_SHEET_COLUMN_TYPES = [
  "text",
  "number",
  "checkbox",
  "select",
  "date",
] as const;
export type TableSheetColumnType = (typeof TABLE_SHEET_COLUMN_TYPES)[number];
export const TABLE_SHEET_ALIGNS = ["left", "center", "right"] as const;
export type TableSheetAlign = (typeof TABLE_SHEET_ALIGNS)[number];
export interface TableSheetColumn {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly type: TableSheetColumnType;
  readonly options?: readonly string[];
  readonly align?: TableSheetAlign;
}
export type TableSheetCellValue = string | number | boolean;
export interface TableSheetCell {
  readonly value?: TableSheetCellValue;
  readonly bold?: boolean;
  readonly align?: TableSheetAlign;
  readonly fill?: string;
}
export interface TableSheetRow {
  readonly id: string;
  readonly height?: number;
  readonly cells: Readonly<Record<string, TableSheetCell>>;
}
export interface TableSheetSemantic {
  readonly columns: readonly TableSheetColumn[];
  readonly rows: readonly TableSheetRow[];
  readonly headerRow?: boolean;
  readonly striped?: boolean;
}
export const TABLE_SHEET_LIMITS = {
  maxColumns: 100,
  maxRows: 1000,
  maxCellText: 10000,
  maxColumnName: 200,
  maxOptions: 100,
  maxOptionLength: 200,
  minColumnWidth: 24,
  maxColumnWidth: 2000,
  minRowHeight: 20,
  maxRowHeight: 2000,
} as const;
export const TABLE_SHEET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export function isTableSheetDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (days[month - 1] ?? 0);
}
export function tableSheetValueMatches(
  column: TableSheetColumn,
  value: unknown,
): boolean {
  switch (column.type) {
    case "text":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "checkbox":
      return typeof value === "boolean";
    case "select":
      return (
        typeof value === "string" && (column.options?.includes(value) ?? false)
      );
    case "date":
      return typeof value === "string" && isTableSheetDate(value);
  }
}
