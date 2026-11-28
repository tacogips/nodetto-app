import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { isFractionalKey, keyAfter, keyBetween } from "./fractional.ts";

type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
type Vector = { fn: string; input: RecordValue; output: RecordValue };
function vectors(value: unknown): Vector[] {
  if (
    !record(value) ||
    value.module !== "fractional" ||
    !Array.isArray(value.cases)
  )
    throw new Error("Invalid vector file");
  return value.cases.map((item: unknown): Vector => {
    if (
      !record(item) ||
      typeof item.fn !== "string" ||
      !record(item.in) ||
      !record(item.out)
    )
      throw new Error("Invalid vector case");
    const input = item.in;
    const output = item.out;
    if (item.fn === "isFractionalKey") {
      if (typeof input.value !== "string" || typeof output.ok !== "boolean")
        throw new Error("Invalid key case");
    } else if (item.fn === "keyBetween" || item.fn === "keyAfter") {
      if (
        !Array.isArray(input.draws) ||
        !input.draws.every(
          (n: unknown) =>
            typeof n === "number" &&
            Number.isInteger(n) &&
            n >= 0 &&
            n < 2 ** 20,
        ) ||
        !(typeof output.ok === "string" || output.error === "range")
      )
        throw new Error("Invalid result case");
      if (
        item.fn === "keyBetween"
          ? !nullableString(input.before) || !nullableString(input.after)
          : !nullableString(input.last)
      )
        throw new Error("Invalid bounds");
    } else throw new Error("Unknown vector function");
    return { fn: item.fn, input, output };
  });
}

const cases = vectors(
  JSON.parse(
    readFileSync(
      new URL("../../../formal/vectors/fractional.json", import.meta.url),
      "utf8",
    ),
  ) as unknown,
);
test("fractional implementation matches Lean vectors", () => {
  expect(cases.length).toBeGreaterThan(0);
  for (const { fn, input, output } of cases) {
    if (fn === "isFractionalKey") {
      expect(isFractionalKey(input.value as string)).toBe(output.ok as boolean);
      continue;
    }
    const draws = input.draws as number[];
    let i = 0;
    const rng = () => (i < draws.length ? (draws[i++] ?? 0) / 2 ** 20 : 0);
    const run = () =>
      fn === "keyBetween"
        ? keyBetween(
            input.before as string | null,
            input.after as string | null,
            rng,
          )
        : keyAfter(input.last as string | null, rng);
    if (output.error === "range") expect(run).toThrow(RangeError);
    else expect(run()).toBe(output.ok as string);
  }
});
