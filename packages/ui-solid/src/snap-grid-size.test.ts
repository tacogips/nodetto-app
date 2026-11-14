import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  interactionFor,
  pointer,
  visualOf,
} from "./interaction-test-helpers.ts";

describe("desktop grid size", () => {
  for (const [size, expected] of [
    [8, 16],
    [4, 12],
    [undefined, 24],
  ] as const) {
    test(`snaps translation with grid size ${size ?? 24}`, () => {
      const editor = new Editor();
      const moving = editor.createElement("shape.geo", {
        visual: { x: 0, y: 0, width: 40, height: 40 },
      });
      editor.selection.set([moving]);
      const { interaction } = interactionFor(editor, "select", {
        snap: () => ({
          grid: true,
          objects: false,
          guides: false,
          gridSize: size,
        }),
      });
      interaction.onPointerDown(pointer({ clientX: 20, clientY: 20 }));
      interaction.onPointerMove(pointer({ clientX: 33, clientY: 20 }));
      expect(visualOf(editor, moving).x).toBe(expected);
      interaction.onPointerUp(pointer({ clientX: 33, clientY: 20 }));
    });
  }
  test("frame grid overrides the desktop grid", () => {
    const editor = new Editor();
    const frame = editor.createElement("frame", {
      semantic: {
        name: "Frame",
        layoutGrids: [
          {
            id: "grid",
            kind: "grid",
            size: 10,
            color: "#000000",
            opacity: 0.2,
          },
        ],
      },
      visual: { x: 101, y: 203, width: 390, height: 844 },
    });
    const moving = editor.createElement("shape.geo", {
      visual: { x: 111, y: 243, width: 20, height: 20 },
    });
    editor.apply([
      {
        type: "updateSemantic",
        id: frame,
        semantic: {
          ...(editor.store.get(frame)?.semantic as object),
          memberIds: [moving],
        },
      },
    ]);
    editor.selection.set([moving]);
    const { interaction } = interactionFor(editor, "select", {
      snap: () => ({ grid: true, objects: false, guides: false, gridSize: 4 }),
    });
    interaction.onPointerDown(pointer({ clientX: 121, clientY: 253 }));
    interaction.onPointerMove(pointer({ clientX: 127, clientY: 253 }));
    expect(visualOf(editor, moving).x).toBe(121);
    interaction.onPointerUp(pointer({ clientX: 127, clientY: 253 }));
  });
});
