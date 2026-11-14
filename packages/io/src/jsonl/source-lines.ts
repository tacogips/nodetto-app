import {
  getElementTypeDefinition,
  isPlainObject,
  type KeyOrder,
} from "@nodetto/ir";
import { roundCoordinate } from "./canonical.ts";
import { getField } from "./objects.ts";
import { elementRecordOrder, PAGE_RECORD_ORDER } from "./records.ts";

export interface SourceLine {
  readonly line: string;
  readonly record: Record<string, unknown>;
}
export type SourceLines = ReadonlyMap<object, SourceLine>;

function ordered(value: unknown, order?: KeyOrder): boolean {
  if (Array.isArray(value)) return value.every((item) => ordered(item, order));
  if (!isPlainObject(value)) return true;
  const keys = Object.keys(value);
  const declared = order?.keys ?? [];
  const expected = [
    ...declared.filter((key) => Object.hasOwn(value, key)),
    ...keys.filter((key) => !declared.includes(key)).sort(),
  ];
  if (keys.some((key, index) => key !== expected[index])) return false;
  for (const key of keys) {
    const child = getField(value, key);
    if (
      typeof child === "number" &&
      order?.coordinates?.includes(key) &&
      !Object.is(child, roundCoordinate(child))
    )
      return false;
    if (!ordered(child, getField(order?.children, key) as KeyOrder | undefined))
      return false;
  }
  return true;
}

function canonical(source: SourceLine, order: KeyOrder): boolean {
  return (
    JSON.stringify(source.record) === source.line &&
    ordered(source.record, order)
  );
}

export function acceptPageLine(source: SourceLine): boolean {
  return (
    !Object.hasOwn(source.record, "extensions") &&
    canonical(source, PAGE_RECORD_ORDER)
  );
}

export function acceptElementLine(source: SourceLine): boolean {
  const record = source.record;
  if (Object.hasOwn(record, "extensions") || !isPlainObject(record["semantic"]))
    return false;
  const visual = record["visual"];
  if (visual !== undefined) {
    if (
      !isPlainObject(visual) ||
      !Object.keys(visual).length ||
      Object.hasOwn(visual, "extensions")
    )
      return false;
    const style = visual["style"];
    if (
      style !== undefined &&
      (!isPlainObject(style) ||
        !Object.keys(style).length ||
        Object.hasOwn(style, "extensions"))
    )
      return false;
  }
  const type = record["type"];
  const definition =
    typeof type === "string" ? getElementTypeDefinition(type) : undefined;
  return canonical(source, elementRecordOrder(definition?.keyOrder));
}
