import type { Element } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { CODE_FONT_STACK, codeSnippetLayout } from "../code-snippet/layout.ts";
import { codeSnippetInput } from "../code-snippet/shape.ts";
import { escapeXml, tag, text, wrap } from "./markup.ts";

export function renderCodeSnippet(element: Element, box: Box): string {
  const layout = codeSnippetLayout(codeSnippetInput(element));
  const { palette } = layout;
  const style = element.visual.style;
  const id = `nodetto-code-${Array.from(element.id, (c) => c.codePointAt(0)?.toString(16)).join("-")}`;
  const panel = tag("rect", {
    x: box.x,
    y: box.y,
    width: layout.width,
    height: layout.height,
    rx: 6,
    fill: layout.panelFill,
    stroke: style?.stroke ?? palette.border,
    "stroke-width": 1,
  });
  const clip = wrap(
    "defs",
    {},
    wrap(
      "clipPath",
      { id, clipPathUnits: "userSpaceOnUse" },
      tag("rect", {
        x: box.x,
        y: box.y,
        width: layout.width,
        height: layout.height,
      }),
    ),
  );
  const contents: string[] = [];
  if (layout.gutterWidth)
    contents.push(
      tag("line", {
        x1: box.x + layout.gutterWidth,
        x2: box.x + layout.gutterWidth,
        y1: box.y,
        y2: box.y + layout.height,
        stroke: palette.border,
        "stroke-width": 1,
      }),
    );
  for (const line of layout.lines) {
    if (line.number !== undefined)
      contents.push(
        text(
          {
            x: box.x + layout.gutterWidth - 8,
            y: box.y + line.y,
            "text-anchor": "end",
            "font-family": CODE_FONT_STACK,
            "font-size": layout.fontSize,
            fill: palette.lineNumber,
          },
          String(line.number),
        ),
      );
    const spans = line.runs
      .map((run) =>
        wrap(
          "tspan",
          {
            x: box.x + run.x,
            fill: palette[run.kind],
            "font-style": run.kind === "comment" ? "italic" : undefined,
          },
          escapeXml(run.text),
        ),
      )
      .join("");
    contents.push(
      wrap(
        "text",
        {
          "xml:space": "preserve",
          "font-family": CODE_FONT_STACK,
          "font-size": layout.fontSize,
          y: box.y + line.y,
        },
        spans,
      ),
    );
  }
  return wrap(
    "g",
    {
      class: "nodetto-code",
      "data-nodetto-id": element.id,
      opacity: style?.opacity,
    },
    panel + clip + wrap("g", { "clip-path": `url(#${id})` }, contents.join("")),
  );
}
