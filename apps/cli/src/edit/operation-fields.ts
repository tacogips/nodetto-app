import { VISUAL_STYLE_KEY_ORDER } from "@nodetto/ir";
import { OperationError, type JsonObject } from "./operation-input.ts";

export const OPERATION_FIELDS: Readonly<Record<string, readonly string[]>> = {
  add: [
    "op",
    "page",
    "type",
    "shape",
    "id",
    "ref",
    "semantic",
    "visual",
    "place",
    "label",
  ],
  connect: [
    "op",
    "from",
    "to",
    "page",
    "shape",
    "type",
    "id",
    "ref",
    "semantic",
    "visual",
    "label",
    "fromColumn",
    "toColumn",
    "cardinality",
  ],
  update: [
    "op",
    "id",
    "where",
    "expect",
    "semantic",
    "visual",
    "label",
    "carryMembers",
  ],
  append: ["op", "id", "field", "items"],
  "remove-item": ["op", "id", "field", "item"],
  move: ["op", "id", "x", "y"],
  delete: ["op", "id", "where", "expect"],
  select: ["op", "ref", "id", "where", "expect"],
  scale: ["op", "ids", "page", "factor", "origin"],
  "replace-text": [
    "op",
    "find",
    "replace",
    "regex",
    "ignoreCase",
    "ids",
    "page",
  ],
  group: ["op", "ids", "ref", "name"],
  ungroup: ["op", "id"],
  "add-page": [
    "op",
    "name",
    "kind",
    "id",
    "ref",
    "before",
    "after",
    "order",
    "mode",
  ],
  "move-page": ["op", "id", "before", "after", "order"],
  "rename-page": ["op", "id", "name"],
  "set-page-mode": ["op", "id", "mode"],
  "delete-page": ["op", "id"],
};

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(
        Math.min(
          (row[j + 1] ?? 0) + 1,
          (next[j] ?? 0) + 1,
          (row[j] ?? 0) + (a[i] === b[j] ? 0 : 1),
        ),
      );
    row = next;
  }
  return row[b.length] ?? 0;
}
export function checkOperationFields(
  operation: JsonObject,
  index: number,
): void {
  const fields =
    typeof operation["op"] === "string"
      ? OPERATION_FIELDS[operation["op"]]
      : undefined;
  if (!fields) return;
  checkFields(operation, fields, index);
  if (operation["op"] === "add" || operation["op"] === "update")
    checkVisualStyleFields(operation, index);
}

function checkVisualStyleFields(operation: JsonObject, index: number): void {
  const visual = operation["visual"];
  if (!visual || typeof visual !== "object" || Array.isArray(visual)) return;
  const style = (visual as JsonObject)["style"];
  if (!style || typeof style !== "object" || Array.isArray(style)) return;
  const valid = [...VISUAL_STYLE_KEY_ORDER.keys, "extensions"];
  const errors = Object.keys(style)
    .filter((key) => !valid.includes(key))
    .map((key) => {
      const name = key.toLowerCase();
      const suggestions = valid
        .map((candidate, order) => {
          const lower = candidate.toLowerCase();
          let position = 0;
          for (const char of lower) if (char === name[position]) position++;
          return {
            candidate,
            order,
            score: distance(name, lower),
            matches:
              position === name.length ||
              name.includes(lower) ||
              lower.includes(name),
          };
        })
        .filter(({ score, matches }) => score <= 2 || matches)
        .sort((a, b) => a.score - b.score || a.order - b.order)
        .slice(0, 3)
        .map(({ candidate }) => `"${candidate}"`);
      const hint =
        suggestions.length === 1
          ? suggestions[0]
          : `${suggestions.slice(0, -1).join(", ")} or ${suggestions.at(-1)}`;
      return `unknown visual.style key "${key}".${suggestions.length ? ` Did you mean ${hint}?` : ""}`;
    });
  if (errors.length)
    throw new OperationError(
      index,
      `${errors.join(" ")} Valid style keys: ${valid.join(", ")}.`,
    );
}

export function checkFields(
  operation: JsonObject,
  fields: readonly string[],
  index: number,
): void {
  const errors = Object.keys(operation)
    .filter((field) => !fields.includes(field))
    .map((field) => {
      const name = field.toLowerCase();
      let best: string | undefined;
      let score = Number.POSITIVE_INFINITY;
      for (const candidate of fields) {
        const lower = candidate.toLowerCase();
        const d = distance(name, lower);
        if (
          (d <= 2 || name.startsWith(lower) || lower.startsWith(name)) &&
          d < score
        ) {
          best = candidate;
          score = d;
        }
      }
      return `unknown field "${field}".${best ? ` Did you mean "${best}"?` : ""}`;
    });
  if (errors.length)
    throw new OperationError(
      index,
      `${errors.join(" ")} Valid fields: ${fields.join(", ")}.`,
    );
}
