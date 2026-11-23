import type { Element, ElementId, PageId } from "@nodetto/ir";
import type { CadFrame } from "../cad/frames.ts";
import {
  cadFailure,
  createCadGeometry,
  type ExtrudeGeometry,
  scanCadPage,
} from "../cad/history.ts";
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

type MutableVec3 = [number, number, number];
type MutableBounds = { min: MutableVec3; max: MutableVec3 };
type BuildingBody = Omit<CaptureBody, "steps" | "bounds"> & {
  steps: CaptureStep[];
  bounds: MutableBounds;
};

const AXES = [0, 1, 2] as const;

function sweepBounds({
  frame: { o, u, v, n },
  t0,
  t1,
  loops,
}: CaptureTool): MutableBounds {
  const min: MutableVec3 = [0, 0, 0];
  const max: MutableVec3 = [0, 0, 0];
  for (const axis of AXES) {
    let lower = o[axis];
    let upper = o[axis];
    if (u[axis] !== 0 || v[axis] !== 0) {
      lower = Number.POSITIVE_INFINITY;
      upper = Number.NEGATIVE_INFINITY;
      for (const { points } of loops) {
        for (let i = 0; i < points.length; i += 2) {
          const base =
            o[axis] +
            u[axis] * coordinate(points, i) +
            v[axis] * coordinate(points, i + 1);
          lower = Math.min(lower, base);
          upper = Math.max(upper, base);
        }
      }
    }
    const start = n[axis] * t0;
    const end = n[axis] * t1;
    min[axis] = lower + Math.min(start, end);
    max[axis] = upper + Math.max(start, end);
  }
  return { min, max };
}

function includeBounds(box: MutableBounds, { min, max }: Bounds3): void {
  for (const axis of AXES) {
    box.min[axis] = Math.min(box.min[axis], min[axis]);
    box.max[axis] = Math.max(box.max[axis], max[axis]);
  }
}

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
  const page: Element[] = [];
  const pcb: Element[] = [];
  for (const element of elements) {
    if (element.page === pageId) page.push(element);
    else if (element.type === "pcb.board" || element.type === "pcb.graphic")
      pcb.push(element);
  }
  const history = scanCadPage(pcb.length ? [...page, ...pcb] : page);
  const geometry = createCadGeometry(history);
  const status = new Map(history.status);
  const tools: (CaptureTool | CaptureMeshTool)[] = [];
  const bodies: BuildingBody[] = [];
  // A null body is valid for cad check but has no geometry in this capture.
  const targetsById = new Map<ElementId, BuildingBody | null>();
  const skipped: { id: ElementId; reason: "mesh" }[] = [];
  let sketches = 0;

  // Follow checkCadPage's validation order, including dependencies of
  // suppressed features and targets whose creators did not produce a body.
  for (const { id } of history.features) {
    if (!status.get(id)?.ok) continue;
    const feature = history.typed.get(id);
    if (!feature) continue;
    const failed = history.dependencies
      .get(id)
      ?.find((ref) => !status.get(ref)?.ok);
    const targets = history.targets.get(id) ?? [];
    if (failed !== undefined) {
      const code =
        targets.includes(failed) &&
        history.byId.get(failed)?.type === "cad.mesh"
          ? "cad.body.missing"
          : "cad.reference.failed";
      status.set(id, cadFailure(code));
      continue;
    }
    if (feature.type === "cad.sketch") {
      const frame = geometry.sketch(feature.semantic.plane);
      if ("ok" in frame) status.set(id, frame);
      else {
        geometry.frames.set(id, frame);
        sketches += 1;
      }
      continue;
    }
    if (feature.semantic.suppressed) continue;
    if (feature.type === "cad.mesh") {
      if (!options?.decodeMesh) {
        targetsById.set(id, null);
        skipped.push({ id, reason: "mesh" });
        continue;
      }
      try {
        const decoded = options.decodeMesh(feature.semantic.data);
        const positions = new Float64Array(decoded.positions);
        const triangles = new Uint32Array(decoded.triangles);
        const min: MutableVec3 = [
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
        ];
        const max: MutableVec3 = [
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
        ];
        for (let i = 0; i < positions.length; i += 3) {
          for (const axis of AXES) {
            const value = coordinate(positions, i + axis);
            min[axis] = Math.min(min[axis], value);
            max[axis] = Math.max(max[axis], value);
          }
        }
        const toolIndex = tools.length;
        tools.push({ kind: "mesh", feature: id, positions, triangles });
        const body: BuildingBody | null = feature.visual.hidden
          ? null
          : {
              id,
              name: feature.semantic.name,
              reference: false,
              steps: [{ op: "union", tool: toolIndex }],
              bounds: { min, max },
            };
        if (body) bodies.push(body);
        targetsById.set(id, body);
      } catch {
        status.set(id, cadFailure("cad.mesh.invalid"));
      }
      continue;
    }
    for (const target of targets) {
      if (targetsById.has(target)) continue;
      const code =
        history.byId.get(target)?.type === "cad.mesh"
          ? "cad.body.missing"
          : "cad.reference.failed";
      status.set(id, cadFailure(code));
    }
    if (!status.get(id)?.ok) continue;
    const prism =
      feature.type === "cad.pcb"
        ? geometry.pcb(feature.semantic)
        : geometry.extrude(feature.semantic);
    if ("ok" in prism) {
      status.set(id, prism);
      continue;
    }
    // Keep original loops here so later face references use the same
    // geometry as cad check, even for a loop omitted from a capture tool.
    geometry.extrudes.set(id, prism);
    const tool = makeTool(id, prism);
    const toolIndex = tools.length;
    tools.push(tool);

    const op = feature.type === "cad.pcb" ? "new" : feature.semantic.op;
    if (op === "new") {
      const reference = feature.type === "cad.pcb";
      const body: BuildingBody | null = feature.visual.hidden
        ? null
        : {
            id,
            name: feature.semantic.name,
            reference,
            steps: [{ op: "union", tool: toolIndex }],
            bounds: sweepBounds(tool),
          };
      if (body) bodies.push(body);
      if (!reference) targetsById.set(id, body);
      continue;
    }
    const step: CaptureStep = {
      op: op === "add" ? "union" : op === "cut" ? "difference" : "intersection",
      tool: toolIndex,
    };
    for (const target of targets) {
      const body = targetsById.get(target);
      if (!body) continue;
      body.steps.push(step);
      if (step.op === "union") includeBounds(body.bounds, sweepBounds(tool));
    }
  }

  let bounds: MutableBounds | null = null;
  for (const body of bodies) {
    if (bounds === null)
      bounds = { min: [...body.bounds.min], max: [...body.bounds.max] };
    else includeBounds(bounds, body.bounds);
  }
  const errors: { id: ElementId; code: string }[] = [];
  for (const { id } of page) {
    const result = status.get(id);
    if (result && !result.ok) errors.push({ id, code: result.code });
  }
  errors.sort((a, b) => compareFractional(a.id, b.id));
  return { tools, bodies, errors, bounds, sketches, skipped };
}
