import type { Box, Vec } from "./geometry.ts";

const EPSILON = 1e-7;
const TURN_PENALTY = 12;

type Direction = "h" | "v";

function compactRoute(points: readonly Vec[]): readonly Vec[] {
  const distinct = points.filter(
    (point, index) =>
      index === 0 ||
      Math.abs(point.x - (points[index - 1]?.x ?? point.x)) > EPSILON ||
      Math.abs(point.y - (points[index - 1]?.y ?? point.y)) > EPSILON,
  );
  return distinct.filter((point, index) => {
    if (index === 0 || index === distinct.length - 1) return true;
    const previous = distinct[index - 1] as Vec;
    const next = distinct[index + 1] as Vec;
    return !(
      (Math.abs(previous.x - point.x) <= EPSILON &&
        Math.abs(point.x - next.x) <= EPSILON) ||
      (Math.abs(previous.y - point.y) <= EPSILON &&
        Math.abs(point.y - next.y) <= EPSILON)
    );
  });
}

function inside(box: Box, point: Vec): boolean {
  return (
    point.x > box.x + EPSILON &&
    point.x < box.x + box.width - EPSILON &&
    point.y > box.y + EPSILON &&
    point.y < box.y + box.height - EPSILON
  );
}

function segmentBlocked(
  from: Vec,
  to: Vec,
  obstacles: readonly Box[],
): boolean {
  if (Math.abs(from.y - to.y) <= EPSILON) {
    const left = Math.min(from.x, to.x);
    const right = Math.max(from.x, to.x);
    return obstacles.some(
      (box) =>
        from.y > box.y + EPSILON &&
        from.y < box.y + box.height - EPSILON &&
        right > box.x + EPSILON &&
        left < box.x + box.width - EPSILON,
    );
  }
  if (Math.abs(from.x - to.x) <= EPSILON) {
    const top = Math.min(from.y, to.y);
    const bottom = Math.max(from.y, to.y);
    return obstacles.some(
      (box) =>
        from.x > box.x + EPSILON &&
        from.x < box.x + box.width - EPSILON &&
        bottom > box.y + EPSILON &&
        top < box.y + box.height - EPSILON,
    );
  }
  return true;
}

function sortedUnique(values: readonly number[]): readonly number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

interface QueueItem {
  /** `(xIndex * rows + yIndex) * 2 + (vertical ? 1 : 0)`. */
  readonly key: number;
  readonly xIndex: number;
  readonly yIndex: number;
  readonly direction: Direction;
  readonly cost: number;
}

function pushQueue(queue: QueueItem[], item: QueueItem): void {
  queue.push(item);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if ((queue[parent]?.cost ?? Number.POSITIVE_INFINITY) <= item.cost) break;
    queue[index] = queue[parent] as QueueItem;
    index = parent;
  }
  queue[index] = item;
}

function popQueue(queue: QueueItem[]): QueueItem | undefined {
  const first = queue[0];
  const last = queue.pop();
  if (!first || !last || queue.length === 0) return first;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    if (left >= queue.length) break;
    const child =
      right < queue.length &&
      (queue[right]?.cost ?? Number.POSITIVE_INFINITY) <
        (queue[left]?.cost ?? Number.POSITIVE_INFINITY)
        ? right
        : left;
    if ((queue[child]?.cost ?? Number.POSITIVE_INFINITY) >= last.cost) break;
    queue[index] = queue[child] as QueueItem;
    index = child;
  }
  queue[index] = last;
  return first;
}

/** The run of `values` strictly inside `(low, high)`, as `[first, past)`. */
function interior(
  values: readonly number[],
  low: number,
  high: number,
): readonly [number, number] {
  let first = 0;
  while (first < values.length && !((values[first] as number) > low + EPSILON))
    first += 1;
  let past = first;
  while (past < values.length && (values[past] as number) < high - EPSILON)
    past += 1;
  return [first, past];
}

/**
 * The run of gaps between neighbouring `values` that overlap `(low, high)`,
 * as `[first, past)`; gap `i` lies between `values[i]` and `values[i + 1]`.
 */
function crossing(
  values: readonly number[],
  low: number,
  high: number,
): readonly [number, number] {
  let first = 0;
  while (
    first + 1 < values.length &&
    !((values[first + 1] as number) > low + EPSILON)
  )
    first += 1;
  let past = first;
  while (past + 1 < values.length && (values[past] as number) < high - EPSILON)
    past += 1;
  return [first, past];
}

function gridRoute(
  start: Vec,
  end: Vec,
  preferred: readonly Vec[],
  obstacles: readonly Box[],
  endpointDirection: Direction,
): readonly Vec[] | null {
  const xs = sortedUnique([
    start.x,
    end.x,
    ...preferred.map((point) => point.x),
    ...obstacles.flatMap((box) => [box.x, box.x + box.width]),
  ]);
  const ys = sortedUnique([
    start.y,
    end.y,
    ...preferred.map((point) => point.y),
    ...obstacles.flatMap((box) => [box.y, box.y + box.height]),
  ]);
  const startX = xs.indexOf(start.x);
  const startY = ys.indexOf(start.y);
  const endX = xs.indexOf(end.x);
  const endY = ys.indexOf(end.y);
  if (startX < 0 || startY < 0 || endX < 0 || endY < 0) return null;

  // What the obstacles rule out, worked out once per search instead of per
  // step: grid points inside an obstacle, and the grid segments between
  // neighbouring points that cross one. The search only ever moves to a
  // neighbour: a point inside an obstacle is never entered, and no further
  // point can be reached across it without crossing the same obstacle.
  const columns = xs.length;
  const rows = ys.length;
  const occupied = new Uint8Array(columns * rows);
  /** `[x * rows + y]`: the segment from column `x` to `x + 1` on row `y`. */
  const blockedAcross = new Uint8Array(columns * rows);
  /** `[x * rows + y]`: the segment from row `y` to `y + 1` on column `x`. */
  const blockedDown = new Uint8Array(columns * rows);
  for (const box of obstacles) {
    const right = box.x + box.width;
    const bottom = box.y + box.height;
    const [insideX, pastInsideX] = interior(xs, box.x, right);
    const [insideY, pastInsideY] = interior(ys, box.y, bottom);
    for (let x = insideX; x < pastInsideX; x += 1)
      for (let y = insideY; y < pastInsideY; y += 1) occupied[x * rows + y] = 1;
    const [gapX, pastGapX] = crossing(xs, box.x, right);
    for (let x = gapX; x < pastGapX; x += 1)
      for (let y = insideY; y < pastInsideY; y += 1)
        blockedAcross[x * rows + y] = 1;
    const [gapY, pastGapY] = crossing(ys, box.y, bottom);
    for (let x = insideX; x < pastInsideX; x += 1)
      for (let y = gapY; y < pastGapY; y += 1) blockedDown[x * rows + y] = 1;
  }

  const stateKey = (
    xIndex: number,
    yIndex: number,
    direction: Direction,
  ): number => (xIndex * rows + yIndex) * 2 + (direction === "h" ? 0 : 1);
  const queue: QueueItem[] = [];
  const costs = new Map<number, number>();
  const previous = new Map<number, number>();
  const startKey = stateKey(startX, startY, endpointDirection);
  costs.set(startKey, 0);
  pushQueue(queue, {
    key: startKey,
    xIndex: startX,
    yIndex: startY,
    direction: endpointDirection,
    cost: 0,
  });

  let goalKey: number | null = null;
  while (queue.length > 0) {
    const current = popQueue(queue);
    if (!current || current.cost !== costs.get(current.key)) continue;
    const { xIndex, yIndex } = current;
    if (
      xIndex === endX &&
      yIndex === endY &&
      current.direction === endpointDirection
    ) {
      goalKey = current.key;
      break;
    }
    const at = xIndex * rows + yIndex;
    for (const step of [-1, 1] as const) {
      // Across first, then down, for each step: the order ties are broken in.
      const nextX = xIndex + step;
      const canCross =
        nextX >= 0 &&
        nextX < columns &&
        occupied[nextX * rows + yIndex] === 0 &&
        blockedAcross[Math.min(xIndex, nextX) * rows + yIndex] === 0;
      const nextY = yIndex + step;
      const canDescend =
        nextY >= 0 &&
        nextY < rows &&
        occupied[at + step] === 0 &&
        blockedDown[xIndex * rows + Math.min(yIndex, nextY)] === 0;
      for (const direction of ["h", "v"] as const) {
        if (direction === "h" ? !canCross : !canDescend) continue;
        if (current.key === startKey && direction !== endpointDirection)
          continue;
        const toX = direction === "h" ? nextX : xIndex;
        const toY = direction === "h" ? yIndex : nextY;
        const distance =
          Math.abs((xs[toX] as number) - (xs[xIndex] as number)) +
          Math.abs((ys[toY] as number) - (ys[yIndex] as number));
        const cost =
          current.cost +
          distance +
          (direction === current.direction ? 0 : TURN_PENALTY);
        const key = stateKey(toX, toY, direction);
        if (cost >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) continue;
        costs.set(key, cost);
        previous.set(key, current.key);
        pushQueue(queue, {
          key,
          xIndex: toX,
          yIndex: toY,
          direction,
          cost,
        });
      }
    }
  }
  if (goalKey === null) return null;
  const route: Vec[] = [];
  let key: number | undefined = goalKey;
  while (key !== undefined) {
    const cell = Math.floor(key / 2);
    route.push(
      key === startKey
        ? start
        : {
            x: xs[Math.floor(cell / rows)] as number,
            y: ys[cell % rows] as number,
          },
    );
    key = previous.get(key);
  }
  return compactRoute(route.reverse());
}

interface CachedRoute {
  readonly preferred: string;
  readonly direction: Direction;
  readonly dependencies: readonly string[];
  readonly attempts: readonly (readonly Vec[])[];
  readonly result: readonly Vec[];
}

/** One clearance rectangle, with its position in the page's stable order. */
export interface RoutingObstacle {
  readonly order: number;
  readonly box: Box;
}

/**
 * The obstacles of a page, answered by region so that routing one connector
 * does not have to visit every shape. `near` may return more than touches
 * the region, never less; an obstacle keeps its `order` across calls.
 */
export interface RoutingObstacleSource {
  /** Upper bound on the distinct obstacles `near` can return. */
  readonly size: number;
  /** Obstacles that may intersect `region`; `null` asks for every one. */
  near(region: Box | null): readonly RoutingObstacle[];
}

const routeCache = new WeakMap<object, CachedRoute>();
const obstacleKey = (box: Box): string =>
  `${box.x},${box.y},${box.width},${box.height}`;

/**
 * Every path the cached search for `cacheKey` tried, preferred route first.
 * An obstacle clear of all of them cannot change that search's result, which
 * is what lets a caller skip re-routing when something far away moves.
 * `null` when nothing is cached for the key.
 */
export function routedAttempts(
  cacheKey: object,
): readonly (readonly Vec[])[] | null {
  return routeCache.get(cacheKey)?.attempts ?? null;
}

function listSource(obstacles: readonly Box[]): RoutingObstacleSource {
  const all = obstacles.map((box, order) => ({ order, box }));
  return { size: all.length, near: () => all };
}

/** The axis-aligned extent of one segment, or `null` for a diagonal one. */
function segmentRegion(from: Vec, to: Vec): Box | null {
  if (Math.abs(from.y - to.y) > EPSILON && Math.abs(from.x - to.x) > EPSILON)
    return null;
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(from.x - to.x),
    height: Math.abs(from.y - to.y),
  };
}

/**
 * Find a deterministic rectilinear route that keeps the supplied clearance
 * rectangles out of every segment. The preferred route is returned byte-for-
 * byte when it is already clear, preserving the user's bend position.
 *
 * Obstacles come as a plain list, or as a {@link RoutingObstacleSource} that
 * answers by region; both give the same route.
 */
export function avoidOrthogonalObstacles(
  preferred: readonly Vec[],
  obstacles: readonly Box[] | RoutingObstacleSource,
  endpointDirection: Direction,
  cacheKey?: object,
): readonly Vec[] {
  if (preferred.length < 2) return preferred;
  const start = preferred[0] as Vec;
  const end = preferred.at(-1) as Vec;
  const source: RoutingObstacleSource =
    "near" in obstacles ? obstacles : listSource(obstacles);
  /**
   * Usable obstacles (neither end sits inside them) that block a segment of
   * any of `routes`, in page order. Only obstacles near a segment can block
   * it, so nothing else on the page is looked at.
   */
  const blockers = (
    routes: readonly (readonly Vec[])[],
  ): readonly RoutingObstacle[] => {
    const found = new Map<number, RoutingObstacle>();
    for (const route of routes) {
      for (let index = 1; index < route.length; index += 1) {
        const from = route[index - 1] as Vec;
        const to = route[index] as Vec;
        for (const obstacle of source.near(segmentRegion(from, to))) {
          if (
            found.has(obstacle.order) ||
            inside(obstacle.box, start) ||
            inside(obstacle.box, end) ||
            !segmentBlocked(from, to, [obstacle.box])
          )
            continue;
          found.set(obstacle.order, obstacle);
        }
      }
    }
    return [...found.values()].sort((left, right) => left.order - right.order);
  };
  const preferredKey = preferred
    .map((point) => `${point.x},${point.y}`)
    .join(";");
  const previous = cacheKey ? routeCache.get(cacheKey) : undefined;
  if (
    previous &&
    previous.preferred === preferredKey &&
    previous.direction === endpointDirection
  ) {
    // The grid searches depend only on obstacles intersecting one of their
    // attempted paths. Reuse only if exactly those obstacles, in their
    // order, are the ones intersecting the attempted paths now.
    const current = blockers(previous.attempts);
    if (
      current.length === previous.dependencies.length &&
      current.every(
        (obstacle, index) =>
          obstacleKey(obstacle.box) === previous.dependencies[index],
      )
    )
      return previous.result;
  }
  const attempts: (readonly Vec[])[] = [preferred];
  let active = blockers([preferred]);
  const finish = (result: readonly Vec[]): readonly Vec[] => {
    if (cacheKey) {
      routeCache.set(cacheKey, {
        preferred: preferredKey,
        direction: endpointDirection,
        dependencies: [...active]
          .sort((left, right) => left.order - right.order)
          .map((obstacle) => obstacleKey(obstacle.box)),
        attempts,
        result,
      });
    }
    return result;
  };
  if (active.length === 0) return finish(preferred);
  let route: readonly Vec[] | null = null;
  for (let attempt = 0; attempt <= source.size; attempt += 1) {
    route = gridRoute(
      start,
      end,
      preferred,
      active.map((obstacle) => obstacle.box),
      endpointDirection,
    );
    if (!route) return finish(preferred);
    attempts.push(route);
    const known = new Set(active.map((obstacle) => obstacle.order));
    const added = blockers([route]).filter(
      (obstacle) => !known.has(obstacle.order),
    );
    if (added.length === 0) return finish(route);
    active = [...active, ...added];
  }
  return finish(route ?? preferred);
}
