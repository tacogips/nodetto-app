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
