// Reconciling the in-memory document with what is on disk: planning how an
// outside change lands in the editor, and rewriting image sources after a
// save moved attachments next to the file. Neither changes the editor; the
// session applies their results.

import {
  diffDocuments,
  type Editor,
  type Command,
  mergeDocuments,
  referencesOf,
} from "@nodetto/core";
import {
  connectorEndpointIssues,
  getElementTypeDefinition,
  validateDocument,
  type Document,
  type ImageSemantic,
} from "@nodetto/ir";
import { parseDocumentResult } from "@nodetto/io";
import type { PreparedAttachments } from "./attachments.ts";
import type { OutsideChange } from "./session-types.ts";

export interface OutsideChangePlan {
  /** The document the editor should hold once the change is applied. */
  readonly target: Document;
  /** Null when the documents cannot be diffed and a full reload is needed. */
  readonly commit: ReturnType<typeof diffDocuments>;
  /** Ids changed on both sides; the local version of those was kept. */
  readonly conflicts: readonly string[];
  readonly outsideChange: OutsideChange;
}

/**
 * Plan how another writer's `remote` document lands on the `local` one.
 *
 * With no unsaved local edits the disk version is taken as it is. With
 * unsaved edits it is merged three ways against `lastSavedText`. Returns
 * null when the file now holds a different document altogether, or the base
 * the merge needs is missing, and the banner has to ask instead.
 */
export function planOutsideChange(
  local: Document,
  remote: Document,
  lastSavedText: string | null,
  dirty: boolean,
): OutsideChangePlan | null {
  if (remote.id !== local.id) {
    return null;
  }
  let target = remote;
  let conflicts: readonly string[] = [];
  if (dirty) {
    const base =
      lastSavedText === null ? null : parseDocumentResult(lastSavedText);
    if (base === null || !base.ok || base.document.id !== local.id) {
      return null;
    }
    const merged = mergeDocuments(base.document, local, remote);
    if (conversionMergeBlocked(base.document, local, remote, merged.document)) {
      return null;
    }
    target = merged.document;
    conflicts = merged.conflicts.map((conflict) => conflict.id);
  }
  const commit = diffDocuments(local, target);
  const outsideChange = {
    added: (commit?.insert?.length ?? 0) + (commit?.insertPages?.length ?? 0),
    updated: (commit?.update?.length ?? 0) + (commit?.updatePages?.length ?? 0),
    removed: (commit?.remove?.length ?? 0) + (commit?.removePages?.length ?? 0),
    merged: dirty,
  };
  return { target, commit, conflicts, outsideChange };
}

function conversionMergeBlocked(
  base: Document,
  local: Document,
  remote: Document,
  merged: Document,
): boolean {
  const index = (document: Document) =>
    new Map(document.elements.map((element) => [element.id, element]));
  const baseById = index(base);
  const localById = index(local);
  const remoteById = index(remote);
  const mergedById = index(merged);
  const ids = new Set([
    ...baseById.keys(),
    ...localById.keys(),
    ...remoteById.keys(),
  ]);
  const changed = [...ids].some((id) => {
    const types = new Set(
      [
        baseById.get(id)?.type,
        localById.get(id)?.type,
        remoteById.get(id)?.type,
      ].filter((type) => type !== undefined),
    );
    return types.size > 1;
  });
  if (!changed) return false;
  const sameContent = (
    a: { type: string; semantic: unknown },
    b: { type: string; semantic: unknown },
  ) =>
    a.type === b.type &&
    JSON.stringify(a.semantic) === JSON.stringify(b.semantic);
  for (const id of ids) {
    const b = baseById.get(id);
    const l = localById.get(id);
    const r = remoteById.get(id);
    if (
      b &&
      l &&
      r &&
      (b.type !== l.type || b.type !== r.type || l.type !== r.type) &&
      !sameContent(l, r) &&
      !sameContent(b, l) &&
      !sameContent(b, r)
    )
      return true;
  }
  if (validateDocument(merged).some((issue) => issue.severity === "error"))
    return true;
  const converted = new Set(
    merged.elements
      .filter((element) => {
        const original = baseById.get(element.id);
        return original !== undefined && original.type !== element.type;
      })
      .map((element) => element.id),
  );
  for (const element of merged.elements) {
    if (element.type === "frame" || element.type === "group") continue;
    if (getElementTypeDefinition(element.type)?.category === "edge") {
      if (
        connectorEndpointIssues(
          element.type,
          element.semantic,
          element.page,
          (id) => (converted.has(id) ? mergedById.get(id) : undefined),
        ).some((issue) => issue.code === "connector.endpointType")
      )
        return true;
      if (
        element.type.startsWith("bpmn.") &&
        referencesOf(element).some(
          (ref) =>
            (ref.field === "from" || ref.field === "to") &&
            converted.has(ref.id),
        )
      ) {
        const original = baseById.get(element.id);
        if (!original || JSON.stringify(original) !== JSON.stringify(element))
          return true;
      }
    } else if (referencesOf(element).some((ref) => converted.has(ref.id)))
      return true;
  }
  return false;
}

/**
 * Point each image whose attachment the save rewrote at its new source.
 * An image the user changed while the write was in flight keeps its edit.
 */
export function attachmentSourcePatches(
  editor: Editor,
  changes: PreparedAttachments["changes"],
): Command[] {
  return changes.flatMap((change) => {
    const element = editor.store.get(change.id);
    return element?.type === "image.raster" &&
      (element.semantic as ImageSemantic).src === change.before
      ? [
          {
            type: "updateSemantic" as const,
            id: change.id,
            semantic: {
              ...(element.semantic as ImageSemantic),
              src: change.after,
            },
          },
        ]
      : [];
  });
}
