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

import { codes, expectValid, validate } from "./test-helpers.ts";

describe("table sheet registry", () => {
  const make = () => ({
    columns: [1, 2, 3].map((i) => ({
      id: `c${i}`,
      name: `Column ${i}`,
      type: "text",
      width: 120,
    })),
    rows: [1, 2, 3].map((i) => ({
      id: `r${i}`,
      cells: {} as Record<string, unknown>,
    })),
  });
  const issues = (value: unknown) => codes(validate("table.sheet", value));
  test("accepts valid tables and all value types", () => {
    expectValid("table.sheet", make());
    expectValid("table.sheet", {
      columns: [
        { id: "c1", name: "A", type: "text", width: 120 },
        { id: "c2", name: "B", type: "number", width: 120 },
        { id: "c3", name: "C", type: "checkbox", width: 120 },
        { id: "c4", name: "D", type: "select", width: 120, options: ["Todo"] },
        { id: "c5", name: "E", type: "date", width: 120 },
      ],
      rows: [
        {
          id: "r1",
          cells: {
            c1: { value: "a" },
            c2: { value: 5 },
            c3: { value: true },
            c4: { value: "Todo" },
            c5: { value: "2024-02-29" },
          },
        },
      ],
    });
  });
  test("checks ids, dimensions and limits", () => {
    const s = make();
    s.columns[1]!.id = "c1";
    s.rows[1]!.id = "r1";
    expect(issues(s).filter((x) => x === "id.duplicate")).toHaveLength(2);
    s.columns[0]!.id = "__proto__";
    expect(issues(s)).toContain("table.id");
    expect(issues({ ...make(), columns: [] })).toContain("table.noColumns");
    for (const n of [100, 101]) {
      const x = make();
      x.columns = Array.from({ length: n }, (_, i) => ({
        id: `c${i}`,
        name: "A",
        type: "text",
        width: 120,
      }));
      expect(issues(x).includes("table.limit")).toBe(n === 101);
    }
    for (const n of [1000, 1001]) {
      const x = make();
      x.rows = Array.from({ length: n }, (_, i) => ({
        id: `r${i}`,
        cells: {},
      }));
      expect(issues(x).includes("table.limit")).toBe(n === 1001);
    }
    for (const n of [10000, 10001]) {
      const x = make();
      x.rows[0]!.cells = { c1: { value: "a".repeat(n) } };
      expect(issues(x).includes("table.limit")).toBe(n === 10001);
    }
    const x = make();
    x.columns[0]!.name = "a".repeat(201);
    expect(issues(x)).toContain("table.limit");
    expect(
      issues({
        ...make(),
        columns: [
          {
            id: "c1",
            name: "A",
            type: "select",
            width: 120,
            options: Array.from({ length: 101 }, (_, i) => String(i)),
          },
        ],
      }),
    ).toContain("table.limit");
    for (const width of [23, 2001, 24.5]) {
      const x = make();
      x.columns[0]!.width = width;
      expect(issues(x)).toContain("table.size");
    }
    expect(
      issues({ ...make(), rows: [{ id: "r1", height: 19, cells: {} }] }),
    ).toContain("table.size");
  });
  test("checks cell values, options and style", () => {
    const x = make();
    x.rows[0]!.cells = { zz: { value: "x" }, c1: {} };
    expect(issues(x)).toContain("table.unknownColumn");
    expect(issues(x)).toContain("table.cellEmpty");
    for (const [type, value] of [
      ["number", "5"],
      ["checkbox", 1],
      ["select", "Nope"],
      ["date", "2023-02-29"],
    ] as const)
      expect(
        issues({
          columns: [
            {
              id: "c1",
              name: "A",
              type,
              width: 120,
              ...(type === "select" ? { options: ["Todo"] } : {}),
            },
          ],
          rows: [{ id: "r1", cells: { c1: { value } } }],
        }),
      ).toContain("table.cellType");
    expect(
      issues({
        columns: [
          { id: "c1", name: "A", type: "text", width: 120, options: ["a"] },
        ],
        rows: [],
      }),
    ).toContain("table.options");
    expect(
      issues({
        columns: [
          {
            id: "c1",
            name: "A",
            type: "select",
            width: 120,
            options: ["a", "a"],
          },
        ],
        rows: [],
      }),
    ).toContain("table.options");
    x.rows[0]!.cells = { c1: { fill: "red" } };
    expect(issues(x)).toContain("table.cellFill");
  });
});
