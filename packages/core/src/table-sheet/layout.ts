import {
  TABLE_SHEET_ALIGNS,
  TABLE_SHEET_COLUMN_TYPES,
  tableSheetValueMatches,
  type Element,
  type TableSheetAlign,
  type TableSheetCell,
  type TableSheetColumn,
  type TableSheetRow,
  type TableSheetSemantic,
} from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { graphemes } from "../text-layout.ts";
import { wideAwareTextWidth } from "../wide-text-width.ts";
import { TABLE_SHEET_PAINT } from "./paint.ts";

export const TABLE_SHEET_HEADER_HEIGHT = 32;
export const TABLE_SHEET_DEFAULT_ROW_HEIGHT = 28;
export const TABLE_SHEET_CELL_PADDING_X = 8;
export const TABLE_SHEET_FONT_SIZE = 12;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const alignOf = (value: unknown): TableSheetAlign | undefined =>
  TABLE_SHEET_ALIGNS.find((a) => a === value);

/** Read usable geometry and cells even from a malformed semantic payload. */
export function readTableSheet(semantic: unknown): TableSheetSemantic {
  if (!record(semantic)) return { columns: [], rows: [] };
  const columns: TableSheetColumn[] = [];
  if (Array.isArray(semantic.columns))
    for (const item of semantic.columns) {
      if (
        !record(item) ||
        typeof item.id !== "string" ||
        typeof item.name !== "string" ||
        typeof item.width !== "number" ||
        !Number.isFinite(item.width) ||
        item.width <= 0
      )
        continue;
      const type = TABLE_SHEET_COLUMN_TYPES.find((t) => t === item.type);
      if (!type) continue;
      const options = Array.isArray(item.options)
        ? item.options.filter((v): v is string => typeof v === "string")
        : undefined;
      columns.push({
        id: item.id,
        name: item.name,
        width: item.width,
        type,
        ...(options ? { options } : {}),
        ...(alignOf(item.align) ? { align: alignOf(item.align) } : {}),
      });
    }
  const rows: TableSheetRow[] = [];
  if (Array.isArray(semantic.rows))
    for (const item of semantic.rows) {
      if (
        !record(item) ||
        typeof item.id !== "string" ||
        !record(item.cells) ||
        (item.height !== undefined &&
          (typeof item.height !== "number" ||
            !Number.isFinite(item.height) ||
            item.height <= 0))
      )
        continue;
      const cells: Record<string, TableSheetCell> = Object.create(null);
      for (const column of columns) {
        if (!Object.hasOwn(item.cells, column.id)) continue;
        const cell = item.cells[column.id];
        if (!record(cell)) continue;
        const value = tableSheetValueMatches(column, cell.value)
          ? (cell.value as string | number | boolean)
          : undefined;
        const align = alignOf(cell.align);
        cells[column.id] = {
          ...(value !== undefined ? { value } : {}),
          ...(typeof cell.bold === "boolean" ? { bold: cell.bold } : {}),
          ...(align ? { align } : {}),
          ...(typeof cell.fill === "string" ? { fill: cell.fill } : {}),
        };
      }
      rows.push({
        id: item.id,
        cells,
        ...(typeof item.height === "number" ? { height: item.height } : {}),
      });
    }
  return {
    columns,
    rows,
    ...(typeof semantic.headerRow === "boolean"
      ? { headerRow: semantic.headerRow }
      : {}),
    ...(typeof semantic.striped === "boolean"
      ? { striped: semantic.striped }
      : {}),
  };
}

export function tableSheetBounds(
  visual: { x?: number; y?: number },
  semantic: unknown,
): Box {
  const table = readTableSheet(semantic);
  const height =
    (table.headerRow === false ? 0 : TABLE_SHEET_HEADER_HEIGHT) +
    table.rows.reduce(
      (sum, row) => sum + (row.height ?? TABLE_SHEET_DEFAULT_ROW_HEIGHT),
      0,
    );
  return {
    x: visual.x ?? 0,
    y: visual.y ?? 0,
    width: table.columns.reduce((sum, column) => sum + column.width, 0),
    height: height || TABLE_SHEET_DEFAULT_ROW_HEIGHT,
  };
}
export interface TableSheetHeaderCell {
  columnId: string;
  columnIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  align: TableSheetAlign;
}
export interface TableSheetCellLayout {
  rowId: string;
  columnId: string;
  rowIndex: number;
  columnIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "empty" | "text" | "checkbox" | "pill";
  display: string;
  align: TableSheetAlign;
  bold: boolean;
  fill?: string;
  checked?: boolean;
  pill?: { fill: string; text: string };
}
export interface TableSheetLayout {
  box: Box;
  headerHeight: number;
  columns: readonly {
    id: string;
    index: number;
    x: number;
    width: number;
    type: TableSheetColumn["type"];
    align: TableSheetAlign;
  }[];
  rows: readonly {
    id: string;
    index: number;
    y: number;
    height: number;
    striped: boolean;
  }[];
  header: readonly TableSheetHeaderCell[];
  cells: readonly TableSheetCellLayout[];
}

export function tableSheetLayout(element: Element): TableSheetLayout {
  const table = readTableSheet(element.semantic);
  const box = tableSheetBounds(element.visual, table);
  const headerHeight =
    table.headerRow === false ? 0 : TABLE_SHEET_HEADER_HEIGHT;
  let x = box.x;
  const columns = table.columns.map((column, index) => {
    const align =
      column.align ??
      (column.type === "number"
        ? "right"
        : column.type === "checkbox"
          ? "center"
          : "left");
    const result = {
      id: column.id,
      index,
      x,
      width: column.width,
      type: column.type,
      align,
    } as const;
    x += column.width;
    return result;
  });
  let y = box.y + headerHeight;
  const rows = table.rows.map((row, index) => {
    const height = row.height ?? TABLE_SHEET_DEFAULT_ROW_HEIGHT;
    const result = {
      id: row.id,
      index,
      y,
      height,
      striped: table.striped === true && index % 2 === 1,
    };
    y += height;
    return result;
  });
  const header = headerHeight
    ? columns.map((column, index) => ({
        columnId: column.id,
        columnIndex: index,
        x: column.x,
        y: box.y,
        width: column.width,
        height: headerHeight,
        text: table.columns[index]?.name ?? "",
        align: column.align,
      }))
    : [];
  const cells: TableSheetCellLayout[] = [];
  for (const row of rows)
    for (const column of columns) {
      const source = table.rows[row.index];
      const definition = table.columns[column.index];
      const cell =
        source && Object.hasOwn(source.cells, column.id)
          ? source.cells[column.id]
          : undefined;
      const value = cell?.value;
      let kind: TableSheetCellLayout["kind"] = "empty";
      let display = "";
      let checked: boolean | undefined;
      let pill: TableSheetCellLayout["pill"];
      if (value !== undefined) {
        if (column.type === "checkbox" && typeof value === "boolean") {
          kind = "checkbox";
          checked = value;
        } else if (column.type === "select" && typeof value === "string") {
          kind = "pill";
          display = value;
          pill =
            TABLE_SHEET_PAINT.pillPalette[
              (definition?.options?.indexOf(value) ?? 0) %
                TABLE_SHEET_PAINT.pillPalette.length
            ];
        } else {
          kind = "text";
          display = String(value).replace(/\r\n|\r|\n/g, " ");
        }
      }
      cells.push({
        rowId: row.id,
        columnId: column.id,
        rowIndex: row.index,
        columnIndex: column.index,
        x: column.x,
        y: row.y,
        width: column.width,
        height: row.height,
        kind,
        display,
        align: cell?.align ?? column.align,
        bold: cell?.bold ?? false,
        ...(cell?.fill !== undefined ? { fill: cell.fill } : {}),
        ...(checked !== undefined ? { checked } : {}),
        ...(pill ? { pill } : {}),
      });
    }
  return { box, headerHeight, columns, rows, header, cells };
}

export function fitCellText(
  text: string,
  maxWidth: number,
  fontSize: number,
): string {
  if (wideAwareTextWidth(text, fontSize) <= maxWidth) return text;
  const parts = graphemes(text);
  while (
    parts.length &&
    wideAwareTextWidth(`${parts.join("")}…`, fontSize) > maxWidth
  )
    parts.pop();
  return `${parts.join("")}…`;
}
