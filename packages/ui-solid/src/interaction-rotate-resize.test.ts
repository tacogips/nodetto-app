import { describe, expect, test } from "bun:test";
import { compareFractional, Editor } from "@nodetto/core";
import { exportD2, exportMermaid } from "@nodetto/io";
import {
  MIN_SHAPE_SIZE,
  RESIZE_HANDLES,
  resizeBox,
  resizeBoxConstrained,
  resizeRotatedBox,
  resizeHandlesFor,
} from "./interaction.ts";
import {
  interactionFor,
  harness,
  pointer,
  keyboard,
  visualOf,
} from "./interaction-test-helpers.ts";

const START = { x: 100, y: 100, width: 200, height: 100 };

describe("pointer rotation", () => {
  test("connect gestures target rotated drawing geometry instead of old bounds", () => {
    const editor = new Editor();
    const a = editor.createElement("node.generic", {
      visual: { x: 0, y: 300, width: 100, height: 50 },
    });
    const b = editor.createElement("node.generic", {
      visual: { x: 100, y: 100, width: 200, height: 40, rotation: 90 },
    });
    const { interaction } = interactionFor(editor, "select");
    interaction.startConnect(a, pointer({ clientX: 50, clientY: 290 }));
    interaction.onPointerMove(pointer({ clientX: 110, clientY: 110 }));
    expect(interaction.hoverTarget()).toBeNull();
    interaction.onPointerMove(pointer({ clientX: 200, clientY: 40 }));
    expect(interaction.hoverTarget()).toBe(b);
    interaction.onPointerUp(pointer({ clientX: 200, clientY: 40 }));
    const edge = editor.store
      .listElements()
      .find((element) => element.type === "edge.generic");
    expect(edge?.semantic).toMatchObject({ from: a, to: b });
    editor.undo();
    expect(
      editor.store
        .listElements()
        .some((element) => element.type === "edge.generic"),
    ).toBe(false);
  });

  test("reconnection can land on a rotated layer outside its original bounds", () => {
    const editor = new Editor();
    const a = editor.createElement("node.generic", {
      visual: { x: 0, y: 300 },
    });
    const b = editor.createElement("node.generic", {
      visual: { x: 400, y: 300 },
    });
    const c = editor.createElement("node.generic", {
      visual: { x: 100, y: 100, width: 200, height: 40, rotation: 90 },
    });
    const edge = editor.connectSmart(a, b);
    if (!edge) throw new Error("expected edge");
    const { interaction } = interactionFor(editor, "select");
    interaction.startReconnect(
      edge,
      "to",
      pointer({ clientX: 400, clientY: 350 }),
    );
    interaction.onPointerUp(pointer({ clientX: 200, clientY: 40 }));
    expect(editor.store.get(edge)?.semantic).toMatchObject({ from: a, to: c });
  });

  test("marquee selects the rotated shape outside its original box", () => {
    const { editor, interaction, shape } = harness();
    editor.apply([
      {
        type: "updateVisual",
        id: shape,
        visual: { x: 100, y: 100, width: 200, height: 40, rotation: 90 },
      },
    ]);
    editor.selection.clear();
    interaction.onPointerDown(pointer({ clientX: 170, clientY: 10 }));
    interaction.onPointerMove(pointer({ clientX: 210, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 210, clientY: 50 }));
    expect([...editor.selection.ids()]).toEqual([shape]);
  });
  test("rotated resize follows local axes and undoes atomically", () => {
    const { editor, interaction, shape } = harness();
    editor.apply([
      { type: "updateVisual", id: shape, visual: { rotation: 90 } },
    ]);
    const before = editor.getSnapshot();
    interaction.startResize(shape, "e", pointer({ clientX: 50, clientY: 100 }));
    interaction.onPointerMove(pointer({ clientX: 50, clientY: 150 }));
    interaction.onPointerUp(pointer({ clientX: 50, clientY: 150 }));
    expect(visualOf(editor, shape)).toMatchObject({
      x: -25,
      y: 25,
      width: 150,
      height: 100,
      rotation: 90,
    });
    editor.undo();
    expect(editor.getSnapshot()).toEqual(before);
  });

  test("rotated resize respects center and aspect modifiers", () => {
    const start = { x: 0, y: 0, width: 100, height: 50 };
    const resized = resizeRotatedBox(start, "e", 0, 25, 90, {
      keepAspect: true,
      fromCenter: true,
    });
    expect(resized.width).toBeCloseTo(150);
    expect(resized.height).toBeCloseTo(75);
    expect(resized.x + resized.width / 2).toBeCloseTo(50);
    expect(resized.y + resized.height / 2).toBeCloseTo(25);
    expect(resizeRotatedBox(start, "se", 10, 20, 0)).toEqual(
      resizeBoxConstrained(start, "se", 10, 20),
    );
  });

  test("diagonal resize keeps the opposite corner fixed in page space", () => {
    const start = { x: 10, y: 20, width: 100, height: 60 };
    const angle = Math.PI / 4;
    const next = resizeRotatedBox(start, "se", 20, 40, 45);
    const corner = (box: typeof start) => ({
      x:
        box.x +
        box.width / 2 -
        (box.width / 2) * Math.cos(angle) +
        (box.height / 2) * Math.sin(angle),
      y:
        box.y +
        box.height / 2 -
        (box.width / 2) * Math.sin(angle) -
        (box.height / 2) * Math.cos(angle),
    });
    expect(corner(next).x).toBeCloseTo(corner(start).x);
    expect(corner(next).y).toBeCloseTo(corner(start).y);
  });

  test("multiple moves form one undo step", () => {
    const { editor, interaction, shape } = harness();
    const before = editor.history.undoSize;
    interaction.startRotate(shape, pointer({ clientX: 50, clientY: -30 }));
    interaction.onPointerMove(pointer({ clientX: 130, clientY: 50 }));
    expect(visualOf(editor, shape).rotation).toBe(90);
    interaction.onPointerMove(pointer({ clientX: 50, clientY: 130 }));
    interaction.onPointerUp(pointer({ clientX: 50, clientY: 130 }));
    expect(visualOf(editor, shape).rotation).toBe(180);
    expect(editor.history.batching).toBe(false);
    expect(editor.history.undoSize).toBe(before + 1);
    editor.undo();
    expect(visualOf(editor, shape).rotation).toBeUndefined();
  });

  test("shift snaps angle and Escape discards the whole gesture", () => {
    const { editor, interaction, shape } = harness();
    const before = editor.history.undoSize;
    interaction.startRotate(shape, pointer({ clientX: 50, clientY: -30 }));
    interaction.onPointerMove(
      pointer({ clientX: 130, clientY: 60, shiftKey: true }),
    );
    expect(visualOf(editor, shape).rotation).toBe(90);
    interaction.onKeyDown(keyboard("Escape"));
    expect(visualOf(editor, shape).rotation).toBeUndefined();
    expect(editor.history.batching).toBe(false);
    expect(editor.history.undoSize).toBe(before);
  });

  test("multi-selection rotation batches incremental moves and Escape restores all", () => {
    const editor = new Editor();
    const left = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const right = editor.createElement("shape.geo", {
      visual: { x: 200, y: 0, width: 100, height: 100 },
    });
    editor.selection.set([left, right]);
    const { interaction } = interactionFor(editor, "select");
    const before = editor.getSnapshot();
    const undoSize = editor.history.undoSize;

    interaction.startRotateSelection(
      { x: 150, y: 50 },
      pointer({ clientX: 150, clientY: -50 }),
    );
    interaction.onPointerMove(pointer({ clientX: 250, clientY: 50 }));
    expect(visualOf(editor, left)).toMatchObject({
      x: 100,
      y: -100,
      rotation: 90,
    });
    interaction.onPointerMove(pointer({ clientX: 150, clientY: 150 }));
    interaction.onPointerUp(pointer({ clientX: 150, clientY: 150 }));
    expect(visualOf(editor, left).rotation).toBe(180);
    expect(visualOf(editor, right).rotation).toBe(180);
    expect(editor.history.undoSize).toBe(undoSize + 1);
    expect(editor.undo()).toBe(true);
    expect(editor.getSnapshot()).toEqual(before);

    interaction.startRotateSelection(
      { x: 150, y: 50 },
      pointer({ clientX: 150, clientY: -50 }),
    );
    interaction.onPointerMove(
      pointer({ clientX: 249, clientY: 60, shiftKey: true }),
    );
    expect(visualOf(editor, left).rotation).toBe(90);
    interaction.onKeyDown(keyboard("Escape"));
    expect(editor.getSnapshot()).toEqual(before);
    expect(editor.history.undoSize).toBe(undoSize);
  });

  test("unrelated pointers cannot rotate or cancel the owner's drag", () => {
    const { editor, interaction, shape } = harness();
    interaction.startRotate(
      shape,
      pointer({ pointerId: 1, clientX: 50, clientY: -30 }),
    );
    interaction.onPointerMove(
      pointer({ pointerId: 2, clientX: 130, clientY: 50 }),
    );
    interaction.onPointerCancel(pointer({ pointerId: 2 }));
    expect(visualOf(editor, shape).rotation).toBeUndefined();
    expect(editor.history.batching).toBe(true);
    interaction.onPointerMove(
      pointer({ pointerId: 1, clientX: 130, clientY: 50 }),
    );
    interaction.onPointerCancel(pointer({ pointerId: 1 }));
    expect(visualOf(editor, shape).rotation).toBeUndefined();
    expect(editor.history.batching).toBe(false);
  });

  test("locked layers and center presses never open a batch", () => {
    const { editor, interaction, shape } = harness();
    interaction.startRotate(shape, pointer({ clientX: 50, clientY: 50 }));
    expect(editor.history.batching).toBe(false);
    editor.apply([
      { type: "updateVisual", id: shape, visual: { locked: true } },
    ]);
    interaction.startRotate(shape, pointer({ clientX: 50, clientY: -30 }));
    expect(editor.history.batching).toBe(false);
  });

  test("group rotation batches descendant transforms and Escape restores them", () => {
    const editor = new Editor();
    const left = editor.buildElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 50 },
    });
    const right = editor.buildElement("shape.geo", {
      visual: { x: 200, y: 0, width: 100, height: 50 },
    });
    const group = editor.buildElement("group", {
      semantic: { memberIds: [left.id, right.id] },
    });
    editor.apply(
      [left, right, group].map((element) => ({
        type: "createElement" as const,
        element,
      })),
    );
    editor.selection.set([group.id]);
    const before = editor.getSnapshot();
    const beforeUndo = editor.history.undoSize;
    const { interaction } = interactionFor(editor, "select");

    interaction.startRotate(group.id, pointer({ clientX: 150, clientY: -75 }));
    interaction.onPointerMove(pointer({ clientX: 250, clientY: 25 }));
    expect(editor.store.get(group.id)?.visual.rotation).toBe(90);
    expect(editor.store.get(left.id)?.visual).toMatchObject({
      x: 100,
      y: -100,
      rotation: 90,
    });
    interaction.onPointerMove(pointer({ clientX: 150, clientY: 125 }));
    expect(editor.store.get(group.id)?.visual.rotation).toBe(180);
    interaction.onKeyDown(keyboard("Escape"));

    expect(editor.getSnapshot()).toEqual(before);
    expect(editor.history.batching).toBe(false);
    expect(editor.history.undoSize).toBe(beforeUndo);
    interaction.onPointerUp(pointer({ clientX: 150, clientY: 125 }));
  });

  test("frame rotation uses the shared gesture and cancels hierarchy changes", () => {
    const editor = new Editor();
    const child = editor.buildElement("shape.geo", {
      visual: { x: 20, y: 20, width: 40, height: 20 },
    });
    const frame = editor.buildElement("frame", {
      semantic: { name: "Screen", memberIds: [child.id] },
      visual: { x: 0, y: 0, width: 200, height: 100 },
    });
    editor.apply(
      [frame, child].map((element) => ({
        type: "createElement" as const,
        element,
      })),
    );
    editor.selection.set([frame.id]);
    const before = editor.getSnapshot();
    const beforeUndo = editor.history.undoSize;
    const { interaction } = interactionFor(editor, "select");

    interaction.startRotate(frame.id, pointer({ clientX: 100, clientY: -30 }));
    interaction.onPointerMove(pointer({ clientX: 180, clientY: 50 }));
    expect(editor.store.get(frame.id)?.visual.rotation).toBe(90);
    expect(editor.store.get(child.id)?.visual).toMatchObject({
      x: 100,
      y: -20,
      rotation: 90,
    });
    interaction.onKeyDown(keyboard("Escape"));

    expect(editor.getSnapshot()).toEqual(before);
    expect(editor.history.undoSize).toBe(beforeUndo);
  });

  test("rotated engineering boxes resize only along their local width axis", () => {
    expect(resizeHandlesFor("erd.table")).toEqual(["e", "w"]);
    expect(resizeHandlesFor("uml.class")).toEqual(["e", "w"]);
    expect(resizeHandlesFor("frame")).toEqual(RESIZE_HANDLES);
    const editor = new Editor();
    const table = editor.createElement("erd.table", {
      visual: { x: 0, y: 0, width: 240, rotation: 90 },
    });
    const before = editor.getSnapshot();
    const beforeUndo = editor.history.undoSize;
    const { interaction } = interactionFor(editor, "select");

    interaction.startResize(table, "n", pointer({ clientX: 0, clientY: 0 }));
    expect(editor.history.batching).toBe(false);
    interaction.startResize(table, "e", pointer({ clientX: 0, clientY: 0 }));
    interaction.onPointerMove(
      pointer({ clientX: 0, clientY: 40, shiftKey: true }),
    );
    expect(visualOf(editor, table)).toMatchObject({
      x: -20,
      y: 20,
      width: 280,
      rotation: 90,
    });
    expect(visualOf(editor, table).height).toBeUndefined();
    interaction.onPointerUp(pointer({ clientX: 0, clientY: 40 }));
    expect(editor.history.undoSize).toBe(beforeUndo + 1);
    editor.undo();
    expect(editor.getSnapshot()).toEqual(before);

    interaction.startResize(table, "e", pointer({ clientX: 0, clientY: 0 }));
    interaction.onPointerMove(
      pointer({ clientX: 0, clientY: 40, altKey: true }),
    );
    interaction.onPointerUp(pointer({ clientX: 0, clientY: 40 }));
    expect(visualOf(editor, table)).toMatchObject({
      x: -40,
      y: 0,
      width: 320,
      rotation: 90,
    });
  });

  test("multi-selection resize batches live scaling and Escape restores all", () => {
    const editor = new Editor();
    const left = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const right = editor.createElement("shape.geo", {
      visual: { x: 200, y: 0, width: 100, height: 100 },
    });
    editor.selection.set([left, right]);
    const { interaction } = interactionFor(editor, "select");
    const before = editor.getSnapshot();
    const undoSize = editor.history.undoSize;

    interaction.startResizeSelection(
      "se",
      pointer({ clientX: 300, clientY: 100 }),
    );
    interaction.onPointerMove(pointer({ clientX: 450, clientY: 150 }));
    expect(visualOf(editor, left)).toMatchObject({
      width: 150,
      height: 150,
    });
    interaction.onPointerMove(pointer({ clientX: 600, clientY: 200 }));
    interaction.onPointerUp(pointer({ clientX: 600, clientY: 200 }));
    expect(visualOf(editor, left)).toMatchObject({
      x: 0,
      width: 200,
      height: 200,
    });
    expect(visualOf(editor, right)).toMatchObject({
      x: 400,
      width: 200,
      height: 200,
    });
    expect(editor.history.undoSize).toBe(undoSize + 1);
    expect(editor.undo()).toBe(true);
    expect(editor.getSnapshot()).toEqual(before);

    interaction.startResizeSelection(
      "e",
      pointer({ clientX: 300, clientY: 50 }),
    );
    interaction.onPointerMove(
      pointer({ clientX: 450, clientY: 50, altKey: true }),
    );
    expect(visualOf(editor, left).x).toBe(-150);
    interaction.onKeyDown(keyboard("Escape"));
    expect(editor.getSnapshot()).toEqual(before);
    expect(editor.history.undoSize).toBe(undoSize);
  });
});

describe("sequence reorder gestures", () => {
  test("participant drag crosses several slots and undoes atomically", () => {
    const editor = new Editor();
    const actor = editor.createSequenceParticipant("actor", { x: 100, y: 80 });
    const service = editor.createSequenceParticipant("service", {
      x: 340,
      y: 80,
    });
    const database = editor.createSequenceParticipant("db", {
      x: 580,
      y: 80,
    });
    const before = editor.getSnapshot();
    const beforeUndo = editor.history.undoSize;
    const { interaction } = interactionFor(editor, "select");

    interaction.onPointerDown(pointer({ clientX: 580, clientY: 80 }));
    interaction.onPointerMove(pointer({ clientX: 100, clientY: 80 }));
    interaction.onPointerUp(pointer({ clientX: 100, clientY: 80 }));

    const ordered = editor.store
      .getPageElements(editor.currentPageId)
      .filter((element) => element.type === "sequence.participant")
      .sort((left, right) =>
        compareFractional(
          (left.semantic as { order: string }).order,
          (right.semantic as { order: string }).order,
        ),
      );
    expect(ordered.map((element) => element.id)).toEqual([
      database,
      actor,
      service,
    ]);
    expect(ordered.map((element) => element.visual.x)).toEqual([20, 260, 500]);
    const mermaid = exportMermaid(
      editor.getSnapshot(),
      editor.currentPageId,
      "sequenceDiagram",
    ).code;
    const d2 = exportD2(editor.getSnapshot(), editor.currentPageId).code;
    expect(mermaid.indexOf("Database 1")).toBeLessThan(
      mermaid.indexOf("Actor 1"),
    );
    expect(d2.indexOf("Database 1")).toBeLessThan(d2.indexOf("Actor 1"));
    expect(editor.history.undoSize).toBe(beforeUndo + 1);
    expect(editor.undo()).toBe(true);
    expect(editor.getSnapshot()).toEqual(before);
  });

  test("message drag changes time order and Escape restores every crossed slot", () => {
    const editor = new Editor();
    const actor = editor.createSequenceParticipant("actor", { x: 100, y: 80 });
    const service = editor.createSequenceParticipant("service", {
      x: 340,
      y: 80,
    });
    const first = editor.connectSmart(actor, service) as string;
    const second = editor.connectSmart(service, actor) as string;
    const third = editor.connectSmart(actor, service) as string;
    const before = editor.getSnapshot();
    const beforeUndo = editor.history.undoSize;
    const { interaction } = interactionFor(editor, "select");

    interaction.onPointerDown(
      pointer({ clientX: 220, clientY: editor.store.get(third)?.visual.y }),
    );
    interaction.onPointerMove(
      pointer({ clientX: 220, clientY: editor.store.get(first)?.visual.y }),
    );
    expect(
      (editor.store.get(third)?.semantic as { order: string }).order <
        (editor.store.get(first)?.semantic as { order: string }).order,
    ).toBe(true);
    interaction.onKeyDown(keyboard("Escape"));
    expect(editor.getSnapshot()).toEqual(before);
    expect(editor.history.undoSize).toBe(beforeUndo);
    interaction.onPointerUp(pointer({ clientX: 220, clientY: 216 }));
    expect(editor.history.batching).toBe(false);
    expect(editor.store.has(second)).toBe(true);
  });
});

describe("resizeBox", () => {
  test("moves only the edges the handle owns", () => {
    expect(resizeBox(START, "e", 50, 999)).toEqual({
      x: 100,
      y: 100,
      width: 250,
      height: 100,
    });
    expect(resizeBox(START, "n", 999, -20)).toEqual({
      x: 100,
      y: 80,
      width: 200,
      height: 120,
    });
  });

  test("a corner handle moves both of its edges", () => {
    expect(resizeBox(START, "se", 20, 30)).toEqual({
      x: 100,
      y: 100,
      width: 220,
      height: 130,
    });
    expect(resizeBox(START, "nw", 20, 30)).toEqual({
      x: 120,
      y: 130,
      width: 180,
      height: 70,
    });
  });

  test("normalizes a drag past the opposite edge", () => {
    const flipped = resizeBox(START, "e", -300, 0);
    expect(flipped.x).toBeLessThan(START.x);
    expect(flipped.width).toBeGreaterThan(0);
    expect(flipped.height).toBe(100);
  });

  test("never goes below the minimum size", () => {
    const tiny = resizeBox(START, "se", -1000, -1000);
    expect(tiny.width).toBeGreaterThanOrEqual(MIN_SHAPE_SIZE);
    expect(tiny.height).toBeGreaterThanOrEqual(MIN_SHAPE_SIZE);
  });
});

describe("resizeBoxConstrained", () => {
  test("without modifiers it is resizeBox", () => {
    expect(resizeBoxConstrained(START, "se", 20, 30)).toEqual(
      resizeBox(START, "se", 20, 30),
    );
    expect(resizeBoxConstrained(START, "nw", 20, 30)).toEqual(
      resizeBox(START, "nw", 20, 30),
    );
  });

  test("keepAspect follows the dominant axis and pins the opposite side", () => {
    // START is 200x100 at (100,100): aspect 2.
    expect(
      resizeBoxConstrained(START, "e", 100, 0, { keepAspect: true }),
    ).toEqual({ x: 100, y: 75, width: 300, height: 150 });
    expect(
      resizeBoxConstrained(START, "se", 100, 0, { keepAspect: true }),
    ).toEqual({ x: 100, y: 100, width: 300, height: 150 });
    expect(
      resizeBoxConstrained(START, "nw", 0, -100, { keepAspect: true }),
    ).toEqual({ x: -100, y: 0, width: 400, height: 200 });
  });

  test("uses an explicit persisted ratio", () => {
    expect(
      resizeBoxConstrained(START, "e", 100, 0, {
        keepAspect: true,
        aspectRatio: 4,
      }),
    ).toEqual({ x: 100, y: 112.5, width: 300, height: 75 });
  });

  test("fromCenter mirrors the owned edge onto its opposite", () => {
    expect(
      resizeBoxConstrained(START, "e", 50, 0, { fromCenter: true }),
    ).toEqual({ x: 50, y: 100, width: 300, height: 100 });
    expect(
      resizeBoxConstrained(START, "n", 0, -10, { fromCenter: true }),
    ).toEqual({ x: 100, y: 90, width: 200, height: 120 });
  });

  test("both together scale about the centre", () => {
    expect(
      resizeBoxConstrained(START, "se", 100, 0, {
        keepAspect: true,
        fromCenter: true,
      }),
    ).toEqual({ x: 0, y: 50, width: 400, height: 200 });
  });

  test("still respects the minimum size", () => {
    const tiny = resizeBoxConstrained(START, "se", -1000, -1000, {
      keepAspect: true,
      fromCenter: true,
    });
    expect(tiny.width).toBeGreaterThanOrEqual(MIN_SHAPE_SIZE);
    expect(tiny.height).toBeGreaterThanOrEqual(MIN_SHAPE_SIZE);
  });
});
