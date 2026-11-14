import { expect, test } from "bun:test";
import { TABLE_SHEET_PAINT } from "@nodetto/core";
import type { Element, TableSheetSemantic } from "@nodetto/ir";
import { tableSheetViewModel } from "./shapes/table-sheet-view-model.ts";

const semantic: TableSheetSemantic = {
  columns: [
    { id: "a", name: "A", type: "text", width: 160 },
    { id: "b", name: "B", type: "number", width: 120 },
    {
      id: "c",
      name: "C",
      type: "select",
      width: 80,
      options: ["One", "Two", "Done"],
    },
  ],
  rows: [
    {
      id: "r1",
      cells: {
        a: { value: "alpha\nbeta", fill: "#ffeeaa", bold: true },
        b: { value: 3 },
        c: { value: "Done" },
      },
    },
    { id: "r2", cells: {} },
    { id: "r3", cells: {} },
  ],
  striped: true,
};
const element = (s: TableSheetSemantic) =>
  ({
    id: "e",
    type: "table.sheet",
    semantic: s,
    visual: { x: 50, y: 70 },
  }) as Element;
test("local geometry and typed styles", () => {
  const m = tableSheetViewModel(element(semantic));
  expect([m.width, m.height, m.header[0]?.x, m.header[1]?.x]).toEqual([
    360, 116, 0, 160,
  ]);
  expect(m.cells[0]?.display).toBe("alpha beta");
  expect(m.cells[0]?.style.background).toBe("#ffeeaa");
  expect(m.cells[0]?.style["font-weight"]).toBe(700);
  expect(m.cells[1]?.style["text-align"]).toBe("right");
  expect(m.cells[2]?.pillStyle.background).toBe(
    TABLE_SHEET_PAINT.pillPalette[2].fill,
  );
});
test("stripes, headerless rows, checkbox and alignment override", () => {
  const s: TableSheetSemantic = {
    ...semantic,
    headerRow: false,
    columns: [{ id: "a", name: "A", type: "checkbox", width: 160 }],
    rows: [
      { id: "r1", cells: { a: { value: true } } },
      { id: "r2", cells: { a: { value: false, align: "right" } } },
      { id: "r3", cells: {} },
      { id: "r4", cells: {} },
    ],
  };
  const m = tableSheetViewModel(element(s));
  expect(m.header).toHaveLength(0);
  expect(m.rows[0]?.y).toBe(0);
  expect(m.stripes.map((r) => r.index)).toEqual([1, 3]);
  expect(m.cells[0]?.style["text-align"]).toBe("center");
  expect(m.cells[1]?.style["text-align"]).toBe("right");
});
