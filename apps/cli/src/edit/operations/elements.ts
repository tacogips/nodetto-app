import {
  frameParents,
  planScale,
  replaceText,
  textMatcher,
} from "@nodetto/core";
import {
  getElementTypeDefinition,
  isKnownElementType,
  isPlainObject,
  type Element,
} from "@nodetto/ir";
import type { Batch } from "../batch.ts";
import { selectedWhere } from "../selectors.ts";
import { applyLabel } from "../label-field.ts";
import {
  deepMerge,
  fillIds,
  type Json,
  type JsonObject,
  OperationError,
  requireNumber,
  requireText,
} from "../operation-input.ts";

function definitionOf(type: string) {
  return isKnownElementType(type) ? getElementTypeDefinition(type) : undefined;
}

export function editListField(
  batch: Batch,
  operation: JsonObject,
  index: number,
  op: "append" | "remove-item",
): void {
  const element = batch.element(operation["id"], index);
  const field = requireText(operation["field"], "field", index);
  const semantic = isPlainObject(element.semantic) ? element.semantic : {};
  const current = semantic[field];
  if (!Array.isArray(current))
    throw new OperationError(
      index,
      `${element.type} has no list field "${field}".`,
    );
  let next: Json[];
  if (op === "append") {
    const items = operation["items"];
    if (!Array.isArray(items) || !items.length)
      throw new OperationError(index, `"items" must be a non-empty array`);
    next = [...current, ...items];
  } else {
    const item = requireText(operation["item"], "item", index);
    const position = current.findIndex(
      (entry) =>
        isPlainObject(entry) &&
        (entry["id"] === item || entry["name"] === item),
    );
    if (position < 0)
      throw new OperationError(
        index,
        `No item with id or name "${item}" in ${field}.`,
      );
    next = current.filter((_, at) => at !== position);
  }
  const definition = definitionOf(element.type);
  batch.editor.apply([
    {
      type: "updateSemantic",
      id: element.id,
      semantic: fillIds({ ...semantic, [field]: next }, definition?.keyOrder),
    },
  ]);
  batch.touchedPages.add(element.page);
  return;
}

export function updateElement(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  if (
    operation["semantic"] === undefined &&
    operation["visual"] === undefined &&
    operation["label"] === undefined
  )
    throw new OperationError(index, "update needs semantic, visual or label");
  for (const element of selectedWhere(batch, operation, index, "update"))
    updateOne(batch, element, operation, index);
}

function updateOne(
  batch: Batch,
  element: Element,
  operation: JsonObject,
  index: number,
): void {
  const definition = definitionOf(element.type);
  const commands = [];
  if (operation["semantic"] !== undefined) {
    const merged = batch.resolveReferences(
      element.type,
      fillIds(
        deepMerge(element.semantic, operation["semantic"]),
        definition?.keyOrder,
      ),
      index,
      element.page,
    );
    commands.push({
      type: "updateSemantic" as const,
      id: element.id,
      semantic: merged,
    });
  }
  const visual = operation["visual"];
  if (visual !== undefined) {
    if (!isPlainObject(visual))
      throw new OperationError(index, `"visual" must be an object`);
    commands.push({
      type: "updateVisual" as const,
      id: element.id,
      visual,
    });
  }
  const carry = operation["carryMembers"];
  if (carry !== undefined && typeof carry !== "boolean")
    throw new OperationError(index, `"carryMembers" must be true or false`);
  if (carry === false && element.type !== "frame")
    throw new OperationError(index, "carryMembers applies only to frames");
  if (!commands.length && operation["label"] === undefined)
    throw new OperationError(index, "update needs semantic, visual or label");
  let placed: Set<string> | undefined;
  if (carry === false) {
    batch.editor.setCurrentPage(element.page);
    const parents = frameParents(
      batch.editor.store,
      element.page,
      batch.editor.createShapeContext(1),
    );
    placed = new Set<string>();
    for (const [child] of parents) {
      let parent = parents.get(child);
      while (parent) {
        if (parent === element.id) {
          placed.add(child);
          break;
        }
        parent = parents.get(parent);
      }
    }
  }
  batch.editor.apply(commands, placed ? { placed } : undefined);
  if (operation["label"] !== undefined)
    applyLabel(batch, element.id, operation["label"], index);
  batch.touchedPages.add(element.page);
  return;
}

export function moveElement(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const element = batch.element(operation["id"], index);
  batch.editor.moveElements([
    {
      id: element.id,
      x: requireNumber(operation["x"], "x", index),
      y: requireNumber(operation["y"], "y", index),
    },
  ]);
  batch.touchedPages.add(element.page);
  return;
}

export function scaleElements(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const factor = requireNumber(operation["factor"], "factor", index);
  if (factor <= 0)
    throw new OperationError(index, `"factor" must be above zero`);
  const origin = operation["origin"];
  if (
    origin !== undefined &&
    !(
      isPlainObject(origin) &&
      typeof origin["x"] === "number" &&
      typeof origin["y"] === "number"
    )
  )
    throw new OperationError(
      index,
      `"origin" must be {"x":<number>,"y":<number>}`,
    );
  const targets = batch.targets(operation, index, false);
  const page = targets[0]?.page;
  if (page === undefined)
    throw new OperationError(index, "There is nothing to scale.");
  batch.editor.setCurrentPage(page);
  const plan = planScale(
    batch.editor,
    targets.map((element) => element.id),
    factor,
    isPlainObject(origin)
      ? { x: Number(origin["x"]), y: Number(origin["y"]) }
      : undefined,
  );
  if (!plan) throw new OperationError(index, "There is nothing to scale.");
  batch.editor.apply(plan.commands, { placed: plan.placed });
  batch.touchedPages.add(page);
  return;
}

export function replaceTextIn(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const find = requireText(operation["find"], "find", index);
  const replacement = operation["replace"];
  if (typeof replacement !== "string")
    throw new OperationError(index, `"replace" must be a string`);
  for (const field of ["regex", "ignoreCase"] as const) {
    if (operation[field] !== undefined && typeof operation[field] !== "boolean")
      throw new OperationError(
        index,
        `"${field}" must be true or false (true reads "find" as a regular expression)`,
      );
  }
  const matcher = textMatcher(find, {
    regex: operation["regex"] === true,
    ignoreCase: operation["ignoreCase"] === true,
  });
  if (typeof matcher === "string") throw new OperationError(index, matcher);
  const targets = batch.targets(operation, index, true);
  const changes = replaceText(
    batch.editor,
    targets.map((element) => element.id),
    matcher,
    replacement,
  );
  for (const change of changes) {
    const element = batch.editor.store.get(change.id);
    if (element) batch.touchedPages.add(element.page);
  }
  batch.replaced.push(...changes);
  return;
}

export function deleteElement(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const elements = selectedWhere(batch, operation, index, "delete");
  if (elements.length)
    batch.editor.deleteElements(elements.map((element) => element.id));
  for (const element of elements) batch.touchedPages.add(element.page);
  return;
}
