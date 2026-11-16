import type { ElementId, PageId } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { createShapeContext } from "../hit-test.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import type { Store } from "../store.ts";
import { viewBounds } from "../view-bounds.ts";
import { pageFramesInFlowOrder } from "./order.ts";
export interface DocumentPageRef {
  pageId: PageId;
  frameId?: ElementId;
  rect: Box;
}
export function documentPageSequence(
  store: Store,
  registry: ShapeUtilRegistry,
): DocumentPageRef[] {
  const refs: DocumentPageRef[] = [];
  const context = createShapeContext(store, registry, 1);
  for (const page of store.listPages()) {
    const frames = pageFramesInFlowOrder(store, registry, page.id);
    if (frames.length) {
      for (const frame of frames) {
        const rect = viewBounds(store, [frame.id], context);
        if (rect) refs.push({ pageId: page.id, frameId: frame.id, rect });
      }
    } else {
      const rect = viewBounds(
        store,
        store.getPageElements(page.id).map((element) => element.id),
        context,
      );
      if (rect)
        refs.push({
          pageId: page.id,
          rect: {
            x: rect.x - 16,
            y: rect.y - 16,
            width: rect.width + 32,
            height: rect.height + 32,
          },
        });
    }
  }
  return refs;
}
