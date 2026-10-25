import {
  isBreadboardPartType,
  type Element,
  type ElementId,
} from "@nodetto/ir";
import { applyCommands, type Command } from "../commands.ts";
import { boardHoles } from "./board.ts";
import { breadboardPins, breadboardWireEnds } from "./catalogue.ts";
import type { Store } from "../store.ts";

function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

function moved(before: Element, after: Element): boolean {
  return (
    (before.visual.x ?? 0) !== (after.visual.x ?? 0) ||
    (before.visual.y ?? 0) !== (after.visual.y ?? 0)
  );
}

export function planBreadboardTranslations(
  before: Store,
  draft: Store,
): Command[] {
  const commands: Command[] = [];
  const shifted = new Set<ElementId>();
  const boards = before
    .listElements()
    .filter((element) => element.type === "breadboard.board");
  for (const priorBoard of boards) {
    const nextBoard = draft.get(priorBoard.id);
    if (!nextBoard || !moved(priorBoard, nextBoard)) continue;
    const dx = (nextBoard.visual.x ?? 0) - (priorBoard.visual.x ?? 0);
    const dy = (nextBoard.visual.y ?? 0) - (priorBoard.visual.y ?? 0);
    const holes = new Set(
      boardHoles(priorBoard).map(({ pageX, pageY }) => pointKey(pageX, pageY)),
    );
    for (const prior of before.getPageElements(priorBoard.page)) {
      if (prior.id === priorBoard.id || shifted.has(prior.id)) continue;
      const next = draft.get(prior.id);
      if (
        !next ||
        next.visual.x !== prior.visual.x ||
        next.visual.y !== prior.visual.y
      )
        continue;
      const pins = isBreadboardPartType(prior.type)
        ? breadboardPins(prior)
        : [];
      const ends =
        prior.type === "breadboard.wire"
          ? breadboardWireEnds(prior)
          : undefined;
      const hosted =
        pins.length > 0
          ? pins.every(({ x, y }) => holes.has(pointKey(x, y)))
          : ends?.every(({ x, y }) => holes.has(pointKey(x, y)));
      if (!hosted) continue;
      const command: Command = {
        type: "updateVisual",
        id: prior.id,
        visual: {
          x: (prior.visual.x ?? 0) + dx,
          y: (prior.visual.y ?? 0) + dy,
        },
      };
      applyCommands(draft, [command]);
      commands.push(command);
      shifted.add(prior.id);
    }
  }
  return commands;
}
