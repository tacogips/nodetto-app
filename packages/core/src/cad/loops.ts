import type {
  CadArcSemantic,
  CadCircleSemantic,
  CadLineSemantic,
  CadXY,
  Element,
  ElementId,
} from "@nodetto/ir";
import {
  buildEdgeYIndex,
  crossingParity,
  type EdgeIndexStats,
  type EdgeYIndex,
} from "./edge-y-index.ts";
import { loopForest, type ForestStats } from "./loop-forest.ts";
import { tessellateArc, tessellateCircle } from "./tessellate.ts";
import { coordinate, gridCross, NM_PER_MM, orientation } from "./vec.ts";

export interface CadLoop {
  /** Flat, counter-clockwise vertices, closed implicitly. */
  readonly points: readonly number[];
  readonly sources: readonly ElementId[];
  /** Per edge: the stored direction opposes counter-clockwise traversal. */
  readonly reversed: readonly boolean[];
  readonly members: readonly ElementId[];
  readonly depth: number;
}

export type LoopError =
  | "cad.profile.open"
  | "cad.profile.branch"
  | "cad.profile.intersect"
  | "cad.profile.empty"
  | "cad.limit";

type Failure = { error: LoopError; at?: ElementId };

interface ChainEdge {
  id: ElementId;
  a: string;
  b: string;
  points: readonly number[];
}

interface Outline {
  points: number[];
  sources: ElementId[];
  reversed: boolean[];
  members: ElementId[];
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Profile {
  outline: Outline;
  grid: number[];
  bounds: Bounds;
  winding: number;
}

interface Segment extends Bounds {
  profile: Profile;
  start: number;
  end: number;
  id: ElementId;
}

const MAX_LOOP_VERTICES = 20_000;

function endpoint(p: CadXY): string {
  return `${p[0]},${p[1]}`;
}

function indexEdge(
  byPoint: Map<string, ChainEdge[]>,
  point: string,
  edge: ChainEdge,
): void {
  const edges = byPoint.get(point);
  if (edges === undefined) byPoint.set(point, [edge]);
  else edges.push(edge);
}

function walk(
  first: ChainEdge,
  byPoint: ReadonlyMap<string, readonly ChainEdge[]>,
  walked: Set<ChainEdge>,
): Outline | Failure {
  const points: number[] = [];
  const sources: ElementId[] = [];
  const reversed: boolean[] = [];
  const members: ElementId[] = [];
  let edge = first;
  let from = first.a;
  for (;;) {
    walked.add(edge);
    members.push(edge.id);
    const backwards = from === edge.b;
    const last = edge.points.length - 2;
    for (let offset = 0; offset < last; offset += 2) {
      const i = backwards ? last - offset : offset;
      points.push(coordinate(edge.points, i), coordinate(edge.points, i + 1));
      sources.push(edge.id);
      reversed.push(backwards);
    }
    if (sources.length > MAX_LOOP_VERTICES)
      return { error: "cad.limit", at: edge.id };

    from = backwards ? edge.a : edge.b;
    if (from === first.a) break;
    const next = byPoint.get(from)?.find((candidate) => candidate !== edge);
    if (next === undefined) return { error: "cad.profile.open", at: edge.id };
    edge = next;
  }
  return { points, sources, reversed, members };
}

function boundsOf(grid: readonly number[]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < grid.length; i += 2) {
    const x = coordinate(grid, i);
    const y = coordinate(grid, i + 1);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function signedArea(grid: readonly number[]): number {
  let area = 0;
  let magnitude = 0;
  for (let i = 2; i < grid.length - 2; i += 2) {
    const cross = orientation(grid, 0, i, i + 2);
    area += cross;
    magnitude += Math.abs(cross);
  }
  if (Math.abs(area) > magnitude * grid.length * Number.EPSILON) return area;

  // Near cancellation, sum the full integer determinants before rounding.
  const x = BigInt(coordinate(grid, 0));
  const y = BigInt(coordinate(grid, 1));
  let exact = 0n;
  for (let i = 2; i < grid.length - 2; i += 2) {
    exact +=
      (BigInt(coordinate(grid, i)) - x) *
        (BigInt(coordinate(grid, i + 3)) - y) -
      (BigInt(coordinate(grid, i + 1)) - y) *
        (BigInt(coordinate(grid, i + 2)) - x);
  }
  return Number(exact);
}

function makeProfile(outline: Outline): Profile | Failure {
  const at = outline.members[0];
  if (outline.points.length < 6) return profileError("cad.profile.empty", at);
  const grid = outline.points.map((value) => Math.round(value * NM_PER_MM));
  // Keep both the coordinates and their differences exactly representable.
  if (grid.some((value) => !(Math.abs(value) <= Number.MAX_SAFE_INTEGER / 2))) {
    return profileError("cad.limit", at);
  }
  const winding = signedArea(grid);
  if (winding === 0) {
    let i = 4;
    while (i < grid.length && orientation(grid, 0, 2, i) === 0) i += 2;
    if (i === grid.length) return profileError("cad.profile.empty", at);
  }
  return { outline, grid, bounds: boundsOf(grid), winding };
}

function profileError(error: LoopError, at: ElementId | undefined): Failure {
  return at === undefined ? { error } : { error, at };
}

function segmentIntersection(a: Segment, b: Segment): boolean {
  const adjacent =
    a.profile === b.profile && (a.end === b.start || b.end === a.start);
  // Neighbors may share their vertex. They can only double back if their
  // bounds overlap along an axis beyond that vertex.
  if (
    adjacent &&
    Math.max(a.minX, b.minX) >= Math.min(a.maxX, b.maxX) &&
    Math.max(a.minY, b.minY) >= Math.min(a.maxY, b.maxY)
  )
    return false;
  const aGrid = a.profile.grid;
  const bGrid = b.profile.grid;
  const ax = coordinate(aGrid, a.start);
  const ay = coordinate(aGrid, a.start + 1);
  const bx = coordinate(bGrid, b.start);
  const by = coordinate(bGrid, b.start + 1);
  const adx = coordinate(aGrid, a.end) - ax;
  const ady = coordinate(aGrid, a.end + 1) - ay;
  const bdx = coordinate(bGrid, b.end) - bx;
  const bdy = coordinate(bGrid, b.end + 1) - by;
  const rx = bx - ax;
  const ry = by - ay;
  const side1 = gridCross(adx, ady, rx, ry);
  const side2 = gridCross(adx, ady, rx + bdx, ry + bdy);
  if (adjacent) return side1 === 0 && side2 === 0;
  if ((side1 > 0 && side2 > 0) || (side1 < 0 && side2 < 0)) return false;
  const side3 = gridCross(bdx, bdy, -rx, -ry);
  const side4 = gridCross(bdx, bdy, adx - rx, ady - ry);
  return !((side3 > 0 && side4 > 0) || (side3 < 0 && side4 < 0));
}

interface LoopStats {
  segmentPairs: number;
  containmentPairs: number;
  edges?: EdgeIndexStats;
  forest?: ForestStats;
}

/**
 * A sweep along one axis visits every pair whose extents overlap on that
 * axis. It is the cheapest search while such pairs are few, which holds for
 * ordinary sketches, and it is the one the interpreter in the native CLI runs
 * fastest. Beyond this many candidates per box the indexed search below takes
 * over, so crowded sketches stay near n log n.
 */
const SWEEP_PAIRS_PER_BOX = 8;
const DEPTH_WORK_PER_VERTEX = 32;

function overlappingPairs(
  boxes: readonly Bounds[],
  visit: (i: number, j: number) => void,
  count: () => void,
  stop?: () => boolean,
): void {
  const sorted = (axis: "X" | "Y") =>
    boxes
      .map((box, i) => ({ i, min: box[`min${axis}`], max: box[`max${axis}`] }))
      .sort((a, b) => a.min - b.min || a.i - b.i);
  const overlapCount = (items: ReturnType<typeof sorted>): number => {
    const ends = items.map((item) => item.max).sort((a, b) => a - b);
    let expired = 0;
    let total = 0;
    for (let i = 0; i < items.length; i += 1) {
      const min = items[i]?.min ?? 0;
      while (
        expired < ends.length &&
        (ends[expired] ?? Number.POSITIVE_INFINITY) < min
      )
        expired += 1;
      total += i - expired;
    }
    return total;
  };
  const x = sorted("X");
  const y = sorted("Y");
  const alongX = overlapCount(x);
  const alongY = overlapCount(y);
  if (Math.min(alongX, alongY) <= boxes.length * SWEEP_PAIRS_PER_BOX) {
    const items = alongX <= alongY ? x : y;
    for (let index = 0; index < items.length; index += 1) {
      const a = items[index];
      if (a === undefined) continue;
      const first = boxes[a.i];
      if (first === undefined) continue;
      for (let j = index + 1; j < items.length; j += 1) {
        const b = items[j];
        if (b === undefined || b.min > a.max) break;
        count();
        if (stop?.()) return;
        const second = boxes[b.i];
        if (
          second !== undefined &&
          first.minX <= second.maxX &&
          second.minX <= first.maxX &&
          first.minY <= second.maxY &&
          second.minY <= first.maxY
        )
          visit(a.i, b.i);
      }
    }
    return;
  }
  const indices = boxes.map((_, i) => i);
  const byMinX = indices
    .slice()
    .sort((a, b) => (boxes[a]?.minX ?? 0) - (boxes[b]?.minX ?? 0) || a - b);
  const byMaxX = indices
    .slice()
    .sort((a, b) => (boxes[a]?.maxX ?? 0) - (boxes[b]?.maxX ?? 0) || a - b);
  const byMinY = indices
    .slice()
    .sort((a, b) => (boxes[a]?.minY ?? 0) - (boxes[b]?.minY ?? 0) || a - b);
  const minYs = byMinY.map((i) => boxes[i]?.minY ?? 0);
  const leafOf = new Map<number, number>();
  byMinY.forEach((index, leaf) => leafOf.set(index, leaf));
  let size = 1;
  while (size < boxes.length) size *= 2;
  const tree = new Float64Array(size * 2);
  tree.fill(Number.NEGATIVE_INFINITY);
  const update = (index: number, value: number) => {
    const leaf = leafOf.get(index);
    if (leaf === undefined) return;
    let node = size + leaf;
    tree[node] = value;
    while (node > 1) {
      node = Math.floor(node / 2);
      tree[node] = Math.max(
        tree[node * 2] ?? Number.NEGATIVE_INFINITY,
        tree[node * 2 + 1] ?? Number.NEGATIVE_INFINITY,
      );
    }
  };
  let expired = 0;
  for (const index of byMinX) {
    const a = boxes[index];
    if (a === undefined) continue;
    while (expired < byMaxX.length) {
      const old = byMaxX[expired];
      if (
        old === undefined ||
        (boxes[old]?.maxX ?? Number.POSITIVE_INFINITY) >= a.minX
      )
        break;
      update(old, Number.NEGATIVE_INFINITY);
      expired += 1;
    }
    let low = 0;
    let high = minYs.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if ((minYs[mid] ?? Number.POSITIVE_INFINITY) <= a.maxY) low = mid + 1;
      else high = mid;
    }
    const limit = low;
    let stopped = false;
    const query = (node: number, start: number, end: number): void => {
      if (stopped) return;
      count();
      if (stop?.()) {
        stopped = true;
        return;
      }
      if (start >= limit || (tree[node] ?? Number.NEGATIVE_INFINITY) < a.minY)
        return;
      if (end - start === 1) {
        const other = byMinY[start];
        const b = other === undefined ? undefined : boxes[other];
        if (
          other !== undefined &&
          b !== undefined &&
          a.minX <= b.maxX &&
          b.minX <= a.maxX &&
          a.minY <= b.maxY &&
          b.minY <= a.maxY
        )
          visit(other, index);
        return;
      }
      const mid = Math.floor((start + end) / 2);
      query(node * 2, start, mid);
      query(node * 2 + 1, mid, end);
    };
    query(1, 0, size);
    if (stopped) return;
    update(index, a.maxY);
  }
}

function intersection(
  profiles: readonly Profile[],
  stats?: LoopStats,
): Segment | undefined {
  const segments: Segment[] = [];
  for (const profile of profiles) {
    const { grid } = profile;
    for (const [index, id] of profile.outline.sources.entries()) {
      const start = index * 2;
      const end = (start + 2) % grid.length;
      const ax = coordinate(grid, start);
      const ay = coordinate(grid, start + 1);
      const bx = coordinate(grid, end);
      const by = coordinate(grid, end + 1);
      segments.push({
        profile,
        start,
        end,
        id,
        minX: Math.min(ax, bx),
        minY: Math.min(ay, by),
        maxX: Math.max(ax, bx),
        maxY: Math.max(ay, by),
      });
    }
  }
  segments.sort((a, b) => a.minX - b.minX || a.minY - b.minY);
  let first = segments.length;
  overlappingPairs(
    segments,
    (i, j) => {
      const a = segments[i];
      const b = segments[j];
      if (a !== undefined && b !== undefined && segmentIntersection(a, b)) {
        first = Math.min(first, i, j);
      }
    },
    () => {
      if (stats !== undefined) stats.segmentPairs += 1;
    },
  );
  return segments[first];
}

function contains(
  { grid, bounds }: Profile,
  x: number,
  y: number,
  getIndex: () => EdgeYIndex,
  stats?: EdgeIndexStats,
): boolean {
  if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY)
    return false;
  const n = grid.length / 2;
  return crossingParity(
    getIndex(),
    x,
    y,
    (edge) => {
      const previous = (edge + n - 1) % n;
      const ax = coordinate(grid, previous * 2);
      const ay = coordinate(grid, previous * 2 + 1);
      const bx = coordinate(grid, edge * 2);
      const by = coordinate(grid, edge * 2 + 1);
      if (ay > y !== by > y) {
        const side = gridCross(bx - ax, by - ay, x - ax, y - ay);
        return side > 0 === by > ay;
      }
      return false;
    },
    stats,
  );
}

function counterClockwise(profile: Profile, depth: number): CadLoop {
  const { outline, winding } = profile;
  if (winding > 0) return { ...outline, depth };
  const points = outline.points.slice(0, 2);
  for (let i = outline.points.length - 2; i >= 2; i -= 2) {
    points.push(
      coordinate(outline.points, i),
      coordinate(outline.points, i + 1),
    );
  }
  return {
    points,
    members: outline.members,
    sources: outline.sources.slice().reverse(),
    reversed: outline.reversed
      .slice()
      .reverse()
      .map((value) => !value),
    depth,
  };
}

export interface CadProfilePath {
  readonly id: ElementId;
  readonly points: readonly number[];
  readonly closed?: boolean;
}

export function buildLoops(
  entities: readonly Element[],
  pick?: readonly ElementId[],
  stats?: LoopStats,
): { loops: readonly CadLoop[] } | Failure {
  const paths: CadProfilePath[] = [];
  const ordered = entities
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const { type, id, semantic } of ordered) {
    // The registry validates geometry for each of these persisted element types.
    if (type === "cad.circle") {
      const circle = semantic as CadCircleSemantic;
      if (circle.construction) continue;
      paths.push({
        id,
        points: tessellateCircle(circle.c, circle.r),
        closed: true,
      });
    } else if (type === "cad.line" || type === "cad.arc") {
      const { a, b, construction } = semantic as CadLineSemantic;
      if (construction) continue;
      const points =
        type === "cad.arc"
          ? tessellateArc(a, (semantic as CadArcSemantic).m, b)
          : [a[0], a[1], b[0], b[1]];
      if (points === null) return { error: "cad.profile.empty", at: id };
      paths.push({ id, points });
    }
  }
  return buildProfileLoops(paths, pick, stats);
}

// Paths arrive in deterministic order with open endpoints already normalized
// to the source format's joining grid.
export function buildProfileLoops(
  paths: readonly CadProfilePath[],
  pick?: readonly ElementId[],
  stats?: LoopStats,
): { loops: readonly CadLoop[] } | Failure {
  const byPoint = new Map<string, ChainEdge[]>();
  const chainEdges: ChainEdge[] = [];
  const outlines: Outline[] = [];
  for (const { id, points, closed } of paths) {
    if (closed) {
      const count = points.length / 2;
      if (count > MAX_LOOP_VERTICES) return { error: "cad.limit", at: id };
      outlines.push({
        points: [...points],
        members: [id],
        sources: Array<ElementId>(count).fill(id),
        reversed: Array<boolean>(count).fill(false),
      });
      continue;
    }
    const a = endpoint([coordinate(points, 0), coordinate(points, 1)]);
    const b = endpoint([
      coordinate(points, points.length - 2),
      coordinate(points, points.length - 1),
    ]);
    if (a === b) return { error: "cad.profile.empty", at: id };
    const edge = { id, a, b, points };
    indexEdge(byPoint, a, edge);
    indexEdge(byPoint, b, edge);
    chainEdges.push(edge);
  }

  let open: ChainEdge | undefined;
  for (const edges of byPoint.values()) {
    if (edges.length > 2)
      return profileError("cad.profile.branch", edges[0]?.id);
    if (edges.length === 1) open ??= edges[0];
  }
  if (open !== undefined) return { error: "cad.profile.open", at: open.id };

  const walked = new Set<ChainEdge>();
  for (const edge of chainEdges) {
    if (walked.has(edge)) continue;
    const outline = walk(edge, byPoint, walked);
    if ("error" in outline) return outline;
    outlines.push(outline);
  }

  const profiles: Profile[] = [];
  for (const outline of outlines) {
    const profile = makeProfile(outline);
    if ("error" in profile) return profile;
    profiles.push(profile);
  }
  const crossing = intersection(profiles, stats);
  if (crossing !== undefined)
    return { error: "cad.profile.intersect", at: crossing.id };

  const selected = pick === undefined ? undefined : new Set(pick);
  let depths = profiles.map(() => 0);
  const edgeWork: EdgeIndexStats = {
    builds: 0,
    visits: 0,
    inspections: 0,
    bulk: 0,
  };
  let pairWork = 0;
  const budget =
    DEPTH_WORK_PER_VERTEX *
    profiles.reduce((sum, p) => sum + p.grid.length / 2, 0);
  const stop = () =>
    pairWork +
      edgeWork.builds +
      edgeWork.visits +
      edgeWork.inspections +
      (edgeWork.bulk ?? 0) >
    budget;
  const indexes: (EdgeYIndex | undefined)[] = profiles.map(() => undefined);
  const getIndex = (profile: Profile, i: number): EdgeYIndex => {
    const index = indexes[i] ?? buildEdgeYIndex(profile.grid, edgeWork);
    indexes[i] = index;
    return index;
  };
  overlappingPairs(
    profiles.map((profile) => profile.bounds),
    (i, j) => {
      const a = profiles[i];
      const b = profiles[j];
      if (a === undefined || b === undefined) return;
      if (
        contains(
          b,
          coordinate(a.grid, 0),
          coordinate(a.grid, 1),
          () => getIndex(b, j),
          edgeWork,
        )
      )
        depths[i] = (depths[i] ?? 0) + 1;
      if (
        contains(
          a,
          coordinate(b.grid, 0),
          coordinate(b.grid, 1),
          () => getIndex(a, i),
          edgeWork,
        )
      )
        depths[j] = (depths[j] ?? 0) + 1;
    },
    () => {
      pairWork += 1;
      if (stats !== undefined) stats.containmentPairs += 1;
    },
    stop,
  );
  if (stats?.edges !== undefined) {
    stats.edges.builds += edgeWork.builds;
    stats.edges.visits += edgeWork.visits;
    stats.edges.inspections += edgeWork.inspections;
    if (stats.edges.bulk !== undefined) stats.edges.bulk += edgeWork.bulk ?? 0;
  }
  if (stop()) {
    depths = loopForest(
      profiles.map((p) => p.grid),
      profiles.map((p) => p.winding),
      stats?.forest,
    ).depths;
  }
  const loops: CadLoop[] = [];
  for (const [index, profile] of profiles.entries()) {
    if (profile.winding === 0)
      return profileError("cad.profile.empty", profile.outline.members[0]);
    if (
      selected !== undefined &&
      !profile.outline.members.some((id) => selected.has(id))
    )
      continue;
    loops.push(counterClockwise(profile, depths[index] ?? 0));
  }
  return loops.length === 0 ? { error: "cad.profile.empty" } : { loops };
}
