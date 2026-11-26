import {
  SCHEMATIC_ELEMENT_TYPES,
  isSchematicPartType,
  type Element,
  type ElementId,
  type PageId,
  type SchematicWireSemantic,
} from "@nodetto/ir";
import {
  boxContains,
  distanceToSegment,
  type Box,
  type Vec,
} from "../geometry.ts";
import {
  pinKey,
  pointElementKey,
  wirePointKeys,
  type KeyPoint,
} from "../schematic/coordinates.ts";
import {
  schematicBox,
  schematicDefaultSemantic,
  schematicPins,
} from "../schematic/symbols.ts";
import type { ShapeUtil } from "../shape-util.ts";
import { estimatedTextWidth } from "../text-layout.ts";

const RADIUS = 4;
type Store = { getPageElements(pageId: PageId): readonly Element[] };
export type SchematicSnapTarget = {
  readonly key: KeyPoint;
  readonly kind: "pin" | "power" | "wireEnd" | "junction" | "label";
  readonly elementId: ElementId;
  readonly pin?: number;
  readonly end?: 0 | 1;
  readonly x: number;
  readonly y: number;
};

function anchor(element: Element): Vec {
  return { x: element.visual.x ?? 0, y: element.visual.y ?? 0 };
}
function wirePoints(element: Element): readonly Vec[] {
  const origin = anchor(element);
  return (element.semantic as SchematicWireSemantic).points.map((p) => ({
    x: p.x + origin.x,
    y: p.y + origin.y,
  }));
}
function wireHit(
  points: readonly Vec[],
  point: Vec,
  tolerance: number,
): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b && distanceToSegment(point, a, b) <= tolerance) return true;
  }
  return false;
}
function bounds(element: Element): Box | null {
  const { x, y } = anchor(element);
  if (element.type === "schematic.wire") {
    const points = wirePoints(element);
    if (points.length < 2) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return {
      x: minX - 3,
      y: minY - 3,
      width: maxX - minX + 6,
      height: maxY - minY + 6,
    };
  }
  if (
    element.type === "schematic.junction" ||
    element.type === "schematic.noConnect"
  )
    return { x: x - 3, y: y - 3, width: 6, height: 6 };
  if (element.type === "schematic.label")
    return {
      x,
      y: y - 10,
      width: Math.max(
        1,
        estimatedTextWidth((element.semantic as { net: string }).net, 10),
      ),
      height: 10,
    };
  return schematicBox(element) ?? null;
}
export const schematicShapeUtils: readonly ShapeUtil[] =
  SCHEMATIC_ELEMENT_TYPES.map((type) => ({
    type,
    canResize: false,
    getBounds: bounds,
    hitTest(element, point) {
      if (type === "schematic.wire")
        return wireHit(wirePoints(element), point, RADIUS);
      if (type === "schematic.junction" || type === "schematic.noConnect") {
        const p = anchor(element);
        return Math.hypot(point.x - p.x, point.y - p.y) <= RADIUS;
      }
      const box = bounds(element);
      if (!box) return false;
      const rotation = element.visual.rotation;
      const turns = ((((rotation ?? 0) / 90) % 4) + 4) % 4;
      if (
        (isSchematicPartType(type) || type === "schematic.power") &&
        rotation &&
        Number.isFinite(rotation) &&
        turns % 2 === 1
      ) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        return boxContains(
          {
            x: cx - box.height / 2,
            y: cy - box.width / 2,
            width: box.height,
            height: box.width,
          },
          point,
        );
      }
      return boxContains(box, point);
    },
    defaultSemantic() {
      if (isSchematicPartType(type) || type === "schematic.power")
        return schematicDefaultSemantic(type);
      if (type === "schematic.wire")
        return {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
          ],
        };
      if (type === "schematic.label") return { net: "NET" };
      return {};
    },
    defaultVisual: () => ({ x: 0, y: 0 }),
  }));
export function schematicPinAt(
  store: Store,
  pageId: PageId,
  point: Vec,
  excludeId?: ElementId,
): SchematicSnapTarget | undefined {
  let best: SchematicSnapTarget | undefined;
  let distance = RADIUS;
  const consider = (target: SchematicSnapTarget) => {
    const d = Math.hypot(target.x - point.x, target.y - point.y);
    if (d <= RADIUS && (best === undefined || d < distance)) {
      best = target;
      distance = d;
    }
  };
  for (const element of store.getPageElements(pageId)) {
    if (element.visual.hidden || element.id === excludeId) continue;
    if (
      isSchematicPartType(element.type) ||
      element.type === "schematic.power"
    ) {
      for (const pin of schematicPins(element))
        consider({
          kind: element.type === "schematic.power" ? "power" : "pin",
          elementId: element.id,
          pin: pin.number,
          key: pinKey(element, pin),
          x: pin.x,
          y: pin.y,
        });
    } else if (element.type === "schematic.wire") {
      const points = wirePoints(element);
      const first = points[0];
      const last = points.at(-1);
      const keys = wirePointKeys(element);
      const firstKey = keys[0];
      const lastKey = keys.at(-1);
      if (first && firstKey)
        consider({
          kind: "wireEnd",
          elementId: element.id,
          end: 0,
          key: firstKey,
          ...first,
        });
      if (last && lastKey && points.length > 1)
        consider({
          kind: "wireEnd",
          elementId: element.id,
          end: 1,
          key: lastKey,
          ...last,
        });
    } else if (
      element.type === "schematic.junction" ||
      element.type === "schematic.label"
    ) {
      consider({
        kind: element.type === "schematic.junction" ? "junction" : "label",
        elementId: element.id,
        key: pointElementKey(element),
        ...anchor(element),
      });
    }
  }
  return best;
}
export interface SchematicContacts {
  readonly wires: readonly ElementId[];
  readonly labels: readonly ElementId[];
  readonly joinables: number;
}

function sameKey(a: KeyPoint, b: KeyPoint): boolean {
  return a.kx === b.kx && a.ky === b.ky;
}

export function schematicContactsAt(
  store: Store,
  pageId: PageId,
  key: KeyPoint,
  excludeId?: ElementId,
): SchematicContacts {
  const wires: ElementId[] = [];
  const labels: ElementId[] = [];
  let joinables = 0;
  for (const element of store.getPageElements(pageId)) {
    if (element.visual.hidden || element.id === excludeId) continue;
    if (
      isSchematicPartType(element.type) ||
      element.type === "schematic.power"
    ) {
      for (const pin of schematicPins(element)) {
        if (sameKey(pinKey(element, pin), key)) joinables++;
      }
    } else if (element.type === "schematic.wire") {
      const points = wirePointKeys(element);
      const first = points[0];
      const last = points.at(-1);
      if (first && sameKey(first, key)) joinables++;
      if (points.length > 1 && last && sameKey(last, key)) joinables++;
      if (!first || !last || sameKey(first, key) || sameKey(last, key))
        continue;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (!a || !b || sameKey(a, b)) continue;
        if (
          (a.ky === b.ky &&
            key.ky === a.ky &&
            key.kx >= Math.min(a.kx, b.kx) &&
            key.kx <= Math.max(a.kx, b.kx)) ||
          (a.kx === b.kx &&
            key.kx === a.kx &&
            key.ky >= Math.min(a.ky, b.ky) &&
            key.ky <= Math.max(a.ky, b.ky))
        ) {
          wires.push(element.id);
          break;
        }
      }
    } else if (element.type === "schematic.label") {
      if (sameKey(pointElementKey(element), key)) labels.push(element.id);
    } else if (element.type === "schematic.junction") {
      if (sameKey(pointElementKey(element), key)) joinables++;
    }
  }
  return { wires, labels, joinables };
}

export function schematicWireInteriorAt(
  store: Store,
  pageId: PageId,
  point: Vec,
): readonly ElementId[] {
  const result: ElementId[] = [];
  for (const element of store.getPageElements(pageId)) {
    if (element.type !== "schematic.wire" || element.visual.hidden) continue;
    const points = wirePoints(element);
    const first = points[0];
    const last = points.at(-1);
    if (
      !first ||
      !last ||
      (point.x === first.x && point.y === first.y) ||
      (point.x === last.x && point.y === last.y)
    )
      continue;
    if (wireHit(points, point, 1e-9)) result.push(element.id);
  }
  return result;
}
