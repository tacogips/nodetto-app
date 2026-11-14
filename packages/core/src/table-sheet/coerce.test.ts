import { expect, test } from "bun:test";
import {
  clipboardCellText,
  coerceCellText,
  setCellText,
  setCellValue,
  clearRange,
  retypeColumn,
} from "./coerce.ts";
import type { TableSheetColumn, TableSheetSemantic } from "@nodetto/ir";
const col = (type: TableSheetColumn["type"]): TableSheetColumn => ({
  id: "c1",
  name: "Value",
  width: 120,
  type,
});
const sheet: TableSheetSemantic = {
  columns: [col("text")],
  rows: [
    { id: "r1", cells: { c1: { value: "12", bold: true } } },
    { id: "r2", cells: { c1: { value: "x" } } },
  ],
};
for (const [type, input, expected] of [
  ["number", " 1e3 ", 1000],
  ["checkbox", "YES", true],
  ["checkbox", "x", true],
  ["text", "  a\tb\n", "  a\tb\n"],
  ["date", "2024-02-29", "2024-02-29"],
] as const)
  test(`coerce ${type} ${input}`, () =>
    expect(coerceCellText(col(type), input).value).toBe(expected));
test("invalid number", () =>
  expect(coerceCellText(col("number"), "1,000").ok).toBe(false));
test("invalid date", () =>
  expect(coerceCellText(col("date"), "2024-13-01").ok).toBe(false));
test("new select", () =>
  expect(coerceCellText(col("select"), "Blocked").newOption).toBe("Blocked"));
test("clipboard preserves stored values", () => {
  expect(clipboardCellText(col("text"), { value: "alpha\nbeta" })).toBe(
    "alpha\nbeta",
  );
  expect(clipboardCellText(col("number"), { value: 42 })).toBe("42");
  expect(clipboardCellText(col("checkbox"), { value: true })).toBe("TRUE");
});
test("bad input clears and counts", () => {
  const s = {
    ...sheet,
    columns: [col("number")],
    rows: [{ id: "r1", cells: { c1: { value: 1 } } }],
  };
  const r = setCellText(s, "r1", "c1", "x");
  expect(r.ok && r.skipped).toBe(1);
  expect(r.ok && r.semantic.rows[0]?.cells.c1).toBeUndefined();
});
test("clear retains style", () => {
  const r = clearRange(sheet, { top: 0, left: 0, bottom: 1, right: 0 });
  expect(r.ok && r.semantic.rows[0]?.cells.c1).toEqual({ bold: true });
});
test("retype number", () => {
  const r = retypeColumn(sheet, "c1", "number");
  expect(r.ok && r.skipped).toBe(1);
  expect(r.ok && r.semantic.rows[0]?.cells.c1?.value).toBe(12);
});
test("retype select", () => {
  const r = retypeColumn(sheet, "c1", "select");
  expect(r.ok && r.semantic.columns[0]?.options).toEqual(["12", "x"]);
});
test("unchanged value preserves identity", () => {
  const r = setCellValue(sheet, "r1", "c1", "12");
  expect(r.ok && r.semantic).toBe(sheet);
});
