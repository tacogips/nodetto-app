import type { ElementId, PageId } from "@nodetto/ir";
import { pageFramesInFlowOrder } from "../page-frames/order.ts";
import type { Store } from "../store.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";

export interface SlideRef {
  readonly page: PageId;
  readonly frame?: ElementId;
}
export function sameSlide(a: SlideRef, b: SlideRef): boolean {
  return a.page === b.page && a.frame === b.frame;
}
export function expandSlides(
  store: Store,
  registry: ShapeUtilRegistry,
  pageIds: readonly PageId[],
): SlideRef[] {
  return pageIds.flatMap((page) => {
    const frames = pageFramesInFlowOrder(store, registry, page);
    return frames.length
      ? frames.map((frame) => ({ page, frame: frame.id }))
      : [{ page }];
  });
}
export function startSlideIndex(
  order: readonly PageId[],
  refs: readonly SlideRef[],
  from: PageId | null,
): number | null {
  const pages = refs.map((ref) => ref.page);
  const index = startIndex(order, pages, from);
  return index === null ? null : pages.indexOf(pages[index] as PageId);
}

export function slideList(
  pages: readonly {
    readonly id: PageId;
    readonly hiddenInPresentation?: boolean;
  }[],
): PageId[] {
  return pages
    .filter((page) => page.hiddenInPresentation !== true)
    .map((page) => page.id);
}

export function startIndex(
  order: readonly PageId[],
  slides: readonly PageId[],
  from: PageId | null,
): number | null {
  if (!slides.length) return null;
  if (from === null) return 0;
  const current = slides.indexOf(from);
  if (current >= 0) return current;
  const position = order.indexOf(from);
  if (position < 0) return 0;
  for (const id of order.slice(position + 1)) {
    const index = slides.indexOf(id);
    if (index >= 0) return index;
  }
  return slides.length - 1;
}
