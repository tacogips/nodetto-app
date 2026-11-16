import { expect, test } from "bun:test";
import { element } from "../test-helpers.ts";
import { markdownSnippetLayout } from "./layout.ts";
import { markdownSnippetShapeUtil } from "./shape.ts";
test("geometry hugs cached layout and resize changes width only", () => {
  const e = element({
    id: "markdown",
    type: "text.markdown",
    semantic: { markdown: "# Title\n\nSome *text*" },
    visual: { x: 2, y: 3, width: 300, height: 999 },
  });
  const layout = markdownSnippetLayout(e);
  expect(markdownSnippetLayout(e).layout).toBe(layout.layout);
  expect(markdownSnippetShapeUtil.getBounds(e, {} as never)).toEqual({
    x: 2,
    y: 3,
    width: 300,
    height: layout.height,
  });
  expect(
    markdownSnippetShapeUtil.resize?.(e, {
      x: 4,
      y: 5,
      width: 200,
      height: 20,
    }),
  ).toEqual({ visual: { x: 4, y: 5, width: 200 } });
});
