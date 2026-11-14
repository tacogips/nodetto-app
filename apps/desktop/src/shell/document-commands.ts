// The file commands the shell offers in file mode: new, open, reload, open
// recent and open requests from the OS. Each asks before throwing away unsaved
// edits, and an import that keeps far-off source coordinates is zoomed to fit.

import type { Editor } from "@nodetto/core";
import {
  type PageResolution,
  pageAtNumber,
  resolvePageQuery,
} from "@nodetto/ir";
import type { LaunchRequest } from "../file/launch.ts";
import { baseName } from "../file/session-paths.ts";
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
  /** Open an OS request (file or nodetto:// link) at its page, if any. */
  readonly openRequest: (request: LaunchRequest) => void;
}

/** The page a request names, or why it names none that exists. */
export function requestedPage(
  editor: Editor,
  request: LaunchRequest,
): PageResolution | undefined {
  const pages = editor.store.listPages();
  return request.page !== undefined
    ? resolvePageQuery(pages, request.page)
    : request.pageNumber !== undefined
      ? pageAtNumber(pages, request.pageNumber)
      : undefined;
}

/**
 * Says that a link's page is missing (or `null` once a request succeeds);
 * the file still opens, on the page it was already showing or its first.
 */
export type PageNotice = (message: string | null) => void;

export function createDocumentCommands(
  source: DocumentCommandSource,
  file: () => SessionState,
  viewport: () => { readonly width: number; readonly height: number },
  notice: PageNotice = () => {},
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

  const openRequest = (request: LaunchRequest): void => {
    notice(null);
    if (request.page === undefined && request.pageNumber === undefined) {
      openRecent(request.path);
      return;
    }
    const showPage = (): void => {
      const page = requestedPage(source.editor, request);
      if (page?.ok) source.editor.setCurrentPage(page.page.id);
      else if (page)
        notice(`Link to ${baseName(request.path)}: ${page.message}`);
    };
    // A link into the open file only changes the page; its edits stay.
    if (file().filePath === request.path) {
      showPage();
      return;
    }
    if (request.path !== "" && mayDiscard()) {
      void source.session.openPath(request.path).then((opened) => {
        fitImported(opened);
        if (opened) showPage();
      });
    }
  };

  return { mayDiscard, newDocument, open, reload, openRecent, openRequest };
}
