import { expect, test } from "bun:test";
import { pageAtNumber, resolvePageQuery, shortPageId } from "./page-id.ts";
import type { Page } from "./types.ts";

const pages: Page[] = [
  { id: "01M59F0HHQTWST8KDWYQDF3V2R", name: "Schema", kind: "erd" },
  { id: "01M59F0HHQTWST8KDWYQDF3V2S", name: "Flow", kind: "sequence" },
];

test("short page IDs are deterministic URL-safe aliases with a fixed FNV-1a vector", () => {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const value = [...shortPageId("hello")].reduce(
    (hash, char) => hash * 64n + BigInt(alphabet.indexOf(char)),
    0n,
  );
  expect(value).toBe(0xa430d84680aabd0bn);
  for (const id of [pages[0]!.id, pages[1]!.id, "p1", "ページID"]) {
    expect(shortPageId(id)).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(shortPageId(id)).toBe(shortPageId(id));
  }
  expect(shortPageId(pages[0]!.id)).not.toBe(shortPageId(pages[1]!.id));
});

test("resolve page aliases, full IDs and names, regardless of page order and name changes", () => {
  const first = pages[0]!;
  for (const query of [first.id, shortPageId(first.id), first.name])
    expect(resolvePageQuery(pages, query)).toEqual({ ok: true, page: first });
  const renamed = { ...first, name: "Renamed", order: "z" };
  expect(resolvePageQuery([pages[1]!, renamed], shortPageId(first.id))).toEqual(
    { ok: true, page: renamed },
  );
  expect(resolvePageQuery(pages, "missing").ok).toBe(false);
});

test("duplicate names and alias/name conflicts require a full ID", () => {
  const first = pages[0]!;
  const alias = shortPageId(first.id);
  const conflict = [first, { ...pages[1]!, name: alias }];
  expect(resolvePageQuery(conflict, alias).ok).toBe(false);
  expect(resolvePageQuery(conflict, first.id)).toEqual({
    ok: true,
    page: first,
  });
  expect(
    resolvePageQuery([first, { ...pages[1]!, name: first.name }], first.name)
      .ok,
  ).toBe(false);
});

test("page numbers follow display order, not storage order", () => {
  const [schema, flow] = pages as [Page, Page];
  const reordered = [
    { ...schema, order: "b" },
    { ...flow, order: "a" },
  ];
  expect(pageAtNumber(reordered, 1)).toEqual({ ok: true, page: reordered[1] });
  expect(pageAtNumber(reordered, 2)).toEqual({ ok: true, page: reordered[0] });
  for (const number of [0, 3, 1.5, Number.NaN])
    expect(pageAtNumber(reordered, number).ok).toBe(false);
});
