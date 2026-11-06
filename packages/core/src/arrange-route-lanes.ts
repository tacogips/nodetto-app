import { type Element, type ElementId, MAX_ROUTING_LANE } from "@nodetto/ir";
import {
  countRouteOverlaps,
  isLabelObstacle,
  segmentOverlapsBox,
} from "./diagram-lint/metrics.ts";
import type { Box, Vec } from "./geometry.ts";
import type { ShapeContext } from "./shape-util.ts";
import { endpointReaderFor, resolveConnector } from "./shapes/connector.ts";

export interface RouteLanePatch {
  routingLane?: number;
  routingBend?: number;
  fromPortPosition?: number;
  toPortPosition?: number;
}

export function planRouteLanes(
  input: readonly { element: Element; movable: boolean }[],
  context: ShapeContext,
): ReadonlyMap<ElementId, RouteLanePatch> {
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
  const current = new Map<ElementId, readonly Vec[]>();
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
    if (route) {
      placed.push(route.points);
      current.set(item.element.id, route.points);
    }
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
      current.set(element.id, base.points);
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
      const patch = lanePatch(base, semantic, k);
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
    current.set(element.id, best);
  }
  repairRoutes(edges, context, obstacles, current, result);
  return result;
}

function lanePatch(
  base: NonNullable<ReturnType<typeof resolveConnector>>,
  semantic: Record<string, unknown>,
  k: number,
): RouteLanePatch {
  if (!k) return {};
  const patch: RouteLanePatch = { routingLane: k };
  if (base.bendAxis) {
    const span = Math.abs(base.end[base.bendAxis] - base.start[base.bendAxis]);
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
  return patch;
}

function repairRoutes(
  edges: readonly { element: Element; movable: boolean }[],
  context: ShapeContext,
  obstacles: readonly { id: ElementId; box: Box }[],
  current: Map<ElementId, readonly Vec[]>,
  result: Map<ElementId, RouteLanePatch>,
): void {
  for (let round = 0; round < 3; round++) {
    let changed = false;
    for (const item of edges) {
      const element = item.element;
      const semantic = element.semantic as Record<string, unknown>;
      if (
        !item.movable ||
        (typeof semantic["routingLane"] === "number" &&
          semantic["routingLane"] > 0)
      )
        continue;
      const endpoints = endpointReaderFor(element.type)(semantic);
      if (!endpoints || endpoints.from === endpoints.to) continue;
      const points = current.get(element.id);
      if (!points) continue;
      const score = (candidate: readonly Vec[]) => {
        let total = 0;
        for (const [id, other] of current)
          if (id !== element.id) total += countRouteOverlaps(candidate, other);
        return total;
      };
      const crossings = (candidate: readonly Vec[]) => {
        let total = 0;
        for (const obstacle of obstacles) {
          if (obstacle.id === endpoints.from || obstacle.id === endpoints.to)
            continue;
          for (let i = 1; i < candidate.length; i++) {
            const a = candidate[i - 1];
            const b = candidate[i];
            if (!a || !b) continue;
            const box = obstacle.box;
            if (
              Math.max(a.x, b.x) < box.x ||
              Math.min(a.x, b.x) > box.x + box.width ||
              Math.max(a.y, b.y) < box.y ||
              Math.min(a.y, b.y) > box.y + box.height
            )
              continue;
            if (segmentOverlapsBox(a, b, box)) {
              total++;
              break;
            }
          }
        }
        return total;
      };
      let bestScore = score(points);
      if (!bestScore) continue;
      const limit = crossings(points);
      const base = resolveConnector(
        { ...element, semantic: { ...semantic } },
        context,
        endpointReaderFor(element.type),
      );
      if (!base) continue;
      let bestPatch: RouteLanePatch | undefined;
      let bestPoints = points;
      const tryCandidate = (shift: RouteLanePatch, k: number) => {
        const patch: RouteLanePatch = {
          ...lanePatch(base, semantic, k),
          ...shift,
        };
        const route = resolveConnector(
          { ...element, semantic: { ...semantic, ...patch } },
          context,
          endpointReaderFor(element.type),
        );
        if (!route || crossings(route.points) > limit) return;
        const value = score(route.points);
        if (value < bestScore) {
          bestScore = value;
          bestPatch = patch;
          bestPoints = route.points;
        }
      };
      for (let k = 1; k <= MAX_ROUTING_LANE && bestScore; k++)
        tryCandidate({}, k);
      for (const end of ["from", "to"] as const) {
        if (!bestScore) break;
        const side = semantic[`${end}Port`];
        if (typeof side !== "string") continue;
        const positionKey = `${end}PortPosition` as const;
        const existing =
          result.get(element.id)?.[positionKey] ?? semantic[positionKey];
        const position = typeof existing === "number" ? existing : 0.5;
        const occupied: number[] = [];
        for (const other of edges) {
          const data = other.element.semantic as Record<string, unknown>;
          const otherEnds = endpointReaderFor(other.element.type)(data);
          for (const otherEnd of ["from", "to"] as const) {
            if (other.element.id === element.id && otherEnd === end) continue;
            if (
              otherEnds?.[otherEnd] !== endpoints[end] ||
              data[`${otherEnd}Port`] !== side
            )
              continue;
            const key = `${otherEnd}PortPosition` as const;
            const value = result.get(other.element.id)?.[key] ?? data[key];
            occupied.push(
              typeof value === "number"
                ? value
                : otherEnds.from === otherEnds.to
                  ? otherEnd === "from"
                    ? 0.3
                    : 0.7
                  : 0.5,
            );
          }
        }
        for (const direction of [-1, 1]) {
          let neighbor = direction < 0 ? 0 : 1;
          for (const value of occupied) {
            if (direction < 0 && value < position && value > neighbor)
              neighbor = value;
            if (direction > 0 && value > position && value < neighbor)
              neighbor = value;
          }
          const shifted =
            Math.round(((position + neighbor) / 2) * 10000) / 10000;
          if (occupied.some((value) => Math.abs(value - shifted) <= 0.0001))
            continue;
          for (let k = 0; k <= 2 && bestScore; k++)
            tryCandidate({ [positionKey]: shifted }, k);
        }
      }
      if (bestPatch) {
        result.set(element.id, bestPatch);
        current.set(element.id, bestPoints);
        changed = true;
      }
    }
    if (!changed) break;
  }
}
