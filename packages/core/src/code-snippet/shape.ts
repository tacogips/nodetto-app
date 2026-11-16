import type { Element, TextCodeSemantic } from "@nodetto/ir";
import { boxContains } from "../geometry.ts";
import type { ShapeUtil } from "../shape-util.ts";
import { codeSnippetLayout, type CodeLayoutInput } from "./layout.ts";

export function codeSnippetInput(element: Element): CodeLayoutInput {
  const semantic = element.semantic as Partial<TextCodeSemantic> | null;
  return {
    code: typeof semantic?.code === "string" ? semantic.code : "",
    language:
      typeof semantic?.language === "string" ? semantic.language : "plain",
    showLineNumbers: semantic?.showLineNumbers === true,
    wrap: semantic?.wrap === true,
    width: element.visual.width,
    fontSize: element.visual.style?.fontSize,
    fill: element.visual.style?.fill,
  };
}
export function defaultCodeSnippetSemantic(): TextCodeSemantic {
  return { code: "", language: "plain" };
}
export const codeSnippetShapeUtil: ShapeUtil = {
  type: "text.code",
  canResize: true,
  getBounds(element) {
    const layout = codeSnippetLayout(codeSnippetInput(element));
    return {
      x: element.visual.x ?? 0,
      y: element.visual.y ?? 0,
      width: layout.width,
      height: layout.height,
    };
  },
  hitTest(element, point) {
    const layout = codeSnippetLayout(codeSnippetInput(element));
    return boxContains(
      {
        x: element.visual.x ?? 0,
        y: element.visual.y ?? 0,
        width: layout.width,
        height: layout.height,
      },
      point,
    );
  },
  resize(_element, box) {
    return { visual: { x: box.x, y: box.y, width: Math.max(80, box.width) } };
  },
  defaultVisual: () => ({ x: 0, y: 0, width: 480 }),
  defaultSemantic: defaultCodeSnippetSemantic,
};
