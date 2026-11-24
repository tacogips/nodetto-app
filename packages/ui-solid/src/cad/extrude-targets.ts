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

export function displayedExtrudeTargets(
  pageElements: readonly Element[],
  element: Element,
  stored: readonly ElementId[],
): ElementId[] {
  const listed = earlierExtrudeBodies(pageElements, element).map(
    (body) => body.id,
  );
  return [
    ...listed.filter((id) => stored.includes(id)),
    ...stored.filter((id) => !listed.includes(id)),
  ];
}

export function targetsForOperation(
  op: string,
  displayed: readonly ElementId[],
): ElementId[] {
  return op === "new"
    ? []
    : [...new Set(displayed)].slice(0, op === "add" ? 1 : undefined);
}
