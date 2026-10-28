// Gestures that transform elements in place: dragging the selection,
// reordering sequence lanes, and the resize and rotation handles. Each one
// opens a history batch when it starts; the lifecycle closes it.

import type { Box, Vec } from "@nodetto/core";
import {
  canResizeSelection,
  canRotateElement,
  canRotateSelection,
  compareFractional,
  createSelectionResizeSnapshot,
  isBreadboardSnapTarget,
  resizeSelection,
  rotateElement,
  rotateSelectionBy,
  snapBreadboardDelta,
  snapResize,
  snapTranslate,
  unionBoxes,
} from "@nodetto/core";
import { type ElementId, isDatabaseObjectType } from "@nodetto/ir";
import type { InteractionContext } from "./context.ts";
import { CLICK_SLOP_PX } from "./events.ts";
import {
  type ResizeHandle,
  boxCentre,
  clampBox,
  handleEdges,
  resizeBoxConstrained,
  resizeRotatedBox,
} from "./geometry.ts";
import type { GestureLifecycle } from "./lifecycle.ts";
import type { Snapping } from "./snapping.ts";
import type { GestureOf } from "./types.ts";

export interface TransformGestures {
  beginTranslate(
    event: PointerEvent,
    startPage: Vec,
    clickTarget: ElementId | null,
  ): boolean;
  beginSequenceReorder(
    id: ElementId,
    event: PointerEvent,
    clickTarget: ElementId | null,
  ): boolean;
  moveSequenceReorder(
    gesture: GestureOf<"sequence-reorder">,
    event: PointerEvent,
  ): void;
  moveTranslating(gesture: GestureOf<"translating">, event: PointerEvent): void;
  moveResizing(gesture: GestureOf<"resizing">, event: PointerEvent): void;
  moveResizingSelection(
    gesture: GestureOf<"resizing-selection">,
    event: PointerEvent,
  ): void;
  moveRotating(gesture: GestureOf<"rotating">, event: PointerEvent): void;
  moveRotatingSelection(
    gesture: GestureOf<"rotating-selection">,
    event: PointerEvent,
  ): void;
  startRotate(id: ElementId, event: PointerEvent): void;
  startRotateSelection(center: Vec, event: PointerEvent): void;
  startResize(id: ElementId, handle: ResizeHandle, event: PointerEvent): void;
  startResizeSelection(handle: ResizeHandle, event: PointerEvent): void;
}

export function createTransformGestures(
  ctx: InteractionContext,
  snapping: Snapping,
  lifecycle: GestureLifecycle,
): TransformGestures {
  const { editor, state } = ctx;
  const { snapCandidates, layoutGridFor, snapFor } = snapping;
  const { owns, claim } = lifecycle;

  const beginTranslate = (
    event: PointerEvent,
    startPage: Vec,
    clickTarget: ElementId | null,
  ): boolean => {
    const origins = new Map<ElementId, Vec>();
    const movable = editor.movableSelection();
    for (const origin of movable) {
      origins.set(origin.id, { x: origin.x, y: origin.y });
    }
    if (origins.size === 0) {
      return false;
    }
    const context = editor.createShapeContext();
    const boxes: Box[] = [];
    for (const id of origins.keys()) {
      const bounds = context.boundsOf(id);
      if (bounds) {
        boxes.push(bounds);
      }
    }
    // Everything the selection reaches stays out of the candidates: a group
    // member must not snap to its own group's other members mid-drag.
    const excluded = new Set<ElementId>(origins.keys());
    for (const id of editor.selection.ids()) {
      excluded.add(id);
    }
    editor.beginBatch();
    state.gesture = {
      kind: "translating",
      startPage,
      startScreen: ctx.screenPoint(event),
      origins,
      startBounds: unionBoxes(boxes),
      candidates: snapCandidates(excluded),
      layoutGrid: layoutGridFor(editor.selection.ids()),
      clickTarget,
      moved: false,
    };
    state.dragSampleSuperseded = false;
    return true;
  };

  /** Sequence layers reorder on their constrained semantic axis. */
  const beginSequenceReorder = (
    id: ElementId,
    event: PointerEvent,
    clickTarget: ElementId | null,
  ): boolean => {
    const element = editor.store.get(id);
    if (
      !element ||
      (element.type !== "sequence.participant" &&
        element.type !== "sequence.message") ||
      editor.selection.size !== 1 ||
      !editor.selection.has(id) ||
      editor.createShapeContext().isLocked?.(id)
    )
      return false;
    editor.beginBatch();
    state.gesture = {
      kind: "sequence-reorder",
      id,
      axis: element.type === "sequence.participant" ? "x" : "y",
      startScreen: ctx.screenPoint(event),
      clickTarget,
      moved: false,
    };
    return true;
  };

  const moveSequenceReorder = (
    gesture: GestureOf<"sequence-reorder">,
    event: PointerEvent,
  ): void => {
    const screen = ctx.screenPoint(event);
    if (
      Math.abs(screen.x - gesture.startScreen.x) > CLICK_SLOP_PX ||
      Math.abs(screen.y - gesture.startScreen.y) > CLICK_SLOP_PX
    )
      gesture.moved = true;
    if (!gesture.moved) return;
    const { id, axis } = gesture;
    const current = editor.store.get(id);
    if (!current) return;
    const peers = editor.store
      .getPageElements(current.page)
      .filter((element) => element.type === current.type)
      .sort((left, right) => {
        const a = (left.semantic as { order: string }).order;
        const b = (right.semantic as { order: string }).order;
        return compareFractional(a, b) || compareFractional(left.id, right.id);
      });
    const coordinate = ctx.pagePoint(event)[axis];
    let desired = peers.findIndex((element) => element.id === id);
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < peers.length; index += 1) {
      const peer = peers[index];
      if (!peer) continue;
      const bounds = editor.getBounds(peer.id);
      if (!bounds) continue;
      const center =
        axis === "x"
          ? bounds.x + bounds.width / 2
          : bounds.y + bounds.height / 2;
      const nextDistance = Math.abs(coordinate - center);
      if (nextDistance < distance) {
        desired = index;
        distance = nextDistance;
      }
    }
    let at = peers.findIndex((element) => element.id === id);
    while (at !== desired) {
      const delta = at < desired ? 1 : -1;
      if (!editor.moveSequenceElement(id, delta)) break;
      at += delta;
    }
  };

  const moveTranslating = (
    gesture: GestureOf<"translating">,
    event: PointerEvent,
  ): void => {
    const point = ctx.pagePoint(event);
    const screen = ctx.screenPoint(event);
    if (
      Math.abs(screen.x - gesture.startScreen.x) > CLICK_SLOP_PX ||
      Math.abs(screen.y - gesture.startScreen.y) > CLICK_SLOP_PX
    ) {
      gesture.moved = true;
    }
    let dx = point.x - gesture.startPage.x;
    let dy = point.y - gesture.startPage.y;
    const snap = snapFor(event, gesture.layoutGrid);
    if (
      snap &&
      isBreadboardSnapTarget(editor.store, [...gesture.origins.keys()])
    ) {
      const delta = snapBreadboardDelta(
        editor.store,
        editor.currentPageId,
        [...gesture.origins.keys()],
        { x: dx, y: dy },
      );
      dx = delta.x;
      dy = delta.y;
      ctx.clearGuides();
    } else if (snap && gesture.startBounds) {
      // The union box of everything moving is what lines up with the
      // neighbours; the same correction then applies to every element.
      const moving: Box = {
        ...gesture.startBounds,
        x: gesture.startBounds.x + dx,
        y: gesture.startBounds.y + dy,
      };
      const result = snapTranslate(
        moving,
        snap.objects ? gesture.candidates : [],
        snap.options,
      );
      dx += result.dx;
      dy += result.dy;
      ctx.setGuides(result.guides);
    } else {
      ctx.clearGuides();
    }
    editor.moveElements(
      [...gesture.origins].map(([id, origin]) => ({
        id,
        x: origin.x + dx,
        y: origin.y + dy,
      })),
    );
  };

  const moveResizing = (
    gesture: GestureOf<"resizing">,
    event: PointerEvent,
  ): void => {
    const point = ctx.pagePoint(event);
    let box = resizeRotatedBox(
      gesture.startBox,
      gesture.handle,
      point.x - gesture.startPage.x,
      point.y - gesture.startPage.y,
      gesture.rotation,
      {
        keepAspect:
          !gesture.derivedHeight &&
          (event.shiftKey || gesture.aspectRatio !== undefined),
        aspectRatio: gesture.aspectRatio,
        fromCenter: event.altKey,
      },
    );
    const snap = gesture.rotation ? null : snapFor(event, gesture.layoutGrid);
    if (snap) {
      const result = snapResize(
        box,
        handleEdges(gesture.handle),
        snap.objects ? gesture.candidates : [],
        snap.options,
      );
      box = clampBox(result.box);
      ctx.setGuides(result.guides);
    } else {
      ctx.clearGuides();
    }
    editor.resizeElement(gesture.id, box);
  };

  const moveResizingSelection = (
    gesture: GestureOf<"resizing-selection">,
    event: PointerEvent,
  ): void => {
    const point = ctx.pagePoint(event);
    let box = resizeBoxConstrained(
      gesture.snapshot.bounds,
      gesture.handle,
      point.x - gesture.startPage.x,
      point.y - gesture.startPage.y,
      { keepAspect: event.shiftKey, fromCenter: event.altKey },
    );
    const snap = snapFor(event, gesture.layoutGrid);
    if (snap) {
      const result = snapResize(
        box,
        handleEdges(gesture.handle),
        snap.objects ? gesture.candidates : [],
        snap.options,
      );
      box = clampBox(result.box);
      ctx.setGuides(result.guides);
    } else {
      ctx.clearGuides();
    }
    resizeSelection(editor, gesture.snapshot, box);
  };

  const moveRotating = (
    gesture: GestureOf<"rotating">,
    event: PointerEvent,
  ): void => {
    const point = ctx.pagePoint(event);
    if (Math.hypot(point.x - gesture.center.x, point.y - gesture.center.y) < 1)
      return;
    const angle = Math.atan2(
      point.y - gesture.center.y,
      point.x - gesture.center.x,
    );
    const degrees =
      gesture.rotation + ((angle - gesture.startAngle) * 180) / Math.PI;
    rotateElement(
      editor,
      gesture.id,
      event.shiftKey ? Math.round(degrees / 15) * 15 : degrees,
    );
  };

  const moveRotatingSelection = (
    gesture: GestureOf<"rotating-selection">,
    event: PointerEvent,
  ): void => {
    const point = ctx.pagePoint(event);
    if (Math.hypot(point.x - gesture.center.x, point.y - gesture.center.y) < 1)
      return;
    const angle = Math.atan2(
      point.y - gesture.center.y,
      point.x - gesture.center.x,
    );
    const raw = ((angle - gesture.startAngle) * 180) / Math.PI;
    const degrees = event.shiftKey ? Math.round(raw / 15) * 15 : raw;
    const delta = degrees - gesture.lastDegrees;
    if (rotateSelectionBy(editor, delta, gesture.center))
      gesture.lastDegrees = degrees;
  };

  // --------------------------------------------------------------- handles

  const startRotate = (id: ElementId, event: PointerEvent): void => {
    const element = editor.store.get(id);
    const box = editor.getBounds(id);
    const context = editor.createShapeContext();
    if (
      !owns(event) ||
      event.button !== 0 ||
      !element ||
      !box ||
      !canRotateElement(element) ||
      context.isLocked?.(id) ||
      context.isHidden?.(id)
    )
      return;
    const center = boxCentre(box);
    const point = ctx.pagePoint(event);
    if (Math.hypot(point.x - center.x, point.y - center.y) < 1) return;
    event.stopPropagation();
    claim(event);
    editor.beginBatch();
    state.gesture = {
      kind: "rotating",
      id,
      center,
      startAngle: Math.atan2(point.y - center.y, point.x - center.x),
      rotation: element.visual.rotation ?? 0,
    };
  };

  const startRotateSelection = (center: Vec, event: PointerEvent): void => {
    if (!owns(event) || event.button !== 0 || !canRotateSelection(editor))
      return;
    const point = ctx.pagePoint(event);
    if (Math.hypot(point.x - center.x, point.y - center.y) < 1) return;
    event.stopPropagation();
    claim(event);
    editor.beginBatch();
    state.gesture = {
      kind: "rotating-selection",
      center,
      startAngle: Math.atan2(point.y - center.y, point.x - center.x),
      lastDegrees: 0,
    };
  };

  const startResize = (
    id: ElementId,
    handle: ResizeHandle,
    event: PointerEvent,
  ): void => {
    const element = editor.store.get(id);
    if (
      !owns(event) ||
      !element ||
      editor.createShapeContext().isLocked?.(id)
    ) {
      return;
    }
    const startBox = editor.getBounds(id);
    if (!startBox) {
      return;
    }
    const derivedHeight =
      element.type === "erd.table" ||
      element.type === "uml.class" ||
      isDatabaseObjectType(element.type);
    if (derivedHeight && handle !== "e" && handle !== "w") return;
    event.stopPropagation();
    // Same recovery as `onPointerDown`: never open a batch over an open one.
    claim(event);
    editor.beginBatch();
    state.gesture = {
      kind: "resizing",
      rotation: element.visual.rotation ?? 0,
      id,
      handle,
      startPage: ctx.pagePoint(event),
      startBox,
      candidates: snapCandidates(new Set([id])),
      layoutGrid: layoutGridFor([id]),
      derivedHeight,
      ...(element.visual.aspectRatio === undefined
        ? {}
        : { aspectRatio: element.visual.aspectRatio }),
    };
  };

  const startResizeSelection = (
    handle: ResizeHandle,
    event: PointerEvent,
  ): void => {
    if (!owns(event) || event.button !== 0 || !canResizeSelection(editor))
      return;
    const snapshot = createSelectionResizeSnapshot(editor);
    if (!snapshot) return;
    event.stopPropagation();
    claim(event);
    editor.beginBatch();
    state.gesture = {
      kind: "resizing-selection",
      snapshot,
      handle,
      startPage: ctx.pagePoint(event),
      candidates: snapCandidates(
        new Set([...snapshot.roots, ...snapshot.items.map((item) => item.id)]),
      ),
      layoutGrid: layoutGridFor(snapshot.roots),
    };
  };

  return {
    beginTranslate,
    beginSequenceReorder,
    moveSequenceReorder,
    moveTranslating,
    moveResizing,
    moveResizingSelection,
    moveRotating,
    moveRotatingSelection,
    startRotate,
    startRotateSelection,
    startResize,
    startResizeSelection,
  };
}
