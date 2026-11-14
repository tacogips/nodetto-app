import { expect, test } from "bun:test";
import { insertColumn, nextTableSheetColumnName } from "./columns.ts";
import type { TableSheetColumn, TableSheetSemantic } from "@nodetto/ir";
const cols = (names: string[]): TableSheetColumn[] =>
  names.map((name, i) => ({ id: `c${i}`, name, type: "text", width: 120 }));
for (const [names, expected] of [
  [["Name", "Status", "Done"], "Column 1"],
  [["Column 1", "Column 3"], "Column 2"],
  [["Column 2"], "Column 1"],
  [["Column 01", "column 1"], "Column 1"],
] as const)
  test(`name ${names}`, () =>
    expect(nextTableSheetColumnName(cols([...names]))).toBe(expected));
test("insert defaults", () => {
  const s: TableSheetSemantic = { columns: cols(["Name"]), rows: [] };
  const r = insertColumn(s, 3, () => "x1");
  expect(r.ok && r.semantic.columns[1]).toEqual({
    id: "x1",
    name: "Column 1",
    type: "text",
    width: 120,
  });
});
test("insert select", () => {
  const s: TableSheetSemantic = { columns: cols(["Name"]), rows: [] };
  const r = insertColumn(s, 0, () => "x1", "select");
  expect(r.ok && r.semantic.columns[0]?.type).toBe("select");
});
test("column limit", () => {
  const s: TableSheetSemantic = {
    columns: cols(Array.from({ length: 100 }, (_, i) => `${i}`)),
    rows: [],
  };
  expect(insertColumn(s, 0, () => "x").ok).toBe(false);
});
