// Scroll state for scrollable prototype surfaces: per-frame offsets plus the
// wheel, keyboard and pointer-drag gestures that move them. A drag that
// scrolled suppresses the click that follows it on the same surface.

import type { Editor } from "@nodetto/core";
import { createSignal } from "solid-js";
import {
  advancePrototypeScroll,
  prototypeDragDelta,
  prototypeKeyboardDelta,
  type PrototypeScrollPoint,
} from "./prototype-scroll.ts";
import {
  type PrototypeView,
  prototypeScrollMode,
  prototypeSurfaceScrollRange,
} from "./prototype-surface.ts";

export interface PrototypeSurfaceScroll {
  readonly scrollAt: (id: string) => PrototypeScrollPoint;
  readonly scrollSurface: (event: WheelEvent, view: PrototypeView) => void;
  readonly keyboardScrollSurface: (
    event: KeyboardEvent,
    view: PrototypeView,
  ) => void;
  readonly beginScrollGesture: (
    event: PointerEvent,
    view: PrototypeView,
  ) => void;
  readonly moveScrollGesture: (
    event: PointerEvent,
    view: PrototypeView,
  ) => void;
  readonly finishScrollGesture: (event: PointerEvent) => void;
  readonly consumeSuppressedClick: (frameId: string) => boolean;
  /** Forgets every surface offset and any gesture in progress. */
  readonly reset: () => void;
  /** Cancels the pending click-suppression timer. */
  readonly dispose: () => void;
}

export function createPrototypeSurfaceScroll(
  runtime: Editor,
  scale: () => number,
): PrototypeSurfaceScroll {
  let scrollGesture:
    | {
        readonly pointerId: number;
        readonly frameId: string;
        readonly start: PrototypeScrollPoint;
        readonly origin: PrototypeScrollPoint;
        moved: boolean;
      }
    | undefined;
  let suppressedClickFrame = "";
  let suppressedClickTimer: number | undefined;
  const [surfaceScroll, setSurfaceScroll] = createSignal<
    Readonly<Record<string, PrototypeScrollPoint>>
  >({});
  const scrollMode = prototypeScrollMode;
  const scrollRange = (view: PrototypeView): PrototypeScrollPoint =>
    prototypeSurfaceScrollRange(runtime, view);
  const scrollAt = (id: string): PrototypeScrollPoint =>
    surfaceScroll()[id] ?? { x: 0, y: 0 };
  const advanceSurface = (
    view: PrototypeView,
    delta: PrototypeScrollPoint,
  ): boolean => {
    const id = view.frame.id;
    const currentOffset = scrollAt(id);
    const next = advancePrototypeScroll(
      scrollMode(view),
      currentOffset,
      delta,
      scrollRange(view),
    );
    if (next.x === currentOffset.x && next.y === currentOffset.y) return false;
    setSurfaceScroll({ ...surfaceScroll(), [id]: next });
    return true;
  };
  const scrollSurface = (event: WheelEvent, view: PrototypeView): void => {
    if (!advanceSurface(view, { x: event.deltaX, y: event.deltaY })) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const keyboardScrollSurface = (
    event: KeyboardEvent,
    view: PrototypeView,
  ): void => {
    const delta = prototypeKeyboardDelta(event.key, view.bounds);
    if (!delta || !advanceSurface(view, delta)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const beginScrollGesture = (
    event: PointerEvent,
    view: PrototypeView,
  ): void => {
    if (!event.isPrimary || event.button !== 0 || scrollMode(view) === "none")
      return;
    scrollGesture = {
      pointerId: event.pointerId,
      frameId: view.frame.id,
      start: { x: event.clientX, y: event.clientY },
      origin: scrollAt(view.frame.id),
      moved: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const moveScrollGesture = (
    event: PointerEvent,
    view: PrototypeView,
  ): void => {
    const gesture = scrollGesture;
    if (
      !gesture ||
      gesture.pointerId !== event.pointerId ||
      gesture.frameId !== view.frame.id
    )
      return;
    const distance = Math.hypot(
      event.clientX - gesture.start.x,
      event.clientY - gesture.start.y,
    );
    if (distance >= 5) gesture.moved = true;
    if (!gesture.moved) return;
    const next = advancePrototypeScroll(
      scrollMode(view),
      gesture.origin,
      prototypeDragDelta(
        gesture.start,
        { x: event.clientX, y: event.clientY },
        scale(),
      ),
      scrollRange(view),
    );
    event.preventDefault();
    event.stopPropagation();
    setSurfaceScroll({ ...surfaceScroll(), [gesture.frameId]: next });
  };
  const finishScrollGesture = (event: PointerEvent): void => {
    const gesture = scrollGesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    scrollGesture = undefined;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture?.(event.pointerId))
      target.releasePointerCapture(event.pointerId);
    if (!gesture.moved) return;
    suppressedClickFrame = gesture.frameId;
    if (suppressedClickTimer !== undefined)
      window.clearTimeout(suppressedClickTimer);
    suppressedClickTimer = window.setTimeout(() => {
      suppressedClickTimer = undefined;
      suppressedClickFrame = "";
    }, 0);
  };
  const consumeSuppressedClick = (frameId: string): boolean => {
    if (suppressedClickFrame !== frameId) return false;
    suppressedClickFrame = "";
    return true;
  };
  return {
    scrollAt,
    scrollSurface,
    keyboardScrollSurface,
    beginScrollGesture,
    moveScrollGesture,
    finishScrollGesture,
    consumeSuppressedClick,
    reset: () => {
      setSurfaceScroll({});
      scrollGesture = undefined;
    },
    dispose: () => {
      if (suppressedClickTimer !== undefined)
        window.clearTimeout(suppressedClickTimer);
    },
  };
}
