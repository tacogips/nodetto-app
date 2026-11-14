import { expect, test } from "bun:test";
import type { Document, Element } from "@nodetto/ir";
import { mergeDocumentVersions } from "./document-merge.ts";
const node = (id: string, label: string, x = 0): Element => ({
  id,
  page: "p",
  type: "node.generic",
  index: "a0",
  semantic: { label },
  visual: { x, y: 0 },
});
const doc = (elements: Element[]): Document => ({
  schemaVersion: 1,
  id: "d",
  title: "Doc",
  pages: [{ id: "p", name: "Page", kind: "freeform" }],
  elements,
});
test("merges disjoint fields and reports atomic conflicts", () => {
  const b = doc([node("a", "A")]);
  const clean = mergeDocumentVersions(
    b,
    doc([node("a", "A", 10)]),
    doc([node("a", "B")]),
  );
  expect(clean.conflicts).toEqual([]);
  expect(clean.document.elements[0]).toMatchObject({
    semantic: { label: "B" },
    visual: { x: 10 },
  });
  const conflict = mergeDocumentVersions(
    b,
    doc([node("a", "A", 10)]),
    doc([node("a", "A", 20)]),
  );
  expect(conflict.conflicts).toMatchObject([
    {
      kind: "element",
      id: "a",
      path: "visual.x",
      reason: "field",
      base: 0,
      ours: 10,
      theirs: 20,
    },
  ]);
});
test("both additions and delete versus change keep ours", () => {
  const empty = doc([]);
  const a = node("a", "A");
  const b = node("a", "B");
  expect(
    mergeDocumentVersions(empty, doc([a]), doc([b])).conflicts,
  ).toMatchObject([{ path: "semantic.label", reason: "both-added" }]);
  expect(
    mergeDocumentVersions(doc([a]), empty, doc([b])).conflicts,
  ).toMatchObject([{ reason: "deleted-in-ours" }]);
  expect(
    mergeDocumentVersions(doc([a]), doc([b]), empty).conflicts,
  ).toMatchObject([{ reason: "deleted-in-theirs" }]);
});
test("restores pages and referenced elements, or drops dangling elements", () => {
  const n = node("a", "A");
  const edge: Element = {
    id: "e",
    page: "p",
    type: "edge.generic",
    index: "a1",
    semantic: { from: "a", to: "a" },
    visual: {},
  };
  const base = doc([n]);
  const pageDeleted = { ...doc([]), pages: [] };
  const restoredPage = mergeDocumentVersions(base, doc([n, edge]), pageDeleted);
  expect(restoredPage.document.pages.map((p) => p.id)).toEqual(["p"]);
  expect(restoredPage.conflicts).toContainEqual({
    kind: "page",
    id: "p",
    reason: "deleted-in-theirs",
  });
  const restored = mergeDocumentVersions(base, doc([n, edge]), doc([]));
  expect(restored.document.elements.map((e) => e.id)).toEqual(["a", "e"]);
  const dropped = mergeDocumentVersions(base, doc([]), doc([n, edge]));
  expect(dropped.document.elements).toEqual([]);
  expect(dropped.conflicts).toMatchObject([
    { id: "e", reason: "deleted-in-ours" },
  ]);
});
test("order is independent of record input order", () => {
  const b = doc([node("a", "A"), node("b", "B")]);
  const o = doc([node("b", "B", 1), node("a", "A", 1)]);
  const t = doc([node("a", "A", 2), node("b", "B", 2)]);
  expect(mergeDocumentVersions(b, o, t)).toEqual(
    mergeDocumentVersions(
      { ...b, elements: [...b.elements].reverse() },
      { ...o, elements: [...o.elements].reverse() },
      { ...t, elements: [...t.elements].reverse() },
    ),
  );
});
test("arrays are atomic and unknown records merge by canonical content", () => {
  const table = (columns: unknown[]): Element => ({
    id: "a",
    page: "p",
    type: "erd.table",
    index: "a0",
    semantic: { tableName: "widgets", columns },
    visual: { x: 0, y: 0 },
  });
  const b = doc([table([{ name: "base" }])]);
  const o = doc([table([{ name: "ours" }])]);
  const t = doc([table([{ name: "theirs" }])]);
  expect(mergeDocumentVersions(b, o, t).conflicts).toMatchObject([
    { path: "semantic.columns", reason: "field" },
  ]);
  const base = {
    ...doc([]),
    unknownRecords: [{ kind: "extra", data: { a: 1, b: 2 } }],
  };
  const ours = {
    ...doc([]),
    unknownRecords: [{ kind: "extra", data: { b: 2, a: 1 } }],
  };
  expect(
    mergeDocumentVersions(base, ours, doc([])).document.unknownRecords,
  ).toEqual([]);
});
test("preserves pre-existing dangling references but drops edges to deleted elements", () => {
  const edge: Element = {
    id: "e",
    page: "p",
    type: "edge.generic",
    index: "a1",
    semantic: { from: "gone", to: "gone" },
    visual: {},
  };
  const base = doc([node("a", "A"), edge]);
  const result = mergeDocumentVersions(
    base,
    doc([node("a", "A", 5), edge]),
    base,
  );
  expect(result.document.elements.map((element) => element.id)).toEqual([
    "a",
    "e",
  ]);
  expect(
    result.document.elements.find((element) => element.id === "a")?.visual.x,
  ).toBe(5);
  expect(result.conflicts).toEqual([]);

  const target = node("gone", "Gone");
  const deleted = mergeDocumentVersions(
    doc([target]),
    doc([]),
    doc([target, edge]),
  );
  expect(deleted.document.elements).toEqual([]);
  expect(deleted.conflicts).toContainEqual({
    kind: "element",
    id: "e",
    type: "edge.generic",
    reason: "deleted-in-ours",
  });
});
