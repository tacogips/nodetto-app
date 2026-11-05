import {
  comparePageOrder,
  getElementTypeDefinition,
  type Document,
  type PageId,
} from "@nodetto/ir";
import { pageMetrics, type PageMetrics } from "@nodetto/core";
import { createDefaultRegistry } from "@nodetto/core";
import { Store } from "@nodetto/core";

export function lintMetrics(
  document: Document,
  pageIds: readonly PageId[],
): Map<PageId, PageMetrics> {
  const store = new Store(document);
  const registry = createDefaultRegistry();
  const result = new Map<PageId, PageMetrics>();
  for (const id of pageIds) {
    if (
      store.getPage(id) &&
      store
        .getPageElements(id)
        .some(
          (element) =>
            getElementTypeDefinition(element.type)?.category === "edge",
        )
    ) {
      result.set(id, pageMetrics(store, id, registry));
    }
  }
  return result;
}

export function formatMetricsLines(
  document: Document,
  metrics: ReadonlyMap<PageId, PageMetrics>,
): string {
  const lines: string[] = [];
  for (const page of [...document.pages].sort(comparePageOrder)) {
    const value = metrics.get(page.id);
    if (value)
      lines.push(
        `metrics ${page.name}: ${value.edgeCrossings} edge crossing(s), ${value.labelOverlaps} edge-label overlap(s)`,
      );
  }
  return lines.join("\n");
}
