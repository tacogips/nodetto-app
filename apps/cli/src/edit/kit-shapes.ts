import {
  applyKitProps as applyCoreKitProps,
  insertKitComponent,
} from "@nodetto/core";
import { isPlainObject, type ElementId } from "@nodetto/ir";
import type { Batch } from "./batch.ts";
import { OperationError, type JsonObject } from "./operation-input.ts";
import { resolveParentPlacement, attachToParent } from "./parent-fields.ts";
import { applySizingFields } from "./sizing-fields.ts";

export function isKitShapeId(id: string): boolean {
  return id.startsWith("ios:");
}
export function addKitShape(
  batch: Batch,
  operation: JsonObject,
  index: number,
): ElementId {
  const page = batch.page(operation["page"], index);
  const placement = resolveParentPlacement(batch, operation, index, page.id);
  const visual = operation["visual"];
  const props = operation["props"];
  if (visual !== undefined && !isPlainObject(visual))
    throw new OperationError(index, '"visual" must be an object');
  if (props !== undefined && !isPlainObject(props))
    throw new OperationError(index, '"props" must be an object');
  try {
    const x =
      typeof visual?.["x"] === "number"
        ? visual["x"] + (placement?.origin.x ?? 0)
        : placement?.origin.x;
    const y =
      typeof visual?.["y"] === "number"
        ? visual["y"] + (placement?.origin.y ?? 0)
        : placement?.origin.y;
    const id = insertKitComponent(batch.editor, String(operation["shape"]), {
      page: page.id,
      x,
      y,
      width:
        typeof visual?.["width"] === "number" ? visual["width"] : undefined,
      parentId: placement?.parentId,
      props,
    });
    attachToParent(
      batch,
      id,
      placement,
      x !== undefined || y !== undefined,
      index,
    );
    applySizingFields(batch, id, operation, index);
    batch.record(operation, index, id, "frame", page.id);
    return id;
  } catch (error) {
    if (error instanceof OperationError) throw error;
    throw new OperationError(
      index,
      error instanceof Error ? error.message : String(error),
    );
  }
}
export function applyKitProps(
  batch: Batch,
  id: ElementId,
  props: unknown,
  index: number,
): void {
  if (props === undefined) return;
  if (!isPlainObject(props))
    throw new OperationError(index, '"props" must be an object');
  try {
    applyCoreKitProps(batch.editor, id, props);
  } catch (error) {
    throw new OperationError(
      index,
      error instanceof Error ? error.message : String(error),
    );
  }
}
