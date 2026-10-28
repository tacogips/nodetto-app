import type { Element } from "@nodetto/ir";
import { pcbViewModel } from "../pcb-board/view.ts";
import { fmt, tag } from "./markup.ts";

function fillAttrs(fill: string): {
  fill: string;
  "fill-opacity": string | undefined;
} {
  if (fill.startsWith("#") && fill.length === 9) {
    return {
      fill: fill.slice(0, 7),
      "fill-opacity": fmt(Number.parseInt(fill.slice(7), 16) / 255),
    };
  }
  return { fill, "fill-opacity": undefined };
}

export function renderPcbShape(element: Element): string {
  return pcbViewModel(element, new Set(), fmt)
    .map((primitive) => {
      const fill = fillAttrs(primitive.fill);
      if (primitive.kind === "path") {
        return tag("path", {
          d: primitive.d,
          stroke: primitive.stroke,
          "stroke-width": primitive.width,
          fill: fill.fill,
          "fill-opacity": fill["fill-opacity"],
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        });
      }
      return tag("circle", {
        cx: primitive.cx,
        cy: primitive.cy,
        r: primitive.r,
        stroke: primitive.stroke,
        "stroke-width": primitive.width,
        fill: fill.fill,
        "fill-opacity": fill["fill-opacity"],
      });
    })
    .join("");
}
