import { expect, test } from "bun:test";
import { Wire, peer, elementIn } from "./binding-test-helpers.ts";
import { freeformDocument } from "./test-fixtures.ts";

test("carrier commands and shape animation converge and undo across bindings", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const carrier = {
    id: "slide-carrier",
    page: "p1",
    type: "presentation.slide",
    index: "z1",
    semantic: {},
    visual: { animation: { slide: { mode: "fade" as const } } },
  };
  a.editor.apply([{ type: "createElement", element: carrier }]);
  wire.flush();
  expect(elementIn(b, carrier.id).visual).toEqual(carrier.visual);
  const visual = {
    animation: { slide: { mode: "cut" as const, durationMs: 800 } },
  };
  a.editor.apply([{ type: "replaceVisual", id: carrier.id, visual }]);
  wire.flush();
  expect(elementIn(b, carrier.id).visual).toEqual(visual);
  a.editor.apply([
    {
      type: "updateVisual",
      id: "d-stroke",
      visual: { animation: { enter: "draw-on" } },
    },
  ]);
  wire.flush();
  expect(elementIn(b, "d-stroke").visual.animation).toEqual({
    enter: "draw-on",
  });
  a.editor.apply([{ type: "deleteElements", ids: [carrier.id] }]);
  wire.flush();
  expect(b.editor.store.get(carrier.id)).toBeUndefined();
  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(a, carrier.id).visual).toEqual(visual);
  expect(elementIn(b, carrier.id).visual).toEqual(visual);
});
