// The canvas context menu: opened by a right-click, a still right-button
// release, or Shift+F10 / the menu key.

import type { Vec } from "@nodetto/core";
import { ancestorChain } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import type { InteractionContext } from "./context.ts";
import { insideSlot } from "./events.ts";
import { boxCentre } from "./geometry.ts";
import type { HitTesting } from "./hit-testing.ts";
import type { GestureLifecycle } from "./lifecycle.ts";
import type { ContextMenuPoint } from "./types.ts";

export interface ContextMenus {
  contextMenuAt(screen: Vec): void;
  contextMenuFromKeyboard(): void;
  onContextMenu(event: MouseEvent): void;
}

export function createContextMenus(
  ctx: InteractionContext,
  hits: HitTesting,
  lifecycle: GestureLifecycle,
): ContextMenus {
  const { editor, options, state } = ctx;

  const openContextMenu = (
    at: ContextMenuPoint,
    hit: ElementId | null,
  ): void => {
    options.onContextMenu?.(at, hit);
  };

  /** Right-click: the hit becomes the selection unless it already is. */
  const contextMenuAt = (screen: Vec): void => {
    const page = editor.camera.screenToPage(screen);
    const hit = hits.canvasHitTest(page);
    let reported: ElementId | null = null;
    if (hit) {
      const chain = ancestorChain(editor.store, hit);
      const selected = chain.find((id) => editor.selection.has(id));
      reported = selected ?? chain[chain.length - 1] ?? hit;
      if (selected === undefined) {
        editor.selection.set([reported]);
      }
    }
    openContextMenu({ screen, page }, reported);
  };

  /** Shift+F10: anchored on the selection, else where the pointer last was. */
  const contextMenuFromKeyboard = (): void => {
    const ids = [...editor.selection.ids()];
    const bounds = ids.length > 0 ? editor.getSelectionBounds() : null;
    if (bounds) {
      const page = boxCentre(bounds);
      openContextMenu(
        { screen: editor.camera.pageToScreen(page), page },
        ids[0] ?? null,
      );
      return;
    }
    const screen = state.lastPointer?.screen ?? ctx.viewportCentre();
    contextMenuAt(screen);
  };

  const onContextMenu = (event: MouseEvent): void => {
    if (insideSlot(event.target)) {
      // The textarea keeps its native menu.
      return;
    }
    event.preventDefault();
    if (state.suppressPointerContextMenu) return;
    if (state.gesture.kind !== "idle") {
      return;
    }
    lifecycle.flushNudge();
    contextMenuAt(ctx.screenPoint(event));
  };

  return { contextMenuAt, contextMenuFromKeyboard, onContextMenu };
}
