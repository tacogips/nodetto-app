import {
  BREADBOARD_PITCH,
  isBreadboardElementType,
  type ElementId,
} from "@nodetto/ir";
import type { Vec } from "../geometry.ts";
import type { Store } from "../store.ts";
import { boardHoles } from "./board.ts";
import {
  breadboardBox,
  breadboardPins,
  breadboardWirePoints,
} from "./catalogue.ts";

export function snapBreadboardPoint(point: Vec): Vec {
  return {
    x: Math.round(point.x / BREADBOARD_PITCH) * BREADBOARD_PITCH,
    y: Math.round(point.y / BREADBOARD_PITCH) * BREADBOARD_PITCH,
  };
}

export function isBreadboardSnapTarget(
  store: Store,
  ids: readonly ElementId[],
): boolean {
  return ids.some((id) => {
    const element = store.get(id);
    return element !== undefined && isBreadboardElementType(element.type);
  });
}

function anchor(store: Store, id: ElementId): Vec | undefined {
  const element = store.get(id);
  if (!element || !isBreadboardElementType(element.type)) return undefined;
  const x = element.visual.x ?? 0;
  const y = element.visual.y ?? 0;
  if (
    element.type.startsWith("breadboard.") &&
    element.type !== "breadboard.board" &&
    element.type !== "breadboard.wire" &&
    element.type !== "breadboard.netlist"
  ) {
    const [first] = breadboardPins(element);
    return first ? { x: first.x, y: first.y } : undefined;
  }
  if (element.type === "breadboard.board") {
    const first = boardHoles(element).find((hole) => hole.id === "a1");
    return first ? { x: first.pageX, y: first.pageY } : { x, y };
  }
  if (element.type === "breadboard.wire") {
    const [first] = breadboardWirePoints(element);
    return first;
  }
  return breadboardBox(element) ? { x, y } : undefined;
}

export function snapBreadboardDelta(
  store: Store,
  pageId: string,
  movingIds: readonly ElementId[],
  delta: Vec,
): Vec {
  const moving = new Set(movingIds);
  const first = store
    .getPageElements(pageId)
    .find(
      (element) =>
        moving.has(element.id) && isBreadboardElementType(element.type),
    );
  if (!first) return delta;
  const point = anchor(store, first.id);
  if (!point) return delta;
  const snapped = snapBreadboardPoint({
    x: point.x + delta.x,
    y: point.y + delta.y,
  });
  return {
    x: delta.x + snapped.x - (point.x + delta.x),
    y: delta.y + snapped.y - (point.y + delta.y),
  };
}
