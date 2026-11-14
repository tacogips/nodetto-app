import { describe, expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import { wideAwareTextWidth } from "../wide-text-width.ts";
import {
  fitCellText,
  readTableSheet,
  tableSheetBounds,
  tableSheetLayout,
} from "./layout.ts";
import { TABLE_SHEET_PAINT } from "./paint.ts";
import { defaultTableSheetSemantic } from "./shape.ts";

const element = (semantic: unknown, visual = { x: 0, y: 0 }) =>
  ({ semantic, visual }) as Element;
describe("table sheet layout", () => {
  test("default bounds", () =>
    expect(tableSheetBounds({}, defaultTableSheetSemantic())).toEqual({
      x: 0,
      y: 0,
      width: 360,
      height: 116,
    }));
  test("headerless and empty bounds", () => {
    const s = defaultTableSheetSemantic();
    expect(tableSheetBounds({}, { ...s, headerRow: false }).height).toBe(84);
    expect(
      tableSheetBounds({}, { ...s, rows: [], headerRow: false }).height,
    ).toBe(28);
    expect(
      tableSheetBounds({}, { ...s, rows: [{ id: "r", height: 40, cells: {} }] })
        .height,
    ).toBe(72);
  });
  test("geometry uses page coordinates and row-major cells", () => {
    const l = tableSheetLayout(
      element(defaultTableSheetSemantic(), { x: 10, y: 20 }),
    );
    expect(l.cells[1]).toMatchObject({
      x: 170,
      y: 52,
      width: 120,
      height: 28,
      rowIndex: 0,
      columnIndex: 1,
    });
    expect(l.cells).toHaveLength(9);
  });
  test("alignments and overrides", () => {
    const s = {
      columns: [
        { id: "n", name: "N", width: 50, type: "number" },
        { id: "b", name: "B", width: 50, type: "checkbox" },
      ],
      rows: [
        {
          id: "r",
          cells: { n: { value: 4, align: "center" }, b: { value: true } },
        },
      ],
    };
    const l = tableSheetLayout(element(s));
    expect(l.columns.map((c) => c.align)).toEqual(["right", "center"]);
    expect(l.cells.map((c) => c.align)).toEqual(["center", "center"]);
    expect(l.cells[1]).toMatchObject({
      kind: "checkbox",
      checked: true,
      display: "",
    });
  });
  test("normalizes line breaks", () => {
    const s = defaultTableSheetSemantic();
    const l = tableSheetLayout(
      element({
        ...s,
        rows: [
          { id: "r", cells: { c1: { value: "alpha\nbeta" } } },
          { id: "r2", cells: { c1: { value: "a\r\nb" } } },
        ],
      }),
    );
    expect(l.cells[0]?.display).toBe("alpha beta");
    expect(l.cells[3]?.display).toBe("a b");
  });
  test("select palette follows option index", () => {
    const s = defaultTableSheetSemantic();
    const l = tableSheetLayout(
      element({ ...s, rows: [{ id: "r", cells: { c2: { value: "Doing" } } }] }),
    );
    expect(l.cells[1]).toMatchObject({
      kind: "pill",
      display: "Doing",
      pill: TABLE_SHEET_PAINT.pillPalette[1],
    });
  });
  test("stripes odd indexed rows", () => {
    const s = defaultTableSheetSemantic();
    expect(
      tableSheetLayout(
        element({
          ...s,
          striped: true,
          rows: [...s.rows, { id: "r4", cells: {} }],
        }),
      ).rows.map((r) => r.striped),
    ).toEqual([false, true, false, true]);
  });
  test("fits text by grapheme", () => {
    const text = fitCellText("abcdefghij", 30, 12);
    expect(text.endsWith("…")).toBe(true);
    expect(wideAwareTextWidth(text, 12)).toBeLessThanOrEqual(30);
    expect(fitCellText("ab", 100, 12)).toBe("ab");
    expect(fitCellText("a\u0301b", 10, 12)).toBe("…");
  });
  test("defensively drops malformed data and inherited cells", () => {
    expect(readTableSheet(null)).toEqual({ columns: [], rows: [] });
    expect(readTableSheet({ columns: "x" })).toEqual({ columns: [], rows: [] });
    const s = defaultTableSheetSemantic();
    const cells = Object.create({ c1: { value: "inherited" } });
    const l = tableSheetLayout(
      element({
        ...s,
        columns: [...s.columns, null],
        rows: [{ id: "r", cells }, null],
      }),
    );
    expect(l.columns).toHaveLength(3);
    expect(l.cells[0]?.kind).toBe("empty");
  });
  test("header can be hidden", () => {
    expect(
      tableSheetLayout(
        element({ ...defaultTableSheetSemantic(), headerRow: false }),
      ).header,
    ).toEqual([]);
  });
});
