// Route resolution: obstacle collection, per-context caching, and the
// per-type routing rules (self loops, sequence messages, manual and
// orthogonal routes).

import {
  connectorWaypointToPage,
  type Element,
  type ElementId,
  erdEndpointColumnIds,
  type ErdEndpoint,
  getElementTypeDefinition,
} from "@nodetto/ir";
import { groupedIds, isConnectorBackdrop } from "../../backdrops.ts";
import {
  type Box,
  boxCenter,
  rotatedBox,
  rotatePoint,
  type Vec,
} from "../../geometry.ts";
import { avoidOrthogonalObstacles } from "../../orthogonal-routing.ts";
import { sequenceMessageY } from "../../sequence-layout.ts";
import type { ShapeContext } from "../../shape-util.ts";
import {
  endpointRotation,
  erdRelationAnchors,
  pinnedPort,
  resolvedBoundary,
} from "./boundary.ts";
import {
  type ConnectorEndpoints,
  type EndpointReader,
  manualWaypoints,
  withRoute,
} from "./route.ts";

export const CONNECTOR_OBSTACLE_CLEARANCE = 12;

interface RoutingObstacle {
  readonly id: ElementId;
  readonly box: Box;
}

const pageObstacles = new WeakMap<
  ShapeContext,
  Map<string, readonly RoutingObstacle[]>
>();

function routingObstacles(
  element: Element,
  context: ShapeContext,
): readonly RoutingObstacle[] {
  let pages = pageObstacles.get(context);
  if (!pages) {
    pages = new Map();
    pageObstacles.set(context, pages);
  }
  const cached = pages.get(element.page);
  if (cached) return cached;
  const elements = context.elementsOnPage?.(element.page) ?? [];
  const grouped = groupedIds(elements);
  const obstacles: RoutingObstacle[] = [];
  for (const candidate of elements) {
    const category = getElementTypeDefinition(candidate.type)?.category;
    if (
      category === "edge" ||
      category === "resource" ||
      candidate.type === "group" ||
      isConnectorBackdrop(candidate, (id) => grouped.has(id)) ||
      context.isHidden?.(candidate.id) ||
      context.isMaskSource?.(candidate.id)
    )
      continue;
    const raw = context.boundsOf(candidate.id);
    if (!raw) continue;
    const visible = rotatedBox(raw, candidate.visual.rotation ?? 0);
    obstacles.push({
      id: candidate.id,
      box: {
        x: visible.x - CONNECTOR_OBSTACLE_CLEARANCE,
        y: visible.y - CONNECTOR_OBSTACLE_CLEARANCE,
        width: visible.width + CONNECTOR_OBSTACLE_CLEARANCE * 2,
        height: visible.height + CONNECTOR_OBSTACLE_CLEARANCE * 2,
      },
    });
  }
  pages.set(element.page, obstacles);
  return obstacles;
}

function obstacleBoxes(
  element: Element,
  endpointIds: ReadonlySet<ElementId>,
  start: Vec,
  end: Vec,
  context: ShapeContext,
): readonly Box[] {
  const boxes: Box[] = [];
  for (const { id, box } of routingObstacles(element, context)) {
    if (endpointIds.has(id)) continue;
    const contains = (point: Vec) =>
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height;
    // A surface containing an endpoint must not block its own connector.
    if (!contains(start) && !contains(end)) boxes.push(box);
  }
  return boxes;
}

// Reuse routes across bounds, picking, handles and paint in one context.
const resolvedRoutes = new WeakMap<
  ShapeContext,
  WeakMap<Element, Map<EndpointReader, ConnectorEndpoints | null>>
>();

/**
 * Resolve a connector's endpoints through the shape registry, or `null` when
 * either referenced element is missing or has no bounds.
 */
export function resolveConnector(
  element: Element,
  context: ShapeContext,
  readEndpoints: EndpointReader,
): ConnectorEndpoints | null {
  let elements = resolvedRoutes.get(context);
  if (!elements) {
    elements = new WeakMap();
    resolvedRoutes.set(context, elements);
  }
  let readers = elements.get(element);
  if (!readers) {
    readers = new Map();
    elements.set(element, readers);
  }
  if (readers.has(readEndpoints)) return readers.get(readEndpoints) ?? null;
  const result = computeConnector(element, context, readEndpoints);
  readers.set(readEndpoints, result);
  return result;
}

/** A free endpoint has no reference; its zero-size box participates in routing. */
function freeConnectorEndpoint(
  element: Element,
  end: "from" | "to",
): Element | undefined {
  if (element.type !== "edge.generic") return undefined;
  const semantic = element.semantic as Record<string, unknown>;
  const point = semantic[`${end}Point`] as Vec | undefined;
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))
    return undefined;
  return {
    ...element,
    id: "",
    type: "node.generic",
    semantic: { label: "" },
    visual: { x: point.x, y: point.y, width: 0, height: 0 },
  };
}

function computeConnector(
  element: Element,
  context: ShapeContext,
  readEndpoints: EndpointReader,
): ConnectorEndpoints | null {
  const ids = readEndpoints(element.semantic);
  if (!ids) {
    return null;
  }
  const from =
    context.resolve(ids.from) ?? freeConnectorEndpoint(element, "from");
  const to = context.resolve(ids.to) ?? freeConnectorEndpoint(element, "to");
  const fromBox =
    context.boundsOf(ids.from) ??
    (from?.id === ""
      ? { x: from.visual.x ?? 0, y: from.visual.y ?? 0, width: 0, height: 0 }
      : null);
  const toBox =
    context.boundsOf(ids.to) ??
    (to?.id === ""
      ? { x: to.visual.x ?? 0, y: to.visual.y ?? 0, width: 0, height: 0 }
      : null);
  if (!from || !to || !fromBox || !toBox) return null;
  const fromCenter = boxCenter(fromBox);
  const toCenter = boxCenter(toBox);
  const semantic =
    typeof element.semantic === "object" && element.semantic !== null
      ? (element.semantic as Record<string, unknown>)
      : {};
  const hasColumns = (end: string): boolean =>
    element.type === "erd.relation" &&
    erdEndpointColumnIds(semantic[end] as ErdEndpoint).length > 0;
  const fromPin = hasColumns("from")
    ? undefined
    : pinnedPort(from, context, semantic["fromPort"]);
  const toPin = hasColumns("to")
    ? undefined
    : pinnedPort(to, context, semantic["toPort"]);
  if (
    element.type === "state.transition" &&
    ids.from === ids.to &&
    !fromPin &&
    !toPin
  ) {
    const right = fromBox.x + fromBox.width + 40;
    const top = fromBox.y - 40;
    const start = resolvedBoundary(
      from,
      fromBox,
      { x: right, y: fromCenter.y },
      context,
    );
    const end = resolvedBoundary(
      to,
      toBox,
      { x: fromCenter.x, y: top },
      context,
    );
    return withRoute(start, end, fromBox, toBox, [
      start,
      { x: right, y: start.y },
      { x: right, y: top },
      { x: end.x, y: top },
      end,
    ]);
  }
  const relationAnchors = erdRelationAnchors(element, from, to, fromBox, toBox);
  const fromAnchor = relationAnchors?.[0] ?? fromCenter;
  const toAnchor = relationAnchors?.[1] ?? toCenter;
  if (
    element.type === "erd.relation" &&
    ids.from === ids.to &&
    !fromPin &&
    !toPin &&
    semantic["routing"] !== "manual"
  ) {
    // A self-referencing key loops out of the right side between its rows;
    // a table-level self relation spreads its ends around the centre.
    const right = fromBox.x + fromBox.width + 32;
    const sameRow = Math.abs(fromAnchor.y - toAnchor.y) < 1;
    const fromRow = { x: fromAnchor.x, y: fromAnchor.y - (sameRow ? 12 : 0) };
    const toRow = { x: toAnchor.x, y: toAnchor.y + (sameRow ? 12 : 0) };
    const start = resolvedBoundary(
      from,
      fromBox,
      { x: right, y: fromRow.y },
      context,
      fromRow,
    );
    const end = resolvedBoundary(
      to,
      toBox,
      { x: right, y: toRow.y },
      context,
      toRow,
    );
    return withRoute(start, end, fromBox, toBox, [
      start,
      { x: right, y: start.y },
      { x: right, y: end.y },
      end,
    ]);
  }
  if (element.type === "sequence.message") {
    const y = sequenceMessageY(element, context);
    if (fromCenter.x === toCenter.x) {
      return withRoute(
        { x: fromCenter.x, y },
        { x: fromCenter.x + 48, y },
        fromBox,
        toBox,
      );
    }
    return withRoute(
      { x: fromCenter.x, y },
      { x: toCenter.x, y },
      fromBox,
      toBox,
    );
  }
  if (semantic["routing"] === "manual") {
    const stored = manualWaypoints(semantic);
    const waypointPoints = stored.map((waypoint) =>
      connectorWaypointToPage(waypoint, fromCenter, toCenter),
    );
    const start =
      fromPin ??
      resolvedBoundary(
        from,
        fromBox,
        waypointPoints[0] ?? toCenter,
        context,
        fromAnchor,
      );
    const end =
      toPin ??
      resolvedBoundary(
        to,
        toBox,
        waypointPoints.at(-1) ?? fromCenter,
        context,
        toAnchor,
      );
    return withRoute(
      start,
      end,
      fromBox,
      toBox,
      [start, ...waypointPoints, end],
      undefined,
      waypointPoints,
    );
  }
  if (
    semantic["routing"] === "orthogonal" ||
    (ids.from === ids.to && (fromPin || toPin))
  ) {
    const requested = semantic["routingAxis"];
    const horizontal =
      requested === "horizontal" ||
      (requested !== "vertical" &&
        Math.abs(toAnchor.x - fromAnchor.x) >=
          Math.abs(toAnchor.y - fromAnchor.y));
    const direction = horizontal
      ? Math.sign(toAnchor.x - fromAnchor.x) || 1
      : Math.sign(toAnchor.y - fromAnchor.y) || 1;
    const start =
      fromPin ??
      resolvedBoundary(
        from,
        fromBox,
        horizontal
          ? { x: fromAnchor.x + direction, y: fromAnchor.y }
          : { x: fromAnchor.x, y: fromAnchor.y + direction },
        context,
        fromAnchor,
      );
    const end =
      toPin ??
      resolvedBoundary(
        to,
        toBox,
        horizontal
          ? { x: toAnchor.x - direction, y: toAnchor.y }
          : { x: toAnchor.x, y: toAnchor.y - direction },
        context,
        toAnchor,
      );
    // Leave pinned sides outward before finding a channel. Include endpoint
    // boxes so a branch pinned to the far side cannot run through its node.
    const portEscape = (
      point: Vec,
      pin: Vec | undefined,
      node: Element,
      box: Box,
      port: unknown,
    ): Vec => {
      if (!pin) return point;
      const direction =
        port === "top"
          ? { x: 0, y: -1 }
          : port === "right"
            ? { x: 1, y: 0 }
            : port === "bottom"
              ? { x: 0, y: 1 }
              : { x: -1, y: 0 };
      const normal = rotatePoint(
        direction,
        { x: 0, y: 0 },
        endpointRotation(node),
      );
      const outer = rotatedBox(box, endpointRotation(node));
      return Math.abs(normal.x) >= Math.abs(normal.y)
        ? {
            x: normal.x >= 0 ? outer.x + outer.width + 24 : outer.x - 24,
            y: point.y,
          }
        : {
            x: point.x,
            y: normal.y >= 0 ? outer.y + outer.height + 24 : outer.y - 24,
          };
    };
    const routeStart = portEscape(
      start,
      fromPin,
      from,
      fromBox,
      semantic["fromPort"],
    );
    const routeEnd = portEscape(end, toPin, to, toBox, semantic["toPort"]);
    const rawBend = semantic["routingBend"];
    const bend =
      typeof rawBend === "number" && Number.isFinite(rawBend)
        ? Math.max(0, Math.min(1, rawBend))
        : 0.5;
    const preferred: readonly Vec[] = horizontal
      ? [
          routeStart,
          {
            x: routeStart.x + (routeEnd.x - routeStart.x) * bend,
            y: routeStart.y,
          },
          {
            x: routeStart.x + (routeEnd.x - routeStart.x) * bend,
            y: routeEnd.y,
          },
          routeEnd,
        ]
      : [
          routeStart,
          {
            x: routeStart.x,
            y: routeStart.y + (routeEnd.y - routeStart.y) * bend,
          },
          {
            x: routeEnd.x,
            y: routeStart.y + (routeEnd.y - routeStart.y) * bend,
          },
          routeEnd,
        ];
    const endpointObstacles =
      fromPin || toPin
        ? [fromBox, toBox].map((box, index) => {
            const node = index === 0 ? from : to;
            const bounds = rotatedBox(box, endpointRotation(node));
            return {
              x: bounds.x - 12,
              y: bounds.y - 12,
              width: bounds.width + 24,
              height: bounds.height + 24,
            };
          })
        : [];
    const obstacles =
      semantic["routingAvoidObstacles"] === false
        ? endpointObstacles
        : [
            ...endpointObstacles,
            ...obstacleBoxes(
              element,
              new Set([ids.from, ids.to]),
              routeStart,
              routeEnd,
              context,
            ),
          ];
    const middle = avoidOrthogonalObstacles(
      preferred,
      obstacles,
      horizontal ? "h" : "v",
      element,
    );
    const points = [start, ...middle, end];
    const firstBend = preferred[1] as Vec;
    const secondBend = preferred[2] as Vec;
    const hasMovableChannel = horizontal
      ? Math.abs(start.y - end.y) > 1e-9
      : Math.abs(start.x - end.x) > 1e-9;
    return withRoute(
      start,
      end,
      fromBox,
      toBox,
      points,
      hasMovableChannel
        ? {
            point: {
              x: (firstBend.x + secondBend.x) / 2,
              y: (firstBend.y + secondBend.y) / 2,
            },
            axis: horizontal ? "x" : "y",
          }
        : undefined,
    );
  }
  const start =
    fromPin ?? resolvedBoundary(from, fromBox, toAnchor, context, fromAnchor);
  const end =
    toPin ?? resolvedBoundary(to, toBox, fromAnchor, context, toAnchor);
  return withRoute(start, end, fromBox, toBox);
}
