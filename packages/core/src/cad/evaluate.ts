import type { CadSketchSemantic, Element, ElementId } from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import {
  cadFailure,
  type CadStatus,
  createCadGeometry,
  type ExtrudeGeometry,
  scanCadPage,
} from "./history.ts";
import type { CadKernel, KernelHandle, ToolMesh } from "./kernel.ts";
import { canonicalCadJson, contentKey } from "./keys.ts";
import type { CadLoop } from "./loops.ts";
import { pcbOutlineGraphics } from "./pcb-outline.ts";
import {
  CAD_CHORD_TOLERANCE_MM,
  CAD_MAX_BISECTION_DEPTH,
} from "./tessellate.ts";
import { prismTool } from "./tool-solid.ts";

export interface CadBodyResult {
  readonly id: ElementId;
  /** Owned by the memo. Use before the next evaluation with that memo. */
  readonly handle: KernelHandle;
  readonly key: string;
  readonly reference: boolean;
}

export interface CadEvaluation {
  readonly bodies: readonly CadBodyResult[];
  readonly displayOnly: readonly { id: ElementId; mesh: ToolMesh }[];
  readonly status: ReadonlyMap<ElementId, CadStatus>;
}

export interface CadEvaluateOptions {
  readonly decodeMesh?: (data: string) => ToolMesh;
}

interface Solid {
  readonly handle: KernelHandle;
  readonly triangles: number;
}

interface KeyedSolid {
  readonly key: string;
  readonly solid: Solid;
}

interface ToolState {
  readonly id: ElementId;
  readonly key: string;
  readonly contextKey: string;
  readonly geometry: ExtrudeGeometry;
}

type BodyState = {
  readonly id: ElementId;
  readonly key: string;
} & (
  | { readonly op: "mesh"; readonly decode: () => ToolMesh }
  | { readonly op: "new"; readonly tool: ToolState; readonly reference?: true }
  | {
      readonly op: "add" | "cut" | "intersect";
      readonly tool: ToolState;
      readonly previous: BodyState;
    }
);

type SolidKeyKind = "prism" | "tool step" | "tool" | "body";

const memoState: unique symbol = Symbol("CAD memo");

interface MemoState {
  readonly kernel: CadKernel;
  readonly entries: number;
  readonly triangleLimit: number;
  readonly cache: Map<string, Solid>;
  readonly lru: Map<Solid, Map<SolidKeyKind, string>>;
  lruTriangles: number;
  readonly holds: Map<Solid, number>;
  readonly evictable: Map<Solid, true>;
  trimVisits: number;
  visible: Map<string, Solid>;
  visibleSolids: Set<Solid>;
  successful: Set<string>;
}

export interface CadMemo {
  readonly [memoState]: MemoState;
}

export function createCadMemo(
  kernel: CadKernel,
  limits: { entries?: number; triangles?: number } = {},
): CadMemo {
  return {
    [memoState]: {
      kernel,
      entries: limits.entries ?? 256,
      triangleLimit: limits.triangles ?? 4_000_000,
      cache: new Map(),
      lru: new Map(),
      lruTriangles: 0,
      holds: new Map(),
      evictable: new Map(),
      trimVisits: 0,
      visible: new Map(),
      visibleSolids: new Set(),
      successful: new Set(),
    },
  };
}

export function releaseCadMemo(memo: CadMemo): void {
  const state = memo[memoState];
  const solids = new Set([...state.lru.keys(), ...state.visible.values()]);
  state.cache.clear();
  lruClear(state);
  state.holds.clear();
  state.trimVisits = 0;
  state.visible.clear();
  state.visibleSolids.clear();
  state.successful.clear();
  for (const { handle } of solids) state.kernel.release(handle);
}

class SolidFailure extends Error {
  constructor(
    readonly code: string,
    detail?: string,
  ) {
    super(detail);
  }
}

class OpenMesh extends SolidFailure {
  constructor(
    readonly mesh: ToolMesh,
    detail?: string,
  ) {
    super("cad.mesh.open", detail);
  }
}

class BodyBuildFailure extends Error {
  readonly status: CadStatus;
  readonly displayMesh: ToolMesh | undefined;

  constructor(
    readonly featureId: ElementId,
    error: unknown,
  ) {
    const detail = error instanceof Error ? error.message : String(error);
    super(detail, { cause: error });
    this.status = cadFailure(
      error instanceof SolidFailure ? error.code : "cad.kernel.failed",
      detail || undefined,
    );
    this.displayMesh = error instanceof OpenMesh ? error.mesh : undefined;
  }
}

function lruAdd(
  memo: MemoState,
  solid: Solid,
  keys: Map<SolidKeyKind, string>,
): void {
  if (!memo.lru.has(solid)) memo.lruTriangles += solid.triangles;
  memo.lru.delete(solid);
  memo.lru.set(solid, keys);
  memo.evictable.delete(solid);
  if (!memo.holds.has(solid)) memo.evictable.set(solid, true);
}

function lruDelete(memo: MemoState, solid: Solid): void {
  if (memo.lru.delete(solid)) memo.lruTriangles -= solid.triangles;
  memo.evictable.delete(solid);
}

function lruClear(memo: MemoState): void {
  memo.lru.clear();
  memo.evictable.clear();
  memo.lruTriangles = 0;
}

function hold(memo: MemoState, solid: Solid): void {
  memo.holds.set(solid, (memo.holds.get(solid) ?? 0) + 1);
  memo.evictable.delete(solid);
}

function unhold(memo: MemoState, solid: Solid): void {
  const count = memo.holds.get(solid);
  if (count === undefined) throw new Error("Missing CAD solid hold");
  if (count > 1) memo.holds.set(solid, count - 1);
  else {
    memo.holds.delete(solid);
    if (memo.lru.has(solid)) memo.evictable.set(solid, true);
  }
}

function trim(memo: MemoState): void {
  while (
    memo.lru.size > memo.entries ||
    memo.lruTriangles > memo.triangleLimit
  ) {
    const solid = memo.evictable.keys().next().value;
    if (!solid) break;
    const keys = memo.lru.get(solid);
    lruDelete(memo, solid);
    memo.trimVisits++;
    if (keys) for (const key of keys.values()) memo.cache.delete(key);
    if (!memo.visibleSolids.has(solid)) memo.kernel.release(solid.handle);
  }
}

export function cadMemoUsage(memo: CadMemo): {
  entries: number;
  triangles: number;
  holds: number;
  trimVisits: number;
} {
  const state = memo[memoState];
  let holds = 0;
  for (const count of state.holds.values()) holds += count;
  return {
    entries: state.lru.size,
    triangles: state.lruTriangles,
    holds,
    trimVisits: state.trimVisits,
  };
}

function markUsed(
  memo: MemoState,
  solid: Solid,
  keys: Map<SolidKeyKind, string>,
): void {
  lruAdd(memo, solid, keys);
}

function retain(
  memo: MemoState,
  kind: SolidKeyKind,
  key: string,
  solid: Solid,
): void {
  const keys = memo.lru.get(solid) ?? new Map<SolidKeyKind, string>();
  // Keep one alias per role. Changes that produce the same prism or tool
  // must not accumulate an unbounded number of keys for a single handle.
  const oldKey = keys.get(kind);
  if (oldKey !== undefined) memo.cache.delete(oldKey);
  keys.set(kind, key);
  memo.cache.set(key, solid);
  markUsed(memo, solid, keys);
}

function cached(memo: MemoState, key: string): Solid | undefined {
  const solid = memo.cache.get(key);
  if (solid) {
    const keys = memo.lru.get(solid);
    if (keys) markUsed(memo, solid, keys);
    return solid;
  }
  const visible = memo.visible.get(key);
  if (visible) retain(memo, "body", key, visible);
  return visible;
}

function getSolid(
  memo: MemoState,
  kind: SolidKeyKind,
  key: string,
  build: () => KernelHandle,
  rebuildInward?: () => KernelHandle,
): Solid {
  const hit = cached(memo, key);
  if (hit) return hit;
  let handle: KernelHandle | undefined = build();
  let retained = false;
  try {
    let measurement = memo.kernel.measure(handle);
    if (rebuildInward && !measurement.empty && measurement.volume < 0) {
      const inward = handle;
      handle = undefined;
      memo.kernel.release(inward);
      handle = rebuildInward();
      measurement = memo.kernel.measure(handle);
      if (!measurement.empty && measurement.volume < 0)
        throw new SolidFailure(
          "cad.mesh.invalid",
          "Mesh still has inward winding",
        );
    }
    const { empty, triangles } = measurement;
    if (empty) throw new SolidFailure("cad.result.empty");
    if (triangles > 2_000_000)
      throw new SolidFailure(
        "cad.limit",
        "More than 2000000 triangles in a solid",
      );
    const solid = { handle, triangles };
    retain(memo, kind, key, solid);
    retained = true;
    return solid;
  } finally {
    if (!retained && handle !== undefined) memo.kernel.release(handle);
  }
}

function finish(memo: MemoState, visible: Map<string, Solid>): void {
  const retained = new Set(visible.values());

  // Several keys can refer to the same handle, such as a one-loop tool and
  // the body it creates. Count its triangles once and release it once.
  const candidates = new Set(memo.visible.values());
  for (const [solid, keys] of memo.lru) {
    if (
      memo.lru.size <= memo.entries &&
      memo.lruTriangles <= memo.triangleLimit
    )
      break;
    lruDelete(memo, solid);
    for (const key of keys.values()) memo.cache.delete(key);
    candidates.add(solid);
  }

  // An over-budget result still has to stay live for the consumer. Those
  // solids leave the LRU and are retained only until the next evaluation.
  memo.visible = visible;
  memo.visibleSolids = retained;
  for (const solid of candidates) {
    if (!retained.has(solid) && !memo.lru.has(solid))
      memo.kernel.release(solid.handle);
  }
}

function sketchKey(
  sketch: Element<CadSketchSemantic>,
  entities: readonly Element[],
): string {
  const byId = entities.slice().sort((a, b) => compareFractional(a.id, b.id));
  return contentKey([
    canonicalCadJson([sketch.id, sketch.type, sketch.semantic.plane]),
    ...byId.map(({ id, type, semantic }) =>
      canonicalCadJson([id, type, semantic]),
    ),
  ]);
}

function getPrism(
  memo: MemoState,
  loop: CadLoop,
  tool: ExtrudeGeometry,
  feature: ElementId,
  contextKey: string,
): KeyedSolid {
  // Keep individual prisms reusable when another loop in this sketch changes.
  const key = contentKey([
    "prism",
    contextKey,
    canonicalCadJson(loop.points),
    canonicalCadJson(loop.sources),
  ]);
  const solid = getSolid(memo, "prism", key, () => {
    let mesh: ReturnType<typeof prismTool>;
    try {
      mesh = prismTool(loop, tool.frame, tool.span, feature);
    } catch (error) {
      throw new SolidFailure(
        "cad.profile.invalid",
        error instanceof Error ? error.message : String(error),
      );
    }
    return memo.kernel.solid(mesh);
  });
  return { key, solid };
}

function getTool(
  memo: MemoState,
  geometry: ExtrudeGeometry,
  id: ElementId,
  key: string,
  contextKey: string,
): Solid {
  const hit = cached(memo, key);
  if (hit) {
    hold(memo, hit);
    return hit;
  }
  const byDepth = new Map<number, CadLoop[]>();
  for (const loop of geometry.loops) {
    const list = byDepth.get(loop.depth);
    if (list) list.push(loop);
    else byDepth.set(loop.depth, [loop]);
  }
  const pinned: Solid[] = [];
  const pin = (solid: Solid) => {
    hold(memo, solid);
    pinned.push(solid);
  };
  const unpin = (solid: Solid) => {
    const index = pinned.indexOf(solid);
    if (index < 0) throw new Error("Missing tool hold");
    pinned.splice(index, 1);
    unhold(memo, solid);
  };
  try {
    let aggregate: KeyedSolid | undefined;
    for (const [depth, loops] of [...byDepth].sort(([a], [b]) => a - b)) {
      const prisms: KeyedSolid[] = [];
      for (const loop of loops) {
        const prism = getPrism(memo, loop, geometry, id, contextKey);
        pin(prism.solid);
        prisms.push(prism);
      }
      const additive = depth % 2 === 0;
      const target = aggregate ?? (additive ? prisms.shift() : undefined);
      if (!target) {
        for (const prism of prisms) unpin(prism.solid);
        continue;
      }
      if (prisms.length === 0) {
        aggregate = target;
        continue;
      }
      const op = additive ? "add" : "cut";
      const stepKey = contentKey([
        "tool step",
        op,
        target.key,
        ...prisms.map(({ key }) => key),
      ]);
      const solid = getSolid(memo, "tool step", stepKey, () =>
        memo.kernel.boolean(
          op,
          target.solid.handle,
          prisms.map(({ solid }) => solid.handle),
        ),
      );
      pin(solid);
      unpin(target.solid);
      for (const prism of prisms) unpin(prism.solid);
      aggregate = { key: stepKey, solid };
      trim(memo);
    }
    if (!aggregate) throw new SolidFailure("cad.profile.empty");
    retain(memo, "tool", key, aggregate.solid);
    pinned.pop();
    return aggregate.solid;
  } finally {
    for (const solid of pinned) unhold(memo, solid);
  }
}

function getMesh(
  memo: MemoState,
  body: Extract<BodyState, { op: "mesh" }>,
): Solid {
  let mesh: ToolMesh | undefined;
  function solidify(input: ToolMesh): KernelHandle {
    try {
      return memo.kernel.solid(input);
    } catch (error) {
      throw new OpenMesh(
        input,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  try {
    return getSolid(
      memo,
      "body",
      body.key,
      () => {
        const decoded = body.decode();
        if (decoded.triangles.length === 0)
          throw new SolidFailure("cad.mesh.invalid", "Mesh has no triangles");
        mesh = {
          positions: decoded.positions,
          triangles: decoded.triangles,
          triFace: new Uint32Array(decoded.triangles.length / 3),
          faceNames: [`${body.id}:mesh`],
        };
        return solidify(mesh);
      },
      () => {
        if (!mesh) throw new Error("Missing decoded mesh");
        // Reverse each triangle in place in a copy so the face indices and
        // decoded input stay unchanged.
        const triangles = mesh.triangles.slice();
        for (let offset = 0; offset < triangles.length; offset += 3) {
          const second = triangles[offset + 1];
          const third = triangles[offset + 2];
          if (second === undefined || third === undefined)
            throw new SolidFailure("cad.mesh.invalid", "Incomplete triangle");
          triangles[offset + 1] = third;
          triangles[offset + 2] = second;
        }
        return solidify({ ...mesh, triangles });
      },
    );
  } catch (error) {
    if (
      mesh &&
      error instanceof SolidFailure &&
      error.code === "cad.result.empty"
    )
      throw new OpenMesh(mesh);
    throw error;
  }
}

function materializeBody(memo: MemoState, body: BodyState): Solid {
  const missing: BodyState[] = [];
  let solid: Solid | undefined;
  try {
    for (
      let step: BodyState | undefined = body;
      step;
      step = "previous" in step ? step.previous : undefined
    ) {
      solid = cached(memo, step.key);
      if (solid) {
        hold(memo, solid);
        break;
      }
      missing.push(step);
    }
    for (const step of missing.reverse()) {
      const { key, op } = step;
      const previous = solid;
      try {
        if (op === "mesh") {
          solid = getMesh(memo, step);
          hold(memo, solid);
        } else if (op === "new") {
          solid = getTool(
            memo,
            step.tool.geometry,
            step.tool.id,
            step.tool.key,
            step.tool.contextKey,
          );
          retain(memo, "body", key, solid);
        } else {
          if (!previous) throw new Error("Missing preceding body state");
          let operand: Solid | undefined;
          try {
            const result = getSolid(memo, "body", key, () => {
              operand = getTool(
                memo,
                step.tool.geometry,
                step.tool.id,
                step.tool.key,
                step.tool.contextKey,
              );
              return memo.kernel.boolean(op, previous.handle, [operand.handle]);
            });
            hold(memo, result);
            solid = result;
          } finally {
            if (operand) unhold(memo, operand);
          }
        }
        if (previous) unhold(memo, previous);
        trim(memo);
      } catch (error) {
        throw new BodyBuildFailure(
          op === "mesh" ? step.id : step.tool.id,
          error,
        );
      }
    }
    if (!solid) throw new Error("Missing CAD body state");
    const result = solid;
    solid = undefined;
    return result;
  } finally {
    if (solid) unhold(memo, solid);
  }
}

export function evaluateCadPage(
  elements: readonly Element[],
  kernel: CadKernel,
  memo: CadMemo,
  { decodeMesh }: CadEvaluateOptions = {},
): CadEvaluation {
  const state = memo[memoState];
  if (state.kernel !== kernel)
    throw new TypeError("The CAD memo belongs to a different kernel");

  try {
    return evaluateHistory(elements, state, decodeMesh);
  } catch (error) {
    if (!(error instanceof BodyBuildFailure)) throw error;
    // If replay of a previously successful feature fails, evaluate in
    // history order so dependents and all targets see the same failure.
    return evaluateHistory(elements, state, decodeMesh, error);
  }
}

function evaluateHistory(
  elements: readonly Element[],
  state: MemoState,
  decodeMesh: CadEvaluateOptions["decodeMesh"],
  replayFailure?: BodyBuildFailure,
): CadEvaluation {
  const history = scanCadPage(elements);
  const geometry = createCadGeometry(history);
  const status = new Map(history.status);
  const bodies = new Map<ElementId, BodyState>();
  const displayOnly: { id: ElementId; mesh: ToolMesh }[] = [];
  const sketchKeys = new Map<ElementId, string>();
  const successful = new Set<string>();
  const bodyHolds = new Map<ElementId, Solid>();
  const staged: Solid[] = [];
  const commit = (id: ElementId, solid: Solid) => {
    const previous = bodyHolds.get(id);
    bodyHolds.set(id, solid);
    if (previous) unhold(state, previous);
  };
  try {
    for (const { id } of history.features) {
      try {
        if (!status.get(id)?.ok) continue;
        const item = history.typed.get(id);
        if (!item) continue;
        const targetIds = history.targets.get(id) ?? [];
        const failed = history.dependencies
          .get(id)
          ?.find((ref) => !status.get(ref)?.ok);
        if (failed !== undefined) {
          const code =
            targetIds.includes(failed) &&
            history.byId.get(failed)?.type === "cad.mesh"
              ? "cad.body.missing"
              : "cad.reference.failed";
          status.set(id, cadFailure(code, failed));
          continue;
        }
        if (item.type === "cad.sketch") {
          const frame = geometry.sketch(item.semantic.plane);
          if ("ok" in frame) status.set(id, frame);
          else geometry.frames.set(id, frame);
          continue;
        }

        if (item.type === "cad.mesh") {
          const { data, suppressed } = item.semantic;
          if (suppressed) continue;
          if (!decodeMesh) {
            status.set(id, cadFailure("cad.mesh.unsupported"));
            continue;
          }
          const key = contentKey(["mesh", id, state.kernel.id, data]);
          const body: BodyState = {
            id,
            key,
            op: "mesh",
            decode() {
              try {
                return decodeMesh(data);
              } catch (error) {
                throw new SolidFailure(
                  "cad.mesh.invalid",
                  error instanceof Error ? error.message : String(error),
                );
              }
            },
          };
          try {
            if (replayFailure?.featureId === id) throw replayFailure;
            if (replayFailure || !state.successful.has(key))
              commit(id, materializeBody(state, body));
            bodies.set(id, body);
            successful.add(key);
          } catch (error) {
            if (!(error instanceof BodyBuildFailure) || error.featureId !== id)
              throw error;
            status.set(id, error.status);
            if (error.displayMesh)
              displayOnly.push({ id, mesh: error.displayMesh });
          }
          continue;
        }

        if (item.type === "cad.pcb") {
          const { board, suppressed } = item.semantic;
          if (suppressed) continue;
          const pcb = geometry.pcb(item.semantic);
          if ("ok" in pcb) {
            status.set(id, pcb);
            continue;
          }
          const source =
            board === undefined ? undefined : history.boards.get(board);
          if (!source) {
            status.set(id, cadFailure("cad.reference.missing", board));
            continue;
          }
          const graphics = pcbOutlineGraphics(history.pcbElements, source.page);
          const contextKey = contentKey([
            "pcb prism",
            id,
            state.kernel.id,
            canonicalCadJson(pcb.span),
            String(CAD_CHORD_TOLERANCE_MM),
            String(CAD_MAX_BISECTION_DEPTH),
          ]);
          const tool = {
            id,
            contextKey,
            geometry: pcb,
            key: contentKey([
              "pcb tool",
              contextKey,
              canonicalCadJson(item.semantic),
              canonicalCadJson(
                graphics.map(({ id, semantic }) => [id, semantic]),
              ),
              canonicalCadJson(
                source.semantic &&
                  typeof source.semantic === "object" &&
                  "thickness" in source.semantic
                  ? source.semantic.thickness
                  : null,
              ) ?? "",
            ]),
          };
          const key = contentKey(["body", tool.key]);
          const body: BodyState = { id, key, op: "new", tool, reference: true };
          try {
            if (replayFailure?.featureId === id) throw replayFailure;
            if (replayFailure || !state.successful.has(key))
              commit(id, materializeBody(state, body));
            bodies.set(id, body);
            successful.add(key);
            geometry.extrudes.set(id, pcb);
          } catch (error) {
            if (!(error instanceof BodyBuildFailure) || error.featureId !== id)
              throw error;
            status.set(id, error.status);
          }
          continue;
        }

        const {
          sketch,
          op,
          suppressed,
          name: _name,
          symmetric,
          ...dimensions
        } = item.semantic;
        if (suppressed) continue;
        const targets: BodyState[] = [];
        for (const target of targetIds) {
          const body = bodies.get(target);
          if (body) targets.push(body);
          else {
            const code =
              history.byId.get(target)?.type === "cad.mesh"
                ? "cad.body.missing"
                : "cad.reference.failed";
            status.set(id, cadFailure(code, target));
          }
        }
        if (!status.get(id)?.ok) continue;
        const extrude = geometry.extrude(item.semantic);
        if ("ok" in extrude) {
          status.set(id, extrude);
          continue;
        }

        const source =
          sketch === undefined ? undefined : history.typed.get(sketch);
        if (source?.type !== "cad.sketch") {
          status.set(id, cadFailure("cad.reference.missing", "sketch"));
          continue;
        }
        let sourceKey = sketchKeys.get(source.id);
        if (sourceKey === undefined) {
          sourceKey = sketchKey(source, history.entitiesOf(source.id));
          sketchKeys.set(source.id, sourceKey);
        }
        const contextKey = contentKey([
          id,
          state.kernel.id,
          canonicalCadJson(extrude.frame),
          canonicalCadJson(extrude.span),
          String(CAD_CHORD_TOLERANCE_MM),
          String(CAD_MAX_BISECTION_DEPTH),
        ]);
        const tool: ToolState = {
          id,
          contextKey,
          geometry: extrude,
          key: contentKey([
            "tool",
            contextKey,
            sourceKey,
            canonicalCadJson({
              ...dimensions,
              sketch,
              op,
              symmetric: symmetric === true,
            }),
          ]),
        };
        const updated: BodyState[] =
          op === "new"
            ? [{ id, key: contentKey(["body", tool.key]), op, tool }]
            : targets.map((previous) => ({
                id: previous.id,
                key: contentKey(["body", previous.key, tool.key]),
                op,
                tool,
                previous,
              }));
        const featureKey = contentKey(updated.map(({ key }) => key));
        try {
          if (replayFailure?.featureId === id) throw replayFailure;
          // A known success carries the entire atomic outcome, even if some
          // handles are gone. Unknown outcomes still need a kernel check.
          if (replayFailure || !state.successful.has(featureKey)) {
            for (const body of updated)
              staged.push(materializeBody(state, body));
          }
          for (let index = 0; index < updated.length; index++) {
            const body = updated[index];
            const solid = staged[index];
            if (body && solid) commit(body.id, solid);
          }
          staged.length = 0;
          for (const body of updated) bodies.set(body.id, body);
          successful.add(featureKey);
          geometry.extrudes.set(id, extrude);
        } catch (error) {
          if (!(error instanceof BodyBuildFailure) || error.featureId !== id)
            throw error;
          status.set(id, error.status);
        }
      } finally {
        for (const solid of staged) unhold(state, solid);
        staged.length = 0;
        trim(state);
      }
    }

    const visible = new Map<string, Solid>();
    const results = [...bodies.values()].map((body) => {
      const solid = materializeBody(state, body);
      visible.set(body.key, solid);
      staged.push(solid);
      return {
        id: body.id,
        key: body.key,
        handle: solid.handle,
        reference: body.op === "new" && body.reference === true,
      };
    });
    finish(state, visible);
    state.successful = successful;
    return { bodies: results, displayOnly, status };
  } finally {
    for (const solid of staged) unhold(state, solid);
    for (const solid of bodyHolds.values()) unhold(state, solid);
  }
}
