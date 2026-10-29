// Wrapped labels shared by the canvas and SVG export: a label centred in a
// basic shape and an edge label above its route midpoint. Like node labels
// they wrap by estimated glyph widths, so every client and export breaks
// lines in the same places; explicit newlines always break.

import type { Visual } from "@nodetto/ir";
import type { Box, Vec } from "./geometry.ts";
import {
  AVERAGE_GLYPH_WIDTH,
  TEXT_NOTE_PADDING_X,
  wrapTextLines,
} from "./text-layout.ts";

export const BOX_LABEL_FONT_SIZE = 13;
export const CONNECTOR_LABEL_FONT_SIZE = 11;
/** Edge labels wrap at this width, centred on the route midpoint. */
export const CONNECTOR_LABEL_WIDTH = 160;
/** Gap between an edge label's last baseline and its anchor on the route. */
export const CONNECTOR_LABEL_GAP = 6;
/** Room kept around an edge label's text by the backdrop behind it. */
export const CONNECTOR_LABEL_BACKDROP_PADDING = 2;

export interface LabelLayout {
  readonly lines: readonly string[];
  readonly fontSize: number;
  readonly lineHeight: number;
}

function labelLayout(
  label: string,
  maxWidth: number,
  visual: Visual,
  defaultFontSize: number,
): LabelLayout {
  const fontSize = visual.style?.fontSize ?? defaultFontSize;
  return {
    // Centred lines drop the spaces left at wrap points.
    lines:
      label === ""
        ? []
        : wrapTextLines(
            label,
            Math.max(1, maxWidth),
            fontSize,
            visual.style?.letterSpacing ?? 0,
          ).map((line) => line.trim()),
    fontSize,
    lineHeight: fontSize * (visual.style?.lineHeight ?? 1.2),
  };
}

/** A label centred in a box `width` wide, inside the canvas label padding. */
export function boxLabelLayout(
  label: string,
  width: number,
  visual: Visual,
  defaultFontSize = BOX_LABEL_FONT_SIZE,
): LabelLayout {
  return labelLayout(
    label,
    width - 2 * TEXT_NOTE_PADDING_X,
    visual,
    defaultFontSize,
  );
}

export function connectorLabelLayout(
  label: string,
  visual: Visual,
): LabelLayout {
  return labelLayout(
    label,
    CONNECTOR_LABEL_WIDTH,
    visual,
    CONNECTOR_LABEL_FONT_SIZE,
  );
}

/**
 * Baselines stacking an edge label upward from its anchor, so the last line
 * sits where a one-line label always has and the text never covers the line.
 */
export function connectorLabelBaselines(
  layout: LabelLayout,
  anchorY: number,
): readonly number[] {
  const last = layout.lines.length - 1;
  return layout.lines.map(
    (_, index) =>
      anchorY - CONNECTOR_LABEL_GAP - (last - index) * layout.lineHeight,
  );
}

/**
 * The estimated page box of an edge label's text, or null for no text. The
 * bottom leaves room for descenders below the last baseline.
 */
export function connectorLabelExtent(
  layout: LabelLayout,
  anchor: Vec,
): Box | null {
  if (layout.lines.length === 0) return null;
  const longest = Math.max(...layout.lines.map((line) => [...line].length));
  const width = longest * layout.fontSize * AVERAGE_GLYPH_WIDTH;
  const top =
    (connectorLabelBaselines(layout, anchor.y)[0] as number) - layout.fontSize;
  const bottom = anchor.y - CONNECTOR_LABEL_GAP + layout.fontSize * 0.3;
  return { x: anchor.x - width / 2, y: top, width, height: bottom - top };
}

/**
 * The box drawn behind an edge label in the canvas or page colour, so a line
 * running through the label (its own on a vertical or diagonal route, or
 * another edge) does not cross the text.
 */
export function connectorLabelBackdrop(
  layout: LabelLayout,
  anchor: Vec,
): Box | null {
  const extent = connectorLabelExtent(layout, anchor);
  if (!extent) return null;
  const pad = CONNECTOR_LABEL_BACKDROP_PADDING;
  return {
    x: extent.x - pad,
    y: extent.y - pad,
    width: extent.width + 2 * pad,
    height: extent.height + 2 * pad,
  };
}
