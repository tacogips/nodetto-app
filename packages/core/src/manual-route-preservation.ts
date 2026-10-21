import type { ShapeContext } from "./shape-util.ts";
import { boxCenter } from "./geometry.ts";
import { applyCommands, type Command } from "./commands.ts";
import type { Store } from "./store.ts";
import {
  connectorWaypointFromPage,
  endpointReaderFor,
  resolveConnector,
} from "./shapes/connector.ts";

/** Keep authored bends still when one endpoint moves; common translations carry the route. */
export function planManualRoutePreservation(
  before: Store,
  after: Store,
  beforeContext: ShapeContext,
  afterContext: () => ShapeContext,
): Command[] {
  const commands: Command[] = [];
  let nextContext: ShapeContext | undefined;
  for (const element of after.listElements()) {
    const semantic = element.semantic as Record<string, unknown>;
    if (
      !semantic ||
      semantic["routing"] !== "manual" ||
      !Array.isArray(semantic["routingWaypoints"]) ||
      !semantic["routingWaypoints"].length
    )
      continue;
    const previous = before.get(element.id);
    if (!previous) continue;
    const old = previous.semantic as Record<string, unknown>;
    // Explicit bend edits and reconnections already define the desired route.
    if (
      !old ||
      old["routing"] !== "manual" ||
      JSON.stringify(old["routingWaypoints"]) !==
        JSON.stringify(semantic["routingWaypoints"]) ||
      JSON.stringify(old["from"]) !== JSON.stringify(semantic["from"]) ||
      JSON.stringify(old["to"]) !== JSON.stringify(semantic["to"])
    )
      continue;
    const reader = endpointReaderFor(element.type);
    const original = resolveConnector(previous, beforeContext, reader);
    if (!original?.waypointPoints) continue;
    nextContext ??= afterContext();
    const next = resolveConnector(element, nextContext, reader);
    if (!next) continue;
    const oldFrom = boxCenter(original.fromBox);
    const oldTo = boxCenter(original.toBox);
    const from = boxCenter(next.fromBox);
    const to = boxCenter(next.toBox);
    const dx = from.x - oldFrom.x;
    const dy = from.y - oldFrom.y;
    if (
      Math.abs(dx - (to.x - oldTo.x)) < 1e-7 &&
      Math.abs(dy - (to.y - oldTo.y)) < 1e-7
    )
      continue;
    commands.push({
      type: "updateSemantic",
      id: element.id,
      semantic: {
        ...semantic,
        routingWaypoints: original.waypointPoints.map((point) =>
          connectorWaypointFromPage(point, from, to),
        ),
      },
    });
  }
  applyCommands(after, commands);
  return commands;
}
