// Drawn path of a connector: rounded bends and line jumps.
//
// A connector's route is a polyline. Two draw.io-style options change only
// how that polyline is painted, never the route itself (so picking, labels
// and arrowheads keep using the vertices):
//
// - `style.cornerRadius` rounds every bend with a quadratic curve, clamped to
//   half of each adjacent segment so short legs never overshoot.
// - `style.lineJumps` hops over (`arc`) or breaks around (`gap`) every
//   connector painted beneath this one on the same page, at each proper
//   crossing of their straight runs. Jumps always bulge up on horizontal-ish
//   runs and left on vertical-ish ones, so stacked crossings read alike.

import { getElementTypeDefinition, type Element } from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import type { Vec } from "../geometry.ts";
import type { ShapeContext } from "../shape-util.ts";
import { endpointReaderFor, resolveConnector } from "./connector.ts";

/** Radius of a line jump, in page units. */
export const LINE_JUMP_RADIUS = 6;

const EPSILON = 1e-6;

export interface ConnectorPathOptions {
  /** Bend rounding radius; zero or absent keeps sharp corners. */
  readonly cornerRadius?: number;
  readonly lineJumps?: "arc" | "gap";
  /** Routes this connector jumps over. */
  readonly crossings?: readonly (readonly Vec[])[];
  readonly jumpRadius?: number;
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function point(at: Vec): string {
  return `${fmt(at.x)} ${fmt(at.y)}`;
}

function distinct(points: readonly Vec[]): Vec[] {
  return points.filter(
    (at, index) =>
      index === 0 ||
      Math.hypot(
        at.x - (points[index - 1] as Vec).x,
        at.y - (points[index - 1] as Vec).y,
      ) > EPSILON,
  );
}

/** Parameter along `a -> b` where it properly crosses `c -> d`, if it does. */
function crossingAlong(a: Vec, b: Vec, c: Vec, d: Vec): number | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < EPSILON) return null;
  const qx = c.x - a.x;
  const qy = c.y - a.y;
  const t = (qx * sy - qy * sx) / denominator;
  const u = (qx * ry - qy * rx) / denominator;
  return t > EPSILON && t < 1 - EPSILON && u > EPSILON && u < 1 - EPSILON
    ? t
    : null;
}

/**
 * SVG path data for a route drawn with rounded bends and/or line jumps.
 * Fewer than two distinct points produce an empty path.
 */
export function connectorPathData(
  route: readonly Vec[],
  options: ConnectorPathOptions = {},
): string {
  const points = distinct(route);
  if (points.length < 2) return "";
  const radius = Math.max(0, options.cornerRadius ?? 0);
  const jump = options.jumpRadius ?? LINE_JUMP_RADIUS;
  const others = options.lineJumps ? (options.crossings ?? []) : [];
  const last = points.length - 1;
  // Trim each interior vertex by its clamped corner radius.
  const trim = points.map((vertex, index) => {
    if (index === 0 || index === last || radius === 0) return 0;
    const before = points[index - 1] as Vec;
    const after = points[index + 1] as Vec;
    return Math.min(
      radius,
      Math.hypot(vertex.x - before.x, vertex.y - before.y) / 2,
      Math.hypot(after.x - vertex.x, after.y - vertex.y) / 2,
    );
  });
  const toward = (from: Vec, to: Vec, distance: number): Vec => {
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return {
      x: from.x + ((to.x - from.x) / length) * distance,
      y: from.y + ((to.y - from.y) / length) * distance,
    };
  };
  const commands = [`M ${point(points[0] as Vec)}`];
  for (let index = 0; index < last; index += 1) {
    const from = points[index] as Vec;
    const to = points[index + 1] as Vec;
    const start = toward(from, to, trim[index] ?? 0);
    const end = toward(to, from, trim[index + 1] ?? 0);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (others.length > 0 && length > jump * 2) {
      const direction = {
        x: (end.x - start.x) / length,
        y: (end.y - start.y) / length,
      };
      // sweep-flag 1 bulges toward (dy, -dx) on a y-down page: up when
      // heading right, left when heading down.
      const alongSweep =
        Math.abs(direction.x) >= Math.abs(direction.y)
          ? direction.x
          : -direction.y;
      const sweep = alongSweep > 0 ? 1 : 0;
      const distances = others
        .flatMap((other) =>
          other.slice(1).map((next, at) => {
            const t = crossingAlong(start, end, other[at] as Vec, next);
            return t === null ? null : t * length;
          }),
        )
        .filter(
          (distance): distance is number =>
            distance !== null && distance >= jump && distance <= length - jump,
        )
        .sort((left, right) => left - right);
      let previous = Number.NEGATIVE_INFINITY;
      for (const distance of distances) {
        if (distance - previous < jump * 2) continue;
        previous = distance;
        const before = toward(start, end, distance - jump);
        const after = toward(start, end, distance + jump);
        commands.push(`L ${point(before)}`);
        commands.push(
          options.lineJumps === "arc"
            ? `A ${fmt(jump)} ${fmt(jump)} 0 0 ${sweep} ${point(after)}`
            : `M ${point(after)}`,
        );
      }
    }
    commands.push(`L ${point(end)}`);
    if ((trim[index + 1] ?? 0) > 0) {
      const next = points[index + 2] as Vec;
      commands.push(
        `Q ${point(to)} ${point(toward(to, next, trim[index + 1] ?? 0))}`,
      );
    }
  }
  return commands.join(" ");
}

/** Routes of the visible connectors painted beneath `element` on its page. */
export function connectorRoutesBeneath(
  element: Element,
  context: ShapeContext,
): readonly (readonly Vec[])[] {
  const page = context.elementsOnPage?.(element.page) ?? [];
  return page.flatMap((other) => {
    if (
      other.id === element.id ||
      getElementTypeDefinition(other.type)?.category !== "edge" ||
      compareFractional(other.index, element.index) >= 0 ||
      context.isHidden?.(other.id)
    )
      return [];
    const resolved = resolveConnector(
      other,
      context,
      endpointReaderFor(other.type),
    );
    return resolved ? [resolved.points] : [];
  });
}

/**
 * Path data for `element` along `route` when its style asks for rounded
 * bends or line jumps; `null` when a plain polyline draws it exactly.
 */
export function connectorPath(
  element: Element,
  route: readonly Vec[],
  context: ShapeContext,
): string | null {
  const style = element.visual.style;
  const cornerRadius = style?.cornerRadius ?? 0;
  const lineJumps = style?.lineJumps;
  if (cornerRadius <= 0 && !lineJumps) return null;
  return connectorPathData(route, {
    cornerRadius,
    ...(lineJumps
      ? { lineJumps, crossings: connectorRoutesBeneath(element, context) }
      : {}),
  });
}
