import { decodeNmesh, fromInline, NmeshError } from "@nodetto/nmesh";
import type { Element, PageId } from "@nodetto/ir";
import { pointBounds } from "./bounds.ts";
import { visitCadConstruction } from "./construction.ts";
import { toWorld } from "./frames.ts";
import { coordinate, type Vec3 } from "./vec.ts";

type Point = readonly [number, number];

export interface CadWireframe {
  readonly segments: Float64Array;
  readonly bounds: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  } | null;
}

// biome-ignore lint/suspicious/noApproximativeNumericConstant: the export projection pins its coefficients.
const ISO_X = 0.7071067811865476;
const ISO_Y = 0.408248290463863;
const ISO_Z = 0.816496580927726;

function project([x, y, z]: Vec3): Point {
  return [(x - y) * ISO_X, (x + y) * ISO_Y - z * ISO_Z];
}

type MeshBounds = { readonly min: Vec3; readonly max: Vec3 };
interface WireframeOptions {
  readonly meshBounds?: (data: string) => MeshBounds | null;
  readonly stats?: { decodes: number };
}

function meshCorners(data: string, options: WireframeOptions): Point[] | null {
  try {
    let bounds: MeshBounds | null;
    if (options.meshBounds) {
      try {
        bounds = options.meshBounds(data);
      } catch {
        return null;
      }
    } else {
      if (options.stats) options.stats.decodes++;
      const { positions, triangles } = decodeNmesh(fromInline(data));
      if (!positions.length || !triangles.length) return null;
      const { min, max } = pointBounds(positions);
      bounds = {
        min: [min[0] / 1000, min[1] / 1000, min[2] / 1000],
        max: [max[0] / 1000, max[1] / 1000, max[2] / 1000],
      };
    }
    if (!bounds) return null;
    const { min, max } = bounds;
    return Array.from({ length: 8 }, (_, i) =>
      project([
        i & 1 ? max[0] : min[0],
        i & 2 ? max[1] : min[1],
        i & 4 ? max[2] : min[2],
      ]),
    );
  } catch (error) {
    if (!(error instanceof NmeshError)) throw error;
    return null;
  }
}

export function cadPageWireframe(
  elements: readonly Element[],
  pageId: PageId,
  options: WireframeOptions = {},
): CadWireframe {
  const segments: number[] = [];
  const seen = new Set<string>();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  function add(a: Point, b: Point): void {
    const left = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
    const [x1, y1] = left ? a : b;
    const [x2, y2] = left ? b : a;
    if (x1 === x2 && y1 === y2) return;
    const key = `${x1},${y1},${x2},${y2}`;
    if (seen.has(key)) return;
    seen.add(key);
    segments.push(x1, y1, x2, y2);
    minX = Math.min(minX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxX = Math.max(maxX, x1, x2);
    maxY = Math.max(maxY, y1, y2);
  }

  visitCadConstruction(elements, pageId, {
    tool(_, { frame, span: { t0, t1 }, loops }) {
      for (const { points, sources } of loops) {
        const caps = Array.from({ length: sources.length }, (_, i) => {
          const point: Point = [
            coordinate(points, i * 2),
            coordinate(points, i * 2 + 1),
          ];
          return {
            start: project(toWorld(frame, point, t0)),
            end: project(toWorld(frame, point, t1)),
          };
        });
        for (const [i, { start, end }] of caps.entries()) {
          const nextIndex = (i + 1) % caps.length;
          const next = caps[nextIndex];
          if (!next) continue;
          add(start, next.start);
          add(end, next.end);
          if (sources[i] !== sources[nextIndex]) add(next.start, next.end);
        }
      }
    },
    mesh({ semantic }) {
      const corners = meshCorners(semantic.data, options);
      if (!corners) return false;
      for (const [i, start] of corners.entries()) {
        for (const axis of [1, 2, 4]) {
          const end = corners[i | axis];
          if (end && !(i & axis)) add(start, end);
        }
      }
      return true;
    },
  });
  return {
    segments: Float64Array.from(segments),
    bounds: segments.length ? { minX, minY, maxX, maxY } : null,
  };
}
