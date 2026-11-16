import type { Element } from "@nodetto/ir";
import { CODE_FONT_STACK } from "../code-snippet/layout.ts";
import type { Box } from "../geometry.ts";
import { markdownSnippetLayout } from "../markdown-snippet/layout.ts";
import { tag, text, wrap } from "./markup.ts";
import { DEFAULT_SVG_THEME } from "./theme.ts";

export function renderMarkdownSnippet(element: Element, box: Box): string {
  const { layout, palette, panelFill } = markdownSnippetLayout(element);
  const parts = [
    tag("rect", {
      x: box.x,
      y: box.y,
      width: layout.width,
      height: layout.height,
      rx: 6,
      fill: panelFill,
      stroke: element.visual.style?.stroke ?? palette.border,
    }),
  ];
  const order = [
    "codePanel",
    "inlineCode",
    "cell",
    "headerCell",
    "quoteBar",
    "rule",
    "bullet",
    "task",
  ] as const;
  for (const kind of order)
    for (const item of layout.boxes) {
      if (item.kind !== kind) continue;
      const x = box.x + item.x;
      const y = box.y + item.y;
      const fill =
        kind === "codePanel" || kind === "inlineCode"
          ? palette.inlineCodeBackground
          : kind === "headerCell"
            ? palette.tableHeader
            : kind === "cell" || kind === "task"
              ? "none"
              : kind === "quoteBar"
                ? palette.quoteBar
                : kind === "rule"
                  ? palette.rule
                  : palette.plain;
      parts.push(
        tag("rect", {
          class: `nodetto-markdown-${kind}`,
          x,
          y,
          width: item.width,
          height: item.height,
          fill,
          stroke:
            kind === "cell" || kind === "headerCell"
              ? palette.rule
              : kind === "task"
                ? palette.plain
                : undefined,
        }),
      );
      if (kind === "task" && item.checked)
        parts.push(
          tag("path", {
            d: `M ${x + 2} ${y + 6} l 3 3 l 5 -6`,
            fill: "none",
            stroke: palette.plain,
          }),
        );
    }
  for (const run of layout.runs) {
    const decoration = [
      run.underline ? "underline" : "",
      run.strike ? "line-through" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const color =
      (palette as unknown as Record<string, string>)[run.role] ?? palette.plain;
    const content = text(
      {
        x: box.x + run.x,
        y: box.y + run.y,
        "font-family": run.mono
          ? CODE_FONT_STACK
          : DEFAULT_SVG_THEME.fontFamily,
        "font-size": run.size,
        "font-weight": run.weight === 700 ? "700" : undefined,
        "font-style": run.italic ? "italic" : undefined,
        "text-decoration": decoration || undefined,
        fill: color,
        "xml:space": "preserve",
      },
      run.text,
    );
    parts.push(
      run.href && /^(https?:|mailto:)/i.test(run.href)
        ? wrap("a", { href: run.href }, content)
        : content,
    );
  }
  return wrap("g", { class: "nodetto-markdown" }, parts.join(""));
}
