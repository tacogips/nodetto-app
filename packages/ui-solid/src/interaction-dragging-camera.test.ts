import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  interactionFor,
  harness,
  pointer,
  mouse,
  keyboard,
  visualOf,
} from "./interaction-test-helpers.ts";

describe("frame-paced model dragging", () => {
  function setup() {
    const { editor, shape } = harness();
    const callbacks = new Set<() => void>();
    const { interaction } = interactionFor(editor, "select", {
      scheduleDragFrame: (callback) => {
        callbacks.add(callback);
        return () => {
          callbacks.delete(callback);
        };
      },
    });
    const frame = () => {
      const pending = [...callbacks];
      callbacks.clear();
      for (const callback of pending) callback();
    };
    return { editor, shape, interaction, callbacks, frame };
  }

  test("a burst commits only the latest move per frame and preserves drop/undo", () => {
    const { editor, shape, interaction, callbacks, frame } = setup();
    let commits = 0;
    editor.store.subscribe(() => {
      commits += 1;
    });
    const undoSize = editor.history.undoSize;
    interaction.onPointerDown(pointer());
    for (let x = 51; x <= 150; x++) {
      interaction.onPointerMove(pointer({ clientX: x }));
    }
    expect(commits).toBe(0);
    expect(callbacks.size).toBe(1);
    frame();
    expect(commits).toBe(1);
    expect(visualOf(editor, shape).x).toBe(100);
    interaction.onPointerMove(pointer({ clientX: 180 }));
    interaction.onPointerUp(pointer({ clientX: 200 }));
    expect(visualOf(editor, shape).x).toBe(150);
    expect(commits).toBe(2);
    expect(callbacks.size).toBe(0);
    frame();
    expect(commits).toBe(2);
    expect(editor.history.undoSize).toBe(undoSize + 1);
    editor.undo();
    expect(visualOf(editor, shape).x).toBe(0);
    editor.redo();
    expect(visualOf(editor, shape).x).toBe(150);
  });

  for (const selection of [false, true]) {
    test(`resize paints before release and keeps final size/undo (selection=${selection})`, () => {
      const { editor, shape, interaction, frame, callbacks } = setup();
      if (selection) {
        const second = editor.createElement("node.generic", {
          visual: { x: 150, y: 0, width: 50, height: 100 },
        });
        editor.selection.set([shape, second]);
        interaction.startResizeSelection(
          "se",
          pointer({ clientX: 200, clientY: 100 }),
        );
      } else {
        interaction.startResize(
          shape,
          "se",
          pointer({ clientX: 100, clientY: 100 }),
        );
      }
      const undoSize = editor.history.undoSize;
      let commits = 0;
      editor.store.subscribe(() => {
        commits += 1;
      });
      const edge = selection ? 200 : 100;
      for (let x = edge + 1; x <= edge + 100; x++) {
        interaction.onPointerMove(pointer({ clientX: x, clientY: 150 }));
      }
      expect(commits).toBe(0);
      expect(callbacks.size).toBe(1);
      frame();
      expect(commits).toBe(1);
      expect(visualOf(editor, shape).width).toBe(selection ? 150 : 200);
      expect(editor.history.undoSize).toBe(undoSize);
      interaction.onPointerMove(pointer({ clientX: edge + 150, clientY: 180 }));
      interaction.onPointerUp(pointer({ clientX: edge + 200, clientY: 200 }));
      expect(visualOf(editor, shape).width).toBe(selection ? 200 : 300);
      expect(callbacks.size).toBe(0);
      expect(editor.history.undoSize).toBe(undoSize + 1);
      editor.undo();
      expect(visualOf(editor, shape).width).toBe(100);
      editor.redo();
      expect(visualOf(editor, shape).width).toBe(selection ? 200 : 300);
    });
  }

  test("resize release applies its exact coordinate even after the last frame ran", () => {
    const { editor, shape, interaction, frame } = setup();
    interaction.startResize(
      shape,
      "se",
      pointer({ clientX: 100, clientY: 100 }),
    );
    interaction.onPointerMove(pointer({ clientX: 140, clientY: 140 }));
    frame();
    interaction.onPointerUp(pointer({ clientX: 180, clientY: 180 }));
    expect(visualOf(editor, shape).width).toBe(180);
    editor.undo();
    expect(visualOf(editor, shape).width).toBe(100);
  });

  test("rotation samples paint per frame and preserve the terminal angle", () => {
    const { editor, shape, interaction, frame, callbacks } = setup();
    interaction.startRotate(shape, pointer({ clientX: 50, clientY: 0 }));
    interaction.onPointerMove(pointer({ clientX: 100, clientY: 50 }));
    expect(visualOf(editor, shape).rotation ?? 0).toBe(0);
    frame();
    expect(visualOf(editor, shape).rotation).toBe(90);
    interaction.onPointerUp(pointer({ clientX: 50, clientY: 100 }));
    expect(visualOf(editor, shape).rotation).toBe(180);
    expect(callbacks.size).toBe(0);
    editor.undo();
    expect(visualOf(editor, shape).rotation ?? 0).toBe(0);
  });

  test("a remote commit after the last resize frame survives release", () => {
    const { editor, shape, interaction, frame } = setup();
    interaction.startResize(
      shape,
      "se",
      pointer({ clientX: 100, clientY: 100 }),
    );
    interaction.onPointerMove(pointer({ clientX: 140, clientY: 140 }));
    frame();
    const element = editor.store.get(shape);
    if (!element) throw new Error("missing shape");
    editor.store.commit({
      update: [{ ...element, visual: { ...element.visual, width: 500 } }],
    });
    interaction.onPointerUp(pointer({ clientX: 180, clientY: 180 }));
    expect(visualOf(editor, shape).width).toBe(500);
  });

  test("routing bend updates are frame-paced and release keeps the final route", () => {
    const { editor, shape, interaction, frame, callbacks } = setup();
    const to = editor.createElement("shape.geo", {
      visual: { x: 300, y: 200, width: 100, height: 100 },
    });
    const edge = editor.connect(shape, to);
    if (!edge) throw new Error("expected edge");
    editor.apply([
      {
        type: "updateSemantic",
        id: edge,
        semantic: { from: shape, to, routing: "orthogonal" },
      },
    ]);
    editor.selection.set([edge]);
    interaction.startRouteBend(edge, pointer({ clientX: 200, clientY: 150 }));
    interaction.onPointerMove(pointer({ clientX: 220, clientY: 150 }));
    interaction.onPointerMove(pointer({ clientX: 240, clientY: 150 }));
    expect(callbacks.size).toBe(1);
    expect(editor.store.get(edge)?.semantic).not.toHaveProperty("routingBend");
    frame();
    expect(editor.store.get(edge)?.semantic).toMatchObject({
      routingBend: 0.7,
    });
    interaction.onPointerUp(pointer({ clientX: 250, clientY: 150 }));
    expect(editor.store.get(edge)?.semantic).toMatchObject({
      routingBend: 0.75,
    });
    editor.undo();
    expect(editor.store.get(edge)?.semantic).not.toHaveProperty("routingBend");
  });

  for (const stop of ["cancel", "dispose", "replacement", "remote"] as const) {
    test(`queued resize respects ${stop}`, () => {
      const { editor, shape, interaction, frame, callbacks } = setup();
      interaction.startResize(
        shape,
        "se",
        pointer({ clientX: 100, clientY: 100 }),
      );
      interaction.onPointerMove(pointer({ clientX: 140, clientY: 140 }));
      frame();
      interaction.onPointerMove(pointer({ clientX: 180, clientY: 180 }));
      if (stop === "cancel") interaction.onPointerCancel(pointer());
      if (stop === "dispose") interaction.dispose();
      if (stop === "replacement") {
        editor.loadDocument(editor.getSnapshot(), { preserveView: true });
        interaction.onPointerUp(pointer({ clientX: 220, clientY: 220 }));
      }
      if (stop === "remote") {
        editor.apply([
          { type: "updateVisual", id: shape, visual: { width: 500 } },
        ]);
        interaction.onPointerUp(pointer({ clientX: 220, clientY: 220 }));
      }
      frame();
      expect(callbacks.size).toBe(0);
      expect(visualOf(editor, shape).width).toBe(
        stop === "remote" ? 500 : stop === "replacement" ? 140 : 100,
      );
    });
  }

  test("duplicate positions do not publish extra model commits", () => {
    const { editor, interaction, frame } = setup();
    let commits = 0;
    editor.store.subscribe(() => {
      commits += 1;
    });
    interaction.onPointerDown(pointer());
    interaction.onPointerMove(pointer({ clientX: 80 }));
    frame();
    interaction.onPointerMove(pointer({ clientX: 80 }));
    frame();
    interaction.onPointerUp(pointer({ clientX: 80 }));
    expect(commits).toBe(1);
  });

  for (const cancel of ["pointer", "escape", "readonly", "dispose"] as const) {
    test(`${cancel} discards pending work and leaves no partial drag`, () => {
      const { editor, shape, interaction, callbacks, frame } = setup();
      const undoSize = editor.history.undoSize;
      interaction.onPointerDown(pointer());
      interaction.onPointerMove(pointer({ clientX: 80 }));
      frame();
      interaction.onPointerMove(pointer({ clientX: 180 }));
      if (cancel === "pointer") interaction.onPointerCancel(pointer());
      if (cancel === "escape") interaction.onKeyDown(keyboard("Escape"));
      if (cancel === "readonly") {
        editor.setReadOnly(true);
        frame();
      }
      if (cancel === "dispose") interaction.dispose();
      frame();
      expect(callbacks.size).toBe(0);
      // Viewer mode freezes existing state; it must not apply queued edits.
      expect(visualOf(editor, shape).x).toBe(cancel === "readonly" ? 30 : 0);
      expect(editor.history.batching).toBe(false);
      expect(editor.history.undoSize).toBe(undoSize);
    });
  }

  test("foreign pointers cannot flush or replace the owner's queued move", () => {
    const { editor, shape, interaction, frame } = setup();
    interaction.onPointerDown(pointer());
    interaction.onPointerMove(pointer({ clientX: 80 }));
    interaction.onPointerMove(pointer({ pointerId: 2, clientX: 900 }));
    interaction.onPointerUp(pointer({ pointerId: 2, clientX: 900 }));
    frame();
    expect(visualOf(editor, shape).x).toBe(30);
    interaction.onPointerUp(pointer({ clientX: 80 }));
    expect(editor.history.batching).toBe(false);
  });

  for (const preserveView of [false, true]) {
    test(`document replacement cannot receive a stale drag (preserveView=${preserveView})`, () => {
      const { editor, shape, interaction, frame } = setup();
      interaction.onPointerDown(pointer());
      interaction.onPointerMove(pointer({ clientX: 180 }));
      const snapshot = editor.getSnapshot();
      editor.loadDocument(
        {
          ...snapshot,
          elements: snapshot.elements.map((element) =>
            element.id === shape
              ? { ...element, visual: { ...element.visual, x: 500 } }
              : element,
          ),
        },
        { preserveView },
      );
      frame();
      interaction.onPointerUp(pointer({ clientX: 200 }));
      expect(visualOf(editor, shape).x).toBe(500);
      expect(editor.history.undoSize).toBe(0);
      expect(editor.history.batching).toBe(false);
    });
  }

  for (const releaseBeforeFrame of [false, true]) {
    test(`a newer remote commit supersedes a queued sample (releaseFirst=${releaseBeforeFrame})`, () => {
      const { editor, shape, interaction, frame } = setup();
      interaction.onPointerDown(pointer());
      interaction.onPointerMove(pointer({ clientX: 80 }));
      frame();
      interaction.onPointerMove(pointer({ clientX: 180 }));
      const element = editor.store.get(shape);
      if (!element) throw new Error("missing test shape");
      editor.store.commit({
        update: [{ ...element, visual: { ...element.visual, x: 500 } }],
      });
      if (releaseBeforeFrame)
        interaction.onPointerUp(pointer({ clientX: 200 }));
      frame();
      if (!releaseBeforeFrame)
        interaction.onPointerUp(pointer({ clientX: 200 }));
      expect(visualOf(editor, shape).x).toBe(500);
      expect(editor.history.batching).toBe(false);
    });
  }
});

describe("viewer canvas interaction", () => {
  test("a pending connection is cancelled if viewer mode starts before release", () => {
    const { editor, shape, interaction } = harness();
    const target = editor.createElement("shape.geo", {
      visual: { x: 200, y: 0, width: 100, height: 100 },
    });
    const before = editor.getSnapshot();
    interaction.startConnect(shape, pointer({ clientX: 50, clientY: 50 }));
    expect(interaction.pending()).not.toBeNull();
    editor.setReadOnly(true);
    interaction.onPointerUp(pointer({ clientX: 250, clientY: 50 }));
    expect(interaction.pending()).toBeNull();
    expect(editor.getSnapshot()).toEqual(before);
    interaction.onPointerDown(
      pointer({ pointerId: 2, clientX: 250, clientY: 50 }),
    );
    interaction.onPointerUp(
      pointer({ pointerId: 2, clientX: 250, clientY: 50 }),
    );
    expect(editor.selection.has(target)).toBe(true);
  });
  test("selection, marquee and pan work without moving or creating artwork", () => {
    const editor = new Editor();
    const id = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const state = interactionFor(editor, "geo:rect");
    editor.setReadOnly(true);
    const before = editor.getSnapshot();
    state.interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    state.interaction.onPointerMove(pointer({ clientX: 200, clientY: 200 }));
    state.interaction.onPointerUp(pointer({ clientX: 200, clientY: 200 }));
    expect(editor.selection.has(id)).toBe(true);
    expect(editor.camera.get()).toEqual({ x: 0, y: 0, z: 1 });
    editor.selection.clear();
    state.interaction.onPointerDown(pointer({ clientX: -10, clientY: -10 }));
    state.interaction.onPointerMove(pointer({ clientX: 120, clientY: 120 }));
    state.interaction.onPointerUp(pointer({ clientX: 120, clientY: 120 }));
    expect(editor.selection.has(id)).toBe(true);
    state.setTool("hand");
    state.interaction.onPointerDown(pointer({ clientX: 0, clientY: 0 }));
    state.interaction.onPointerMove(pointer({ clientX: 40, clientY: 30 }));
    state.interaction.onPointerUp(pointer({ clientX: 40, clientY: 30 }));
    expect(editor.camera.get()).toEqual({ x: 40, y: 30, z: 1 });
    expect(editor.getSnapshot()).toEqual(before);
  });

  test("editing shortcuts and direct handles cannot start viewer edits", () => {
    const { editor, shape, interaction, tool } = harness();
    editor.setReadOnly(true);
    const before = editor.getSnapshot();
    interaction.startResize(shape, "se", pointer());
    interaction.startRotate(shape, pointer());
    interaction.startConnect(shape, pointer());
    interaction.onPointerMove(pointer({ clientX: 400, clientY: 400 }));
    interaction.onPointerUp(pointer({ clientX: 400, clientY: 400 }));
    for (const key of ["ArrowRight", "Delete", "F2", "r"])
      interaction.onKeyDown(keyboard(key));
    for (const key of ["x", "v", "d", "g", "z"])
      interaction.onKeyDown(keyboard(key, { ctrlKey: true }));
    expect(tool()).toBe("select");
    expect(interaction.pending()).toBeNull();
    expect(editor.getSnapshot()).toEqual(before);
    interaction.onKeyDown(keyboard("c", { ctrlKey: true }));
    expect(editor.canPaste()).toBe(true);
    interaction.onKeyDown(keyboard("+", { ctrlKey: true }));
    expect(editor.camera.get().z).toBeGreaterThan(1);
  });
});

describe("right-button camera gestures", () => {
  for (const readOnly of [false, true]) {
    test(`right drag pans without moving shapes, changing selection or opening a menu (readOnly=${readOnly})`, () => {
      const { editor, shape } = harness();
      editor.selection.set([shape]);
      editor.setReadOnly(readOnly);
      const before = editor.getSnapshot();
      const undo = editor.history.undoSize;
      const camera = editor.camera.get();
      let menus = 0;
      const { interaction } = interactionFor(editor, "select", {
        onContextMenu: () => {
          menus++;
        },
      });
      expect(interaction.panning()).toBe(false);
      interaction.onPointerDown(pointer({ button: 2 }));
      expect(interaction.panning()).toBe(true);
      interaction.onContextMenu(mouse(50, 50));
      interaction.onPointerMove(
        pointer({ button: 2, clientX: 130, clientY: 90 }),
      );
      interaction.onPointerUp(
        pointer({ button: 2, clientX: 130, clientY: 90 }),
      );
      expect(interaction.panning()).toBe(false);
      interaction.onContextMenu(mouse(130, 90));
      expect(editor.camera.get()).toEqual({
        ...camera,
        x: camera.x + 80 / camera.z,
        y: camera.y + 40 / camera.z,
      });
      expect(editor.getSnapshot()).toEqual(before);
      expect([...editor.selection.ids()]).toEqual([shape]);
      expect(editor.history.undoSize).toBe(undo);
      expect(menus).toBe(0);
    });
  }
  test("a stationary right click opens exactly one context menu despite browser event ordering", () => {
    const { editor } = harness();
    let menus = 0;
    const { interaction } = interactionFor(editor, "select", {
      onContextMenu: () => {
        menus++;
      },
    });
    interaction.onPointerDown(pointer({ button: 2 }));
    interaction.onContextMenu(mouse(50, 50));
    interaction.onPointerUp(pointer({ button: 2 }));
    interaction.onContextMenu(mouse(50, 50));
    expect(menus).toBe(1);
  });
});

test("cancelling a right drag suppresses its menu and a later right click still works", () => {
  for (const cancel of ["pointer", "escape", "blur"] as const) {
    const { editor } = harness();
    let menus = 0;
    const { interaction } = interactionFor(editor, "select", {
      onContextMenu: () => {
        menus++;
      },
    });
    interaction.onPointerDown(pointer({ button: 2 }));
    interaction.onPointerMove(pointer({ button: 2, clientX: 130 }));
    if (cancel === "pointer")
      interaction.onPointerCancel(pointer({ button: 2 }));
    else if (cancel === "escape") interaction.onKeyDown(keyboard("Escape"));
    else interaction.onBlur();
    expect(interaction.panning()).toBe(false);
    const camera = editor.camera.get();
    interaction.onPointerMove(pointer({ button: 2, clientX: 200 }));
    interaction.onPointerUp(pointer({ button: 2, clientX: 200 }));
    interaction.onContextMenu(mouse(200, 50));
    expect(menus).toBe(0);
    expect(editor.camera.get()).toEqual(camera);
    interaction.onPointerDown(pointer({ button: 2 }));
    interaction.onPointerUp(pointer({ button: 2 }));
    expect(menus).toBe(1);
  }
});

test("right drag tracks screen distance at every zoom and click jitter does not pan", () => {
  for (const z of [0.5, 2, 4]) {
    const { editor } = harness();
    editor.camera.set({ x: 15, y: -20, z });
    const { interaction } = interactionFor(editor, "select");
    interaction.onPointerDown(pointer({ button: 2 }));
    interaction.onPointerMove(pointer({ button: 2, clientX: 50.5 }));
    expect(editor.camera.get()).toEqual({ x: 15, y: -20, z });
    interaction.onPointerMove(
      pointer({ button: 2, clientX: 130, clientY: 90 }),
    );
    interaction.onPointerUp(pointer({ button: 2, clientX: 130, clientY: 90 }));
    expect(editor.camera.get()).toEqual({ x: 15 + 80 / z, y: -20 + 40 / z, z });
  }
});
