import type { Element } from "@nodetto/ir";
import type { PdfTextRun } from "../document-export/pdf-pages.ts";
import type { Box } from "../geometry.ts";
import { markdownSnippetLayout } from "./layout.ts";
export function markdownSnippetTextRuns(
  element: Element,
  box: Box,
): PdfTextRun[] {
  return markdownSnippetLayout(element).layout.runs.map((run) => ({
    x: box.x + run.x,
    y: box.y + run.y,
    size: run.size,
    text: run.text,
    font: run.mono ? "mono" : run.weight === 700 ? "sans-bold" : "sans",
  }));
}
