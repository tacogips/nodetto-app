import { connectScreenTransition, connectShape } from "@nodetto/core";
import { type Element, isPlainObject } from "@nodetto/ir";
import type { Batch } from "../batch.ts";
import {
  deepMerge,
  type Json,
  type JsonObject,
  OperationError,
  requireText,
} from "../operation-input.ts";
import { addElement } from "./add.ts";

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
  const from = batch.element(operation["from"], index);
  const to = batch.element(operation["to"], index);
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
  if (typeof operation["type"] === "string")
    return addElement(
      batch,
      {
        op: "add",
        page: from.page,
        type: operation["type"],
        semantic: deepMerge(
          { from: from.id, to: to.id },
          isPlainObject(operation["semantic"]) ? operation["semantic"] : {},
        ),
        ...(typeof operation["ref"] === "string"
          ? { ref: operation["ref"] }
          : {}),
      },
      index,
    );
  batch.editor.setCurrentPage(from.page);
  const id = shape
    ? connectShape(batch.editor, shape.id, from.id, to.id)
    : isPlainObject(operation["semantic"]) &&
        operation["semantic"]["prototype"] === true
      ? connectScreenTransition(batch.editor, from.id, to.id)
      : batch.editor.connectSmart(from.id, to.id);
  if (id === null)
    throw new OperationError(
      index,
      shape
        ? `${shape.label} (${shape.id}) cannot connect ${from.type} to ${to.type}; it joins ${shape.type} endpoints of its own notation.`
        : `Cannot connect ${from.type} to ${to.type} here (a rule of this diagram kind forbids it, or an element is locked).`,
    );
  const created = batch.editor.store.get(id);
  if (!created)
    throw new OperationError(index, "The connector was not created.");
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
  const label = operation["label"];
  if (typeof label === "string")
    patch[
      created.type === "state.transition"
        ? "trigger"
        : created.type.startsWith("bpmn.")
          ? "name"
          : "label"
    ] = label;
  if (isPlainObject(operation["semantic"]))
    patch = deepMerge(patch, operation["semantic"]) as Record<string, Json>;
  if (Object.keys(patch).length)
    batch.editor.apply([
      {
        type: "updateSemantic",
        id,
        semantic: deepMerge(created.semantic, patch),
      },
    ]);
  batch.record(operation, index, id, created.type, from.page);
  return id;
}
