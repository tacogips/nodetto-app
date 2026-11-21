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
  | { readonly op: "new"; readonly tool: ToolState }
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
  visible: Map<string, Solid>;
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
      visible: new Map(),
      successful: new Set(),
    },
  };
}

export function releaseCadMemo(memo: CadMemo): void {
  const state = memo[memoState];
  const solids = new Set([...state.lru.keys(), ...state.visible.values()]);
  state.cache.clear();
  state.lru.clear();
  state.visible.clear();
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

function markUsed(
  memo: MemoState,
  solid: Solid,
  keys: Map<SolidKeyKind, string>,
): void {
  memo.lru.delete(solid);
  memo.lru.set(solid, keys);
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
  let triangles = 0;
  for (const solid of memo.lru.keys()) triangles += solid.triangles;

  // Several keys can refer to the same handle, such as a one-loop tool and
  // the body it creates. Count its triangles once and release it once.
  const candidates = new Set(memo.visible.values());
  for (const [solid, keys] of memo.lru) {
    if (memo.lru.size <= memo.entries && triangles <= memo.triangleLimit) break;
    memo.lru.delete(solid);
    for (const key of keys.values()) memo.cache.delete(key);
    triangles -= solid.triangles;
    candidates.add(solid);
  }

  // An over-budget result still has to stay live for the consumer. Those
  // solids leave the LRU and are retained only until the next evaluation.
  memo.visible = visible;
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
  if (hit) return hit;
  const byDepth = new Map<number, CadLoop[]>();
  for (const loop of geometry.loops) {
    const list = byDepth.get(loop.depth);
    if (list) list.push(loop);
    else byDepth.set(loop.depth, [loop]);
  }

  let aggregate: KeyedSolid | undefined;
  for (const [depth, loops] of [...byDepth].sort(([a], [b]) => a - b)) {
    const prisms = loops.map((loop) =>
      getPrism(memo, loop, geometry, id, contextKey),
    );
    const additive = depth % 2 === 0;
    const target = aggregate ?? (additive ? prisms.shift() : undefined);
    if (!target) continue;
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
    aggregate = { key: stepKey, solid };
  }
  if (!aggregate) throw new SolidFailure("cad.profile.empty");
  retain(memo, "tool", key, aggregate.solid);
  return aggregate.solid;
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
  // Start at the requested state and replay only the suffix after a hit.
  for (
    let step: BodyState | undefined = body;
    step;
    step = "previous" in step ? step.previous : undefined
  ) {
    solid = cached(memo, step.key);
    if (solid) break;
    missing.push(step);
  }

  for (const step of missing.reverse()) {
    const { key, op } = step;
    const previous = solid;
    try {
      if (op === "mesh") {
        solid = getMesh(memo, step);
        continue;
      }
      const { tool } = step;
      const operand = () =>
        getTool(memo, tool.geometry, tool.id, tool.key, tool.contextKey);
      if (op === "new") {
        solid = operand();
        retain(memo, "body", key, solid);
      } else {
        if (!previous) throw new Error("Missing preceding body state");
        solid = getSolid(memo, "body", key, () =>
          memo.kernel.boolean(op, previous.handle, [operand().handle]),
        );
      }
    } catch (error) {
      throw new BodyBuildFailure(op === "mesh" ? step.id : step.tool.id, error);
    }
  }
  if (!solid) throw new Error("Missing CAD body state");
  return solid;
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
  for (const { id } of history.features) {
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
          materializeBody(state, body);
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

    const source = sketch === undefined ? undefined : history.typed.get(sketch);
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
        for (const body of updated) materializeBody(state, body);
      }
      for (const body of updated) bodies.set(body.id, body);
      successful.add(featureKey);
      geometry.extrudes.set(id, extrude);
    } catch (error) {
      if (!(error instanceof BodyBuildFailure) || error.featureId !== id)
        throw error;
      status.set(id, error.status);
    }
  }

  const visible = new Map<string, Solid>();
  const results = [...bodies.values()].map((body) => {
    const solid = materializeBody(state, body);
    visible.set(body.key, solid);
    return {
      id: body.id,
      key: body.key,
      handle: solid.handle,
      reference: false,
    };
  });
  finish(state, visible);
  state.successful = successful;
  return { bodies: results, displayOnly, status };
}
