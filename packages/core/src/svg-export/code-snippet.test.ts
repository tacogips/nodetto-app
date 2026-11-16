import { expect, test } from "bun:test";
import { element } from "../test-helpers.ts";
import { CODE_PALETTES } from "../syntax/palette.ts";
import { renderCodeSnippet } from "./code-snippet.ts";

test("SVG paints tokens, comments, line numbers and escaped source deterministically", () => {
  const el = element({
    id: "code-1",
    type: "text.code",
    visual: { x: 0, y: 0, width: 300 },
    semantic: {
      code: "fn main() {}\n// <&",
      language: "rust",
      showLineNumbers: true,
    },
  });
  const box = { x: 0, y: 0, width: 300, height: 64 };
  const svg = renderCodeSnippet(el, box);
  expect(svg).toContain(`fill="${CODE_PALETTES.light.keyword}"`);
  expect(svg).toContain('font-style="italic"');
  expect(svg).toContain("&lt;&amp;");
  expect(svg).toContain('text-anchor="end"');
  expect(svg).toContain(">1</text>");
  expect(svg).toContain(">2</text>");
  expect(renderCodeSnippet(el, box)).toBe(svg);
  const dark = renderCodeSnippet(
    { ...el, visual: { ...el.visual, style: { fill: "#1f2427" } } },
    box,
  );
  expect(dark).toContain(`fill="${CODE_PALETTES.dark.keyword}"`);
  expect(dark).toContain('fill="#1f2427"');
});
