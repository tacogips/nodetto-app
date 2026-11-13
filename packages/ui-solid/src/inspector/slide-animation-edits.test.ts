import { expect, test } from "bun:test";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import {
  planAnimationEdit,
  sharedAnimationValue,
} from "./slide-animation-edits.ts";
const shape = (id: string) =>
  element({ id, page: "p1", type: "shape.rect", semantic: {}, visual: {} });
test("multi-selection edits are a single undo step and mixed values are reported", () => {
  const a = shape("a");
  const b = shape("b");
  const editor = makeEditor({ document: document([a, b]) });
  const commands = planAnimationEdit([a, b], { enter: "fade-in" });
  expect(commands.map((c) => c.type)).toEqual([
    "replaceVisual",
    "replaceVisual",
  ]);
  editor.apply(commands);
  const updated = [editor.store.get("a")!, editor.store.get("b")!];
  expect(sharedAnimationValue(updated, "enter")).toBe("fade-in");
  expect(sharedAnimationValue([updated[0]!, b], "enter")).toBe("mixed");
  editor.undo();
  expect(editor.store.get("a")?.visual.animation).toBeUndefined();
  expect(editor.store.get("b")?.visual.animation).toBeUndefined();
});
test("normalization removes empty animation and preserves slide settings", () => {
  const a = {
    ...shape("a"),
    visual: { animation: { enter: "fade-in" as const } },
  };
  expect(planAnimationEdit([a], { enter: "auto" })[0]).toMatchObject({
    type: "replaceVisual",
    visual: {},
  });
  const b = {
    ...a,
    visual: {
      animation: { enter: "fade-in" as const, slide: { mode: "cut" as const } },
    },
  };
  expect(planAnimationEdit([b], { enter: "auto" })[0]).toMatchObject({
    visual: { animation: { slide: { mode: "cut" } } },
  });
});
