import { expect, test } from "bun:test";
import { clipboardGrid, pasteGrid, tableSheetFromGrid } from "./grid.ts";
import type { TableSheetSemantic } from "@nodetto/ir";
const s: TableSheetSemantic = {
  columns: [
    { id: "c1", name: "Name", type: "text", width: 120 },
    { id: "c2", name: "Qty", type: "number", width: 120 },
    { id: "c3", name: "Status", type: "select", width: 120 },
  ],
  rows: [
    { id: "r1", cells: {} },
    { id: "r2", cells: {} },
    { id: "r3", cells: {} },
  ],
};
test("paste grows and names", () => {
  let n = 0;
  const r = pasteGrid(
    s,
    { row: 2, column: 1 },
    [
      ["1", "a", "x", "y", "z"],
      ["2", "b", "p", "q", "r"],
    ],
    () => `id${++n}`,
  );
  expect(r.ok && r.semantic.rows.length).toBe(4);
  expect(r.ok && r.semantic.columns.slice(3).map((c) => c.name)).toEqual([
    "Column 1",
    "Column 2",
    "Column 3",
  ]);
});
test("limit consumes no ids", () => {
  let n = 0;
  const r = pasteGrid(
    s,
    { row: 0, column: 0 },
    [Array(101).fill("x")],
    () => `${++n}`,
  );
  expect(r.ok).toBe(false);
  expect(n).toBe(0);
});
test("invalid number skipped and select added", () => {
  const r = pasteGrid(s, { row: 0, column: 1 }, [["x", "Blocked"]], () => "id");
  expect(r.ok && r.skipped).toBe(1);
  expect(r.ok && r.semantic.columns[2]?.options).toEqual(["Blocked"]);
});
test("clipboard exact", () => {
  const v = "alpha\nbeta";
  const t: TableSheetSemantic = {
    columns: [s.columns[0]!],
    rows: [{ id: "r", cells: { c1: { value: v } } }],
  };
  expect(clipboardGrid(t, { top: 0, left: 0, bottom: 0, right: 0 })).toEqual([
    [v],
  ]);
});
test("grid no header", () => {
  const r = tableSheetFromGrid(
    [
      ["A", "B"],
      ["x", "1"],
    ],
    { header: false },
  );
  expect(r.ok && r.semantic.columns.map((c) => c.name)).toEqual([
    "Column 1",
    "Column 2",
  ]);
  expect(r.ok && r.semantic.rows.length).toBe(2);
});
test("grid header and ids", () => {
  const r = tableSheetFromGrid([["Name"], ["a", "b"]], { header: true });
  expect(r.ok && r.semantic.columns.map((c) => c.name)).toEqual([
    "Name",
    "Column 1",
  ]);
  expect(r.ok && r.semantic.rows[0]?.id).toBe("r1");
});
test("grid strict number", () => {
  const r = tableSheetFromGrid(
    [
      ["Name", "Qty"],
      ["a", "bad"],
    ],
    { header: true, types: ["text", "number"] },
  );
  expect(!r.ok && r.code).toBe("table.cellType");
  expect(!r.ok && r.message).toContain("row 1, column Qty");
});
