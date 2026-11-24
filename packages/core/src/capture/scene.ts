import type { Element, ElementId, PageId } from "@nodetto/ir";
import {
  includeBounds,
  type MutableBounds3,
  pointBounds,
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
import type { CaptureMeshTool } from "./scene-binary.ts";

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
): readonly CadLoop[] {
  // Disjoint profiles already describe the same region by either rule.
  if (loops.every(({ depth }) => depth === 0)) return loops;
  const candidates = loops.map((loop) => ({ loop, ...loopBounds(loop) }));
  return loops.filter(({ points, depth }) => {
    if (depth === 0) return true;
    const x = coordinate(points, 0);
    const y = coordinate(points, 1);
    let ancestorDepth = -1;
    for (const { loop, minX, minY, maxX, maxY } of candidates) {
      if (
        loop.depth < depth &&
        loop.depth > ancestorDepth &&
        x >= minX &&
        x <= maxX &&
        y >= minY &&
        y <= maxY &&
        containsPoint(loop.points, x, y)
      ) {
        ancestorDepth = loop.depth;
        if (ancestorDepth === depth - 1) break;
      }
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

const toolBounds = ({ frame, t0, t1, loops }: CaptureTool) =>
  sweptBounds(frame, t0, t1, loops);

function makeTool(feature: ElementId, geometry: ExtrudeGeometry): CaptureTool {
  const bySource = new Map<ElementId, number>();
  const loops = normaliseToolLoops(geometry.loops).map(
    ({ points, sources }) => {
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
    },
  );
  return {
    kind: "prism",
    feature,
    frame: geometry.frame,
    ...geometry.span,
    loops,
  };
}

export function buildCadCaptureModel(
  elements: readonly Element[],
  pageId: PageId,
): Omit<CadCaptureModel, "tools"> & { readonly tools: readonly CaptureTool[] };
export function buildCadCaptureModel(
  elements: readonly Element[],
  pageId: PageId,
  options: { readonly decodeMesh?: CaptureMeshDecoder },
): CadCaptureModel;
export function buildCadCaptureModel(
  elements: readonly Element[],
  pageId: PageId,
  options?: { readonly decodeMesh?: CaptureMeshDecoder },
): CadCaptureModel {
  const tools: (CaptureTool | CaptureMeshTool)[] = [];
  const bodies: BuildingBody[] = [];
  // Hidden bodies are valid targets but have no geometry in a capture.
  const visible = new Map<ElementId, BuildingBody>();
  const skipped: { id: ElementId; reason: "mesh" }[] = [];
  let sketches = 0;

  /** Register a tool as a new body, unless the feature is hidden. */
  function addBody(
    feature: { id: ElementId; visual: { hidden?: boolean } },
    name: string,
    reference: boolean,
    tool: CaptureTool | CaptureMeshTool,
    bounds: MutableBounds3,
  ): void {
    const step: CaptureStep = { op: "union", tool: tools.length };
    tools.push(tool);
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
    mesh(feature) {
      const { id, semantic } = feature;
      if (!options?.decodeMesh) {
        skipped.push({ id, reason: "mesh" });
        return true;
      }
      let positions: Float64Array;
      let triangles: Uint32Array;
      try {
        const decoded = options.decodeMesh(semantic.data);
        positions = new Float64Array(decoded.positions);
        triangles = new Uint32Array(decoded.triangles);
      } catch {
        return false;
      }
      // An empty mesh has no bounds; as a body it would make the whole
      // page impossible to frame. The app rejects it as well.
      if (triangles.length === 0 || positions.length === 0) return false;
      addBody(
        feature,
        semantic.name,
        false,
        { kind: "mesh", feature: id, positions, triangles },
        pointBounds(positions),
      );
      return true;
    },
    tool(feature, geometry, targets) {
      // The walk keeps the original loops for later face references, even
      // for a loop omitted from the capture tool.
      const tool = makeTool(feature.id, geometry);
      if (feature.type === "cad.pcb" || feature.semantic.op === "new") {
        const reference = feature.type === "cad.pcb";
        addBody(
          feature,
          feature.semantic.name,
          reference,
          tool,
          toolBounds(tool),
        );
        return;
      }
      const step: CaptureStep = {
        op: STEP_OPS[feature.semantic.op],
        tool: tools.length,
      };
      tools.push(tool);
      const added = step.op === "union" ? toolBounds(tool) : undefined;
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
  return { tools, bodies, errors, bounds, sketches, skipped };
}
