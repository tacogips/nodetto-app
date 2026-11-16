import { expect, test } from "bun:test";
import { element } from "../test-helpers.ts";
import type { ShapeContext } from "../shape-util.ts";
import { codeSnippetInput, codeSnippetShapeUtil } from "./shape.ts";

test("code geometry hugs content and resizes width only", () => {
  const el = element({
    id: "code",
    type: "text.code",
    visual: { x: 2, y: 3, width: 300, height: 999 },
    semantic: { code: "a\nb", language: "plain" },
  });
  const context = {} as ShapeContext;
  expect(codeSnippetShapeUtil.getBounds(el, context)).toEqual({
    x: 2,
    y: 3,
    width: 300,
    height: 64,
  });
  expect(
    codeSnippetShapeUtil.resize?.(el, { x: 4, y: 5, width: 50, height: 300 }),
  ).toEqual({ visual: { x: 4, y: 5, width: 80 } });
  expect(codeSnippetShapeUtil.hitTest(el, { x: 4, y: 4 }, context)).toBe(true);
  expect(
    codeSnippetInput(
      element({ id: "bad", type: "text.code", semantic: { code: 4 } }),
    ).code,
  ).toBe("");
  expect(
    codeSnippetInput(element({ id: "empty", type: "text.code", semantic: {} }))
      .language,
  ).toBe("plain");
});
