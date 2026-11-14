import { expect, test } from "bun:test";
import {
  aperturePieces,
  flattenContour,
  type GerberShape,
  gerberShape,
  type OutlineArea,
  outlineBounds,
} from "./gerber-outline.ts";
import type { GerberAperture, GerberObject } from "./gerber-read.ts";

const TOLERANCE = 0.0005;
/**
 * Arcs are cubic Bezier quarters, which stray up to 0.027% of the radius
 * from the true circle; compare areas and edges to that accuracy.
 */
const BEZIER_DIGITS = 2;
const EDGE_DIGITS = 4;

function expectBounds(
  actual: ReturnType<typeof outlineBounds>,
  expected: NonNullable<ReturnType<typeof outlineBounds>>,
) {
  for (const key of ["minX", "minY", "maxX", "maxY"] as const)
    expect(actual?.[key]).toBeCloseTo(expected[key], EDGE_DIGITS);
}

/** Signed area (counterclockwise positive) of an area's flattened contours. */
function area(region: OutlineArea): number {
  let total = 0;
  for (const contour of region) {
    const points = flattenContour(contour, TOLERANCE);
    for (let index = 0; index < points.length; index++) {
      const a = points[index]!;
      const b = points[(index + 1) % points.length]!;
      total += (a.x * b.y - b.x * a.y) / 2;
    }
  }
  return total;
}

const shapeArea = (shape: GerberShape) =>
  shape.pieces.reduce((sum, piece) => sum + area(piece.area), 0);
const circle = (diameter: number): GerberAperture => ({
  kind: "circle",
  diameter,
});
const dark = { polarity: "dark" } as const;

test("flashes cover their aperture, counterclockwise", () => {
  const at = { x: 3, y: -2 };
  const flash = (aperture: GerberAperture) =>
    gerberShape({ kind: "flash", ...dark, aperture, at });
  expect(shapeArea(flash(circle(2)))).toBeCloseTo(Math.PI, BEZIER_DIGITS);
  expect(
    shapeArea(flash({ kind: "rectangle", width: 2, height: 1 })),
  ).toBeCloseTo(2, 9);
  // An obround is a rectangle with half-disc ends.
  expect(
    shapeArea(flash({ kind: "obround", width: 1, height: 3 })),
  ).toBeCloseTo(2 + Math.PI / 4, BEZIER_DIGITS);
  expect(
    shapeArea(
      flash({ kind: "polygon", diameter: 2, vertices: 4, rotation: 45 }),
    ),
  ).toBeCloseTo(2, 9);
  expectBounds(outlineBounds([flash(circle(2)).pieces[0]!.area]), {
    minX: 2,
    minY: -3,
    maxX: 4,
    maxY: -1,
  });
});

test("a line drawn with a round aperture is a stadium", () => {
  const shape = gerberShape({
    kind: "draw",
    ...dark,
    aperture: circle(0.5),
    from: { x: 0, y: 0 },
    to: { x: 3, y: 4 },
  });
  expect(shapeArea(shape)).toBeCloseTo(
    5 * 0.5 + Math.PI * 0.25 * 0.25,
    BEZIER_DIGITS,
  );
  const bounds = outlineBounds([shape.pieces[0]!.area])!;
  expect(bounds.minX).toBeCloseTo(-0.25, EDGE_DIGITS);
  expect(bounds.maxY).toBeCloseTo(4.25, EDGE_DIGITS);
});

test("a line drawn with a rectangle sweeps the rectangle", () => {
  const shape = gerberShape({
    kind: "draw",
    ...dark,
    aperture: { kind: "rectangle", width: 1, height: 1 },
    from: { x: 0, y: 0 },
    to: { x: 2, y: 0 },
  });
  expect(shapeArea(shape)).toBeCloseTo(3, 6);
});

test("arcs: a quarter annulus with round ends, and a full ring", () => {
  const quarter: GerberObject = {
    kind: "draw",
    ...dark,
    aperture: circle(0.2),
    from: { x: 1, y: 0 },
    to: { x: 0, y: 1 },
    arc: { center: { x: 0, y: 0 }, clockwise: false },
  };
  // Sector of width 0.2 at radius 1 over 90 degrees, plus two half-disc ends.
  expect(shapeArea(gerberShape(quarter))).toBeCloseTo(
    (Math.PI / 2) * 0.2 + Math.PI * 0.01,
    BEZIER_DIGITS,
  );
  // Clockwise the other way round covers the remaining three quarters.
  const clockwise = gerberShape({
    ...quarter,
    arc: { center: { x: 0, y: 0 }, clockwise: true },
  } as GerberObject);
  expect(shapeArea(clockwise)).toBeCloseTo(
    ((3 * Math.PI) / 2) * 0.2 + Math.PI * 0.01,
    BEZIER_DIGITS,
  );
  const ring = gerberShape({ ...quarter, to: { x: 1, y: 0 } } as GerberObject);
  expect(shapeArea(ring)).toBeCloseTo(
    Math.PI * (1.1 * 1.1 - 0.9 * 0.9),
    BEZIER_DIGITS,
  );
  // Exact bounds of the arc's outer edge, not of its Bezier handles.
  const bounds = outlineBounds([gerberShape(quarter).pieces[0]!.area])!;
  expect(bounds.maxX).toBeCloseTo(1.1, EDGE_DIGITS);
  expect(bounds.maxY).toBeCloseTo(1.1, EDGE_DIGITS);
});

test("regions follow their arcs and are oriented counterclockwise", () => {
  // A half disc drawn clockwise.
  const shape = gerberShape({
    kind: "region",
    ...dark,
    contours: [
      {
        start: { x: -1, y: 0 },
        segments: [
          {
            to: { x: 1, y: 0 },
            arc: { center: { x: 0, y: 0 }, clockwise: true },
          },
          { to: { x: -1, y: 0 } },
        ],
      },
    ],
  });
  expect(shapeArea(shape)).toBeCloseTo(Math.PI / 2, BEZIER_DIGITS);
});

test("macro primitives: rotation about the origin, exposure, thermals", () => {
  const pieces = aperturePieces({
    kind: "macro",
    name: "T",
    primitives: [
      {
        kind: "centerLine",
        exposure: true,
        width: 2,
        height: 1,
        center: { x: 2, y: 0 },
        rotation: 90,
      },
      {
        kind: "circle",
        exposure: false,
        diameter: 0.5,
        center: { x: 0, y: 2 },
        rotation: 0,
      },
      {
        kind: "thermal",
        center: { x: 0, y: 0 },
        outer: 2,
        inner: 1,
        gap: 0.2,
        rotation: 0,
      },
    ],
  });
  expect(pieces.map((piece) => piece.exposed)).toEqual([
    true,
    false,
    true,
    true,
    true,
    true,
  ]);
  // Rotated 90 degrees about the origin, the 2 x 1 rectangle at (2, 0) stands at (0, 2).
  expectBounds(outlineBounds([pieces[0]!.area]), {
    minX: -0.5,
    minY: 1,
    maxX: 0.5,
    maxY: 3,
  });
  const thermal = pieces
    .slice(2)
    .reduce((sum, piece) => sum + area(piece.area), 0);
  // Ring area less the two 0.2-wide gaps across it (approximately).
  expect(thermal).toBeGreaterThan(Math.PI * 0.75 - 4 * 0.2 * 0.5 - 0.01);
  expect(thermal).toBeLessThan(Math.PI * 0.75 - 4 * 0.2 * 0.5 + 0.02);
});

test("an aperture hole is an unexposed piece", () => {
  expect(
    aperturePieces({ kind: "circle", diameter: 2, hole: 0.5 }).map(
      (piece) => piece.exposed,
    ),
  ).toEqual([true, false]);
});
