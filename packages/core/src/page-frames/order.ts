import type { Element, PageId } from "@nodetto/ir";
import { frameParents } from "../frame-tree.ts";
import { createShapeContext } from "../hit-test.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import type { Store } from "../store.ts";
export type PageFlow = "vertical" | "horizontal";
export function pageFlowOf(page: { pageFlow?: unknown } | undefined): PageFlow {
  return page?.pageFlow === "horizontal" ? "horizontal" : "vertical";
}
export function isPageFrame(element: Element): boolean {
  if (
    element.type !== "frame" ||
    !element.semantic ||
    typeof element.semantic !== "object"
  )
    return false;
  const page = (element.semantic as { page?: unknown }).page;
  return page !== null && typeof page === "object" && !Array.isArray(page);
}
export function pageFramesInFlowOrder(
  store: Store,
  registry: ShapeUtilRegistry,
  pageId: PageId,
): Element[] {
  const parents = frameParents(
    store,
    pageId,
    createShapeContext(store, registry, 1),
  );
  const flow = pageFlowOf(store.getPage(pageId));
  return store
    .getPageElements(pageId)
    .filter((element) => isPageFrame(element) && !parents.has(element.id))
    .sort((a, b) => {
      const dx = (a.visual.x ?? 0) - (b.visual.x ?? 0);
      const dy = (a.visual.y ?? 0) - (b.visual.y ?? 0);
      return (
        (flow === "vertical" ? dy || dx : dx || dy) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      );
    });
}
