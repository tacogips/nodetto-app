import {
  CODE_PALETTES,
  codePaletteFor,
  resolveSyntaxKind,
  type Command,
} from "@nodetto/core";
import type { Element, TextCodeSemantic } from "@nodetto/ir";
import { withOptionalFlag } from "./edits.ts";

export function codeLanguageCommand(
  element: Element,
  language: string,
): Command | null {
  const canonical = resolveSyntaxKind(language);
  const semantic = element.semantic as TextCodeSemantic;
  if (!canonical || canonical === semantic.language) return null;
  return {
    type: "updateSemantic",
    id: element.id,
    semantic: { ...semantic, language: canonical },
  };
}
export function codeFlagCommand(
  element: Element,
  flag: "showLineNumbers" | "wrap",
  on: boolean,
): Command | null {
  const semantic = element.semantic as TextCodeSemantic;
  if ((semantic[flag] === true) === on) return null;
  return {
    type: "updateSemantic",
    id: element.id,
    semantic: withOptionalFlag(semantic, flag, on),
  };
}
export function snippetThemeOf(element: Element): "light" | "dark" {
  return codePaletteFor(element.visual.style?.fill).mode;
}
export function snippetThemeCommand(
  element: Element,
  mode: "light" | "dark",
): Command | null {
  if (snippetThemeOf(element) === mode) return null;
  return {
    type: "updateVisual",
    id: element.id,
    visual: {
      style: { ...element.visual.style, fill: CODE_PALETTES[mode].background },
    },
  };
}
