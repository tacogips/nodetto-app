// Window-level keyboard and pointer handling for the shell: undo routed to
// the cloud room or the local history, the export and save chords, and
// dismissing the header's menus and cloud panel.

import type { Editor } from "@nodetto/core";
import type { CloudSession } from "../cloud/session.ts";
import { handleHistoryShortcut } from "../history-shortcuts.ts";

/** The shell props the listeners read; the App's props satisfy it. */
export interface WindowInputSource {
  readonly editor: Editor;
  readonly cloud?: CloudSession;
  readonly filesAvailable: boolean;
}

export interface WindowInputOptions {
  readonly settingsOpen: () => boolean;
  readonly isCloud: () => boolean;
  /** Run the shared export action wherever focus is. */
  readonly exportDocument: () => void;
  readonly save: () => void;
  readonly cloudPanelExpanded: () => boolean;
  readonly collapseCloudPanel: () => void;
  readonly cloudPanelHost: () => HTMLElement | undefined;
  readonly settingsButton: () => HTMLElement | undefined;
  readonly fileMenu: () => HTMLDetailsElement | undefined;
}

/** Install the shell's window listeners; returns their removal. */
export function watchWindowInput(
  source: WindowInputSource,
  options: WindowInputOptions,
): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (options.settingsOpen()) return;
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    // Undo in cloud mode is the Y.UndoManager's, not the core History's:
    // the core's inverse commands describe a document only this client saw,
    // so replaying them would revert whatever a peer did in between. This
    // listener runs in the capture phase and stops the event, so the
    // canvas's own binding never sees the chord while a room is open.
    if (
      options.isCloud() &&
      source.cloud &&
      handleHistoryShortcut(event, source.cloud)
    )
      return;

    // Cmd/Ctrl+Shift+E exports wherever focus is: the export is a document
    // action, not a canvas gesture, and the canvas never binds it.
    if (modifier && event.shiftKey && !event.altKey && key === "e") {
      event.preventDefault();
      event.stopPropagation();
      options.exportDocument();
      return;
    }

    // Exactly cmd/ctrl + S, and only for a local file.
    const save =
      modifier &&
      !event.shiftKey &&
      !event.altKey &&
      key === "s" &&
      source.filesAvailable &&
      !options.isCloud();
    if (!save) {
      return;
    }
    event.preventDefault();
    options.save();
  };
  window.addEventListener("keydown", onKeyDown, true);
  const localHistory = (event: KeyboardEvent): void => {
    if (options.settingsOpen()) return;
    if (!options.isCloud()) handleHistoryShortcut(event, source.editor);
  };
  // Bubble after canvas handlers so their nudge/gesture bookkeeping runs
  // first and a handled chord cannot undo twice.
  window.addEventListener("keydown", localHistory);
  const dismissHeaderMenus = (event: KeyboardEvent | MouseEvent): void => {
    if (
      options.cloudPanelExpanded() &&
      event instanceof MouseEvent &&
      event.target instanceof Node &&
      !options.cloudPanelHost()?.contains(event.target) &&
      !options.settingsButton()?.contains(event.target) &&
      !(
        event.target instanceof Element &&
        event.target.closest(".nodetto-help-tooltip")
      )
    ) {
      options.collapseCloudPanel();
    }
    for (const menu of [options.fileMenu()]) {
      if (
        !menu?.open ||
        !(
          (event instanceof KeyboardEvent && event.key === "Escape") ||
          (event instanceof MouseEvent && !menu.contains(event.target as Node))
        )
      )
        continue;
      menu.removeAttribute("open");
      if (event instanceof KeyboardEvent) {
        event.preventDefault();
        event.stopPropagation();
        menu.querySelector<HTMLElement>("summary")?.focus();
      }
    }
  };
  window.addEventListener("keydown", dismissHeaderMenus, true);
  window.addEventListener("pointerdown", dismissHeaderMenus, true);
  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keydown", localHistory);
    window.removeEventListener("keydown", dismissHeaderMenus, true);
    window.removeEventListener("pointerdown", dismissHeaderMenus, true);
  };
}
