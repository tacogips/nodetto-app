import { expect, test } from "bun:test";
import { orderColumnMembers } from "./arrange-layered-order.ts";

test("rank preserves order and input sorts stably by stack position", () => {
  const columns = [["a", "b", "c"]];
  const position = (id: string) => (id === "a" ? 2 : 1);
  expect(orderColumnMembers("rank", columns, new Map(), position)).toEqual(
    columns,
  );
  expect(orderColumnMembers("input", columns, new Map(), position)).toEqual([
    ["b", "c", "a"],
  ]);
  expect(columns).toEqual([["a", "b", "c"]]);
});

test("barycenter uncrosses columns deterministically and retains isolated slots", () => {
  const columns = [
    ["a", "b", "c"],
    ["x", "y", "z"],
  ];
  const neighbors = new Map([
    ["a", ["z"]],
    ["c", ["x"]],
    ["x", ["c"]],
    ["z", ["a"]],
  ]);
  const first = orderColumnMembers("barycenter", columns, neighbors, () => 0);
  expect(first).toEqual(
    orderColumnMembers("barycenter", columns, neighbors, () => 0),
  );
  expect(first[0]?.[1]).toBe("b");
  expect(first[1]?.[1]).toBe("y");
  expect(first[0]?.indexOf("a")).toBe(first[1]?.indexOf("z"));
  expect(first[0]?.indexOf("c")).toBe(first[1]?.indexOf("x"));
});
