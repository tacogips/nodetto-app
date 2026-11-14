// The file commands the shell offers in file mode: new, open, reload and
// open recent. Each asks before throwing away unsaved edits, and an import
// that keeps far-off source coordinates is zoomed to fit.

import type { Editor } from "@nodetto/core";
import type { DocumentSession, SessionState } from "../file/session.ts";

const DISCARD_PROMPT = "Discard unsaved changes?";

/** The shell props the commands read; the App's props satisfy it. */
export interface DocumentCommandSource {
  readonly editor: Editor;
  readonly session: DocumentSession;
}

export interface DocumentCommands {
  /** True when it is safe to throw away what is in the editor. */
  readonly mayDiscard: () => boolean;
  readonly newDocument: () => void;
  readonly open: () => void;
  readonly reload: () => void;
  readonly openRecent: (path: string) => void;
}

export function createDocumentCommands(
  source: DocumentCommandSource,
  file: () => SessionState,
  viewport: () => { readonly width: number; readonly height: number },
): DocumentCommands {
  /** True when it is safe to throw away what is in the editor. */
  const mayDiscard = (): boolean =>
    !file().dirty || window.confirm(DISCARD_PROMPT);

  const newDocument = (): void => {
    if (mayDiscard()) {
      void source.session.newDocument();
    }
  };

  /**
   * An imported board or drawing (KiCad, Gerber) keeps its source
   * coordinates, which may lie off screen: show all of it.
   */
  const fitImported = (opened: boolean): void => {
    if (opened && source.session.state().filePath === null)
      source.editor.zoomToFit(viewport());
  };

  const open = (): void => {
    if (mayDiscard()) {
      void source.session.open().then(fitImported);
    }
  };

  const reload = (): void => {
    const path = file().filePath;
    if (path !== null && mayDiscard()) void source.session.openPath(path);
  };

  const openRecent = (path: string): void => {
    if (path !== "" && mayDiscard()) {
      void source.session.openPath(path).then(fitImported);
    }
  };

  return { mayDiscard, newDocument, open, reload, openRecent };
}
