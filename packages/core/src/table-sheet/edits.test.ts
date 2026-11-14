import { describe, expect, test } from "bun:test";
import type { TableSheetSemantic } from "@nodetto/ir";
import * as e from "./edits.ts";
const fixture = (): TableSheetSemantic => ({
  columns: [
    { id: "c1", name: "A", type: "text", width: 160 },
    {
      id: "c2",
      name: "B",
      type: "select",
      width: 120,
      options: ["Todo", "Doing"],
    },
    { id: "c3", name: "C", type: "number", width: 120 },
  ],
  rows: [
    { id: "r1", cells: { c2: { value: "Doing" } } },
    { id: "r2", cells: {} },
    { id: "r3", cells: {} },
  ],
});
function freeze<T>(v: T): T {
  if (v && typeof v === "object") {
    for (const x of Object.values(v)) freeze(x);
    Object.freeze(v);
  }
  return v;
}
function value(r: ReturnType<typeof e.insertRow>): TableSheetSemantic {
  if (!r.ok) throw new Error(r.code);
  return r.semantic;
}
describe("table edits", () => {
  test("insert and limit", () => {
    const s = freeze(fixture());
    expect(value(e.insertRow(s, 3, () => "x1")).rows[3]).toEqual({
      id: "x1",
      cells: {},
    });
    expect(
      e.insertRow(
        {
          ...s,
          rows: Array.from({ length: 1000 }, (_, i) => ({
            id: String(i),
            cells: {},
          })),
        },
        0,
        () => "x",
      ),
    ).toMatchObject({ ok: false, code: "table.limit" });
  });
  test("delete columns and last column", () => {
    const s = freeze(fixture());
    expect(e.deleteColumns(s, ["c1", "c2", "c3"])).toMatchObject({
      code: "table.lastColumn",
    });
    expect(value(e.deleteColumns(s, ["c2"])).rows[0]?.cells).toEqual({});
  });
  test("style removal", () => {
    const s = freeze(fixture());
    const a = value(e.setCellStyle(s, "r2", "c1", { bold: true }));
    expect(
      value(e.setCellStyle(a, "r2", "c1", { bold: null })).rows[1]?.cells,
    ).toEqual({});
  });
  test("resize and no-op", () => {
    const s = freeze(fixture());
    expect(value(e.resizeColumn(s, "c1", 10)).columns[0]?.width).toBe(24);
    expect(value(e.resizeColumn(s, "c1", 160))).toBe(s);
    expect(value(e.resizeRow(s, "r1", 28)).rows[0]?.height).toBe(28);
  });
  test("flags", () => {
    const s = freeze({ ...fixture(), striped: true });
    expect(value(e.setStriped(s, false)).striped).toBeUndefined();
    expect(value(e.setHeaderRow(s, false)).headerRow).toBe(false);
  });
  test("select options clear values", () => {
    const s = freeze(fixture());
    const r = e.setColumnOptions(s, "c2", ["Todo", "Todo", ""]);
    expect(r.ok && r.skipped).toBe(1);
    expect(value(r).rows[0]?.cells).toEqual({});
  });
  test("move and unknown ids", () => {
    const s = freeze(fixture());
    expect(value(e.moveColumn(s, 0, 2)).columns.map((c) => c.id)).toEqual([
      "c2",
      "c3",
      "c1",
    ]);
    expect(e.deleteRows(s, ["missing"])).toMatchObject({
      code: "table.unknownRow",
    });
  });
  test("rename and align", () => {
    const s = freeze(fixture());
    expect(value(e.renameColumn(s, "c1", "New")).columns[0]?.name).toBe("New");
    expect(value(e.setColumnAlign(s, "c1", "center")).columns[0]?.align).toBe(
      "center",
    );
  });
  test("delete rows preserves untouched references", () => {
    const s = freeze(fixture());
    const next = value(e.deleteRows(s, ["r1"]));
    expect(next.rows[0]).toBe(s.rows[1]);
    expect(s.rows.length).toBe(3);
  });
  test("unknown column and option limits", () => {
    const s = freeze(fixture());
    expect(e.setColumnOptions(s, "x", [])).toMatchObject({
      code: "table.unknownColumn",
    });
    expect(e.setColumnOptions(s, "c1", [])).toMatchObject({
      code: "table.cellType",
    });
    expect(e.renameColumn(s, "c1", "a".repeat(201))).toMatchObject({
      code: "table.limit",
    });
  });
});
