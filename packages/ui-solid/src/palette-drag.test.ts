import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { paletteDragPreview, paletteDropInsideCanvas } from "./palette-drag.ts";
import { Tool } from "./tools.ts";

test("shape previews render real defaults without reserving IDs or changing document history", () => {
  let allocated = 0;
  const editor = new Editor({ idSource: () => `preview-test-${++allocated}` });
  const before = editor.getSnapshot();
  const revision = editor.revision;
  const ids = allocated;
  const undoSize = editor.history.undoSize;
  expect(paletteDragPreview(editor, Tool.FlowDecision)).toMatchObject({
    element: { type: "shape.geo", semantic: { geo: "diamond" } },
    box: { x: 0, y: 0, width: 160, height: 120 },
  });
  expect(paletteDragPreview(editor, Tool.InitialState)?.box).toMatchObject({
    width: 32,
    height: 32,
  });
  expect(paletteDragPreview(editor, Tool.Table)?.element.type).toBe(
    "erd.table",
  );
  expect(paletteDragPreview(editor, Tool.Connector)).toBeNull();
  expect(editor.getSnapshot()).toEqual(before);
  expect(editor.revision).toBe(revision);
  expect(editor.history.undoSize).toBe(undoSize);
  expect(allocated).toBe(ids);
});

test("drops require the uncovered canvas and reject pane edges, off-window and invalid coordinates", () => {
  const canvas = { left: 260, top: 60, right: 1000, bottom: 700 };
  expect(paletteDropInsideCanvas(canvas, { x: 500, y: 300 }, true)).toBe(true);
  expect(paletteDropInsideCanvas(canvas, { x: 260, y: 60 }, true)).toBe(true);
  for (const point of [
    { x: 259, y: 300 },
    { x: 500, y: 59 },
    { x: 1000, y: 300 },
    { x: 500, y: 700 },
    { x: -1, y: -1 },
    { x: Number.NaN, y: 300 },
    { x: 500, y: Number.POSITIVE_INFINITY },
  ])
    expect(paletteDropInsideCanvas(canvas, point, true)).toBe(false);
  expect(paletteDropInsideCanvas(canvas, { x: 500, y: 300 }, false)).toBe(
    false,
  );
});
