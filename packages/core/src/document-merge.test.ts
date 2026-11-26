import { expect, test } from "bun:test";
import type { Document, Element } from "@nodetto/ir";
import {
  diffDocuments,
  isEmptyCommit,
  mergeDocuments,
  mergeValue,
} from "./document-merge.ts";

function element(id: string, label: string, x = 0): Element {
  return {
    id,
    page: "p1",
    type: "node.generic",
    index: "a0",
    semantic: { label },
    visual: { x, y: 0 },
  };
}

function doc(elements: readonly Element[], title = "Doc"): Document {
  return {
    schemaVersion: 1,
    id: "d1",
    title,
    pages: [{ id: "p1", name: "Page", kind: "freeform" }],
    elements,
  };
}

test("disjoint additions on both sides are kept", () => {
  const base = doc([element("a", "A")]);
  const result = mergeDocuments(
    base,
    doc([element("a", "A"), element("local", "L")]),
    doc([element("a", "A"), element("remote", "R")]),
  );
  expect(result.conflicts).toEqual([]);
  expect(result.document.elements.map((e) => e.id).sort()).toEqual([
    "a",
    "local",
    "remote",
  ]);
});

test("different fields of one element merge; the same field keeps local and conflicts", () => {
  const base = doc([element("a", "A", 0)]);
  const moved = mergeDocuments(
    base,
    doc([element("a", "A", 50)]),
    doc([element("a", "Renamed", 0)]),
  );
  expect(moved.conflicts).toEqual([]);
  expect(moved.document.elements[0]).toMatchObject({
    semantic: { label: "Renamed" },
    visual: { x: 50 },
  });

  const both = mergeDocuments(
    base,
    doc([element("a", "Mine")]),
    doc([element("a", "Theirs")]),
  );
  expect(both.conflicts).toEqual([
    { id: "a", kind: "element", reason: "both-changed" },
  ]);
  expect(both.document.elements[0]?.semantic).toEqual({ label: "Mine" });
});

test("deletes: an untouched element follows the delete, an edited one survives with a conflict", () => {
  const base = doc([element("a", "A"), element("b", "B")]);
  const result = mergeDocuments(
    base,
    doc([element("a", "A"), element("b", "B edited")]),
    doc([]),
  );
  expect(result.document.elements.map((e) => e.id)).toEqual(["b"]);
  expect(result.conflicts).toEqual([
    { id: "b", kind: "element", reason: "deleted-remotely" },
  ]);
});

test("diffDocuments expresses element and page changes, and refuses metadata changes", () => {
  const current = doc([element("a", "A"), element("b", "B")]);
  const target = doc([element("a", "A2"), element("c", "C")]);
  const commit = diffDocuments(current, target);
  expect(commit?.update?.map((e) => e.id)).toEqual(["a"]);
  expect(commit?.insert?.map((e) => e.id)).toEqual(["c"]);
  expect(commit?.remove).toEqual(["b"]);
  expect(isEmptyCommit(diffDocuments(current, current) ?? {})).toBe(true);
  expect(diffDocuments(current, doc([], "Renamed"))).toBeNull();
});

test("key order does not hide a remote array change", () => {
  const base = [{ a: 1, b: 2 }];
  const ours = [{ b: 2, a: 1 }];
  const theirs = [{ a: 3, b: 2 }];
  const conflict = { value: false };
  expect(mergeValue(base, ours, theirs, conflict)).toEqual(theirs);
  expect(conflict.value).toBe(false);
  const withSemantic = (semantic: unknown) => ({
    ...element("a", "A"),
    semantic: { data: semantic },
  });
  const merged = mergeDocuments(
    doc([withSemantic(base)]),
    doc([withSemantic(ours)]),
    doc([withSemantic(theirs)]),
  );
  expect(merged.document.elements[0]?.semantic).toEqual({ data: theirs });
  expect(merged.conflicts).toEqual([]);
});

test("merge preserves own prototype-named members", () => {
  const base = JSON.parse('{"x":1,"__proto__":1}');
  const ours = JSON.parse('{"x":2,"__proto__":1}');
  const theirs = JSON.parse('{"x":1,"__proto__":2}');
  const conflict = { value: false };
  const result = mergeValue(base, ours, theirs, conflict) as Record<
    string,
    unknown
  >;
  expect(result.x).toBe(2);
  expect(Object.hasOwn(result, "__proto__")).toBe(true);
  expect(result.__proto__).toBe(2);
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  expect(conflict.value).toBe(false);
});

test("metadata equality ignores object key order but detects own prototype members", () => {
  const base = doc([]);
  const commit = diffDocuments(
    { ...base, extensions: { data: [{ a: 1, b: 2 }] } },
    { ...base, extensions: { data: [{ b: 2, a: 1 }] } },
  );
  expect(commit).not.toBeNull();
  expect(isEmptyCommit(commit ?? {})).toBe(true);
  expect(
    diffDocuments(
      { ...base, extensions: { data: JSON.parse('[{"__proto__":1}]') } },
      { ...base, extensions: { data: JSON.parse('[{"__proto__":2}]') } },
    ),
  ).toBeNull();
});

test("own-member edits and divergent changes are retained", () => {
  const conflict = { value: false };
  expect(mergeValue({ a: 1 }, { a: 2 }, { a: 1 }, conflict)).toEqual({ a: 2 });
  expect(conflict.value).toBe(false);
  expect(mergeValue({ a: 1 }, { a: 2 }, { a: 3 }, conflict)).toEqual({ a: 2 });
  expect(conflict.value).toBe(true);
});
