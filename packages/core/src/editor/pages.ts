// Page operations of the editor: the document a fresh editor opens, the
// diff a page switch announces, and the commands behind adding, moving and
// duplicating pages in their fractional order.

import {
  type Document,
  type Page,
  type PageId,
  SCHEMA_VERSION,
} from "@nodetto/ir";
import { copyElements, planPaste } from "../clipboard.ts";
import type { Command } from "../commands.ts";
import type { Editor } from "../editor.ts";
import type { Rng } from "../fractional.ts";
import type { IdSource } from "../ids.ts";
import { planPageOrder } from "../page-order.ts";
import type { Store, StoreDiff } from "../store.ts";
import type { CreatePageOptions } from "./types.ts";

/**
 * Announced when the visible page changes. No element changed, but which
 * elements a renderer should be drawing did.
 */
export const PAGE_SWITCH_DIFF: StoreDiff = {
  added: [],
  updated: [],
  removed: [],
  pagesChanged: true,
};

export function emptyDocument(id: string, pageId: string): Document {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    title: "Untitled",
    pages: [{ id: pageId, name: "Page 1", kind: "freeform" }],
    elements: [],
  };
}

/** A new page ordered after the current ones. */
export function planNewPage(
  store: Store,
  rng: Rng,
  idSource: IdSource,
  options: CreatePageOptions,
): { readonly page: Page; readonly commands: Command[] } {
  const ordering = planPageOrder(
    store.listPages(),
    store.listPages().length,
    rng,
  );
  const page: Page = {
    id: options.id ?? idSource(),
    name: options.name ?? `Page ${store.listPages().length + 1}`,
    kind: options.kind ?? "freeform",
    order: ordering.order,
  };
  return {
    page,
    commands: [...ordering.commands, { type: "createPage", page }],
  };
}

/** The commands that move page `id` to index `target`, or `null` for a no-op. */
export function planPageMove(
  store: Store,
  rng: Rng,
  id: PageId,
  target: number,
): Command[] | null {
  const pages = store.listPages();
  const index = pages.findIndex((page) => page.id === id);
  if (
    index < 0 ||
    !Number.isInteger(target) ||
    target < 0 ||
    target >= pages.length ||
    target === index
  )
    return null;
  const ordering = planPageOrder(pages, target, rng, id);
  return [
    ...ordering.commands,
    { type: "updatePage", id, page: { order: ordering.order } },
  ];
}

/**
 * A copy of page `id`, placed right after it, with everything on it pasted
 * across through the clipboard path (ids remapped). `null` for unknown ids.
 */
export function planDuplicatePage(
  editor: Editor,
  rng: Rng,
  idSource: IdSource,
  id: PageId,
): { readonly page: Page; readonly commands: Command[] } | null {
  const source = editor.store.getPage(id);
  if (!source) {
    return null;
  }
  const pages = editor.store.listPages();
  const ordering = planPageOrder(
    pages,
    pages.findIndex((page) => page.id === id) + 1,
    rng,
  );
  const page: Page = {
    id: idSource(),
    name: `${source.name} copy`,
    kind: source.kind,
    order: ordering.order,
    ...(source.tokenMode ? { tokenMode: source.tokenMode } : {}),
  };
  const payload = copyElements(
    editor.store,
    editor.store.getPageElements(id).map((element) => element.id),
  );
  const plan = planPaste(payload, {
    page: page.id,
    idSource,
    nextIndex: () => editor.nextIndex(page.id),
    offset: { x: 0, y: 0 },
  });
  return {
    page,
    commands: [
      ...ordering.commands,
      { type: "createPage", page },
      ...plan.commands,
    ],
  };
}
