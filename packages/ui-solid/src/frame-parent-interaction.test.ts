import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import type { FrameSemantic } from "@nodetto/ir";
import { Tool } from "./tools.ts";
import { interactionFor, pointer } from "./interaction-test-helpers.ts";

function fixture() {
  const editor = new Editor();
  const frame = editor.createElement("frame", {
    semantic: {
      name: "Screen",
      memberIds: [],
      layout: {
        direction: "vertical",
        gap: 8,
        padding: 8,
        sizing: "fixed",
        align: "start",
      },
    },
    visual: { x: 200, y: 0, width: 400, height: 500 },
  });
  return { editor, frame };
}

function members(editor: Editor, frame: string) {
  return (editor.store.get(frame)?.semantic as FrameSemantic).memberIds;
}

test("creating a rect inside an explicit frame attaches it in one undo step", () => {
  const { editor, frame } = fixture();
  const { interaction } = interactionFor(editor, Tool.Rectangle);
  const before = editor.getSnapshot();
  interaction.placeTool(Tool.Rectangle, { x: 350, y: 150 });
  const [rect] = editor.selection.ids();
  expect(rect).toBeDefined();
  expect(members(editor, frame)).toContain(rect!);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
});

test("dropping a rect inside an explicit frame attaches it in one undo step", () => {
  const { editor, frame } = fixture();
  const rect = editor.createElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: { x: 0, y: 100, width: 80, height: 80 },
  });
  editor.selection.set([rect]);
  const { interaction } = interactionFor(editor, "select");
  const before = editor.getSnapshot();
  interaction.onPointerDown(pointer({ clientX: 40, clientY: 140 }));
  interaction.onPointerMove(pointer({ clientX: 340, clientY: 140 }));
  interaction.onPointerUp(pointer({ clientX: 340, clientY: 140 }));
  expect(members(editor, frame)).toContain(rect);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
});

test("dragging a nested frame keeps its children and stays in the outer frame", () => {
  const editor = new Editor();
  const child = editor.createElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: { x: 260, y: 60, width: 40, height: 40 },
  });
  const inner = editor.createElement("frame", {
    semantic: { name: "Inner", memberIds: [child] },
    visual: { x: 250, y: 50, width: 100, height: 100 },
  });
  const outer = editor.createElement("frame", {
    semantic: { name: "Outer", memberIds: [inner] },
    visual: { x: 200, y: 0, width: 400, height: 500 },
  });
  editor.selection.set([inner]);
  const { interaction } = interactionFor(editor, "select");
  const before = editor.getSnapshot();
  interaction.onPointerDown(pointer({ clientX: 251, clientY: 100 }));
  interaction.onPointerMove(pointer({ clientX: 271, clientY: 120 }));
  interaction.onPointerUp(pointer({ clientX: 271, clientY: 120 }));
  expect(members(editor, inner)).toEqual([child]);
  expect(members(editor, outer)).toEqual([inner]);
  expect(editor.store.get(child)?.visual.x).toBe(280);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
});
