// BPMN, breadboard and state notation primitives as SVG.

import type { Element } from "@nodetto/ir";
import { bpmnNotation, type NotationPrimitive } from "../bpmn/notation.ts";
import { breadboardNotation } from "../breadboard/notation.ts";
import type { Box } from "../geometry.ts";
import { escapeXml, fmt, tag, wrap } from "./markup.ts";

export function renderNotationPrimitive(
  primitive: NotationPrimitive & { readonly opacity?: number },
  classPrefix = "bpmn",
): string {
  const common = {
    class: `${classPrefix}-${primitive.role}`,
    fill: primitive.fill,
    stroke: primitive.stroke,
    "stroke-width": primitive.strokeWidth,
    "stroke-dasharray": primitive.dash,
    opacity: primitive.opacity,
  };
  switch (primitive.kind) {
    case "rect":
      return tag("rect", {
        ...common,
        x: primitive.x,
        y: primitive.y,
        width: primitive.width,
        height: primitive.height,
        rx: primitive.rx,
      });
    case "circle":
      return tag("circle", {
        ...common,
        cx: primitive.cx,
        cy: primitive.cy,
        r: primitive.r,
      });
    case "path":
      return tag("path", { ...common, d: primitive.d });
    case "polygon":
      return tag("polygon", {
        ...common,
        points: primitive.points
          .map((point) => `${fmt(point.x)},${fmt(point.y)}`)
          .join(" "),
      });
    case "text": {
      const transform =
        primitive.rotate === undefined
          ? undefined
          : `rotate(-90 ${fmt(primitive.x)} ${fmt(primitive.y)})`;
      const lines = primitive.lines
        .map((line, index) =>
          wrap(
            "tspan",
            { x: primitive.x, y: primitive.y + index * primitive.lineHeight },
            escapeXml(line),
          ),
        )
        .join("");
      return wrap(
        "text",
        {
          ...common,
          x: primitive.x,
          y: primitive.y,
          transform,
          "text-anchor": primitive.anchor,
          "font-size": primitive.fontSize,
          fill: primitive.fill,
          stroke: "none",
          "xml:space": "preserve",
        },
        lines,
      );
    }
  }
}

export function renderBreadboardShape(
  element: Element,
  box: Box,
  notation = breadboardNotation(element, box),
): string {
  return wrap(
    "g",
    { transform: `translate(${fmt(box.x)} ${fmt(box.y)})` },
    notation.body
      .map((primitive) => renderNotationPrimitive(primitive, "breadboard"))
      .join(""),
  );
}

export function renderBpmnShape(element: Element, box: Box): string {
  const primitives = bpmnNotation(element, box);
  return wrap(
    "g",
    { transform: `translate(${fmt(box.x)} ${fmt(box.y)})` },
    primitives.map((primitive) => renderNotationPrimitive(primitive)).join(""),
  );
}
