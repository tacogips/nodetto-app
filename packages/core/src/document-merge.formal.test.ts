import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mergeById, type MergeConflict, mergeValue } from "./document-merge";

type RecordValue = { id: string; [key: string]: unknown };
type Pair = [string, RecordValue];
type ValueCase = {
  fn: "mergeValue";
  in: { base?: unknown; ours?: unknown; theirs?: unknown };
  out: { ok: { value?: unknown; conflict: boolean } };
};
type RecordsCase = {
  fn: "mergeById";
  in: { base: Pair[]; ours: Pair[]; theirs: Pair[] };
  out: { ok: { records: Pair[]; conflicts: [string, string][] } };
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pairs(value: unknown): value is Pair[] {
  return (
    Array.isArray(value) &&
    value.every(
      (pair: unknown) =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        typeof pair[0] === "string" &&
        object(pair[1]) &&
        pair[1].id === pair[0],
    )
  );
}

function isCase(value: unknown): value is ValueCase | RecordsCase {
  if (
    !object(value) ||
    !object(value.in) ||
    !object(value.out) ||
    !object(value.out.ok)
  )
    return false;
  if (value.fn === "mergeValue")
    return typeof value.out.ok.conflict === "boolean";
  return (
    value.fn === "mergeById" &&
    pairs(value.in.base) &&
    pairs(value.in.ours) &&
    pairs(value.in.theirs) &&
    pairs(value.out.ok.records) &&
    Array.isArray(value.out.ok.conflicts) &&
    value.out.ok.conflicts.every(
      (pair: unknown) =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        typeof pair[0] === "string" &&
        typeof pair[1] === "string",
    )
  );
}

// Construct JSON text instead of assigning keys, preserving own __proto__ members.
function reversedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(reversedJson).join(",")}]`;
  if (object(value))
    return `{${Object.keys(value)
      .reverse()
      .map((key) => `${JSON.stringify(key)}:${reversedJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

const parsed: unknown = JSON.parse(
  readFileSync(
    new URL("../../../formal/vectors/merge.json", import.meta.url),
    "utf8",
  ),
);
if (
  !object(parsed) ||
  !Array.isArray(parsed.cases) ||
  !parsed.cases.every(isCase)
) {
  throw new Error("Invalid merge vectors");
}
const cases: (ValueCase | RecordsCase)[] = parsed.cases;

describe("Lean merge vectors", () => {
  for (const [index, vector] of cases.entries()) {
    test(`${vector.fn} vector ${index}`, () => {
      if (vector.fn === "mergeValue") {
        for (const reverse of [false, true]) {
          const input = reverse
            ? (JSON.parse(reversedJson(vector.in)) as ValueCase["in"])
            : vector.in;
          const conflict = { value: false };
          expect(
            mergeValue(input.base, input.ours, input.theirs, conflict),
          ).toEqual(vector.out.ok.value);
          expect(conflict.value).toBe(vector.out.ok.conflict);
        }
      } else {
        const conflicts: MergeConflict[] = [];
        const records = mergeById(
          "element",
          vector.in.base.map(([, v]) => v),
          vector.in.ours.map(([, v]) => v),
          vector.in.theirs.map(([, v]) => v),
          conflicts,
        );
        expect(new Map(records.map((record) => [record.id, record]))).toEqual(
          new Map(vector.out.ok.records),
        );
        expect(conflicts.map(({ id, reason }) => [id, reason])).toEqual(
          vector.out.ok.conflicts,
        );
      }
    });
  }
});
