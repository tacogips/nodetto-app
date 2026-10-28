// The resolved route of a connector and its portable manual waypoints.

import {
  type ConnectorWaypoint,
  connectorWaypointFromPage,
  type ElementId,
  MAX_CONNECTOR_WAYPOINTS,
} from "@nodetto/ir";
import { type Box, boxCenter, type Vec } from "../../geometry.ts";

export interface ConnectorEndpoints {
  readonly start: Vec;
  readonly end: Vec;
  /** Ordered route vertices, including both boundary endpoints. */
  readonly points: readonly Vec[];
  /** Halfway along route length, used by labels across every renderer. */
  readonly labelPoint: Vec;
  /** Preferred channel handle, even when obstacle avoidance adds detours. */
  readonly bendPoint?: Vec;
  readonly bendAxis?: "x" | "y";
  /** Decoded page-space positions for user-authored manual waypoints. */
  readonly waypointPoints?: readonly Vec[];
  readonly fromBox: Box;
  readonly toBox: Box;
}

function pointAlong(points: readonly Vec[], ratio: number): Vec {
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index] as Vec;
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const target = lengths.reduce((sum, length) => sum + length, 0) * ratio;
  let travelled = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index] ?? 0;
    const from = points[index] as Vec;
    const to = points[index + 1] as Vec;
    if (travelled + length >= target && length > 0) {
      const at = (target - travelled) / length;
      return {
        x: from.x + (to.x - from.x) * at,
        y: from.y + (to.y - from.y) * at,
      };
    }
    travelled += length;
  }
  return points.at(-1) ?? { x: 0, y: 0 };
}

export function withRoute(
  start: Vec,
  end: Vec,
  fromBox: Box,
  toBox: Box,
  points: readonly Vec[] = [start, end],
  bend?: { readonly point: Vec; readonly axis: "x" | "y" },
  waypointPoints?: readonly Vec[],
): ConnectorEndpoints {
  const compact = points.filter(
    (point, index) =>
      index === 0 ||
      point.x !== points[index - 1]?.x ||
      point.y !== points[index - 1]?.y,
  );
  return {
    start,
    end,
    points: compact,
    labelPoint: pointAlong(compact, 0.5),
    ...(bend ? { bendPoint: bend.point, bendAxis: bend.axis } : {}),
    ...(waypointPoints?.length ? { waypointPoints } : {}),
    fromBox,
    toBox,
  };
}

function projectedPointOnSegment(point: Vec, from: Vec, to: Vec): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-18) return from;
  const raw =
    ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared;
  const at = Math.max(0, Math.min(1, raw));
  return { x: from.x + at * dx, y: from.y + at * dy };
}

/**
 * Insert the closest point on a connector route and encode every internal
 * vertex as portable manual waypoints. `authoredRoute` keeps duplicate or
 * collinear user points addressable; false preserves a generated route while
 * converting straight or orthogonal geometry to manual routing.
 */
export function connectorWaypointsWithInsertion(
  resolved: ConnectorEndpoints,
  point: Vec,
  authoredRoute: boolean,
): readonly ConnectorWaypoint[] | null {
  const route = authoredRoute
    ? [resolved.start, ...(resolved.waypointPoints ?? []), resolved.end]
    : resolved.points;
  if (route.length < 2 || route.length - 2 >= MAX_CONNECTOR_WAYPOINTS)
    return null;

  let segment = 0;
  let projected = route[0] as Vec;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < route.length - 1; index += 1) {
    const candidate = projectedPointOnSegment(
      point,
      route[index] as Vec,
      route[index + 1] as Vec,
    );
    const nextDistance = Math.hypot(
      point.x - candidate.x,
      point.y - candidate.y,
    );
    if (nextDistance < distance) {
      segment = index;
      projected = candidate;
      distance = nextDistance;
    }
  }

  const pageWaypoints = [
    ...route.slice(1, segment + 1),
    projected,
    ...route.slice(segment + 1, -1),
  ];
  const fromCenter = boxCenter(resolved.fromBox);
  const toCenter = boxCenter(resolved.toBox);
  return pageWaypoints.map((waypoint) =>
    connectorWaypointFromPage(waypoint, fromCenter, toCenter),
  );
}

export function manualWaypoints(
  semantic: Record<string, unknown>,
): readonly ConnectorWaypoint[] {
  const waypoints = semantic["routingWaypoints"];
  if (!Array.isArray(waypoints)) return [];
  return waypoints.flatMap((waypoint) => {
    if (typeof waypoint !== "object" || waypoint === null) return [];
    const { u, v } = waypoint as { u?: unknown; v?: unknown };
    return typeof u === "number" &&
      Number.isFinite(u) &&
      typeof v === "number" &&
      Number.isFinite(v)
      ? [{ u, v }]
      : [];
  });
}

/** Reads the two referenced element ids out of a semantic payload. */
export type EndpointReader = (
  semantic: unknown,
) => { readonly from: ElementId; readonly to: ElementId } | null;
