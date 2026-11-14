import { expect, test } from "bun:test";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { document, element, TEST_PAGE } from "../test-helpers.ts";
import { planSlideTransition } from "./slide-transition.ts";

const page2 = { id: "page-2", name: "Page 2", kind: "freeform" as const };
const rect = { x: 0, y: 0, width: 800, height: 600 };
const shape = (
  id: string,
  page: string,
  index: string,
  linkId?: string,
  x = 10,
  type = "shape.geo",
) =>
  element({
    id,
    page,
    index,
    type,
    semantic: type === "shape.geo" ? { geo: "rect" } : {},
    visual: { x, y: 20, width: 80, height: 50, ...(linkId ? { linkId } : {}) },
  });
const edge = (id: string, page: string, index: string, linkId?: string) =>
  element({
    id,
    page,
    index,
    type: "edge.generic",
    semantic: { fromPoint: { x: 0, y: 0 }, toPoint: { x: 50, y: 50 } },
    visual: linkId ? { linkId } : {},
  });
const store = new Store(
  document(
    [
      shape("a1", TEST_PAGE.id, "a1", "A"),
      shape("b1", TEST_PAGE.id, "a2", "B"),
      shape("geom1", TEST_PAGE.id, "a3", "geom"),
      edge("edge1", TEST_PAGE.id, "a4", "edge"),
      shape("removed", TEST_PAGE.id, "a5"),
      shape("b2", page2.id, "a1", "B"),
      shape("a2", page2.id, "a2", "A"),
      shape("geom2", page2.id, "a3", "geom", 100),
      edge("edge2", page2.id, "a4", "edge"),
      shape("new", page2.id, "a5"),
      edge("new-edge", page2.id, "a6"),
      shape("text", page2.id, "a7", undefined, 10, "text.note"),
    ],
    [TEST_PAGE, page2],
  ),
);
const registry = createDefaultRegistry();
const forward = () =>
  planSlideTransition(store, registry, {
    from: { page: TEST_PAGE.id, rect },
    to: { page: page2.id, rect },
  });
const backward = () =>
  planSlideTransition(store, registry, {
    from: { page: page2.id, rect },
    to: { page: TEST_PAGE.id, rect },
  });
test("Phase 1 forward and backward plans are pinned", () => {
  expect(forward()).toEqual({
    kind: "animate",
    duration: 1120,
    steps: [
      {
        kind: "fade-out",
        from: "removed",
        start: 0,
        duration: 300,
        easing: "ease-in-out",
      },
      {
        kind: "transform",
        from: "b1",
        to: "b2",
        start: 0,
        duration: 700,
        easing: "ease-in-out",
        fromBox: {
          x: 10,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        toBox: {
          x: 10,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        fromAppearance: {
          opacity: 1,
        },
        toAppearance: {
          opacity: 1,
        },
        appearanceChanged: false,
      },
      {
        kind: "transform",
        from: "a1",
        to: "a2",
        start: 60,
        duration: 700,
        easing: "ease-in-out",
        fromBox: {
          x: 10,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        toBox: {
          x: 10,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        fromAppearance: {
          opacity: 1,
        },
        toAppearance: {
          opacity: 1,
        },
        appearanceChanged: false,
      },
      {
        kind: "transform",
        from: "geom1",
        to: "geom2",
        start: 120,
        duration: 700,
        easing: "ease-in-out",
        fromBox: {
          x: 10,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        toBox: {
          x: 100,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        fromAppearance: {
          opacity: 1,
        },
        toAppearance: {
          opacity: 1,
        },
        appearanceChanged: false,
      },
      {
        kind: "crossfade",
        from: "edge1",
        to: "edge2",
        start: 180,
        duration: 700,
        easing: "ease-in-out",
      },
      {
        kind: "draw-on",
        to: "new",
        start: 300,
        duration: 700,
        easing: "ease-in-out",
      },
      {
        kind: "grow",
        to: "new-edge",
        start: 360,
        duration: 700,
        easing: "ease-in-out",
      },
      {
        kind: "fade-in",
        to: "text",
        start: 420,
        duration: 700,
        easing: "ease-in-out",
      },
    ],
  });
  expect(backward()).toEqual({
    kind: "animate",
    duration: 1000,
    steps: [
      {
        kind: "fade-out",
        from: "new",
        start: 0,
        duration: 300,
        easing: "ease-in-out",
      },
      {
        kind: "fade-out",
        from: "new-edge",
        start: 0,
        duration: 300,
        easing: "ease-in-out",
      },
      {
        kind: "fade-out",
        from: "text",
        start: 0,
        duration: 300,
        easing: "ease-in-out",
      },
      {
        kind: "transform",
        from: "a2",
        to: "a1",
        start: 0,
        duration: 700,
        easing: "ease-in-out",
        fromBox: {
          x: 10,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        toBox: {
          x: 10,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        fromAppearance: {
          opacity: 1,
        },
        toAppearance: {
          opacity: 1,
        },
        appearanceChanged: false,
      },
      {
        kind: "transform",
        from: "b2",
        to: "b1",
        start: 60,
        duration: 700,
        easing: "ease-in-out",
        fromBox: {
          x: 10,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        toBox: {
          x: 10,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        fromAppearance: {
          opacity: 1,
        },
        toAppearance: {
          opacity: 1,
        },
        appearanceChanged: false,
      },
      {
        kind: "transform",
        from: "geom2",
        to: "geom1",
        start: 120,
        duration: 700,
        easing: "ease-in-out",
        fromBox: {
          x: 100,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        toBox: {
          x: 10,
          y: 20,
          width: 80,
          height: 50,
          rotation: 0,
        },
        fromAppearance: {
          opacity: 1,
        },
        toAppearance: {
          opacity: 1,
        },
        appearanceChanged: false,
      },
      {
        kind: "crossfade",
        from: "edge2",
        to: "edge1",
        start: 180,
        duration: 700,
        easing: "ease-in-out",
      },
      {
        kind: "draw-on",
        to: "removed",
        start: 300,
        duration: 700,
        easing: "ease-in-out",
      },
    ],
  });
});
