// Pointer, wheel and double-click handlers: they pick the gesture a press
// starts, route every move to the running gesture (paced to repaint frames
// when the host asks), and commit or cancel it on release.

import { ancestorChain, normalizeBox, outermostGroupOf } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import { Tool, creationFor, isConnectorTool } from "../tools.ts";
import type { CircuitTools } from "./circuit.ts";
import type { ConnectorGestures } from "./connectors.ts";
import type { ContextMenus } from "./context-menu.ts";
import type { InteractionContext } from "./context.ts";
import type { CreationTools } from "./creation.ts";
import { CLICK_SLOP_PX, insideSlot, wheelPixels } from "./events.ts";
import { MANUAL_ROUTE_TYPES, editRegionAt } from "./geometry.ts";
import type { HitTesting } from "./hit-testing.ts";
import type { GestureLifecycle } from "./lifecycle.ts";
import type { TransformGestures } from "./transform.ts";

export interface PointerHandlers {
  onPointerDown(event: PointerEvent): void;
  applyPointerMove(event: PointerEvent): void;
  onPointerMove(event: PointerEvent): void;
  onPointerUp(event: PointerEvent): void;
  onPointerCancel(event: PointerEvent): void;
  onWheel(event: WheelEvent): void;
  onDoubleClick(event: MouseEvent): void;
}

export interface PointerDependencies {
  readonly hits: HitTesting;
  readonly lifecycle: GestureLifecycle;
  readonly transform: TransformGestures;
  readonly connectors: ConnectorGestures;
  readonly circuit: CircuitTools;
  readonly creation: CreationTools;
  readonly menus: ContextMenus;
}

export function createPointerHandlers(
  ctx: InteractionContext,
  deps: PointerDependencies,
): PointerHandlers {
  const { editor, options, state } = ctx;
  const { hits, lifecycle, transform, connectors, circuit, creation, menus } =
    deps;
  const { cancelGesture, finishGesture, discardStaleTransform } = lifecycle;

  /**
   * Selection for a click on `hit` (design 3.1). Returns what the release
   * should select if the pointer does not travel, or `null` when the press
   * already settled it.
   */
  const selectOnPress = (hit: ElementId, shift: boolean): ElementId | null => {
    const chain = ancestorChain(editor.store, hit);
    const selectedAncestor = chain.find((id) => editor.selection.has(id));
    if (shift) {
      // Shift toggles the unit the user sees: the selected group when one
      // holds the hit, the outermost group otherwise.
      editor.selection.toggle(
        selectedAncestor ?? chain[chain.length - 1] ?? hit,
      );
      return null;
    }
    const target = editor.resolveSelectionTarget(hit);
    if (editor.selection.has(target)) {
      // Already selected: a plain click narrows a multi-selection to it,
      // but only once the release proves it was not the start of a drag.
      return editor.selection.size > 1 ? target : null;
    }
    if (selectedAncestor !== undefined) {
      // Drill in one level, but on release: dragging a selected group by
      // one of its members must move the group, not pick the member.
      return target;
    }
    editor.selection.set([target]);
    return null;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 1 && event.button !== 2) {
      return;
    }
    // The inline editor and anything else in the slot layer handle their
    // own pointer; a click in a textarea must not start a marquee under it.
    if (insideSlot(event.target)) {
      return;
    }
    // A second contact while a gesture is running — a middle click during a
    // drag, a second finger, a pen alongside a touch — is not a new gesture.
    // Starting one would open a second history batch and close only one.
    if (!lifecycle.owns(event)) {
      return;
    }
    // The owning pointer pressing again means its release went missing (it
    // happens when the window loses the pointer). Close the stale gesture so
    // the batch it opened is accounted for before this one opens another.
    lifecycle.claim(event);
    state.suppressPointerContextMenu = false;
    options.container()?.focus();
    const requestedTool = options.tool();
    const tool =
      editor.readOnly && requestedTool !== "hand" ? "select" : requestedTool;
    if (state.pcbTrackState && tool !== Tool.PcbTrack) {
      state.pcbTrackState = null;
      ctx.setPcbDraftPoints(null);
    }
    const point = ctx.pagePoint(event);
    state.lastPointer = { screen: ctx.screenPoint(event), page: point };
    if (ctx.isBreadboardPage() && requestedTool !== Tool.BreadboardWire) {
      editor.setBreadboardProbe(null);
    }

    // Middle/right buttons, the hand tool and held space always pan, whatever else
    // is active.
    if (
      event.button === 1 ||
      event.button === 2 ||
      tool === "hand" ||
      state.spaceHeld
    ) {
      state.gesture = {
        kind: "panning",
        lastScreen: ctx.screenPoint(event),
        rightButton: event.button === 2,
        moved: false,
      };
      ctx.setPanning(true);
      if (event.button === 2) event.preventDefault();
      return;
    }

    if (creationFor(tool)) {
      creation.placeShape(point, tool);
      return;
    }

    if (tool === "comment") {
      options.onCommentPlace?.(point);
      options.setTool("select");
      return;
    }

    if (isConnectorTool(tool)) {
      const source = hits.targetUnder(point, []);
      if (source) connectors.beginConnect(source, point);
      else if (tool === Tool.Connector) {
        state.gesture = {
          kind: "connecting",
          from: "",
          fromPoint: point,
          startPage: point,
          connectorType: "edge.generic",
        };
        ctx.setPending({ from: point, to: point });
      }
      return;
    }

    const hit = hits.canvasHitTest(point);

    if (!hit) {
      // Empty canvas with the select tool starts a marquee; shift keeps the
      // existing selection as the base the brush adds to. Panning stays on
      // the hand tool and the middle button, handled above.
      const base = event.shiftKey ? [...editor.selection.ids()] : [];
      if (!event.shiftKey) {
        editor.selection.clear();
      }
      state.gesture = { kind: "marquee", startPage: point, base };
      ctx.setMarquee({ x: point.x, y: point.y, width: 0, height: 0 });
      return;
    }

    const clickTarget = selectOnPress(hit, event.shiftKey);
    if (editor.readOnly) return;
    if (transform.beginSequenceReorder(hit, event, clickTarget)) return;
    if (!transform.beginTranslate(event, point, clickTarget)) {
      if (clickTarget !== null) {
        editor.selection.set([clickTarget]);
      }
      state.gesture = { kind: "panning", lastScreen: ctx.screenPoint(event) };
    }
  };

  const applyPointerMove = (event: PointerEvent): void => {
    if (discardStaleTransform()) return;
    if (
      editor.readOnly &&
      state.gesture.kind !== "panning" &&
      state.gesture.kind !== "marquee" &&
      state.gesture.kind !== "idle"
    ) {
      cancelGesture();
      return;
    }
    if (event.pointerId !== state.activePointerId) {
      return;
    }
    const gesture = state.gesture;
    if (
      gesture.kind === "routing-bend" ||
      gesture.kind === "routing-waypoint"
    ) {
      const now = ctx.screenPoint(event);
      if (
        !gesture.moved &&
        Math.hypot(
          now.x - gesture.startScreen.x,
          now.y - gesture.startScreen.y,
        ) <= CLICK_SLOP_PX
      )
        return;
      gesture.moved = true;
    }
    switch (gesture.kind) {
      case "panning": {
        const now = ctx.screenPoint(event);
        if (
          gesture.rightButton &&
          !gesture.moved &&
          Math.hypot(
            now.x - gesture.lastScreen.x,
            now.y - gesture.lastScreen.y,
          ) <= CLICK_SLOP_PX
        )
          return;
        gesture.moved = true;
        editor.camera.panBy(
          now.x - gesture.lastScreen.x,
          now.y - gesture.lastScreen.y,
        );
        gesture.lastScreen = now;
        return;
      }
      case "sequence-reorder":
        transform.moveSequenceReorder(gesture, event);
        return;
      case "translating":
        transform.moveTranslating(gesture, event);
        return;
      case "resizing":
        transform.moveResizing(gesture, event);
        return;
      case "resizing-selection":
        transform.moveResizingSelection(gesture, event);
        return;
      case "routing-bend":
        connectors.moveRoutingBend(gesture, event);
        return;
      case "routing-waypoint":
        connectors.moveRoutingWaypoint(gesture, event);
        return;
      case "breadboard-wire-point":
        circuit.moveWirePoint(gesture, event);
        return;
      case "rotating":
        transform.moveRotating(gesture, event);
        return;
      case "rotating-selection":
        transform.moveRotatingSelection(gesture, event);
        return;
      case "connecting":
        connectors.moveConnecting(gesture, event);
        return;
      case "reconnecting":
        connectors.moveReconnecting(gesture, event);
        return;
      case "marquee": {
        const point = ctx.pagePoint(event);
        const rect = normalizeBox(gesture.startPage, point);
        ctx.setMarquee(rect);
        // Selection updates live so both this window and every remote peer
        // watch it grow, not just see the result on release. Only when the
        // membership actually changed, though: Selection.set notifies
        // unconditionally, and in cloud mode every notification becomes an
        // awareness publish — per-pointermove would flood the socket.
        const ids = new Set(gesture.base);
        for (const id of hits.elementsIn(rect)) {
          // A brush picks up groups, not their members (design 3.1).
          ids.add(outermostGroupOf(editor.store, id));
        }
        const current = editor.selection.ids();
        const unchanged =
          editor.selection.size === ids.size &&
          [...current].every((id) => ids.has(id));
        if (!unchanged) {
          editor.selection.set([...ids]);
        }
        return;
      }
      default:
        return;
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (state.gesture.kind === "idle") {
      ctx.setHoverTarget(
        !editor.readOnly && isConnectorTool(options.tool())
          ? hits.targetUnder(ctx.pagePoint(event), [])
          : null,
      );
      circuit.updateIdleHover(event);
    }
    if (
      options.scheduleDragFrame &&
      ctx.framePacedGesture() &&
      !editor.readOnly &&
      event.pointerId === state.activePointerId
    ) {
      state.queuedDrag = event;
      state.queuedDragRevision = editor.revision;
      state.dragSampleSuperseded = false;
      if (!state.cancelDragFrame) {
        state.cancelDragFrame = options.scheduleDragFrame(() => {
          const latest =
            state.queuedDragRevision === editor.revision
              ? state.queuedDrag
              : null;
          state.dragSampleSuperseded =
            state.queuedDrag !== null && latest === null;
          state.queuedDrag = null;
          state.cancelDragFrame = null;
          if (editor.readOnly) cancelGesture();
          else if (latest) {
            applyPointerMove(latest);
            state.dragAppliedRevision = editor.revision;
          }
        });
      }
      return;
    }
    applyPointerMove(event);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== state.activePointerId) {
      return;
    }
    if (state.gesture.kind === "panning" && state.gesture.rightButton) {
      applyPointerMove(event);
      const showMenu = !state.gesture.moved;
      ctx.release(event);
      state.activePointerId = null;
      finishGesture();
      state.suppressPointerContextMenu = true;
      if (showMenu) menus.contextMenuAt(ctx.screenPoint(event));
      return;
    }
    discardStaleTransform();
    const superseded =
      state.dragSampleSuperseded ||
      (state.queuedDrag !== null &&
        state.queuedDragRevision !== editor.revision) ||
      (state.queuedDrag === null &&
        state.dragAppliedRevision !== null &&
        state.dragAppliedRevision !== editor.revision);
    if (superseded) ctx.discardDragFrame();
    // Never commit a stale frame, or let a queued update run after endBatch.
    // A click without movement must retain its existing selection semantics.
    if (
      options.scheduleDragFrame &&
      !superseded &&
      ctx.framePacedGesture() &&
      (state.gesture.kind !== "translating" ||
        state.queuedDrag !== null ||
        state.gesture.moved)
    ) {
      ctx.discardDragFrame();
      applyPointerMove(event);
    }
    if (
      editor.readOnly &&
      state.gesture.kind !== "panning" &&
      state.gesture.kind !== "marquee" &&
      state.gesture.kind !== "idle"
    ) {
      cancelGesture();
      ctx.release(event);
      state.activePointerId = null;
      return;
    }
    const gesture = state.gesture;
    if (gesture.kind === "connecting") {
      connectors.finishConnecting(gesture, event);
    } else if (gesture.kind === "reconnecting") {
      connectors.finishReconnecting(gesture, event);
    } else if (
      (gesture.kind === "translating" || gesture.kind === "sequence-reorder") &&
      !gesture.moved &&
      gesture.clickTarget !== null
    ) {
      editor.selection.set([gesture.clickTarget]);
    }
    ctx.release(event);
    state.activePointerId = null;
    finishGesture();
  };

  /**
   * The system took the pointer away mid-gesture (a palm rejection, a
   * system gesture). Treat it as a cancellation rather than a commit: the
   * user never chose where to drop what they were dragging.
   */
  const onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== state.activePointerId) {
      return;
    }
    ctx.release(event);
    state.activePointerId = null;
    cancelGesture();
  };

  const onWheel = (event: WheelEvent): void => {
    if (insideSlot(event.target)) {
      // Scrolling inside the inline editor scrolls the editor.
      return;
    }
    event.preventDefault();
    const dy = wheelPixels(event.deltaY, event.deltaMode);
    if (event.ctrlKey || event.metaKey) {
      editor.camera.zoomBy(Math.exp(-dy * 0.0015), ctx.screenPoint(event));
      return;
    }
    editor.camera.panBy(-wheelPixels(event.deltaX, event.deltaMode), -dy);
  };

  const onDoubleClick = (event: MouseEvent): void => {
    if (editor.readOnly) return;
    if (insideSlot(event.target)) {
      return;
    }
    const point = ctx.pagePoint(event);
    if (circuit.handleDoubleClick(event, point)) return;
    // Pointer capture belongs to the canvas, so a handle's double-click can
    // be retargeted here. Resolve the selected handle before inserting a point.
    if (connectors.editSelectedRouteHandle(event, point)) return;
    const hit = hits.canvasHitTest(point);
    // An edge label edits in place; elsewhere on the edge a double-click
    // still adds a bend point.
    const labelled = hits.edgeLabelAt(point, hit);
    if (labelled) {
      options.onEditRequest?.(labelled, "body");
      return;
    }
    if (!hit) {
      return;
    }
    const element = editor.store.get(hit);
    if (element && MANUAL_ROUTE_TYPES.has(element.type)) {
      connectors.insertRouteWaypoint(event, hit, element, point);
      return;
    }
    const box = editor.getBounds(hit);
    const region = element && box ? editRegionAt(element, box, point) : "body";
    options.onEditRequest?.(hit, region);
  };

  return {
    onPointerDown,
    applyPointerMove,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onWheel,
    onDoubleClick,
  };
}
