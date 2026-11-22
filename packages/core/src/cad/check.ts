import type { Element, ElementId, PageId } from "@nodetto/ir";
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
    for (const { points } of loops) {
      for (let i = 0; i < points.length; i += 2) {
        const x = coordinate(points, i);
        const y = coordinate(points, i + 1);
        const base = o[axis] + u[axis] * x + v[axis] * y;
        const start = base + n[axis] * t0;
        const end = base + n[axis] * t1;
        min[axis] = Math.min(min[axis], start, end);
        max[axis] = Math.max(max[axis], start, end);
      }
    }
  }
}

export function checkCadPage(
  elements: readonly Element[],
  pageId: PageId,
): CadCheckReport {
  const page = elements.filter((element) => element.page === pageId);
  const history = scanCadPage(page);
  const geometry = createCadGeometry(history);
  const status = new Map(history.status);
  const bodies = new Set<ElementId>();
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

  for (const { id } of history.features) {
    if (!status.get(id)?.ok) continue;
    const feature = history.typed.get(id);
    if (!feature) continue;
    const failed = history.dependencies
      .get(id)
      ?.find((ref) => !status.get(ref)?.ok);
    const targets = history.targets.get(id) ?? [];
    const missing = failed ?? targets.find((target) => !bodies.has(target));
    if (missing !== undefined) {
      const code =
        targets.includes(missing) &&
        history.byId.get(missing)?.type === "cad.mesh"
          ? "cad.body.missing"
          : "cad.reference.failed";
      status.set(id, cadFailure(code));
      continue;
    }
    if (feature.type === "cad.sketch") {
      const frame = geometry.sketch(feature.semantic.plane);
      if ("ok" in frame) status.set(id, frame);
      else geometry.frames.set(id, frame);
    } else if (!feature.semantic.suppressed) {
      if (feature.type === "cad.mesh") {
        bodies.add(id);
        continue;
      }
      const tool = geometry.extrude(feature.semantic);
      if ("ok" in tool) status.set(id, tool);
      else {
        geometry.extrudes.set(id, tool);
        if (feature.semantic.op === "new") bodies.add(id);
        includeTool(tool, min, max);
      }
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
    bounds: min[0] === Number.POSITIVE_INFINITY ? null : { min, max },
  };
}
