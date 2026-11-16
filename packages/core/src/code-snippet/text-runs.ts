import type { Element } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import type { PdfTextRun } from "../document-export/pdf-pages.ts";
import { codeSnippetLayout } from "./layout.ts";
import { codeSnippetInput } from "./shape.ts";

export function codeSnippetTextRuns(element: Element, box: Box): PdfTextRun[] {
  const layout = codeSnippetLayout(codeSnippetInput(element));
  return layout.lines.flatMap((line) => {
    const first = line.runs[0];
    if (!first) return [];
    return [
      {
        x: box.x + first.x,
        y: box.y + line.y,
        size: layout.fontSize,
        text: line.runs.map((run) => run.source).join(""),
        font: "mono" as const,
      },
    ];
  });
}
