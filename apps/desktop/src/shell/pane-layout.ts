// The two side panes around the canvas: whether each is open, how wide it
// is, dragging and keyboard resizing of the dividers, and keeping the canvas
// usable when the window narrows.
//
// The width rules themselves live in `layout/pane.ts`; this is the shell's
// reactive state around them. The shell mounts the pieces with a lifecycle
// (`observeEditorBody`, `releaseDrag`) itself, in the order it always has.

import { type Accessor, createSignal, type Setter } from "solid-js";
import {
  CANVAS_MIN_WIDTH,
  clampPaneWidth,
  PANE_MIN_WIDTH,
  type PaneSide,
  paneWidthFromKey,
  paneWidthFromPointer,
} from "../layout/pane.ts";

export interface PaneLayout {
  readonly leftPaneOpen: Accessor<boolean>;
  readonly rightPaneOpen: Accessor<boolean>;
  readonly leftPaneWidth: Accessor<number>;
  readonly rightPaneWidth: Accessor<number>;
  readonly draggingPane: Accessor<PaneSide | null>;
  /** True when an open pane floats over the canvas instead of beside it. */
  readonly paneOverlaysCanvas: () => boolean;
  readonly paneInput: (side: PaneSide) => {
    containerWidth: number;
    oppositeWidth: number;
    overlaysCanvas: boolean;
  };
  /** Margins that keep the viewer's heading and footer clear of overlays. */
  readonly viewerMargins: () => {
    "margin-left": string | undefined;
    "margin-right": string | undefined;
  };
  readonly restorePane: (side: PaneSide, focusContent?: boolean) => void;
  readonly hidePane: (side: PaneSide) => void;
  readonly beginPaneResize: (side: PaneSide, event: PointerEvent) => void;
  readonly movePaneResize: (side: PaneSide, event: PointerEvent) => void;
  readonly endPaneResize: (event: PointerEvent) => void;
  readonly resizePaneByKey: (side: PaneSide, event: KeyboardEvent) => void;
  /** Start fitting the panes to the editor body; call from `onMount`. */
  readonly observeEditorBody: () => (() => void) | undefined;
  /** Let go of a divider still captured; call from `onCleanup`. */
  readonly releaseDrag: () => void;
  readonly setEditorBody: (element: HTMLDivElement) => void;
  readonly setCollapseButton: (
    side: PaneSide,
  ) => (button: HTMLButtonElement) => void;
  readonly setRestoreButton: (
    side: PaneSide,
  ) => (button: HTMLButtonElement) => void;
  readonly setLeftPaneOpen: Setter<boolean>;
  readonly setRightPaneOpen: Setter<boolean>;
}

export function createPaneLayout(initial: {
  readonly leftPaneOpen: boolean;
  readonly rightPaneOpen: boolean;
}): PaneLayout {
  const [leftPaneOpen, setLeftPaneOpen] = createSignal(initial.leftPaneOpen);
  const [rightPaneOpen, setRightPaneOpen] = createSignal(initial.rightPaneOpen);
  const [leftPaneWidth, setLeftPaneWidth] = createSignal(260);
  const [rightPaneWidth, setRightPaneWidth] = createSignal(300);
  const [draggingPane, setDraggingPane] = createSignal<PaneSide | null>(null);
  const [editorBodyWidth, setEditorBodyWidth] = createSignal(0);
  let editorBody: HTMLDivElement | undefined;
  let dragTarget: HTMLButtonElement | undefined;
  let dragPointerId: number | undefined;
  let leftRestoreButton: HTMLButtonElement | undefined;
  let rightRestoreButton: HTMLButtonElement | undefined;
  let leftCollapseButton: HTMLButtonElement | undefined;
  let rightCollapseButton: HTMLButtonElement | undefined;

  const paneInput = (side: PaneSide) => {
    const rect = editorBody?.getBoundingClientRect();
    return {
      containerWidth: rect?.width ?? window.innerWidth,
      oppositeWidth:
        side === "left"
          ? rightPaneOpen()
            ? rightPaneWidth()
            : 34
          : leftPaneOpen()
            ? leftPaneWidth()
            : 34,
      overlaysCanvas: paneOverlaysCanvas(),
    };
  };
  const setPaneWidth = (side: PaneSide, width: number): void => {
    const next = clampPaneWidth(width, paneInput(side));
    if (side === "left") setLeftPaneWidth(next);
    else setRightPaneWidth(next);
  };
  const keepCanvasUseful = (): void => {
    const width = editorBody?.getBoundingClientRect().width;
    if (!width) return;
    setEditorBodyWidth(width);
    if (!leftPaneOpen() && !rightPaneOpen()) return;
    if (!leftPaneOpen()) {
      setRightPaneWidth(
        clampPaneWidth(rightPaneWidth(), {
          containerWidth: width,
          oppositeWidth: 34,
          overlaysCanvas: width < CANVAS_MIN_WIDTH + PANE_MIN_WIDTH + 34,
        }),
      );
      return;
    }
    if (!rightPaneOpen()) {
      setLeftPaneWidth(
        clampPaneWidth(leftPaneWidth(), {
          containerWidth: width,
          oppositeWidth: 34,
          overlaysCanvas: width < CANVAS_MIN_WIDTH + PANE_MIN_WIDTH + 34,
        }),
      );
      return;
    }
    const fittedLeft = clampPaneWidth(leftPaneWidth(), {
      containerWidth: width,
      oppositeWidth: 34,
      overlaysCanvas: width < CANVAS_MIN_WIDTH + PANE_MIN_WIDTH + 34,
    });
    if (width < CANVAS_MIN_WIDTH + fittedLeft + rightPaneWidth()) {
      setRightPaneOpen(false);
      setLeftPaneWidth(fittedLeft);
    } else {
      setLeftPaneWidth(fittedLeft);
      setRightPaneWidth(
        clampPaneWidth(rightPaneWidth(), {
          containerWidth: width,
          oppositeWidth: fittedLeft,
          overlaysCanvas: width < CANVAS_MIN_WIDTH + PANE_MIN_WIDTH + 34,
        }),
      );
    }
  };
  const restorePane = (side: PaneSide, focusContent = false): void => {
    const width =
      editorBody?.getBoundingClientRect().width ?? window.innerWidth;
    if (side === "left") {
      if (
        rightPaneOpen() &&
        width < CANVAS_MIN_WIDTH + PANE_MIN_WIDTH + rightPaneWidth()
      )
        setRightPaneOpen(false);
      setLeftPaneWidth(
        clampPaneWidth(leftPaneWidth(), {
          containerWidth: width,
          oppositeWidth: rightPaneOpen() ? rightPaneWidth() : 34,
          overlaysCanvas: width < CANVAS_MIN_WIDTH + PANE_MIN_WIDTH + 34,
        }),
      );
      setLeftPaneOpen(true);
    } else {
      if (
        leftPaneOpen() &&
        width < CANVAS_MIN_WIDTH + PANE_MIN_WIDTH + leftPaneWidth()
      )
        setLeftPaneOpen(false);
      setRightPaneWidth(
        clampPaneWidth(rightPaneWidth(), {
          containerWidth: width,
          oppositeWidth: leftPaneOpen() ? leftPaneWidth() : 34,
          overlaysCanvas: width < CANVAS_MIN_WIDTH + PANE_MIN_WIDTH + 34,
        }),
      );
      setRightPaneOpen(true);
    }
    if (focusContent) {
      queueMicrotask(() => {
        (side === "left" ? leftCollapseButton : rightCollapseButton)?.focus({
          preventScroll: true,
        });
      });
    }
  };
  const hidePane = (side: PaneSide): void => {
    if (side === "left") setLeftPaneOpen(false);
    else setRightPaneOpen(false);
    queueMicrotask(() => {
      (side === "left" ? leftRestoreButton : rightRestoreButton)?.focus();
    });
  };
  const paneOverlaysCanvas = (): boolean =>
    editorBodyWidth() < CANVAS_MIN_WIDTH + PANE_MIN_WIDTH + 34;
  const beginPaneResize = (side: PaneSide, event: PointerEvent): void => {
    if (event.button !== 0) return;
    restorePane(side);
    const target = event.currentTarget as HTMLButtonElement;
    target.setPointerCapture(event.pointerId);
    dragTarget = target;
    dragPointerId = event.pointerId;
    setDraggingPane(side);
    event.preventDefault();
  };
  const movePaneResize = (side: PaneSide, event: PointerEvent): void => {
    if (draggingPane() !== side || dragPointerId !== event.pointerId) return;
    const rect = editorBody?.getBoundingClientRect();
    if (!rect) return;
    setPaneWidth(
      side,
      paneWidthFromPointer(side, event.clientX, rect.left, rect.right),
    );
  };
  const endPaneResize = (event: PointerEvent): void => {
    if (dragPointerId !== event.pointerId) return;
    if (dragTarget?.hasPointerCapture(event.pointerId)) {
      dragTarget.releasePointerCapture(event.pointerId);
    }
    dragTarget = undefined;
    dragPointerId = undefined;
    setDraggingPane(null);
  };
  const resizePaneByKey = (side: PaneSide, event: KeyboardEvent): void => {
    const width = side === "left" ? leftPaneWidth() : rightPaneWidth();
    const next = paneWidthFromKey(side, width, event.key, paneInput(side));
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    setPaneWidth(side, next);
  };
  const releaseDrag = (): void => {
    if (
      dragTarget &&
      dragPointerId !== undefined &&
      dragTarget.hasPointerCapture(dragPointerId)
    ) {
      dragTarget.releasePointerCapture(dragPointerId);
    }
  };
  const observeEditorBody = (): (() => void) | undefined => {
    if (!editorBody) return undefined;
    const observer = new ResizeObserver(keepCanvasUseful);
    observer.observe(editorBody);
    keepCanvasUseful();
    return () => observer.disconnect();
  };
  const viewerMargins = () => ({
    "margin-left":
      leftPaneOpen() && paneOverlaysCanvas()
        ? `${leftPaneWidth()}px`
        : undefined,
    "margin-right":
      rightPaneOpen() && paneOverlaysCanvas()
        ? `${rightPaneWidth()}px`
        : undefined,
  });

  return {
    leftPaneOpen,
    rightPaneOpen,
    leftPaneWidth,
    rightPaneWidth,
    draggingPane,
    paneOverlaysCanvas,
    paneInput,
    viewerMargins,
    restorePane,
    hidePane,
    beginPaneResize,
    movePaneResize,
    endPaneResize,
    resizePaneByKey,
    observeEditorBody,
    releaseDrag,
    setEditorBody: (element) => {
      editorBody = element;
    },
    setCollapseButton: (side) => (button) => {
      if (side === "left") leftCollapseButton = button;
      else rightCollapseButton = button;
    },
    setRestoreButton: (side) => (button) => {
      if (side === "left") leftRestoreButton = button;
      else rightRestoreButton = button;
    },
    setLeftPaneOpen,
    setRightPaneOpen,
  };
}
