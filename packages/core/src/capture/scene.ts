import type { Element, ElementId, PageId } from "@nodetto/ir";
import {
  includeBounds,
  type MutableBounds3,
  sweptBounds,
} from "../cad/bounds.ts";
import { visitCadConstruction } from "../cad/construction.ts";
import {
  buildEdgeYIndex,
  type EdgeIndexStats,
  type EdgeYIndex,
  crossingParity,
} from "../cad/edge-y-index.ts";
import type { CadFrame } from "../cad/frames.ts";
import type { ExtrudeGeometry } from "../cad/history.ts";
import { loopForest, type ForestStats } from "../cad/loop-forest.ts";
import type { CadLoop } from "../cad/loops.ts";
import { coordinate, gridCross, NM_PER_MM } from "../cad/vec.ts";
import { compareFractional } from "../fractional.ts";
import type { Bounds3 } from "./camera.ts";
import type { CaptureMeshDecoder } from "./cad-request.ts";
import {
  chargeTool,
  MAX_POINTS,
  type CaptureMeshTool,
} from "./scene-binary.ts";

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

export interface CaptureHiddenTarget {
  readonly id: ElementId;
  readonly steps: readonly CaptureStep[];
}

export interface CadCaptureModel {
  readonly tools: readonly (CaptureTool | CaptureMeshTool)[];
  readonly toolCount: number;
  readonly overLimit?: string;
  readonly bodies: readonly CaptureBody[];
  readonly hiddenTargets?: readonly CaptureHiddenTarget[];
  readonly errors: readonly { id: ElementId; code: string }[];
  readonly bounds: Bounds3 | null;
  readonly sketches: number;
  readonly skipped: readonly { id: ElementId; reason: "mesh" }[];
}

function loopBounds(points: readonly number[]) {
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
  entry: LoopEntry,
  x: number,
  y: number,
  stats?: EdgeIndexStats,
): boolean {
  const points = entry.grid;
  entry.edges ??= buildEdgeYIndex(points, stats);
  const index = entry.edges;
  const n = points.length / 2;
  return crossingParity(
    index,
    x,
    y,
    (edge) => {
      const a = 2 * ((edge + n - 1) % n);
      const ax = coordinate(points, a);
      const ay = coordinate(points, a + 1);
      const bx = coordinate(points, 2 * edge);
      const by = coordinate(points, 2 * edge + 1);
      return (
        ay > y !== by > y &&
        gridCross(bx - ax, by - ay, x - ax, y - ay) > 0 === by > ay
      );
    },
    stats,
  );
}

type LoopEntry = ReturnType<typeof loopBounds> & {
  loop: CadLoop;
  grid: number[];
  position: number;
  edges?: EdgeYIndex;
};

function indexBucket(entries: LoopEntry[], stats?: { indexEntries?: number }) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    minX = Math.min(minX, entry.minX);
    minY = Math.min(minY, entry.minY);
    maxX = Math.max(maxX, entry.maxX);
    maxY = Math.max(maxY, entry.maxY);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cols =
    width === 0
      ? 1
      : Math.max(
          1,
          Math.min(
            entries.length,
            Math.round(Math.sqrt((entries.length * width) / height)),
          ),
        );
  const rows =
    height === 0
      ? 1
      : Math.max(
          1,
          Math.min(
            entries.length,
            Math.round(Math.sqrt((entries.length * height) / width)),
          ),
        );
  const cell = (value: number, min: number, span: number, count: number) =>
    span === 0
      ? 0
      : Math.max(
          0,
          Math.min(count - 1, Math.floor(((value - min) / span) * count)),
        );
  const cells = new Map<number, LoopEntry[]>();
  const oversized: LoopEntry[] = [];
  const add = (list: LoopEntry[], entry: LoopEntry) => {
    list.push(entry);
    if (stats?.indexEntries !== undefined) stats.indexEntries += 1;
  };
  for (const entry of entries) {
    const x0 = cell(entry.minX, minX, width, cols);
    const x1 = cell(entry.maxX, minX, width, cols);
    const y0 = cell(entry.minY, minY, height, rows);
    const y1 = cell(entry.maxY, minY, height, rows);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 16) {
      add(oversized, entry);
      continue;
    }
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const key = y * cols + x;
        const list = cells.get(key) ?? [];
        add(list, entry);
        cells.set(key, list);
      }
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    cols,
    rows,
    cells,
    oversized,
    cell,
  };
}

const ANCESTRY_WORK_PER_VERTEX = 32;
export const PROFILE_CACHE_MIN_WORK = 4096;

export interface AncestryStats {
  ancestorProbes: number;
  indexEntries?: number;
  edges?: EdgeIndexStats;
  depthLookups?: number;
  forestFallbacks?: number;
  forest?: ForestStats;
}

/** Keep a loop when its parity differs from its nearest selected ancestor's.
 * A loop with no selected ancestor is kept only at an even depth.
 */
export function normaliseToolLoops(
  loops: readonly CadLoop[],
  stats?: AncestryStats,
  measured?: { prepared: number; searched: number },
): readonly CadLoop[] {
  if (measured) {
    measured.prepared = 0;
    measured.searched = 0;
  }
  if (loops.every(({ depth }) => depth === 0)) return loops;
  if (measured)
    measured.prepared = loops.reduce(
      (sum, loop) => sum + loop.points.length,
      0,
    );
  const buckets = new Map<number, LoopEntry[]>();
  const entries = loops.map((loop) => {
    const grid = loop.points.map((v) => Math.round(v * NM_PER_MM));
    const bucket = buckets.get(loop.depth) ?? [];
    const entry = { loop, grid, ...loopBounds(grid), position: bucket.length };
    bucket.push(entry);
    buckets.set(loop.depth, bucket);
    return entry;
  });
  const indexStats = { indexEntries: 0 };
  const edges: EdgeIndexStats = {
    builds: 0,
    visits: 0,
    inspections: 0,
    bulk: 0,
  };
  const indexes = new Map(
    [...buckets].map(([depth, entries]) => [
      depth,
      indexBucket(entries, indexStats),
    ]),
  );
  if (stats?.indexEntries !== undefined)
    stats.indexEntries += indexStats.indexEntries;
  let work = indexStats.indexEntries;
  const budget =
    ANCESTRY_WORK_PER_VERTEX *
    loops.reduce((n, loop) => n + loop.points.length / 2, 0);
  const fallback = () => {
    if (measured) measured.searched = work;
    if (stats?.forestFallbacks !== undefined) stats.forestFallbacks += 1;
    const { parents } = loopForest(
      entries.map(({ grid }) => grid),
      entries.map(() => 1),
      stats?.forest,
    );
    return loops.filter((loop, i) => {
      const parent = parents[i] ?? -1;
      const ancestorDepth = parent < 0 ? -1 : (loops[parent]?.depth ?? -1);
      return loop.depth === 0 || (loop.depth - ancestorDepth) % 2 === 1;
    });
  };
  if (work > budget) return fallback();
  const retained: CadLoop[] = [];
  for (const { loop, grid } of entries) {
    const { depth } = loop;
    if (depth === 0) {
      retained.push(loop);
      continue;
    }
    const x = coordinate(grid, 0);
    const y = coordinate(grid, 1);
    let ancestorDepth = -1;
    for (let k = depth - 1; k >= 0; k -= 1) {
      work += 1;
      if (stats?.depthLookups !== undefined) stats.depthLookups += 1;
      if (work > budget) return fallback();
      const index = indexes.get(k);
      if (!index) continue;
      const inside =
        x >= index.minX &&
        x <= index.maxX &&
        y >= index.minY &&
        y <= index.maxY;
      const key =
        index.cell(y, index.minY, index.height, index.rows) * index.cols +
        index.cell(x, index.minX, index.width, index.cols);
      const local = inside ? (index.cells.get(key) ?? []) : [];
      let i = 0;
      let j = 0;
      while (i < local.length || j < index.oversized.length) {
        const a = local[i];
        const b = index.oversized[j];
        let entry: LoopEntry;
        if (a !== undefined && (b === undefined || a.position < b.position)) {
          entry = a;
          i += 1;
        } else if (b !== undefined) {
          entry = b;
          j += 1;
        } else break;
        if (stats) stats.ancestorProbes += 1;
        work += 1;
        if (work > budget) return fallback();
        if (
          x >= entry.minX &&
          x <= entry.maxX &&
          y >= entry.minY &&
          y <= entry.maxY
        ) {
          const builds = edges.builds;
          const visits = edges.visits;
          const inspections = edges.inspections;
          const bulk = edges.bulk ?? 0;
          if (containsPoint(entry, x, y, edges)) ancestorDepth = k;
          const built = edges.builds - builds;
          const visited = edges.visits - visits;
          const inspected = edges.inspections - inspections;
          const bulkWork = (edges.bulk ?? 0) - bulk;
          work += built + visited + inspected + bulkWork;
          if (stats?.edges) {
            stats.edges.builds += built;
            stats.edges.visits += visited;
            stats.edges.inspections += inspected;
            if (stats.edges.bulk !== undefined) stats.edges.bulk += bulkWork;
          }
        }
        if (work > budget) return fallback();
        if (ancestorDepth !== -1) break;
      }
      if (ancestorDepth !== -1) break;
    }
    if ((depth - ancestorDepth) % 2 === 1) retained.push(loop);
  }
  if (measured) measured.searched = work;
  return retained;
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

function makeTool(
  feature: ElementId,
  geometry: ExtrudeGeometry,
  normalized: readonly CadLoop[],
): CaptureTool {
  const bySource = new Map<ElementId, number>();
  const loops = normalized.map(({ points, sources }) => {
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
  });
  return {
    kind: "prism",
    feature,
    frame: geometry.frame,
    ...geometry.span,
    loops,
  };
}

export interface CaptureWalkStats {
  captureVisits: number;
  toolArrays: number;
  metadataVisits: number;
  ancestry?: AncestryStats;
  profileCache?: {
    lookups: number;
    admitted: number;
    hits: number;
    prepared: number;
    maxDirectWork: number;
  };
}

export function buildCadCaptureModel(
  elements: readonly Element[],
  pageId: PageId,
): Omit<CadCaptureModel, "tools"> & { readonly tools: readonly CaptureTool[] };
export function buildCadCaptureModel(
  elements: readonly Element[],
  pageId: PageId,
  options: {
    readonly decodeMesh?: CaptureMeshDecoder;
    readonly stats?: CaptureWalkStats;
  },
): CadCaptureModel;
export function buildCadCaptureModel(
  elements: readonly Element[],
  pageId: PageId,
  options?: {
    readonly decodeMesh?: CaptureMeshDecoder;
    readonly stats?: CaptureWalkStats;
  },
): CadCaptureModel {
  const tools: (CaptureTool | CaptureMeshTool)[] = [];
  const bodies: BuildingBody[] = [];
  const visible = new Map<ElementId, BuildingBody>();
  const hidden = new Map<
    ElementId,
    { id: ElementId; steps: CaptureStep[]; needed: boolean }
  >();
  const skipped: { id: ElementId; reason: "mesh" }[] = [];
  let sketches = 0;
  let toolCount = 0;
  let overLimit: string | undefined;
  const charge = { points: 0 };
  const stats = options?.stats;
  const work = { prepared: 0, searched: 0 };
  let profileCache: Map<readonly CadLoop[], readonly CadLoop[]> | undefined;

  /** Register a tool as a new body, unless the feature is hidden. */
  function addBody(
    feature: { id: ElementId; visual: { hidden?: boolean } },
    name: string,
    reference: boolean,
    tool: CaptureTool | CaptureMeshTool | undefined,
    bounds: MutableBounds3,
  ): void {
    const step: CaptureStep = { op: "union", tool: toolCount++ };
    if (tool) tools.push(tool);
    if (feature.visual.hidden) {
      if (!reference)
        hidden.set(feature.id, {
          id: feature.id,
          steps: [step],
          needed: false,
        });
      return;
    }
    const body = { id: feature.id, name, reference, steps: [step], bounds };
    bodies.push(body);
    // A reference body is drawn but can never be a boolean target.
    if (!reference) visible.set(feature.id, body);
  }

  const report = visitCadConstruction(elements, pageId, {
    sketch() {
      sketches += 1;
    },
    mesh(feature, info) {
      const { id, semantic } = feature;
      if (!options?.decodeMesh) {
        skipped.push({ id, reason: "mesh" });
        return true;
      }
      let decoded: ReturnType<CaptureMeshDecoder>;
      try {
        decoded = options.decodeMesh(semantic.data, {
          maxVertices: overLimit ? 0 : MAX_POINTS - charge.points,
          needTarget: info.targeted,
        });
      } catch {
        return false;
      }
      const { positions, triangles, bounds, vertexCount, triangleCount } =
        decoded;
      if (!vertexCount || !triangleCount || !bounds) return false;
      if (
        !overLimit &&
        vertexCount <= MAX_POINTS - charge.points &&
        (!positions || !triangles)
      )
        return false;
      if (!overLimit) {
        if (stats) stats.captureVisits++;
        overLimit = chargeTool(charge, {
          kind: "mesh",
          vertices: vertexCount,
          triangles: triangleCount,
        });
      } else if (stats) stats.metadataVisits++;
      if (!overLimit && (!positions || !triangles)) return false;
      const tool =
        !overLimit && positions && triangles
          ? { kind: "mesh" as const, feature: id, positions, triangles }
          : undefined;
      if (tool && stats) stats.toolArrays++;
      addBody(feature, semantic.name, false, tool, {
        min: [...bounds.min],
        max: [...bounds.max],
      });
      return info.targeted && decoded.booleanTarget === false
        ? "display-only"
        : true;
    },
    tool(feature, geometry, targets) {
      // The walk keeps the original loops for later face references, even
      // for a loop omitted from the capture tool.
      const whole =
        feature.type === "cad.extrude" && feature.semantic.loops === undefined;
      const counters = stats?.profileCache;
      let loops: readonly CadLoop[] | undefined;
      if (whole && profileCache) {
        if (counters) counters.lookups++;
        loops = profileCache.get(geometry.loops);
        if (loops && counters) counters.hits++;
      }
      if (!loops) {
        loops = normaliseToolLoops(geometry.loops, stats?.ancestry, work);
        if (counters) counters.prepared += work.prepared;
        if (whole) {
          const total = work.prepared + work.searched;
          if (total >= PROFILE_CACHE_MIN_WORK) {
            profileCache ??= new Map();
            profileCache.set(geometry.loops, loops);
            if (counters) counters.admitted++;
          } else if (counters) {
            counters.maxDirectWork = Math.max(counters.maxDirectWork, total);
          }
        }
      }
      if (!overLimit) {
        if (stats) stats.captureVisits++;
        overLimit = chargeTool(charge, {
          kind: "prism",
          loopCounts: loops.map(({ points }) => points.length / 2),
        });
      } else if (stats) stats.metadataVisits++;
      const tool = overLimit
        ? undefined
        : makeTool(feature.id, geometry, loops);
      if (tool && stats) stats.toolArrays++;
      const bounds = sweptBounds(
        geometry.frame,
        geometry.span.t0,
        geometry.span.t1,
        loops,
      );
      if (feature.type === "cad.pcb" || feature.semantic.op === "new") {
        const reference = feature.type === "cad.pcb";
        addBody(feature, feature.semantic.name, reference, tool, bounds);
        return;
      }
      const step: CaptureStep = {
        op: STEP_OPS[feature.semantic.op],
        tool: toolCount++,
      };
      if (tool) tools.push(tool);
      const added = step.op === "union" ? bounds : undefined;
      const sharedVisible =
        step.op !== "union" && targets.some((target) => visible.has(target));
      for (const target of targets) {
        const body = visible.get(target);
        if (body) {
          body.steps.push(step);
          if (added) includeBounds(body.bounds, added);
        } else {
          const targetBody = hidden.get(target);
          if (targetBody) {
            targetBody.steps.push(step);
            if (sharedVisible) targetBody.needed = true;
          }
        }
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
  return {
    tools,
    toolCount,
    overLimit,
    bodies,
    hiddenTargets: [...hidden.values()]
      .filter(({ needed }) => needed)
      .map(({ id, steps }) => ({ id, steps })),
    errors,
    bounds,
    sketches,
    skipped,
  };
}
