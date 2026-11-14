// Keeping the workspace and the current page in step: a dedicated workspace
// (BPMN, breadboard, PCB, ...) shows its own page kind, and landing on such
// a page switches to its workspace.

import type { Editor } from "@nodetto/core";
import type { WorkspaceId } from "@nodetto/ui-solid";
import { createEffect } from "solid-js";
import {
  DEDICATED_PAGE_NAMES,
  dedicatedPageKindFor,
  dedicatedWorkspaceFor,
} from "../page-workspace.ts";

/**
 * Show a page `id` can work on: its dedicated page kind, created when the
 * document has none, or any general page when leaving a dedicated one.
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
  } else if (!targetKind && page && dedicatedWorkspaceFor(page.kind)) {
    const existing = editor.store
      .listPages()
      .find((candidate) => !dedicatedWorkspaceFor(candidate.kind));
    if (existing) editor.setCurrentPage(existing.id);
    else editor.createPage({ kind: "freeform", name: "Page" });
  }
}

/**
 * Follow the current page: a dedicated page selects its workspace, and a
 * general page leaves a dedicated workspace for "flow". `rev` is the
 * editor's revision signal, so page switches re-run it; `source.editor` is
 * read on every run, so the App's props can be passed as they are.
 */
export function followPageWorkspace(
  source: { readonly editor: Editor },
  rev: () => unknown,
  workspace: () => WorkspaceId,
  setWorkspace: (id: WorkspaceId) => void,
): void {
  createEffect(() => {
    rev();
    const kind = source.editor.store.getPage(source.editor.currentPageId)?.kind;
    const dedicatedWorkspace = dedicatedWorkspaceFor(kind);
    if (dedicatedWorkspace) setWorkspace(dedicatedWorkspace);
    else if (dedicatedPageKindFor(workspace())) setWorkspace("flow");
  });
}
