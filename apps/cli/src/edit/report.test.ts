import { expect, test } from "bun:test";
import { formatEditReport } from "./report.ts";
import type { BatchResult } from "./types.ts";

const result: BatchResult = {
  text: "",
  operations: 2,
  counts: new Map([["page1", { added: 1, updated: 2, removed: 3 }]]),
  created: [
    { ref: "a", id: "one", type: "shape", page: "page1" },
    { id: "two", type: "shape", page: "page1" },
  ],
  replaced: [{ id: "one", path: "semantic.name", before: "old", after: "new" }],
  warnings: [
    {
      operation: 1,
      op: "update",
      element: "one",
      type: "shape",
      path: "semantic.extra",
      message: "unknown",
      code: "semantic.unknownField",
    },
  ],
};

test("formats the complete applied text report", () => {
  expect(formatEditReport(result, "diagram.jsonl", false, "text")).toBe(
    'Applied 2 operation(s) to diagram.jsonl.\n  page page1: +1 ~2 -3\n  created @a = one (shape)\n  created two (shape)\n  replaced one semantic.name: "old" -> "new"\n  warning operation 1 (update): one (shape) semantic.extra: unknown (semantic.unknownField)\n',
  );
});

test("formats dry-run text", () => {
  expect(
    formatEditReport(result, "diagram.jsonl", true, "text").startsWith(
      "Would apply 2 operation(s) to diagram.jsonl.\n",
    ),
  ).toBe(true);
});

test("omits empty replaced from JSON and reports written status", () => {
  const empty = { ...result, replaced: [] };
  for (const dryRun of [false, true]) {
    const report = formatEditReport(empty, "diagram.jsonl", dryRun, "json");
    const parsed = JSON.parse(report);
    expect(Object.hasOwn(parsed, "replaced")).toBe(false);
    expect(parsed.written).toBe(!dryRun);
    expect(report.endsWith("\n")).toBe(true);
  }
});

test("places nonempty replaced between created and pages in JSON", () => {
  const parsed = JSON.parse(
    formatEditReport(result, "diagram.jsonl", false, "json"),
  );
  expect(Object.keys(parsed)).toEqual([
    "written",
    "operations",
    "created",
    "replaced",
    "pages",
    "warnings",
  ]);
  expect(parsed.replaced).toEqual(result.replaced);
});

test("collapses matching text warnings but keeps JSON warnings", () => {
  const repeated = {
    ...result,
    warnings: [
      result.warnings[0]!,
      { ...result.warnings[0]!, element: "two", operation: 2 },
    ],
  };
  expect(formatEditReport(repeated, "x", false, "text")).toContain(
    "(and 1 more like this)",
  );
  expect(
    JSON.parse(formatEditReport(repeated, "x", false, "json")).warnings,
  ).toHaveLength(2);
});

test("reports matches in text and JSON", () => {
  const matches = [{ operation: 1, op: "update", count: 1, ids: ["one"] }];
  expect(
    formatEditReport({ ...result, matches }, "x", false, "text"),
  ).toContain("operation 1 (update): matched 1 element(s)");
  expect(
    JSON.parse(formatEditReport({ ...result, matches }, "x", false, "json"))
      .matches,
  ).toEqual(matches);
});

test("reports conversions and reconnections in text and JSON", () => {
  const converted = [
    {
      operation: 0,
      id: "one",
      fromType: "node.generic",
      toType: "state.node",
      mapped: [{ from: "semantic.label", to: "semantic.name" }],
      dropped: ["semantic.extra"],
      connectors: [{ id: "edge", type: "edge.generic" }],
    },
  ];
  const reconnected = [
    { operation: 1, deleted: "two", to: "one", connectors: ["edge"] },
  ];
  const withReports = { ...result, converted, reconnected };
  for (const dryRun of [false, true]) {
    const text = formatEditReport(withReports, "x", dryRun, "text");
    expect(text).toContain(
      "  converted one node.generic -> state.node\n    mapped semantic.label -> semantic.name\n    cannot carry semantic.extra\n    connector edge (edge.generic)\n  reconnected two -> one: 1 connector(s)\n",
    );
    const json = JSON.parse(formatEditReport(withReports, "x", dryRun, "json"));
    expect(Object.keys(json)).toEqual([
      "written",
      "operations",
      "created",
      "replaced",
      "converted",
      "reconnected",
      "pages",
      "warnings",
    ]);
    expect(json.converted).toEqual(converted);
    expect(json.reconnected).toEqual(reconnected);
  }
  const empty = JSON.parse(
    formatEditReport(
      { ...result, converted: [], reconnected: [] },
      "x",
      false,
      "json",
    ),
  );
  expect(Object.hasOwn(empty, "converted")).toBe(false);
  expect(Object.hasOwn(empty, "reconnected")).toBe(false);
});
