// Inserting copies onto the current page: the paste plan plus the follow-up
// commands a copy needs to fit in — fresh breadboard references, and (for a
// duplicate) membership in the frames and groups its originals belong to.

import {
  CAD_PAGE_KIND,
  type ElementId,
  type FrameSemantic,
  isPlainObject,
  pageAcceptsElementType,
} from "@nodetto/ir";
import { type ClipboardPayload, planPaste } from "../clipboard.ts";
import type { Command } from "../commands.ts";
import type { EditorCore } from "./facade/core.ts";
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
 * the ids they create. `null` when nothing can be inserted or a duplicate
 * would have to join a locked frame.
 */
export function planInsertCopies(
  editor: EditorCore,
  idSource: IdSource,
  payload: ClipboardPayload,
  offset: Vec,
  preserveParents: boolean,
): { readonly commands: Command[]; readonly ids: readonly ElementId[] } | null {
  const store = editor.store;
  const pageId = editor.currentPageId;
  const page = store.getPage(pageId);
  if (!page) return null;
  let elements = payload.elements.filter(({ type }) =>
    pageAcceptsElementType(page.kind, type),
  );
  if (page.kind === CAD_PAGE_KIND) {
    const copiesById = new Map(
      elements.map((element) => [element.id, element]),
    );
    elements = elements.filter(({ type, semantic }) => {
      if (type !== "cad.line" && type !== "cad.arc" && type !== "cad.circle")
        return true;
      const sketchId = isPlainObject(semantic) ? semantic["sketch"] : undefined;
      if (typeof sketchId !== "string") return false;
      // planPaste remaps copied ids onto this page and leaves other ids alone.
      const copy = copiesById.get(sketchId);
      if (copy) return copy.type === "cad.sketch";
      const sketch = store.get(sketchId);
      return sketch?.type === "cad.sketch" && sketch.page === pageId;
    });
  }
  const plan = planPaste(
    { elements },
    { page: pageId, idSource, nextIndex: () => editor.nextIndex(), offset },
  );
  if (!plan.ids.length) return null;
  const annotation: Command[] =
    page.kind === "breadboard"
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
