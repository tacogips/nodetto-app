import { alignedLabelTop, boxLabelVerticalAlign } from "@nodetto/core";
import type { Visual } from "@nodetto/ir";
import type { JSX } from "solid-js";

export function geoLabelAlignStyle(
  visual: Visual,
  height: number,
  lineCount: number,
  lineHeight: number,
): JSX.CSSProperties {
  const align = boxLabelVerticalAlign(visual);
  if (align === "middle") return {};
  return {
    "align-items": "flex-start",
    "padding-top": `${alignedLabelTop(align, height, lineCount * lineHeight, 8)}px`,
  };
}
