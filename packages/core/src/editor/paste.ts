// Inserting copies onto the current page: the paste plan plus the follow-up
// commands a copy needs to fit in — fresh breadboard references, and (for a
// duplicate) membership in the frames and groups its originals belong to.

import type { ElementId, FrameSemantic } from "@nodetto/ir";
import { type ClipboardPayload, planPaste } from "../clipboard.ts";
import type { Command } from "../commands.ts";
import type { Editor } from "../editor.ts";
import { frameParents } from "../frame-tree.ts";
import type { Vec } from "../geometry.ts";
import { groupOf, memberIdsOf } from "../group.ts";
import type { IdSource } from "../ids.ts";
import type { Store } from "../store.ts";
import { planPastedBreadboardReferences } from "./breadboard.ts";

/** Ids in `ids` that no group in `ids` claims as a member. */
export function topLevelAmong(
  store: Store,
  ids: readonly ElementId[],
): ElementId[] {
  const set = new Set(ids);
  const claimed = new Set<ElementId>();
  for (const id of set) {
    const element = store.get(id);
    if (element) {
      for (const member of memberIdsOf(element)) {
        claimed.add(member);
      }
    }
  }
  return ids.filter((id) => !claimed.has(id));
}

/**
 * The commands that paste `payload` onto the current page at `offset`, and
 * the ids they create. `null` when a duplicate would have to join a locked
 * frame, in which case nothing is inserted.
 */
export function planInsertCopies(
  editor: Editor,
  idSource: IdSource,
  payload: ClipboardPayload,
  offset: Vec,
  preserveParents: boolean,
): { readonly commands: Command[]; readonly ids: readonly ElementId[] } | null {
  const store = editor.store;
  const pageId = editor.currentPageId;
  const plan = planPaste(payload, {
    page: pageId,
    idSource,
    nextIndex: () => editor.nextIndex(),
    offset,
  });
  const annotation: Command[] =
    store.getPage(pageId)?.kind === "breadboard"
      ? planPastedBreadboardReferences(store, pageId, plan.commands)
      : [];
  const membership: Command[] = [];
  if (preserveParents) {
    const context = editor.createShapeContext();
    const parents = frameParents(store, pageId, context);
    const roots = new Set(topLevelAmong(store, [...plan.mapping.keys()]));
    const groupParents = new Map(
      [...roots].map((id) => [id, groupOf(store, id)?.id]),
    );
    for (const frame of store.getPageElements(pageId)) {
      if (
        (frame.type !== "frame" && frame.type !== "group") ||
        plan.mapping.has(frame.id)
      )
        continue;
      const semantic = frame.semantic as FrameSemantic;
      const members =
        semantic.memberIds ??
        [...parents]
          .filter(([, parent]) => parent === frame.id)
          .map(([child]) => child);
      const next = members.flatMap((child) => {
        const groupParent = groupParents.get(child);
        const ownsCopy =
          frame.type === "group"
            ? groupParent === frame.id
            : groupParent === undefined;
        const copy =
          roots.has(child) && ownsCopy ? plan.mapping.get(child) : undefined;
        return copy ? [child, copy] : [child];
      });
      if (next.length === members.length) continue;
      if (context.isLocked?.(frame.id)) return null;
      membership.push({
        type: "updateSemantic",
        id: frame.id,
        semantic: { ...semantic, memberIds: next },
      });
    }
  }
  return {
    commands: [...plan.commands, ...annotation, ...membership],
    ids: plan.ids,
  };
}
