import { expandContainers, groupOf } from "@nodetto/core";
import type { Batch } from "../batch.ts";
import {
  type JsonObject,
  OperationError,
  requireText,
} from "../operation-input.ts";
import { resolveElementReference, selectedWhere } from "../selectors.ts";

export function orderElements(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const to = operation["to"];
  const before = operation["before"];
  const after = operation["after"];
  if ([to, before, after].filter((value) => value !== undefined).length !== 1)
    throw new OperationError(
      index,
      'order needs exactly one of "to", "before" or "after"',
    );
  if (
    to !== undefined &&
    to !== "back" &&
    to !== "front" &&
    to !== "backward" &&
    to !== "forward"
  )
    throw new OperationError(
      index,
      '"to" must be back, front, backward or forward',
    );
  const targets = selectedWhere(batch, operation, index, "order");
  const first = targets[0];
  if (!first) return;
  const page = first.page;
  if (targets.some((element) => element.page !== page))
    throw new OperationError(index, "order targets must be on one page");
  const group = groupOf(batch.editor.store, first.id);
  if (
    targets.some(
      (element) => groupOf(batch.editor.store, element.id)?.id !== group?.id,
    )
  )
    throw new OperationError(
      index,
      "order targets must all be ungrouped or all in one group",
    );
  const ids = targets.map((element) => element.id);
  let placement:
    | { to: "back" | "front" | "backward" | "forward" }
    | { before: string }
    | { after: string };
  if (to !== undefined) {
    placement = { to: to as "back" | "front" | "backward" | "forward" };
  } else {
    const field = before !== undefined ? "before" : "after";
    const anchor = resolveElementReference(
      batch,
      requireText(field === "before" ? before : after, field, index),
      index,
      page,
    );
    if (anchor.page !== page)
      throw new OperationError(index, `anchor ${anchor.id} is on another page`);
    const anchorGroup = groupOf(batch.editor.store, anchor.id);
    if (group && anchorGroup?.id !== group.id)
      throw new OperationError(
        index,
        `anchor ${anchor.id} must be in the same group`,
      );
    if (!group && anchorGroup)
      throw new OperationError(
        index,
        `anchor ${anchor.id} is inside a group; order relative to the group`,
      );
    const moved = group
      ? ids
      : expandContainers(
          batch.editor.store,
          ids,
          batch.editor.createShapeContext(1),
        );
    if (moved.includes(anchor.id))
      throw new OperationError(
        index,
        `anchor ${anchor.id} is one of the elements being moved`,
      );
    placement =
      field === "before" ? { before: anchor.id } : { after: anchor.id };
  }
  batch.editor.setCurrentPage(page);
  batch.editor.orderElements(ids, placement);
  batch.touchedPages.add(page);
}

export function orderOpHint(op: unknown): string | undefined {
  if (op === "send-to-back") return ' Use {"op":"order","id":...,"to":"back"}.';
  if (op === "bring-to-front")
    return ' Use {"op":"order","id":...,"to":"front"}.';
  if (op === "reorder") return ' Use order with "to", "before" or "after".';
  return undefined;
}
