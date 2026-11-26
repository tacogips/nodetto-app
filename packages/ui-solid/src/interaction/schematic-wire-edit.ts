import type { Vec } from "@nodetto/core";

/** Reroute adjacent segments without moving any other stored wire point. */
export function rerouteSchematicWirePoint(
  local: readonly Vec[],
  index: number,
  target: Vec,
): { points: Vec[]; index: number } | null {
  const original = local[index];
  if (!original || !Number.isInteger(index) || local.length < 2) return null;
  const same = (a: Vec, b: Vec) => a.x === b.x && a.y === b.y;
  const orthogonal = (a: Vec, b: Vec) => a.x === b.x || a.y === b.y;
  for (let i = 1; i < local.length; i += 1) {
    const a = local[i - 1];
    const b = local[i];
    if (!a || !b || !orthogonal(a, b)) return null;
  }

  const points: Vec[] = [];
  let movedIndex = -1;
  const append = (point: Vec, moved = false) => {
    const last = points.at(-1);
    if (!last || !same(last, point)) points.push({ ...point });
    if (moved) movedIndex = points.length - 1;
  };
  const elbow = (neighbour: Vec): Vec | null => {
    if (orthogonal(neighbour, target)) return null;
    if (neighbour.y === original.y) return { x: target.x, y: neighbour.y };
    if (neighbour.x === original.x) return { x: neighbour.x, y: target.y };
    return null;
  };

  for (let i = 0; i < local.length; i += 1) {
    const point = local[i];
    if (!point) return null;
    if (i === index) {
      const previous = local[i - 1];
      if (previous && !orthogonal(previous, target)) {
        const bend = elbow(previous);
        if (!bend) return null;
        append(bend);
      }
      append(target, true);
      const next = local[i + 1];
      if (next && !orthogonal(next, target)) {
        const bend = elbow(next);
        if (!bend) return null;
        append(bend);
      }
    } else {
      append(point);
    }
  }
  if (points.length < 2 || movedIndex < 0) return null;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b || !orthogonal(a, b)) return null;
  }
  return { points, index: movedIndex };
}
