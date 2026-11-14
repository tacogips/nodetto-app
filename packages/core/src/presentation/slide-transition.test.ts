import { expect, test } from "bun:test";
import type { Element, Visual } from "@nodetto/ir";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { document, element, TEST_PAGE } from "../test-helpers.ts";
import { planSlideTransition } from "./slide-transition.ts";
import {
  SLIDE_ENTRANCE_MS,
  SLIDE_ENTRANCE_OFFSET_MS,
  SLIDE_FADE_OUT_MS,
  SLIDE_MOVE_MS,
} from "./slide-transition-types.ts";

const page2 = { id: "page-2", name: "Page 2", kind: "freeform" as const };
const box = { x: 100, y: 200, width: 800, height: 600 };
const otherBox = { x: 500, y: 600, width: 800, height: 600 };
const shape = (
  id: string,
  page: string,
  visual: Visual = {},
  index = "a1",
  type = "shape.geo",
) =>
  element({
    id,
    page,
    index,
    type,
    semantic: type === "shape.geo" ? { geo: "rect" } : {},
    visual: { x: 110, y: 220, width: 80, height: 50, ...visual },
  });
const edge = (id: string, page: string, linkId?: string, index = "a1") =>
  element({
    id,
    page,
    index,
    type: "edge.generic",
    semantic: { fromPoint: { x: 0, y: 0 }, toPoint: { x: 50, y: 50 } },
    visual: linkId ? { linkId } : {},
  });
const plan = (
  elements: readonly Element[],
  reverse = false,
  fromRect = box,
  toRect = otherBox,
) =>
  planSlideTransition(
    new Store(document(elements, [TEST_PAGE, page2])),
    createDefaultRegistry(),
    {
      from: {
        page: reverse ? page2.id : TEST_PAGE.id,
        rect: reverse ? toRect : fromRect,
      },
      to: {
        page: reverse ? TEST_PAGE.id : page2.id,
        rect: reverse ? fromRect : toRect,
      },
    },
  );
const steps = (result: ReturnType<typeof plan>) => {
  if (result.kind !== "animate") throw new Error("expected animation");
  return result.steps;
};

test("linked elements transform in slide-relative coordinates, reverse and serialize", () => {
  const a = shape("a", TEST_PAGE.id, {
    linkId: " L ",
    rotation: 10,
    style: { fill: "red", opacity: 0.5 },
  });
  const b = shape("b", page2.id, {
    x: 520,
    y: 630,
    width: 120,
    linkId: "L",
    rotation: 20,
    style: { opacity: 0.5, fill: "red" },
  });
  const forward = plan([a, b]);
  expect(steps(forward)).toEqual([
    {
      kind: "transform",
      from: "a",
      to: "b",
      fromBox: { x: 10, y: 20, width: 80, height: 50, rotation: 10 },
      toBox: { x: 20, y: 30, width: 120, height: 50, rotation: 20 },
      fromAppearance: { opacity: 0.5, fill: "red" },
      toAppearance: { opacity: 0.5, fill: "red" },
      appearanceChanged: false,
      start: 0,
      duration: SLIDE_MOVE_MS,
      easing: "ease-in-out",
    },
  ]);
  expect(steps(plan([a, b], true))[0]).toMatchObject({
    from: "b",
    to: "a",
    fromBox: { x: 20, y: 30 },
    toBox: { x: 10, y: 20 },
  });
  expect(JSON.parse(JSON.stringify(forward))).toEqual(forward);
  expect(
    steps(
      plan([a, shape("b", page2.id, { linkId: "L", style: { fill: "blue" } })]),
    )[0]?.appearanceChanged,
  ).toBe(true);
});

test("unpaired elements exit and enter by category while linked edges crossfade", () => {
  const result = plan([
    shape("out", TEST_PAGE.id),
    edge("old-edge", TEST_PAGE.id, "e"),
    edge("new-edge", page2.id, "e"),
    shape("rect", page2.id, {}, "a2"),
    edge("edge", page2.id, undefined, "a3"),
    shape("text", page2.id, {}, "a4", "text.note"),
    shape("image", page2.id, {}, "a5", "image.raster"),
  ]);
  const s = steps(result);
  expect(s.map((x) => [x.kind, x.from, x.to])).toEqual([
    ["fade-out", "out", undefined],
    ["crossfade", "old-edge", "new-edge"],
    ["draw-on", undefined, "rect"],
    ["grow", undefined, "edge"],
    ["fade-in", undefined, "text"],
    ["fade-in", undefined, "image"],
  ]);
  expect(s[0]).toMatchObject({ start: 0, duration: SLIDE_FADE_OUT_MS });
  expect(s[1]).toMatchObject({ start: 0, duration: SLIDE_MOVE_MS });
  expect(s[2]).toMatchObject({
    start: SLIDE_ENTRANCE_OFFSET_MS,
    duration: SLIDE_ENTRANCE_MS,
  });
  expect(s[3]?.start).toBeGreaterThan(s[2]?.start ?? Number.POSITIVE_INFINITY);
  expect(result.kind === "animate" && result.duration).toBe(
    Math.max(...s.map((x) => x.start + x.duration)),
  );
});

test("duplicate keys on either page and mismatched types never pair", () => {
  const a = shape("a", TEST_PAGE.id, { linkId: "L" });
  const b = shape("b", page2.id, { linkId: "L" });
  const c = shape("c", page2.id, { linkId: "L" }, "a2");
  expect(steps(plan([a, b, c])).map((s) => s.kind)).toEqual([
    "fade-out",
    "draw-on",
    "draw-on",
  ]);
  expect(steps(plan([a, b, c], true)).map((s) => s.kind)).toEqual([
    "fade-out",
    "fade-out",
    "draw-on",
  ]);
  expect(
    steps(
      plan([a, shape("t", page2.id, { linkId: "L" }, "a1", "text.note")]),
    ).map((s) => s.kind),
  ).toEqual(["fade-out", "fade-in"]);
});

test("paint order controls stagger and empty or different-sized slides cut", () => {
  const items = [
    shape("c", page2.id, {}, "a3"),
    shape("a", page2.id, {}, "a1"),
    shape("b", page2.id, {}, "a2"),
  ];
  const s = steps(plan(items));
  expect(s.map((x) => x.to)).toEqual(["a", "b", "c"]);
  expect(s.map((x) => x.start)).toEqual([0, 60, 120]);
  expect(plan([])).toEqual({ kind: "cut", reason: "empty" });
  expect(plan(items, false, box, { ...otherBox, width: 1000 })).toEqual({
    kind: "cut",
    reason: "size-mismatch",
  });
  expect(steps(plan([shape("a", TEST_PAGE.id)]))[0]?.kind).toBe("fade-out");
});

test("groups, hidden elements and prototype edges are excluded while visible children remain", () => {
  const group = element({
    id: "g",
    type: "group",
    page: page2.id,
    semantic: { memberIds: ["child"] },
  });
  const hiddenGroup = element({
    id: "hg",
    type: "group",
    page: page2.id,
    semantic: { memberIds: ["hidden-child"] },
    visual: { hidden: true },
  });
  const proto = element({
    id: "proto",
    type: "edge.generic",
    page: page2.id,
    semantic: {
      prototype: true,
      fromPoint: { x: 0, y: 0 },
      toPoint: { x: 50, y: 50 },
    },
  });
  const s = steps(
    plan([
      group,
      hiddenGroup,
      proto,
      shape("child", page2.id),
      shape("hidden-child", page2.id),
      shape("hidden", page2.id, { hidden: true }),
    ]),
  );
  expect(s.map((x) => x.to)).toEqual(["child"]);
});

test("only plannable links count, including masks and missing bounds", () => {
  const maskGroup = element({
    id: "mask-group",
    page: page2.id,
    type: "group",
    semantic: { memberIds: ["mask", "content"], maskId: "mask" },
  });
  const missing = element({
    id: "missing",
    page: page2.id,
    type: "edge.generic",
    semantic: {},
  });
  const result = plan([
    shape("source", TEST_PAGE.id, { linkId: "L" }),
    shape("target", page2.id, { linkId: "L" }),
    shape("hidden-duplicate", page2.id, { linkId: "L", hidden: true }),
    shape("mask", page2.id, { linkId: "L" }),
    shape("content", page2.id),
    maskGroup,
    missing,
    shape("blank", page2.id, { linkId: "   " }),
  ]);
  expect(steps(result).map((s) => [s.kind, s.from, s.to])).toEqual([
    ["transform", "source", "target"],
    ["draw-on", undefined, "blank"],
    ["draw-on", undefined, "content"],
  ]);
});

test("paired moves follow incoming order and size tolerance is inclusive", () => {
  const items = [
    shape("a", TEST_PAGE.id, { linkId: "A" }),
    shape("b", TEST_PAGE.id, { linkId: "B" }),
    shape("z", page2.id, { linkId: "A" }),
    shape("y", page2.id, { linkId: "B" }),
  ];
  const result = plan(items, false, box, {
    ...otherBox,
    width: otherBox.width + 0.5,
  });
  expect(steps(result).map((s) => [s.to, s.start])).toEqual([
    ["y", 0],
    ["z", 60],
  ]);
  expect(
    plan(items, false, box, { ...otherBox, height: otherBox.height + 0.51 }),
  ).toEqual({ kind: "cut", reason: "size-mismatch" });
});
