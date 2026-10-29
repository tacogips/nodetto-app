// The drawn outline of a `shape.geo`, as data.
//
// The renderer and the SVG exporter have to agree on where a hexagon's
// corners are, so the arithmetic lives here rather than in either of them.
// Coordinates are local to the shape's box, inset by one unit so a 1.5-wide
// stroke is not clipped by the box edge; an unknown kind falls back to the
// rectangle, matching the registry's forward-compatibility rule.

import type { GeoKind } from "@nodetto/ir";

export type GeoOutline =
  | {
      readonly kind: "rect";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly rx: number;
    }
  | {
      readonly kind: "ellipse";
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
    }
  | {
      readonly kind: "polygon";
      readonly points: string;
      /** Unfilled interior strokes, such as a folded corner or inner bars. */
      readonly detail?: string;
    }
  | {
      readonly kind: "cylinder";
      readonly path: string;
      readonly cap: {
        readonly cx: number;
        readonly cy: number;
        readonly rx: number;
        readonly ry: number;
      };
    };

/** Mirror axes of a geometric shape; its label is never mirrored. */
export interface GeoFlip {
  readonly x?: boolean;
  readonly y?: boolean;
}

type Point = readonly [number, number];

function polygonPoints(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Open polylines as one SVG path, each starting with its own move-to. */
function detailPath(lines: readonly (readonly Point[])[]): string {
  return lines
    .map((line) =>
      line
        .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
        .join(" "),
    )
    .join(" ");
}

function polygonOutline(
  points: readonly Point[],
  detail?: readonly (readonly Point[])[],
): GeoOutline {
  return {
    kind: "polygon",
    points: polygonPoints(points),
    ...(detail ? { detail: detailPath(detail) } : {}),
  };
}

/** Points of a half sine bump bulging to the left of each chord a -> b. */
function bump(a: Point, b: Point, height: number, segments: number): Point[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = dy / length;
  const ny = -dx / length;
  return Array.from({ length: segments }, (_, index) => {
    const t = index / segments;
    const lift = Math.sin(Math.PI * t) * height;
    return [a[0] + dx * t + nx * lift, a[1] + dy * t + ny * lift] as const;
  });
}

/** Scallops around an ellipse, rescaled so the result fills the inset box. */
function cloudPoints(width: number, height: number): Point[] {
  const lobes = [1.1, 0.8, 1, 0.9, 1.15, 0.85, 1, 0.95];
  const anchors = lobes.map((_, index): Point => {
    const angle = (index / lobes.length) * Math.PI * 2 + Math.PI / 8;
    return [Math.cos(angle) * 0.38, Math.sin(angle) * 0.3];
  });
  const raw: Point[] = [];
  anchors.forEach((anchor, index) => {
    const next = anchors[(index + 1) % anchors.length] as Point;
    const chord = Math.hypot(next[0] - anchor[0], next[1] - anchor[1]);
    // Clockwise chords on a y-down plane bulge outward on their left.
    raw.push(...bump(anchor, next, chord * 0.42 * (lobes[index] ?? 1), 10));
  });
  const xs = raw.map(([x]) => x);
  const ys = raw.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const innerWidth = Math.max(0, width - 2);
  const innerHeight = Math.max(0, height - 2);
  return raw.map(([x, y]) => [
    round(1 + ((x - minX) / spanX) * innerWidth),
    round(1 + ((y - minY) / spanY) * innerHeight),
  ]);
}

function documentPoints(width: number, height: number): Point[] {
  const right = width - 1;
  const bottom = height - 1;
  const wave = Math.min(height * 0.1, 12);
  const base = bottom - wave;
  const segments = 24;
  const curve = Array.from({ length: segments + 1 }, (_, index): Point => {
    const t = index / segments;
    // Right to left: the wave rises on the right and dips on the left.
    return [
      round(right - (right - 1) * t),
      round(base - wave * Math.sin(Math.PI * 2 * t)),
    ];
  });
  return [[1, 1], [right, 1], ...curve];
}

function delayPoints(width: number, height: number): Point[] {
  const ry = Math.max(0, height / 2 - 1);
  const rx = Math.max(0, Math.min(width / 2, height / 2) - 1);
  const cx = width - 1 - rx;
  const cy = height / 2;
  const segments = 16;
  const arc = Array.from({ length: segments + 1 }, (_, index): Point => {
    const angle = -Math.PI / 2 + (Math.PI * index) / segments;
    return [round(cx + Math.cos(angle) * rx), round(cy + Math.sin(angle) * ry)];
  });
  return [[1, 1], ...arc, [1, height - 1]];
}

function starPoints(width: number, height: number): Point[] {
  const cx = width / 2;
  const cy = height / 2;
  const outerX = cx - 1;
  const outerY = cy - 1;
  const points: Point[] = [];
  for (let i = 0; i < 10; i += 1) {
    // Start at the top point and alternate outer/inner radius.
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const scale = i % 2 === 0 ? 1 : 0.4;
    points.push([
      cx + Math.cos(angle) * outerX * scale,
      cy + Math.sin(angle) * outerY * scale,
    ]);
  }
  return points;
}

/** Points along an elliptical arc from `from` to `to` (radians, y down). */
function arcPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  segments = 16,
): Point[] {
  return Array.from({ length: segments + 1 }, (_, index): Point => {
    const angle = from + ((to - from) * index) / segments;
    return [round(cx + Math.cos(angle) * rx), round(cy + Math.sin(angle) * ry)];
  });
}

/** A closed ellipse inscribed in the inset box, as polygon points. */
function ellipseRing(width: number, height: number): Point[] {
  return arcPoints(
    width / 2,
    height / 2,
    Math.max(0, width / 2 - 1),
    Math.max(0, height / 2 - 1),
    -Math.PI / 2,
    (Math.PI * 3) / 2,
    48,
  ).slice(0, -1);
}

/** Points along one cubic Bezier segment, excluding its start point. */
function cubicPoints(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  segments = 10,
): Point[] {
  return Array.from({ length: segments }, (_, index): Point => {
    const t = (index + 1) / segments;
    const u = 1 - t;
    const blend = (axis: 0 | 1) =>
      u * u * u * p0[axis] +
      3 * u * u * t * p1[axis] +
      3 * u * t * t * p2[axis] +
      t * t * t * p3[axis];
    return [round(blend(0)), round(blend(1))];
  });
}

/** A wavy edge from x0 to x1 around `base`, dipping first like draw.io's tape. */
function wavePoints(
  x0: number,
  x1: number,
  base: number,
  amplitude: number,
): Point[] {
  const segments = 24;
  return Array.from({ length: segments + 1 }, (_, index): Point => {
    const t = index / segments;
    // Phase follows x rather than travel, so both edges of a tape run parallel.
    const along = x1 >= x0 ? t : 1 - t;
    return [
      round(x0 + (x1 - x0) * t),
      round(base + amplitude * Math.sin(Math.PI * 2 * along)),
    ];
  });
}

/** draw.io's user (actor) outline: a head resting on rounded shoulders. */
function personPoints(width: number, height: number): Point[] {
  const left = 1;
  const top = 1;
  const w = Math.max(0, width - 2);
  const h = Math.max(0, height - 2);
  const at = (x: number, y: number): Point => [left + x * w, top + y * h];
  const neck = at(0.5, 0.4);
  return [
    at(0, 1),
    ...cubicPoints(at(0, 1), at(0, 0.6), at(0, 0.4), neck),
    ...cubicPoints(neck, at(0.25, 0.4), at(0.25, 0), at(0.5, 0)),
    ...cubicPoints(at(0.5, 0), at(0.75, 0), at(0.75, 0.4), neck),
    ...cubicPoints(neck, at(1, 0.4), at(1, 0.6), at(1, 1)),
  ];
}

/** Height of a cylinder's elliptical rim, capped so tall ones stay round. */
function cylinderRim(height: number): number {
  return Math.min(height * 0.15, 18);
}

function cylinderPath(width: number, height: number): string {
  const rim = cylinderRim(height);
  const right = width - 1;
  return [
    `M 1 ${rim}`,
    `A ${width / 2 - 1} ${rim} 0 0 1 ${right} ${rim}`,
    `L ${right} ${height - rim}`,
    `A ${width / 2 - 1} ${rim} 0 0 1 1 ${height - rim}`,
    "Z",
  ].join(" ");
}

function rectOutline(width: number, height: number): GeoOutline {
  return {
    kind: "rect",
    x: 1,
    y: 1,
    width: Math.max(0, width - 2),
    height: Math.max(0, height - 2),
    rx: 4,
  };
}

export function geoOutline(
  kind: GeoKind | string,
  width: number,
  height: number,
  flip: GeoFlip = {},
): GeoOutline {
  const at = ([x, y]: Point): Point => [
    flip.x ? round(width - x) : x,
    flip.y ? round(height - y) : y,
  ];
  const polygon = (
    points: readonly Point[],
    detail?: readonly (readonly Point[])[],
  ): GeoOutline =>
    polygonOutline(
      points.map(at),
      detail?.map((line) => line.map(at)),
    );
  const left = 1;
  const top = 1;
  const right = width - 1;
  const bottom = height - 1;
  const middleX = width / 2;
  const middleY = height / 2;
  const short = Math.min(width, height);
  switch (kind) {
    case "ellipse":
      return {
        kind: "ellipse",
        cx: middleX,
        cy: middleY,
        rx: Math.max(0, width / 2 - 1),
        ry: Math.max(0, height / 2 - 1),
      };
    case "diamond":
      return polygon([
        [middleX, top],
        [right, middleY],
        [middleX, bottom],
        [left, middleY],
      ]);
    case "triangle":
      return polygon([
        [middleX, top],
        [right, bottom],
        [left, bottom],
      ]);
    case "hexagon":
      return polygon([
        [width * 0.25, top],
        [width * 0.75, top],
        [right, middleY],
        [width * 0.75, bottom],
        [width * 0.25, bottom],
        [left, middleY],
      ]);
    case "parallelogram":
      return polygon([
        [width * 0.25, top],
        [right, top],
        [width * 0.75, bottom],
        [left, bottom],
      ]);
    case "cylinder":
      // Rotationally symmetric about its vertical axis; a flipped database
      // would read as a different symbol, so flipping leaves it unchanged.
      return {
        kind: "cylinder",
        path: cylinderPath(width, height),
        cap: {
          cx: middleX,
          cy: cylinderRim(height),
          rx: Math.max(0, width / 2 - 1),
          ry: cylinderRim(height),
        },
      };
    case "star":
      return polygon(starPoints(width, height));
    case "trapezoid":
      return polygon([
        [width * 0.2, top],
        [width * 0.8, top],
        [right, bottom],
        [left, bottom],
      ]);
    case "pentagon":
      return polygon([
        [middleX, top],
        [right, height * 0.38],
        [width * 0.81, bottom],
        [width * 0.19, bottom],
        [left, height * 0.38],
      ]);
    case "octagon": {
      const corner = round(short * 0.29);
      return polygon([
        [left + corner, top],
        [right - corner, top],
        [right, top + corner],
        [right, bottom - corner],
        [right - corner, bottom],
        [left + corner, bottom],
        [left, bottom - corner],
        [left, top + corner],
      ]);
    }
    case "cross": {
      const armX = round(width * 0.33);
      const armY = round(height * 0.33);
      return polygon([
        [armX, top],
        [width - armX, top],
        [width - armX, armY],
        [right, armY],
        [right, height - armY],
        [width - armX, height - armY],
        [width - armX, bottom],
        [armX, bottom],
        [armX, height - armY],
        [left, height - armY],
        [left, armY],
        [armX, armY],
      ]);
    }
    case "arrow": {
      const head = round(Math.max(left, width - Math.min(width * 0.4, height)));
      return polygon([
        [left, height * 0.3],
        [head, height * 0.3],
        [head, top],
        [right, middleY],
        [head, bottom],
        [head, height * 0.7],
        [left, height * 0.7],
      ]);
    }
    case "chevron": {
      const point = round(Math.min(width * 0.25, height / 2));
      return polygon([
        [left, top],
        [right - point, top],
        [right, middleY],
        [right - point, bottom],
        [left, bottom],
        [left + point, middleY],
      ]);
    }
    case "cloud":
      return polygon(cloudPoints(width, height));
    case "callout": {
      const body = round(height * 0.75);
      return polygon([
        [left, top],
        [right, top],
        [right, body],
        [width * 0.45, body],
        [width * 0.25, bottom],
        [width * 0.3, body],
        [left, body],
      ]);
    }
    case "note": {
      const fold = round(Math.min(short * 0.2, 24));
      return polygon(
        [
          [left, top],
          [right - fold, top],
          [right, top + fold],
          [right, bottom],
          [left, bottom],
        ],
        [
          [
            [right - fold, top],
            [right - fold, top + fold],
            [right, top + fold],
          ],
        ],
      );
    }
    case "cube": {
      // draw.io's cube: the front face sits bottom-right, depth up-left.
      const depth = round(Math.min(short * 0.2, 24));
      return polygon(
        [
          [left, top],
          [right - depth, top],
          [right, top + depth],
          [right, bottom],
          [left + depth, bottom],
          [left, bottom - depth],
        ],
        [
          [
            [left, top],
            [left + depth, top + depth],
            [right, top + depth],
          ],
          [
            [left + depth, top + depth],
            [left + depth, bottom],
          ],
        ],
      );
    }
    case "document":
      return polygon(documentPoints(width, height));
    case "manual-input":
      return polygon([
        [left, height * 0.3],
        [right, top],
        [right, bottom],
        [left, bottom],
      ]);
    case "delay":
      return polygon(delayPoints(width, height));
    case "predefined-process": {
      const inset = round(Math.min(width * 0.1, 14));
      return polygon(
        [
          [left, top],
          [right, top],
          [right, bottom],
          [left, bottom],
        ],
        [
          [
            [left + inset, top],
            [left + inset, bottom],
          ],
          [
            [right - inset, top],
            [right - inset, bottom],
          ],
        ],
      );
    }
    case "internal-storage": {
      const inset = round(Math.min(short * 0.2, 16));
      return polygon(
        [
          [left, top],
          [right, top],
          [right, bottom],
          [left, bottom],
        ],
        [
          [
            [left + inset, top],
            [left + inset, bottom],
          ],
          [
            [left, top + inset],
            [right, top + inset],
          ],
        ],
      );
    }
    case "off-page":
      return polygon([
        [left, top],
        [right, top],
        [right, height * 0.6],
        [middleX, bottom],
        [left, height * 0.6],
      ]);
    case "card": {
      const corner = round(Math.min(short * 0.25, 24));
      return polygon([
        [left + corner, top],
        [right, top],
        [right, bottom],
        [left, bottom],
        [left, top + corner],
      ]);
    }
    case "tape": {
      const amplitude = round(Math.min(height * 0.09, 10));
      return polygon([
        ...wavePoints(left, right, top + amplitude, amplitude),
        ...wavePoints(right, left, bottom - amplitude, amplitude),
      ]);
    }
    case "stored-data": {
      const depth = round(Math.min(width * 0.15, 20));
      const ry = Math.max(0, middleY - 1);
      return polygon([
        [left + depth, top],
        // Concave right side, convex left side.
        ...arcPoints(right, middleY, depth, ry, -Math.PI / 2, -Math.PI * 1.5),
        ...arcPoints(
          left + depth,
          middleY,
          depth,
          ry,
          Math.PI / 2,
          Math.PI * 1.5,
        ).slice(0, -1),
      ]);
    }
    case "display": {
      const point = round(Math.min(width * 0.25, height));
      return polygon([
        [left, middleY],
        [left + point, top],
        ...arcPoints(
          right - point,
          middleY,
          point,
          Math.max(0, middleY - 1),
          -Math.PI / 2,
          Math.PI / 2,
        ),
        [left + point, bottom],
      ]);
    }
    case "loop-limit": {
      const corner = round(Math.min(short * 0.25, 20));
      return polygon([
        [left + corner, top],
        [right - corner, top],
        [right, top + corner],
        [right, bottom],
        [left, bottom],
        [left, top + corner],
      ]);
    }
    case "collate":
      return polygon([
        [left, top],
        [right, top],
        [middleX, middleY],
        [right, bottom],
        [left, bottom],
        [middleX, middleY],
      ]);
    case "sort":
      return polygon(
        [
          [middleX, top],
          [right, middleY],
          [middleX, bottom],
          [left, middleY],
        ],
        [
          [
            [left, middleY],
            [right, middleY],
          ],
        ],
      );
    case "summing-junction": {
      const dx = round((middleX - 1) * Math.SQRT1_2);
      const dy = round((middleY - 1) * Math.SQRT1_2);
      return polygon(ellipseRing(width, height), [
        [
          [middleX - dx, middleY - dy],
          [middleX + dx, middleY + dy],
        ],
        [
          [middleX + dx, middleY - dy],
          [middleX - dx, middleY + dy],
        ],
      ]);
    }
    case "or":
      return polygon(ellipseRing(width, height), [
        [
          [middleX, top],
          [middleX, bottom],
        ],
        [
          [left, middleY],
          [right, middleY],
        ],
      ]);
    case "multi-document": {
      // Three stacked pages: the filled union, with the hidden pages' top and
      // right edges drawn as interior strokes over the front page.
      const offset = round(Math.min(width * 0.06, height * 0.1, 8));
      const wave = Math.min((height - offset * 2) * 0.1, 12);
      const base = bottom - wave;
      const front = Array.from({ length: 25 }, (_, index): Point => {
        const t = index / 24;
        return [
          round(right - offset * 2 - (right - offset * 2 - left) * t),
          round(base - wave * Math.sin(Math.PI * 2 * t)),
        ];
      });
      return polygon(
        [
          [left, top + offset * 2],
          [left + offset, top + offset * 2],
          [left + offset, top + offset],
          [left + offset * 2, top + offset],
          [left + offset * 2, top],
          [right, top],
          [right, round(base - offset * 2)],
          [right - offset, round(base - offset * 2)],
          [right - offset, round(base - offset)],
          [right - offset * 2, round(base - offset)],
          ...front,
        ],
        [
          [
            [left + offset, top + offset * 2],
            [right - offset * 2, top + offset * 2],
            [right - offset * 2, round(base - offset)],
          ],
          [
            [left + offset * 2, top + offset],
            [right - offset, top + offset],
            [right - offset, round(base - offset * 2)],
          ],
        ],
      );
    }
    case "direct-data": {
      // A cylinder on its side: the right end shows its full face.
      const rx = round(Math.min(width * 0.15, height * 0.4));
      const ry = Math.max(0, middleY - 1);
      return polygon(
        [
          [left + rx, top],
          ...arcPoints(right - rx, middleY, rx, ry, -Math.PI / 2, Math.PI / 2),
          ...arcPoints(
            left + rx,
            middleY,
            rx,
            ry,
            Math.PI / 2,
            Math.PI * 1.5,
          ).slice(0, -1),
        ],
        [arcPoints(right - rx, middleY, rx, ry, -Math.PI / 2, -Math.PI * 1.5)],
      );
    }
    case "sequential-data":
      return polygon(ellipseRing(width, height), [
        [
          [middleX, bottom],
          [right, bottom],
        ],
      ]);
    case "double-arrow": {
      const head = round(Math.min(width * 0.3, height, (width - 2) / 2));
      return polygon([
        [left, middleY],
        [left + head, top],
        [left + head, height * 0.3],
        [right - head, height * 0.3],
        [right - head, top],
        [right, middleY],
        [right - head, bottom],
        [right - head, height * 0.7],
        [left + head, height * 0.7],
        [left + head, bottom],
      ]);
    }
    case "right-triangle":
      return polygon([
        [left, top],
        [right, bottom],
        [left, bottom],
      ]);
    case "person":
      return polygon(personPoints(width, height));
    case "package": {
      // UML package: a name tab on the top-left above the body rectangle.
      const tabWidth = round(Math.min(width * 0.4, 96));
      const tabHeight = round(Math.min(height * 0.2, 18));
      return polygon(
        [
          [left, top],
          [left + tabWidth, top],
          [left + tabWidth, top + tabHeight],
          [right, top + tabHeight],
          [right, bottom],
          [left, bottom],
        ],
        [
          [
            [left, top + tabHeight],
            [left + tabWidth, top + tabHeight],
          ],
        ],
      );
    }
    default:
      return rectOutline(width, height);
  }
}
