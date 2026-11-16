import { expect, test } from "bun:test";
import { element } from "../test-helpers.ts";
import { markdownSnippetTextRuns } from "./text-runs.ts";
test("PDF runs preserve text and font classes", () => {
  const e = element({
    id: "markdown",
    type: "text.markdown",
    semantic: { markdown: "**太字** 😀 `code`" },
    visual: { x: 0, y: 0, width: 300 },
  });
  const runs = markdownSnippetTextRuns(e, {
    x: 10,
    y: 20,
    width: 300,
    height: 100,
  });
  expect(runs.map((r) => r.text).join("")).toBe("太字 😀 code");
  expect(runs.map((r) => r.font)).toContain("sans-bold");
  expect(runs.map((r) => r.font)).toContain("sans");
  expect(runs.map((r) => r.font)).toContain("mono");
});
