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
  const value = visual.textPadding;
  const padding =
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : undefined;
  const base = padding === undefined ? {} : { padding: `0 ${padding}px` };
  if (align === "middle") return base;
  return {
    ...base,
    "align-items": "flex-start",
    "padding-top": `${alignedLabelTop(align, height, lineCount * lineHeight, padding ?? 8)}px`,
  };
}
