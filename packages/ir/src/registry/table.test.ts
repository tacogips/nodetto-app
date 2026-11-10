import { describe, expect, test } from "bun:test";
import {
  isTableSheetDate,
  TABLE_SHEET_ID_PATTERN,
  tableSheetValueMatches,
} from "../semantics/table.ts";

describe("table sheet semantic primitives", () => {
  test("checks actual calendar dates and the id grammar", () => {
    expect(isTableSheetDate("2024-02-29")).toBe(true);
    expect(isTableSheetDate("2023-02-29")).toBe(false);
    expect(isTableSheetDate("2024-13-01")).toBe(false);
    expect(TABLE_SHEET_ID_PATTERN.test("__proto__")).toBe(false);
    expect(TABLE_SHEET_ID_PATTERN.test("c1")).toBe(true);
  });
  test("checks stored values against column types", () => {
    const column = { id: "c1", name: "Widget", width: 120 };
    expect(tableSheetValueMatches({ ...column, type: "number" }, 5)).toBe(true);
    expect(tableSheetValueMatches({ ...column, type: "number" }, "5")).toBe(
      false,
    );
    expect(tableSheetValueMatches({ ...column, type: "checkbox" }, 1)).toBe(
      false,
    );
    expect(
      tableSheetValueMatches(
        { ...column, type: "select", options: ["Todo"] },
        "Todo",
      ),
    ).toBe(true);
    expect(
      tableSheetValueMatches({ ...column, type: "date" }, "2023-02-29"),
    ).toBe(false);
  });
});
