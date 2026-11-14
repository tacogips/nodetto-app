import { newElementId } from "@nodetto/core";
import { isPlainObject, type KeyOrder } from "@nodetto/ir";

export type Json = unknown;
export type JsonObject = Readonly<Record<string, Json>>;

export class OperationError extends Error {
  constructor(
    readonly index: number,
    message: string,
  ) {
    super(message);
  }
}

/** Parse a JSON array of operations, or JSON Lines with one operation each. */
export function parseOperations(text: string): readonly JsonObject[] {
  const trimmed = text.trim();
  if (trimmed === "") throw new Error("No operations were given.");
  let values: Json[];
  if (trimmed.startsWith("[")) {
    const parsed: Json = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");
    values = parsed;
  } else {
    values = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .map((line, index) => {
        try {
          return JSON.parse(line) as Json;
        } catch (cause) {
          throw new Error(
            `Line ${index + 1} is not JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
          );
        }
      });
  }
  return values.map((value, index) => {
    if (!isPlainObject(value))
      throw new OperationError(index, "an operation must be a JSON object");
    return value;
  });
}

/** Objects merge key by key, arrays and scalars replace, null removes a key. */
export function deepMerge(base: Json, patch: Json): Json {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const result: Record<string, Json> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else result[key] = deepMerge(base[key], value);
  }
  return result;
}

/** Give list items that need an id (columns, indexes, attributes) a fresh one. */
export function fillIds(value: Json, order: KeyOrder | undefined): Json {
  if (!isPlainObject(value) || !order) return value;
  const result: Record<string, Json> = { ...value };
  for (const [key, child] of Object.entries(order.children ?? {})) {
    const field = result[key];
    if (Array.isArray(field))
      result[key] = field.map((item) => {
        const filled = fillIds(item, child);
        return isPlainObject(filled) &&
          child.keys.includes("id") &&
          (typeof filled["id"] !== "string" || filled["id"] === "")
          ? { id: newElementId(), ...filled }
          : filled;
      });
    else if (isPlainObject(field)) result[key] = fillIds(field, child);
  }
  return result;
}

export function requireText(value: Json, field: string, index: number): string {
  if (typeof value !== "string" || value === "")
    throw new OperationError(index, `"${field}" must be a non-empty string`);
  return value;
}

export function requireNumber(
  value: Json,
  field: string,
  index: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new OperationError(index, `"${field}" must be a number`);
  return value;
}
