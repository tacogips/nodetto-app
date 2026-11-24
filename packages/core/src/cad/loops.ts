import type {
  CadArcSemantic,
  CadCircleSemantic,
  CadLineSemantic,
  CadXY,
  Element,
  ElementId,
} from "@nodetto/ir";
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
}

// Count one-dimensional overlaps before choosing the less crowded axis.
function overlappingPairs(
  boxes: readonly Bounds[],
  visit: (i: number, j: number) => void,
  count: () => void,
): void {
  const sorted = (axis: "X" | "Y") =>
    boxes
      .map((box, i) => ({ i, min: box[`min${axis}`], max: box[`max${axis}`] }))
      .sort((a, b) => a.min - b.min || a.i - b.i);
  const x = sorted("X");
  const y = sorted("Y");
  const overlapCount = (items: typeof x): number => {
    const ends = items.map((item) => item.max).sort((a, b) => a - b);
    let expired = 0;
    let total = 0;
    for (const [i, item] of items.entries()) {
      while (
        expired < ends.length &&
        (ends[expired] ?? Number.POSITIVE_INFINITY) < item.min
      )
        expired += 1;
      total += i - expired;
    }
    return total;
  };
  const items = overlapCount(x) <= overlapCount(y) ? x : y;
  for (const [index, a] of items.entries()) {
    for (let j = index + 1; j < items.length; j += 1) {
      const b = items[j];
      if (b === undefined || b.min > a.max) break;
      count();
      const first = boxes[a.i];
      const second = boxes[b.i];
      if (first === undefined || second === undefined) continue;
      if (
        first.minX <= second.maxX &&
        second.minX <= first.maxX &&
        first.minY <= second.maxY &&
        second.minY <= first.maxY
      )
        visit(a.i, b.i);
    }
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

function contains({ grid, bounds }: Profile, x: number, y: number): boolean {
  if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY)
    return false;
  let inside = false;
  let ax = coordinate(grid, grid.length - 2);
  let ay = coordinate(grid, grid.length - 1);
  for (let i = 0; i < grid.length; i += 2) {
    const bx = coordinate(grid, i);
    const by = coordinate(grid, i + 1);
    if (ay > y !== by > y) {
      const side = gridCross(bx - ax, by - ay, x - ax, y - ay);
      if (side > 0 === by > ay) inside = !inside;
    }
    ax = bx;
    ay = by;
  }
  return inside;
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
  const depths = profiles.map(() => 0);
  overlappingPairs(
    profiles.map((profile) => profile.bounds),
    (i, j) => {
      const a = profiles[i];
      const b = profiles[j];
      if (a === undefined || b === undefined) return;
      if (contains(b, coordinate(a.grid, 0), coordinate(a.grid, 1)))
        depths[i] = (depths[i] ?? 0) + 1;
      if (contains(a, coordinate(b.grid, 0), coordinate(b.grid, 1)))
        depths[j] = (depths[j] ?? 0) + 1;
    },
    () => {
      if (stats !== undefined) stats.containmentPairs += 1;
    },
  );
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
