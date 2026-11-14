import type { ElementId, PageId } from "@nodetto/ir";
import { createShapeContext } from "../hit-test.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import type { Store } from "../store.ts";
import { viewBounds } from "../view-bounds.ts";
import type { SlideSize } from "./fit.ts";
import { slideSource } from "./source.ts";

export type SlideRect = {
  readonly kind: "explicit" | "artboard" | "content";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly frameId?: ElementId;
};

export function resolveSlideRect(
  store: Store,
  registry: ShapeUtilRegistry,
  pageId: PageId,
  input: {
    readonly slideSize?: SlideSize;
    readonly slideOrigin?: { readonly x: number; readonly y: number };
  },
  isHidden?: (id: ElementId) => boolean,
): SlideRect | null {
  if (input.slideSize) {
    return {
      kind: "explicit",
      x: input.slideOrigin?.x ?? 0,
      y: input.slideOrigin?.y ?? 0,
      ...input.slideSize,
    };
  }
  const source = slideSource(store, registry, pageId, isHidden);
  const context = createShapeContext(store, registry, 1);
  if (source.kind === "artboard") {
    const box = viewBounds(store, [source.frameId], context);
    if (box) return { kind: "artboard", frameId: source.frameId, ...box };
  }
  const box = viewBounds(
    store,
    store.getPageElements(pageId).map((element) => element.id),
    context,
  );
  return box ? { kind: "content", ...box } : null;
}
