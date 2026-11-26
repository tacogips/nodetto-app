import { expect, test } from "bun:test";
import { document, element, makeEditor } from "../test-helpers.ts";

const page = { id: "s", name: "Circuit", kind: "schematic" as const };

test("nudge uses one canonical delta for schematic elements", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
  ];
  const editor = makeEditor({
    document: document(
      [
        element({
          id: "w",
          page: page.id,
          type: "schematic.wire",
          semantic: { points },
          visual: { x: -1, y: 0 },
        }),
        element({
          id: "j",
          page: page.id,
          index: "a2",
          type: "schematic.junction",
          semantic: {},
          visual: { x: -0.999, y: 0 },
        }),
      ],
      [page],
    ),
  });
  editor.selection.set(["w", "j"]);
  expect(editor.nudgeSelection(-0.005, 0)).toBe(true);
  expect(editor.store.get("w")?.visual.x).toBe(-1.01);
  expect(editor.store.get("j")?.visual.x).toBe(-1.01);
  expect(editor.store.get("w")?.semantic).toEqual({ points });
});

test("absolute schematic destinations are canonical", () => {
  const editor = makeEditor({
    document: document(
      [
        element({
          id: "j",
          page: page.id,
          type: "schematic.junction",
          semantic: {},
          visual: { x: 0, y: 0 },
        }),
      ],
      [page],
    ),
  });
  editor.moveElements([{ id: "j", x: 0.875, y: 0 }]);
  expect(editor.store.get("j")?.visual.x).toBe(0.88);
});

test("non-schematic nudges retain raw coordinates", () => {
  const editor = makeEditor({
    document: document([
      element({
        id: "r",
        type: "shape.geo",
        semantic: { shape: "rectangle" },
        visual: { x: -1, y: 0, width: 10, height: 10 },
      }),
    ]),
  });
  editor.selection.set(["r"]);
  expect(editor.nudgeSelection(-0.005, 0)).toBe(true);
  expect(editor.store.get("r")?.visual.x).toBe(-1 + -0.005);
});
