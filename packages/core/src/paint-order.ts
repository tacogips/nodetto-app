import {
  getElementTypeDefinition,
  type Element,
  type ElementId,
  type FrameSemantic,
  type PageId,
} from "@nodetto/ir";
import {
  connectorBackdropIds,
  groupedIds,
  isConnectorBackdrop,
} from "./backdrops.ts";
import { groupOf } from "./group.ts";
import type { ShapeContext } from "./shape-util.ts";
import type { Store } from "./store.ts";

const cache = new WeakMap<
  ShapeContext,
  WeakMap<readonly Element[], readonly Element[]>
>();

export function containerPaintOrder(
  elements: readonly Element[],
  context: ShapeContext,
  backdropIds: ReadonlySet<ElementId>,
): readonly Element[] {
  const grouped = groupedIds(elements);
  const backdrop = backdropIds.size > 0;
  const visible = (element: Element): boolean =>
    !element.visual.hidden &&
    !context.isHidden?.(element.id) &&
    !context.isMaskSource?.(element.id);
  const candidates = elements.filter((element) => {
    if (!visible(element)) return false;
    if (backdrop) return backdropIds.has(element.id);
    const category = getElementTypeDefinition(element.type)?.category;
    return (
      !grouped.has(element.id) && category !== "edge" && category !== "resource"
    );
  });
  const positions = new Map(
    elements.map((element, index) => [element.id, index]),
  );
  const surfaces = candidates.flatMap((element) => {
    if (
      !(backdrop
        ? backdropIds.has(element.id)
        : isConnectorBackdrop(element, (id) => grouped.has(id)))
    )
      return [];
    const box = context.boundsOf(element.id);
    return box && box.width > 0 && box.height > 0
      ? [
          {
            element,
            box,
            area: box.width * box.height,
            position: positions.get(element.id) ?? 0,
          },
        ]
      : [];
  });
  if (!surfaces.length) return elements;
  const surfaceIds = new Set(surfaces.map((surface) => surface.element.id));
  const candidateIds = new Set(candidates.map((element) => element.id));
  const owners = new Map<ElementId, ElementId>();
  const canLink = (child: ElementId, owner: ElementId): boolean => {
    let current: ElementId | undefined = owner;
    while (current !== undefined) {
      if (current === child) return false;
      current = owners.get(current);
    }
    return true;
  };
  for (const surface of surfaces) {
    if (surface.element.type !== "frame") continue;
    const members = (surface.element.semantic as FrameSemantic).memberIds;
    if (!members) continue;
    for (const id of members) {
      if (
        candidateIds.has(id) &&
        !owners.has(id) &&
        canLink(id, surface.element.id)
      )
        owners.set(id, surface.element.id);
    }
  }
  const top = Math.max(...surfaces.map((surface) => surface.position));
  for (const element of candidates) {
    const position = positions.get(element.id) ?? 0;
    if (
      owners.has(element.id) ||
      (position > top && !surfaceIds.has(element.id))
    )
      continue;
    const box = context.boundsOf(element.id);
    if (!box) continue;
    const eligible = surfaces.filter((surface) => {
      if (
        surface.element.id === element.id ||
        (surface.element.type === "frame" &&
          (surface.element.semantic as FrameSemantic).memberIds)
      )
        return false;
      if (surfaceIds.has(element.id) && surface.area <= box.width * box.height)
        return false;
      return (
        box.x >= surface.box.x &&
        box.y >= surface.box.y &&
        box.x + box.width <= surface.box.x + surface.box.width &&
        box.y + box.height <= surface.box.y + surface.box.height
      );
    });
    eligible.sort(
      (a, b) =>
        a.area - b.area ||
        (a.position < position !== b.position < position
          ? a.position < position
            ? -1
            : 1
          : a.position < position
            ? b.position - a.position
            : a.position - b.position),
    );
    for (const surface of eligible) {
      if (canLink(element.id, surface.element.id)) {
        owners.set(element.id, surface.element.id);
        break;
      }
    }
  }
  const depth = (id: ElementId): number => {
    let n = 0;
    let owner = owners.get(id);
    while (owner !== undefined) {
      n++;
      owner = owners.get(owner);
    }
    return n;
  };
  surfaces.sort(
    (a, b) =>
      depth(b.element.id) - depth(a.element.id) || a.position - b.position,
  );
  let result: Element[] | undefined;
  for (const surface of surfaces) {
    const current = result ?? elements;
    const from = current.findIndex(
      (element) => element.id === surface.element.id,
    );
    const to = current.findIndex(
      (element) => owners.get(element.id) === surface.element.id,
    );
    if (to >= 0 && from > to) {
      result ??= [...elements];
      const moved = result.splice(from, 1)[0];
      if (moved) result.splice(to, 0, moved);
    }
  }
  return result ?? elements;
}

export function pagePaintOrder(
  store: Store,
  pageId: PageId,
  context: ShapeContext,
): readonly Element[] {
  const elements = store.getPageElements(pageId);
  let pages = cache.get(context);
  if (!pages) {
    pages = new WeakMap();
    cache.set(context, pages);
  }
  const cached = pages.get(elements);
  if (cached) return cached;
  const visible = elements.filter(
    (element) =>
      !element.visual.hidden &&
      !context.isHidden?.(element.id) &&
      !context.isMaskSource?.(element.id),
  );
  const backdrops = connectorBackdropIds(
    visible,
    (id) => groupOf(store, id) !== null,
  );
  const result = containerPaintOrder(elements, context, backdrops);
  pages.set(elements, result);
  return result;
}
