import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import { countPageChanges, issueLine, unknownFieldKey } from "./apply-batch.ts";

const a: Element = {
  id: "a",
  page: "p1",
  type: "shape",
  index: "a0",
  semantic: {},
  visual: {},
};
const b: Element = {
  id: "b",
  page: "p1",
  type: "shape",
  index: "a1",
  semantic: {},
  visual: {},
};

test("unknownFieldKey resolves an element and path", () => {
  expect(unknownFieldKey("elements[1].semantic.extra", [a, b])).toEqual({
    element: b,
    path: "semantic.extra",
    key: JSON.stringify([b.id, "semantic.extra"]),
  });
});

test("unknownFieldKey ignores non-element paths", () => {
  expect(unknownFieldKey("pages[0].name", [a])).toBeUndefined();
});

test("unknownFieldKey ignores an out-of-range element", () => {
  expect(unknownFieldKey("elements[5].semantic.x", [a])).toBeUndefined();
});

test("countPageChanges omits unchanged elements", () => {
  expect([
    ...countPageChanges(new Map([[a.id, a]]), new Map([[a.id, a]])),
  ]).toEqual([]);
});

test("countPageChanges counts changes in after then removed-page order", () => {
  const removed: Element = { ...a, id: "removed", page: "p2" };
  const updated: Element = { ...a, semantic: { name: "updated" } };
  const before = new Map([
    [a.id, a],
    [removed.id, removed],
  ]);
  const after = new Map([
    [b.id, b],
    [updated.id, updated],
  ]);
  expect([...countPageChanges(before, after)]).toEqual([
    ["p1", { added: 1, updated: 1, removed: 0 }],
    ["p2", { added: 0, updated: 0, removed: 1 }],
  ]);
});

test("issueLine includes a nonempty path", () => {
  expect(issueLine({ path: "elements[0].semantic", message: "bad" })).toBe(
    "elements[0].semantic: bad",
  );
});

test("issueLine omits an empty path", () => {
  expect(issueLine({ path: "", message: "bad" })).toBe("bad");
});
