import type { Element, PageId } from "@nodetto/ir";
import { decodeNmesh, fromInline, NmeshError } from "@nodetto/nmesh";
import {
  emptyBounds,
  includeBounds,
  isEmptyBounds,
  sweptBounds,
} from "./bounds.ts";
import {
  type CadConstructionReport,
  visitCadConstruction,
} from "./construction.ts";
import type { Vec3 } from "./vec.ts";

export interface CadCheckReport extends CadConstructionReport {
  /** Bounds of swept tool solids, including cuts and intersections. */
  readonly bounds: { min: Vec3; max: Vec3 } | null;
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

export function checkCadPage(
  elements: readonly Element[],
  pageId: PageId,
): CadCheckReport {
  const bounds = emptyBounds();
  const report = visitCadConstruction(elements, pageId, {
    tool(feature, { frame, span: { t0, t1 }, loops }) {
      if (feature.type === "cad.extrude")
        includeBounds(bounds, sweptBounds(frame, t0, t1, loops));
    },
    mesh: ({ semantic }) => meshDecodes(semantic.data),
  });
  return { ...report, bounds: isEmptyBounds(bounds) ? null : bounds };
}
