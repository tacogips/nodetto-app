import type { Element, ElementId } from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import {
  cadFailure,
  type CadStatus,
  createCadGeometry,
  type ExtrudeGeometry,
  scanCadPage,
} from "./history.ts";
import type { CadKernel, KernelHandle } from "./kernel.ts";
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
  readonly status: ReadonlyMap<ElementId, CadStatus>;
}

interface Solid {
  readonly handle: KernelHandle;
  readonly triangles: number;
}

interface KeyedSolid {
  readonly key: string;
  readonly solid: Solid;
}

interface BodyState extends KeyedSolid {
  readonly id: ElementId;
}

const memoState: unique symbol = Symbol("CAD memo");

interface MemoState {
  readonly kernel: CadKernel;
  readonly entries: number;
  readonly triangleLimit: number;
  readonly cache: Map<string, Solid>;
  visible: Set<Solid>;
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
      visible: new Set(),
    },
  };
}

class SolidFailure extends Error {
  constructor(
    readonly code: string,
    detail?: string,
  ) {
    super(detail);
  }
}

function cached(memo: MemoState, key: string): Solid | undefined {
  const solid = memo.cache.get(key);
  if (solid !== undefined) {
    memo.cache.delete(key);
    memo.cache.set(key, solid);
  }
  return solid;
}

function getSolid(
  memo: MemoState,
  key: string,
  build: () => KernelHandle,
): Solid {
  const hit = cached(memo, key);
  if (hit) return hit;
  const handle = build();
  let retained = false;
  try {
    const { empty, triangles } = memo.kernel.measure(handle);
    if (empty) throw new SolidFailure("cad.result.empty");
    if (triangles > 2_000_000)
      throw new SolidFailure(
        "cad.limit",
        "More than 2000000 triangles in a solid",
      );
    const solid = { handle, triangles };
    memo.cache.set(key, solid);
    retained = true;
    return solid;
  } finally {
    if (!retained) memo.kernel.release(handle);
  }
}

function finish(
  memo: MemoState,
  bodies: ReadonlyMap<ElementId, BodyState>,
): void {
  const visible = new Set([...bodies.values()].map(({ solid }) => solid));
  const references = new Map<Solid, number>();
  let triangles = 0;
  for (const solid of memo.cache.values()) {
    const count = references.get(solid) ?? 0;
    if (count === 0) triangles += solid.triangles;
    references.set(solid, count + 1);
  }

  // Several keys can refer to the same handle, such as a one-loop tool and
  // the body it creates. Count its triangles once and release it once.
  const candidates = memo.visible;
  for (const [key, solid] of memo.cache) {
    if (memo.cache.size <= memo.entries && triangles <= memo.triangleLimit)
      break;
    memo.cache.delete(key);
    const count = references.get(solid) ?? 0;
    if (count <= 1) {
      references.delete(solid);
      triangles -= solid.triangles;
      candidates.add(solid);
    } else {
      references.set(solid, count - 1);
    }
  }

  // An over-budget result still has to stay live for the consumer. Those
  // solids leave the LRU and are retained only until the next evaluation.
  memo.visible = visible;
  for (const solid of candidates) {
    if (!visible.has(solid) && !references.has(solid))
      memo.kernel.release(solid.handle);
  }
}

function sketchKey(sketch: Element, entities: readonly Element[]): string {
  const byId = entities.slice().sort((a, b) => compareFractional(a.id, b.id));
  return contentKey(
    [sketch, ...byId].map(({ id, type, semantic }) =>
      canonicalCadJson([id, type, semantic]),
    ),
  );
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
  const solid = getSolid(memo, key, () => {
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
    const solid = getSolid(memo, stepKey, () =>
      memo.kernel.boolean(
        op,
        target.solid.handle,
        prisms.map(({ solid }) => solid.handle),
      ),
    );
    aggregate = { key: stepKey, solid };
  }
  if (!aggregate) throw new SolidFailure("cad.profile.empty");
  memo.cache.set(key, aggregate.solid);
  return aggregate.solid;
}

export function evaluateCadPage(
  elements: readonly Element[],
  kernel: CadKernel,
  memo: CadMemo,
): CadEvaluation {
  const state = memo[memoState];
  if (state.kernel !== kernel)
    throw new TypeError("The CAD memo belongs to a different kernel");

  const history = scanCadPage(elements);
  const geometry = createCadGeometry(history);
  const status = new Map(history.status);
  const bodies = new Map<ElementId, BodyState>();
  const sketchKeys = new Map<ElementId, string>();
  for (const { id } of history.features) {
    if (!status.get(id)?.ok) continue;
    const item = history.typed.get(id);
    if (!item) continue;
    const failed = history.dependencies
      .get(id)
      ?.find((ref) => !status.get(ref)?.ok);
    if (failed !== undefined) {
      status.set(id, cadFailure("cad.reference.failed", failed));
      continue;
    }
    if (item.type === "cad.sketch") {
      const frame = geometry.sketch(item.semantic.plane);
      if ("ok" in frame) status.set(id, frame);
      else geometry.frames.set(id, frame);
      continue;
    }

    const { sketch, op, suppressed } = item.semantic;
    if (suppressed) continue;
    const targets: BodyState[] = [];
    for (const target of history.targets.get(id) ?? []) {
      const body = bodies.get(target);
      if (body) targets.push(body);
      else status.set(id, cadFailure("cad.reference.failed", target));
    }
    if (!status.get(id)?.ok) continue;
    const tool = geometry.extrude(item.semantic);
    if ("ok" in tool) {
      status.set(id, tool);
      continue;
    }

    try {
      const source =
        sketch === undefined ? undefined : history.byId.get(sketch);
      if (source === undefined) {
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
        kernel.id,
        canonicalCadJson(tool.frame),
        canonicalCadJson(tool.span),
        String(CAD_CHORD_TOLERANCE_MM),
        String(CAD_MAX_BISECTION_DEPTH),
      ]);
      const toolKey = contentKey([
        "tool",
        contextKey,
        sourceKey,
        canonicalCadJson(item.semantic),
      ]);
      if (op === "new") {
        const key = contentKey(["body", toolKey]);
        const solid =
          cached(state, key) ?? getTool(state, tool, id, toolKey, contextKey);
        state.cache.set(key, solid);
        bodies.set(id, { id, key, solid });
      } else {
        const updated: BodyState[] = [];
        for (const body of targets) {
          const key = contentKey(["body", body.key, toolKey]);
          const solid = getSolid(state, key, () => {
            const operand = getTool(state, tool, id, toolKey, contextKey);
            return kernel.boolean(op, body.solid.handle, [operand.handle]);
          });
          updated.push({ id: body.id, key, solid });
        }
        // A multi-body feature is one edit. Publish only if all targets succeeded.
        for (const body of updated) bodies.set(body.id, body);
      }
      geometry.extrudes.set(id, tool);
    } catch (error) {
      status.set(
        id,
        cadFailure(
          error instanceof SolidFailure ? error.code : "cad.kernel.failed",
          error instanceof Error ? error.message || undefined : String(error),
        ),
      );
    }
  }

  finish(state, bodies);
  return {
    bodies: [...bodies.values()].map(({ id, key, solid }) => ({
      id,
      key,
      handle: solid.handle,
      reference: false,
    })),
    status,
  };
}
