import {
  TABLE_SHEET_PAINT,
  tableSheetLayout,
  type TableSheetCellLayout,
} from "@nodetto/core";
import type { Element, TableSheetAlign } from "@nodetto/ir";
import type { JSX } from "solid-js";

export function tableSheetTextAlign(align: TableSheetAlign): JSX.CSSProperties {
  return {
    "text-align": align,
    "justify-content":
      align === "left"
        ? "flex-start"
        : align === "right"
          ? "flex-end"
          : "center",
  };
}
export function tableSheetCellStyle(
  cell: TableSheetCellLayout,
): JSX.CSSProperties {
  return {
    ...tableSheetTextAlign(cell.align),
    ...(cell.fill ? { background: cell.fill } : {}),
    ...(cell.bold ? { "font-weight": 700 } : {}),
  };
}
const boxStyle = (
  x: number,
  y: number,
  width: number,
  height: number,
): JSX.CSSProperties => ({
  left: `${x}px`,
  top: `${y}px`,
  width: `${width}px`,
  height: `${height}px`,
});
export function tableSheetViewModel(element: Element) {
  const layout = tableSheetLayout(element);
  const { x, y, width, height } = layout.box;
  return {
    width,
    height,
    headerHeight: layout.headerHeight,
    header: layout.header.map((h) => ({
      ...h,
      x: h.x - x,
      y: h.y - y,
      style: {
        ...boxStyle(h.x - x, h.y - y, h.width, h.height),
        ...tableSheetTextAlign(h.align),
      },
    })),
    stripes: layout.rows
      .filter((r) => r.striped)
      .map((r) => ({
        ...r,
        y: r.y - y,
        style: {
          ...boxStyle(0, r.y - y, width, r.height),
          background: TABLE_SHEET_PAINT.stripeFill,
        },
      })),
    cells: layout.cells.map((c) => ({
      ...c,
      x: c.x - x,
      y: c.y - y,
      style: {
        ...boxStyle(c.x - x, c.y - y, c.width, c.height),
        ...tableSheetCellStyle(c),
      },
      pillStyle: c.pill ? { background: c.pill.fill, color: c.pill.text } : {},
    })),
    columns: layout.columns.map((c) => ({ ...c, x: c.x - x })),
    rows: layout.rows.map((r) => ({ ...r, y: r.y - y })),
  };
}
