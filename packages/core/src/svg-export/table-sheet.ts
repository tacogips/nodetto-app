import type { Element } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import {
  fitCellText,
  TABLE_SHEET_FONT_SIZE,
  TABLE_SHEET_PAINT,
  tableSheetLayout,
} from "../table-sheet/index.ts";
import { type Attrs, fmt, tag, text, wrap } from "./markup.ts";
import { styled } from "./paint.ts";
import type { SvgTheme } from "./theme.ts";

export function renderTableSheet(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  const layout = tableSheetLayout(element);
  const dx = box.x - layout.box.x;
  const dy = box.y - layout.box.y;
  const rect = (r: Box): Attrs => ({
    x: r.x + dx,
    y: r.y + dy,
    width: r.width,
    height: r.height,
  });
  const textAttrs = (
    r: Box,
    align: "left" | "center" | "right",
    bold = false,
  ): Attrs => ({
    x:
      r.x +
      dx +
      (align === "left" ? 8 : align === "right" ? r.width - 8 : r.width / 2),
    y: r.y + dy + r.height / 2,
    "text-anchor":
      align === "left" ? "start" : align === "right" ? "end" : "middle",
    "dominant-baseline": "middle",
    "font-family": theme.fontFamily,
    "font-size": TABLE_SHEET_FONT_SIZE,
    "font-weight": bold ? "700" : undefined,
    fill: theme.ink,
  });
  const style = element.visual.style;
  const parts: string[] = [
    tag(
      "rect",
      styled(
        { ...rect(layout.box), fill: style?.fill ?? theme.surface },
        { ...element.visual, style: { fill: style?.fill } },
      ),
    ),
  ];
  for (const row of layout.rows)
    if (row.striped)
      parts.push(
        tag("rect", {
          class: "nodetto-table-sheet-stripe",
          x: box.x,
          y: row.y + dy,
          width: layout.box.width,
          height: row.height,
          fill: TABLE_SHEET_PAINT.stripeFill,
        }),
      );
  for (const cell of layout.cells)
    if (cell.fill)
      parts.push(
        tag("rect", {
          class: "nodetto-table-sheet-cell-fill",
          ...rect(cell),
          fill: cell.fill,
        }),
      );
  if (layout.headerHeight) {
    const header = [
      tag("rect", {
        x: box.x,
        y: box.y,
        width: layout.box.width,
        height: layout.headerHeight,
        fill: theme.accentSoft,
      }),
    ];
    for (const cell of layout.header)
      header.push(
        text(
          textAttrs(cell, cell.align, true),
          fitCellText(
            cell.text.replace(/\r\n|\r|\n/g, " "),
            cell.width - 16,
            TABLE_SHEET_FONT_SIZE,
          ),
        ),
      );
    header.push(
      tag("line", {
        x1: box.x,
        y1: box.y + layout.headerHeight,
        x2: box.x + layout.box.width,
        y2: box.y + layout.headerHeight,
        stroke: theme.ink,
      }),
    );
    parts.push(
      wrap("g", { class: "nodetto-table-sheet-header" }, header.join("")),
    );
  }
  const grid: string[] = [];
  for (const col of layout.columns.slice(1))
    grid.push(
      tag("line", {
        x1: col.x + dx,
        y1: box.y,
        x2: col.x + dx,
        y2: box.y + layout.box.height,
        stroke: theme.line,
        "stroke-width": 1,
      }),
    );
  for (const row of layout.rows.slice(1))
    grid.push(
      tag("line", {
        x1: box.x,
        y1: row.y + dy,
        x2: box.x + layout.box.width,
        y2: row.y + dy,
        stroke: theme.line,
        "stroke-width": 1,
      }),
    );
  parts.push(wrap("g", { class: "nodetto-table-sheet-grid" }, grid.join("")));
  const safeId = Array.from(element.id, (c) =>
    c.codePointAt(0)?.toString(16),
  ).join("-");
  for (const cell of layout.cells) {
    if (
      cell.kind === "empty" &&
      layout.columns[cell.columnIndex]?.type !== "checkbox"
    )
      continue;
    const id = `nodetto-ts-${safeId}-${cell.rowIndex}-${cell.columnIndex}`;
    const clip = wrap(
      "clipPath",
      { id, clipPathUnits: "userSpaceOnUse" },
      tag("rect", rect(cell)),
    );
    let content = "";
    if (cell.kind === "checkbox" || cell.kind === "empty") {
      const x = cell.x + dx + (cell.width - 14) / 2;
      const y = cell.y + dy + (cell.height - 14) / 2;
      content = tag("rect", {
        class: "nodetto-table-sheet-checkbox",
        x,
        y,
        width: 14,
        height: 14,
        rx: 3,
        fill: cell.checked ? theme.accent : "none",
        stroke: cell.checked ? theme.accent : theme.ink,
      });
      if (cell.checked)
        content += tag("path", {
          d: `M ${fmt(x + 3)} ${fmt(y + 7)} l 3 3 l 5 -6`,
          fill: "none",
          stroke: "white",
          "stroke-width": 2,
        });
    } else if (cell.kind === "pill" && cell.pill) {
      const label = fitCellText(
        cell.display,
        cell.width - 32,
        TABLE_SHEET_FONT_SIZE,
      );
      const width = Math.min(
        cell.width - 16,
        Math.max(18, label.length * 7 + 16),
      );
      const x = cell.x + dx + 8;
      const y = cell.y + dy + (cell.height - 18) / 2;
      content =
        tag("rect", {
          class: "nodetto-table-sheet-pill",
          x,
          y,
          width: Math.max(0, width),
          height: 18,
          rx: 9,
          fill: cell.pill.fill,
        }) +
        text(
          {
            ...textAttrs(cell, "left", cell.bold),
            x: x + 8,
            fill: cell.pill.text,
          },
          label,
        );
    } else
      content = text(
        textAttrs(cell, cell.align, cell.bold),
        fitCellText(cell.display, cell.width - 16, TABLE_SHEET_FONT_SIZE),
      );
    parts.push(
      wrap(
        "g",
        { class: "nodetto-table-sheet-cell" },
        wrap("defs", {}, clip) +
          wrap("g", { "clip-path": `url(#${id})` }, content),
      ),
    );
  }
  parts.push(
    tag(
      "rect",
      styled(
        {
          ...rect(layout.box),
          fill: "none",
          stroke: style?.stroke ?? theme.ink,
          "stroke-width": 1.5,
        },
        { ...element.visual, style: {} },
      ),
    ),
  );
  return wrap(
    "g",
    {
      class: "nodetto-table-sheet",
      "data-nodetto-id": element.id,
      opacity: style?.opacity,
    },
    parts.join(""),
  );
}
