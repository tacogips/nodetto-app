import {
  connectScreenTransition,
  connectShape,
  screenFrame,
} from "@nodetto/core";
import { type Element, isPlainObject } from "@nodetto/ir";
import type { Batch } from "../batch.ts";
import { applyLabel } from "../label-field.ts";
import {
  deepMerge,
  type Json,
  type JsonObject,
  OperationError,
  requireText,
} from "../operation-input.ts";
import { addElement } from "./add.ts";
import { resolveConnectRouting, supportsRouting } from "../connect-routing.ts";
import { withBoxLabelAlign } from "../visual-patch.ts";

/**
 * Connect two elements the way the app's connect tool does (connectSmart):
 * ERD tables get a relation, UML classes an association, sequence
 * participants a message on the next timeline row (lifelines grow), BPMN
 * nodes a flow that obeys BPMN rules, anything else a generic edge.
 */
export function connectElements(
  batch: Batch,
  operation: JsonObject,
  index: number,
): string {
  if (
    operation["label"] !== undefined &&
    typeof operation["label"] !== "string"
  )
    throw new OperationError(index, `"label" must be a string`);
  const page =
    operation["page"] === undefined
      ? undefined
      : batch.page(operation["page"], index).id;
  const from = batch.element(operation["from"], index, page);
  const back = operation["shape"] === "prototype:back";
  if (back && !screenFrame(batch.editor, from.id))
    throw new OperationError(index, `from ${from.id} is not inside a screen.`);
  const to = back ? from : batch.element(operation["to"], index, from.page);
  if (back && operation["to"] !== undefined)
    batch.convertWarnings.push({
      operation: index,
      op: "connect",
      element: from.id,
      type: from.type,
      path: "to",
      code: "prototype.back.ignored-target",
      message: "prototype:back ignores to.",
    });
  const semantic: JsonObject | undefined = isPlainObject(operation["semantic"])
    ? {
        ...operation["semantic"],
        ...(operation["semantic"]["prototypeTrigger"] === "tap"
          ? { prototypeTrigger: "click" }
          : {}),
      }
    : undefined;
  if (from.page !== to.page)
    throw new OperationError(
      index,
      "connect needs two elements on the same page.",
    );
  const shape =
    operation["shape"] === undefined
      ? undefined
      : batch.shape(operation, index);
  if (shape && !shape.connector)
    throw new OperationError(
      index,
      `${shape.id} is not a connector; use {"op":"add","shape":"${shape.id}"}.`,
    );
  const resolved = resolveConnectRouting(batch, from.page, operation, index);
  if (typeof operation["type"] === "string") {
    if (!supportsRouting(operation["type"]) && resolved.explicit)
      throw new OperationError(
        index,
        `${operation["type"]} does not support routing`,
      );
    return addElement(
      batch,
      {
        op: "add",
        page: from.page,
        type: operation["type"],
        semantic: deepMerge(
          {
            from: from.id,
            to: to.id,
            ...(typeof operation["label"] === "string"
              ? {
                  [operation["type"] === "state.transition"
                    ? "trigger"
                    : operation["type"].startsWith("bpmn.")
                      ? "name"
                      : "label"]: operation["label"],
                }
              : {}),
          },
          deepMerge(
            semantic ?? {},
            supportsRouting(operation["type"]) ? resolved.routing : {},
          ),
        ),
        ...(resolved.visual === undefined ? {} : { visual: resolved.visual }),
        ...(typeof operation["ref"] === "string"
          ? { ref: operation["ref"] }
          : {}),
      },
      index,
    );
  }
  batch.editor.setCurrentPage(from.page);
  const id = shape
    ? connectShape(batch.editor, shape.id, from.id, to.id)
    : semantic?.["prototype"] === true
      ? connectScreenTransition(batch.editor, from.id, to.id)
      : batch.editor.connectSmart(from.id, to.id);
  if (id === null)
    throw new OperationError(
      index,
      shape
        ? `${shape.label} (${shape.id}) cannot connect ${from.type} to ${to.type}; it joins ${shape.type} endpoints of its own notation.`
        : `Cannot connect ${from.type} to ${to.type} here (a rule of this diagram kind forbids it, or an element is locked).`,
    );
  if (operation["label"] !== undefined)
    applyLabel(batch, id, operation["label"], index);
  const created = batch.editor.store.get(id);
  if (!created)
    throw new OperationError(index, "The connector was not created.");
  if (!supportsRouting(created.type) && resolved.explicit)
    throw new OperationError(index, `${created.type} does not support routing`);
  let patch: Record<string, Json> = {};
  if (created.type === "erd.relation") {
    const column = (table: Element, query: Json, field: string) => {
      if (query === undefined) return {};
      const name = requireText(query, field, index);
      const columns = isPlainObject(table.semantic)
        ? table.semantic["columns"]
        : undefined;
      const match = Array.isArray(columns)
        ? columns.find(
            (item) =>
              isPlainObject(item) &&
              (item["id"] === name || item["name"] === name),
          )
        : undefined;
      if (!isPlainObject(match) || typeof match["id"] !== "string")
        throw new OperationError(
          index,
          `${field} "${name}" is not a column of that table.`,
        );
      return { column: match["id"] };
    };
    patch = {
      from: {
        table: from.id,
        ...column(from, operation["fromColumn"], "fromColumn"),
      },
      to: { table: to.id, ...column(to, operation["toColumn"], "toColumn") },
      cardinality:
        typeof operation["cardinality"] === "string"
          ? operation["cardinality"]
          : "*:1",
    };
  }
  if (semantic) patch = deepMerge(patch, semantic) as Record<string, Json>;
  if (supportsRouting(created.type))
    patch = deepMerge(patch, resolved.routing) as Record<string, Json>;
  if (resolved.visual !== undefined)
    batch.editor.apply([
      {
        type: "updateVisual",
        id,
        visual: withBoxLabelAlign(created.type, resolved.visual, undefined),
      },
    ]);
  if (Object.keys(patch).length)
    batch.editor.apply([
      {
        type: "updateSemantic",
        id,
        semantic: batch.resolveReferences(
          created.type,
          deepMerge(created.semantic, patch),
          index,
          from.page,
        ),
      },
    ]);
  batch.record(operation, index, id, created.type, from.page);
  return id;
}
