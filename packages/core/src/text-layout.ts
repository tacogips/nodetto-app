import type { Element, TextResizeMode, Visual } from "@nodetto/ir";
import { applyCommands, type Command } from "./commands.ts";
import { createShapeContext } from "./hit-test.ts";
import type { ShapeUtilRegistry } from "./shape-util.ts";
import { textNoteText } from "./shapes/textNote.ts";
import {
  measureTextWidth,
  textMeasureMode,
  truncateToWidth,
  wrapMeasuredLines,
} from "./text-measure.ts";
import type { Store } from "./store.ts";
import { clampLayoutSize } from "./size-limits.ts";

/** Deterministic defaults shared by canvas CSS, SVG export and derived sizing. */
export const TEXT_NOTE_FONT_SIZE = 13;
export const TEXT_NOTE_LINE_HEIGHT = 1.2;
export const TEXT_NOTE_PADDING_X = 8;
export const TEXT_NOTE_PADDING_Y = 6;
export const AVERAGE_GLYPH_WIDTH = 0.55;
export const MAX_AUTO_TEXT_SIZE = 1_000_000;

const graphemeSegmenter = new Intl.Segmenter("und", {
  granularity: "grapheme",
});
export function graphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), (part) => part.segment);
}

/**
 * Lines of `text`, CRLF or LF. Splits on a string: the native CLI's
 * interpreter splits on a regular expression in quadratic time.
 */
function paragraphs(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function safeSize(value: number): number {
  return Math.min(
    MAX_AUTO_TEXT_SIZE,
    Math.max(1, Number.isFinite(value) ? value : MAX_AUTO_TEXT_SIZE),
  );
}

export function textOwnsAxis(
  element: Element,
  axis: "width" | "height",
): boolean {
  return (
    element.type === "text.note" &&
    (element.visual.textResize === "auto-width" ||
      (element.visual.textResize === "auto-height" && axis === "height"))
  );
}

function glyphAdvance(fontSize: number, letterSpacing: number): number {
  return Math.max(0.1, fontSize * AVERAGE_GLYPH_WIDTH + letterSpacing);
}

export function estimatedTextWidth(
  text: string,
  fontSize: number,
  letterSpacing = 0,
): number {
  return graphemes(text).length * glyphAdvance(fontSize, letterSpacing);
}

/**
 * Greedy, deterministic wrapping. It deliberately estimates font metrics so
 * cloud collaborators with different installed fonts retain equal geometry.
 */
export function wrapTextLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  letterSpacing = 0,
): readonly string[] {
  const maxChars = Math.max(
    1,
    Math.floor(maxWidth / glyphAdvance(fontSize, letterSpacing)),
  );
  const lines: string[] = [];
  for (const paragraph of paragraphs(text)) {
    let line = "";
    let lineLength = 0;
    for (const token of paragraph.split(/( +)/)) {
      if (!token) continue;
      const clusters = graphemes(token);
      // Prefer whole words; whitespace itself is retained even at line edges.
      if (
        !token.startsWith(" ") &&
        lineLength > 0 &&
        lineLength + clusters.length > maxChars
      ) {
        lines.push(line);
        line = "";
        lineLength = 0;
      }
      for (const cluster of clusters) {
        if (lineLength >= maxChars) {
          lines.push(line);
          line = "";
          lineLength = 0;
        }
        line += cluster;
        lineLength += 1;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function textNoteLines(element: Element): {
  readonly lines: readonly string[];
  readonly truncated: boolean;
  readonly lineHeight: number;
  readonly fontSize: number;
} {
  const style = element.visual.style;
  const fontSize = Math.max(0.1, style?.fontSize ?? TEXT_NOTE_FONT_SIZE);
  const lineHeight = fontSize * (style?.lineHeight ?? TEXT_NOTE_LINE_HEIGHT);
  const measureStyle = {
    fontSize,
    fontWeight: style?.fontWeight,
    letterSpacing: style?.letterSpacing,
  };
  const mode = textMeasureMode(element.visual);
  const text = textNoteText(element.semantic);
  const width = Math.max(
    1,
    (element.visual.width ?? 200) -
      2 * (element.visual.textPadding ?? TEXT_NOTE_PADDING_X),
  );
  if (element.visual.textTruncate === "ellipsis") {
    if (element.visual.textResize === "auto-width")
      return {
        lines: [text.replace(/\r?\n/g, " ")],
        truncated: false,
        lineHeight,
        fontSize,
      };
    const result = truncateToWidth(text, width, measureStyle, mode);
    return {
      lines: [result.text],
      truncated: result.truncated,
      lineHeight,
      fontSize,
    };
  }
  if (mode === "proportional" && element.visual.textResize === "auto-width")
    return { lines: paragraphs(text), truncated: false, lineHeight, fontSize };
  const lines =
    mode === "proportional"
      ? wrapMeasuredLines(text, width, measureStyle, mode)
      : wrapTextLines(text, width, fontSize, style?.letterSpacing ?? 0);
  return { lines, truncated: false, lineHeight, fontSize };
}

export function measureTextNote(
  element: Element,
  mode: Exclude<TextResizeMode, "fixed">,
): { readonly width: number; readonly height: number } {
  const paddingX = element.visual.textPadding ?? TEXT_NOTE_PADDING_X;
  const paddingY = element.visual.textPadding ?? TEXT_NOTE_PADDING_Y;
  const text = textNoteText(element.semantic);
  const style = element.visual.style;
  const fontSize = Math.max(0.1, style?.fontSize ?? TEXT_NOTE_FONT_SIZE);
  const lineHeight = fontSize * (style?.lineHeight ?? TEXT_NOTE_LINE_HEIGHT);
  const letterSpacing = style?.letterSpacing ?? 0;
  if (
    textMeasureMode(element.visual) === "proportional" ||
    element.visual.textTruncate === "ellipsis"
  ) {
    const measureStyle = {
      fontSize,
      fontWeight: style?.fontWeight,
      letterSpacing,
    };
    const measureMode = textMeasureMode(element.visual);
    const explicitLines =
      element.visual.textTruncate === "ellipsis"
        ? [text.replace(/\r?\n/g, " ")]
        : paragraphs(text);
    if (mode === "auto-width")
      return {
        width: safeSize(
          Math.max(
            ...explicitLines.map((line) =>
              measureTextWidth(line, measureStyle, measureMode),
            ),
          ) +
            paddingX * 2,
        ),
        height: safeSize(explicitLines.length * lineHeight + paddingY * 2),
      };
    const width = Math.max(1, element.visual.width ?? 200);
    const lines =
      element.visual.textTruncate === "ellipsis"
        ? [""]
        : wrapMeasuredLines(
            text,
            Math.max(1, width - paddingX * 2),
            measureStyle,
            measureMode,
          );
    return {
      width,
      height: safeSize(Math.max(1, lines.length) * lineHeight + paddingY * 2),
    };
  }
  if (mode === "auto-width") {
    const explicitLines = paragraphs(text);
    const characters = explicitLines.reduce(
      (longest, line) => Math.max(longest, graphemes(line).length),
      0,
    );
    return {
      width: safeSize(
        characters * glyphAdvance(fontSize, letterSpacing) + paddingX * 2,
      ),
      height: safeSize(
        Math.max(1, explicitLines.length) * lineHeight + paddingY * 2,
      ),
    };
  }
  const width = Math.max(1, element.visual.width ?? 200);
  const lines = wrapTextLines(
    text,
    Math.max(1, width - paddingX * 2),
    fontSize,
    letterSpacing,
  );
  return {
    width,
    height: safeSize(Math.max(1, lines.length) * lineHeight + paddingY * 2),
  };
}

/** Materialize auto-sized text geometry before/after deterministic layout. */
export function planTextResize(
  store: Store,
  registry: ShapeUtilRegistry,
): Command[] {
  const candidates = store
    .getSnapshot()
    .elements.filter(
      (element) =>
        element.type === "text.note" &&
        (element.visual.textResize === "auto-width" ||
          element.visual.textResize === "auto-height"),
    );
  if (!candidates.length) return [];
  const context = createShapeContext(store, registry, 1);
  const commands: Command[] = [];
  for (const element of candidates) {
    if (context.isLocked?.(element.id)) continue;
    const mode = element.visual.textResize as Exclude<TextResizeMode, "fixed">;
    const measured = measureTextNote(element, mode);
    const { numberTokens: oldLinks, ...rest } = element.visual;
    const links = Object.fromEntries(
      Object.entries(oldLinks ?? {}).filter(
        ([field]) =>
          field !== "height" && !(mode === "auto-width" && field === "width"),
      ),
    );
    const visual: Visual = {
      ...rest,
      width:
        mode === "auto-width"
          ? clampLayoutSize(element.visual, "width", measured.width)
          : measured.width,
      height: clampLayoutSize(element.visual, "height", measured.height),
      ...(Object.keys(links).length ? { numberTokens: links } : {}),
    };
    if (JSON.stringify(visual) !== JSON.stringify(element.visual))
      commands.push({ type: "replaceVisual", id: element.id, visual });
  }
  if (commands.length) applyCommands(store, commands);
  return commands;
}
