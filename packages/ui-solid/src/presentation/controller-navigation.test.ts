import { expect, test } from "bun:test";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import { createPresentationController } from "./controller.ts";

function setup(mode: "fade" | "cut") {
  const pages = ["p1", "p2"].map((id) => ({
    id,
    name: id,
    kind: "freeform" as const,
  }));
  const shapes = pages.map((page, i) =>
    element({
      id: `s${i}`,
      page: page.id,
      type: "shape.geo",
      semantic: { geo: "rect" },
      visual: { x: i * 10, y: 0, width: 100, height: 100 },
    }),
  );
  const carrier = element({
    id: "settings",
    page: "p2",
    type: "presentation.slide",
    semantic: {},
    visual: { animation: { slide: { mode } } },
  });
  const editor = makeEditor({
    document: document([...shapes, carrier], pages),
  });
  editor.apply([
    {
      type: "updateDocument",
      document: { slideSize: { width: 800, height: 600 } },
    },
  ]);
  return createPresentationController({ editor, from: "p1", onExit: () => {} });
}

test("slide 2 fade owns forward and backward transitions", () => {
  const controller = setup("fade");
  controller.dispatch({ type: "next" });
  expect(controller.transition()?.plan.steps.map((step) => step.kind)).toEqual([
    "slide-fade",
  ]);
  controller.dispatch({ type: "prev" });
  expect(controller.transition()?.plan.steps.map((step) => step.kind)).toEqual([
    "slide-fade",
  ]);
});

test("slide 2 cut switches instantly going backward", () => {
  const controller = setup("cut");
  controller.dispatch({ type: "next" });
  controller.dispatch({ type: "prev" });
  expect(controller.state()?.index).toBe(0);
  expect(controller.transition()).toBeNull();
});
