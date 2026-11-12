import { expect, test } from "bun:test";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import { createPresentationController } from "./controller.ts";

const pages = ["p1", "p2", "p3"].map((id) => ({
  id,
  name: id,
  kind: "freeform" as const,
}));
function setup(sized = true) {
  const shapes = pages.map((page, i) =>
    element({
      id: `s${i}`,
      page: page.id,
      type: "shape.geo",
      semantic: { geo: "rect", label: "" },
      visual: {
        x: i * 10,
        y: 0,
        width: 100 + i * 50,
        height: 100,
        linkId: "shared",
      },
    }),
  );
  const editor = makeEditor({ document: document(shapes, pages) });
  if (sized)
    editor.apply([
      {
        type: "updateDocument",
        document: { slideSize: { width: 800, height: 600 } },
      },
    ]);
  const exits: string[] = [];
  const controller = createPresentationController({
    editor,
    from: "p1",
    onExit: (page) => exits.push(page),
  });
  return { controller, exits };
}
test("adjacent moves animate, rapid moves start at the preceding target, and digits preserve them", () => {
  const { controller, exits } = setup();
  controller.dispatch({ type: "next" });
  const first = controller.transition();
  expect(first?.plan.kind).toBe("animate");
  controller.dispatch({ type: "digit", digit: "3" });
  expect(controller.transition()).toBe(first);
  controller.dispatch({ type: "clearDigits" });
  controller.dispatch({ type: "next" });
  expect(controller.transition()?.fromPage).toBe(first?.toPage);
  expect(controller.transition()?.toPage).toBe("p3");
  expect(controller.state()?.index).toBe(2);
  controller.dispatch({ type: "prev" });
  expect(controller.transition()?.toPage).toBe("p2");
  controller.dispatch("exit");
  expect(controller.transition()).toBeNull();
  expect(exits).toEqual(["p2"]);
});
test("jumps, black and size mismatches cut", () => {
  const { controller } = setup();
  for (const action of [
    { type: "goto", n: 2 } as const,
    { type: "first" } as const,
    { type: "last" } as const,
  ]) {
    controller.dispatch(action);
    expect(controller.transition()).toBeNull();
  }
  controller.dispatch({ type: "toggleBlack" });
  controller.dispatch({ type: "prev" });
  expect(controller.transition()).toBeNull();
  const mismatch = setup(false).controller;
  mismatch.dispatch({ type: "next" });
  expect(mismatch.transition()).toBeNull();
});
