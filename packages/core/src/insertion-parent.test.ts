import { expect, test } from "bun:test";
import { findInsertionParent, planAttachToFrame } from "./insertion-parent.ts";
import { document, element, makeEditor } from "./test-helpers.ts";

test("insertion picks the innermost containing frame and excludes descendants", () => {
  const editor = makeEditor({
    document: document([
      element({
        id: "outer",
        index: "a1",
        type: "frame",
        semantic: { name: "Outer", memberIds: ["inner"] },
        visual: { x: 0, y: 0, width: 300, height: 300 },
      }),
      element({
        id: "inner",
        index: "a2",
        type: "frame",
        semantic: { name: "Inner", memberIds: [] },
        visual: { x: 20, y: 20, width: 100, height: 100 },
      }),
      element({
        id: "top",
        index: "a3",
        type: "frame",
        semantic: { name: "Top" },
        visual: { x: 20, y: 20, width: 100, height: 100 },
      }),
    ]),
  });
  const context = editor.createShapeContext();
  const pick = (
    box: { x: number; y: number; width: number; height: number },
    excluded?: Set<string>,
  ) =>
    findInsertionParent(
      editor.store,
      editor.currentPageId,
      box,
      context,
      excluded,
    );
  expect(pick({ x: 30, y: 30, width: 10, height: 10 })).toBe("top");
  expect(pick({ x: 30, y: 30, width: 10, height: 10 }, new Set(["top"]))).toBe(
    "inner",
  );
  expect(
    pick({ x: 30, y: 30, width: 10, height: 10 }, new Set(["outer", "top"])),
  ).toBeUndefined();
  expect(pick({ x: 290, y: 290, width: 20, height: 20 })).toBeUndefined();
});

test("attachment inserts at the requested index only for explicit frames", () => {
  const editor = makeEditor({
    document: document([
      element({
        id: "frame",
        type: "frame",
        semantic: { name: "Frame", memberIds: ["old"] },
      }),
      element({
        id: "geometric",
        type: "frame",
        semantic: { name: "Geometric" },
      }),
      element({ id: "old", type: "shape.geo", semantic: { geo: "rect" } }),
      element({ id: "new", type: "shape.geo", semantic: { geo: "rect" } }),
    ]),
  });
  expect(planAttachToFrame(editor.store, "frame", "new", 0)).toEqual([
    {
      type: "updateSemantic",
      id: "frame",
      semantic: { name: "Frame", memberIds: ["new", "old"] },
    },
  ]);
  expect(planAttachToFrame(editor.store, "frame", "old")).toEqual([]);
  expect(planAttachToFrame(editor.store, "geometric", "new")).toEqual([]);
});
