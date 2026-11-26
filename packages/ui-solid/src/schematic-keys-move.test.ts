import { expect, test } from "bun:test";
import { Editor, schematicAnchor } from "@nodetto/core";
import { createInteraction } from "./interaction.ts";
import { Tool, type ToolKind } from "./tools.ts";

function setup(schematic = true, grid = false) {
  const editor = new Editor();
  if (schematic) editor.setPageKind(editor.currentPageId, "schematic");
  let tool: ToolKind = Tool.Select;
  const interaction = createInteraction(editor, {
    tool: () => tool,
    setTool: (value) => {
      tool = value;
    },
    snap: () => ({ grid, objects: false, guides: false }),
    container: () => undefined,
  });
  return { editor, interaction, tool: () => tool };
}
function key(value: string, shiftKey = false, altKey = false): KeyboardEvent {
  return {
    key: value,
    shiftKey,
    metaKey: false,
    ctrlKey: false,
    altKey,
    isComposing: false,
    target: null,
    preventDefault() {},
  } as unknown as KeyboardEvent;
}
function pointer(x: number, y: number): PointerEvent {
  return {
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 1,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
    stopPropagation() {},
    preventDefault() {},
  } as unknown as PointerEvent;
}
test("schematic keys rotate and mirror while freeform keeps its tool shortcut", () => {
  const { editor, interaction } = setup();
  const id = editor.createSchematicElement("schematic.resistor", {
    x: 0,
    y: 0,
  });
  if (!id) throw new Error("missing resistor");
  editor.selection.set([id]);
  interaction.onKeyDown(key("r"));
  expect(editor.store.get(id)?.visual.rotation).toBe(90);
  interaction.onKeyDown(key("R", true));
  expect(editor.store.get(id)?.visual.rotation).toBe(0);
  interaction.onKeyDown(key("x"));
  expect(editor.store.get(id)?.visual.flipX).toBe(true);
  interaction.onKeyDown(key("r", false, true));
  interaction.onKeyDown(key("x", false, true));
  expect(editor.store.get(id)?.visual.rotation).toBe(0);
  expect(editor.store.get(id)?.visual.flipX).toBe(true);
  const freeform = setup(false);
  freeform.interaction.onKeyDown(key("r"));
  expect(freeform.tool()).toBe(Tool.Rectangle);
});
test("drag canonicalizes shared negative tie for joined elements", () => {
  const { editor, interaction } = setup();
  const a = editor.createSchematicElement("schematic.resistor", { x: 0, y: 0 });
  const b = editor.createSchematicElement("schematic.resistor", { x: 0, y: 0 });
  if (!a || !b) throw new Error("missing parts");
  editor.apply([
    { type: "updateVisual", id: a, visual: { x: -1 } },
    { type: "updateVisual", id: b, visual: { x: -0.999 } },
  ]);
  editor.selection.set([a, b]);
  const bounds = editor.getBounds(a);
  if (!bounds) throw new Error("missing bounds");
  const x = 0;
  const y = bounds.y + bounds.height / 2;
  interaction.onPointerDown(pointer(x, y));
  interaction.onPointerMove(pointer(x - 10, y));
  interaction.onPointerMove(pointer(x - 0.005, y));
  expect(editor.store.get(a)?.visual.x).toBe(-1.01);
  expect(editor.store.get(b)?.visual.x).toBe(-1.01);
  interaction.onPointerUp(pointer(x - 0.005, y));
});
test("repeated drag samples snap the anchor to the intended lattice point", () => {
  const { editor, interaction } = setup(true, true);
  const id = editor.createSchematicElement("schematic.resistor", {
    x: 30,
    y: 40,
  });
  if (!id) throw new Error("missing part");
  editor.selection.set([id]);
  const bounds = editor.getBounds(id);
  if (!bounds) throw new Error("missing bounds");
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  interaction.onPointerDown(pointer(x, y));
  interaction.onPointerMove(pointer(x + 7, y + 4));
  interaction.onPointerMove(pointer(x + 17, y + 4));
  interaction.onPointerUp(pointer(x + 17, y + 4));
  const element = editor.store.get(id);
  if (!element) throw new Error("missing moved part");
  expect(schematicAnchor(element)).toEqual({ x: 50, y: 40 });
});
