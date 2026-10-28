// The state one interaction controller shares across its gesture modules:
// the mutable gesture machine, the signals the canvas renders from, and the
// small helpers every module needs to read pointers and the viewport.

import type {
  Box,
  BreadboardPinRef,
  Editor,
  SnapGuide,
  Vec,
  ViewportSize,
} from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import { type Accessor, type Setter, createSignal } from "solid-js";
import type { PcbTrackDraft } from "../pcb-interaction.ts";
import type { ToolKind } from "../tools.ts";
import type {
  ContextMenuPoint,
  Gesture,
  InteractionOptions,
  PendingConnection,
  Scheduler,
} from "./types.ts";

const defaultScheduler: Scheduler = (callback, delayMs) => {
  const handle = setTimeout(callback, delayMs);
  return () => clearTimeout(handle);
};

export const NO_GUIDES: readonly SnapGuide[] = [];

/** Everything the controller mutates between events. */
export interface InteractionState {
  gesture: Gesture;
  suppressPointerContextMenu: boolean;
  /** The pointer that owns the canvas, or `null` when none does. */
  activePointerId: number | null;
  gestureDocumentRevision: number;
  gesturePageId: Editor["currentPageId"];
  queuedDrag: PointerEvent | null;
  queuedDragRevision: number;
  dragAppliedRevision: number | null;
  dragSampleSuperseded: boolean;
  cancelDragFrame: (() => void) | null;
  /** Cancels the timer closing the open nudge batch; `null` when none is open. */
  cancelNudgeTimer: (() => void) | null;
  spaceHeld: boolean;
  toolBeforeSpace: ToolKind;
  /** Where the pointer last went down, for the keyboard context menu. */
  lastPointer: ContextMenuPoint | null;
  pcbTrackState: PcbTrackDraft | null;
  wirePoints: Vec[];
}

export interface InteractionContext {
  readonly editor: Editor;
  readonly options: InteractionOptions;
  readonly state: InteractionState;
  readonly schedule: Scheduler;

  readonly pending: Accessor<PendingConnection | null>;
  readonly setPending: Setter<PendingConnection | null>;
  readonly marquee: Accessor<Box | null>;
  readonly guides: Accessor<readonly SnapGuide[]>;
  readonly setGuides: Setter<readonly SnapGuide[]>;
  readonly hoverTarget: Accessor<ElementId | null>;
  readonly setHoverTarget: Setter<ElementId | null>;
  readonly temporaryHand: Accessor<boolean>;
  readonly setTemporaryHand: Setter<boolean>;
  readonly panning: Accessor<boolean>;
  readonly setPanning: Setter<boolean>;
  readonly wireDraft: Accessor<readonly Vec[] | null>;
  readonly setWireDraft: Setter<readonly Vec[] | null>;
  readonly breadboardHover: Accessor<
    BreadboardPinRef | { wireId: ElementId } | null
  >;
  readonly setBreadboardHover: Setter<
    BreadboardPinRef | { wireId: ElementId } | null
  >;
  readonly pcbHover: Accessor<string>;
  readonly setPcbHover: Setter<string>;
  readonly pcbDraftPoints: Accessor<readonly Vec[] | null>;
  readonly setPcbDraftPoints: Setter<readonly Vec[] | null>;

  /** True for gestures whose pointer moves are paced to repaint frames. */
  framePacedGesture(): boolean;
  discardDragFrame(): void;
  isPcbPage(): boolean;
  isBreadboardPage(): boolean;
  setMarquee(rect: Box | null): void;
  clearGuides(): void;
  clearTransient(): void;
  viewportSize(): ViewportSize;
  viewportCentre(): Vec;
  screenPoint(event: { clientX: number; clientY: number }): Vec;
  pagePoint(event: { clientX: number; clientY: number }): Vec;
  capture(event: PointerEvent): void;
  release(event: PointerEvent): void;
}

export function createInteractionContext(
  editor: Editor,
  options: InteractionOptions,
): InteractionContext {
  const state: InteractionState = {
    gesture: { kind: "idle" },
    suppressPointerContextMenu: false,
    activePointerId: null,
    gestureDocumentRevision: editor.documentOpenRevision,
    gesturePageId: editor.currentPageId,
    queuedDrag: null,
    queuedDragRevision: 0,
    dragAppliedRevision: null,
    dragSampleSuperseded: false,
    cancelDragFrame: null,
    cancelNudgeTimer: null,
    spaceHeld: false,
    toolBeforeSpace: "select",
    lastPointer: null,
    pcbTrackState: null,
    wirePoints: [],
  };
  const framePacedGesture = (): boolean =>
    state.gesture.kind === "translating" ||
    state.gesture.kind === "resizing" ||
    state.gesture.kind === "resizing-selection" ||
    state.gesture.kind === "rotating" ||
    state.gesture.kind === "rotating-selection" ||
    state.gesture.kind === "routing-bend" ||
    state.gesture.kind === "routing-waypoint" ||
    state.gesture.kind === "breadboard-wire-point";
  const discardDragFrame = (): void => {
    state.cancelDragFrame?.();
    state.cancelDragFrame = null;
    state.queuedDrag = null;
  };
  const schedule = options.schedule ?? defaultScheduler;

  const [pending, setPending] = createSignal<PendingConnection | null>(null);
  const [marquee, setMarqueeSignal] = createSignal<Box | null>(null);
  const [guides, setGuides] = createSignal<readonly SnapGuide[]>(NO_GUIDES);
  const [hoverTarget, setHoverTarget] = createSignal<ElementId | null>(null);
  const [temporaryHand, setTemporaryHand] = createSignal(false);
  const [panning, setPanning] = createSignal(false);
  const [wireDraft, setWireDraft] = createSignal<readonly Vec[] | null>(null);
  const [breadboardHover, setBreadboardHover] = createSignal<
    BreadboardPinRef | { wireId: ElementId } | null
  >(null);
  const [pcbHover, setPcbHover] = createSignal("");
  const [pcbDraftPoints, setPcbDraftPoints] = createSignal<
    readonly Vec[] | null
  >(null);

  const isPcbPage = (): boolean =>
    editor.store.getPage(editor.currentPageId)?.kind === "pcb";
  const isBreadboardPage = (): boolean =>
    editor.store.getPage(editor.currentPageId)?.kind === "breadboard";

  const setMarquee = (rect: Box | null): void => {
    if (rect === null && marquee() === null) {
      // Clearing an already-clear marquee is a no-op; without this guard
      // every pointer-down would report a phantom `null` to `onMarquee`.
      return;
    }
    setMarqueeSignal(rect);
    options.onMarquee?.(rect);
  };

  const clearGuides = (): void => {
    if (guides().length > 0) {
      setGuides(NO_GUIDES);
    }
  };

  const viewportSize = (): ViewportSize => {
    const size = options.viewport?.();
    if (size && size.width > 0 && size.height > 0) {
      return size;
    }
    const container = options.container();
    if (container) {
      const rect = container.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }
    return { width: 0, height: 0 };
  };

  const viewportCentre = (): Vec => {
    const size = viewportSize();
    return { x: size.width / 2, y: size.height / 2 };
  };

  const screenPoint = (event: { clientX: number; clientY: number }): Vec => {
    const container = options.container();
    if (!container) {
      return { x: event.clientX, y: event.clientY };
    }
    const rect = container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const pagePoint = (event: { clientX: number; clientY: number }): Vec =>
    editor.camera.screenToPage(screenPoint(event));

  const capture = (event: PointerEvent): void => {
    try {
      options.container()?.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone, or the event was synthesized. Capture is
      // an optimisation - it keeps a drag alive outside the canvas - so
      // losing it must not abort the gesture that was about to start.
    }
  };

  const release = (event: PointerEvent): void => {
    const container = options.container();
    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
  };

  const clearTransient = (): void => {
    setPanning(false);
    setPending(null);
    setMarquee(null);
    clearGuides();
    setHoverTarget(null);
  };

  return {
    editor,
    options,
    state,
    schedule,
    pending,
    setPending,
    marquee,
    guides,
    setGuides,
    hoverTarget,
    setHoverTarget,
    temporaryHand,
    setTemporaryHand,
    panning,
    setPanning,
    wireDraft,
    setWireDraft,
    breadboardHover,
    setBreadboardHover,
    pcbHover,
    setPcbHover,
    pcbDraftPoints,
    setPcbDraftPoints,
    framePacedGesture,
    discardDragFrame,
    isPcbPage,
    isBreadboardPage,
    setMarquee,
    clearGuides,
    clearTransient,
    viewportSize,
    viewportCentre,
    screenPoint,
    pagePoint,
    capture,
    release,
  };
}
