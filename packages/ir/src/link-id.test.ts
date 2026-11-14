import { expect, test } from "bun:test";
import type { Document } from "./types.ts";
import { validateDocument } from "./validate.ts";

const base: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "Test",
  pages: [{ id: "p", name: "Page", kind: "freeform" }],
  elements: [
    { id: "e", page: "p", type: "rect", index: "a0", semantic: {}, visual: {} },
  ],
};

test("linkId is optional and must be a non-empty string", () => {
  for (const [value, expected] of [
    ["a", []],
    ["", ["value.empty"]],
    [3, ["type.string"]],
  ] as const) {
    const doc = {
      ...base,
      elements: [{ ...base.elements[0]!, visual: { linkId: value } }],
    };
    const issues = validateDocument(doc as unknown as Document);
    expect(
      issues
        .filter((issue) => issue.path === "elements[0].visual.linkId")
        .map((issue) => issue.code),
    ).toEqual([...expected]);
  }
  expect(
    validateDocument(base).filter(
      (issue) => issue.path === "elements[0].visual.linkId",
    ),
  ).toEqual([]);
});
