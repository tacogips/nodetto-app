import { type Element, type ElementId, MAX_ROUTING_LANE } from "@nodetto/ir";
import {
  countRouteOverlaps,
  isLabelObstacle,
  segmentOverlapsBox,
} from "./diagram-lint/metrics.ts";
import type { Box, Vec } from "./geometry.ts";
import type { ShapeContext } from "./shape-util.ts";
import { endpointReaderFor, resolveConnector } from "./shapes/connector.ts";

export function planRouteLanes(
  input: readonly { element: Element; movable: boolean }[],
  context: ShapeContext,
): ReadonlyMap<ElementId, { routingLane?: number; routingBend?: number }> {
  const edges = [...input].sort((a, b) =>
    a.element.id < b.element.id ? -1 : a.element.id > b.element.id ? 1 : 0,
  );
  const obstacles: { id: ElementId; box: Box }[] = [];
  const page = edges[0]?.element.page;
  if (page)
    for (const element of context.elementsOnPage?.(page) ?? []) {
      if (!isLabelObstacle(element)) continue;
      const box = context.boundsOf(element.id);
      if (box) obstacles.push({ id: element.id, box });
    }
  const placed: (readonly Vec[])[] = [];
  const result = new Map<
    ElementId,
    { routingLane?: number; routingBend?: number }
  >();
  for (const item of edges) {
    if (item.movable) continue;
    const route = resolveConnector(
      item.element,
      context,
      endpointReaderFor(item.element.type),
    );
    if (route) placed.push(route.points);
  }
  for (const item of edges) {
    if (!item.movable) continue;
    const element = item.element;
    const semantic = element.semantic as Record<string, unknown>;
    const base = resolveConnector(
      { ...element, semantic: { ...semantic } },
      context,
      endpointReaderFor(element.type),
    );
    if (!base) continue;
    if (
      typeof semantic["routingLane"] === "number" &&
      semantic["routingLane"] > 0
    ) {
      placed.push(base.points);
      continue;
    }
    const endpoints = endpointReaderFor(element.type)(semantic);
    const crossings = (points: readonly Vec[]) => {
      let count = 0;
      for (const obstacle of obstacles) {
        if (obstacle.id === endpoints?.from || obstacle.id === endpoints?.to)
          continue;
        const box = obstacle.box;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1];
          const b = points[i];
          if (!a || !b) continue;
          if (
            Math.max(a.x, b.x) < box.x ||
            Math.min(a.x, b.x) > box.x + box.width ||
            Math.max(a.y, b.y) < box.y ||
            Math.min(a.y, b.y) > box.y + box.height
          )
            continue;
          if (segmentOverlapsBox(a, b, box)) {
            count++;
            break;
          }
        }
      }
      return count;
    };
    const baseCrossings = crossings(base.points);
    const score = (points: readonly Vec[]) =>
      placed.reduce((sum, other) => sum + countRouteOverlaps(points, other), 0);
    let best = base.points;
    let bestScore = score(best);
    let bestPatch: { routingLane?: number; routingBend?: number } = {};
    for (let k = 1; k <= MAX_ROUTING_LANE && bestScore > 0; k++) {
      const patch: { routingLane?: number; routingBend?: number } = {
        routingLane: k,
      };
      if (base.bendAxis) {
        const span = Math.abs(
          base.end[base.bendAxis] - base.start[base.bendAxis],
        );
        if (span >= 1) {
          const bend =
            typeof semantic["routingBend"] === "number"
              ? semantic["routingBend"]
              : 0.5;
          patch.routingBend =
            Math.round(
              Math.max(
                0,
                Math.min(
                  1,
                  bend + ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * 8) / span,
                ),
              ) * 10000,
            ) / 10000;
        }
      }
      const route = resolveConnector(
        { ...element, semantic: { ...semantic, ...patch } },
        context,
        endpointReaderFor(element.type),
      );
      if (!route || crossings(route.points) > baseCrossings) continue;
      const value = score(route.points);
      if (value < bestScore) {
        bestScore = value;
        best = route.points;
        bestPatch = patch;
      }
    }
    if (bestPatch.routingLane !== undefined) result.set(element.id, bestPatch);
    placed.push(best);
  }
  return result;
}
