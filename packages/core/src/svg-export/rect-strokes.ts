import type { CornerRadii, VisualStyle } from "@nodetto/ir";
import { resolvedCornerRadii, roundedRectPath } from "../corner-radii.ts";
import type { Box } from "../geometry.ts";
import { tag, wrap } from "./markup.ts";

export interface RectStrokeParts {
  readonly fillBox: Box;
  readonly strokeBox?: Box;
  readonly strokeWidth: number;
  readonly strips: readonly Box[];
  readonly clipBox: Box;
  readonly radii: CornerRadii;
}

function inset(box: Box, amount: number): Box {
  return {
    x: box.x + amount,
    y: box.y + amount,
    width: Math.max(0, box.width - 2 * amount),
    height: Math.max(0, box.height - 2 * amount),
  };
}

export function rectStrokeParts(
  box: Box,
  style: VisualStyle | undefined,
): RectStrokeParts | undefined {
  if (style?.strokeAlign === undefined && style?.strokeSides === undefined)
    return undefined;
  const strokeWidth = style.strokeWidth ?? 1.5;
  const align = style.strokeAlign ?? "inside";
  const radii = resolvedCornerRadii(style);
  if (!style.strokeSides) {
    return {
      fillBox: box,
      strokeBox: inset(
        box,
        align === "inside"
          ? strokeWidth / 2
          : align === "outside"
            ? -strokeWidth / 2
            : 0,
      ),
      strokeWidth,
      strips: [],
      clipBox: box,
      radii,
    };
  }
  const { top = 0, right = 0, bottom = 0, left = 0 } = style.strokeSides;
  const factor = align === "inside" ? 0 : align === "center" ? 0.5 : 1;
  const strips = [
    { x: box.x, y: box.y - top * factor, width: box.width, height: top },
    {
      x: box.x + box.width - right * (1 - factor),
      y: box.y,
      width: right,
      height: box.height,
    },
    {
      x: box.x,
      y: box.y + box.height - bottom * (1 - factor),
      width: box.width,
      height: bottom,
    },
    { x: box.x - left * factor, y: box.y, width: left, height: box.height },
  ].filter((strip) => strip.width > 0 && strip.height > 0);
  return {
    fillBox: box,
    strokeWidth,
    strips,
    clipBox:
      align === "outside"
        ? inset(box, -Math.max(top, right, bottom, left))
        : box,
    radii,
  };
}

export function rectStrokeMarkup(
  parts: RectStrokeParts,
  paint: { fill?: string; stroke?: string; opacity?: number },
  clipId: string,
): string {
  const path = (box: Box) => roundedRectPath(box, parts.radii);
  const fill = tag("path", {
    d: path(parts.fillBox),
    fill: paint.fill,
    stroke: "none",
  });
  const border = parts.strokeBox
    ? tag("path", {
        d: path(parts.strokeBox),
        fill: "none",
        stroke: paint.stroke,
        "stroke-width": parts.strokeWidth,
      })
    : wrap(
        "clipPath",
        { id: clipId },
        tag("path", { d: path(parts.clipBox) }),
      ) +
      wrap(
        "g",
        { "clip-path": `url(#${clipId})`, fill: paint.stroke },
        parts.strips.map((strip) => tag("rect", { ...strip })).join(""),
      );
  return wrap("g", { opacity: paint.opacity }, fill + border);
}
