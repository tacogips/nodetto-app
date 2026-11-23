import type { Element, ElementId, PageId } from "@nodetto/ir";
import { decodeNmesh, fromInline, NmeshError } from "@nodetto/nmesh";
import {
  cadFailure,
  createCadGeometry,
  type ExtrudeGeometry,
  isSketchEntity,
  scanCadPage,
} from "./history.ts";
import { coordinate, type Vec3 } from "./vec.ts";

export interface CadCheckReport {
  readonly pageId: PageId;
  readonly features: number;
  readonly entities: number;
  readonly errors: readonly { id: ElementId; code: string }[];
  /** Bounds of swept tool solids, including cuts and intersections. */
  readonly bounds: { min: Vec3; max: Vec3 } | null;
}

type MutableVec3 = [number, number, number];
const AXES = [0, 1, 2] as const;

function includeTool(
  { frame: { o, u, v, n }, span: { t0, t1 }, loops }: ExtrudeGeometry,
  min: MutableVec3,
  max: MutableVec3,
): void {
  for (const axis of AXES) {
    const origin = o[axis];
    const alongX = u[axis];
    const alongY = v[axis];
    let lower = origin;
    let upper = origin;
    // On a constant axis all profile vertices have the same projection.
    if (alongX !== 0 || alongY !== 0) {
      lower = Number.POSITIVE_INFINITY;
      upper = Number.NEGATIVE_INFINITY;
      for (const { points } of loops) {
        for (let i = 0; i < points.length; i += 2) {
          const base =
            origin +
            alongX * coordinate(points, i) +
            alongY * coordinate(points, i + 1);
          if (base < lower) lower = base;
          if (base > upper) upper = base;
        }
      }
    }
    // The same endpoint offsets apply to every vertex on this axis.
    const start = n[axis] * t0;
    const end = n[axis] * t1;
    min[axis] = Math.min(min[axis], lower + Math.min(start, end));
    max[axis] = Math.max(max[axis], upper + Math.max(start, end));
  }
}

export function checkCadPage(
  elements: readonly Element[],
  pageId: PageId,
): CadCheckReport {
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
  const report = visitCadConstruction(
    elements,
    pageId,
    (feature, tool) => {
      if (feature.type === "cad.extrude") includeTool(tool, min, max);
    },
    (_, data) => meshDecodes(data),
  );
  return {
    ...report,
    bounds: min[0] === Number.POSITIVE_INFINITY ? null : { min, max },
  };
}

/** A payload that passes the field check can still be corrupt inside. */
function meshDecodes(data: string): boolean {
  try {
    const { positions, triangles } = decodeNmesh(fromInline(data));
    return positions.length > 0 && triangles.length > 0;
  } catch (error) {
    if (!(error instanceof NmeshError)) throw error;
    return false;
  }
}

/**
 * Resolve each tool in history order, without triangulation or a kernel.
 * A mesh callback that returns false fails the mesh as `cad.mesh.invalid`.
 */
export function visitCadConstruction(
  elements: readonly Element[],
  pageId: PageId,
  onTool: (element: Element, geometry: ExtrudeGeometry) => void,
  onMesh?: (element: Element, data: string) => boolean,
): Omit<CadCheckReport, "bounds"> {
  const page = elements.filter((element) => element.page === pageId);
  const pcb = elements.filter(
    ({ page, type }) =>
      page !== pageId && (type === "pcb.board" || type === "pcb.graphic"),
  );
  const history = scanCadPage(pcb.length ? [...page, ...pcb] : page);
  const geometry = createCadGeometry(history);
  const status = new Map(history.status);
  const bodies = new Set<ElementId>();

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
      else geometry.frames.set(id, frame);
      continue;
    }
    if (feature.semantic.suppressed) continue;
    if (feature.type === "cad.mesh") {
      if (onMesh?.(feature, feature.semantic.data) === false)
        status.set(id, cadFailure("cad.mesh.invalid"));
      else bodies.add(id);
      continue;
    }
    if (feature.type === "cad.pcb") {
      const outline = geometry.pcb(feature.semantic);
      if ("ok" in outline) status.set(id, outline);
      else {
        geometry.extrudes.set(id, outline);
        onTool(feature, outline);
      }
      continue;
    }
    for (const target of targets) {
      if (bodies.has(target)) continue;
      const code =
        history.byId.get(target)?.type === "cad.mesh"
          ? "cad.body.missing"
          : "cad.reference.failed";
      status.set(id, cadFailure(code));
    }
    if (!status.get(id)?.ok) continue;
    const tool = geometry.extrude(feature.semantic);
    if ("ok" in tool) status.set(id, tool);
    else {
      geometry.extrudes.set(id, tool);
      if (feature.semantic.op === "new") bodies.add(id);
      onTool(feature, tool);
    }
  }

  const errors: { id: ElementId; code: string }[] = [];
  let entities = 0;
  for (const { id, type } of page) {
    if (isSketchEntity(type)) entities += 1;
    const result = status.get(id);
    if (result && !result.ok) errors.push({ id, code: result.code });
  }
  return {
    pageId,
    features: history.features.length,
    entities,
    errors,
  };
}
