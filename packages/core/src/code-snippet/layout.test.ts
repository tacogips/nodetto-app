import { expect, test } from "bun:test";
import { codeSnippetLayout } from "./layout.ts";
test("columns, tabs, wide characters, gutters and wrapping", () => {
  const l = codeSnippetLayout({ code: "a\tb中", language: "plain" });
  expect(l.lines[0]?.runs[0]?.text).toBe("a   b中");
  expect(l.lines[0]?.runs[0]?.source).toBe("a\tb中");
  expect(l.lines[0]?.runs[0]?.columns).toBe(7);
  const n = codeSnippetLayout({
    code: Array(12).fill("x").join("\n"),
    language: "plain",
    showLineNumbers: true,
  });
  expect(n.gutterWidth).toBe(3 * n.advance + 8);
  const w = codeSnippetLayout({
    code: "x".repeat(200),
    language: "plain",
    showLineNumbers: true,
    wrap: true,
    width: 200,
  });
  expect(w.lines.length).toBeGreaterThan(1);
  expect(w.lines[0]?.number).toBe(1);
  expect(w.lines[1]?.number).toBeUndefined();
  expect(w.height).toBe(24 + w.lines.length * w.lineHeight);
  expect(codeSnippetLayout({ code: "", language: "plain" }).height).toBe(44);
});
