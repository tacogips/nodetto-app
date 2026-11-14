// Connector lines, their labels, and the marker definitions they use.

import type { Element } from "@nodetto/ir";
import { bpmnFlowDecoration } from "../bpmn/notation.ts";
import type { ShapeContext } from "../shape-util.ts";
import {
  connectorDefaultDash,
  connectorDecoration,
  endpointReaderFor,
  MARKER_GEOMETRY,
  type MarkerEnd,
  type MarkerKind,
  type MarkerPaint,
  markerVariant,
  resolveConnector,
} from "../shapes/connector.ts";
import { connectorPath } from "../shapes/connector-path.ts";
import { type Attrs, fmt, tag, text, wrap } from "./markup.ts";
import { renderNotationPrimitive } from "./notation.ts";
import { styled, textStyled } from "./paint.ts";
import { STROKE_WIDTH, type SvgTheme } from "./theme.ts";

/** Definitions for exactly the markers `content` references, if any. */
export function markerDefs(theme: SvgTheme, content: string): string {
  const paints: Record<MarkerPaint, Attrs> = {
    filled: { fill: theme.ink, stroke: "none" },
    hollow: { fill: theme.surface, stroke: theme.ink, "stroke-width": 1.2 },
    line: {
      fill: "none",
      stroke: theme.ink,
      "stroke-width": 1.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
  };
  const markers = (Object.keys(MARKER_GEOMETRY) as MarkerKind[])
    .flatMap((kind) =>
      (["start", "end"] as const).map((end) => ({ kind, end })),
    )
    .filter(({ kind, end }) =>
      content.includes(`url(#${markerVariant(kind, end).id})`),
    );
  if (markers.length === 0) return "";
  return wrap(
    "defs",
    {},
    markers
      .map(({ kind, end }) => {
        const geometry = MARKER_GEOMETRY[kind];
        const variant = markerVariant(kind, end);
        const parts = geometry.parts
          .map((part) =>
            tag(part.element, { ...part.attributes, ...paints[part.paint] }),
          )
          .join("");
        return wrap(
          "marker",
          {
            id: variant.id,
            viewBox: geometry.viewBox,
            refX: variant.refX,
            refY: geometry.refY,
            markerWidth: geometry.width,
            markerHeight: geometry.height,
            markerUnits: "userSpaceOnUse",
            orient: "auto",
          },
          variant.transform
            ? wrap("g", { transform: variant.transform }, parts)
            : parts,
        );
      })
      .join(""),
  );
}

function markerUrl(
  kind: MarkerKind | null,
  end: MarkerEnd,
): string | undefined {
  return kind === null ? undefined : `url(#${markerVariant(kind, end).id})`;
}

export function renderConnector(
  element: Element,
  context: ShapeContext,
  theme: SvgTheme,
): string | null {
  const resolved = resolveConnector(
    element,
    context,
    endpointReaderFor(element.type),
  );
  if (!resolved) {
    return null;
  }
  const decoration = connectorDecoration(element);
  const common = {
    fill: "none",
    stroke: theme.ink,
    "stroke-width": STROKE_WIDTH,
    "marker-start": markerUrl(decoration.start, "start"),
    "marker-end": markerUrl(decoration.end, "end"),
    "stroke-dasharray": connectorDefaultDash(element),
  };
  const pathData = connectorPath(element, resolved.points, context);
  const line =
    pathData !== null
      ? tag("path", {
          ...styled({ d: pathData, ...common }, element.visual, element.id),
          fill: "none",
        })
      : resolved.points.length > 2
        ? tag("polyline", {
            ...styled(
              {
                points: resolved.points
                  .map((point) => `${fmt(point.x)},${fmt(point.y)}`)
                  .join(" "),
                ...common,
              },
              element.visual,
              element.id,
            ),
            fill: "none",
          })
        : tag(
            "line",
            styled(
              {
                x1: resolved.start.x,
                y1: resolved.start.y,
                x2: resolved.end.x,
                y2: resolved.end.y,
                ...common,
              },
              element.visual,
              element.id,
            ),
          );
  if (element.type.startsWith("bpmn.")) {
    return (
      line +
      bpmnFlowDecoration(element, resolved.points, (id) => context.resolve(id))
        .map((primitive) => renderNotationPrimitive(primitive))
        .join("")
    );
  }
  if (decoration.label === "") {
    return line;
  }
  return (
    line +
    text(
      textStyled(
        {
          x: resolved.labelPoint.x,
          y: resolved.labelPoint.y - 6,
          "text-anchor": "middle",
          fill: theme.muted,
          "font-size": 11,
        },
        element.visual,
      ),
      decoration.label,
    )
  );
}
