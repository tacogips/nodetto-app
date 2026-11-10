import {
  findInsertionParent,
  frameParents,
  planAttachToFrame,
  safeAreaContentBox,
} from "@nodetto/core";
import type { Element, ElementId, FrameSemantic, PageId } from "@nodetto/ir";
import type { Batch } from "./batch.ts";
import { OperationError, type JsonObject } from "./operation-input.ts";

export interface ParentPlacement {
  readonly parentId: ElementId;
  readonly origin: { readonly x: number; readonly y: number };
  readonly memberIndex?: number;
}

export function resolveParentPlacement(
  batch: Batch,
  operation: JsonObject,
  index: number,
  pageId: PageId,
): ParentPlacement | undefined {
  const parent = operation["parent"];
  const memberIndex = operation["memberIndex"];
  if (
    memberIndex !== undefined &&
    (!Number.isInteger(memberIndex) ||
      typeof memberIndex !== "number" ||
      memberIndex < 0)
  )
    throw new OperationError(index, '"memberIndex" must be an integer >= 0');
  if (parent === undefined) {
    if (memberIndex !== undefined)
      throw new OperationError(index, '"memberIndex" requires "parent"');
    return undefined;
  }
  const frame = batch.element(parent, index, pageId);
  if (frame.type !== "frame" || frame.page !== pageId)
    throw new OperationError(
      index,
      '"parent" must be a frame on the target page',
    );
  const box = batch.boundsOf(frame.id);
  if (!box) throw new OperationError(index, "parent frame has no bounds");
  return {
    parentId: frame.id,
    origin: { x: box.x, y: box.y },
    ...(typeof memberIndex === "number" ? { memberIndex } : {}),
  };
}

export function attachToParent(
  batch: Batch,
  id: ElementId,
  placement: ParentPlacement | undefined,
  positioned: boolean,
  index: number,
): void {
  const element = batch.editor.store.get(id);
  if (!element) return;
  let parentId = placement?.parentId;
  if (placement) {
    const frame = batch.editor.store.get(placement.parentId);
    if (!frame) return;
    const semantic = frame.semantic as FrameSemantic;
    if (!positioned && !semantic.layout) {
      const box = batch.boundsOf(frame.id);
      if (box) {
        const content = semantic.safeArea
          ? safeAreaContentBox(box, semantic.safeArea)
          : box;
        batch.moveBoxTo(id, content.x, content.y);
      }
    }
  } else {
    const box = batch.boundsOf(id);
    if (box)
      parentId = findInsertionParent(
        batch.editor.store,
        element.page,
        box,
        batch.editor.createShapeContext(),
        new Set([id]),
      );
  }
  if (!parentId) return;
  const frame = batch.editor.store.get(parentId);
  if (!frame) return;
  const semantic = frame.semantic as FrameSemantic;
  batch.editor.apply(
    planAttachToFrame(batch.editor.store, parentId, id, placement?.memberIndex),
  );
  if (
    placement &&
    !semantic.memberIds &&
    frameParents(
      batch.editor.store,
      element.page,
      batch.editor.createShapeContext(),
    ).get(id) !== parentId
  )
    batch.convertWarnings.push({
      operation: index,
      op: "add",
      element: id,
      type: element.type,
      path: "parent",
      code: "parent.outside",
      message: `${id} extends outside its parent frame`,
    });
}

export function reparentFromUpdate(
  batch: Batch,
  element: Element,
  operation: JsonObject,
  index: number,
): ParentPlacement | undefined {
  if (operation["parent"] === null) {
    if (operation["memberIndex"] !== undefined)
      throw new OperationError(index, '"memberIndex" requires a frame parent');
    const oldParent = frameParents(
      batch.editor.store,
      element.page,
      batch.editor.createShapeContext(),
    ).get(element.id);
    if (oldParent && !batch.editor.reparentElement(element.id, null))
      throw new OperationError(index, "Cannot reparent element");
    return { parentId: element.id, origin: { x: 0, y: 0 } };
  }
  const placement = resolveParentPlacement(
    batch,
    operation,
    index,
    element.page,
  );
  if (!placement) return undefined;
  const oldParent = frameParents(
    batch.editor.store,
    element.page,
    batch.editor.createShapeContext(),
  ).get(element.id);
  if (
    oldParent !== placement.parentId &&
    !batch.editor.reparentElement(element.id, placement.parentId)
  )
    throw new OperationError(index, "Cannot reparent element");
  if (placement.memberIndex !== undefined) {
    const frame = batch.editor.store.get(placement.parentId);
    if (frame) {
      const semantic = frame.semantic as FrameSemantic;
      if (semantic.memberIds) {
        const members = semantic.memberIds.filter(
          (member) => member !== element.id,
        );
        members.splice(
          Math.min(placement.memberIndex, members.length),
          0,
          element.id,
        );
        batch.editor.apply([
          {
            type: "updateSemantic",
            id: frame.id,
            semantic: { ...semantic, memberIds: members },
          },
        ]);
      }
    }
  }
  return placement;
}
