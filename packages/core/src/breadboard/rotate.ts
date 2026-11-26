import {
  isBreadboardPartType,
  type ElementId,
  type Element,
} from "@nodetto/ir";
import type { Vec } from "../geometry.ts";
import type { Command } from "../commands.ts";
import { snapBreadboardPoint } from "./snap.ts";
import { breadboardPins } from "./catalogue.ts";
import type { Store } from "../store.ts";

export function planBreadboardRotation(
  store: Store,
  ids: readonly ElementId[],
  quarterTurns: 1 | -1,
): Command[] {
  return planAnchoredRotation(store, ids, quarterTurns, {
    accepts: (element) => isBreadboardPartType(element.type),
    pinsOf: breadboardPins,
    pivot: snapBreadboardPoint,
  });
}

export function planAnchoredRotation(
  store: Store,
  ids: readonly ElementId[],
  quarterTurns: 1 | -1,
  options: {
    accepts(element: Element): boolean;
    pinsOf(element: Element): readonly Vec[];
    pivot(point: Vec): Vec;
  },
): Command[] {
  const commands: Command[] = [];
  for (const id of ids) {
    const element = store.get(id);
    if (!element || !options.accepts(element)) continue;
    const [first] = options.pinsOf(element);
    if (!first) continue;
    const rotation =
      ((element.visual.rotation ?? 0) + quarterTurns * 90 + 360) % 360;
    const rotated = { ...element, visual: { ...element.visual, rotation } };
    const [nextPin] = options.pinsOf(rotated);
    if (!nextPin) continue;
    const fixed = options.pivot({ x: first.x, y: first.y });
    const x = (element.visual.x ?? 0) + fixed.x - nextPin.x;
    const y = (element.visual.y ?? 0) + fixed.y - nextPin.y;
    commands.push({ type: "updateVisual", id, visual: { rotation, x, y } });
  }
  return commands;
}
