// The board outline as cut lines. Gerber import outlines every stroked
// line as a filled shape; board houses expect the outline as lines, so the
// lines are recovered from their shapes and written back as strokes.

import {
  type Area,
  type Contour,
  distance,
  fitCircle,
  micrometres,
} from "./contour.ts";
import { snapSizes } from "./drill-shapes.ts";
import type { GerberLayer, RegionSegment } from "./gerber.ts";
import type { PcbPoint } from "./model.ts";

/** A stroked path of the board outline: the cut line and its width. */
interface OutlineStroke {
  readonly width: number;
  readonly start: PcbPoint;
  readonly segments: readonly RegionSegment[];
}

interface ArcPiece {
  readonly from: PcbPoint;
  readonly to: PcbPoint;
  readonly center: PcbPoint;
  readonly radius: number;
  readonly clockwise: boolean;
}

function arcPieces(contour: Contour): ArcPiece[] {
  const pieces: ArcPiece[] = [];
  let from = contour.start;
  for (const segment of contour.segments) {
    if (segment.center)
      pieces.push({
        from,
        to: segment.to,
        center: segment.center,
        radius: distance(segment.center, from),
        clockwise: segment.clockwise === true,
      });
    from = segment.to;
  }
  return pieces;
}

function groupByCenter(pieces: readonly ArcPiece[]): ArcPiece[][] {
  const groups: ArcPiece[][] = [];
  for (const piece of pieces) {
    const group = groups.find(
      (candidate) =>
        distance((candidate[0] as ArcPiece).center, piece.center) <= 0.005,
    );
    if (group) group.push(piece);
    else groups.push([piece]);
  }
  return groups;
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= 0.002;

/** The circle through the arcs' end points, steadier than their centres. */
function circleOf(
  pieces: readonly ArcPiece[],
): { center: PcbPoint; radius: number } | undefined {
  const ends: PcbPoint[] = [];
  for (const piece of pieces)
    for (const end of [piece.from, piece.to])
      if (!ends.some((point) => distance(point, end) < 1e-6)) ends.push(end);
  const fitted = fitCircle(ends);
  if (fitted || pieces.length === 0) return fitted;
  // A short arc has only two end points: use the arcs' own centres.
  return {
    center: {
      x: pieces.reduce((sum, piece) => sum + piece.center.x, 0) / pieces.length,
      y: pieces.reduce((sum, piece) => sum + piece.center.y, 0) / pieces.length,
    },
    radius:
      pieces.reduce((sum, piece) => sum + piece.radius, 0) / pieces.length,
  };
}

/**
 * The line Gerber import outlined: a straight draw is two half circles
 * joined by lines, an arc draw an annular sector with round ends, and a full
 * circle a ring. Undefined for any other shape.
 */
function centerLine(area: Area): OutlineStroke | undefined {
  const outer = arcPieces(area.outer);
  if (area.holes.length === 1) {
    const hole = area.holes[0] as Contour;
    const inner = arcPieces(hole);
    if (
      outer.length !== area.outer.segments.length ||
      inner.length !== hole.segments.length ||
      groupByCenter([...outer, ...inner]).length !== 1
    )
      return undefined;
    const outside = circleOf(outer);
    const inside = circleOf(inner);
    if (!outside || !inside) return undefined;
    const radius = (outside.radius + inside.radius) / 2;
    const center = outside.center;
    const start = { x: center.x + radius, y: center.y };
    return {
      width: outside.radius - inside.radius,
      start,
      segments: [{ to: start, center, clockwise: false }],
    };
  }
  if (area.holes.length > 0) return undefined;
  const groups = groupByCenter(outer);
  if (groups.length === 2) {
    const [a, b] = groups.map(circleOf);
    if (!a || !b || !near(a.radius, b.radius)) return undefined;
    const lines = area.outer.segments.filter((segment) => !segment.center);
    if (lines.length !== 2) return undefined;
    return {
      width: a.radius + b.radius,
      start: a.center,
      segments: [{ to: b.center }],
    };
  }
  if (groups.length !== 3) return undefined;
  // One centre carries the outer and inner edges; the others are the ends.
  const main = groups.find(
    (group) =>
      !group.every((piece) =>
        near(piece.radius, (group[0] as ArcPiece).radius),
      ),
  );
  const endGroups = groups.filter((group) => group !== main);
  if (!main || endGroups.length !== 2) return undefined;
  const largest = Math.max(...main.map((piece) => piece.radius));
  const outerEdge = main.filter((piece) => near(piece.radius, largest));
  const outside = circleOf(outerEdge);
  const inside = circleOf(main.filter((piece) => !near(piece.radius, largest)));
  const ends = endGroups.map(circleOf);
  if (!outside || !inside || ends.some((end) => end === undefined))
    return undefined;
  // The round ends, three points each, measure the width best.
  const width =
    ends.reduce((sum, end) => sum + 2 * (end?.radius ?? 0), 0) / ends.length;
  if (Math.abs(outside.radius - inside.radius - width) > 0.005)
    return undefined;
  // The outer edge runs from one end to the other: its first piece is the
  // one no other outer piece leads into.
  const first = outerEdge.find(
    (piece) =>
      !outerEdge.some((other) => distance(other.to, piece.from) < 1e-6),
  );
  if (!first) return undefined;
  const [start, end] = (ends as { center: PcbPoint; radius: number }[])
    .map((circle) => circle.center)
    .sort((a, b) => distance(a, first.from) - distance(b, first.from)) as [
    PcbPoint,
    PcbPoint,
  ];
  return {
    width,
    start,
    segments: [{ to: end, center: outside.center, clockwise: first.clockwise }],
  };
}

/**
 * The board outline as cut lines. Lines Gerber import outlined are written
 * back as the lines they were; any other closed shape, such as a rectangle
 * added on the page, is a cut along its edges.
 */
export function writeOutline(
  gerber: GerberLayer,
  areas: readonly Area[],
  warn: (message: string) => void,
): void {
  const strokes = areas.map(centerLine);
  // Line widths within the page's rounding noise are one width.
  const sizes = snapSizes(
    strokes.flatMap((stroke) => (stroke ? [stroke.width] : [])),
  );
  const snapped = (value: number): number =>
    sizes.get(micrometres(value)) ?? micrometres(value);
  const counts = new Map<number, number>();
  for (const stroke of strokes)
    if (stroke) {
      const size = snapped(stroke.width);
      counts.set(size, (counts.get(size) ?? 0) + 1);
    }
  const width = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0.1;
  let edges = 0;
  areas.forEach((area, index) => {
    const stroke = strokes[index];
    if (stroke) {
      gerber.path(snapped(stroke.width), stroke.start, stroke.segments);
      return;
    }
    edges++;
    for (const contour of [area.outer, ...area.holes])
      gerber.path(width, contour.start, contour.segments);
  });
  if (edges)
    warn(`${edges} shape(s) are cut along their edges with ${width} mm lines`);
}
