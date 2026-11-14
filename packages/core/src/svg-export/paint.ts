// Paint servers and styling: document style over theme, gradients,
// filter effects, and text attributes.

import type { FillGradient, LayerEffect, Visual } from "@nodetto/ir";
import { fontFeatureCss, fontVariationCss } from "../font-settings.ts";
import type { Box } from "../geometry.ts";
import {
  angularGradientPatches,
  diamondGradientPatches,
  gradientId,
  linearGradientVector,
  sampleGradient,
  strokeGradientId,
} from "../gradient.ts";
import { strokeDashCss } from "../stroke-dash.ts";
import { type Attrs, fmt, tag, text, wrap } from "./markup.ts";
import { type SvgTheme, TEXT_PADDING } from "./theme.ts";

/** Document styling wins over the theme, field by field. */
export function styled(base: Attrs, visual: Visual, elementId?: string): Attrs {
  const style = visual.style;
  if (!style) {
    return base;
  }
  const out: Attrs = { ...base };
  if (style.fillGradient && elementId)
    out["fill"] = `url(#${gradientId(elementId)})`;
  else if (style.fill !== undefined) {
    out["fill"] = style.fill;
  }
  if (style.strokeGradient && elementId)
    out["stroke"] = `url(#${strokeGradientId(elementId)})`;
  else if (style.stroke !== undefined) {
    out["stroke"] = style.stroke;
  }
  if (style.strokeWidth !== undefined) {
    out["stroke-width"] = style.strokeWidth;
  }
  if (style.strokeCap !== undefined) out["stroke-linecap"] = style.strokeCap;
  if (style.strokeJoin !== undefined) out["stroke-linejoin"] = style.strokeJoin;
  if (style.strokeMiterLimit !== undefined)
    out["stroke-miterlimit"] = style.strokeMiterLimit;
  const dash = strokeDashCss(style);
  if (dash !== undefined) out["stroke-dasharray"] = dash;
  if (style.strokeDashOffset !== undefined)
    out["stroke-dashoffset"] = style.strokeDashOffset;
  if (style.opacity !== undefined) {
    out["opacity"] = style.opacity;
  }
  return out;
}

export function gradientDefinition(
  id: string,
  gradient: FillGradient,
  box: Box,
): string {
  const stops = gradient.stops
    .map((stop) =>
      tag("stop", {
        offset: stop.offset,
        "stop-color": stop.color,
        "stop-opacity": stop.opacity ?? 1,
      }),
    )
    .join("");
  if (gradient.type === "linear") {
    const vector = linearGradientVector(gradient.angle, box.width, box.height);
    return wrap(
      "linearGradient",
      {
        id,
        gradientUnits: "userSpaceOnUse",
        x1: box.x + vector.x1 * box.width,
        y1: box.y + vector.y1 * box.height,
        x2: box.x + vector.x2 * box.width,
        y2: box.y + vector.y2 * box.height,
      },
      stops,
    );
  }
  if (gradient.type === "angular" || gradient.type === "diamond") {
    const outside = sampleGradient(gradient.stops, 1);
    const background =
      gradient.type === "diamond"
        ? tag("rect", {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            fill: outside.color,
            "fill-opacity": outside.opacity,
          })
        : "";
    const patches =
      gradient.type === "angular"
        ? angularGradientPatches(gradient, box.width, box.height, box.x, box.y)
        : diamondGradientPatches(gradient, box.width, box.height, box.x, box.y);
    return wrap(
      "pattern",
      {
        id,
        patternUnits: "userSpaceOnUse",
        x: box.x,
        y: box.y,
        width: Math.abs(box.width) || 1,
        height: Math.abs(box.height) || 1,
      },
      `${background}${patches
        .map((patch) =>
          tag("polygon", {
            points: patch.points,
            fill: patch.color,
            "fill-opacity": patch.opacity,
          }),
        )
        .join("")}`,
    );
  }
  const width = Math.abs(box.width);
  const height = Math.abs(box.height);
  const base = width || height || 1;
  const cx = box.x + gradient.centerX * box.width;
  const cy = box.y + gradient.centerY * box.height;
  const scaleX = width ? 1 : 1 / base;
  const scaleY = height ? height / base : 1 / base;
  return wrap(
    "radialGradient",
    {
      id,
      gradientUnits: "userSpaceOnUse",
      cx,
      cy,
      r: gradient.radius * base,
      gradientTransform: `translate(${fmt(cx)} ${fmt(cy)}) scale(${fmt(scaleX)} ${fmt(scaleY)}) translate(${fmt(-cx)} ${fmt(-cy)})`,
    },
    stops,
  );
}

export function effectPrimitives(effects: readonly LayerEffect[]): string {
  const enabled = effects.filter((effect) => effect.enabled !== false);
  const backdrop = enabled.filter(
    (effect) => effect.type === "background-blur",
  );
  const content = enabled.filter((effect) => effect.type !== "background-blur");
  const primitives: string[] = [];
  let backdropInput = "BackgroundImage";
  for (const [index, effect] of backdrop.entries()) {
    const result = `nodetto-backdrop-${index}`;
    primitives.push(
      tag("feGaussianBlur", {
        in: backdropInput,
        stdDeviation: effect.blur,
        result,
      }),
    );
    backdropInput = result;
  }
  if (backdrop.length) {
    primitives.push(
      tag("feComposite", {
        in: backdropInput,
        in2: "SourceAlpha",
        operator: "in",
        result: "nodetto-backdrop-clipped",
      }),
    );
  }
  let contentInput = "SourceGraphic";
  for (const [index, effect] of content.entries()) {
    const result = `nodetto-content-${index}`;
    primitives.push(
      effect.type === "drop-shadow"
        ? tag("feDropShadow", {
            in: contentInput,
            dx: effect.x,
            dy: effect.y,
            stdDeviation: effect.blur,
            "flood-color": effect.color,
            "flood-opacity": effect.opacity,
            result,
          })
        : tag("feGaussianBlur", {
            in: contentInput,
            stdDeviation: effect.blur,
            result,
          }),
    );
    contentInput = result;
  }
  if (backdrop.length) {
    primitives.push(
      wrap(
        "feMerge",
        {},
        tag("feMergeNode", { in: "nodetto-backdrop-clipped" }) +
          tag("feMergeNode", { in: contentInput }),
      ),
    );
  }
  return primitives.join("");
}

export function textStyled(base: Attrs, visual: Visual): Attrs {
  const style = visual.style;
  if (!style) {
    return base;
  }
  const out: Attrs = { ...base };
  if (style.fontFamily !== undefined) out["font-family"] = style.fontFamily;
  if (style.fontWeight !== undefined) out["font-weight"] = style.fontWeight;
  if (style.fontStyle !== undefined) out["font-style"] = style.fontStyle;
  if (fontVariationCss(style) !== undefined)
    out["font-variation-settings"] = fontVariationCss(style);
  if (fontFeatureCss(style) !== undefined)
    out["font-feature-settings"] = fontFeatureCss(style);
  if (style.textDecoration !== undefined)
    out["text-decoration"] = style.textDecoration;
  if (style.letterSpacing !== undefined)
    out["letter-spacing"] = style.letterSpacing;
  if (style.color !== undefined) {
    out["fill"] = style.color;
  }
  if (style.fontSize !== undefined) {
    out["font-size"] = style.fontSize;
  }
  return out;
}

/** A label centred in `box`, honouring the element's text styling. */
export function centredLabel(
  box: Box,
  label: string,
  visual: Visual,
  theme: SvgTheme,
): string {
  if (label === "") {
    return "";
  }
  const anchor = visual.style?.textAlign ?? "middle";
  const x =
    anchor === "start"
      ? box.x + TEXT_PADDING
      : anchor === "end"
        ? box.x + box.width - TEXT_PADDING
        : box.x + box.width / 2;
  return text(
    textStyled(
      {
        x,
        y: box.y + box.height / 2,
        "text-anchor": anchor,
        "dominant-baseline": "central",
        fill: theme.ink,
        "font-size": theme.fontSize,
      },
      visual,
    ),
    label,
  );
}
