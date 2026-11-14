import type { Batch } from "../batch.ts";
import { type JsonObject, OperationError } from "../operation-input.ts";

export function groupElements(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const ids = operation["ids"];
  if (!Array.isArray(ids) || ids.length < 2)
    throw new OperationError(
      index,
      `"ids" must list two or more elements to group`,
    );
  const members = ids.map((id) => batch.element(id, index));
  const page = members[0]?.page as string;
  if (members.some((member) => member.page !== page))
    throw new OperationError(index, "group needs elements on one page.");
  batch.editor.setCurrentPage(page);
  batch.editor.selection.set(members.map((member) => member.id));
  const id = batch.editor.groupSelection();
  if (!id)
    throw new OperationError(
      index,
      "group needs two or more distinct elements on one page.",
    );
  const name = operation["name"];
  if (typeof name === "string" && name.trim())
    batch.editor.apply([
      { type: "updateVisual", id, visual: { layerName: name } },
    ]);
  batch.record(operation, index, id, "group", page);
  return;
}

export function ungroupElement(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const group = batch.element(operation["id"], index);
  if (group.type !== "group")
    throw new OperationError(
      index,
      `${group.id} is a ${group.type}, not a group.`,
    );
  batch.editor.setCurrentPage(group.page);
  batch.editor.selection.set([group.id]);
  batch.editor.ungroupSelection();
  batch.touchedPages.add(group.page);
  return;
}
