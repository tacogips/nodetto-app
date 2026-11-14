import type { Editor } from "@nodetto/core";
import {
  type Element,
  getElementTypeDefinition,
  isKnownElementType,
  isPlainObject,
} from "@nodetto/ir";
import type { Batch } from "./batch.ts";
import { OperationError, type Json } from "./operation-input.ts";

export function labelField(
  editor: Editor,
  element: Element,
): { field: string } | { error: string } {
  const definition = isKnownElementType(element.type)
    ? getElementTypeDefinition(element.type)
    : undefined;
  if (definition?.category === "edge")
    return {
      field:
        element.type === "state.transition"
          ? "trigger"
          : element.type.startsWith("bpmn.")
            ? "name"
            : "label",
    };
  const editable = editor.editableField(element.id);
  if (editable) return { field: editable };
  const semantic = isPlainObject(element.semantic) ? element.semantic : {};
  const field = ["name", "label", "text"].find(
    (key) => typeof semantic[key] === "string",
  );
  return field
    ? { field }
    : {
        error: `${element.type} has no text label; set its fields with "semantic".`,
      };
}
export function applyLabel(
  batch: Batch,
  elementId: string,
  label: Json,
  index: number,
): void {
  if (typeof label !== "string")
    throw new OperationError(index, `"label" must be a string`);
  const element = batch.editor.store.get(elementId);
  if (!element) throw new OperationError(index, `No element ${elementId}.`);
  const resolved = labelField(batch.editor, element);
  if ("error" in resolved) throw new OperationError(index, resolved.error);
  if (batch.editor.editableField(element.id) === resolved.field)
    batch.editor.setText(element.id, label);
  else
    batch.editor.apply([
      {
        type: "updateSemantic",
        id: element.id,
        semantic: {
          ...(isPlainObject(element.semantic) ? element.semantic : {}),
          [resolved.field]: label,
        },
      },
    ]);
}
