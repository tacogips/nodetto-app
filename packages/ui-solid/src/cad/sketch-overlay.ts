import {
  type CadFrame,
  tessellateArc,
  tessellateCircle,
  toWorld,
  type Vec3,
} from "@nodetto/core";
import {
  type CadArcSemantic,
  type CadCircleSemantic,
  type CadLineSemantic,
  type CadXY,
  type Element,
  type ElementId,
  getElementTypeDefinition,
} from "@nodetto/ir";
import type { SketchState } from "./sketch-interaction.ts";
import { sketchCoordinates } from "./sketch-snap.ts";

export function sketchGeometry(element: Element): {
  points: readonly number[];
  endpoints: readonly CadXY[];
  closed: boolean;
  construction: boolean;
} | null {
  if (
    getElementTypeDefinition(element.type)?.validateSemantic(
      element.semantic,
      "semantic",
    ).length !== 0
  )
    return null;
  switch (element.type) {
    case "cad.line": {
      const {
        a,
        b,
        construction = false,
      } = element.semantic as CadLineSemantic;
      return {
        points: [...a, ...b],
        endpoints: [a, b],
        closed: false,
        construction,
      };
    }
    case "cad.circle": {
      const {
        c,
        r,
        construction = false,
      } = element.semantic as CadCircleSemantic;
      if (r > 10_000) return null;
      return {
        points: tessellateCircle(c, r),
        endpoints: [],
        closed: true,
        construction,
      };
    }
    case "cad.arc": {
      const {
        a,
        m,
        b,
        construction = false,
      } = element.semantic as CadArcSemantic;
      const points = tessellateArc(a, m, b);
      return (
        points && { points, endpoints: [a, b], closed: false, construction }
      );
    }
    default:
      return null;
  }
}

function appendPath(
  lines: number[],
  frame: CadFrame,
  points: readonly number[],
  closed: boolean,
  dashed = false,
): void {
  if (points.length < 4) return;
  const firstX = points[0];
  const firstY = points[1];
  if (firstX === undefined || firstY === undefined) return;
  const first = toWorld(frame, [firstX, firstY]);
  let previous = first;
  let phase = 0;
  for (let i = 2; i <= points.length - (closed ? 0 : 2); i += 2) {
    const x = points[i];
    const y = points[i + 1];
    if (i !== points.length && (x === undefined || y === undefined)) break;
    const next = i === points.length ? first : toWorld(frame, [x ?? 0, y ?? 0]);
    if (dashed) {
      phase = appendDashes(lines, previous, next, phase);
    } else {
      lines.push(...previous, ...next);
    }
    previous = next;
  }
}

function appendDashes(
  lines: number[],
  a: Vec3,
  b: Vec3,
  phase: number,
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  if (length === 0) return phase;
  // Keep very long construction lines bounded, retaining continuous dashes
  // across adjoining short chords on circles and arcs.
  const period = Math.max(2, length / 128);
  const dash = period * 0.6;
  for (let start = -phase; start < length; start += period) {
    const from = Math.max(0, start) / length;
    const to = Math.min(length, start + dash) / length;
    if (to <= from) continue;
    lines.push(
      a[0] + dx * from,
      a[1] + dy * from,
      a[2] + dz * from,
      a[0] + dx * to,
      a[1] + dy * to,
      a[2] + dz * to,
    );
  }
  return (phase + length) % period;
}

export function sketchOverlaySegments(
  frame: CadFrame,
  entities: readonly Element[],
  preview?: readonly number[],
): Float32Array {
  const lines: number[] = [];
  for (const entity of entities) {
    const geometry = sketchGeometry(entity);
    if (geometry)
      appendPath(
        lines,
        frame,
        geometry.points,
        geometry.closed,
        geometry.construction,
      );
  }
  if (preview) appendPath(lines, frame, preview, false);
  return new Float32Array(lines);
}

export function sketchPreview(
  state: SketchState,
): readonly number[] | undefined {
  const { hover, points, tool } = state;
  const first = points[0];
  if (!first || !hover) return undefined;
  switch (tool) {
    case "cad:line":
      return [...(points.at(-1) ?? first), ...hover];
    case "cad:rect":
      return [
        ...first,
        hover[0],
        first[1],
        ...hover,
        first[0],
        hover[1],
        ...first,
      ];
    case "cad:circle": {
      const r = Math.hypot(hover[0] - first[0], hover[1] - first[1]);
      const polygon = r > 0 ? tessellateCircle(first, r) : [];
      return [...polygon, ...polygon.slice(0, 2)];
    }
    case "cad:arc": {
      const end = points[1];
      return end
        ? (tessellateArc(first, hover, end) ?? [...first, ...end])
        : [...first, ...hover];
    }
  }
}

export function sketchGridSegments(
  frame: CadFrame,
  target: Vec3,
  widthMm: number,
  heightMm: number,
): Float32Array {
  const lines: number[] = [];
  const [x, y] = sketchCoordinates(frame, target);
  const step = Math.max(
    0.1,
    10 ** Math.ceil(Math.log10(Math.max(widthMm, heightMm) / 45)),
  );
  const minX = x - widthMm / 2;
  const maxX = x + widthMm / 2;
  const minY = y - heightMm / 2;
  const maxY = y + heightMm / 2;
  for (let i = Math.ceil(minX / step); i <= Math.floor(maxX / step); i++)
    lines.push(
      ...toWorld(frame, [i * step, minY]),
      ...toWorld(frame, [i * step, maxY]),
    );
  for (let i = Math.ceil(minY / step); i <= Math.floor(maxY / step); i++)
    lines.push(
      ...toWorld(frame, [minX, i * step]),
      ...toWorld(frame, [maxX, i * step]),
    );
  return new Float32Array(lines);
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
}

function project(
  matrix: Float32Array,
  x: number,
  y: number,
  z: number,
): ProjectedPoint | null {
  if (matrix.length < 16) return null;
  const w =
    (matrix[3] ?? Number.NaN) * x +
    (matrix[7] ?? Number.NaN) * y +
    (matrix[11] ?? Number.NaN) * z +
    (matrix[15] ?? Number.NaN);
  if (w <= 0) return null;
  return {
    x:
      ((matrix[0] ?? Number.NaN) * x +
        (matrix[4] ?? Number.NaN) * y +
        (matrix[8] ?? Number.NaN) * z +
        (matrix[12] ?? Number.NaN)) /
      w,
    y:
      ((matrix[1] ?? Number.NaN) * x +
        (matrix[5] ?? Number.NaN) * y +
        (matrix[9] ?? Number.NaN) * z +
        (matrix[13] ?? Number.NaN)) /
      w,
    depth:
      ((matrix[2] ?? Number.NaN) * x +
        (matrix[6] ?? Number.NaN) * y +
        (matrix[10] ?? Number.NaN) * z +
        (matrix[14] ?? Number.NaN)) /
      w,
  };
}

export function pickSketchEntity(
  entities: readonly {
    id: ElementId;
    sketch: ElementId;
    segments: Float32Array;
  }[],
  matrix: Float32Array,
  x: number,
  y: number,
  width: number,
  height: number,
  bodyPoint?: Vec3,
  selectedSketch?: ElementId,
): ElementId | null {
  const bodyDepth = bodyPoint
    ? project(matrix, ...bodyPoint)?.depth
    : undefined;
  let closest = 6 * 6;
  let nearest = Number.POSITIVE_INFINITY;
  let found: ElementId | null = null;
  for (const { id, sketch, segments } of entities) {
    // A face gets the click on coplanar contours unless the user was
    // already working with that sketch.
    const limit =
      bodyDepth === undefined
        ? 1
        : bodyDepth + (sketch === selectedSketch ? 1e-6 : -1e-6);
    for (let i = 0; i < segments.length; i += 6) {
      const ax = segments[i];
      const ay = segments[i + 1];
      const az = segments[i + 2];
      const bx = segments[i + 3];
      const by = segments[i + 4];
      const bz = segments[i + 5];
      if (
        ax === undefined ||
        ay === undefined ||
        az === undefined ||
        bx === undefined ||
        by === undefined ||
        bz === undefined
      )
        continue;
      const a = project(matrix, ax, ay, az);
      const b = project(matrix, bx, by, bz);
      if (!a || !b) continue;
      const screenX = ((a.x - x) * width) / 2;
      const screenY = ((a.y - y) * height) / 2;
      const dx = ((b.x - a.x) * width) / 2;
      const dy = ((b.y - a.y) * height) / 2;
      const length = dx * dx + dy * dy;
      const t = length
        ? Math.max(0, Math.min(1, -(screenX * dx + screenY * dy) / length))
        : 0;
      const distance = (screenX + t * dx) ** 2 + (screenY + t * dy) ** 2;
      const depth = a.depth + t * (b.depth - a.depth);
      if (
        depth < -1 ||
        depth > 1 ||
        depth > limit ||
        distance > closest ||
        (distance === closest && depth >= nearest)
      )
        continue;
      closest = distance;
      nearest = depth;
      found = id;
    }
  }
  return found;
}
