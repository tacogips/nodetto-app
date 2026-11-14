import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import { createShapeContext } from "./hit-test.ts";
import { containerPaintOrder, pagePaintOrder } from "./paint-order.ts";
import { createDefaultRegistry } from "./shapes/index.ts";
import { Store } from "./store.ts";
import { document, element, TEST_PAGE } from "./test-helpers.ts";

const shape = (id: string, x = 10, y = 10, width = 20, height = 20): Element =>
  element({
    id,
    type: "shape.geo",
    semantic: { geo: "rect" },
    visual: { x, y, width, height },
  });
const frame = (
  id: string,
  x = 0,
  y = 0,
  width = 100,
  height = 100,
  memberIds?: string[],
): Element =>
  element({
    id,
    type: "frame",
    semantic: { name: id, ...(memberIds ? { memberIds } : {}) },
    visual: { x, y, width, height },
  });
const group = (id: string, memberIds: string[]): Element =>
  element({ id, type: "group", semantic: { memberIds } });
function setup(input: Element[]) {
  const ordered = input.map((entry, i) => ({ ...entry, index: `a${i + 1}` }));
  const store = new Store(document(ordered));
  const context = createShapeContext(store, createDefaultRegistry(), 1);
  return {
    ordered,
    store,
    context,
    run: (backdrops: string[] = []) =>
      containerPaintOrder(ordered, context, new Set(backdrops)),
  };
}
const ids = (elements: readonly Element[]) => elements.map((entry) => entry.id);

test("no surface preserves identity", () => {
  const s = setup([shape("node")]);
  expect(s.run()).toBe(s.ordered);
});
test("correct frame preserves identity", () => {
  const s = setup([frame("frame"), shape("node")]);
  expect(s.run()).toBe(s.ordered);
});
test("late filled frame moves under node", () => {
  const s = setup([shape("node"), frame("frame")]);
  expect(ids(s.run())).toEqual(["frame", "node"]);
});
for (const order of [
  ["node", "outer", "inner"],
  ["node", "inner", "outer"],
  ["outer", "node", "inner"],
  ["outer", "inner", "node"],
  ["inner", "node", "outer"],
  ["inner", "outer", "node"],
]) {
  test(`geometric nesting ${order.join(" ")}`, () => {
    const entries: Record<string, Element> = {
      node: shape("node", 20, 20),
      outer: frame("outer", 0, 0, 200, 200),
      inner: frame("inner", 10, 10, 100, 100),
    };
    const s = setup(order.map((id) => entries[id] as Element));
    expect(ids(s.run())).toEqual(["outer", "inner", "node"]);
  });
}
const explicit = () => [
  shape("node"),
  frame("parent", 0, 0, 100, 100, ["child"]),
  frame("child", 0, 0, 200, 200, ["node"]),
];
test("explicit nesting ignores area", () => {
  const s = setup(explicit());
  expect(ids(s.run())).toEqual(["parent", "child", "node"]);
});
test("correct explicit nesting preserves identity", () => {
  const e = explicit();
  const s = setup([e[1] as Element, e[2] as Element, e[0] as Element]);
  expect(s.run()).toBe(s.ordered);
});
test("backdrop partition ignores shapes", () => {
  const s = setup([
    shape("node"),
    frame("panel", 150, 150, 100, 100),
    frame("frame", 0, 0, 200, 200),
    shape("flow"),
  ]);
  expect(s.run(["panel", "frame"])).toBe(s.ordered);
});
test("backdrop pool moves under lane", () => {
  const s = setup([
    { ...frame("lane", 10, 10, 100, 50), type: "bpmn.lane" },
    shape("task"),
    { ...frame("pool", 0, 0, 200, 200), type: "bpmn.participant" },
    shape("flow"),
  ]);
  expect(
    ids(s.run(["pool", "lane"]).filter((e) => ["pool", "lane"].includes(e.id))),
  ).toEqual(["pool", "lane"]);
});
test("equal frame copies preserve identity", () => {
  const s = setup([frame("a"), shape("one"), frame("b"), shape("two")]);
  expect(s.run()).toBe(s.ordered);
});
test("partial overlap preserves identity", () => {
  const s = setup([shape("node", 90, 90), frame("frame")]);
  expect(s.run()).toBe(s.ordered);
});
test("smaller owner prevents larger overlapping frame move", () => {
  const s = setup([
    frame("small", 0, 0, 100, 100),
    shape("node", 50, 50),
    frame("large", 40, 40, 200, 200),
  ]);
  expect(s.run()).toBe(s.ordered);
});
test("explicit frame owns listed outside node", () => {
  const s = setup([
    shape("node", 500, 500),
    frame("frame", 0, 0, 100, 100, ["node"]),
  ]);
  expect(ids(s.run())).toEqual(["frame", "node"]);
});
test("explicit frame ignores unlisted node", () => {
  const s = setup([shape("node"), frame("frame", 0, 0, 100, 100, [])]);
  expect(s.run()).toBe(s.ordered);
});
test("grouped surface cannot move", () => {
  const s = setup([shape("node"), frame("frame"), group("group", ["frame"])]);
  expect(s.run()).toBe(s.ordered);
});
test("correct group stays in place", () => {
  const s = setup([
    shape("node"),
    frame("panel", 150, 150, 100, 100),
    frame("frame", 0, 0, 200, 200),
    group("group", ["node"]),
    shape("other", 500, 500),
  ]);
  expect(s.run()).toBe(s.ordered);
});
test("correct nested groups stay in place", () => {
  const s = setup([
    shape("node"),
    group("inner", ["node"]),
    frame("panel", 150, 150, 100, 100),
    frame("frame", 0, 0, 200, 200),
    group("outer", ["inner"]),
    shape("other", 500, 500),
  ]);
  expect(s.run()).toBe(s.ordered);
});
for (const nested of [false, true])
  test(`inverted ${nested ? "nested " : ""}group moves as a unit`, () => {
    const input = nested
      ? [
          shape("node"),
          group("inner", ["node"]),
          group("outer", ["inner"]),
          frame("frame"),
        ]
      : [shape("node"), group("outer", ["node"]), frame("frame")];
    const s = setup(input);
    const result = s.run();
    expect(
      ids(result).filter((id) => id === "frame" || id === "outer"),
    ).toEqual(["frame", "outer"]);
    expect(s.ordered).toEqual(
      input.map((entry, i) => ({ ...entry, index: `a${i + 1}` })),
    );
  });
test("group inversion stops at group", () => {
  const s = setup([
    shape("node"),
    frame("panel", 150, 150, 100, 100),
    group("group", ["node"]),
    frame("frame", 0, 0, 200, 200),
  ]);
  expect(ids(s.run()).filter((id) => id !== "node")).toEqual([
    "panel",
    "frame",
    "group",
  ]);
});
test("hidden and mask sources do not cause moves", () => {
  const s = setup([
    { ...shape("node"), visual: { ...shape("node").visual, hidden: true } },
    frame("frame"),
  ]);
  expect(s.run()).toBe(s.ordered);
  const context = {
    ...s.context,
    isHidden: () => false,
    isMaskSource: (id: string) => id === "node",
  };
  const visible = setup([shape("node"), frame("frame")]);
  expect(containerPaintOrder(visible.ordered, context, new Set())).toBe(
    visible.ordered,
  );
});
for (const order of [
  ["a", "b"],
  ["b", "a"],
])
  test(`explicit cycle ${order.join(" ")}`, () => {
    const entries: Record<string, Element> = {
      a: frame("a", 0, 0, 100, 100, ["b"]),
      b: frame("b", 0, 0, 100, 100, ["a"]),
    };
    const s = setup(order.map((id) => entries[id] as Element));
    expect(s.run()).toBe(s.ordered);
  });
for (const reversed of [false, true])
  test(`mixed cycle ${reversed}`, () => {
    const a = frame("a", 10, 10, 20, 20, ["t"]);
    const t = frame("t", 0, 0, 100, 100);
    const s = setup(reversed ? [a, t] : [t, a]);
    expect(ids(s.run())).toEqual(["a", "t"]);
    if (reversed) expect(s.run()).toBe(s.ordered);
  });
test("page result is cached", () => {
  const s = setup([shape("node"), frame("frame")]);
  expect(pagePaintOrder(s.store, TEST_PAGE.id, s.context)).toBe(
    pagePaintOrder(s.store, TEST_PAGE.id, s.context),
  );
});
