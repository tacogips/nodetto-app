// Box shapes with a single label: geo, generic node, sequence lifelines,
// and the placeholder for types this build does not draw.

import type { Element } from "@nodetto/ir";
import { resolvedCornerRadii, roundedRectPath } from "../corner-radii.ts";
import type { Box } from "../geometry.ts";
import { nodeLabelLayout } from "../node-label.ts";
import { geoOutline } from "../shapes/geo-outline.ts";
import { geoFlipOf } from "../shapes/outline.ts";
import { fmt, readString, tag, text, wrap } from "./markup.ts";
import { centredLabel, styled, textStyled } from "./paint.ts";
import { STROKE_WIDTH, type SvgTheme } from "./theme.ts";

const DASH_PATTERNS: Record<string, string> = {
  solid: "",
  dashed: "6 4",
  dotted: "1 4",
};

export function renderGeo(element: Element, box: Box, theme: SvgTheme): string {
  const outline = geoOutline(
    readString(element.semantic, "geo") || "rect",
    box.width,
    box.height,
    geoFlipOf(element),
  );
  const shape = styled(
    { fill: theme.surface, stroke: theme.ink, "stroke-width": STROKE_WIDTH },
    element.visual,
    element.id,
  );
  let body: string;
  switch (outline.kind) {
    case "ellipse":
      body = tag("ellipse", {
        cx: outline.cx,
        cy: outline.cy,
        rx: outline.rx,
        ry: outline.ry,
        ...shape,
      });
      break;
    case "polygon":
      body =
        tag("polygon", { points: outline.points, ...shape }) +
        (outline.detail
          ? tag("path", { d: outline.detail, ...shape, fill: "none" })
          : "");
      break;
    case "cylinder":
      body =
        tag("path", { d: outline.path, ...shape }) +
        tag("ellipse", {
          cx: outline.cap.cx,
          cy: outline.cap.cy,
          rx: outline.cap.rx,
          ry: outline.cap.ry,
          ...shape,
        });
      break;
    default:
      body = element.visual.style?.cornerRadii
        ? tag("path", {
            d: roundedRectPath(
              {
                x: outline.x,
                y: outline.y,
                width: outline.width,
                height: outline.height,
              },
              resolvedCornerRadii(element.visual.style),
            ),
            ...shape,
          })
        : tag("rect", {
            x: outline.x,
            y: outline.y,
            width: outline.width,
            height: outline.height,
            rx: element.visual.style?.cornerRadius ?? outline.rx,
            ...shape,
          });
      break;
  }
  return (
    wrap("g", { transform: `translate(${fmt(box.x)} ${fmt(box.y)})` }, body) +
    centredLabel(
      box,
      readString(element.semantic, "label"),
      element.visual,
      theme,
    )
  );
}

export function renderNode(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  const layout = nodeLabelLayout(readString(element.semantic, "label"), {
    ...element.visual,
    width: box.width,
    height: box.height,
  });
  const clipId = `node-label-${Array.from(element.id, (character) => character.codePointAt(0)?.toString(16)).join("-")}`;
  const anchor = element.visual.style?.textAlign ?? "middle";
  const x =
    anchor === "start"
      ? box.x + 10
      : anchor === "end"
        ? box.x + box.width - 10
        : box.x + box.width / 2;
  const label =
    wrap(
      "defs",
      {},
      wrap(
        "clipPath",
        { id: clipId },
        tag("rect", {
          x: box.x + 10,
          y: box.y,
          width: layout.width,
          height: box.height,
        }),
      ),
    ) +
    wrap(
      "g",
      { "clip-path": `url(#${clipId})` },
      layout.lines
        .map((line, index) =>
          text(
            textStyled(
              {
                x,
                y: box.y + layout.top + (index + 0.5) * layout.lineHeight,
                "text-anchor": anchor,
                "dominant-baseline": "central",
                fill: theme.ink,
                "font-size": layout.fontSize,
                "xml:space": "preserve",
              },
              element.visual,
            ),
            line,
          ),
        )
        .join(""),
    );
  return (
    tag(
      element.visual.style?.cornerRadii ? "path" : "rect",
      styled(
        element.visual.style?.cornerRadii
          ? {
              d: roundedRectPath(
                box,
                resolvedCornerRadii(element.visual.style, 8),
              ),
              fill: theme.surface,
              stroke: theme.ink,
              "stroke-width": STROKE_WIDTH,
            }
          : {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              rx: element.visual.style?.cornerRadius ?? 8,
              fill: theme.surface,
              stroke: theme.ink,
              "stroke-width": STROKE_WIDTH,
            },
        element.visual,
        element.id,
      ),
    ) + label
  );
}

export function renderSequenceParticipant(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  const head = { x: box.x, y: box.y, width: box.width, height: 56 };
  return (
    tag("line", {
      x1: box.x + box.width / 2,
      y1: box.y + head.height,
      x2: box.x + box.width / 2,
      y2: box.y + box.height,
      stroke: theme.muted,
      "stroke-width": 1,
      "stroke-dasharray": "5 4",
    }) +
    tag(
      "rect",
      styled(
        {
          ...head,
          rx: 8,
          fill: theme.surface,
          stroke: theme.ink,
          "stroke-width": STROKE_WIDTH,
        },
        element.visual,
        element.id,
      ),
    ) +
    centredLabel(
      head,
      readString(element.semantic, "name"),
      element.visual,
      theme,
    )
  );
}

export function renderSequenceActivation(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  return tag(
    "rect",
    styled(
      {
        ...box,
        fill: theme.surface,
        stroke: theme.ink,
        "stroke-width": 1,
      },
      element.visual,
      element.id,
    ),
  );
}

/**
 * Anything this build does not draw, drawn anyway: a dashed placeholder at
 * the element's own bounds, so an export of a newer document shows that
 * something is there rather than silently losing it.
 */
export function renderUnsupported(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  return (
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rx: 4,
      fill: "none",
      stroke: theme.muted,
      "stroke-width": 1,
      "stroke-dasharray": DASH_PATTERNS["dashed"] as string,
    }) +
    text(
      {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        fill: theme.muted,
        "font-size": 11,
      },
      `unsupported: ${element.type}`,
    )
  );
}
