// The canvas keyboard map (design section 5): tool letters, arrow-key
// nudges, the temporary hand on space, Escape, and Cmd/Ctrl chords.

import type { Vec } from "@nodetto/core";
import {
  copySelectionStyle,
  flipElements,
  groupOf,
  pasteSelectionStyle,
} from "@nodetto/core";
import { Tool, type ToolKind } from "../tools.ts";
import type { CircuitTools } from "./circuit.ts";
import type { ContextMenus } from "./context-menu.ts";
import type { InteractionContext } from "./context.ts";
import { insideSlot, isEditableTarget, shortcutKey } from "./events.ts";
import type { GestureLifecycle } from "./lifecycle.ts";

/** Arrow keys move the selection by this many page units. */
export const NUDGE_STEP = 1;
/** With shift held, arrows move by one grid step instead. */
export const NUDGE_GRID_STEP = 24;
/** Consecutive nudges closer than this collapse into one undo step. */
export const NUDGE_COALESCE_MS = 500;

/** Tool letters from the keyboard map (design section 5). */
const TOOL_KEYS: Readonly<Record<string, ToolKind>> = {
  v: "select",
  h: "hand",
  r: "geo:rect",
  o: "geo:ellipse",
  d: "geo:diamond",
  n: "node.generic",
  t: "text.note",
  l: "edge",
};

const ARROW_KEYS: Readonly<Record<string, Vec>> = {
  arrowleft: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  arrowup: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
};

export interface KeyboardHandlers {
  onKeyDown(event: KeyboardEvent): void;
  onKeyUp(event: KeyboardEvent): void;
  /** The canvas lost focus: release the temporary hand, close open nudges. */
  onBlur(): void;
}

export function createKeyboardHandlers(
  ctx: InteractionContext,
  lifecycle: GestureLifecycle,
  circuit: CircuitTools,
  menus: ContextMenus,
): KeyboardHandlers {
  const { editor, options, state } = ctx;
  const { flushNudge, cancelGesture } = lifecycle;

  // ---------------------------------------------------------------- nudges

  /**
   * Move the selection by one step. The first press opens a batch, every
   * press within `NUDGE_COALESCE_MS` of the last restarts the timer that
   * closes it, so holding an arrow key costs one undo step.
   */
  const nudge = (dx: number, dy: number): void => {
    if (state.gesture.kind !== "idle" || editor.selection.size === 0) {
      // A drag owns the open batch; nudging into it would fold the key
      // presses into the drag's undo step.
      return;
    }
    if (state.cancelNudgeTimer !== null) {
      state.cancelNudgeTimer();
    } else {
      editor.beginBatch();
    }
    editor.nudgeSelection(dx, dy);
    state.cancelNudgeTimer = ctx.schedule(() => {
      state.cancelNudgeTimer = null;
      editor.endBatch();
    }, NUDGE_COALESCE_MS);
  };

  // ----------------------------------------------------------------- space

  const holdSpace = (): void => {
    if (state.spaceHeld) {
      return;
    }
    state.spaceHeld = true;
    state.toolBeforeSpace = options.tool();
    ctx.setTemporaryHand(true);
    options.setTool("hand");
  };

  const releaseSpace = (): void => {
    if (!state.spaceHeld) {
      return;
    }
    state.spaceHeld = false;
    ctx.setTemporaryHand(false);
    // Only undo what `holdSpace` did: a tool picked while space was down
    // (from the toolbar, say) stays.
    if (options.tool() === "hand") {
      options.setTool(state.toolBeforeSpace);
    }
  };

  // -------------------------------------------------------------- keyboard

  const requestEditOfSelection = (): boolean => {
    const ids = [...editor.selection.ids()];
    const id = ids.length === 1 ? ids[0] : undefined;
    if (id === undefined || editor.editableField(id) === null) {
      return false;
    }
    options.onEditRequest?.(id, "body");
    return true;
  };

  /** Escape, in order: cancel, drill out of a group, deselect (design 5). */
  const pressEscape = (): void => {
    if (ctx.isBreadboardPage()) editor.setBreadboardProbe(null);
    if (state.pcbTrackState) {
      state.pcbTrackState = null;
      ctx.setPcbDraftPoints(null);
      if (ctx.isPcbPage()) return;
    }
    if (state.wirePoints.length > 0) {
      state.wirePoints = [];
      ctx.setWireDraft(null);
      options.setTool(Tool.Select);
      return;
    }
    if (state.gesture.kind !== "idle") {
      // Abandon the gesture: a half-dragged shape goes back where it
      // started rather than being committed wherever the pointer happens to
      // be. The pointer is still down, so it keeps ownership until it lifts.
      cancelGesture();
      return;
    }
    const ids = [...editor.selection.ids()];
    const only = ids.length === 1 ? ids[0] : undefined;
    if (only !== undefined) {
      const parent = groupOf(editor.store, only);
      if (parent) {
        editor.selection.set([parent.id]);
        return;
      }
    }
    editor.selection.clear();
    editor.setBreadboardProbe(null);
    options.setTool("select");
  };

  /** Chords with Cmd (macOS) or Ctrl held. Returns false when not ours. */
  const onShortcut = (event: KeyboardEvent, key: string): boolean => {
    if (
      editor.readOnly &&
      ["z", "y", "x", "v", "d", "g", "l", "[", "]"].includes(key)
    )
      return true;
    switch (key) {
      case "z":
        if (event.shiftKey) {
          editor.redo();
        } else {
          editor.undo();
        }
        return true;
      case "y":
        editor.redo();
        return true;
      case "a":
        editor.selectAll();
        return true;
      case "c":
        if (event.altKey) copySelectionStyle(editor);
        else editor.copySelection();
        return true;
      case "x":
        editor.cutSelection();
        return true;
      case "v":
        if (event.altKey) pasteSelectionStyle(editor);
        else editor.paste();
        return true;
      case "d":
        editor.duplicateSelection();
        return true;
      case "l":
        if (!event.altKey) return false;
        editor.arrangeLayout({ mode: "tidy" });
        return true;
      case "g":
        if (event.altKey) {
          editor.frameSelection();
        } else if (event.shiftKey) {
          editor.ungroupSelection();
        } else {
          editor.groupSelection();
        }
        return true;
      case "]":
        editor.bringToFront();
        return true;
      case "[":
        editor.sendToBack();
        return true;
      case "=":
      case "+":
        editor.zoomIn(ctx.viewportCentre());
        return true;
      case "-":
      case "_":
        editor.zoomOut(ctx.viewportCentre());
        return true;
      case "0":
        editor.resetZoom(ctx.viewportCentre());
        return true;
      default:
        // Anything else (Cmd+Shift+E export, Cmd+S save) belongs to the
        // shell: leave the event untouched so it keeps bubbling.
        return false;
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      isEditableTarget(event.target) ||
      insideSlot(event.target)
    ) {
      // Typing in the inline editor or an inspector field: a tool letter
      // must insert the letter.
      return;
    }
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const arrow = modifier ? undefined : ARROW_KEYS[key];

    if (!arrow) {
      // Any other key may edit the document; the nudge batch must not
      // swallow that edit into the arrow keys' undo step.
      flushNudge();
    }

    if (key === " " || key === "spacebar" || event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) {
        holdSpace();
      }
      return;
    }

    if (arrow) {
      if (editor.readOnly) {
        event.preventDefault();
        return;
      }
      if (editor.selection.size === 0) {
        return;
      }
      event.preventDefault();
      const step = event.shiftKey ? NUDGE_GRID_STEP : NUDGE_STEP;
      nudge(arrow.x * step, arrow.y * step);
      return;
    }

    if (modifier) {
      if (onShortcut(event, shortcutKey(event))) {
        event.preventDefault();
      }
      return;
    }

    if (circuit.rotatePartsByKey(event, key)) return;

    if (key === "enter" && state.pcbTrackState) {
      event.preventDefault();
      circuit.finishPcbTrack();
      return;
    }

    if (key === "enter" && state.wirePoints.length > 0) {
      event.preventDefault();
      circuit.finishWireDraft();
      return;
    }

    switch (key) {
      case "escape":
        event.preventDefault();
        pressEscape();
        return;
      case "enter":
      case "f2":
        if (editor.readOnly) return;
        if (requestEditOfSelection()) {
          event.preventDefault();
        }
        return;
      case "delete":
      case "backspace":
        if (editor.readOnly) {
          event.preventDefault();
          return;
        }
        if (editor.selection.size > 0) {
          event.preventDefault();
          editor.deleteSelection();
        }
        return;
      case "]":
        event.preventDefault();
        editor.bringForward();
        return;
      case "[":
        event.preventDefault();
        editor.sendBackward();
        return;
      case "f10":
      case "contextmenu":
        if (key === "contextmenu" || event.shiftKey) {
          event.preventDefault();
          menus.contextMenuFromKeyboard();
        }
        return;
      default:
        break;
    }

    if (event.shiftKey) {
      // Shift+digit arrives as the shifted character on most layouts, so
      // the physical key is checked too.
      if (key === "1" || key === "!" || event.code === "Digit1") {
        event.preventDefault();
        editor.zoomToFit(ctx.viewportSize());
        return;
      }
      if (key === "2" || key === "@" || event.code === "Digit2") {
        event.preventDefault();
        editor.zoomToSelection(ctx.viewportSize());
        return;
      }
      if (
        (key === "h" || key === "v") &&
        !event.altKey &&
        editor.selection.size > 0
      ) {
        event.preventDefault();
        if (editor.readOnly) return;
        flipElements(
          editor,
          editor.selection.ids(),
          key === "h" ? "horizontal" : "vertical",
        );
      }
      return;
    }

    if (!event.altKey) {
      const tool = TOOL_KEYS[key];
      if (tool !== undefined) {
        event.preventDefault();
        if (editor.readOnly && tool !== "select" && tool !== "hand") return;
        options.setTool(tool);
      }
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    // Releasing space is honoured wherever the key comes up: the hand was
    // set by this canvas, and a stuck hand is worse than an early release.
    if (
      event.key === " " ||
      event.key.toLowerCase() === "spacebar" ||
      event.code === "Space"
    ) {
      releaseSpace();
    }
  };

  const onBlur = (): void => {
    if (state.gesture.kind === "panning") cancelGesture();
    releaseSpace();
    flushNudge();
  };

  return { onKeyDown, onKeyUp, onBlur };
}
