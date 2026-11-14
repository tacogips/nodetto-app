import {
  AVERAGE_GLYPH_WIDTH,
  estimatedTextWidth,
  graphemes,
} from "./text-layout.ts";
import { LIBERATION_SANS_ADVANCES } from "./text-metrics/advances.generated.ts";
import { isWideCodePoint } from "./wide-text-width.ts";

export const APP_FONT_STACK =
  '-apple-system, "SF Pro Text", "SF Pro", system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif';
export type TextMeasureMode = "estimate" | "proportional";
export interface TextMeasureStyle {
  readonly fontSize: number;
  readonly fontWeight?: number;
  readonly letterSpacing?: number;
}
export function textMeasureMode(visual: {
  readonly textMeasure?: "proportional";
}): TextMeasureMode {
  return visual.textMeasure === "proportional" ? "proportional" : "estimate";
}
export function measureTextWidth(
  text: string,
  style: TextMeasureStyle,
  mode: TextMeasureMode,
): number {
  const line = text.replace(/\r?\n/g, " ");
  if (mode === "estimate")
    return estimatedTextWidth(line, style.fontSize, style.letterSpacing);
  const table =
    (style.fontWeight ?? 400) >= 600
      ? LIBERATION_SANS_ADVANCES.bold
      : LIBERATION_SANS_ADVANCES.regular;
  let width = 0;
  for (const cluster of graphemes(line)) {
    const cp = cluster.codePointAt(0) ?? 0;
    const advance = cp >= 0x20 && cp <= 0xff ? table[cp - 0x20] : undefined;
    width +=
      advance !== undefined && advance >= 0
        ? (advance / LIBERATION_SANS_ADVANCES.unitsPerEm) * style.fontSize
        : (isWideCodePoint(cp) ? 1 : AVERAGE_GLYPH_WIDTH) * style.fontSize;
    width += style.letterSpacing ?? 0;
  }
  return width;
}
export function wrapMeasuredLines(
  text: string,
  maxWidth: number,
  style: TextMeasureStyle,
  mode: TextMeasureMode,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n/g, "\n").split("\n")) {
    if (maxWidth <= 0) {
      const parts = graphemes(paragraph);
      lines.push(...(parts.length ? parts : [""]));
      continue;
    }
    let line = "";
    let spaces = "";
    for (const token of paragraph.split(/( +)/)) {
      if (!token) continue;
      if (token.startsWith(" ")) {
        spaces += token;
        continue;
      }
      if (
        line &&
        measureTextWidth(line + spaces + token, style, mode) > maxWidth
      ) {
        lines.push(line);
        line = "";
        spaces = "";
      }
      const word = line + spaces + token;
      spaces = "";
      if (measureTextWidth(word, style, mode) <= maxWidth) {
        line = word;
        continue;
      }
      for (const cluster of graphemes(word)) {
        if (line && measureTextWidth(line + cluster, style, mode) > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += cluster;
      }
    }
    lines.push(line + spaces);
  }
  return lines;
}
export function truncateToWidth(
  text: string,
  maxWidth: number,
  style: TextMeasureStyle,
  mode: TextMeasureMode,
): { readonly text: string; readonly truncated: boolean } {
  const line = text.replace(/\r?\n/g, " ");
  if (measureTextWidth(line, style, mode) <= maxWidth)
    return { text: line, truncated: false };
  if (measureTextWidth("…", style, mode) > maxWidth)
    return { text: "", truncated: true };
  const parts = graphemes(line);
  while (parts.length) {
    parts.pop();
    const candidate = `${parts.join("").trimEnd()}…`;
    if (measureTextWidth(candidate, style, mode) <= maxWidth)
      return { text: candidate, truncated: true };
  }
  return { text: "…", truncated: true };
}
