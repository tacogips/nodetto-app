import {
  isSchematicPartType,
  roundCoordinate,
  SCHEMATIC_REFERENCE_PREFIX,
  type Element,
  type ElementId,
} from "@nodetto/ir";
import { annotateReferences } from "../breadboard/annotate.ts";
import { planAnchoredRotation } from "../breadboard/rotate.ts";
import type { Command } from "../commands.ts";
import type { Store } from "../store.ts";
import { schematicPins } from "./symbols.ts";

function localPins(element: Element) {
  return schematicPins({
    ...element,
    visual: { ...element.visual, x: 0, y: 0 },
  });
}

export function planSchematicRotation(
  store: Store,
  ids: readonly ElementId[],
  quarterTurns: 1 | -1,
): Command[] {
  const commands = planAnchoredRotation(store, ids, quarterTurns, {
    accepts: (element) =>
      isSchematicPartType(element.type) || element.type === "schematic.power",
    pinsOf: localPins,
    pivot: (point) => point,
  });
  const canonical = commands.map((command): Command => {
    if (command.type !== "updateVisual") return command;
    const element = store.get(command.id);
    if (!element) return command;
    const x = element.visual.x ?? 0;
    const y = element.visual.y ?? 0;
    return {
      ...command,
      visual: {
        ...command.visual,
        x: roundCoordinate((command.visual.x ?? 0) - x + roundCoordinate(x)),
        y: roundCoordinate((command.visual.y ?? 0) - y + roundCoordinate(y)),
      },
    };
  });
  for (const id of ids) {
    const element = store.get(id);
    if (element?.type === "schematic.label")
      canonical.push({
        type: "updateVisual",
        id,
        visual: {
          rotation:
            ((element.visual.rotation ?? 0) + quarterTurns * 90 + 360) % 360,
        },
      });
  }
  return canonical;
}

export function planSchematicMirror(
  store: Store,
  ids: readonly ElementId[],
): Command[] {
  const commands: Command[] = [];
  for (const id of ids) {
    const element = store.get(id);
    if (!element || !isSchematicPartType(element.type)) continue;
    const flipX = !element.visual.flipX;
    const first = localPins(element)[0];
    const next = localPins({
      ...element,
      visual: { ...element.visual, flipX },
    })[0];
    if (!first || !next) continue;
    commands.push({
      type: "updateVisual",
      id,
      visual: {
        flipX,
        x: roundCoordinate(
          roundCoordinate(element.visual.x ?? 0) + first.x - next.x,
        ),
        y: roundCoordinate(
          roundCoordinate(element.visual.y ?? 0) + first.y - next.y,
        ),
      },
    });
  }
  return commands;
}

export function planSchematicAnnotation(
  store: Store,
  pageId: string,
): Command[] {
  const seen = new Set<string>();
  const needs = store
    .getPageElements(pageId)
    .filter((item) => isSchematicPartType(item.type))
    .map((element) => {
      const reference = (element.semantic as { reference: string }).reference;
      const needsFix = reference.endsWith("?") || seen.has(reference);
      seen.add(reference);
      return { element, reference, needsFix };
    });
  const keep = needs
    .filter((item) => !item.needsFix)
    .map((item) => item.reference);
  const fix = needs.filter((item) => item.needsFix);
  const assigned = annotateReferences(
    keep,
    fix.map(({ element, reference }) => ({
      prefix: isSchematicPartType(element.type)
        ? SCHEMATIC_REFERENCE_PREFIX[element.type]
        : "",
      reference,
    })),
  );
  return fix.flatMap(({ element, reference }, index): Command[] => {
    const next = assigned[index];
    return next && next !== reference
      ? [
          {
            type: "updateSemantic",
            id: element.id,
            semantic: { ...(element.semantic as object), reference: next },
          },
        ]
      : [];
  });
}
