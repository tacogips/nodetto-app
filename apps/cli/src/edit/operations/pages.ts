import { isFractionalKey } from "@nodetto/core";
import { isPageKind, isPageMode, PAGE_MODES } from "@nodetto/ir";
import type { Batch } from "../batch.ts";
import {
  type Json,
  type JsonObject,
  OperationError,
  requireText,
} from "../operation-input.ts";

function unknownMode(mode: Json): string {
  return `Unknown page mode "${String(mode)}". Choose ${PAGE_MODES.join(", ")}, or null to follow the page kind.`;
}

/**
 * Put a page before or after another page, or at an explicit fractional
 * order key. Returns false when the operation names no placement.
 */
export function placePage(
  batch: Batch,
  id: string,
  operation: JsonObject,
  index: number,
): boolean {
  const fields = (["before", "after", "order"] as const).filter(
    (field) => operation[field] !== undefined,
  );
  if (fields.length > 1)
    throw new OperationError(
      index,
      `use only one of "before", "after" and "order"`,
    );
  const field = fields[0];
  if (field === undefined) return false;
  if (field === "order") {
    const order = requireText(operation["order"], "order", index);
    if (!isFractionalKey(order))
      throw new OperationError(
        index,
        `"order" must be a base62 fractional key without a trailing zero (for example "a0" or "b1V").`,
      );
    const taken = batch.editor.store
      .listPages()
      .find((page) => page.id !== id && page.order === order);
    if (taken)
      throw new OperationError(
        index,
        `order "${order}" is already used by page ${taken.id}; use "before" or "after" instead.`,
      );
    batch.editor.apply([{ type: "updatePage", id, page: { order } }]);
    return true;
  }
  const anchor = batch.page(operation[field], index);
  if (anchor.id === id)
    throw new OperationError(index, `a page cannot be placed ${field} itself.`);
  const remaining = batch.editor.store
    .listPages()
    .filter((page) => page.id !== id);
  const at = remaining.findIndex((page) => page.id === anchor.id);
  batch.editor.reorderPageTo(id, field === "before" ? at : at + 1);
  return true;
}

export function addPage(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const kind = operation["kind"] ?? "freeform";
  if (typeof kind !== "string" || !isPageKind(kind))
    throw new OperationError(index, `Unknown page kind "${String(kind)}".`);
  const mode = operation["mode"];
  if (mode !== undefined && !isPageMode(mode))
    throw new OperationError(index, unknownMode(mode));
  const id = batch.editor.createPage({
    name: requireText(operation["name"], "name", index),
    kind,
    ...(mode === undefined ? {} : { mode }),
    ...(typeof operation["id"] === "string" ? { id: operation["id"] } : {}),
  });
  if (typeof operation["ref"] === "string")
    batch.refs.set(operation["ref"], id);
  placePage(batch, id, operation, index);
  batch.touchedPages.add(id);
  return;
}

export function movePage(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const page = batch.page(operation["id"], index);
  if (!placePage(batch, page.id, operation, index))
    throw new OperationError(
      index,
      `move-page needs "before" or "after" (a page) or "order" (a fractional key)`,
    );
  return;
}

export function renamePage(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const page = batch.page(operation["id"], index);
  batch.editor.renamePage(
    page.id,
    requireText(operation["name"], "name", index),
  );
  return;
}

export function setPageMode(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const page = batch.page(operation["id"], index);
  const mode = operation["mode"];
  if (mode !== null && !isPageMode(mode))
    throw new OperationError(index, unknownMode(mode));
  batch.editor.setPageMode(page.id, mode);
  return;
}

export function deletePage(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const page = batch.page(operation["id"], index);
  if (!batch.editor.deletePage(page.id))
    throw new OperationError(index, "The last page cannot be deleted.");
  batch.touchedPages.delete(page.id);
  return;
}
