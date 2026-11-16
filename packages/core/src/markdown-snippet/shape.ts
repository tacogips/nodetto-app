import type { Element, TextMarkdownSemantic } from "@nodetto/ir";
import { boxContains } from "../geometry.ts";
import type { ShapeUtil } from "../shape-util.ts";
import { markdownSnippetLayout } from "./layout.ts";
export function defaultMarkdownSnippetSemantic(): TextMarkdownSemantic {
  return { markdown: "" };
}
function bounds(element: Element) {
  const { width, height } = markdownSnippetLayout(element);
  return { x: element.visual.x ?? 0, y: element.visual.y ?? 0, width, height };
}
export const markdownSnippetShapeUtil: ShapeUtil = {
  type: "text.markdown",
  canResize: true,
  getBounds: bounds,
  hitTest: (element, point) => boxContains(bounds(element), point),
  resize: (_element, box) => ({
    visual: { x: box.x, y: box.y, width: Math.max(80, box.width) },
  }),
  defaultSemantic: defaultMarkdownSnippetSemantic,
  defaultVisual: () => ({ x: 0, y: 0, width: 480 }),
};
