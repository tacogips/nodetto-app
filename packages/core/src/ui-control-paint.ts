import type { Element, UiControlSemantic } from "@nodetto/ir";

export function resolveUiControlPaint(
  element: Element,
  theme: { ink: string; fontFamily: string },
) {
  const style = element.visual.style;
  const semantic = element.semantic as UiControlSemantic;
  const accent = style?.accentColor ?? "#137e7e";
  const color = style?.color ?? theme.ink;
  return {
    fill: style?.fill ?? "#f1f5f9",
    stroke: style?.stroke ?? theme.ink,
    strokeWidth: style?.strokeWidth ?? 1,
    radius: style?.cornerRadius ?? 6,
    accent,
    selected:
      style?.selectedColor ??
      (semantic.indicator === "underline" ? accent : color),
    selectedFill: style?.accentColor ?? "#d6ecef",
    color,
    fontFamily: style?.fontFamily ?? theme.fontFamily,
  };
}
