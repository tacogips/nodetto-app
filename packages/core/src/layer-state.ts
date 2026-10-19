import { getElementTypeDefinition, type ElementId } from "@nodetto/ir";
import { frameParents } from "./frame-tree.ts";
import { memberIdsOf } from "./group.ts";
import type { ShapeContext } from "./shape-util.ts";
import type { Store } from "./store.ts";

/** Inherited state is derived, leaving children's own flags unchanged. */
export function layerStates(store: Store, context: ShapeContext) {
  // Without authored flags, no ancestor can contribute inherited state. Avoid
  // geometry (and connector routing) just to establish that every layer is visible.
  if (
    !store
      .listElements()
      .some((element) => element.visual.hidden || element.visual.locked)
  )
    return {
      isHidden: (_id: ElementId) => false,
      isLocked: (_id: ElementId) => false,
    };
  const parents = new Map<ElementId, ElementId[]>();
  const loadedPages = new Set<string>();
  const loadedEdges = new Set<string>();
  const loadPage = (id: ElementId): void => {
    const element = store.get(id);
    const page = element?.page;
    if (!page) return;
    if (!loadedPages.has(page)) {
      // Resolve obstacle inheritance before routing any connectors, so cold
      // geometry sees the same visibility as subsequent queries.
      loadedPages.add(page);
      for (const element of store.getPageElements(page)) {
        for (const child of memberIdsOf(element)) {
          parents.set(child, [...(parents.get(child) ?? []), element.id]);
        }
      }
      for (const [child, parent] of frameParents(store, page, context, false)) {
        parents.set(child, [...(parents.get(child) ?? []), parent]);
      }
    }
    if (
      getElementTypeDefinition(element?.type ?? "")?.category === "edge" &&
      !loadedEdges.has(page)
    ) {
      loadedEdges.add(page);
      for (const [child, parent] of frameParents(store, page, context)) {
        const existing = parents.get(child) ?? [];
        if (!existing.includes(parent))
          parents.set(child, [...existing, parent]);
      }
    }
  };
  const has = (
    id: ElementId,
    flag: "hidden" | "locked",
    seen = new Set<ElementId>(),
  ): boolean => {
    loadPage(id);
    if (seen.has(id)) return false;
    seen.add(id);
    if (store.get(id)?.visual[flag] === true) return true;
    return (parents.get(id) ?? []).some((parent) => has(parent, flag, seen));
  };
  return {
    isHidden: (id: ElementId) => has(id, "hidden"),
    isLocked: (id: ElementId) => has(id, "locked"),
  };
}
