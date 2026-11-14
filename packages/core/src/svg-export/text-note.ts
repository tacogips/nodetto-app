// Text notes: wrapped, clipped lines with rich-text marks and links.

import type { Element, TextMark } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { richTextSegments, safeTextLinkHref } from "../rich-text.ts";
import { textNoteText } from "../shapes/textNote.ts";
import {
  TEXT_NOTE_LINE_HEIGHT,
  TEXT_NOTE_PADDING_Y,
  wrapTextLines,
} from "../text-layout.ts";
import { type Attrs, escapeXml, tag, wrap } from "./markup.ts";
import { styled, textStyled } from "./paint.ts";
import { type SvgTheme, TEXT_PADDING } from "./theme.ts";

/** Line height as a multiple of the font size, matching the stylesheet. */
const LINE_HEIGHT = TEXT_NOTE_LINE_HEIGHT;
/** Vertical inset of a text note's first line, matching the note view. */
const NOTE_PADDING_Y = TEXT_NOTE_PADDING_Y;

/**
 * A text note: optional fill, then the wrapped lines from the top of the
 * box, clipped to the lines that fit entirely, the way the canvas clips.
 */
export function renderTextNote(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  const paddingX = element.visual.textPadding ?? TEXT_PADDING;
  const paddingY = element.visual.textPadding ?? NOTE_PADDING_Y;
  const style = element.visual.style;
  const parts: string[] = [];
  if (style?.fill !== undefined || style?.fillGradient !== undefined) {
    parts.push(
      tag(
        "rect",
        styled(
          {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            fill: style.fill,
            stroke: "none",
          },
          element.visual,
          element.id,
        ),
      ),
    );
  }
  const fontSize = style?.fontSize ?? theme.fontSize;
  const lineHeight = fontSize * (style?.lineHeight ?? LINE_HEIGHT);
  const anchor = style?.textAlign ?? "start";
  const x =
    anchor === "start"
      ? box.x + paddingX
      : anchor === "end"
        ? box.x + box.width - paddingX
        : box.x + box.width / 2;
  const lines = wrapTextLines(
    textNoteText(element.semantic),
    Math.max(1, box.width - paddingX * 2),
    fontSize,
    style?.letterSpacing ?? 0,
  );
  const freeHeight = Math.max(
    0,
    box.height - paddingY * 2 - lines.length * lineHeight,
  );
  const verticalOffset =
    style?.verticalAlign === "bottom"
      ? freeHeight
      : style?.verticalAlign === "middle"
        ? freeHeight / 2
        : 0;
  const source = textNoteText(element.semantic);
  const richSegments = richTextSegments(element.semantic);
  const hasRichText = richSegments.some((segment) => segment.marks.length > 0);
  let sourceCursor = 0;
  const markedLine = (line: string, start: number): string => {
    const end = start + line.length;
    const content = richSegments
      .filter((segment) => segment.end > start && segment.start < end)
      .map((segment) => {
        const value = source.slice(
          Math.max(start, segment.start),
          Math.min(end, segment.end),
        );
        const kinds = new Set(segment.marks.map((mark) => mark.kind));
        const attrs: Attrs = {
          ...(kinds.has("bold") ? { "font-weight": 700 } : {}),
          ...(kinds.has("italic") ? { "font-style": "italic" } : {}),
          ...(kinds.has("code")
            ? {
                "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
              }
            : {}),
          ...(kinds.has("strike") || kinds.has("underline") || kinds.has("link")
            ? {
                "text-decoration":
                  `${kinds.has("link") || kinds.has("underline") ? "underline" : ""}${kinds.has("strike") ? " line-through" : ""}`.trim(),
              }
            : {}),
          ...(kinds.has("link") ? { fill: theme.accent } : {}),
        };
        const span = wrap("tspan", attrs, escapeXml(value));
        const link = segment.marks.find(
          (mark): mark is TextMark & { readonly href: string } =>
            mark.kind === "link" &&
            typeof mark.href === "string" &&
            safeTextLinkHref(mark.href) !== null,
        );
        return link
          ? wrap(
              "a",
              {
                href: safeTextLinkHref(link.href) ?? undefined,
                rel: "noopener noreferrer",
              },
              span,
            )
          : span;
      })
      .join("");
    return hasRichText && content ? content : escapeXml(line);
  };
  for (const [at, line] of lines.entries()) {
    const top = box.y + paddingY + verticalOffset + at * lineHeight;
    if (top + lineHeight > box.y + box.height + 0.01) {
      break;
    }
    const found = source.indexOf(line, sourceCursor);
    const lineStart = found >= 0 ? found : sourceCursor;
    sourceCursor = lineStart + line.length;
    if (line === "") {
      continue;
    }
    parts.push(
      wrap(
        "text",
        textStyled(
          {
            x,
            y: top + lineHeight / 2,
            "xml:space": "preserve",
            style: "white-space: pre;",
            "text-anchor": anchor,
            "dominant-baseline": "central",
            fill: theme.ink,
            "font-size": fontSize,
          },
          element.visual,
        ),
        markedLine(line, lineStart),
      ),
    );
  }
  return parts.join("");
}
