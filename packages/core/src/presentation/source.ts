import type { ElementId, PageId } from "@nodetto/ir";
import { createShapeContext } from "../hit-test.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import type { Store } from "../store.ts";
import type { SlideSize } from "./fit.ts";

export type SlideSource =
  | { kind: "artboard"; frameId: ElementId }
  | { kind: "page" };
export function slideSource(
  store: Store,
  registry: ShapeUtilRegistry,
  pageId: PageId,
  isHidden?: (id: ElementId) => boolean,
): SlideSource {
  const context = isHidden ? undefined : createShapeContext(store, registry, 1);
  const hidden =
    isHidden ?? ((id: ElementId) => context?.isHidden?.(id) === true);
  const frames = store
    .getPageElements(pageId)
    .filter((element) => element.type === "frame" && !hidden(element.id));
  const [only] = frames;
  return frames.length === 1 && only
    ? { kind: "artboard", frameId: only.id }
    : { kind: "page" };
}
export function svgSize(svg: string): SlideSize | null {
  const tag = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!tag) return null;
  const width = /(?:^|\s)width="([^"]+)"/.exec(tag)?.[1];
  const height = /(?:^|\s)height="([^"]+)"/.exec(tag)?.[1];
  if (
    width === undefined ||
    height === undefined ||
    !width.trim() ||
    !height.trim()
  )
    return null;
  const w = Number(width);
  const h = Number(height);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
    ? { width: w, height: h }
    : null;
}
