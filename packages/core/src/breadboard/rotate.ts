import { isBreadboardPartType, type ElementId } from "@nodetto/ir";
import type { Command } from "../commands.ts";
import { snapBreadboardPoint } from "./snap.ts";
import { breadboardPins } from "./catalogue.ts";
import type { Store } from "../store.ts";

export function planBreadboardRotation(
  store: Store,
  ids: readonly ElementId[],
  quarterTurns: 1 | -1,
): Command[] {
  const commands: Command[] = [];
  for (const id of ids) {
    const element = store.get(id);
    if (!element || !isBreadboardPartType(element.type)) continue;
    const [first] = breadboardPins(element);
    if (!first) continue;
    const rotation =
      ((element.visual.rotation ?? 0) + quarterTurns * 90 + 360) % 360;
    const rotated = { ...element, visual: { ...element.visual, rotation } };
    const [nextPin] = breadboardPins(rotated);
    if (!nextPin) continue;
    const fixed = snapBreadboardPoint({ x: first.x, y: first.y });
    const x = (element.visual.x ?? 0) + fixed.x - nextPin.x;
    const y = (element.visual.y ?? 0) + fixed.y - nextPin.y;
    commands.push({ type: "updateVisual", id, visual: { rotation, x, y } });
  }
  return commands;
}
