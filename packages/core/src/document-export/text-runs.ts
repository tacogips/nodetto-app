import type { Element, PageId } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { createShapeContext } from "../hit-test.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import type { Store } from "../store.ts";
import { PDF_TEXT_RUN_EXTRACTORS } from "./extractors.ts";
import type { PdfTextRun } from "./pdf-pages.ts";
export type TextRunExtractor = (
  element: Element,
  box: Box,
) => readonly PdfTextRun[];
export function collectTextRuns(
  store: Store,
  registry: ShapeUtilRegistry,
  pageId: PageId,
  rect: Box,
  extractors: Readonly<
    Record<string, TextRunExtractor>
  > = PDF_TEXT_RUN_EXTRACTORS,
): PdfTextRun[] {
  const context = createShapeContext(store, registry, 1);
  const runs: PdfTextRun[] = [];
  for (const element of store.getPageElements(pageId)) {
    const extractor = extractors[element.type];
    if (!extractor || context.isHidden?.(element.id)) continue;
    const box = registry
      .getOrFallback(element.type)
      .getBounds(element, context);
    if (
      !box ||
      box.x + box.width < rect.x ||
      box.y + box.height < rect.y ||
      box.x > rect.x + rect.width ||
      box.y > rect.y + rect.height
    )
      continue;
    for (const run of extractor(element, box))
      if (
        run.x >= rect.x &&
        run.x <= rect.x + rect.width &&
        run.y >= rect.y &&
        run.y <= rect.y + rect.height
      )
        runs.push({ ...run, x: run.x - rect.x, y: run.y - rect.y });
  }
  return runs;
}
