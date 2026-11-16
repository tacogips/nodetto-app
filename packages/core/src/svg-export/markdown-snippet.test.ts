import { expect, test } from "bun:test";
import { element } from "../test-helpers.ts";
import { CODE_PALETTES } from "../syntax/index.ts";
import { renderMarkdownSnippet } from "./markdown-snippet.ts";
test("renders styling, safe links, tables, tasks and highlighted code deterministically", () => {
  const md =
    "# Title\n\nSome *text* [a](https://e.com) [bad](javascript:x)\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] t\n\n```ts\nconst x = 1\n```";
  const e = element({
    id: "markdown",
    type: "text.markdown",
    semantic: { markdown: md },
    visual: { x: 0, y: 0, width: 300 },
  });
  const box = { x: 0, y: 0, width: 300, height: 200 };
  const svg = renderMarkdownSnippet(e, box);
  expect(svg).toBe(renderMarkdownSnippet(e, box));
  expect(svg).toContain('font-weight="700"');
  expect(svg).toContain('font-style="italic"');
  expect(svg).toContain('<a href="https://e.com">');
  expect(svg).not.toContain('href="javascript:');
  expect(svg).toContain("nodetto-markdown-headerCell");
  expect(svg).toContain("nodetto-markdown-task");
  expect(svg).toContain("<path");
  expect(svg).toContain(`fill="${CODE_PALETTES.light.keyword}"`);
  const dark = element({
    id: "markdown",
    type: "text.markdown",
    semantic: { markdown: md },
    visual: {
      x: 0,
      y: 0,
      width: 300,
      style: { fill: CODE_PALETTES.dark.background },
    },
  });
  expect(renderMarkdownSnippet(dark, box)).toContain(
    `fill="${CODE_PALETTES.dark.keyword}"`,
  );
});
