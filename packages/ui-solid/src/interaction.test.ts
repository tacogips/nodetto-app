import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import {
  interactionFor,
  harness,
  pointer,
  keyboard,
  visualOf,
  shortcut,
} from "./interaction-test-helpers.ts";

// Every one of these asserts `history.batching` is false at the end. An
// unbalanced beginBatch does not throw: history quietly folds every later
// edit into a batch nobody commits, so undo is dead until the app restarts.
describe("the gesture state machine keeps history batches balanced", () => {
  test("a drag closes its batch and costs exactly one undo step", () => {
    const { editor, interaction, shape } = harness();
    const before = editor.history.undoSize;

    interaction.onPointerDown(pointer());
    for (let step = 1; step <= 5; step += 1) {
      interaction.onPointerMove(
        pointer({ clientX: 50 + step * 10, clientY: 50 + step * 10 }),
      );
    }
    interaction.onPointerUp(pointer({ clientX: 100, clientY: 100 }));

    expect(editor.history.batching).toBe(false);
    expect(editor.history.undoSize).toBe(before + 1);
    expect(visualOf(editor, shape)).toMatchObject({ x: 50, y: 50 });
    editor.undo();
    expect(visualOf(editor, shape)).toMatchObject({ x: 0, y: 0 });
  });

  test("a middle click during a drag does not open a second batch", () => {
    const { editor, interaction } = harness();

    interaction.onPointerDown(pointer());
    interaction.onPointerMove(pointer({ clientX: 80, clientY: 80 }));
    interaction.onPointerDown(pointer({ button: 1 }));
    interaction.onPointerUp(pointer({ button: 1 }));
    interaction.onPointerUp(pointer());

    expect(editor.history.batching).toBe(false);
    // Undo still reaches the drag rather than a stale pre-drag entry.
    expect(editor.canUndo()).toBe(true);
  });

  test("a second pointer is ignored rather than starting a gesture", () => {
    const { editor, interaction, shape } = harness();

    interaction.onPointerDown(pointer({ pointerId: 1 }));
    interaction.onPointerDown(pointer({ pointerId: 2 }));
    // The intruding pointer must not drive the gesture the first one owns.
    interaction.onPointerMove(pointer({ pointerId: 2, clientX: 900 }));
    expect(visualOf(editor, shape)).toMatchObject({ x: 0, y: 0 });

    interaction.onPointerMove(pointer({ pointerId: 1, clientX: 70 }));
    interaction.onPointerUp(pointer({ pointerId: 2 }));
    interaction.onPointerUp(pointer({ pointerId: 1, clientX: 70 }));

    expect(editor.history.batching).toBe(false);
    expect(visualOf(editor, shape)).toMatchObject({ x: 20, y: 0 });
  });

  test("edits after a stray pointer still reach the undo stack", () => {
    const { editor, interaction } = harness();

    interaction.onPointerDown(pointer({ pointerId: 1 }));
    interaction.onPointerDown(pointer({ pointerId: 2 }));
    interaction.onPointerUp(pointer({ pointerId: 1 }));
    interaction.onPointerUp(pointer({ pointerId: 2 }));

    const before = editor.history.undoSize;
    editor.createElement("shape.geo", { visual: { x: 300, y: 300 } });
    expect(editor.history.undoSize).toBe(before + 1);
    expect(editor.canUndo()).toBe(true);
  });

  test("a resize closes its batch and costs exactly one undo step", () => {
    const { editor, interaction, shape } = harness();
    const before = editor.history.undoSize;

    interaction.startResize(shape, "se", pointer());
    interaction.onPointerMove(pointer({ clientX: 150, clientY: 150 }));
    interaction.onPointerMove(pointer({ clientX: 200, clientY: 200 }));
    interaction.onPointerUp(pointer({ clientX: 200, clientY: 200 }));

    expect(editor.history.batching).toBe(false);
    expect(editor.history.undoSize).toBe(before + 1);
    expect(visualOf(editor, shape)).toMatchObject({ width: 250, height: 250 });
  });

  test("a pointer down on a handle mid-drag does not stack batches", () => {
    const { editor, interaction, shape } = harness();

    interaction.onPointerDown(pointer());
    interaction.onPointerMove(pointer({ clientX: 80, clientY: 80 }));
    interaction.startResize(shape, "se", pointer({ clientX: 80, clientY: 80 }));
    interaction.onPointerUp(pointer({ clientX: 80, clientY: 80 }));

    expect(editor.history.batching).toBe(false);
  });
});

describe("abandoning a gesture leaves no trace", () => {
  test("escape mid-drag puts the shape back and records nothing", () => {
    const { editor, interaction, shape } = harness();
    const before = editor.history.undoSize;

    interaction.onPointerDown(pointer());
    interaction.onPointerMove(pointer({ clientX: 150, clientY: 150 }));
    expect(visualOf(editor, shape)).toMatchObject({ x: 100, y: 100 });

    interaction.onKeyDown(keyboard("Escape"));
    interaction.onPointerUp(pointer({ clientX: 150, clientY: 150 }));

    expect(editor.history.batching).toBe(false);
    expect(editor.history.undoSize).toBe(before);
    expect(editor.canRedo()).toBe(false);
    expect(visualOf(editor, shape)).toMatchObject({ x: 0, y: 0 });
  });

  test("escape mid-resize restores the original box", () => {
    const { editor, interaction, shape } = harness();
    const before = editor.history.undoSize;

    interaction.startResize(shape, "se", pointer());
    interaction.onPointerMove(pointer({ clientX: 200, clientY: 200 }));
    expect(visualOf(editor, shape)).toMatchObject({ width: 250 });

    interaction.onKeyDown(keyboard("Escape"));
    interaction.onPointerUp(pointer({ clientX: 200, clientY: 200 }));

    expect(editor.history.batching).toBe(false);
    expect(editor.history.undoSize).toBe(before);
    expect(visualOf(editor, shape)).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });

  test("escape returns to the select tool and clears the selection", () => {
    const { editor, interaction, tool } = harness();
    interaction.onKeyDown(keyboard("Escape"));
    expect(editor.selection.size).toBe(0);
    expect(tool()).toBe("select");
  });

  test("a cancelled pointer reverts the drag it was in the middle of", () => {
    const { editor, interaction, shape } = harness();
    const before = editor.history.undoSize;

    interaction.onPointerDown(pointer());
    interaction.onPointerMove(pointer({ clientX: 150, clientY: 150 }));
    interaction.onPointerCancel(pointer({ clientX: 150, clientY: 150 }));

    expect(editor.history.batching).toBe(false);
    expect(editor.history.undoSize).toBe(before);
    expect(visualOf(editor, shape)).toMatchObject({ x: 0, y: 0 });
  });
});

function wheel(input: {
  deltaY?: number;
  deltaX?: number;
  ctrlKey?: boolean;
  clientX?: number;
  clientY?: number;
}): WheelEvent {
  return {
    deltaX: input.deltaX ?? 0,
    deltaY: input.deltaY ?? 0,
    deltaMode: 0,
    ctrlKey: input.ctrlKey ?? false,
    metaKey: false,
    clientX: input.clientX ?? 0,
    clientY: input.clientY ?? 0,
    preventDefault: () => {},
  } as unknown as WheelEvent;
}

// The steps of the manual checklist in `apps/desktop/README.md` that need no
// browser. What is left there is what only a browser can supply: real hit
// areas, cursors, pointer capture and focus.
describe("checklist behaviour, driven headlessly", () => {
  test("step 2/5: empty-canvas drags brush; the hand tool pans", () => {
    const empty = new Editor();
    const { interaction } = interactionFor(empty, "select");

    // With the select tool, dragging empty canvas is a marquee, not a pan.
    interaction.onPointerDown(pointer({ clientX: 0, clientY: 0 }));
    interaction.onPointerMove(pointer({ clientX: 40, clientY: 25 }));
    expect(interaction.marquee()).toEqual({
      x: 0,
      y: 0,
      width: 40,
      height: 25,
    });
    interaction.onPointerUp(pointer({ clientX: 40, clientY: 25 }));
    expect(empty.camera.get()).toMatchObject({ x: 0, y: 0 });

    // The hand tool pans even when the drag starts over a shape.
    const held = harness();
    const hand = interactionFor(held.editor, "hand");
    hand.interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    hand.interaction.onPointerMove(pointer({ clientX: 60, clientY: 50 }));
    hand.interaction.onPointerUp(pointer({ clientX: 60, clientY: 50 }));
    expect(held.editor.camera.get().x).toBe(10);
    expect(visualOf(held.editor, held.shape)).toMatchObject({ x: 0, y: 0 });
  });

  test("step 3: ctrl + wheel zooms about the pointer and clamps", () => {
    const { editor, interaction } = harness();
    const anchor = { clientX: 200, clientY: 120 };
    const before = editor.camera.screenToPage({ x: 200, y: 120 });

    interaction.onWheel(wheel({ deltaY: -200, ctrlKey: true, ...anchor }));
    expect(editor.camera.get().z).toBeGreaterThan(1);
    const after = editor.camera.screenToPage({ x: 200, y: 120 });
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);

    for (let i = 0; i < 40; i += 1) {
      interaction.onWheel(wheel({ deltaY: -400, ctrlKey: true, ...anchor }));
    }
    expect(editor.camera.get().z).toBe(8);
    for (let i = 0; i < 80; i += 1) {
      interaction.onWheel(wheel({ deltaY: 400, ctrlKey: true, ...anchor }));
    }
    expect(editor.camera.get().z).toBeCloseTo(0.1, 10);
  });

  test("step 4: a plain wheel pans without zooming", () => {
    const { editor, interaction } = harness();
    interaction.onWheel(wheel({ deltaY: 30, deltaX: 10 }));
    expect(editor.camera.get()).toMatchObject({ x: -10, y: -30, z: 1 });
  });

  test("step 6/7: click selects, shift-click extends", () => {
    const { editor, interaction, shape } = harness();
    const other = editor.createElement("shape.geo", {
      visual: { x: 400, y: 0, width: 100, height: 100 },
    });
    editor.selection.clear();

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 50, clientY: 50 }));
    expect([...editor.selection.ids()]).toEqual([shape]);

    interaction.onPointerDown(
      pointer({ clientX: 450, clientY: 50, shiftKey: true }),
    );
    interaction.onPointerUp(pointer({ clientX: 450, clientY: 50 }));
    expect(editor.selection.size).toBe(2);
    expect(editor.selection.has(other)).toBe(true);

    // Clicking empty canvas drops the selection.
    interaction.onPointerDown(pointer({ clientX: 900, clientY: 900 }));
    interaction.onPointerUp(pointer({ clientX: 900, clientY: 900 }));
    expect(editor.selection.size).toBe(0);
  });

  test("step 11/12: a creation tool places centred, selects, and resets", () => {
    const empty = new Editor();
    const { interaction, tool, setTool } = interactionFor(empty, "geo:ellipse");

    interaction.onPointerDown(pointer({ clientX: 300, clientY: 200 }));
    interaction.onPointerUp(pointer({ clientX: 300, clientY: 200 }));

    expect(empty.store.size).toBe(1);
    const [placed] = empty.store.listElements();
    if (!placed) {
      throw new Error("expected a placed element");
    }
    const box = empty.getBounds(placed.id);
    if (!box) {
      throw new Error("expected the placed element to have bounds");
    }
    expect(box.x + box.width / 2).toBeCloseTo(300, 6);
    expect(box.y + box.height / 2).toBeCloseTo(200, 6);
    expect(placed.semantic).toMatchObject({ geo: "ellipse" });
    expect([...empty.selection.ids()]).toEqual([placed.id]);
    expect(tool()).toBe("select");

    // The registry's default payload is used for the semantic element tools.
    setTool("erd.table");
    interaction.onPointerDown(pointer({ clientX: 700, clientY: 400 }));
    interaction.onPointerUp(pointer({ clientX: 700, clientY: 400 }));
    const table = empty.store
      .listElements()
      .find((element) => element.type === "erd.table");
    expect(table?.semantic).toMatchObject({ tableName: "table" });
  });

  test("step 13/14: the edge tool connects shapes or ends freely on canvas", () => {
    const { editor, shape } = harness();
    const other = editor.createElement("shape.geo", {
      visual: { x: 400, y: 0, width: 100, height: 100 },
    });
    const { interaction } = interactionFor(editor, "edge");

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    expect(interaction.pending()).not.toBeNull();
    interaction.onPointerMove(pointer({ clientX: 450, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 450, clientY: 50 }));

    const edges = editor.store
      .listElements()
      .filter((element) => element.type === "edge.generic");
    expect(edges).toHaveLength(1);
    expect(edges[0]?.semantic).toMatchObject({ from: shape, to: other });
    expect(interaction.pending()).toBeNull();

    // Empty canvas creates a free end; returning to the source creates nothing.
    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 900, clientY: 900 }));
    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 60, clientY: 60 }));
    expect(
      editor.store.listElements().filter((el) => el.type === "edge.generic"),
    ).toHaveLength(2);
  });

  test("sequence tools place participants and edge gestures create messages", () => {
    const editor = new Editor();
    const controls = interactionFor(editor, "sequence.actor");
    controls.interaction.onPointerDown(pointer({ clientX: 100, clientY: 80 }));
    controls.interaction.onPointerUp(pointer({ clientX: 100, clientY: 80 }));
    controls.setTool("sequence.service");
    controls.interaction.onPointerDown(
      pointer({ pointerId: 2, clientX: 340, clientY: 80 }),
    );
    controls.interaction.onPointerUp(
      pointer({ pointerId: 2, clientX: 340, clientY: 80 }),
    );
    const participants = editor.store
      .listElements()
      .filter((element) => element.type === "sequence.participant");
    expect(participants.map((element) => element.semantic)).toEqual([
      expect.objectContaining({ kind: "actor", name: "Actor 1" }),
      expect.objectContaining({ kind: "service", name: "Service 1" }),
    ]);

    controls.setTool("edge");
    controls.interaction.onPointerDown(
      pointer({ pointerId: 3, clientX: 100, clientY: 80 }),
    );
    controls.interaction.onPointerMove(
      pointer({ pointerId: 3, clientX: 340, clientY: 80 }),
    );
    controls.interaction.onPointerUp(
      pointer({ pointerId: 3, clientX: 340, clientY: 80 }),
    );
    const message = editor.store
      .listElements()
      .find((element) => element.type === "sequence.message");
    expect(message?.semantic).toMatchObject({
      from: participants[0]?.id,
      to: participants[1]?.id,
      kind: "sync",
      label: "Message",
    });
    expect(message?.visual.y).toBeGreaterThan(80);
  });

  test("step 16: delete takes the connectors with the shape", () => {
    const { editor, interaction, shape } = harness();
    const other = editor.createElement("shape.geo", {
      visual: { x: 400, y: 0, width: 100, height: 100 },
    });
    const edge = editor.connect(shape, other);
    expect(edge).not.toBeNull();

    editor.selection.set([shape]);
    interaction.onKeyDown(keyboard("Delete"));

    expect(editor.store.has(shape)).toBe(false);
    expect(editor.store.has(edge as ElementId)).toBe(false);
    expect(editor.store.has(other)).toBe(true);
    expect(editor.selection.size).toBe(0);

    // Step 17: one undo brings both back.
    interaction.onKeyDown(shortcut("z"));
    expect(editor.store.has(shape)).toBe(true);
    expect(editor.store.has(edge as ElementId)).toBe(true);
  });

  test("step 17/18: the undo and redo shortcuts both work", () => {
    const { editor, interaction, shape } = harness();
    interaction.onPointerDown(pointer());
    interaction.onPointerMove(pointer({ clientX: 90, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 90, clientY: 50 }));
    expect(visualOf(editor, shape)).toMatchObject({ x: 40 });

    interaction.onKeyDown(shortcut("z"));
    expect(visualOf(editor, shape)).toMatchObject({ x: 0 });
    interaction.onKeyDown(shortcut("z", true));
    expect(visualOf(editor, shape)).toMatchObject({ x: 40 });
    interaction.onKeyDown(shortcut("z"));
    interaction.onKeyDown(shortcut("y"));
    expect(visualOf(editor, shape)).toMatchObject({ x: 40 });
  });
});

describe("pointer ownership is released with the gesture, not the button", () => {
  test("a fresh pointer can act after Escape ended the previous gesture", () => {
    const { editor, interaction, shape } = harness();

    // Pointer 1 starts a drag and abandons it, but never lifts.
    interaction.onPointerDown(pointer({ pointerId: 1 }));
    interaction.onPointerMove(pointer({ pointerId: 1, clientX: 150 }));
    interaction.onKeyDown(keyboard("Escape"));

    // A touch device's next contact always brings a new id; the canvas must
    // not be wedged waiting for a finger that already lifted unnoticed.
    editor.selection.set([shape]);
    interaction.onPointerDown(pointer({ pointerId: 7 }));
    interaction.onPointerMove(pointer({ pointerId: 7, clientX: 80 }));
    interaction.onPointerUp(pointer({ pointerId: 7, clientX: 80 }));

    expect(editor.history.batching).toBe(false);
    expect(visualOf(editor, shape)).toMatchObject({ x: 30, y: 0 });
  });

  test("a fresh pointer still cannot interrupt a gesture in flight", () => {
    const { editor, interaction, shape } = harness();

    interaction.onPointerDown(pointer({ pointerId: 1 }));
    interaction.onPointerMove(pointer({ pointerId: 1, clientX: 90 }));
    // Mid-drag, so the batch is open: this contact must be refused.
    interaction.onPointerDown(pointer({ pointerId: 7, clientX: 400 }));
    interaction.onPointerMove(pointer({ pointerId: 7, clientX: 400 }));
    interaction.onPointerUp(pointer({ pointerId: 1, clientX: 90 }));

    expect(editor.history.batching).toBe(false);
    expect(visualOf(editor, shape)).toMatchObject({ x: 40, y: 0 });
  });
});
