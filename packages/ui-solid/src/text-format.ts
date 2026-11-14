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

/** How a selection's text aligns vertically: text notes, or box labels. */
export type VerticalAlignKind = "note" | "box";
const BOX_LABEL_TYPES: ReadonlySet<string> = new Set([
  "shape.geo",
  "node.generic",
]);

export function verticalAlignKind(
  leaves: readonly Pick<Element, "type">[],
): VerticalAlignKind | null {
  if (leaves.length === 0) return null;
  if (leaves.every((leaf) => leaf.type === "text.note")) return "note";
  if (leaves.every((leaf) => BOX_LABEL_TYPES.has(leaf.type))) return "box";
  return null;
}

/** Notes start at the top; a box label is centred until it opts in. */
export function verticalAlignValue(
  style: VisualStyle | undefined,
  kind: VerticalAlignKind,
): VerticalAlignValue {
  if (kind === "note") return style?.verticalAlign ?? "top";
  return style?.boxLabelAlign === true
    ? (style.verticalAlign ?? "middle")
    : "middle";
}

export function verticalAlignPatch(
  style: VisualStyle | undefined,
  value: VerticalAlignValue,
  kind: VerticalAlignKind = "note",
): StylePatch {
  if (kind === "note")
    return { verticalAlign: style?.verticalAlign === value ? null : value };
  // Centred is the box default: choosing it, or the active side again,
  // clears the opt-in instead of storing it.
  return value === "middle" || verticalAlignValue(style, "box") === value
    ? { verticalAlign: null, boxLabelAlign: null }
    : { verticalAlign: value, boxLabelAlign: true };
}

export function supportsVerticalAlign(
  leaves: readonly Pick<Element, "type">[],
): boolean {
  return verticalAlignKind(leaves) !== null;
}
