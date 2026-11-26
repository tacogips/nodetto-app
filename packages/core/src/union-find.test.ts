import { expect, test } from "bun:test";
import { UnionFind } from "./union-find.ts";

test("unions merge sets and find is idempotent", () => {
  const uf = new UnionFind(5);
  uf.union(0, 1);
  uf.union(2, 3);
  uf.union(1, 2);
  expect(uf.find(0)).toBe(uf.find(3));
  expect(uf.find(4)).not.toBe(uf.find(0));
  expect(uf.find(uf.find(3))).toBe(uf.find(3));
});
test("handles 100000 unions without recursion", () => {
  const uf = new UnionFind(100000);
  for (let i = 1; i < 100000; i++) uf.union(i - 1, i);
  expect(uf.find(99999)).toBe(uf.find(0));
});
