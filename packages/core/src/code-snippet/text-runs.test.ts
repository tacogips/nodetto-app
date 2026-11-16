import { expect, test } from "bun:test";
import { element } from "../test-helpers.ts";
import { codeSnippetTextRuns } from "./text-runs.ts";

test("PDF runs retain tabs and omit empty lines and line numbers", () => {
  const el = element({
    id: "code",
    type: "text.code",
    visual: { x: 0, y: 0, width: 300 },
    semantic: { code: "x\ty\n", language: "plain", showLineNumbers: true },
  });
  const runs = codeSnippetTextRuns(el, {
    x: 10,
    y: 20,
    width: 300,
    height: 64,
  });
  expect(runs).toHaveLength(1);
  expect(runs[0]?.text).toBe("x\ty");
  expect(runs[0]?.font).toBe("mono");
  expect(runs[0]?.x).toBeGreaterThan(22);
});
