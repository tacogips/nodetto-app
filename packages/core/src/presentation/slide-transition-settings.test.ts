import { expect, test } from "bun:test";
import type { Element, ElementAnimation, SlideSettings } from "@nodetto/ir";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { document, element, TEST_PAGE } from "../test-helpers.ts";
import { planSlideTransition } from "./slide-transition.ts";

const p1 = TEST_PAGE.id;
const p2 = "page-2";
const pages = [
  TEST_PAGE,
  { id: p2, name: "Page 2", kind: "freeform" as const },
];
const rect = { x: 0, y: 0, width: 800, height: 600 };
const shape = (
  id: string,
  page: string,
  animation: ElementAnimation = {},
  linkId?: string,
  index = "a1",
) =>
  element({
    id,
    page,
    index,
    type: "shape.geo",
    semantic: { geo: "rect" },
    visual: {
      x: 10,
      y: 20,
      width: 80,
      height: 50,
      animation,
      ...(linkId ? { linkId } : {}),
    },
  });
const edge = (id: string, page: string, animation: ElementAnimation = {}) =>
  element({
    id,
    page,
    type: "edge.generic",
    semantic: { fromPoint: { x: 0, y: 0 }, toPoint: { x: 50, y: 50 } },
    visual: { animation },
  });
const carrier = (page: string, slide: SlideSettings) =>
  element({
    id: `carrier-${page}`,
    page,
    type: "presentation.slide",
    semantic: {},
    visual: { animation: { slide } },
  });
const plan = (elements: readonly Element[], backward = false) =>
  planSlideTransition(
    new Store(document(elements, pages)),
    createDefaultRegistry(),
    {
      from: { page: backward ? p2 : p1, rect },
      to: { page: backward ? p1 : p2, rect },
      navigation: backward ? "backward" : "forward",
    },
  );
const steps = (result: ReturnType<typeof plan>) => {
  if (result.kind !== "animate") throw new Error("expected animation");
  return result.steps;
};

test("slide owner controls cut and fade in both directions", () => {
  const artwork = [shape("old", p1), shape("new", p2)];
  for (const backwards of [false, true]) {
    expect(plan([...artwork, carrier(p2, { mode: "cut" })], backwards)).toEqual(
      { kind: "cut", reason: "setting" },
    );
    expect(
      plan([...artwork, carrier(p1, { mode: "cut" })], backwards).kind,
    ).toBe("animate");
    expect(
      plan(
        [...artwork, carrier(p2, { mode: "fade", durationMs: 1400 })],
        backwards,
      ),
    ).toEqual({
      kind: "animate",
      duration: 1400,
      steps: [
        { kind: "slide-fade", start: 0, duration: 1400, easing: "ease-in-out" },
      ],
    });
  }
  expect(plan([carrier(p2, { mode: "fade" })])).toEqual({
    kind: "cut",
    reason: "empty",
  });
});

test("slide duration scales timing and stagger can be disabled", () => {
  const artwork = [
    shape("out", p1),
    shape("a1", p1, {}, "A", "a1"),
    shape("b1", p1, {}, "B", "a2"),
    shape("a2", p2, {}, "A", "a1"),
    shape("b2", p2, {}, "B", "a2"),
    shape("in", p2, {}, undefined, "a3"),
  ];
  const s = steps(plan([...artwork, carrier(p2, { durationMs: 1400 })]));
  expect(s.map((x) => [x.kind, x.start, x.duration])).toEqual([
    ["fade-out", 0, 600],
    ["transform", 0, 1400],
    ["transform", 120, 1400],
    ["draw-on", 600, 1400],
  ]);
  expect(
    steps(plan([...artwork, carrier(p2, { stagger: false })]))
      .filter((x) => x.kind === "transform")
      .map((x) => x.start),
  ).toEqual([0, 0]);
});

test("effects, offsets, applicability and instant delays are resolved", () => {
  const s = steps(
    plan([
      shape("out", p1, {
        exit: "slide-out",
        exitTo: "right",
        delayMs: 11,
        durationMs: 99,
      }),
      edge("old-edge", p1, { exit: "undraw" }),
      shape("gone", p1, { exit: "none", delayMs: 9, durationMs: 200 }),
      shape("scale", p2, { enter: "scale-in" }, undefined, "a1"),
      shape(
        "slide",
        p2,
        { enter: "slide-in", enterFrom: "left" },
        undefined,
        "a2",
      ),
      shape("fallback", p2, { enter: "grow" }, undefined, "a3"),
      edge("new-edge", p2, { enter: "draw-on" }),
      shape(
        "instant",
        p2,
        { enter: "none", delayMs: 12, durationMs: 200 },
        undefined,
        "a4",
      ),
    ]),
  );
  expect(s.find((x) => x.from === "out")).toMatchObject({
    kind: "slide-out",
    offset: { x: 790, y: 0 },
    start: 11,
    duration: 99,
  });
  expect(s.find((x) => x.from === "old-edge")?.kind).toBe("undraw");
  expect(s.find((x) => x.from === "gone")).toMatchObject({
    kind: "disappear",
    start: 9,
    duration: 0,
  });
  expect(s.find((x) => x.to === "scale")).toMatchObject({
    kind: "scale-in",
    toBox: { x: 10, y: 20, width: 80, height: 50, rotation: 0 },
  });
  expect(s.find((x) => x.to === "slide")).toMatchObject({
    kind: "slide-in",
    offset: { x: -90, y: 0 },
  });
  expect(s.find((x) => x.to === "fallback")?.kind).toBe("draw-on");
  expect(s.find((x) => x.to === "new-edge")?.kind).toBe("grow");
  expect(s.find((x) => x.to === "instant")).toMatchObject({
    kind: "appear",
    duration: 0,
  });
  expect(s.find((x) => x.to === "instant")?.start).toBe(300 + 4 * 60 + 12);
});

test("linked motion and owner order govern both directions", () => {
  const items = [
    shape("a1", p1, {}, "A", "a1"),
    shape("b1", p1, {}, "B", "a2"),
    shape("a2", p2, { linked: "cut", order: 2, delayMs: 10 }, "A", "a2"),
    shape(
      "b2",
      p2,
      { linked: "crossfade", order: 1, durationMs: 100 },
      "B",
      "a1",
    ),
  ];
  for (const backward of [false, true]) {
    const result = plan(items, backward);
    const s = steps(result);
    expect(s.map((x) => [x.kind, x.start, x.duration])).toEqual([
      ["crossfade", 0, 100],
      ["swap", 70, 0],
    ]);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  }
});

test("backward mirrors entrance and exit effects and preserves sides", () => {
  const s = steps(
    plan(
      [
        shape("old", p1, { exit: "scale-out" }),
        shape("draw", p2, { enter: "draw-on" }, undefined, "a1"),
        shape(
          "slide",
          p2,
          { enter: "slide-in", enterFrom: "left" },
          undefined,
          "a2",
        ),
      ],
      true,
    ),
  );
  expect(s.find((x) => x.from === "draw")?.kind).toBe("undraw");
  expect(s.find((x) => x.from === "slide")).toMatchObject({
    kind: "slide-out",
    offset: { x: -90, y: 0 },
  });
  expect(s.find((x) => x.to === "old")?.kind).toBe("scale-in");
});
