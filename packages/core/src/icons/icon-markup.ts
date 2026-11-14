import type { Box } from "../geometry.ts";
import { fmt, tag, wrap } from "../svg-export/markup.ts";
import type { IconNode } from "./icon-registry.ts";

export interface IconPaint {
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly fill: string;
  readonly viewBox: number;
  readonly opacity?: number;
}
export function renderIconMarkup(
  source: { readonly nodes: readonly IconNode[] } | { readonly path: string },
  box: Box,
  paint: IconPaint,
): string {
  const scale = Math.min(box.width, box.height) / paint.viewBox;
  const x = box.x + (box.width - paint.viewBox * scale) / 2;
  const y = box.y + (box.height - paint.viewBox * scale) / 2;
  const children =
    "path" in source
      ? tag("path", { d: source.path })
      : source.nodes
          .map(({ element, attrs }) =>
            tag(element, {
              ...attrs,
              fill: attrs.fill === "currentColor" ? paint.stroke : "none",
            }),
          )
          .join("");
  return wrap(
    "g",
    {
      transform: `translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})`,
      fill: paint.fill,
      stroke: paint.stroke,
      "stroke-width": paint.strokeWidth,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: paint.opacity,
    },
    children,
  );
}
export function renderIconPlaceholder(box: Box, color: string): string {
  return tag("rect", {
    x: box.x + 1,
    y: box.y + 1,
    width: Math.max(0, box.width - 2),
    height: Math.max(0, box.height - 2),
    fill: "none",
    stroke: color,
    "stroke-dasharray": "2 2",
  });
}
