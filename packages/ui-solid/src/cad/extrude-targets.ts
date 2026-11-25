import { compareCadHistoryOrder } from "@nodetto/core";
import { type Element, type ElementId, isPlainObject } from "@nodetto/ir";

export function earlierExtrudeBodies(
  pageElements: readonly Element[],
  element: Element,
): Element[] {
  return pageElements
    .filter(
      (item) =>
        compareCadHistoryOrder(item, element) < 0 &&
        (item.type === "cad.mesh" ||
          (item.type === "cad.extrude" &&
            isPlainObject(item.semantic) &&
            item.semantic.op === "new")),
    )
    .sort(compareCadHistoryOrder);
}

export const targetSelectionWork = { builds: 0, visits: 0, queries: 0 };

export function selectTargets(value: unknown): {
  ids: readonly ElementId[];
  has(id: ElementId): boolean;
} {
  const ids = Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];
  const selected = new Set(ids);
  targetSelectionWork.builds += 1;
  targetSelectionWork.visits += ids.length;
  return {
    ids,
    has(id) {
      targetSelectionWork.queries += 1;
      return selected.has(id);
    },
  };
}

export function orderExtrudeTargets(
  listed: readonly ElementId[],
  stored: readonly ElementId[],
): ElementId[] {
  const listedSet = new Set(listed);
  const storedSet = new Set(stored);
  targetSelectionWork.visits += listed.length + stored.length;
  return [
    ...listed.filter((id) => storedSet.has(id)),
    ...stored.filter((id) => !listedSet.has(id)),
  ];
}

export function displayedExtrudeTargets(
  pageElements: readonly Element[],
  element: Element,
  stored: readonly ElementId[],
): ElementId[] {
  return orderExtrudeTargets(
    earlierExtrudeBodies(pageElements, element).map((body) => body.id),
    stored,
  );
}

export function targetsForOperation(
  op: string,
  displayed: readonly ElementId[],
): ElementId[] {
  return op === "new"
    ? []
    : [...new Set(displayed)].slice(0, op === "add" ? 1 : undefined);
}
