import { gridCross } from "./vec.ts";

export interface SweepStats {
  events: number;
  steps: number;
  tests: number;
  collapsed: number;
}

interface Edge {
  id: number;
  lx: number;
  ly: number;
  ux: number;
  uy: number;
}
interface Node {
  edge: Edge;
  priority: number;
  left: Node | null;
  right: Node | null;
}
interface Event {
  x: number;
  y: number;
  lower: boolean;
  edge: Edge;
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

/** Proves disjointness; false leaves the decision to the exhaustive search. */
export function provesDisjoint(
  count: number,
  endpoints: (i: number) => readonly [number, number, number, number],
  touches: (i: number, j: number) => boolean,
  stats?: SweepStats,
): boolean {
  const edges: Edge[] = [];
  for (let id = 0; id < count; id++) {
    const [x0, y0, x1, y1] = endpoints(id);
    if (x0 === x1 && y0 === y1) {
      if (stats) stats.collapsed++;
      return false;
    }
    const forward = y0 < y1 || (y0 === y1 && x0 < x1);
    edges.push(
      forward
        ? { id, lx: x0, ly: y0, ux: x1, uy: y1 }
        : { id, lx: x1, ly: y1, ux: x0, uy: y0 },
    );
  }
  const events: Event[] = [];
  for (const edge of edges) {
    events.push({ x: edge.lx, y: edge.ly, lower: true, edge });
    events.push({ x: edge.ux, y: edge.uy, lower: false, edge });
  }
  events.sort((a, b) => a.y - b.y || a.x - b.x || a.edge.id - b.edge.id);
  const step = () => {
    if (stats) stats.steps++;
  };
  const test = (a: Edge | undefined, b: Edge | undefined): boolean => {
    if (!a || !b || a.id === b.id) return false;
    if (
      (a.lx < a.ux ? a.lx : a.ux) > (b.lx > b.ux ? b.lx : b.ux) ||
      (b.lx < b.ux ? b.lx : b.ux) > (a.lx > a.ux ? a.lx : a.ux) ||
      a.ly > b.uy ||
      b.ly > a.uy
    )
      return false;
    if (stats) stats.tests++;
    return touches(a.id, b.id);
  };
  const compare = (a: Edge, b: Edge): number => {
    step();
    if (a.id === b.id) return 0;
    let result: number;
    if (a.ly > b.ly || (a.ly === b.ly && a.lx >= b.lx)) {
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
    if (!node) throw new Error("Missing active segment");
    step();
    const order = compare(edge, node.edge);
    if (order === 0) return merge(node.left, node.right);
    if (order < 0) node.left = remove(node.left, edge);
    else node.right = remove(node.right, edge);
    return node;
  };
  let root: Node | null = null;
  const neighbors = (edge: Edge): [Edge | undefined, Edge | undefined] => {
    let node = root;
    let before: Edge | undefined;
    let after: Edge | undefined;
    while (node) {
      step();
      const order = compare(edge, node.edge);
      if (order < 0) {
        after = node.edge;
        node = node.left;
      } else if (order > 0) {
        before = node.edge;
        node = node.right;
      } else {
        let child = node.left;
        while (child) {
          step();
          before = child.edge;
          child = child.right;
        }
        child = node.right;
        while (child) {
          step();
          after = child.edge;
          child = child.left;
        }
        break;
      }
    }
    return [before, after];
  };
  for (let i = 0; i < events.length; ) {
    const first = events[i];
    if (!first) throw new Error("Missing event");
    let end = i + 1;
    while (
      end < events.length &&
      events[end]?.x === first.x &&
      events[end]?.y === first.y
    )
      end++;
    const group = events.slice(i, end);
    if (stats) stats.events++;
    for (let j = 1; j < group.length; j++) {
      const event = group[j];
      if (event && test(first.edge, event.edge)) return false;
    }
    for (const event of group) {
      if (event.lower) continue;
      const [before, after] = neighbors(event.edge);
      root = remove(root, event.edge);
      if (stats) stats.events++;
      if (test(before, after)) return false;
    }
    let node = root;
    while (node) {
      step();
      const side = cross(node.edge, first.x, first.y);
      if (side === 0) return false;
      node = side < 0 ? node.right : node.left;
    }
    for (const event of group) {
      if (!event.lower) continue;
      const [before, after] = neighbors(event.edge);
      if (test(before, event.edge) || test(event.edge, after)) return false;
      root = insert(root, {
        edge: event.edge,
        priority: priority(event.edge.id),
        left: null,
        right: null,
      });
      if (stats) stats.events++;
    }
    i = end;
  }
  return true;
}
