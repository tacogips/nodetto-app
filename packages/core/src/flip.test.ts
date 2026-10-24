import { expect, test } from "bun:test";
import { validateDocument } from "@nodetto/ir";
import { canFlipSelection, flipElements } from "./flip.ts";
import { makeEditor } from "./test-helpers.ts";

test("flipping toggles in place, one undo step per flip, and clears cleanly", () => {
  const editor = makeEditor();
  const arrow = editor.buildElement("shape.geo", {
    semantic: { geo: "arrow", label: "Next" },
    visual: { x: 10, y: 20, width: 160, height: 80 },
  });
  const note = editor.buildElement("text.note");
  editor.apply([
    { type: "createElement", element: arrow },
    { type: "createElement", element: note },
  ]);

  expect(flipElements(editor, [arrow.id, note.id], "horizontal")).toBe(true);
  expect(editor.store.get(arrow.id)?.visual).toMatchObject({
    x: 10,
    y: 20,
    width: 160,
    height: 80,
    flipX: true,
  });
  // Only geometric shapes have a mirrorable outline.
  expect(editor.store.get(note.id)?.visual.flipX).toBeUndefined();

  flipElements(editor, [arrow.id], "vertical");
  expect(editor.store.get(arrow.id)?.visual).toMatchObject({
    flipX: true,
    flipY: true,
  });
  expect(validateDocument(editor.getSnapshot())).toEqual([]);

  flipElements(editor, [arrow.id], "horizontal");
  expect(editor.store.get(arrow.id)?.visual).not.toHaveProperty("flipX");

  editor.undo();
  expect(editor.store.get(arrow.id)?.visual.flipX).toBe(true);
  editor.undo();
  editor.undo();
  expect(editor.store.get(arrow.id)?.visual).not.toHaveProperty("flipX");
  expect(editor.store.get(arrow.id)?.visual).not.toHaveProperty("flipY");
});

test("locked and non-geometric selections cannot flip", () => {
  const editor = makeEditor();
  const shape = editor.buildElement("shape.geo", {
    visual: { x: 0, y: 0, width: 100, height: 60, locked: true },
  });
  const node = editor.buildElement("node.generic");
  editor.apply([
    { type: "createElement", element: shape },
    { type: "createElement", element: node },
  ]);
  expect(canFlipSelection(editor, [shape.id, node.id])).toBe(false);
  expect(flipElements(editor, [shape.id], "vertical")).toBe(false);
  expect(editor.store.get(shape.id)?.visual.flipY).toBeUndefined();
});
