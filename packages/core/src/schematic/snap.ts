import {
  isSchematicElementType,
  roundCoordinate,
  type Element,
  type ElementId,
} from "@nodetto/ir";
import { snapBreadboardPoint } from "../breadboard/snap.ts";
import type { Vec } from "../geometry.ts";
import type { Store } from "../store.ts";
import { pinKey, pointElementKey, wirePointKeys } from "./coordinates.ts";
import { schematicAnchorPin } from "./symbols.ts";

export function schematicAnchor(element: Element): Vec | undefined {
  if (!isSchematicElementType(element.type)) return undefined;
  let key: { readonly kx: number; readonly ky: number } | undefined;
  if (element.type === "schematic.wire") key = wirePointKeys(element)[0];
  else if (
    element.type === "schematic.junction" ||
    element.type === "schematic.label" ||
    element.type === "schematic.noConnect"
  )
    key = pointElementKey(element);
  else {
    const pin = schematicAnchorPin(element);
    if (pin) key = pinKey(element, pin);
  }
  return key ? { x: key.kx / 100, y: key.ky / 100 } : undefined;
}
export function snapSchematicDelta(
  store: Store,
  pageId: string,
  movingIds: readonly ElementId[],
  delta: Vec,
  snapping: boolean,
): Vec {
  const rounded = { x: roundCoordinate(delta.x), y: roundCoordinate(delta.y) };
  if (!snapping) return rounded;
  const moving = new Set(movingIds);
  const first = store
    .getPageElements(pageId)
    .find(
      (element) =>
        moving.has(element.id) && isSchematicElementType(element.type),
    );
  const anchor = first && schematicAnchor(first);
  if (!anchor) return rounded;
  const target = snapBreadboardPoint({
    x: anchor.x + delta.x,
    y: anchor.y + delta.y,
  });
  return {
    x: roundCoordinate(target.x - anchor.x),
    y: roundCoordinate(target.y - anchor.y),
  };
}
