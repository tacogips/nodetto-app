// Closed contours in board millimetres, as exports write them: exact line
// and arc edges for the files, and a flattened copy for measuring. Gerber
// import draws arcs as cubic Bezier segments of at most a quarter turn;
// contourOf recognises them so they go back out as arcs.

import { flattenContour, type OutlinePoint } from "./gerber-outline.ts";
import type { RegionSegment } from "./gerber.ts";
import type { PcbPoint } from "./model.ts";

/** Tolerance for curves that are not circular arcs, in millimetres. */
const FLATTEN_TOLERANCE_MM = 0.001;

/**
 * A closed contour in board millimetres: its exact edges for the files, and
 * a flattened copy for measuring.
 */
export interface Contour {
  readonly start: PcbPoint;
  readonly segments: readonly RegionSegment[];
  readonly flat: readonly PcbPoint[];
}

/** One filled area: an outer contour and its holes. */
export interface Area {
  readonly outer: Contour;
  readonly holes: readonly Contour[];
}

/** Rounds millimetres to micrometres. */
export const micrometres = (value: number): number =>
  Math.round(value * 1000) / 1000;

export function signedArea(ring: readonly PcbPoint[]): number {
  let doubled = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] as PcbPoint;
    const b = ring[(index + 1) % ring.length] as PcbPoint;
    doubled += a.x * b.y - b.x * a.y;
  }
  return doubled / 2;
}

export const distance = (a: PcbPoint, b: PcbPoint): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

function bezierAt(
  from: PcbPoint,
  out: PcbPoint,
  into: PcbPoint,
  to: PcbPoint,
  t: number,
): PcbPoint {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * from.x + b * out.x + c * into.x + d * to.x,
    y: a * from.y + b * out.y + c * into.y + d * to.y,
  };
}

/** The centre of the circle through three points, unless they are in line. */
function circumcenter(
  a: PcbPoint,
  b: PcbPoint,
  c: PcbPoint,
): PcbPoint | undefined {
  const det = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(det) < 1e-12) return undefined;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / det,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / det,
  };
}

/**
 * The circular arc a cubic Bezier segment draws, when it draws one: Gerber
 * import writes every arc as Bezier segments of at most a quarter turn. The
 * centre comes from points on the curve, which the page's coordinate
 * rounding disturbs far less than the handle directions.
 */
function arcOf(
  from: PcbPoint,
  out: PcbPoint,
  into: PcbPoint,
  to: PcbPoint,
): { center: PcbPoint; clockwise: boolean } | undefined {
  const center = circumcenter(from, bezierAt(from, out, into, to, 0.5), to);
  if (!center) return undefined;
  const radius = distance(center, from);
  const tolerance = Math.max(0.002, radius * 0.001);
  for (const t of [0.25, 0.75])
    if (
      Math.abs(distance(center, bezierAt(from, out, into, to, t)) - radius) >
      tolerance
    )
      return undefined;
  // At most a half turn, leaving along the circle.
  const tangent = { x: out.x - from.x, y: out.y - from.y };
  const length = Math.hypot(tangent.x, tangent.y);
  const cross =
    (from.x - center.x) * tangent.y - (from.y - center.y) * tangent.x;
  if (length < 1e-9 || Math.abs(cross) < 0.99 * radius * length)
    return undefined;
  return { center, clockwise: cross < 0 };
}

/** A closed contour of board points with Bezier handles. */
export function contourOf(
  points: readonly OutlinePoint[],
): Contour | undefined {
  const first = points[0];
  if (!first || points.length < 2) return undefined;
  const segments: RegionSegment[] = [];
  for (let index = 0; index < points.length; index++) {
    const from = points[index] as OutlinePoint;
    const to = points[(index + 1) % points.length] as OutlinePoint;
    const end = { x: to.x, y: to.y };
    if (!from.controlOut && !to.controlIn) {
      segments.push({ to: end });
      continue;
    }
    const arc = arcOf(from, from.controlOut ?? from, to.controlIn ?? to, to);
    if (arc) {
      segments.push({ to: end, ...arc });
      continue;
    }
    // A curve that is no circular arc becomes short lines.
    const curve = flattenContour(
      [
        {
          x: from.x,
          y: from.y,
          ...(from.controlOut ? { controlOut: from.controlOut } : {}),
        },
        {
          x: to.x,
          y: to.y,
          ...(to.controlIn ? { controlIn: to.controlIn } : {}),
        },
      ],
      FLATTEN_TOLERANCE_MM,
    );
    for (const point of curve.slice(1)) segments.push({ to: point });
  }
  const flat = flattenContour(points, FLATTEN_TOLERANCE_MM);
  if (flat.length < 3 || segments.length < 2) return undefined;
  return { start: { x: first.x, y: first.y }, segments, flat };
}

export function polygonContour(ring: readonly PcbPoint[]): Contour | undefined {
  const [first] = ring;
  if (!first || ring.length < 3) return undefined;
  return {
    start: first,
    segments: [...ring.slice(1), first].map((to) => ({ to })),
    flat: ring,
  };
}

/** Even-odd test of `point` against a ring. */
function inside(point: PcbPoint, ring: readonly PcbPoint[]): boolean {
  let result = false;
  for (
    let index = 0, last = ring.length - 1;
    index < ring.length;
    last = index++
  ) {
    const a = ring[index] as PcbPoint;
    const b = ring[last] as PcbPoint;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      result = !result;
  }
  return result;
}

/**
 * Splits contours into areas. Gerber import writes each hole right after
 * its outer contour and wound the other way; a contour wound the other way
 * that is not inside the outer contour before it is an area of its own.
 */
export function areasOf(contours: readonly Contour[]): Area[] {
  const areas: { outer: Contour; holes: Contour[] }[] = [];
  const outerSign = Math.sign(signedArea(contours[0]?.flat ?? []));
  for (const contour of contours) {
    const sign = Math.sign(signedArea(contour.flat));
    if (sign === 0) continue;
    const last = areas.at(-1);
    if (
      sign !== outerSign &&
      last &&
      contour.flat.every((point) => inside(point, last.outer.flat))
    )
      last.holes.push(contour);
    else areas.push({ outer: contour, holes: [] });
  }
  return areas;
}

/**
 * The circle best through `points` (an algebraic least-squares fit), from
 * at least three points on it.
 */
export function fitCircle(
  points: readonly PcbPoint[],
): { center: PcbPoint; radius: number } | undefined {
  if (points.length < 3) return undefined;
  // Centred on the mean point to keep the normal equations well conditioned.
  const mx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const my = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let suu = 0;
  let suv = 0;
  let svv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const point of points) {
    const u = point.x - mx;
    const v = point.y - my;
    suu += u * u;
    suv += u * v;
    svv += v * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-18) return undefined;
  const bu = (suuu + suvv) / 2;
  const bv = (svvv + svuu) / 2;
  const uc = (bu * svv - bv * suv) / det;
  const vc = (bv * suu - bu * suv) / det;
  return {
    center: { x: mx + uc, y: my + vc },
    radius: Math.sqrt(uc * uc + vc * vc + (suu + svv) / points.length),
  };
}
