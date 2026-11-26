import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { element } from "./test-helpers.ts";
import {
  relativeOrder,
  reorderCommands,
  targetOrder,
  type ZOrderAction,
} from "./z-order.ts";

type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => typeof item === "string")
  );
}
function pairs(value: unknown): value is [string, string][] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        Array.isArray(item) &&
        item.length === 2 &&
        item.every((part: unknown) => typeof part === "string"),
    )
  );
}
const data: unknown = JSON.parse(
  readFileSync(
    new URL("../../../formal/vectors/z-order.json", import.meta.url),
    "utf8",
  ),
);
if (
  !record(data) ||
  data.module !== "z-order" ||
  !Array.isArray(data.cases) ||
  data.cases.length === 0
) {
  throw new Error("Invalid vector file");
}
const cases: unknown[] = data.cases;
test("z-order implementation matches Lean vectors", () => {
  expect(cases.length).toBeGreaterThan(0);
  for (const vector of cases) {
    if (!record(vector) || !record(vector.in) || !record(vector.out))
      throw new Error("Invalid vector");
    const input = vector.in;
    const output = vector.out;
    if (vector.fn === "targetOrder") {
      if (
        !strings(input.ordered) ||
        !strings(input.selected) ||
        !strings(output.ok) ||
        !(
          input.action === "front" ||
          input.action === "back" ||
          input.action === "forward" ||
          input.action === "backward"
        )
      )
        throw new Error("Invalid targetOrder vector");
      expect(
        targetOrder(
          input.ordered,
          new Set(input.selected),
          input.action as ZOrderAction,
        ),
      ).toEqual(output.ok);
    } else if (vector.fn === "relativeOrder") {
      if (
        !strings(input.ordered) ||
        !strings(input.moved) ||
        !strings(input.anchorBlock) ||
        !strings(output.ok) ||
        !(input.side === "before" || input.side === "after")
      )
        throw new Error("Invalid relativeOrder vector");
      expect(
        relativeOrder(
          input.ordered,
          new Set(input.moved),
          new Set(input.anchorBlock),
          input.side,
        ),
      ).toEqual(output.ok);
    } else if (vector.fn === "reorderCommands") {
      if (
        !pairs(input.elements) ||
        !strings(input.order) ||
        !Array.isArray(input.draws) ||
        !input.draws.every(
          (n: unknown) =>
            typeof n === "number" &&
            Number.isInteger(n) &&
            n >= 0 &&
            n < 2 ** 20,
        ) ||
        !(pairs(output.ok) || output.error === "range")
      )
        throw new Error("Invalid reorderCommands vector");
      const elements = input.elements.map(([id, index]) =>
        element({
          id,
          index,
          type: "node.generic",
          semantic: {},
          visual: { x: 0, y: 0 },
        }),
      );
      const draws = input.draws as number[];
      const order = input.order;
      let at = 0;
      const run = () =>
        reorderCommands(
          elements,
          order,
          () => (draws[at++] ?? 0) / 2 ** 20,
        ).map((command) => {
          if (command.type !== "reorder") throw new Error("Unexpected command");
          return [command.id, command.index];
        });
      if (output.error === "range") expect(run).toThrow(RangeError);
      else if (pairs(output.ok)) expect(run()).toEqual(output.ok);
      else throw new Error("Invalid reorder result");
    } else throw new Error("Unknown vector function");
  }
});
