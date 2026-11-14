// Drill holes and slots from the shapes on a drill layer. Shapes Gerber
// import drew are recognised exactly from their arcs; shapes drawn by hand
// are measured from their outline.

import {
  type Area,
  type Contour,
  distance,
  fitCircle,
  micrometres,
  signedArea,
} from "./contour.ts";
import type { DrillHit, DrillSlotHit } from "./excellon.ts";
import type { PcbPoint } from "./model.ts";

/** A drill contour this close to round (mm) is a hole, otherwise a slot. */
const ROUND_TOLERANCE_MM = 0.01;
/** Sizes this close (mm) are one size: page rounding noise. */
const SIZE_TOLERANCE_MM = 0.002;

export type DrillShape =
  | { readonly hole: DrillHit }
  | { readonly slot: DrillSlotHit };

/**
 * Exactly from its arcs: arcs around one centre are a hole, around two
 * centres a slot. Sizes come from the arcs' end points, which lie on the
 * circle; the page rounds Bezier handles more coarsely than that.
 */
export function exactDrill(contour: Contour): DrillShape | undefined {
  const clusters: { center: PcbPoint; ends: PcbPoint[] }[] = [];
  let from = contour.start;
  for (const segment of contour.segments) {
    const center = segment.center;
    if (center) {
      let cluster = clusters.find(
        (candidate) => distance(candidate.center, center) <= 0.005,
      );
      if (!cluster) {
        cluster = { center, ends: [] };
        clusters.push(cluster);
      }
      for (const end of [from, segment.to])
        if (!cluster.ends.some((point) => distance(point, end) < 1e-6))
          cluster.ends.push(end);
    }
    from = segment.to;
  }
  if (clusters.length === 0 || clusters.length > 2) return undefined;
  const circles = clusters.map((cluster) => fitCircle(cluster.ends));
  if (circles.some((circle) => circle === undefined)) return undefined;
  const [first, second] = circles as { center: PcbPoint; radius: number }[];
  if (!first) return undefined;
  if (!second)
    return { hole: { diameter: 2 * first.radius, at: first.center } };
  if (Math.abs(first.radius - second.radius) > 0.002) return undefined;
  const [a, b] = [first.center, second.center];
  const [start, end] =
    a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a];
  return {
    slot: { diameter: first.radius + second.radius, from: start, to: end },
  };
}

/** From the outline's extent and enclosed area, for shapes drawn by hand. */
export function measuredDrill(
  ring: readonly PcbPoint[],
): DrillShape | undefined {
  let from: PcbPoint | undefined;
  let to: PcbPoint | undefined;
  let longest = -1;
  for (let a = 0; a < ring.length; a++)
    for (let b = a + 1; b < ring.length; b++) {
      const length = distance(ring[a] as PcbPoint, ring[b] as PcbPoint);
      if (length > longest) {
        longest = length;
        from = ring[a];
        to = ring[b];
      }
    }
  if (!from || !to || longest <= 0) return undefined;
  if (to.x < from.x || (to.x === from.x && to.y < from.y))
    [from, to] = [to, from];
  const ux = (to.x - from.x) / longest;
  const uy = (to.y - from.y) / longest;
  let half = 0;
  for (const point of ring)
    half = Math.max(
      half,
      Math.abs((point.x - from.x) * uy - (point.y - from.y) * ux),
    );
  if (half <= 0) return undefined;
  const area = Math.abs(signedArea(ring));
  const center = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  if (longest - 2 * half <= ROUND_TOLERANCE_MM)
    return {
      hole: { diameter: 2 * Math.sqrt(area / Math.PI), at: center },
    };
  // A slot of overall length T and diameter d encloses (T - d) d + pi d^2 / 4.
  const k = 1 - Math.PI / 4;
  const diameter =
    (longest - Math.sqrt(Math.max(longest * longest - 4 * k * area, 0))) /
    (2 * k);
  const reach = (longest - diameter) / 2;
  return {
    slot: {
      diameter,
      from: { x: center.x - ux * reach, y: center.y - uy * reach },
      to: { x: center.x + ux * reach, y: center.y + uy * reach },
    },
  };
}

/**
 * Rounds sizes to micrometres and makes sizes within the page's rounding
 * noise one size, the one most shapes have: one drill tool, one line width.
 */
export function snapSizes(values: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) {
    const size = micrometres(value);
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  const sizes = [...counts.keys()].sort((a, b) => a - b);
  const tool = new Map<number, number>();
  let cluster: number[] = [];
  const flush = (): void => {
    const best = cluster.reduce((a, b) =>
      (counts.get(b) ?? 0) > (counts.get(a) ?? 0) ? b : a,
    );
    for (const size of cluster) tool.set(size, best);
    cluster = [];
  };
  for (const size of sizes) {
    const last = cluster.at(-1);
    if (last !== undefined && size - last > SIZE_TOLERANCE_MM + 1e-9) flush();
    cluster.push(size);
  }
  if (cluster.length) flush();
  return tool;
}

/**
 * Holes and slots for drill shapes, with sizes snapped to one tool per size;
 * `unreadable` counts shapes without a size.
 */
export function drillHits(areas: readonly Area[]): {
  readonly holes: DrillHit[];
  readonly slots: DrillSlotHit[];
  readonly unreadable: number;
} {
  const shapes: DrillShape[] = [];
  let unreadable = 0;
  for (const area of areas) {
    const shape = exactDrill(area.outer) ?? measuredDrill(area.outer.flat);
    if (shape) shapes.push(shape);
    else unreadable++;
  }
  const tool = snapSizes(
    shapes.map((shape) =>
      "hole" in shape ? shape.hole.diameter : shape.slot.diameter,
    ),
  );
  const size = (diameter: number) =>
    tool.get(micrometres(diameter)) ?? micrometres(diameter);
  const point = (at: PcbPoint) => ({
    x: micrometres(at.x),
    y: micrometres(at.y),
  });
  const holes: DrillHit[] = [];
  const slots: DrillSlotHit[] = [];
  for (const shape of shapes)
    if ("hole" in shape)
      holes.push({
        diameter: size(shape.hole.diameter),
        at: point(shape.hole.at),
      });
    else
      slots.push({
        diameter: size(shape.slot.diameter),
        from: point(shape.slot.from),
        to: point(shape.slot.to),
      });
  return { holes, slots, unreadable };
}
