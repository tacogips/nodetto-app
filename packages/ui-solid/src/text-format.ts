import { TEXT_NOTE_FONT_SIZE, type StylePatch } from "@nodetto/core";
import type { Element, VisualStyle } from "@nodetto/ir";

export const DEFAULT_FONT_SIZE: number = TEXT_NOTE_FONT_SIZE;
export const FONT_SIZE_STEPS: readonly number[] = [
  8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72,
];
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 72;
export type TextAlignValue = "start" | "middle" | "end";
export type VerticalAlignValue = "top" | "middle" | "bottom";

export interface TextFormatState {
  readonly fontSize: number;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strikethrough: boolean;
  readonly textAlign: TextAlignValue | null;
  readonly verticalAlign: VerticalAlignValue;
}

export function textFormatState(
  style: VisualStyle | undefined,
): TextFormatState {
  const decorations = style?.textDecoration?.split(" ") ?? [];
  return {
    fontSize: style?.fontSize ?? DEFAULT_FONT_SIZE,
    bold: (style?.fontWeight ?? 400) >= 600,
    italic: style?.fontStyle === "italic",
    underline: decorations.includes("underline"),
    strikethrough: decorations.includes("line-through"),
    textAlign: style?.textAlign ?? null,
    verticalAlign: style?.verticalAlign ?? "top",
  };
}

export function stepFontSize(
  current: number,
  direction: -1 | 1,
): number | null {
  if (!Number.isFinite(current)) return null;
  let previous: number | null = null;
  for (const step of FONT_SIZE_STEPS) {
    if (direction === 1 && step > current) return step;
    if (direction === -1 && step >= current) return previous;
    previous = step;
  }
  return direction === -1 ? previous : null;
}

export function fontSizePatch(
  style: VisualStyle | undefined,
  direction: -1 | 1,
): StylePatch | null {
  const fontSize = stepFontSize(textFormatState(style).fontSize, direction);
  return fontSize === null ? null : { fontSize };
}

export function boldPatch(style: VisualStyle | undefined): StylePatch {
  return { fontWeight: textFormatState(style).bold ? null : 700 };
}

export function italicPatch(style: VisualStyle | undefined): StylePatch {
  return { fontStyle: textFormatState(style).italic ? null : "italic" };
}

export function decorationPatch(
  style: VisualStyle | undefined,
  flag: "underline" | "line-through",
): StylePatch {
  const state = textFormatState(style);
  const underline = flag === "underline" ? !state.underline : state.underline;
  const strikethrough =
    flag === "line-through" ? !state.strikethrough : state.strikethrough;
  const textDecoration = underline
    ? strikethrough
      ? "underline line-through"
      : "underline"
    : strikethrough
      ? "line-through"
      : null;
  return { textDecoration };
}

export function textAlignPatch(
  style: VisualStyle | undefined,
  value: TextAlignValue,
): StylePatch {
  return { textAlign: style?.textAlign === value ? null : value };
}

export function verticalAlignPatch(
  style: VisualStyle | undefined,
  value: VerticalAlignValue,
): StylePatch {
  return { verticalAlign: style?.verticalAlign === value ? null : value };
}

export function supportsVerticalAlign(
  leaves: readonly Pick<Element, "type">[],
): boolean {
  return leaves.length > 0 && leaves.every((leaf) => leaf.type === "text.note");
}
