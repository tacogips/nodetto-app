import { expect, test } from "bun:test";
import { applyQuiet, collapseWarnings, extractQuiet } from "./warnings.ts";

test("warning groups preserve first occurrence and count", () => {
  expect(
    collapseWarnings(
      Array.from({ length: 42 }, (_, i) => `line ${i}`),
      Array(42).fill("same"),
    ),
  ).toEqual(["line 0 (and 41 more like this)"]);
  expect(collapseWarnings(["a", "b", "c"], ["x", "y", "x"])).toEqual([
    "a (and 1 more like this)",
    "b",
  ]);
});
test("quiet respects the option terminator and preserves errors and exit code", () => {
  expect(
    extractQuiet(["validate", "--quiet", "a.jsonl", "--", "--quiet"]),
  ).toEqual({ args: ["validate", "a.jsonl", "--", "--quiet"], quiet: true });
  expect(
    applyQuiet("edit", {
      exitCode: 3,
      stdout: "  warning operation 1: x\nstrict summary\n",
      stderr: "warning: x\nerror: y\n",
    }),
  ).toEqual({ exitCode: 3, stdout: "strict summary\n", stderr: "error: y\n" });
});
