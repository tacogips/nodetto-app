import { describe, expect, test } from "bun:test";
import { element } from "../test-helpers.ts";
import { tableSheetLayout } from "../table-sheet/layout.ts";
import { renderTableSheet } from "./table-sheet.ts";
import { DEFAULT_SVG_THEME as theme } from "./theme.ts";

const sheet = (extra: Record<string, unknown> = {}) =>
  element({
    id: "sheet-1",
    type: "table.sheet",
    index: "a1",
    visual: { x: 10, y: 20 },
    semantic: {
      columns: [
        { id: "a", name: "T", width: 40, type: "text" },
        { id: "b", name: "Number", width: 100, type: "number" },
        { id: "c", name: "Check", width: 100, type: "checkbox" },
        {
          id: "d",
          name: "Status",
          width: 100,
          type: "select",
          options: ["Todo", "Doing"],
        },
      ],
      rows: [
        {
          id: "r1",
          cells: {
            a: { value: "alphabet soup", fill: "#ffeeaa", bold: true },
            b: { value: 42 },
            c: { value: true },
            d: { value: "Doing" },
          },
        },
        { id: "r2", cells: { a: { value: "a<b&c" }, c: { value: false } } },
        { id: "r3", cells: { a: { value: "alpha\nbeta" } } },
        { id: "r4", cells: {} },
      ],
      striped: true,
      ...extra,
    },
  });
const count = (s: string, part: string) => s.split(part).length - 1;
describe("table sheet SVG", () => {
  test("renders headers, grid, stripes and typed cells", () => {
    const el = sheet();
    const layout = tableSheetLayout(el);
    const svg = renderTableSheet(el, layout.box, theme);
    expect(svg).toContain('class="nodetto-table-sheet-header"');
    expect(svg).toContain('fill="#dbe6e8"');
    for (const name of ["T", "Number", "Check", "Status"])
      expect(svg).toContain(`>${name}<`);
    expect(count(svg, 'class="nodetto-table-sheet-stripe"')).toBe(2);
    const grid =
      svg.match(/<g class="nodetto-table-sheet-grid">(.*?)<\/g>/)?.[1] ?? "";
    expect(count(grid, "<line ")).toBe(6);
    expect(svg).toMatch(/text-anchor="end"[^>]*>42<\/text>/);
    expect(count(svg, 'class="nodetto-table-sheet-checkbox"')).toBe(4);
    expect(count(svg, "<path ")).toBe(1);
    expect(svg).toContain('fill="#dbeafe"');
    expect(svg).toContain(">Doing</text>");
    expect(svg).toContain('fill="#ffeeaa"');
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain(">al…</text>");
  });
  test("escapes text, flattens newlines, clips and offsets", () => {
    const el = sheet({
      columns: [{ id: "a", name: "Text", width: 160, type: "text" }],
      rows: [
        { id: "r1", cells: { a: { value: "a<b&c" } } },
        { id: "r2", cells: { a: { value: "alpha\nbeta" } } },
      ],
    });
    const layout = tableSheetLayout(el);
    const svg = renderTableSheet(el, layout.box, theme);
    expect(svg).toContain("a&lt;b&amp;c");
    expect(svg).toContain("alpha beta");
    expect(svg).not.toContain("alpha\nbeta");
    for (const cell of layout.cells)
      expect(svg).toContain(
        `<rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}" />`,
      );
    expect(
      renderTableSheet(el, { ...layout.box, x: 30, y: 40 }, theme),
    ).toContain('<rect x="30" y="72" width="160" height="28" />');
    expect(svg).toBe(renderTableSheet(el, layout.box, theme));
    expect(
      renderTableSheet(
        sheet({ headerRow: false }),
        tableSheetLayout(sheet({ headerRow: false })).box,
        theme,
      ),
    ).not.toContain('class="nodetto-table-sheet-header"');
  });
});
