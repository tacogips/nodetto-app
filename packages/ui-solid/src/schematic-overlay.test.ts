import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { createInteraction } from "./interaction.ts";
import { SCHEMATIC_LABEL_CROSSING_MESSAGE } from "./interaction/schematic-wire.ts";
import {
  schematicDraftPath,
  schematicFocusAfterNudge,
  schematicHandleKey,
  schematicNoticeLabel,
  schematicWireHandles,
} from "./schematic-overlay.ts";
import { Tool } from "./tools.ts";

const initial = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 20 },
];

test("draft and notice preserve the last point and empty state", () => {
  expect(schematicDraftPath(initial)).toBe("0,0 30,0 30,20");
  expect(schematicDraftPath([])).toBeNull();
  expect(
    schematicNoticeLabel(SCHEMATIC_LABEL_CROSSING_MESSAGE, initial),
  ).toEqual({ text: SCHEMATIC_LABEL_CROSSING_MESSAGE, at: initial[2] });
  expect(schematicNoticeLabel(null, initial)).toBeNull();
  expect(schematicNoticeLabel("notice", null)).toEqual({
    text: "notice",
    at: null,
  });
});

test("selected wire handles and keyboard directions", () => {
  const editor = new Editor();
  editor.setPageKind(editor.currentPageId, "schematic");
  const id = editor.createSchematicElement(
    "schematic.wire",
    { x: 5, y: 10 },
    { points: initial },
  );
  if (!id) throw new Error("wire missing");
  const element = editor.store.get(id);
  expect(schematicWireHandles(element, true)).toEqual([
    { index: 0, at: { x: 10, y: 10 }, label: "Wire start" },
    { index: 1, at: { x: 40, y: 10 }, label: "Wire bend 2 of 3" },
    { index: 2, at: { x: 40, y: 30 }, label: "Wire end" },
  ]);
  expect(schematicWireHandles(element, false)).toEqual([]);
  expect(
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].map((key) =>
      schematicHandleKey(key, false),
    ),
  ).toEqual([
    { dx: -10, dy: 0 },
    { dx: 10, dy: 0 },
    { dx: 0, dy: -10 },
    { dx: 0, dy: 10 },
  ]);
  for (const key of ["Tab", "Enter", "a"])
    expect(schematicHandleKey(key, true)).toBeNull();
  expect(schematicFocusAfterNudge(2, 1)).toBe(2);
  expect(schematicFocusAfterNudge(null, 1)).toBe(1);
});

test("two arrow edits follow the moved point and undo separately", () => {
  const editor = new Editor();
  editor.setPageKind(editor.currentPageId, "schematic");
  const id = editor.createSchematicElement(
    "schematic.wire",
    { x: 0, y: 0 },
    { points: initial },
  );
  if (!id) throw new Error("wire missing");
  const interaction = createInteraction(editor, {
    tool: () => Tool.Select,
    setTool() {},
    container: () => undefined,
  });
  const currentPoints = () =>
    (editor.store.get(id)?.semantic as { points: typeof initial }).points;
  let focus = 1;
  const press = () => {
    const delta = schematicHandleKey("ArrowDown", false);
    if (!delta) throw new Error("arrow missing");
    focus = schematicFocusAfterNudge(
      interaction.nudgeSchematicWirePoint(id, focus, delta.dx, delta.dy),
      focus,
    );
  };
  press();
  expect(focus).toBe(2);
  expect(currentPoints()).toEqual([
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 10 },
    { x: 30, y: 20 },
  ]);
  expect(schematicWireHandles(editor.store.get(id), true)[focus]?.at).toEqual({
    x: 30,
    y: 10,
  });
  press();
  expect(focus).toBe(2);
  expect(currentPoints()).toEqual(initial);
  expect(editor.undo()).toBe(true);
  expect(editor.undo()).toBe(true);
  expect(currentPoints()).toEqual(initial);
  interaction.dispose();
});
