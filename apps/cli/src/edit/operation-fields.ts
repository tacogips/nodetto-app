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
  update: ["op", "id", "semantic", "visual", "label", "carryMembers"],
  append: ["op", "id", "field", "items"],
  "remove-item": ["op", "id", "field", "item"],
  move: ["op", "id", "x", "y"],
  delete: ["op", "id"],
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
