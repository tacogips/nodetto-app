// Gesture ownership and the history batches gestures open: which pointer
// owns the canvas, and how a gesture commits, cancels or is discarded so
// every `beginBatch` meets its `endBatch` (see interaction.ts).

import type { InteractionContext } from "./context.ts";

export interface GestureLifecycle {
  finishGesture(): void;
  cancelGesture(): void;
  flushNudge(): void;
  owns(event: PointerEvent): boolean;
  claim(event: PointerEvent): void;
  discardStaleTransform(): boolean;
}

/**
 * `applyPointerMove` flushes the last queued drag sample when a gesture
 * finishes; it is passed in because the pointer handlers are built on top
 * of this lifecycle.
 */
export function createGestureLifecycle(
  ctx: InteractionContext,
  applyPointerMove: (event: PointerEvent) => void,
): GestureLifecycle {
  const { editor, state } = ctx;

  /** Commit whatever the gesture did and return to idle. */
  const finishGesture = (): void => {
    const latest =
      state.queuedDragRevision === editor.revision ? state.queuedDrag : null;
    ctx.discardDragFrame();
    if (latest) applyPointerMove(latest);
    const gesture = state.gesture;
    if (
      gesture.kind === "translating" ||
      gesture.kind === "sequence-reorder" ||
      gesture.kind === "resizing" ||
      gesture.kind === "resizing-selection" ||
      gesture.kind === "routing-bend" ||
      gesture.kind === "routing-waypoint" ||
      gesture.kind === "breadboard-wire-point" ||
      gesture.kind === "rotating" ||
      gesture.kind === "rotating-selection"
    ) {
      editor.endBatch();
    }
    state.gesture = { kind: "idle" };
    ctx.clearTransient();
  };

  /**
   * Return to idle discarding whatever the gesture did, so a half-finished
   * move or resize leaves no trace — not even an undo step.
   */
  const cancelGesture = (): void => {
    const gesture = state.gesture;
    if (gesture.kind === "panning" && gesture.rightButton)
      state.suppressPointerContextMenu = true;
    ctx.discardDragFrame();
    if (
      gesture.kind === "translating" ||
      gesture.kind === "sequence-reorder" ||
      gesture.kind === "resizing" ||
      gesture.kind === "resizing-selection" ||
      gesture.kind === "routing-bend" ||
      gesture.kind === "routing-waypoint" ||
      gesture.kind === "breadboard-wire-point" ||
      gesture.kind === "rotating" ||
      gesture.kind === "rotating-selection"
    ) {
      editor.abortBatch();
    }
    if (gesture.kind === "marquee") {
      // A cancelled brush never happened: the selection it was building goes
      // back to whatever the drag started from.
      editor.selection.set(gesture.base);
    }
    state.gesture = { kind: "idle" };
    ctx.clearTransient();
  };

  // ---------------------------------------------------------------- nudges

  const flushNudge = (): void => {
    if (state.cancelNudgeTimer === null) {
      return;
    }
    state.cancelNudgeTimer();
    state.cancelNudgeTimer = null;
    editor.endBatch();
  };

  /**
   * True when `event` may start a gesture: nothing owns the canvas, this is
   * the pointer that does, or the owner has finished what it was doing.
   *
   * That last case matters because ownership outlives the gesture — Escape
   * ends a drag while the button is still held. Handing the canvas to
   * another pointer then is safe precisely because there is no open batch
   * left to leak, and refusing would wedge a touch device whose next
   * contact always arrives with a fresh pointer id.
   */
  const owns = (event: PointerEvent): boolean =>
    state.activePointerId === null ||
    state.activePointerId === event.pointerId ||
    state.gesture.kind === "idle";

  /**
   * Take ownership for a gesture about to start. Closes anything still
   * open — a nudge batch, or a gesture whose release went missing — so the
   * new gesture's batch is never opened over another.
   */
  const claim = (event: PointerEvent): void => {
    flushNudge();
    finishGesture();
    state.activePointerId = event.pointerId;
    state.dragAppliedRevision = null;
    state.gestureDocumentRevision = editor.documentOpenRevision;
    state.gesturePageId = editor.currentPageId;
    ctx.capture(event);
  };

  const discardStaleTransform = (): boolean => {
    if (
      !ctx.framePacedGesture() ||
      (state.gestureDocumentRevision === editor.documentOpenRevision &&
        state.gesturePageId === editor.currentPageId &&
        editor.history.batching)
    )
      return false;
    // loadDocument clears history, including preserveView collaboration loads.
    // Do not apply old origins or roll back the replacement document.
    ctx.discardDragFrame();
    state.gesture = { kind: "idle" };
    ctx.clearTransient();
    return true;
  };

  return {
    finishGesture,
    cancelGesture,
    flushNudge,
    owns,
    claim,
    discardStaleTransform,
  };
}
