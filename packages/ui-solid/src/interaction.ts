// Pointer and keyboard gestures.
//
// One state machine, one gesture at a time. Everything it does to the
// document goes through `editor.apply` (or an editor helper that does), and
// every drag is wrapped in `beginBatch`/`endBatch` so a hundred pointer
// moves undo as one step.
//
// That pairing is the invariant this file exists to protect. `beginBatch`
// without its `endBatch` does not fail loudly: history simply keeps folding
// every later edit into a batch that is never committed, so undo goes dead
// for the rest of the session. One pointer therefore owns the canvas at a
// time — `activePointerId` — and every event from any other pointer is
// dropped before it can reach a gesture transition.
//
// Which gestures open a batch: translation, sequence reorder, resize, rotation,
// multi-selection transforms, and connector bend editing (many applies per
// drag). `connecting` and `reconnecting` end in at most one apply and open none.
// Arrow-key nudges open one batch that a timer closes 500 ms
// after the last press; anything else that could edit the document
// (a pointer down, a shortcut) closes it first, so the nudge batch is never
// open underneath another gesture's batch.
//
// Camera changes deliberately do not touch history: panning and zooming are
// not edits.
//
// The controller is assembled here from the modules under ./interaction/:
// shared state (context), gesture ownership and batches (lifecycle), hit
// testing and snapping, one module per gesture family (transform,
// connectors, circuit, creation), and the pointer, keyboard and context-menu
// event handlers that drive them.

import type { Editor } from "@nodetto/core";
import { createCircuitTools } from "./interaction/circuit.ts";
import { createConnectorGestures } from "./interaction/connectors.ts";
import { createContextMenus } from "./interaction/context-menu.ts";
import { createInteractionContext } from "./interaction/context.ts";
import { createCreationTools } from "./interaction/creation.ts";
import { createHitTesting } from "./interaction/hit-testing.ts";
import { createKeyboardHandlers } from "./interaction/keyboard.ts";
import { createGestureLifecycle } from "./interaction/lifecycle.ts";
import { createPointerHandlers } from "./interaction/pointer.ts";
import { createSnapping } from "./interaction/snapping.ts";
import { createTransformGestures } from "./interaction/transform.ts";
import type { Interaction, InteractionOptions } from "./interaction/types.ts";

export {
  isApplePlatform,
  isEditableTarget,
  shortcutKey,
  SLOT_LAYER_CLASS,
} from "./interaction/events.ts";
export {
  boxesOverlap,
  editRegionAt,
  handleEdges,
  MIN_SHAPE_SIZE,
  RESIZE_HANDLES,
  resizeBox,
  resizeBoxConstrained,
  resizeHandlesFor,
  resizeRotatedBox,
  type EditRegion,
  type ResizeHandle,
  type ResizeModifiers,
} from "./interaction/geometry.ts";
export {
  NUDGE_COALESCE_MS,
  NUDGE_GRID_STEP,
  NUDGE_STEP,
} from "./interaction/keyboard.ts";
export { SNAP_GRID, SNAP_THRESHOLD_PX } from "./interaction/snapping.ts";
export type {
  ConnectorEnd,
  ContextMenuPoint,
  Interaction,
  InteractionOptions,
  PendingConnection,
  Scheduler,
  SnapSettings,
} from "./interaction/types.ts";

export function createInteraction(
  editor: Editor,
  options: InteractionOptions,
): Interaction {
  const ctx = createInteractionContext(editor, options);
  const hits = createHitTesting(ctx);
  const snapping = createSnapping(ctx);
  // The lifecycle flushes the last queued drag sample through the pointer
  // handlers, which are built on top of it; bind late.
  const lifecycle = createGestureLifecycle(ctx, (event) =>
    pointer.applyPointerMove(event),
  );
  const menus = createContextMenus(ctx, hits, lifecycle);
  const transform = createTransformGestures(ctx, snapping, lifecycle);
  const connectors = createConnectorGestures(ctx, hits, lifecycle);
  const circuit = createCircuitTools(ctx, hits, lifecycle);
  const creation = createCreationTools(ctx, circuit);
  const pointer = createPointerHandlers(ctx, {
    hits,
    lifecycle,
    transform,
    connectors,
    circuit,
    creation,
    menus,
  });
  const keyboard = createKeyboardHandlers(ctx, lifecycle, circuit, menus);
  const { state } = ctx;
  const { cancelGesture, flushNudge } = lifecycle;

  const editableGesture =
    <Args extends unknown[]>(start: (...args: Args) => void) =>
    (...args: Args): void => {
      if (!editor.readOnly) start(...args);
    };

  return {
    dispose: () => {
      cancelGesture();
      state.activePointerId = null;
      flushNudge();
    },
    placeTool: (tool, point) => {
      if (
        editor.readOnly ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y)
      )
        return;
      flushNudge();
      creation.placeShape(point, tool);
    },
    onPointerDown: pointer.onPointerDown,
    onPointerMove: pointer.onPointerMove,
    onPointerUp: pointer.onPointerUp,
    onPointerCancel: pointer.onPointerCancel,
    onWheel: pointer.onWheel,
    onKeyDown: keyboard.onKeyDown,
    onKeyUp: keyboard.onKeyUp,
    onDoubleClick: pointer.onDoubleClick,
    onContextMenu: menus.onContextMenu,
    onBlur: keyboard.onBlur,
    startResize: editableGesture(transform.startResize),
    startResizeSelection: editableGesture(transform.startResizeSelection),
    startRotate: editableGesture(transform.startRotate),
    startRotateSelection: editableGesture(transform.startRotateSelection),
    startRouteBend: editableGesture(connectors.startRouteBend),
    startRouteWaypoint: editableGesture(connectors.startRouteWaypoint),
    startBreadboardWirePoint: editableGesture(circuit.startBreadboardWirePoint),
    startReconnect: editableGesture(connectors.startReconnect),
    startConnect: editableGesture(connectors.startConnect),
    flushNudge,
    pending: ctx.pending,
    marquee: ctx.marquee,
    guides: ctx.guides,
    hoverTarget: ctx.hoverTarget,
    temporaryHand: ctx.temporaryHand,
    panning: ctx.panning,
    wireDraft: ctx.wireDraft,
    breadboardHover: ctx.breadboardHover,
    pcbHover: ctx.pcbHover,
    pcbDraft: ctx.pcbDraftPoints,
  };
}
