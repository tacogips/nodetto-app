import type { Element, ElementId, PageId } from "@nodetto/ir";
import {
  type CadFeature,
  type CadGeometryStats,
  cadFailure,
  createCadGeometry,
  type ExtrudeGeometry,
  isSketchEntity,
  scanCadPage,
} from "./history.ts";

type FeatureOf<T extends CadFeature["type"]> = Extract<CadFeature, { type: T }>;

/** Callbacks for the features of a page that pass every structural check. */
export interface CadConstructionVisitor {
  /** A sketch whose plane resolved. */
  sketch?(feature: FeatureOf<"cad.sketch">): void;
  /** A swept tool solid and the existing bodies it applies to. */
  tool(
    feature: FeatureOf<"cad.extrude" | "cad.pcb">,
    geometry: ExtrudeGeometry,
    targets: readonly ElementId[],
  ): void;
  /** An imported mesh. Returning false fails it as `cad.mesh.invalid`. */
  mesh?(feature: FeatureOf<"cad.mesh">): boolean;
}

export interface CadConstructionReport {
  readonly pageId: PageId;
  readonly features: number;
  readonly entities: number;
  /** In document order. */
  readonly errors: readonly { id: ElementId; code: string }[];
}

/**
 * Resolve each feature in history order, without triangulation or a kernel.
 * `cad check`, the wireframe export and the capture scene all read a page
 * through this one walk, so they agree on which features exist and fail.
 */
export function visitCadConstruction(
  elements: readonly Element[],
  pageId: PageId,
  visitor: CadConstructionVisitor,
  stats?: CadGeometryStats,
): CadConstructionReport {
  const page: Element[] = [];
  const pcb: Element[] = [];
  for (const element of elements) {
    if (element.page === pageId) page.push(element);
    else if (element.type === "pcb.board" || element.type === "pcb.graphic")
      pcb.push(element);
  }
  const history = scanCadPage(pcb.length ? [...page, ...pcb] : page);
  const referenced = new Set<ElementId>();
  for (const feature of history.typed.values()) {
    if (feature.type !== "cad.sketch" || !("face" in feature.semantic.plane))
      continue;
    const id = feature.semantic.plane.face?.feature;
    if (id !== undefined && history.dependencies.get(feature.id)?.includes(id))
      referenced.add(id);
  }
  const geometry = createCadGeometry(history, stats);
  const status = new Map(history.status);
  const bodies = new Set<ElementId>();
  const missingTarget = (target: ElementId) =>
    cadFailure(
      history.byId.get(target)?.type === "cad.mesh"
        ? "cad.body.missing"
        : "cad.reference.failed",
    );

  for (const { id } of history.features) {
    if (!status.get(id)?.ok) continue;
    const feature = history.typed.get(id);
    if (!feature) continue;
    const failed = history.dependencies
      .get(id)
      ?.find((ref) => !status.get(ref)?.ok);
    const targets = history.targets.get(id) ?? [];
    if (failed !== undefined) {
      status.set(
        id,
        targets.includes(failed)
          ? missingTarget(failed)
          : cadFailure("cad.reference.failed"),
      );
      continue;
    }
    if (feature.type === "cad.sketch") {
      const frame = geometry.sketch(feature.semantic.plane);
      if ("ok" in frame) status.set(id, frame);
      else {
        geometry.frames.set(id, frame);
        visitor.sketch?.(feature);
      }
      continue;
    }
    // Dependencies of a suppressed feature are still checked above.
    if (feature.semantic.suppressed) continue;
    if (feature.type === "cad.mesh") {
      if (visitor.mesh?.(feature) === false)
        status.set(id, cadFailure("cad.mesh.invalid"));
      else bodies.add(id);
      continue;
    }
    // A target whose creator did not produce a body fails the feature.
    let absent: ElementId | undefined;
    for (const target of targets) if (!bodies.has(target)) absent = target;
    if (absent !== undefined) {
      status.set(id, missingTarget(absent));
      continue;
    }
    const tool =
      feature.type === "cad.pcb"
        ? geometry.pcb(feature.semantic)
        : geometry.extrude(feature.semantic);
    if ("ok" in tool) {
      status.set(id, tool);
      continue;
    }
    // Later face references read these loops.
    if (referenced.has(id)) {
      geometry.extrudes.set(id, tool);
      if (stats) stats.retainedTools += 1;
    }
    if (feature.type === "cad.extrude" && feature.semantic.op === "new")
      bodies.add(id);
    visitor.tool(feature, tool, targets);
  }

  const errors: { id: ElementId; code: string }[] = [];
  let entities = 0;
  for (const { id, type } of page) {
    if (isSketchEntity(type)) entities += 1;
    const result = status.get(id);
    if (result && !result.ok) errors.push({ id, code: result.code });
  }
  return { pageId, features: history.features.length, entities, errors };
}
