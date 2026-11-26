export interface IntPoint {
  readonly x: number;
  readonly y: number;
}
export interface DiagonalSegment {
  readonly id: number;
  readonly a: IntPoint;
  readonly b: IntPoint;
}

export function diagonalBudgetLimit(segments: number, points: number): number {
  const l = Math.ceil(Math.log2(points + 1));
  return 2 * segments * (2 * l + 2) * (l + 1) + 16 * (points + segments);
}

interface Entry {
  point: IntPoint;
  index: number;
}
interface Node {
  lo: number;
  hi: number;
  entries: Entry[];
  left?: Node;
  right?: Node;
}
interface Query {
  segment: DiagonalSegment;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  dx: number;
  dy: number;
  g: number;
  c: number;
  count: number;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

// Returns coefficients for a*x + b*y = 1, for coprime signed integers.
function bezout(a: number, b: number): [number, number] {
  let oldR = Math.abs(a);
  let r = Math.abs(b);
  let oldS = 1;
  let s = 0;
  let oldT = 0;
  let t = 1;
  while (r !== 0) {
    const q = Math.floor(oldR / r);
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return [oldS * Math.sign(a), oldT * Math.sign(b)];
}

export function diagonalCandidates(
  points: readonly IntPoint[],
  segments: readonly DiagonalSegment[],
  onCandidate: (segmentId: number, pointIndex: number) => void,
  stats: { diagonalWork: number },
  budget?: number,
): { readonly exceeded: boolean } {
  if (segments.length === 0) return { exceeded: false };
  const limit = Symbol("budget");
  const tick = () => {
    stats.diagonalWork++;
    if (budget !== undefined && stats.diagonalWork > budget) throw limit;
  };
  try {
    let width = 0;
    for (const p of points)
      width = Math.max(width, Math.abs(p.x), Math.abs(p.y));
    for (const s of segments)
      width = Math.max(
        width,
        Math.abs(s.a.x),
        Math.abs(s.a.y),
        Math.abs(s.b.x),
        Math.abs(s.b.y),
      );
    const exact = 8 * width * width < 2 ** 53;
    const byX = points
      .map((point, index) => ({ point, index }))
      .sort((a, b) => a.point.x - b.point.x || a.point.y - b.point.y);
    const root: Node | undefined = byX.length
      ? { lo: 0, hi: byX.length, entries: [] }
      : undefined;
    const build: Array<{ node: Node; merge: boolean }> = root
      ? [{ node: root, merge: false }]
      : [];
    while (build.length) {
      const item = build.pop();
      if (!item) break;
      const { node } = item;
      if (node.hi - node.lo === 1) {
        const entry = byX[node.lo];
        if (entry) node.entries.push(entry);
      } else if (!item.merge) {
        const mid = Math.floor((node.lo + node.hi) / 2);
        node.left = { lo: node.lo, hi: mid, entries: [] };
        node.right = { lo: mid, hi: node.hi, entries: [] };
        build.push(
          { node, merge: true },
          { node: node.right, merge: false },
          { node: node.left, merge: false },
        );
      } else {
        const left = node.left;
        const right = node.right;
        if (!left || !right) continue;
        let i = 0;
        let j = 0;
        while (i < left.entries.length || j < right.entries.length) {
          const x = left.entries[i];
          const y = right.entries[j];
          if (x && (!y || x.point.y <= y.point.y)) {
            node.entries.push(x);
            i++;
          } else if (y) {
            node.entries.push(y);
            j++;
          }
        }
      }
    }
    const bound = (
      entries: readonly Entry[],
      value: number,
      axis: "x" | "y",
      upper: boolean,
    ): number => {
      let lo = 0;
      let hi = entries.length;
      while (lo < hi) {
        tick();
        const mid = Math.floor((lo + hi) / 2);
        const entry = entries[mid];
        if (
          entry &&
          (upper ? entry.point[axis] <= value : entry.point[axis] < value)
        )
          lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    const range = (q: Query, report?: (entry: Entry) => void): number => {
      if (!root) return 0;
      const start = bound(byX, q.minX, "x", false);
      const end = bound(byX, q.maxX, "x", true);
      const stack = [root];
      let count = 0;
      while (stack.length) {
        const node = stack.pop();
        if (!node) break;
        tick();
        if (node.hi <= start || node.lo >= end) continue;
        if (start <= node.lo && node.hi <= end) {
          const first = bound(node.entries, q.minY, "y", false);
          const last = bound(node.entries, q.maxY, "y", true);
          count += last - first;
          if (report)
            for (let k = first; k < last; k++) {
              tick();
              const e = node.entries[k];
              if (e) report(e);
            }
        } else {
          if (node.left) stack.push(node.left);
          if (node.right) stack.push(node.right);
        }
      }
      return count;
    };
    const queries: Query[] = [];
    const directions = new Map<string, Query[]>();
    for (const segment of segments) {
      let dx = segment.b.x - segment.a.x;
      let dy = segment.b.y - segment.a.y;
      const g = gcd(Math.abs(dx), Math.abs(dy));
      if (g) {
        dx /= g;
        dy /= g;
      }
      if (dx < 0 || (dx === 0 && dy < 0)) {
        dx = -dx;
        dy = -dy;
      }
      const q: Query = {
        segment,
        minX: Math.min(segment.a.x, segment.b.x) - 1,
        maxX: Math.max(segment.a.x, segment.b.x) + 1,
        minY: Math.min(segment.a.y, segment.b.y) - 1,
        maxY: Math.max(segment.a.y, segment.b.y) + 1,
        dx,
        dy,
        g,
        c: exact ? dy * segment.a.x - dx * segment.a.y : 0,
        count: 0,
      };
      q.count = range(q);
      queries.push(q);
      if (exact) {
        const key = `${dx},${dy}`;
        const group = directions.get(key) ?? [];
        group.push(q);
        directions.set(key, group);
      }
    }
    const pointHash = new Map<string, number[]>();
    if (exact)
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (!p) continue;
        const key = `${p.x},${p.y}`;
        const bucket = pointHash.get(key) ?? [];
        bucket.push(i);
        pointHash.set(key, bucket);
      }
    const emit = (q: Query, e: Entry) => onCandidate(q.segment.id, e.index);
    const box = (q: Query) =>
      range(q, (e) => {
        if (
          !exact ||
          Math.abs(q.dy * e.point.x - q.dx * e.point.y - q.c) <=
            (q.g === 1 ? 1 : 0)
        )
          emit(q, e);
      });
    const lattice = (q: Query) => {
      const walk = (x: number, y: number) => {
        let lo = Number.NEGATIVE_INFINITY;
        let hi = Number.POSITIVE_INFINITY;
        for (const [base, step, min, max] of [
          [x, q.dx, q.minX, q.maxX],
          [y, q.dy, q.minY, q.maxY],
        ]) {
          if (
            base === undefined ||
            step === undefined ||
            min === undefined ||
            max === undefined
          )
            continue;
          if (step === 0) {
            if (base < min || base > max) return;
            continue;
          }
          const a = (min - base) / step;
          const b = (max - base) / step;
          lo = Math.max(lo, Math.ceil(Math.min(a, b)));
          hi = Math.min(hi, Math.floor(Math.max(a, b)));
        }
        for (let t = lo; t <= hi; t++) {
          tick();
          const bucket = pointHash.get(`${x + t * q.dx},${y + t * q.dy}`);
          if (bucket)
            for (const index of bucket) {
              tick();
              onCandidate(q.segment.id, index);
            }
        }
      };
      walk(q.segment.a.x, q.segment.a.y);
      if (q.g === 1) {
        const [x, y] = bezout(q.dy, -q.dx);
        walk(q.segment.a.x + x, q.segment.a.y + y);
        walk(q.segment.a.x - x, q.segment.a.y - y);
      }
    };
    if (!exact) {
      for (const q of queries) box(q);
    } else
      for (const group of directions.values()) {
        const cost = group.reduce(
          (sum, q) => sum + Math.min(q.count, q.g + 7),
          0,
        );
        if (cost <= points.length) {
          for (const q of group) {
            if (q.count <= q.g + 7) box(q);
            else lattice(q);
          }
          continue;
        }
        const first = group[0];
        if (!first) continue;
        const lines = new Map<number, Entry[]>();
        for (const e of byX) {
          tick();
          const c = first.dy * e.point.x - first.dx * e.point.y;
          const bucket = lines.get(c) ?? [];
          bucket.push(e);
          lines.set(c, bucket);
        }
        for (const q of group)
          for (const c of q.g === 1 ? [q.c - 1, q.c, q.c + 1] : [q.c]) {
            const entries = lines.get(c);
            if (!entries) continue;
            const start = bound(entries, q.minX, "x", false);
            const end = bound(entries, q.maxX, "x", true);
            for (let i = start; i < end; i++) {
              tick();
              const e = entries[i];
              if (e && e.point.y >= q.minY && e.point.y <= q.maxY) emit(q, e);
            }
          }
      }
    return { exceeded: false };
  } catch (error) {
    if (error === limit) return { exceeded: true };
    throw error;
  }
}
