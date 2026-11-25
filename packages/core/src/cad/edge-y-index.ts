export interface EdgeIndexStats {
  builds: number;
  visits: number;
  inspections: number;
  bulk?: number;
}

export interface EdgeYIndex {
  edges: number[];
  lows: number[];
  maxHigh: number[];
  minHigh: number[];
  minX: number[];
  maxX: number[];
  size: number;
}

export function buildEdgeYIndex(
  points: ArrayLike<number>,
  stats?: EdgeIndexStats,
): EdgeYIndex {
  const n = points.length / 2;
  const intervals = Array.from({ length: n }, (_, edge) => {
    const ay = points[2 * ((edge + n - 1) % n) + 1] ?? 0;
    const by = points[2 * edge + 1] ?? 0;
    const ax = points[2 * ((edge + n - 1) % n)] ?? 0;
    const bx = points[2 * edge] ?? 0;
    return {
      edge,
      lo: Math.min(ay, by),
      hi: Math.max(ay, by),
      minX: Math.min(ax, bx),
      maxX: Math.max(ax, bx),
    };
  }).filter((item) => item.lo !== item.hi);
  intervals.sort((a, b) => a.lo - b.lo || a.edge - b.edge);
  let size = 1;
  while (size < intervals.length) size *= 2;
  const maxHigh = Array<number>(size * 2).fill(Number.NEGATIVE_INFINITY);
  const minHigh = Array<number>(size * 2).fill(Number.POSITIVE_INFINITY);
  const minX = Array<number>(size * 2).fill(Number.POSITIVE_INFINITY);
  const maxX = Array<number>(size * 2).fill(Number.NEGATIVE_INFINITY);
  for (let i = 0; i < intervals.length; i += 1) {
    const item = intervals[i];
    if (!item) continue;
    maxHigh[size + i] = item.hi;
    minHigh[size + i] = item.hi;
    minX[size + i] = item.minX;
    maxX[size + i] = item.maxX;
  }
  for (let i = size - 1; i > 0; i -= 1) {
    maxHigh[i] = Math.max(
      maxHigh[2 * i] ?? Number.NEGATIVE_INFINITY,
      maxHigh[2 * i + 1] ?? Number.NEGATIVE_INFINITY,
    );
    minHigh[i] = Math.min(
      minHigh[2 * i] ?? Number.POSITIVE_INFINITY,
      minHigh[2 * i + 1] ?? Number.POSITIVE_INFINITY,
    );
    minX[i] = Math.min(
      minX[2 * i] ?? Number.POSITIVE_INFINITY,
      minX[2 * i + 1] ?? Number.POSITIVE_INFINITY,
    );
    maxX[i] = Math.max(
      maxX[2 * i] ?? Number.NEGATIVE_INFINITY,
      maxX[2 * i + 1] ?? Number.NEGATIVE_INFINITY,
    );
  }
  if (stats) stats.builds += n;
  return {
    edges: intervals.map((item) => item.edge),
    lows: intervals.map((item) => item.lo),
    maxHigh,
    minHigh,
    minX,
    maxX,
    size,
  };
}

export function crossingParity(
  index: EdgeYIndex,
  x: number,
  y: number,
  exact: (edge: number) => boolean,
  stats?: EdgeIndexStats,
): boolean {
  let low = 0;
  let high = index.lows.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((index.lows[mid] ?? Number.POSITIVE_INFINITY) <= y) low = mid + 1;
    else high = mid;
  }
  const limit = low;
  let parity = false;
  const walk = (node: number, start: number, end: number): void => {
    if (stats) stats.visits += 1;
    if (
      start >= limit ||
      (index.maxHigh[node] ?? Number.NEGATIVE_INFINITY) <= y ||
      (index.maxX[node] ?? Number.NEGATIVE_INFINITY) < x
    )
      return;
    if (end - start === 1) {
      const edge = index.edges[start];
      if (edge !== undefined) {
        if (stats) stats.inspections += 1;
        if (exact(edge)) parity = !parity;
      }
      return;
    }
    const realEnd = Math.min(end, index.edges.length);
    if (
      realEnd <= limit &&
      (index.minHigh[node] ?? Number.POSITIVE_INFINITY) > y &&
      (index.minX[node] ?? Number.POSITIVE_INFINITY) > x
    ) {
      if ((realEnd - start) % 2 === 1) parity = !parity;
      if (stats?.bulk !== undefined) stats.bulk += 1;
      return;
    }
    const mid = (start + end) / 2;
    walk(node * 2, start, mid);
    walk(node * 2 + 1, mid, end);
  };
  walk(1, 0, index.size);
  return parity;
}
