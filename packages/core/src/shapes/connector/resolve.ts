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
  MAX_ROUTING_LANE,
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
import {
  connectorLabelExtent,
  connectorLabelLayout,
} from "../../label-layout.ts";
import {
  SEQUENCE_SELF_LABEL_GAP,
  SEQUENCE_SELF_LOOP_HEIGHT,
  SEQUENCE_SELF_LOOP_WIDTH,
  sequenceMessageY,
} from "../../sequence-layout.ts";
import { connectorDecoration } from "./decoration.ts";
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
  lane: number,
): readonly Box[] {
  const boxes: Box[] = [];
  for (const { id, box } of routingObstacles(element, context)) {
    if (endpointIds.has(id)) continue;
    const contains = (b: Box, point: Vec) =>
      point.x >= b.x &&
      point.x <= b.x + b.width &&
      point.y >= b.y &&
      point.y <= b.y + b.height;
    if (contains(box, start) || contains(box, end)) continue;
    const grow = lane * 8;
    const grown = {
      x: box.x - grow,
      y: box.y - grow,
      width: box.width + 2 * grow,
      height: box.height + 2 * grow,
    };
    boxes.push(contains(grown, start) || contains(grown, end) ? box : grown);
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
  const visual =
    typeof element.visual === "object" && element.visual !== null
      ? (element.visual as unknown as Record<string, unknown>)
      : {};
  const extensions =
    typeof visual["extensions"] === "object" && visual["extensions"] !== null
      ? (visual["extensions"] as Record<string, unknown>)
      : {};
  const stored = (key: string): unknown =>
    key in semantic
      ? semantic[key]
      : key in visual
        ? visual[key]
        : extensions[key];
  const rawRouting = stored("routing");
  const routing = typeof rawRouting === "string" ? rawRouting : undefined;
  const rawAvoid = stored("routingAvoidObstacles");
  const avoid = typeof rawAvoid === "boolean" ? rawAvoid : undefined;
  const rawLane = semantic["routingLane"];
  const lane =
    typeof rawLane === "number" &&
    Number.isInteger(rawLane) &&
    rawLane >= 0 &&
    rawLane <= MAX_ROUTING_LANE
      ? rawLane
      : 0;
  const rawLabelPosition = semantic["labelPosition"];
  const labelRatio =
    typeof rawLabelPosition === "number" && Number.isFinite(rawLabelPosition)
      ? Math.max(0, Math.min(1, rawLabelPosition))
      : 0.5;
  const route = (...args: Parameters<typeof withRoute>): ConnectorEndpoints => {
    args[7] = labelRatio;
    const result = withRoute(...args);
    if (element.type.startsWith("bpmn.")) return result;
    const x = semantic["labelOffsetX"];
    const y = semantic["labelOffsetY"];
    const dx = typeof x === "number" && Number.isFinite(x) ? x : 0;
    const dy = typeof y === "number" && Number.isFinite(y) ? y : 0;
    return dx || dy
      ? {
          ...result,
          labelPoint: {
            x: result.labelPoint.x + dx,
            y: result.labelPoint.y + dy,
          },
        }
      : result;
  };
  const hasColumns = (end: string): boolean =>
    element.type === "erd.relation" &&
    erdEndpointColumnIds(semantic[end] as ErdEndpoint).length > 0;
  const fromPin = hasColumns("from")
    ? undefined
    : pinnedPort(
        from,
        context,
        semantic["fromPort"],
        semantic["fromPortPosition"],
      );
  const toPin = hasColumns("to")
    ? undefined
    : pinnedPort(to, context, semantic["toPort"], semantic["toPortPosition"]);
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
    return route(start, end, fromBox, toBox, [
      start,
      { x: right, y: start.y },
      { x: right, y: top },
      { x: end.x, y: top },
      end,
    ]);
  }
  if (
    ids.from === ids.to &&
    element.type !== "erd.relation" &&
    element.type !== "sequence.message" &&
    fromPin &&
    toPin &&
    semantic["fromPort"] === semantic["toPort"]
  ) {
    const port = semantic["fromPort"];
    const fromPosition = semantic["fromPortPosition"];
    const toPosition = semantic["toPortPosition"];
    const start =
      pinnedPort(
        from,
        context,
        port,
        typeof fromPosition === "number" && Number.isFinite(fromPosition)
          ? fromPosition
          : 0.3,
      ) ?? fromPin;
    const end =
      pinnedPort(
        to,
        context,
        port,
        typeof toPosition === "number" && Number.isFinite(toPosition)
          ? toPosition
          : 0.7,
      ) ?? toPin;
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
      endpointRotation(from),
    );
    return route(start, end, fromBox, toBox, [
      start,
      { x: start.x + normal.x * 40, y: start.y + normal.y * 40 },
      { x: end.x + normal.x * 40, y: end.y + normal.y * 40 },
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
    routing !== "manual"
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
    return route(start, end, fromBox, toBox, [
      start,
      { x: right, y: start.y },
      { x: right, y: end.y },
      end,
    ]);
  }
  if (element.type === "sequence.message") {
    const y = sequenceMessageY(element, context);
    if (ids.from === ids.to) {
      const cx = fromCenter.x;
      const start = { x: cx, y };
      const end = { x: cx, y: y + SEQUENCE_SELF_LOOP_HEIGHT };
      const base = route(start, end, fromBox, toBox, [
        start,
        { x: cx + SEQUENCE_SELF_LOOP_WIDTH, y },
        { x: cx + SEQUENCE_SELF_LOOP_WIDTH, y: end.y },
        end,
      ]);
      const labelStartX =
        cx + SEQUENCE_SELF_LOOP_WIDTH + SEQUENCE_SELF_LABEL_GAP;
      const layout = connectorLabelLayout(
        connectorDecoration(element).label,
        element.visual,
      );
      const extent = connectorLabelExtent(layout, { x: 0, y: 0 });
      return {
        ...base,
        labelStartX,
        labelPoint: extent
          ? {
              x: labelStartX + extent.width / 2,
              y:
                y +
                SEQUENCE_SELF_LOOP_HEIGHT / 2 -
                (extent.y + extent.height / 2),
            }
          : { x: labelStartX, y: y + SEQUENCE_SELF_LOOP_HEIGHT / 2 },
      };
    }
    if (fromCenter.x === toCenter.x) {
      return route(
        { x: fromCenter.x, y },
        { x: fromCenter.x + 48, y },
        fromBox,
        toBox,
      );
    }
    return route({ x: fromCenter.x, y }, { x: toCenter.x, y }, fromBox, toBox);
  }
  if (routing === "manual") {
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
    return route(
      start,
      end,
      fromBox,
      toBox,
      [start, ...waypointPoints, end],
      undefined,
      waypointPoints,
    );
  }
  if (routing === "orthogonal" || (ids.from === ids.to && (fromPin || toPin))) {
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
    const baseEscape = 24;
    const escapeDistance = Math.min(baseEscape + 3 * lane, 44);
    const portEscape = (
      point: Vec,
      pin: Vec | undefined,
      node: Element,
      box: Box,
      port: unknown,
      distance: number,
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
            x:
              normal.x >= 0
                ? outer.x + outer.width + distance
                : outer.x - distance,
            y: point.y,
          }
        : {
            x: point.x,
            y:
              normal.y >= 0
                ? outer.y + outer.height + distance
                : outer.y - distance,
          };
    };
    const safeDistance = (
      point: Vec,
      pin: Vec | undefined,
      node: Element,
      box: Box,
      port: unknown,
    ): number => {
      if (!pin || lane === 0 || avoid === false) return escapeDistance;
      const base = portEscape(point, pin, node, box, port, baseEscape);
      const candidate = portEscape(point, pin, node, box, port, escapeDistance);
      const obstacles = routingObstacles(element, context);
      for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        if (!obstacle || obstacle.id === ids.from || obstacle.id === ids.to)
          continue;
        const bounds = obstacle.box;
        const contains = (p: Vec) =>
          p.x >= bounds.x &&
          p.x <= bounds.x + bounds.width &&
          p.y >= bounds.y &&
          p.y <= bounds.y + bounds.height;
        const insideReal = (p: Vec) =>
          p.x > bounds.x + CONNECTOR_OBSTACLE_CLEARANCE &&
          p.x < bounds.x + bounds.width - CONNECTOR_OBSTACLE_CLEARANCE &&
          p.y > bounds.y + CONNECTOR_OBSTACLE_CLEARANCE &&
          p.y < bounds.y + bounds.height - CONNECTOR_OBSTACLE_CLEARANCE;
        if (
          (contains(candidate) && !contains(base)) ||
          (insideReal(candidate) && !insideReal(base))
        )
          return baseEscape;
      }
      return escapeDistance;
    };
    const fromDistance = safeDistance(
      start,
      fromPin,
      from,
      fromBox,
      semantic["fromPort"],
    );
    const toDistance = safeDistance(end, toPin, to, toBox, semantic["toPort"]);
    const smallestEscape = Math.min(
      fromPin ? fromDistance : escapeDistance,
      toPin ? toDistance : escapeDistance,
    );
    const clearance = Math.min(12 + 8 * lane, smallestEscape - 1);
    const routeStart = portEscape(
      start,
      fromPin,
      from,
      fromBox,
      semantic["fromPort"],
      fromDistance,
    );
    const routeEnd = portEscape(
      end,
      toPin,
      to,
      toBox,
      semantic["toPort"],
      toDistance,
    );
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
              x: bounds.x - clearance,
              y: bounds.y - clearance,
              width: bounds.width + clearance * 2,
              height: bounds.height + clearance * 2,
            };
          })
        : [];
    const obstacles =
      avoid === false
        ? endpointObstacles
        : [
            ...endpointObstacles,
            ...obstacleBoxes(
              element,
              new Set([ids.from, ids.to]),
              routeStart,
              routeEnd,
              context,
              lane,
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
    return route(
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
  return route(start, end, fromBox, toBox);
}
