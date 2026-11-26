import {
  keyCoordinate,
  schematicContactsAt,
  schematicPinAt,
  snapBreadboardPoint,
  type KeyPoint,
  type Store,
  type Vec,
} from "@nodetto/core";
import { coordinateKey, type ElementId } from "@nodetto/ir";

export const SCHEMATIC_LABEL_CROSSING_MESSAGE =
  "Label is on a crossing; add a junction or move the label";
export const SCHEMATIC_COORDINATE_RANGE_MESSAGE =
  "Wire is outside the coordinate range";

type TargetKind =
  | "joinable"
  | "lattice"
  | "t"
  | "label-single"
  | "label-crossing";
export interface SchematicWireTarget {
  readonly snapped: Vec;
  readonly key: KeyPoint;
  readonly kind: TargetKind;
  readonly junctionAt?: KeyPoint;
}

export function classifySchematicWireTarget(
  store: Store,
  pageId: string,
  point: Vec,
  excludeWireId?: ElementId,
): SchematicWireTarget {
  const target = schematicPinAt(store, pageId, point, excludeWireId);
  const lattice = snapBreadboardPoint(point);
  const key = target?.key ?? {
    kx: coordinateKey(lattice.x),
    ky: coordinateKey(lattice.y),
  };
  const contacts = schematicContactsAt(store, pageId, key, excludeWireId);
  const snapped = { x: keyCoordinate(key.kx), y: keyCoordinate(key.ky) };
  if (contacts.labels.length && contacts.joinables === 0) {
    if (contacts.wires.length > 1)
      return { snapped, key, kind: "label-crossing" };
    if (contacts.wires.length === 1)
      return { snapped, key, kind: "label-single", junctionAt: key };
    return { snapped, key, kind: "joinable" };
  }
  if (target || contacts.joinables > 0)
    return { snapped, key, kind: "joinable" };
  if (contacts.wires.length === 1)
    return { snapped, key, kind: "t", junctionAt: key };
  return { snapped, key, kind: "lattice" };
}

function onPath(point: Vec, points: readonly Vec[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    if (
      (a.x === b.x &&
        point.x === a.x &&
        point.y >= Math.min(a.y, b.y) &&
        point.y <= Math.max(a.y, b.y)) ||
      (a.y === b.y &&
        point.y === a.y &&
        point.x >= Math.min(a.x, b.x) &&
        point.x <= Math.max(a.x, b.x))
    )
      return true;
  }
  return false;
}

function extend(points: readonly Vec[], point: Vec, shiftKey: boolean): Vec[] {
  const result = [...points];
  const last = result.at(-1);
  if (!last) return [point];
  const corner = shiftKey
    ? { x: last.x, y: point.y }
    : { x: point.x, y: last.y };
  if (
    (corner.x !== last.x || corner.y !== last.y) &&
    (corner.x !== point.x || corner.y !== point.y)
  )
    result.push(corner);
  if (last.x !== point.x || last.y !== point.y) result.push(point);
  return result;
}

export function resolveSchematicWireClick(
  store: Store,
  pageId: string,
  point: Vec,
  points: readonly Vec[],
  shiftKey: boolean,
) {
  const target = classifySchematicWireTarget(store, pageId, point);
  if (target.kind === "label-crossing")
    return {
      action: "reject" as const,
      points: [...points],
      keys: points.map((p) => ({
        kx: coordinateKey(p.x),
        ky: coordinateKey(p.y),
      })),
      message: SCHEMATIC_LABEL_CROSSING_MESSAGE,
    };
  const next = extend(points, target.snapped, shiftKey);
  const start = points[0];
  return {
    action:
      (target.kind === "joinable" || target.kind === "label-single") &&
      start &&
      (start.x !== target.snapped.x || start.y !== target.snapped.y)
        ? ("finish" as const)
        : ("add" as const),
    points: next,
    keys: next.map((p) => ({ kx: coordinateKey(p.x), ky: coordinateKey(p.y) })),
    pendingJunction: onPath(target.snapped, points)
      ? undefined
      : target.junctionAt,
  };
}

export function schematicWirePreview(
  store: Store,
  pageId: string,
  points: readonly Vec[],
  pointer: Vec,
  shiftKey: boolean,
): Vec[] {
  return extend(
    points,
    classifySchematicWireTarget(store, pageId, pointer).snapped,
    shiftKey,
  );
}
