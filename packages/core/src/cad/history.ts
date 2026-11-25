import {
  type CadCircleSemantic,
  type CadExtrudeSemantic,
  type CadFaceRef,
  type CadLineSemantic,
  type CadMeshSemantic,
  type CadPcbSemantic,
  type CadSketchSemantic,
  type Element,
  type ElementId,
  getElementTypeDefinition,
  isCadTypeName,
  isPlainObject,
} from "@nodetto/ir";
import { profileExtents } from "./bounds.ts";
import { compareFractional } from "../fractional.ts";
import {
  baseFrame,
  type CadFrame,
  capOutwardSign,
  extrudeSpan,
  faceFrame,
  sideOutwardSign,
} from "./frames.ts";
import { buildLoops, type CadLoop } from "./loops.ts";
import {
  pcbBoardOutlineIndexed,
  pcbOutlineIndex,
  type PcbOutlineIndex,
} from "./pcb-outline.ts";

export type CadStatus =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly detail?: string };

export interface CadHistory {
  readonly features: readonly Element[];
  readonly entitiesOf: (sketchId: ElementId) => readonly Element[];
  readonly status: ReadonlyMap<ElementId, CadStatus>;
}

type Failure = Extract<CadStatus, { ok: false }>;
const cadOk = { ok: true } as const;
const CAD_MAX_EXTENT_MM = 10_000;

export function cadFailure(code: string, detail?: string): Failure {
  return detail === undefined
    ? { ok: false, code }
    : { ok: false, code, detail };
}

export type CadFeature =
  | (Element<CadSketchSemantic> & { readonly type: "cad.sketch" })
  | (Element<CadExtrudeSemantic> & { readonly type: "cad.extrude" })
  | (Element<CadMeshSemantic> & { readonly type: "cad.mesh" })
  | (Element<CadPcbSemantic> & { readonly type: "cad.pcb" });

interface HistoryDetails extends CadHistory {
  readonly pcbElements: readonly Element[];
  readonly pcbOutline: PcbOutlineIndex;
  readonly boards: ReadonlyMap<ElementId, Element>;
  readonly byId: ReadonlyMap<ElementId, Element>;
  readonly typed: ReadonlyMap<ElementId, CadFeature>;
  readonly dependencies: ReadonlyMap<ElementId, readonly ElementId[]>;
  readonly targets: ReadonlyMap<ElementId, readonly ElementId[]>;
}

export function isSketchEntity(type: string): boolean {
  return type === "cad.line" || type === "cad.arc" || type === "cad.circle";
}

function isFeatureType(type: string): boolean {
  return (
    type === "cad.sketch" ||
    type === "cad.extrude" ||
    type === "cad.mesh" ||
    type === "cad.pcb"
  );
}

export function compareCadHistoryOrder(left: Element, right: Element): number {
  return (
    compareFractional(left.index, right.index) ||
    compareFractional(left.id, right.id)
  );
}

function validatePayload(element: Element): CadStatus {
  const issue = getElementTypeDefinition(element.type)?.validateSemantic(
    element.semantic,
    "semantic",
  )[0];
  if (issue !== undefined) {
    const code =
      issue.code === "cad.coordinate"
        ? "cad.limit"
        : element.type === "cad.mesh"
          ? "cad.mesh.invalid"
          : isSketchEntity(element.type)
            ? "cad.profile.invalid"
            : "cad.feature.invalid";
    return cadFailure(code, `${issue.path}: ${issue.message}`);
  }
  if (
    (element.type === "cad.circle" &&
      (element.semantic as CadCircleSemantic).r > CAD_MAX_EXTENT_MM) ||
    (element.type === "cad.extrude" &&
      Math.abs((element.semantic as CadExtrudeSemantic).distance) >
        CAD_MAX_EXTENT_MM)
  ) {
    return cadFailure("cad.limit", "CAD lengths must be within 10000 mm");
  }
  return cadOk;
}

function localElement(
  byId: ReadonlyMap<ElementId, Element>,
  owner: Element,
  id: ElementId | undefined,
): Element | undefined {
  const candidate = id === undefined ? undefined : byId.get(id);
  return candidate?.page === owner.page ? candidate : undefined;
}

// Reverse postorder over the reference graph, followed by walks on the
// reversed graph, identifies only the features that belong to a cycle.
function markCycles(
  dependencies: ReadonlyMap<ElementId, readonly ElementId[]>,
  status: Map<ElementId, CadStatus>,
): void {
  const reversed = new Map<ElementId, ElementId[]>();
  for (const [id, refs] of dependencies) {
    for (const ref of refs) {
      const incoming = reversed.get(ref);
      if (incoming) incoming.push(id);
      else reversed.set(ref, [id]);
    }
  }

  const visited = new Set<ElementId>();
  const order: ElementId[] = [];
  for (const id of dependencies.keys()) {
    if (visited.has(id)) continue;
    visited.add(id);
    const stack = [{ id, refs: (dependencies.get(id) ?? []).values() }];
    for (let top = stack.at(-1); top !== undefined; top = stack.at(-1)) {
      const next = top.refs.next();
      if (next.done) {
        order.push(top.id);
        stack.pop();
      } else if (!visited.has(next.value)) {
        visited.add(next.value);
        stack.push({
          id: next.value,
          refs: (dependencies.get(next.value) ?? []).values(),
        });
      }
    }
  }

  visited.clear();
  for (const id of order.reverse()) {
    if (visited.has(id)) continue;
    visited.add(id);
    const component = [id];
    const todo = [id];
    for (let next = todo.pop(); next !== undefined; next = todo.pop()) {
      for (const ref of reversed.get(next) ?? []) {
        if (visited.has(ref)) continue;
        visited.add(ref);
        todo.push(ref);
        component.push(ref);
      }
    }
    if (component.length > 1 || dependencies.get(id)?.includes(id)) {
      for (const member of component)
        status.set(member, cadFailure("cad.cycle"));
    }
  }
}

function faceDependencies(
  history: HistoryDetails,
  feature: CadFeature,
  face: CadFaceRef,
  refs: ElementId[],
): CadStatus {
  const source = localElement(history.byId, feature, face.feature);
  if (source?.type !== "cad.extrude" && source?.type !== "cad.pcb") {
    return cadFailure(
      "cad.reference.missing",
      face.feature ?? "plane.face.feature",
    );
  }
  refs.push(source.id);
  if (face.role !== "side") return cadOk;
  if (source.type === "cad.pcb")
    return cadFailure("cad.plane.notPlanar", source.id);
  const entity = localElement(history.byId, feature, face.entity);
  if (!entity || !isSketchEntity(entity.type))
    return cadFailure(
      "cad.reference.missing",
      face.entity ?? "plane.face.entity",
    );

  const extrude = history.typed.get(source.id);
  if (extrude?.type !== "cad.extrude") return cadOk;
  const sketch = extrude.semantic.sketch;
  if (
    sketch === undefined ||
    !isPlainObject(entity.semantic) ||
    entity.semantic["sketch"] !== sketch
  )
    return cadFailure("cad.reference.missing", entity.id);
  return entity.type === "cad.line"
    ? cadOk
    : cadFailure("cad.plane.notPlanar", entity.id);
}

function extrudeDependencies(
  history: HistoryDetails,
  feature: Extract<CadFeature, { type: "cad.extrude" }>,
  ranks: ReadonlyMap<ElementId, number>,
  refs: ElementId[],
  targets: Map<ElementId, readonly ElementId[]>,
): CadStatus {
  const { sketch, loops, op, bodies } = feature.semantic;
  const parent = localElement(history.byId, feature, sketch);
  if (parent?.type === "cad.sketch") refs.push(parent.id);

  const earlier: ElementId[] = [];
  const named = new Set(bodies);
  const rank = ranks.get(feature.id) ?? -1;
  let later: ElementId | undefined;
  if (op !== "new") {
    for (const id of named) {
      const body = localElement(history.byId, feature, id);
      if (body?.type === "cad.pcb") return cadFailure("cad.body.reference", id);
      if (
        body?.type !== "cad.mesh" &&
        (body?.type !== "cad.extrude" ||
          !isPlainObject(body.semantic) ||
          body.semantic["op"] !== "new")
      )
        continue;
      refs.push(id);
      if ((ranks.get(id) ?? Number.POSITIVE_INFINITY) < rank) earlier.push(id);
      else later ??= id;
    }
    targets.set(feature.id, earlier);
  }

  if (parent?.type !== "cad.sketch")
    return cadFailure("cad.reference.missing", sketch ?? "sketch");
  if (loops?.length === 0) return cadFailure("cad.profile.empty");
  for (const id of loops ?? []) {
    const member = localElement(history.byId, feature, id);
    if (
      !member ||
      !isSketchEntity(member.type) ||
      !isPlainObject(member.semantic) ||
      member.semantic["sketch"] !== sketch
    )
      return cadFailure("cad.reference.missing", id);
  }

  if (op === "new") return cadOk;
  if (later !== undefined) return cadFailure("cad.order.forward", later);
  if (earlier.length === 0) return cadFailure("cad.body.missing");
  if (named.size !== earlier.length || (op === "add" && named.size !== 1))
    return cadFailure("cad.body.reference");
  return cadOk;
}

function pcbReferenceStatus(
  history: Pick<HistoryDetails, "boards">,
  item: Extract<CadFeature, { type: "cad.pcb" }>,
): CadStatus {
  const { board } = item.semantic;
  const source = board === undefined ? undefined : history.boards.get(board);
  return source && source.page !== item.page && isPlainObject(source.semantic)
    ? cadOk
    : cadFailure("cad.reference.missing", board ?? "board");
}

export function scanCadPage(elements: readonly Element[]): HistoryDetails {
  const cad = elements.filter(({ type }) => isCadTypeName(type));
  const byId = new Map(cad.map((element) => [element.id, element]));
  const pcbElements = elements.filter(
    ({ type }) => type === "pcb.board" || type === "pcb.graphic",
  );
  const pcbOutline = pcbOutlineIndex(pcbElements);
  const boards = pcbOutline.boards;
  const features = cad
    .filter(({ type }) => isFeatureType(type))
    .sort(compareCadHistoryOrder);
  const ranks = new Map(features.map(({ id }, index) => [id, index]));
  const typed = new Map<ElementId, CadFeature>();
  const dependencies = new Map<ElementId, readonly ElementId[]>();
  const targets = new Map<ElementId, readonly ElementId[]>();
  const status = new Map<ElementId, CadStatus>();
  const entities = new Map<ElementId, Element[]>();
  const counts = new Map<string, number>();
  for (const { page } of cad) counts.set(page, (counts.get(page) ?? 0) + 1);

  for (const element of cad) {
    const { id, type, page, semantic } = element;
    if ((counts.get(page) ?? 0) > 20_000) {
      status.set(
        id,
        cadFailure("cad.limit", "More than 20000 CAD elements on the page"),
      );
      continue;
    }
    const isFeature = isFeatureType(type);
    if (!isFeature && !isSketchEntity(type)) continue;
    const payload = validatePayload(element);
    status.set(id, payload);
    if (isFeature) {
      if (payload.ok) typed.set(id, element as CadFeature);
      continue;
    }
    const sketch = isPlainObject(semantic) ? semantic["sketch"] : undefined;
    const parent = localElement(
      byId,
      element,
      typeof sketch === "string" ? sketch : undefined,
    );
    if (parent?.type === "cad.sketch") {
      const list = entities.get(parent.id);
      if (list) list.push(element);
      else entities.set(parent.id, [element]);
    } else if (payload.ok) {
      status.set(
        id,
        cadFailure(
          "cad.reference.missing",
          typeof sketch === "string" ? sketch : "sketch",
        ),
      );
    }
  }

  const history = {
    features,
    entitiesOf: (id: ElementId) => entities.get(id) ?? [],
    status,
    byId,
    pcbElements,
    pcbOutline,
    boards,
    typed,
    dependencies,
    targets,
  };
  for (const feature of features) {
    const item = typed.get(feature.id);
    if (!item) continue;
    const refs: ElementId[] = [];
    const structural =
      item.type === "cad.extrude"
        ? extrudeDependencies(history, item, ranks, refs, targets)
        : item.type === "cad.pcb"
          ? pcbReferenceStatus(history, item)
          : item.type === "cad.sketch" &&
              "face" in item.semantic.plane &&
              item.semantic.plane.face !== undefined
            ? faceDependencies(history, item, item.semantic.plane.face, refs)
            : cadOk;
    dependencies.set(item.id, refs);
    const ownRank = ranks.get(item.id) ?? -1;
    const later = refs.find((id) => (ranks.get(id) ?? -1) >= ownRank);
    status.set(
      item.id,
      structural.ok && later !== undefined
        ? cadFailure("cad.order.forward", later)
        : structural,
    );
  }
  markCycles(dependencies, status);
  return history;
}

export function analyzeCadPage(elements: readonly Element[]): CadHistory {
  const { features, entitiesOf, status } = scanCadPage(elements);
  return { features, entitiesOf, status };
}

export function faceBody(
  elements: readonly Element[],
  face: CadFaceRef,
): ElementId | null {
  if (face.feature === undefined) return null;
  const history = scanCadPage(elements);
  const feature = history.typed.get(face.feature);
  if (feature?.type === "cad.pcb" && face.role !== "side") return feature.id;
  if (feature?.type !== "cad.extrude") return null;
  return feature.semantic.op === "new"
    ? feature.id
    : (history.targets.get(feature.id)?.[0] ?? null);
}

export interface ExtrudeGeometry {
  readonly frame: CadFrame;
  readonly span: ReturnType<typeof extrudeSpan>;
  readonly loops: readonly CadLoop[];
}

// Test the endpoints of each swept vertex. This uses the same coordinates
// as the tool solid and works without creating a mesh or triangulating.
function withinExtent(
  loops: readonly CadLoop[],
  frame: CadFrame,
  { t0, t1 }: ExtrudeGeometry["span"],
): boolean {
  // Allow for basis-vector rounding at the 10000 mm boundary.
  const bound = CAD_MAX_EXTENT_MM + 1e-9;
  const withinAxis = (base: number, normal: number) =>
    Math.abs(base + normal * t0) <= bound &&
    Math.abs(base + normal * t1) <= bound;
  if (loops.length === 0) return true;
  const { min, max } = profileExtents(loops, frame);
  for (const axis of [0, 1, 2] as const) {
    if (
      !withinAxis(min[axis], frame.n[axis]) ||
      !withinAxis(max[axis], frame.n[axis])
    )
      return false;
  }
  return true;
}

export interface CadGeometryStats {
  profileBuilds: number;
  pointArrays: number;
  retainedTools: number;
}

export const cadGeometryWork = {
  profileBuilds: 0,
  statusVisits: 0,
  loopProbes: 0,
  featureUpdates: 0,
  sideMemberVisits: 0,
  sideMemberIndexBuilds: 0,
  sideSelectionEntries: 0,
  evenDepthVisits: 0,
};

export function createCadGeometry(
  history: HistoryDetails,
  stats?: CadGeometryStats,
) {
  const profiles = new Map<ElementId, ReturnType<typeof buildLoops>>();
  const entityFailures = new Map<ElementId, Failure | null>();
  const memberIndices = new Map<ElementId, Map<ElementId, number[]>>();
  const points = stats ? new Set<CadLoop["points"]>() : undefined;
  const frames = new Map<ElementId, CadFrame>();
  const extrudes = new Map<ElementId, ExtrudeGeometry>();
  let pcbFrame: CadFrame | undefined;
  let selectedSides: Map<ExtrudeGeometry, Set<CadLoop>> | undefined;
  let sideMembers:
    | Map<
        ExtrudeGeometry,
        { budget: number; scanned: number; members?: Set<ElementId> }
      >
    | undefined;
  return {
    frames,
    extrudes,
    sketch(plane: CadSketchSemantic["plane"]): CadFrame | Failure {
      if ("base" in plane && plane.base !== undefined)
        return baseFrame(plane.base, plane.offset);
      if (!("face" in plane) || plane.face === undefined)
        return cadFailure("cad.feature.invalid", "Expected a sketch plane");
      const { feature, role, entity } = plane.face;
      const tool = feature === undefined ? undefined : extrudes.get(feature);
      if (tool === undefined)
        return cadFailure("cad.reference.failed", feature);
      if (role !== "side") return faceFrame(tool.frame, tool.span, role);
      const line = entity === undefined ? undefined : history.byId.get(entity);
      if (!line || line.type !== "cad.line")
        return cadFailure("cad.reference.missing", entity);
      const source =
        feature === undefined ? undefined : history.typed.get(feature);
      if (source?.type === "cad.extrude") {
        const sketchId = source.semantic.sketch;
        const profile =
          sketchId === undefined ? undefined : profiles.get(sketchId);
        const index =
          sketchId === undefined ? undefined : memberIndices.get(sketchId);
        if (
          profile !== undefined &&
          !("error" in profile) &&
          index !== undefined
        ) {
          let found: boolean;
          if (tool.loops === profile.loops) {
            cadGeometryWork.sideMemberVisits += 1;
            found = index.has(line.id);
          } else {
            selectedSides ??= new Map();
            let selected = selectedSides.get(tool);
            if (selected === undefined) {
              selected = new Set(tool.loops);
              selectedSides.set(tool, selected);
              cadGeometryWork.sideMemberVisits += tool.loops.length;
              cadGeometryWork.sideSelectionEntries += tool.loops.length;
            }
            cadGeometryWork.sideMemberVisits += 1;
            found = (index.get(line.id) ?? []).some((i) => {
              cadGeometryWork.sideMemberVisits += 1;
              const loop = profile.loops[i];
              return loop !== undefined && selected.has(loop);
            });
          }
          if (!found) return cadFailure("cad.reference.missing", entity);
          return faceFrame(
            tool.frame,
            tool.span,
            role,
            line.semantic as CadLineSemantic,
          );
        }
      }
      sideMembers ??= new Map();
      let entry = sideMembers.get(tool);
      if (entry === undefined) {
        const memberTotal = tool.loops.reduce(
          (total, loop) => total + loop.members.length,
          0,
        );
        entry = { budget: 4 * memberTotal, scanned: 0 };
        sideMembers.set(tool, entry);
      }
      if (entry.members === undefined && entry.scanned >= entry.budget) {
        entry.members = new Set();
        for (const loop of tool.loops) {
          for (const id of loop.members) {
            cadGeometryWork.sideMemberVisits += 1;
            entry.members.add(id);
          }
        }
        cadGeometryWork.sideMemberIndexBuilds += 1;
      }
      const currentEntry = entry;
      let found = false;
      if (entry.members !== undefined) {
        cadGeometryWork.sideMemberVisits += 1;
        found = entry.members.has(line.id);
      } else {
        found = tool.loops.some((loop) =>
          loop.members.some((id) => {
            currentEntry.scanned += 1;
            cadGeometryWork.sideMemberVisits += 1;
            return id === line.id;
          }),
        );
      }
      if (!found) return cadFailure("cad.reference.missing", entity);
      return faceFrame(
        tool.frame,
        tool.span,
        role,
        line.semantic as CadLineSemantic,
      );
    },
    pcb(semantic: CadPcbSemantic): ExtrudeGeometry | Failure {
      const outline = pcbBoardOutlineIndexed(
        history.pcbOutline,
        semantic.board ?? "",
      );
      if ("error" in outline) return cadFailure(outline.error, outline.at);
      pcbFrame ??= baseFrame("xy");
      const frame = pcbFrame;
      const span = { t0: 0, t1: semantic.thickness ?? outline.thickness };
      if (!withinExtent(outline.loops, frame, span))
        return cadFailure(
          "cad.limit",
          "Board vertices must lie within 10000 mm of the origin along each axis",
        );
      return { frame, span, loops: outline.loops };
    },
    extrude(semantic: CadExtrudeSemantic): ExtrudeGeometry | Failure {
      const sketch = semantic.sketch;
      const frame = sketch === undefined ? undefined : frames.get(sketch);
      if (sketch === undefined || frame === undefined)
        return cadFailure("cad.reference.failed", sketch);

      const entities = history.entitiesOf(sketch);
      let failure = entityFailures.get(sketch);
      if (failure === undefined) {
        failure = null;
        for (const { id } of entities) {
          cadGeometryWork.statusVisits += 1;
          const status = history.status.get(id);
          if (status && !status.ok) {
            failure = status;
            break;
          }
        }
        entityFailures.set(sketch, failure);
      }
      if (failure) return failure;
      let profile = profiles.get(sketch);
      if (profile === undefined) {
        cadGeometryWork.profileBuilds += 1;
        profile = buildLoops(entities);
        profiles.set(sketch, profile);
        if (stats) stats.profileBuilds += 1;
        if (!("error" in profile)) {
          const index = new Map<ElementId, number[]>();
          for (const [i, loop] of profile.loops.entries()) {
            cadGeometryWork.loopProbes += 1;
            for (const id of loop.members) {
              const indices = index.get(id) ?? [];
              indices.push(i);
              index.set(id, indices);
            }
          }
          memberIndices.set(sketch, index);
        }
      }
      if ("error" in profile) return cadFailure(profile.error, profile.at);
      let loops: readonly CadLoop[] = profile.loops;
      if (semantic.loops !== undefined) {
        const selected = new Set<number>();
        const index = memberIndices.get(sketch);
        for (const id of new Set(semantic.loops)) {
          cadGeometryWork.loopProbes += 1;
          for (const i of index?.get(id) ?? []) selected.add(i);
        }
        loops = [...selected]
          .sort((a, b) => a - b)
          .flatMap((i) => {
            const loop = profile.loops[i];
            return loop === undefined ? [] : [loop];
          });
      }
      if (
        loops.length === 0 ||
        (semantic.loops !== undefined &&
          !loops.some(({ depth }) => {
            cadGeometryWork.evenDepthVisits += 1;
            return depth % 2 === 0;
          }))
      )
        return cadFailure("cad.profile.empty");

      const span = extrudeSpan(semantic);
      if (!withinExtent(loops, frame, span))
        return cadFailure(
          "cad.limit",
          "Tool vertices must lie within 10000 mm of the origin along each axis",
        );
      if (stats && points) {
        for (const loop of loops) points.add(loop.points);
        stats.pointArrays = points.size;
      }
      return { frame, span, loops };
    },
  };
}

function resolveFeatureGeometry(
  geometry: ReturnType<typeof createCadGeometry>,
  item: CadFeature | undefined,
): boolean {
  cadGeometryWork.featureUpdates += 1;
  if (item?.type === "cad.sketch") {
    const frame = geometry.sketch(item.semantic.plane);
    if ("ok" in frame) return false;
    geometry.frames.set(item.id, frame);
  } else if (item?.type === "cad.extrude" && !item.semantic.suppressed) {
    const tool = geometry.extrude(item.semantic);
    if ("ok" in tool) return false;
    geometry.extrudes.set(item.id, tool);
  } else if (item?.type === "cad.pcb" && !item.semantic.suppressed) {
    const tool = geometry.pcb(item.semantic);
    if ("ok" in tool) return false;
    geometry.extrudes.set(item.id, tool);
  } else if (item?.type !== "cad.mesh" || item.semantic.suppressed) {
    return false;
  }
  return true;
}

function geometryFor(history: HistoryDetails, feature: ElementId) {
  const needed = new Set<ElementId>();
  const todo = [feature];
  for (let id = todo.pop(); id !== undefined; id = todo.pop()) {
    if (needed.has(id)) continue;
    needed.add(id);
    for (const ref of history.dependencies.get(id) ?? []) todo.push(ref);
  }
  const geometry = createCadGeometry(history);
  for (const { id } of history.features) {
    if (!needed.has(id)) continue;
    if (
      !history.status.get(id)?.ok ||
      !resolveFeatureGeometry(geometry, history.typed.get(id))
    )
      return null;
  }
  return geometry;
}

export function sketchFrameOf(
  elements: readonly Element[],
  sketchId: ElementId,
): CadFrame | null {
  return sketchFrameLookup(elements)(sketchId);
}

export function extrudeGeometryOf(
  elements: readonly Element[],
  semantic: CadExtrudeSemantic,
): ExtrudeGeometry | Failure {
  const { sketch } = semantic;
  if (sketch === undefined) return cadFailure("cad.reference.missing");
  const history = scanCadPage(elements);
  const status = history.status.get(sketch);
  if (status && !status.ok) return status;
  const geometry = geometryFor(history, sketch);
  return geometry
    ? geometry.extrude(semantic)
    : cadFailure("cad.reference.failed", sketch);
}

export function sketchFrameLookup(
  elements: readonly Element[],
): (sketchId: ElementId) => CadFrame | null {
  const history = scanCadPage(elements);
  const frames = new Map<ElementId, CadFrame | null>();
  const geometry = createCadGeometry(history);
  const resolved = new Map<ElementId, boolean>();
  const positions = new Map(history.features.map(({ id }, i) => [id, i]));
  return (sketchId) => {
    const sketch = history.typed.get(sketchId);
    if (sketch?.type !== "cad.sketch" || !history.status.get(sketchId)?.ok)
      return null;
    const { plane } = sketch.semantic;
    if ("base" in plane) return baseFrame(plane.base, plane.offset);
    const cached = frames.get(sketchId);
    if (cached !== undefined) return cached;
    const needed = new Set<ElementId>();
    const todo = [sketchId];
    for (let id = todo.pop(); id !== undefined; id = todo.pop()) {
      if (needed.has(id) || resolved.has(id)) continue;
      needed.add(id);
      for (const ref of history.dependencies.get(id) ?? []) todo.push(ref);
    }
    const ordered = [...needed].sort(
      (a, b) =>
        (positions.get(a) ?? Number.POSITIVE_INFINITY) -
        (positions.get(b) ?? Number.POSITIVE_INFINITY),
    );
    for (const id of ordered) {
      const ok =
        history.status.get(id)?.ok === true &&
        (history.dependencies.get(id) ?? []).every(
          (ref) => resolved.get(ref) === true,
        ) &&
        resolveFeatureGeometry(geometry, history.typed.get(id));
      resolved.set(id, ok);
    }
    const frame = resolved.get(sketchId)
      ? (geometry.frames.get(sketchId) ?? null)
      : null;
    frames.set(sketchId, frame);
    return frame;
  };
}

export function faceOutwardSign(
  elements: readonly Element[],
  face: CadFaceRef,
): 1 | -1 | 0 {
  if (face.feature === undefined) return 0;
  const history = scanCadPage(elements);
  const source = history.typed.get(face.feature);
  if (source?.type === "cad.pcb") {
    if (face.role === "side" || !geometryFor(history, source.id)) return 0;
    return face.role === "start" ? -1 : 1;
  }
  if (source?.type !== "cad.extrude") return 0;

  const tool = geometryFor(history, source.id)?.extrudes.get(source.id);
  if (!tool) return 0;
  let sign: 0 | 1 | -1;
  if (face.role === "side") {
    const entity = face.entity;
    if (entity === undefined || history.byId.get(entity)?.type !== "cad.line")
      return 0;
    const loop = tool.loops.find((candidate) =>
      candidate.members.includes(entity),
    );
    if (!loop) return 0;
    sign = sideOutwardSign(loop, entity);
  } else {
    sign = capOutwardSign(tool.span, face.role);
  }
  if (sign === 0 || source.semantic.op !== "cut") return sign;
  return sign === 1 ? -1 : 1;
}
