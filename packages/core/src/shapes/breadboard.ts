import {
  BREADBOARD_ELEMENT_TYPES,
  BREADBOARD_PITCH,
  isBreadboardPartType,
  type BreadboardElementType,
  type BreadboardPartSemantic,
  type Element,
  type ElementId,
  type PageId,
} from "@nodetto/ir";
import {
  boxContains,
  distanceToSegment,
  type Box,
  type Vec,
} from "../geometry.ts";
import type { ShapeUtil } from "../shape-util.ts";
import {
  NETLIST_CARD_SIZE,
  breadboardLocalBox,
  breadboardBox,
  breadboardDefaultSemantic,
  breadboardPins,
  breadboardWirePoints,
} from "../breadboard/catalogue.ts";
import { boardLayout } from "../breadboard/board.ts";

const WIRE_HALF_STROKE = (BREADBOARD_PITCH * 0.45) / 2;
const HIT_RADIUS = 4;

function wireBounds(element: Element): Box | null {
  const points = breadboardWirePoints(element);
  if (points.length < 2) return null;
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  return {
    x: Math.min(...xs) - WIRE_HALF_STROKE,
    y: Math.min(...ys) - WIRE_HALF_STROKE,
    width: Math.max(...xs) - Math.min(...xs) + WIRE_HALF_STROKE * 2,
    height: Math.max(...ys) - Math.min(...ys) + WIRE_HALF_STROKE * 2,
  };
}

function hitWire(element: Element, point: Vec): boolean {
  const points = breadboardWirePoints(element);
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (from && to && distanceToSegment(point, from, to) <= HIT_RADIUS)
      return true;
  }
  return false;
}

export const breadboardShapeUtils: readonly ShapeUtil[] =
  BREADBOARD_ELEMENT_TYPES.map(
    (type): ShapeUtil => ({
      type,
      canResize: false,
      getBounds(element) {
        return type === "breadboard.wire"
          ? wireBounds(element)
          : (breadboardBox(element) ?? null);
      },
      hitTest(element, point) {
        if (type === "breadboard.wire") return hitWire(element, point);
        const box = breadboardBox(element);
        return box !== undefined && boxContains(box, point);
      },
      defaultSemantic() {
        return breadboardDefaultSemantic(type as BreadboardElementType);
      },
      defaultVisual() {
        if (isBreadboardPartType(type)) {
          const semantic = breadboardDefaultSemantic(
            type,
          ) as BreadboardPartSemantic;
          const box = breadboardLocalBox(type, semantic);
          return {
            x: 0,
            y: 0,
            width: box.width * BREADBOARD_PITCH,
            height: box.height * BREADBOARD_PITCH,
          };
        }
        if (type === "breadboard.board") {
          const layout = boardLayout("half");
          return {
            x: 0,
            y: 0,
            width: layout.width * BREADBOARD_PITCH,
            height: layout.height * BREADBOARD_PITCH,
          };
        }
        if (type === "breadboard.netlist") {
          return {
            x: 0,
            y: 0,
            width: NETLIST_CARD_SIZE.width * BREADBOARD_PITCH,
            height: NETLIST_CARD_SIZE.height * BREADBOARD_PITCH,
          };
        }
        return { x: 0, y: 0 };
      },
    }),
  );

export function breadboardPinAt(
  store: { getPageElements(pageId: PageId): readonly Element[] },
  pageId: PageId,
  point: Vec,
): {
  readonly elementId: ElementId;
  readonly pin?: number;
  readonly wireEnd?: 0 | 1;
} | null {
  const elements = store.getPageElements(pageId);
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index];
    if (!element || element.visual.hidden === true) continue;
    if (isBreadboardPartType(element.type)) {
      const found = breadboardPins(element).find(
        (pin) => Math.hypot(pin.x - point.x, pin.y - point.y) <= HIT_RADIUS,
      );
      if (found) return { elementId: element.id, pin: found.number };
    } else if (element.type === "breadboard.wire") {
      const points = breadboardWirePoints(element);
      const [first] = points;
      const last = points.at(-1);
      if (
        first &&
        Math.hypot(first.x - point.x, first.y - point.y) <= HIT_RADIUS
      )
        return { elementId: element.id, wireEnd: 0 };
      if (last && Math.hypot(last.x - point.x, last.y - point.y) <= HIT_RADIUS)
        return { elementId: element.id, wireEnd: 1 };
    }
  }
  return null;
}
