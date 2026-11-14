import type { PcbPoint } from "./model.ts";

export interface LegendRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface LegendKeepout {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

interface Interval {
  readonly start: number;
  readonly end: number;
}

interface Piece extends Interval {
  readonly segment: number;
  readonly from: PcbPoint;
  readonly to: PcbPoint;
}

interface Stroke {
  points: PcbPoint[];
  cutStart: boolean;
  cutEnd: boolean;
}

function rectangleInterval(
  from: PcbPoint,
  to: PcbPoint,
  rect: LegendRect,
): Interval | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let start = 0;
  let end = 1;
  const tests = [
    { p: -dx, q: from.x - rect.minX },
    { p: dx, q: rect.maxX - from.x },
    { p: -dy, q: from.y - rect.minY },
    { p: dy, q: rect.maxY - from.y },
  ];
  for (const { p, q } of tests) {
    if (p === 0) {
      if (q < 0) return undefined;
      continue;
    }
    const t = q / p;
    if (p < 0) start = Math.max(start, t);
    else end = Math.min(end, t);
    if (start > end) return undefined;
  }
  return { start, end };
}

function circleInterval(
  from: PcbPoint,
  to: PcbPoint,
  keepout: LegendKeepout,
): Interval | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - keepout.x;
  const fy = from.y - keepout.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return undefined;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - keepout.radius * keepout.radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant <= 0) return undefined;
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  if (second <= 0 || first >= 1) return undefined;
  const start = Math.max(0, first);
  const end = Math.min(1, second);
  return start < end ? { start, end } : undefined;
}

function subtractIntervals(
  source: Interval,
  cuts: readonly Interval[],
): Interval[] {
  const merged: Interval[] = [];
  for (const interval of cuts) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start < previous.end) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, interval.end),
      };
    } else {
      merged.push(interval);
    }
  }
  const kept: Interval[] = [];
  let cursor = source.start;
  for (const cut of merged) {
    const start = Math.max(source.start, cut.start);
    const end = Math.min(source.end, cut.end);
    if (start > cursor) kept.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
  }
  if (cursor < source.end) kept.push({ start: cursor, end: source.end });
  return kept;
}

function pointAt(from: PcbPoint, to: PcbPoint, t: number): PcbPoint {
  if (t === 0) return from;
  if (t === 1) return to;
  return {
    x: from.x + t * (to.x - from.x),
    y: from.y + t * (to.y - from.y),
  };
}

function segmentLength(from: PcbPoint, to: PcbPoint): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clipLegendStroke(
  points: readonly PcbPoint[],
  rect: LegendRect,
  keepouts: readonly LegendKeepout[],
  minLength: number,
): readonly (readonly PcbPoint[])[] {
  if (points.length < 2) {
    const point = points[0];
    if (!point) return [];
    const inRect =
      point.x >= rect.minX &&
      point.x <= rect.maxX &&
      point.y >= rect.minY &&
      point.y <= rect.maxY;
    const clear = keepouts.every((keepout) => {
      const dx = point.x - keepout.x;
      const dy = point.y - keepout.y;
      return dx * dx + dy * dy >= keepout.radius * keepout.radius;
    });
    return inRect && clear ? [points] : [];
  }

  const pieces: Piece[] = [];
  let cutOccurred = false;
  points.forEach((from, segment) => {
    const to = points[segment + 1];
    if (!to) return;
    if (from.x === to.x && from.y === to.y) {
      const insideRect =
        from.x >= rect.minX &&
        from.x <= rect.maxX &&
        from.y >= rect.minY &&
        from.y <= rect.maxY;
      const clear = keepouts.every((keepout) => {
        const dx = from.x - keepout.x;
        const dy = from.y - keepout.y;
        return dx * dx + dy * dy >= keepout.radius * keepout.radius;
      });
      if (insideRect && clear) {
        pieces.push({ start: 0, end: 1, segment, from, to });
      } else {
        cutOccurred = true;
      }
      return;
    }
    const rectPart = rectangleInterval(from, to, rect);
    if (!rectPart) {
      cutOccurred = true;
      return;
    }
    const circleCuts = keepouts
      .map((keepout) => circleInterval(from, to, keepout))
      .filter((interval): interval is Interval => interval !== undefined)
      .sort((left, right) => left.start - right.start);
    const kept = subtractIntervals(rectPart, circleCuts);
    if (kept.length !== 1 || kept[0]?.start !== 0 || kept[0]?.end !== 1)
      cutOccurred = true;
    for (const interval of kept) {
      pieces.push({
        ...interval,
        segment,
        from: pointAt(from, to, interval.start),
        to: pointAt(from, to, interval.end),
      });
    }
  });
  if (!cutOccurred) return [points];

  const strokes: Stroke[] = [];
  for (const piece of pieces) {
    const cutStart = piece.start !== 0;
    const cutEnd = piece.end !== 1;
    const previous = strokes[strokes.length - 1];
    const joins =
      previous !== undefined &&
      previous.cutEnd === false &&
      cutStart === false &&
      piece.segment > 0 &&
      previous.points[previous.points.length - 1] === points[piece.segment];
    if (joins && previous) {
      previous.points.push(piece.to);
      previous.cutEnd = cutEnd;
    } else {
      strokes.push({
        points: [piece.from, piece.to],
        cutStart,
        cutEnd,
      });
    }
  }
  return strokes
    .filter((stroke) => {
      if (!stroke.cutStart && !stroke.cutEnd) return true;
      let length = 0;
      stroke.points.forEach((point, index) => {
        const next = stroke.points[index + 1];
        if (next) length += segmentLength(point, next);
      });
      return length >= minLength;
    })
    .map((stroke) => stroke.points);
}

export function boxClearOfKeepouts(
  box: LegendRect,
  keepouts: readonly LegendKeepout[],
): boolean {
  return keepouts.every((keepout) => {
    const x = Math.max(box.minX, Math.min(box.maxX, keepout.x));
    const y = Math.max(box.minY, Math.min(box.maxY, keepout.y));
    const dx = keepout.x - x;
    const dy = keepout.y - y;
    return dx * dx + dy * dy >= keepout.radius * keepout.radius;
  });
}
