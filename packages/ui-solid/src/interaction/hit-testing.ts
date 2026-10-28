// What lies under a page point: the element a press hits, the elements a
// marquee covers, and the element and port a connector end would land on.

import type { Box, Vec } from "@nodetto/core";
import {
  boxContains,
  connectionPorts,
  insideClip,
  isGroup,
  overlapsVisibleElement,
  rotatePoint,
} from "@nodetto/core";
import {
  CONNECTOR_ENDPOINT_TYPES,
  isPcbElementType,
  type Element,
  type ElementId,
} from "@nodetto/ir";
import { isPcbElementShown, pcbHiddenLayers } from "../pcb-state.ts";
import { Tool, typedConnectorFor } from "../tools.ts";
import type { InteractionContext } from "./context.ts";
import { boxCentre, isSolid } from "./geometry.ts";

export type NearestPort = ReturnType<typeof connectionPorts>[number];

export interface HitTesting {
  /** `editor.hitTest`, skipping PCB layers the board view hides. */
  canvasHitTest(point: Vec): ElementId | null;
  elementsIn(rect: Box): ElementId[];
  nearestPort(id: ElementId, point: Vec): NearestPort | undefined;
  targetUnder(point: Vec, excluded: readonly ElementId[]): ElementId | null;
  acceptsEndpoint(type: string | undefined, id: ElementId): boolean;
}

export function createHitTesting(ctx: InteractionContext): HitTesting {
  const { editor, options, state } = ctx;

  const canvasHitTest = (point: Vec): ElementId | null => {
    if (!ctx.isPcbPage()) return editor.hitTest(point);
    const context = editor.createShapeContext();
    const elements = editor.store.getPageElements(editor.currentPageId);
    const hidden = pcbHiddenLayers(editor.currentPageId);
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index] as Element | undefined;
      if (
        !element ||
        context.isHidden?.(element.id) ||
        context.isLocked?.(element.id)
      )
        continue;
      if (isPcbElementType(element.type) && !isPcbElementShown(element, hidden))
        continue;
      if (isGroup(element)) continue;
      if (editor.getShapeUtil(element.type).hitTest(element, point, context))
        return element.id;
    }
    return null;
  };

  /** Elements on the current page whose bounds overlap `rect`. */
  const elementsIn = (rect: Box): ElementId[] => {
    const out: ElementId[] = [];
    // One context for the whole scan: bounds lookups share the store view.
    const context = editor.createShapeContext();
    for (const element of editor.store.getPageElements(editor.currentPageId)) {
      // Members resolve to their outermost group after testing; a group's
      // aggregate bounds would select empty space between rotated members.
      if (isGroup(element)) continue;
      if (context.isHidden?.(element.id) || context.isLocked?.(element.id))
        continue;
      if (overlapsVisibleElement(element, rect, context)) {
        out.push(element.id);
      }
    }
    return out;
  };

  const nearestPort = (id: ElementId, point: Vec) => {
    const element = editor.store.get(id);
    const context = editor.createShapeContext();
    if (!element || context.isHidden?.(id) || context.isLocked?.(id))
      return undefined;
    let nearest: NearestPort | undefined;
    let distance = 12 / editor.camera.get().z;
    for (const port of connectionPorts(element, context)) {
      const gap = Math.hypot(point.x - port.point.x, point.y - port.point.y);
      if (gap <= distance && insideClip(context, id, port.point)) {
        nearest = port;
        distance = gap;
      }
    }
    return nearest;
  };

  /**
   * The topmost solid element under `point`, skipping `excluded`. Unlike
   * `editor.hitTest` this looks past a connector lying over a shape, which
   * is what a connector end being dropped needs.
   */
  const targetUnder = (
    point: Vec,
    excluded: readonly ElementId[],
  ): ElementId | null => {
    const context = editor.createShapeContext();
    const elements = editor.store.getPageElements(editor.currentPageId);
    for (let at = elements.length - 1; at >= 0; at -= 1) {
      const element = elements[at] as Element;
      if (context.isHidden?.(element.id) || context.isLocked?.(element.id))
        continue;
      if (excluded.includes(element.id) || !isSolid(element)) {
        continue;
      }
      const gesture = state.gesture;
      const type =
        gesture.kind === "reconnecting"
          ? editor.store.get(gesture.id)?.type
          : typedConnectorFor(options.tool());
      if (!acceptsEndpoint(type, element.id)) continue;
      if (nearestPort(element.id, point)) return element.id;
      if (!insideClip(context, element.id, point)) continue;
      const box = context.boundsOf(element.id);
      const local =
        box && element.visual.rotation
          ? rotatePoint(point, boxCentre(box), -element.visual.rotation)
          : point;
      const transition =
        options.tool() === Tool.ScreenTransition ||
        (gesture.kind === "reconnecting" &&
          editor.store.get(gesture.id)?.type === "edge.generic" &&
          (editor.store.get(gesture.id)?.semantic as { prototype?: boolean })
            .prototype === true);
      if (
        (transition &&
          element.type === "frame" &&
          box &&
          boxContains(box, local)) ||
        editor.getShapeUtil(element.type).hitTest(element, local, context)
      ) {
        return element.id;
      }
    }
    return null;
  };

  const acceptsEndpoint = (type: string | undefined, id: ElementId): boolean =>
    !type ||
    !Object.hasOwn(CONNECTOR_ENDPOINT_TYPES, type) ||
    Boolean(
      CONNECTOR_ENDPOINT_TYPES[type]?.includes(
        editor.store.get(id)?.type ?? "",
      ),
    );

  return {
    canvasHitTest,
    elementsIn,
    nearestPort,
    targetUnder,
    acceptsEndpoint,
  };
}
