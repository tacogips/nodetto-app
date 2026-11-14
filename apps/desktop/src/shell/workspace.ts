// Keeping the workspace and the current page in step: each page remembers
// the mode chosen on it, a dedicated workspace (BPMN, breadboard, PCB) shows
// its own page kind, and switching pages switches to the new page's mode.

import type { Editor } from "@nodetto/core";
import type { WorkspaceId } from "@nodetto/ui-solid";
import { createEffect } from "solid-js";
import {
  DEDICATED_PAGE_NAMES,
  dedicatedPageKindFor,
  dedicatedWorkspaceFor,
  workspaceForPage,
} from "../page-workspace.ts";

/**
 * Show a page `id` can work on: its dedicated page kind, created when the
 * document has none, or any general page when leaving a dedicated one. A
 * general page then remembers `id` as its mode. The change stays out of the
 * undo history: undo restores content, not which palette is open.
 */
export function selectWorkspacePage(editor: Editor, id: WorkspaceId): void {
  const page = editor.store.getPage(editor.currentPageId);
  const targetKind = dedicatedPageKindFor(id);
  if (targetKind && page?.kind !== targetKind) {
    const existing = editor.store
      .listPages()
      .find((candidate) => candidate.kind === targetKind);
    if (existing) editor.setCurrentPage(existing.id);
    else
      editor.createPage({
        kind: targetKind,
        name: DEDICATED_PAGE_NAMES[targetKind] ?? "Page",
      });
    return;
  }
  if (!targetKind && page && dedicatedWorkspaceFor(page.kind)) {
    const existing = editor.store
      .listPages()
      .find((candidate) => !dedicatedWorkspaceFor(candidate.kind));
    if (existing) editor.setCurrentPage(existing.id);
    else editor.createPage({ kind: "freeform", name: "Page" });
  }
  const current = editor.store.getPage(editor.currentPageId);
  if (!editor.readOnly && current && !dedicatedWorkspaceFor(current.kind))
    editor.setPageMode(current.id, id, { history: "ignore" });
}

/**
 * Follow the current page's mode. `rev` is the editor's revision signal, so
 * page switches, undo and collaborators' mode changes re-run it;
 * `fallback` is the default mode for pages that never chose one, and
 * `source.editor` is read on every run, so the App's props can be passed as
 * they are.
 */
export function followPageWorkspace(
  source: { readonly editor: Editor },
  rev: () => unknown,
  fallback: () => WorkspaceId,
  setWorkspace: (id: WorkspaceId) => void,
): void {
  createEffect(() => {
    rev();
    const page = source.editor.store.getPage(source.editor.currentPageId);
    setWorkspace(workspaceForPage(page, fallback()));
  });
}
