import type { Batch } from "../batch.ts";
import {
  OperationError,
  requireText,
  type JsonObject,
} from "../operation-input.ts";
import { selectedWhere } from "../selectors.ts";

export function selectElement(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const ref = requireText(operation["ref"], "ref", index);
  if (!ref.trim())
    throw new OperationError(index, '"ref" must be a non-empty string');
  if (batch.refs.has(ref))
    throw new OperationError(index, `ref "${ref}" is already used.`);
  if (operation["id"] === undefined && operation["where"] === undefined)
    throw new OperationError(index, 'select needs "id" or "where"');
  if (operation["id"] !== undefined && operation["where"] !== undefined)
    throw new OperationError(index, 'use either "id" or "where"');
  if (
    operation["where"] !== undefined &&
    operation["expect"] !== undefined &&
    operation["expect"] !== 1
  )
    throw new OperationError(
      index,
      'select binds exactly one element; "expect" must be 1',
    );
  const matches = selectedWhere(batch, operation, index, "select", 1);
  const element = matches[0];
  if (!element) throw new OperationError(index, "select needs one element");
  if (operation["where"] === undefined)
    batch.matches.push({
      operation: index,
      op: "select",
      count: 1,
      ids: [element.id],
    });
  batch.refs.set(ref, element.id);
}
