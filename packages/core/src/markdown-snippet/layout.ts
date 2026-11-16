import type { Element } from "@nodetto/ir";
import {
  markdownLayout,
  parseMarkdown,
  type MdHighlighter,
  type MdLayout,
} from "../markdown/index.ts";
import {
  codePaletteFor,
  resolveSyntaxKind,
  tokenizeCode,
  type CodePalette,
} from "../syntax/index.ts";

export const markdownHighlighter: MdHighlighter = (code, language) =>
  tokenizeCode(code, resolveSyntaxKind(language) ?? "plain");
export interface MarkdownSnippetLayout {
  layout: MdLayout;
  width: number;
  height: number;
  mode: "light" | "dark";
  palette: CodePalette;
  panelFill: string;
}
const cache = new WeakMap<Element, MarkdownSnippetLayout>();
export function markdownSnippetLayout(element: Element): MarkdownSnippetLayout {
  const existing = cache.get(element);
  if (existing) return existing;
  const width = Math.max(80, element.visual.width ?? 480);
  const semantic = element.semantic as { markdown?: unknown };
  const source =
    typeof semantic?.markdown === "string" ? semantic.markdown : "";
  const layout = markdownLayout(parseMarkdown(source), width, {
    highlight: markdownHighlighter,
  });
  const result = {
    layout,
    width,
    height: layout.height,
    ...codePaletteFor(element.visual.style?.fill),
  };
  cache.set(element, result);
  return result;
}
