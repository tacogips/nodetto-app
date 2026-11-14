// Outlines of Gerber graphics objects: the area each flash, draw and region
// covers, as closed contours whose arcs are cubic Bezier segments. Exposed
// outer contours wind counterclockwise (y up) and holes clockwise, so the
// nonzero fill rule paints their union.

import type {
  GerberAperture,
  GerberContour,
  GerberObject,
  GerberPolarity,
  MacroPrimitive,
} from "./gerber-read.ts";
import type { PcbPoint } from "./model.ts";

/** A contour point; Bezier handles belong to the segments either side. */
export interface OutlinePoint {
  readonly x: number;
  readonly y: number;
  readonly controlIn?: PcbPoint;
  readonly controlOut?: PcbPoint;
}

export type OutlineContour = readonly OutlinePoint[];

/** An area: outer contours and the holes inside them. */
export type OutlineArea = readonly OutlineContour[];

/**
 * Part of one object's footprint. An object made of several pieces (an
 * aperture with a hole, a macro with exposure-off primitives) is the
 * exposed pieces minus the unexposed ones, in order.
 */
export interface OutlinePiece {
  readonly exposed: boolean;
  readonly area: OutlineArea;
}

export interface GerberShape {
  readonly source: GerberObject["kind"];
  readonly polarity: GerberPolarity;
  readonly pieces: readonly OutlinePiece[];
}

const QUARTER = Math.PI / 2;
const FULL = 2 * Math.PI;
/** Coordinates closer than this (mm) are the same point. */
const SAME_POINT = 1e-7;

function polar(center: PcbPoint, radius: number, angle: number): PcbPoint {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  };
}

function rotate(point: PcbPoint, degrees: number): PcbPoint {
  if (degrees === 0) return point;
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

function moved(contour: OutlineContour, map: (point: PcbPoint) => PcbPoint) {
  return contour.map((point) => ({
    ...map(point),
    ...(point.controlIn ? { controlIn: map(point.controlIn) } : {}),
    ...(point.controlOut ? { controlOut: map(point.controlOut) } : {}),
  }));
}

/** Builds one closed contour from lines and arcs. */
class ContourBuilder {
  private readonly points: OutlinePoint[] = [];

  constructor(start: PcbPoint) {
    this.points.push({ x: start.x, y: start.y });
  }

  private get last(): OutlinePoint {
    return this.points[this.points.length - 1] as OutlinePoint;
  }

  lineTo(point: PcbPoint): this {
    const last = this.last;
    if (
      Math.abs(last.x - point.x) > SAME_POINT ||
      Math.abs(last.y - point.y) > SAME_POINT
    )
      this.points.push({ x: point.x, y: point.y });
    return this;
  }

  /** An arc about `center` turning `sweep` radians (positive is counterclockwise). */
  arc(center: PcbPoint, sweep: number): this {
    const last = this.last;
    const radius = Math.hypot(last.x - center.x, last.y - center.y);
    if (radius < SAME_POINT || Math.abs(sweep) < 1e-12) return this;
    let angle = Math.atan2(last.y - center.y, last.x - center.x);
    const steps = Math.max(1, Math.ceil(Math.abs(sweep) / QUARTER - 1e-9));
    const step = sweep / steps;
    const handle = (4 / 3) * Math.tan(step / 4) * radius;
    for (let index = 0; index < steps; index++) {
      const next = angle + step;
      const from = this.last;
      const fromPoint = polar(center, radius, angle);
      const to = polar(center, radius, next);
      this.points[this.points.length - 1] = {
        ...from,
        controlOut: {
          x: fromPoint.x - handle * Math.sin(angle),
          y: fromPoint.y + handle * Math.cos(angle),
        },
      };
      this.points.push({
        ...to,
        controlIn: {
          x: to.x + handle * Math.sin(next),
          y: to.y - handle * Math.cos(next),
        },
      });
      angle = next;
    }
    return this;
  }

  close(): OutlineContour {
    const first = this.points[0] as OutlinePoint;
    const last = this.last;
    if (
      this.points.length > 1 &&
      Math.abs(last.x - first.x) <= SAME_POINT &&
      Math.abs(last.y - first.y) <= SAME_POINT
    ) {
      this.points.pop();
      this.points[0] = last.controlIn
        ? { ...first, controlIn: last.controlIn }
        : first;
    }
    return this.points;
  }
}

function circle(center: PcbPoint, diameter: number): OutlineContour {
  const radius = diameter / 2;
  return new ContourBuilder({ x: center.x + radius, y: center.y })
    .arc(center, FULL)
    .close();
}

function polygonContour(points: readonly PcbPoint[]): OutlineContour {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function rectangle(center: PcbPoint, width: number, height: number) {
  const x = width / 2;
  const y = height / 2;
  return polygonContour([
    { x: center.x - x, y: center.y - y },
    { x: center.x + x, y: center.y - y },
    { x: center.x + x, y: center.y + y },
    { x: center.x - x, y: center.y + y },
  ]);
}

/** A rectangle with fully rounded short ends. */
function obround(center: PcbPoint, width: number, height: number) {
  if (Math.abs(width - height) <= SAME_POINT) return circle(center, width);
  if (width > height) {
    const r = height / 2;
    const half = width / 2 - r;
    return new ContourBuilder({ x: center.x - half, y: center.y - r })
      .lineTo({ x: center.x + half, y: center.y - r })
      .arc({ x: center.x + half, y: center.y }, Math.PI)
      .lineTo({ x: center.x - half, y: center.y + r })
      .arc({ x: center.x - half, y: center.y }, Math.PI)
      .close();
  }
  const r = width / 2;
  const half = height / 2 - r;
  return new ContourBuilder({ x: center.x + r, y: center.y - half })
    .lineTo({ x: center.x + r, y: center.y + half })
    .arc({ x: center.x, y: center.y + half }, Math.PI)
    .lineTo({ x: center.x - r, y: center.y - half })
    .arc({ x: center.x, y: center.y - half }, Math.PI)
    .close();
}

function regularPolygon(
  center: PcbPoint,
  diameter: number,
  vertices: number,
  rotation: number,
): OutlineContour {
  const points: PcbPoint[] = [];
  const count = Math.max(3, vertices);
  for (let index = 0; index < count; index++)
    points.push(
      polar(
        center,
        diameter / 2,
        ((rotation + (360 * index) / count) * Math.PI) / 180,
      ),
    );
  return polygonContour(points);
}

function signedArea(points: readonly PcbPoint[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index] as PcbPoint;
    const b = points[(index + 1) % points.length] as PcbPoint;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

/** Counterclockwise unless `clockwise`, judged on the flattened contour. */
function oriented(contour: OutlineContour, clockwise = false): OutlineContour {
  const area = signedArea(flattenContour(contour, 0.01));
  if (area === 0 || area > 0 !== clockwise) return contour;
  return reverse(contour);
}

function reverse(contour: OutlineContour): OutlineContour {
  const reversed = [...contour].reverse();
  return reversed.map((point) => {
    const { controlIn, controlOut, ...rest } = point;
    return {
      ...rest,
      ...(controlOut ? { controlIn: controlOut } : {}),
      ...(controlIn ? { controlOut: controlIn } : {}),
    };
  });
}

/** An annular sector `width` wide with round ends, or a ring for a full turn. */
function arcStroke(
  from: PcbPoint,
  to: PcbPoint,
  center: PcbPoint,
  sweep: number,
  width: number,
): OutlineArea {
  const radius = Math.hypot(from.x - center.x, from.y - center.y);
  const half = width / 2;
  const inner = Math.max(0, radius - half);
  if (Math.abs(Math.abs(sweep) - FULL) < 1e-9) {
    const outer = circle(center, 2 * (radius + half));
    return inner > SAME_POINT
      ? [outer, reverse(circle(center, 2 * inner))]
      : [outer];
  }
  // Walk counterclockwise from the start of the counterclockwise version.
  const [start, turn] =
    sweep >= 0
      ? [Math.atan2(from.y - center.y, from.x - center.x), sweep]
      : [Math.atan2(to.y - center.y, to.x - center.x), -sweep];
  const startCenter = polar(center, radius, start);
  const endCenter = polar(center, radius, start + turn);
  const builder = new ContourBuilder(polar(center, radius + half, start))
    .arc(center, turn)
    .arc(endCenter, Math.PI);
  if (inner > SAME_POINT) builder.arc(center, -turn);
  else builder.lineTo(polar(center, inner, start));
  return [
    builder
      .lineTo(polar(startCenter, half, start + Math.PI))
      .arc(startCenter, Math.PI)
      .close(),
  ];
}

/** Sweep from `from` to `to` about `center`; equal end points make a full turn. */
function arcSweep(
  from: PcbPoint,
  to: PcbPoint,
  center: PcbPoint,
  clockwise: boolean,
): number {
  const start = Math.atan2(from.y - center.y, from.x - center.x);
  const end = Math.atan2(to.y - center.y, to.x - center.x);
  let sweep = clockwise ? start - end : end - start;
  while (sweep <= 1e-9) sweep += FULL;
  if (sweep > FULL) sweep -= FULL;
  return clockwise ? -sweep : sweep;
}

/** Convex hull, counterclockwise (Andrew's monotone chain). */
function hull(points: readonly PcbPoint[]): PcbPoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: PcbPoint, a: PcbPoint, b: PcbPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (input: readonly PcbPoint[]) => {
    const chain: PcbPoint[] = [];
    for (const point of input) {
      while (
        chain.length >= 2 &&
        cross(
          chain[chain.length - 2] as PcbPoint,
          chain[chain.length - 1] as PcbPoint,
          point,
        ) <= 0
      )
        chain.pop();
      chain.push(point);
    }
    chain.pop();
    return chain;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** Line segments approximating a contour within `tolerance` millimetres. */
export function flattenContour(
  contour: OutlineContour,
  tolerance: number,
): PcbPoint[] {
  const points: PcbPoint[] = [];
  for (let index = 0; index < contour.length; index++) {
    const a = contour[index] as OutlinePoint;
    const b = contour[(index + 1) % contour.length] as OutlinePoint;
    points.push({ x: a.x, y: a.y });
    if (!a.controlOut && !b.controlIn) continue;
    const c1 = a.controlOut ?? a;
    const c2 = b.controlIn ?? b;
    const span =
      Math.hypot(c1.x - a.x, c1.y - a.y) +
      Math.hypot(c2.x - c1.x, c2.y - c1.y) +
      Math.hypot(b.x - c2.x, b.y - c2.y);
    const steps = Math.min(
      64,
      Math.max(2, Math.ceil(Math.sqrt(span / tolerance))),
    );
    for (let step = 1; step < steps; step++) {
      const t = step / steps;
      const u = 1 - t;
      points.push({
        x:
          u * u * u * a.x +
          3 * u * u * t * c1.x +
          3 * u * t * t * c2.x +
          t * t * t * b.x,
        y:
          u * u * u * a.y +
          3 * u * u * t * c1.y +
          3 * u * t * t * c2.y +
          t * t * t * b.y,
      });
    }
  }
  return points;
}

function thermal(primitive: Extract<MacroPrimitive, { kind: "thermal" }>) {
  const outer = primitive.outer / 2;
  const inner = primitive.inner / 2;
  const gap = primitive.gap / 2;
  if (gap >= outer) return [];
  const quadrant = (): OutlineContour => {
    const outerStart = Math.asin(gap / outer);
    const builder = new ContourBuilder(
      polar({ x: 0, y: 0 }, outer, outerStart),
    ).arc({ x: 0, y: 0 }, QUARTER - 2 * outerStart);
    if (gap < inner) {
      const innerStart = Math.asin(gap / inner);
      builder
        .lineTo(polar({ x: 0, y: 0 }, inner, QUARTER - innerStart))
        .arc({ x: 0, y: 0 }, -(QUARTER - 2 * innerStart));
    } else builder.lineTo({ x: gap, y: gap });
    return builder.close();
  };
  const base = quadrant();
  return [0, 90, 180, 270].map((turn) =>
    moved(base, (point) =>
      rotate(
        {
          x: rotate(point, turn).x + primitive.center.x,
          y: rotate(point, turn).y + primitive.center.y,
        },
        primitive.rotation,
      ),
    ),
  );
}

function macroPieces(primitives: readonly MacroPrimitive[]): OutlinePiece[] {
  return primitives.flatMap((primitive): OutlinePiece[] => {
    const turn = (contour: OutlineContour) =>
      oriented(moved(contour, (point) => rotate(point, primitive.rotation)));
    switch (primitive.kind) {
      case "circle":
        return [
          {
            exposed: primitive.exposure,
            area: [turn(circle(primitive.center, primitive.diameter))],
          },
        ];
      case "vectorLine": {
        const dx = primitive.end.x - primitive.start.x;
        const dy = primitive.end.y - primitive.start.y;
        const length = Math.hypot(dx, dy);
        if (length === 0) return [];
        const nx = (-dy / length) * (primitive.width / 2);
        const ny = (dx / length) * (primitive.width / 2);
        return [
          {
            exposed: primitive.exposure,
            area: [
              turn(
                polygonContour([
                  { x: primitive.start.x - nx, y: primitive.start.y - ny },
                  { x: primitive.end.x - nx, y: primitive.end.y - ny },
                  { x: primitive.end.x + nx, y: primitive.end.y + ny },
                  { x: primitive.start.x + nx, y: primitive.start.y + ny },
                ]),
              ),
            ],
          },
        ];
      }
      case "centerLine":
        return [
          {
            exposed: primitive.exposure,
            area: [
              turn(
                rectangle(primitive.center, primitive.width, primitive.height),
              ),
            ],
          },
        ];
      case "outline":
        return [
          {
            exposed: primitive.exposure,
            area: [turn(polygonContour(primitive.points.slice(0, -1)))],
          },
        ];
      case "polygon":
        return [
          {
            exposed: primitive.exposure,
            area: [
              turn(
                regularPolygon(
                  primitive.center,
                  primitive.diameter,
                  primitive.vertices,
                  0,
                ),
              ),
            ],
          },
        ];
      case "thermal":
        return thermal(primitive).map((contour) => ({
          exposed: true,
          area: [oriented(contour)],
        }));
    }
  });
}

/** The pieces of an aperture centred on the origin. */
export function aperturePieces(aperture: GerberAperture): OutlinePiece[] {
  const origin = { x: 0, y: 0 };
  const hole = (size: number | undefined): OutlinePiece[] =>
    size ? [{ exposed: false, area: [circle(origin, size)] }] : [];
  switch (aperture.kind) {
    case "circle":
      return [
        { exposed: true, area: [circle(origin, aperture.diameter)] },
        ...hole(aperture.hole),
      ];
    case "rectangle":
      return [
        {
          exposed: true,
          area: [rectangle(origin, aperture.width, aperture.height)],
        },
        ...hole(aperture.hole),
      ];
    case "obround":
      return [
        {
          exposed: true,
          area: [oriented(obround(origin, aperture.width, aperture.height))],
        },
        ...hole(aperture.hole),
      ];
    case "polygon":
      return [
        {
          exposed: true,
          area: [
            regularPolygon(
              origin,
              aperture.diameter,
              aperture.vertices,
              aperture.rotation,
            ),
          ],
        },
        ...hole(aperture.hole),
      ];
    case "macro":
      return macroPieces(aperture.primitives);
  }
}

function translatePieces(
  pieces: readonly OutlinePiece[],
  at: PcbPoint,
): OutlinePiece[] {
  return pieces.map((piece) => ({
    exposed: piece.exposed,
    area: piece.area.map((contour) =>
      moved(contour, (point) => ({ x: point.x + at.x, y: point.y + at.y })),
    ),
  }));
}

function regionArea(contours: readonly GerberContour[]): OutlineArea {
  return contours.flatMap((contour) => {
    const builder = new ContourBuilder(contour.start);
    let current = contour.start;
    for (const segment of contour.segments) {
      if (segment.arc) {
        builder.arc(
          segment.arc.center,
          arcSweep(
            current,
            segment.to,
            segment.arc.center,
            segment.arc.clockwise,
          ),
        );
        builder.lineTo(segment.to);
      } else builder.lineTo(segment.to);
      current = segment.to;
    }
    const closed = builder.close();
    return closed.length >= 3 || closed.some((point) => point.controlOut)
      ? [oriented(closed)]
      : [];
  });
}

/** The area one graphics object covers. */
export function gerberShape(object: GerberObject): GerberShape {
  const base = { source: object.kind, polarity: object.polarity } as const;
  switch (object.kind) {
    case "flash":
      return {
        ...base,
        pieces: translatePieces(aperturePieces(object.aperture), object.at),
      };
    case "region":
      return {
        ...base,
        pieces: [{ exposed: true, area: regionArea(object.contours) }],
      };
    case "draw": {
      const { aperture, from, to, arc } = object;
      if (arc) {
        const width =
          aperture.kind === "circle"
            ? aperture.diameter
            : aperture.kind === "macro"
              ? 0
              : aperture.kind === "polygon"
                ? aperture.diameter
                : Math.min(aperture.width, aperture.height);
        return {
          ...base,
          pieces: [
            {
              exposed: true,
              area: arcStroke(
                from,
                to,
                arc.center,
                arcSweep(from, to, arc.center, arc.clockwise),
                width,
              ),
            },
          ],
        };
      }
      if (aperture.kind === "circle") {
        const r = aperture.diameter / 2;
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        if (length <= SAME_POINT)
          return {
            ...base,
            pieces: [
              { exposed: true, area: [circle(from, aperture.diameter)] },
            ],
          };
        const nx = (-(to.y - from.y) / length) * r;
        const ny = ((to.x - from.x) / length) * r;
        return {
          ...base,
          pieces: [
            {
              exposed: true,
              area: [
                new ContourBuilder({ x: from.x - nx, y: from.y - ny })
                  .lineTo({ x: to.x - nx, y: to.y - ny })
                  .arc(to, Math.PI)
                  .lineTo({ x: from.x + nx, y: from.y + ny })
                  .arc(from, Math.PI)
                  .close(),
              ],
            },
          ],
        };
      }
      // Other apertures sweep their (convex) outline along the line.
      const outline = aperturePieces(aperture)
        .filter((piece) => piece.exposed)
        .flatMap((piece) =>
          piece.area.flatMap((contour) => flattenContour(contour, 0.005)),
        );
      const swept = hull(
        outline.flatMap((point) => [
          { x: point.x + from.x, y: point.y + from.y },
          { x: point.x + to.x, y: point.y + to.y },
        ]),
      );
      return {
        ...base,
        pieces:
          swept.length >= 3
            ? [{ exposed: true, area: [polygonContour(swept)] }]
            : [],
      };
    }
  }
}

/** Parameters in (0, 1) where one coordinate of a cubic Bezier peaks. */
function extremaOf(a: number, b: number, c: number, d: number): number[] {
  // Derivative / 3 = qa t^2 + qb t + qc.
  const qa = -a + 3 * b - 3 * c + d;
  const qb = 2 * (a - 2 * b + c);
  const qc = b - a;
  const roots: number[] = [];
  if (Math.abs(qa) < 1e-12) {
    if (Math.abs(qb) > 1e-12) roots.push(-qc / qb);
  } else {
    const discriminant = qb * qb - 4 * qa * qc;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      roots.push((-qb + root) / (2 * qa), (-qb - root) / (2 * qa));
    }
  }
  return roots.filter((t) => t > 0 && t < 1);
}

function cubicAt(
  a: number,
  b: number,
  c: number,
  d: number,
  t: number,
): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

/** Exact bounds of contours, curves included. */
export function outlineBounds(
  areas: Iterable<OutlineArea>,
): { minX: number; minY: number; maxX: number; maxY: number } | undefined {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const include = (x: number, y: number): void => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const area of areas)
    for (const contour of area)
      for (let index = 0; index < contour.length; index++) {
        const a = contour[index] as OutlinePoint;
        include(a.x, a.y);
        const b = contour[(index + 1) % contour.length] as OutlinePoint;
        if (!a.controlOut && !b.controlIn) continue;
        const c1 = a.controlOut ?? a;
        const c2 = b.controlIn ?? b;
        for (const t of extremaOf(a.x, c1.x, c2.x, b.x))
          include(
            cubicAt(a.x, c1.x, c2.x, b.x, t),
            cubicAt(a.y, c1.y, c2.y, b.y, t),
          );
        for (const t of extremaOf(a.y, c1.y, c2.y, b.y))
          include(
            cubicAt(a.x, c1.x, c2.x, b.x, t),
            cubicAt(a.y, c1.y, c2.y, b.y, t),
          );
      }
  return minX <= maxX ? { minX, minY, maxX, maxY } : undefined;
}
