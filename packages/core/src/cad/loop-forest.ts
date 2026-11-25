import { coordinate, gridCross } from "./vec.ts";

export interface ForestStats {
  events: number;
  steps: number;
}

interface Edge {
  id: number;
  owner: number;
  lx: number;
  ly: number;
  ux: number;
  uy: number;
  down: boolean;
}
interface Node {
  edge: Edge;
  priority: number;
  left: Node | null;
  right: Node | null;
}
interface Event {
  y: number;
  kind: number;
  x: number;
  edge?: Edge;
  owner?: number;
}

function cross(edge: Edge, x: number, y: number): number {
  return gridCross(
    edge.ux - edge.lx,
    edge.uy - edge.ly,
    x - edge.lx,
    y - edge.ly,
  );
}

function priority(id: number): number {
  let value = (id + 0x9e3779b9) | 0;
  value = (value + 0x7ed55d16 + (value << 12)) | 0;
  value = (value ^ 0xc761c23c ^ (value >>> 19)) | 0;
  value = (value + 0x165667b1 + (value << 5)) | 0;
  value = (value + 0xd3a2646c) ^ (value << 9);
  value = (value + 0xfd7046c5 + (value << 3)) | 0;
  value = (value ^ 0xb55a4f09 ^ (value >>> 16)) | 0;
  return value >>> 0;
}

/** Computes immediate parents after intersection validation. */
export function loopForest(
  grids: readonly (readonly number[])[],
  windings: readonly number[],
  stats?: ForestStats,
): { parents: number[]; depths: number[] } {
  const events: Event[] = [];
  let edgeId = 0;
  for (let owner = 0; owner < grids.length; owner++) {
    const grid = grids[owner];
    if (grid === undefined || grid.length === 0) continue;
    const count = grid.length / 2;
    let minX = coordinate(grid, 0);
    let minY = coordinate(grid, 1);
    for (let i = 0; i < count; i++) {
      const x = coordinate(grid, i * 2);
      const y = coordinate(grid, i * 2 + 1);
      if (y < minY || (y === minY && x < minX)) {
        minX = x;
        minY = y;
      }
      const previous = (i + count - 1) % count;
      const px = coordinate(grid, previous * 2);
      const py = coordinate(grid, previous * 2 + 1);
      if (y === py) continue;
      const down = py > y;
      const edge: Edge = down
        ? { id: edgeId++, owner, lx: x, ly: y, ux: px, uy: py, down }
        : { id: edgeId++, owner, lx: px, ly: py, ux: x, uy: y, down };
      events.push({ y: edge.uy, kind: 0, x: edge.ux, edge });
      events.push({ y: edge.ly, kind: 1, x: edge.lx, edge });
    }
    events.push({ y: minY, kind: 2, x: minX, owner });
  }
  events.sort(
    (a, b) =>
      a.y - b.y ||
      a.kind - b.kind ||
      a.x - b.x ||
      (a.edge?.id ?? a.owner ?? 0) - (b.edge?.id ?? b.owner ?? 0),
  );
  const parents = grids.map(() => -1);
  const depths = grids.map(() => 0);
  let root: Node | null = null;
  const step = () => {
    if (stats) stats.steps++;
  };
  const compare = (a: Edge, b: Edge): number => {
    step();
    if (a.id === b.id) return 0;
    let result: number;
    if (a.ly >= b.ly) {
      result = -cross(b, a.lx, a.ly);
      if (result === 0) result = -cross(b, a.ux, a.uy);
    } else {
      result = cross(a, b.lx, b.ly);
      if (result === 0) result = cross(a, b.ux, b.uy);
    }
    return result === 0 ? a.id - b.id : result < 0 ? -1 : 1;
  };
  const insert = (node: Node | null, item: Node): Node => {
    if (!node) return item;
    step();
    if (compare(item.edge, node.edge) < 0) {
      node.left = insert(node.left, item);
      if (node.left.priority < node.priority) {
        const left = node.left;
        node.left = left.right;
        left.right = node;
        return left;
      }
    } else {
      node.right = insert(node.right, item);
      if (node.right.priority < node.priority) {
        const right = node.right;
        node.right = right.left;
        right.left = node;
        return right;
      }
    }
    return node;
  };
  const merge = (left: Node | null, right: Node | null): Node | null => {
    if (!left) return right;
    if (!right) return left;
    step();
    if (left.priority < right.priority) {
      left.right = merge(left.right, right);
      return left;
    }
    right.left = merge(left, right.left);
    return right;
  };
  const remove = (node: Node | null, edge: Edge): Node | null => {
    if (!node) throw new Error("Missing active edge");
    step();
    const order = compare(edge, node.edge);
    if (order === 0) return merge(node.left, node.right);
    if (order < 0) node.left = remove(node.left, edge);
    else node.right = remove(node.right, edge);
    return node;
  };
  for (const event of events) {
    if (stats) stats.events++;
    if (event.kind === 0 && event.edge) root = remove(root, event.edge);
    else if (event.kind === 1 && event.edge) {
      root = insert(root, {
        edge: event.edge,
        priority: priority(event.edge.id),
        left: null,
        right: null,
      });
    } else if (event.owner !== undefined) {
      let current = root;
      let neighbor: Edge | undefined;
      while (current) {
        step();
        if (cross(current.edge, event.x, event.y) < 0) {
          neighbor = current.edge;
          current = current.right;
        } else current = current.left;
      }
      if (neighbor) {
        const owner = neighbor.owner;
        const inside = neighbor.down !== (windings[owner] ?? 0) < 0;
        parents[event.owner] = inside ? owner : (parents[owner] ?? -1);
        depths[event.owner] = (depths[owner] ?? 0) + (inside ? 1 : 0);
      }
    }
  }
  return { parents, depths };
}
