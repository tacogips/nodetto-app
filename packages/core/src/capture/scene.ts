import type { Element, ElementId, PageId } from "@nodetto/ir";
import {
  includeBounds,
  type MutableBounds3,
  sweptBounds,
} from "../cad/bounds.ts";
import { visitCadConstruction } from "../cad/construction.ts";
import type { CadFrame } from "../cad/frames.ts";
import type { ExtrudeGeometry } from "../cad/history.ts";
import type { CadLoop } from "../cad/loops.ts";
import { coordinate } from "../cad/vec.ts";
import { compareFractional } from "../fractional.ts";
import type { Bounds3 } from "./camera.ts";
import type { CaptureMeshDecoder } from "./cad-request.ts";
import {
  chargeTool,
  MAX_POINTS,
  type CaptureMeshTool,
} from "./scene-binary.ts";

export interface CaptureTool {
  readonly kind: "prism";
  readonly feature: ElementId;
  readonly frame: CadFrame;
  readonly t0: number;
  readonly t1: number;
  readonly loops: readonly {
    readonly points: Float64Array;
    readonly faces: Uint32Array;
  }[];
}

interface CaptureStep {
  readonly op: "union" | "difference" | "intersection";
  readonly tool: number;
}

export interface CaptureBody {
  readonly id: ElementId;
  readonly name: string;
  readonly reference: boolean;
  readonly steps: readonly CaptureStep[];
  readonly bounds: Bounds3;
}

export interface CadCaptureModel {
  readonly tools: readonly (CaptureTool | CaptureMeshTool)[];
  readonly toolCount: number;
  readonly overLimit?: string;
  readonly bodies: readonly CaptureBody[];
  readonly errors: readonly { id: ElementId; code: string }[];
  readonly bounds: Bounds3 | null;
  readonly sketches: number;
  readonly skipped: readonly { id: ElementId; reason: "mesh" }[];
}

function loopBounds({ points }: CadLoop) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < points.length; i += 2) {
    const x = coordinate(points, i);
    const y = coordinate(points, i + 1);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function containsPoint(
  points: readonly number[],
  x: number,
  y: number,
): boolean {
  let inside = false;
  let ax = coordinate(points, points.length - 2);
  let ay = coordinate(points, points.length - 1);
  for (let i = 0; i < points.length; i += 2) {
    const bx = coordinate(points, i);
    const by = coordinate(points, i + 1);
    if (ay > y !== by > y && x < ax + ((bx - ax) * (y - ay)) / (by - ay))
      inside = !inside;
    ax = bx;
    ay = by;
  }
  return inside;
}

/** Keep a loop when its parity differs from its nearest selected ancestor's.
 * A loop with no selected ancestor is kept only at an even depth.
 */
export function normaliseToolLoops(
  loops: readonly CadLoop[],
  stats?: { ancestorProbes: number },
): readonly CadLoop[] {
  // Disjoint profiles already describe the same region by either rule.
  if (loops.every(({ depth }) => depth === 0)) return loops;
  const buckets = new Map<
    number,
    { loop: CadLoop; minX: number; minY: number; maxX: number; maxY: number }[]
  >();
  for (const loop of loops) {
    const bucket = buckets.get(loop.depth) ?? [];
    bucket.push({ loop, ...loopBounds(loop) });
    buckets.set(loop.depth, bucket);
  }
  return loops.filter(({ points, depth }) => {
    if (depth === 0) return true;
    const x = coordinate(points, 0);
    const y = coordinate(points, 1);
    let ancestorDepth = -1;
    for (let k = depth - 1; k >= 0; k -= 1) {
      for (const { loop, minX, minY, maxX, maxY } of buckets.get(k) ?? []) {
        if (stats) stats.ancestorProbes += 1;
        if (
          x >= minX &&
          x <= maxX &&
          y >= minY &&
          y <= maxY &&
          containsPoint(loop.points, x, y)
        ) {
          ancestorDepth = k;
          break;
        }
      }
      if (ancestorDepth !== -1) break;
    }
    return (depth - ancestorDepth) % 2 === 1;
  });
}

type BuildingBody = Omit<CaptureBody, "steps" | "bounds"> & {
  steps: CaptureStep[];
  bounds: MutableBounds3;
};

const STEP_OPS = {
  add: "union",
  cut: "difference",
  intersect: "intersection",
} as const;

function makeTool(
  feature: ElementId,
  geometry: ExtrudeGeometry,
  normalized: readonly CadLoop[],
): CaptureTool {
  const bySource = new Map<ElementId, number>();
  const loops = normalized.map(({ points, sources }) => {
    const faces = new Uint32Array(sources.length);
    let i = 0;
    for (const source of sources) {
      let face = bySource.get(source);
      if (face === undefined) {
        face = 2 + bySource.size;
        bySource.set(source, face);
      }
      faces[i] = face;
      i += 1;
    }
    return { points: new Float64Array(points), faces };
  });
  return {
    kind: "prism",
    feature,
    frame: geometry.frame,
    ...geometry.span,
    loops,
  };
}

export interface CaptureWalkStats {
  captureVisits: number;
  toolArrays: number;
  metadataVisits: number;
}

export function buildCadCaptureModel(
  elements: readonly Element[],
  pageId: PageId,
): Omit<CadCaptureModel, "tools"> & { readonly tools: readonly CaptureTool[] };
export function buildCadCaptureModel(
  elements: readonly Element[],
  pageId: PageId,
  options: {
    readonly decodeMesh?: CaptureMeshDecoder;
    readonly stats?: CaptureWalkStats;
  },
): CadCaptureModel;
export function buildCadCaptureModel(
  elements: readonly Element[],
  pageId: PageId,
  options?: {
    readonly decodeMesh?: CaptureMeshDecoder;
    readonly stats?: CaptureWalkStats;
  },
): CadCaptureModel {
  const tools: (CaptureTool | CaptureMeshTool)[] = [];
  const bodies: BuildingBody[] = [];
  // Hidden bodies are valid targets but have no geometry in a capture.
  const visible = new Map<ElementId, BuildingBody>();
  const skipped: { id: ElementId; reason: "mesh" }[] = [];
  let sketches = 0;
  let toolCount = 0;
  let overLimit: string | undefined;
  const charge = { points: 0 };
  const stats = options?.stats;

  /** Register a tool as a new body, unless the feature is hidden. */
  function addBody(
    feature: { id: ElementId; visual: { hidden?: boolean } },
    name: string,
    reference: boolean,
    tool: CaptureTool | CaptureMeshTool | undefined,
    bounds: MutableBounds3,
  ): void {
    const step: CaptureStep = { op: "union", tool: toolCount++ };
    if (tool) tools.push(tool);
    if (feature.visual.hidden) return;
    const body = { id: feature.id, name, reference, steps: [step], bounds };
    bodies.push(body);
    // A reference body is drawn but can never be a boolean target.
    if (!reference) visible.set(feature.id, body);
  }

  const report = visitCadConstruction(elements, pageId, {
    sketch() {
      sketches += 1;
    },
    mesh(feature, info) {
      const { id, semantic } = feature;
      if (!options?.decodeMesh) {
        skipped.push({ id, reason: "mesh" });
        return true;
      }
      let decoded: ReturnType<CaptureMeshDecoder>;
      try {
        decoded = options.decodeMesh(semantic.data, {
          maxVertices: overLimit ? 0 : MAX_POINTS - charge.points,
          needTarget: info.targeted,
        });
      } catch {
        return false;
      }
      const { positions, triangles, bounds, vertexCount, triangleCount } =
        decoded;
      if (!vertexCount || !triangleCount || !bounds) return false;
      if (
        !overLimit &&
        vertexCount <= MAX_POINTS - charge.points &&
        (!positions || !triangles)
      )
        return false;
      if (!overLimit) {
        if (stats) stats.captureVisits++;
        overLimit = chargeTool(charge, {
          kind: "mesh",
          vertices: vertexCount,
          triangles: triangleCount,
        });
      } else if (stats) stats.metadataVisits++;
      if (!overLimit && (!positions || !triangles)) return false;
      const tool =
        !overLimit && positions && triangles
          ? { kind: "mesh" as const, feature: id, positions, triangles }
          : undefined;
      if (tool && stats) stats.toolArrays++;
      addBody(feature, semantic.name, false, tool, {
        min: [...bounds.min],
        max: [...bounds.max],
      });
      return info.targeted && decoded.booleanTarget === false
        ? "display-only"
        : true;
    },
    tool(feature, geometry, targets) {
      // The walk keeps the original loops for later face references, even
      // for a loop omitted from the capture tool.
      const loops = normaliseToolLoops(geometry.loops);
      if (!overLimit) {
        if (stats) stats.captureVisits++;
        overLimit = chargeTool(charge, {
          kind: "prism",
          loopCounts: loops.map(({ points }) => points.length / 2),
        });
      } else if (stats) stats.metadataVisits++;
      const tool = overLimit
        ? undefined
        : makeTool(feature.id, geometry, loops);
      if (tool && stats) stats.toolArrays++;
      const bounds = sweptBounds(
        geometry.frame,
        geometry.span.t0,
        geometry.span.t1,
        loops,
      );
      if (feature.type === "cad.pcb" || feature.semantic.op === "new") {
        const reference = feature.type === "cad.pcb";
        addBody(feature, feature.semantic.name, reference, tool, bounds);
        return;
      }
      const step: CaptureStep = {
        op: STEP_OPS[feature.semantic.op],
        tool: toolCount++,
      };
      if (tool) tools.push(tool);
      const added = step.op === "union" ? bounds : undefined;
      for (const target of targets) {
        const body = visible.get(target);
        if (!body) continue;
        body.steps.push(step);
        if (added) includeBounds(body.bounds, added);
      }
    },
  });

  let bounds: MutableBounds3 | null = null;
  for (const body of bodies) {
    if (bounds === null)
      bounds = { min: [...body.bounds.min], max: [...body.bounds.max] };
    else includeBounds(bounds, body.bounds);
  }
  const errors = [...report.errors].sort((a, b) =>
    compareFractional(a.id, b.id),
  );
  return {
    tools,
    toolCount,
    overLimit,
    bodies,
    errors,
    bounds,
    sketches,
    skipped,
  };
}
