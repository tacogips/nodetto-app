import { describe, expect, test } from "bun:test";
import { addPageGuide, Editor } from "@nodetto/core";
import { createInteraction } from "./interaction.ts";
import {
  interactionFor,
  harness,
  pointer,
  keyboard,
  visualOf,
  grouped,
} from "./interaction-test-helpers.ts";

describe("marquee selection", () => {
  test("dragging on empty canvas brushes over elements and selects them", () => {
    const { editor, shape, interaction } = harness();
    editor.selection.clear();

    // Down well away from the shape, drag until the rect covers it.
    interaction.onPointerDown(pointer({ clientX: 300, clientY: 300 }));
    expect(interaction.marquee()).toEqual({
      x: 300,
      y: 300,
      width: 0,
      height: 0,
    });
    interaction.onPointerMove(pointer({ clientX: 320, clientY: 320 }));
    expect(editor.selection.has(shape)).toBe(false);

    interaction.onPointerMove(pointer({ clientX: 50, clientY: 50 }));
    // Live selection: the shape is picked up before the pointer lifts.
    expect(editor.selection.has(shape)).toBe(true);
    expect(interaction.marquee()).toEqual({
      x: 50,
      y: 50,
      width: 250,
      height: 250,
    });

    interaction.onPointerUp(pointer({ clientX: 50, clientY: 50 }));
    expect(editor.selection.has(shape)).toBe(true);
    expect(interaction.marquee()).toBeNull();
  });

  test("shift keeps the existing selection as the base", () => {
    const { editor, shape, interaction } = harness();
    const other = editor.createElement("shape.geo", {
      visual: { x: 500, y: 500, width: 40, height: 40 },
    });
    editor.selection.set([shape]);

    interaction.onPointerDown(
      pointer({ clientX: 480, clientY: 480, shiftKey: true }),
    );
    interaction.onPointerMove(pointer({ clientX: 560, clientY: 560 }));
    interaction.onPointerUp(pointer({ clientX: 560, clientY: 560 }));

    expect(editor.selection.has(shape)).toBe(true);
    expect(editor.selection.has(other)).toBe(true);
  });

  test("escape cancels the brush and restores the base selection", () => {
    const { editor, shape, interaction } = harness();
    editor.selection.clear();

    interaction.onPointerDown(pointer({ clientX: 300, clientY: 300 }));
    interaction.onPointerMove(pointer({ clientX: 50, clientY: 50 }));
    expect(editor.selection.has(shape)).toBe(true);

    interaction.onKeyDown(keyboard("Escape"));
    expect(interaction.marquee()).toBeNull();
    expect(editor.selection.size).toBe(0);
  });

  test("escape on a shift-marquee keeps the base selection alive", () => {
    const { editor, shape, interaction } = harness();
    editor.selection.set([shape]);

    interaction.onPointerDown(
      pointer({ clientX: 300, clientY: 300, shiftKey: true }),
    );
    interaction.onPointerMove(pointer({ clientX: 350, clientY: 350 }));
    interaction.onKeyDown(keyboard("Escape"));

    expect(interaction.marquee()).toBeNull();
    expect(editor.selection.has(shape)).toBe(true);
  });

  test("live selection notifies only when membership changes", () => {
    const { editor, shape, interaction } = harness();
    editor.selection.clear();
    let notifications = 0;
    const unsubscribe = editor.selection.subscribe(() => {
      notifications += 1;
    });

    interaction.onPointerDown(pointer({ clientX: 300, clientY: 300 }));
    // Many moves inside empty space: membership never changes, so the
    // selection must stay quiet — in cloud mode every notification becomes
    // an awareness publish.
    for (let i = 0; i < 10; i += 1) {
      interaction.onPointerMove(
        pointer({ clientX: 300 - i, clientY: 300 - i }),
      );
    }
    expect(notifications).toBe(0);

    interaction.onPointerMove(pointer({ clientX: 50, clientY: 50 }));
    expect(editor.selection.has(shape)).toBe(true);
    expect(notifications).toBe(1);

    interaction.onPointerUp(pointer({ clientX: 50, clientY: 50 }));
    unsubscribe();
  });

  test("reports the rectangle through onMarquee, ending with null", () => {
    const editor = new Editor();
    const seen: (unknown | null)[] = [];
    const interaction = createInteraction(editor, {
      tool: () => "select",
      setTool: () => {},
      container: () => undefined,
      onMarquee: (rect) => {
        seen.push(rect);
      },
    });
    interaction.onPointerDown(pointer({ clientX: 10, clientY: 10 }));
    interaction.onPointerMove(pointer({ clientX: 30, clientY: 40 }));
    interaction.onPointerUp(pointer({ clientX: 30, clientY: 40 }));
    expect(seen[0]).toEqual({ x: 10, y: 10, width: 0, height: 0 });
    expect(seen[1]).toEqual({ x: 10, y: 10, width: 20, height: 30 });
    expect(seen.at(-1)).toBeNull();
  });
});

describe("group-aware selection (design 3.1)", () => {
  test("clicking a member selects its group; the next click drills in", () => {
    const { editor, interaction, a, group } = grouped();

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 50, clientY: 50 }));
    expect([...editor.selection.ids()]).toEqual([group]);

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 50, clientY: 50 }));
    expect([...editor.selection.ids()]).toEqual([a]);
    expect(editor.history.batching).toBe(false);
  });

  test("dragging a selected group by a member moves every member", () => {
    const { editor, interaction, a, b, group } = grouped();
    editor.selection.set([group]);
    const before = editor.history.undoSize;

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerMove(pointer({ clientX: 80, clientY: 90 }));
    interaction.onPointerUp(pointer({ clientX: 80, clientY: 90 }));

    // A drag does not drill in: the group stays selected and moves whole.
    expect([...editor.selection.ids()]).toEqual([group]);
    expect(visualOf(editor, a)).toMatchObject({ x: 30, y: 40 });
    expect(visualOf(editor, b)).toMatchObject({ x: 230, y: 40 });
    expect(editor.history.undoSize).toBe(before + 1);
    expect(editor.history.batching).toBe(false);
  });

  test("escape drills back out to the group, then deselects", () => {
    const { editor, interaction, a, group } = grouped();
    editor.selection.set([a]);

    interaction.onKeyDown(keyboard("Escape"));
    expect([...editor.selection.ids()]).toEqual([group]);
    interaction.onKeyDown(keyboard("Escape"));
    expect(editor.selection.size).toBe(0);
  });

  test("a marquee picks up groups rather than their members", () => {
    const { editor, interaction, group } = grouped();

    interaction.onPointerDown(pointer({ clientX: -20, clientY: -20 }));
    interaction.onPointerMove(pointer({ clientX: 120, clientY: 120 }));
    expect([...editor.selection.ids()]).toEqual([group]);
    interaction.onPointerUp(pointer({ clientX: 120, clientY: 120 }));
    expect([...editor.selection.ids()]).toEqual([group]);
  });

  test("cmd+a selects the page's top-level elements", () => {
    const { editor, interaction, group, loose } = grouped();
    interaction.onKeyDown(keyboard("a", { metaKey: true }));
    expect(new Set(editor.selection.ids())).toEqual(new Set([group, loose]));
  });

  test("a plain click on one of several selected shapes narrows to it", () => {
    const { editor, interaction, loose, group } = grouped();
    editor.selection.set([group, loose]);

    interaction.onPointerDown(pointer({ clientX: 610, clientY: 610 }));
    interaction.onPointerUp(pointer({ clientX: 610, clientY: 610 }));
    expect([...editor.selection.ids()]).toEqual([loose]);
  });
});

describe("snapping (design 6)", () => {
  const OBJECTS = () => ({ grid: false, objects: true });
  const GRID = () => ({ grid: true, objects: false });

  /** A selected box at the origin and a neighbour whose left edge is x=300. */
  function neighbours(snap: () => { grid: boolean; objects: boolean }) {
    const editor = new Editor();
    const moving = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    // Vertically far away so only the x lines can match.
    const other = editor.createElement("shape.geo", {
      visual: { x: 300, y: 400, width: 100, height: 100 },
    });
    editor.selection.set([moving]);
    return {
      editor,
      moving,
      other,
      ...interactionFor(editor, "select", { snap }),
    };
  }

  test("a translate lands flush with a neighbour and reports one guide", () => {
    const { editor, interaction, moving } = neighbours(OBJECTS);

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    // Right edge would be at 295: five units short of the neighbour's 300.
    interaction.onPointerMove(pointer({ clientX: 245, clientY: 50 }));
    expect(visualOf(editor, moving)).toMatchObject({ x: 200, y: 0 });
    expect(interaction.guides()).toHaveLength(1);
    expect(interaction.guides()[0]).toMatchObject({ axis: "x", at: 300 });

    interaction.onPointerUp(pointer({ clientX: 245, clientY: 50 }));
    expect(interaction.guides()).toHaveLength(0);
    expect(visualOf(editor, moving)).toMatchObject({ x: 200 });
    expect(editor.history.batching).toBe(false);
  });

  test("holding cmd/ctrl during the drag disables snapping", () => {
    const { editor, interaction, moving } = neighbours(OBJECTS);

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerMove(
      pointer({ clientX: 245, clientY: 50, metaKey: true }),
    );
    expect(visualOf(editor, moving)).toMatchObject({ x: 195 });
    expect(interaction.guides()).toHaveLength(0);
    interaction.onPointerUp(pointer({ clientX: 245, clientY: 50 }));
  });

  test("beyond the threshold nothing snaps", () => {
    const { editor, interaction, moving } = neighbours(OBJECTS);

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerMove(pointer({ clientX: 230, clientY: 50 }));
    expect(visualOf(editor, moving)).toMatchObject({ x: 180 });
    expect(interaction.guides()).toHaveLength(0);
    interaction.onPointerUp(pointer({ clientX: 230, clientY: 50 }));
  });

  test("grid snapping rounds the top-left corner onto the 24 grid", () => {
    const { editor, interaction, moving } = neighbours(GRID);

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerMove(pointer({ clientX: 80, clientY: 90 }));
    expect(visualOf(editor, moving)).toMatchObject({ x: 24, y: 48 });
    // Grid snaps draw no guide: there is no neighbour to point at.
    expect(interaction.guides()).toHaveLength(0);
    interaction.onPointerUp(pointer({ clientX: 80, clientY: 90 }));
  });

  test("persistent page guides snap independently of grid and object toggles", () => {
    const editor = new Editor();
    const moving = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    addPageGuide(editor, editor.currentPageId, "x", 200, "guide-x");
    editor.selection.set([moving]);
    const { interaction } = interactionFor(editor, "select", {
      snap: () => ({ grid: false, objects: false, guides: true }),
    });

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerMove(pointer({ clientX: 145, clientY: 50 }));
    expect(visualOf(editor, moving)).toMatchObject({ x: 100, y: 0 });
    interaction.onPointerUp(pointer({ clientX: 145, clientY: 50 }));
  });

  test("hidden or disabled page guides do not snap", () => {
    for (const guides of [true, false]) {
      const editor = new Editor();
      const moving = editor.createElement("shape.geo", {
        visual: { x: 0, y: 0, width: 100, height: 100 },
      });
      const id = addPageGuide(
        editor,
        editor.currentPageId,
        "x",
        200,
        `guide-${guides}`,
      );
      if (guides && id)
        editor.apply([
          {
            type: "updateSemantic",
            id,
            semantic: { axis: "x", position: 200, hidden: true },
          },
        ]);
      editor.selection.set([moving]);
      const { interaction } = interactionFor(editor, "select", {
        snap: () => ({ grid: false, objects: false, guides }),
      });
      interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
      interaction.onPointerMove(pointer({ clientX: 145, clientY: 50 }));
      expect(visualOf(editor, moving).x).toBe(95);
      interaction.onPointerUp(pointer({ clientX: 145, clientY: 50 }));
    }
  });

  test("a child snaps to its artboard's visible square grid and origin", () => {
    const editor = new Editor();
    const frame = editor.createElement("frame", {
      semantic: {
        name: "Mobile",
        layoutGrids: [
          {
            id: "minor-grid",
            kind: "grid",
            size: 8,
            color: "#3b82f6",
            opacity: 0.2,
          },
        ],
      },
      visual: { x: 101, y: 203, width: 390, height: 844 },
    });
    const moving = editor.createElement("shape.geo", {
      visual: { x: 109, y: 239, width: 20, height: 20 },
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
    const { interaction } = interactionFor(editor, "select", { snap: GRID });

    interaction.onPointerDown(pointer({ clientX: 119, clientY: 249 }));
    interaction.onPointerMove(pointer({ clientX: 124, clientY: 254 }));
    expect(visualOf(editor, moving)).toMatchObject({ x: 117, y: 243 });
    interaction.onPointerUp(pointer({ clientX: 124, clientY: 254 }));
  });

  test("a child snaps to its parent device safe area", () => {
    const editor = new Editor();
    const frame = editor.createElement("frame", {
      semantic: {
        name: "iPhone",
        platform: "ios",
        safeArea: { top: 47, right: 0, bottom: 34, left: 16 },
      },
      visual: { x: 100, y: 200, width: 390, height: 844 },
    });
    const moving = editor.createElement("shape.geo", {
      visual: { x: 110, y: 240, width: 20, height: 20 },
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
    const { interaction } = interactionFor(editor, "select", { snap: GRID });

    interaction.onPointerDown(pointer({ clientX: 120, clientY: 250 }));
    interaction.onPointerMove(pointer({ clientX: 123, clientY: 256 }));
    expect(visualOf(editor, moving)).toMatchObject({ x: 116, y: 247 });
    interaction.onPointerUp(pointer({ clientX: 123, clientY: 256 }));
  });

  test("column grids snap horizontally without imposing a page grid vertically", () => {
    const editor = new Editor();
    const frame = editor.createElement("frame", {
      semantic: {
        name: "Mobile columns",
        layoutGrids: [
          {
            id: "columns",
            kind: "columns",
            count: 4,
            gutter: 10,
            margin: 20,
            color: "#ef4444",
            opacity: 0.12,
          },
        ],
      },
      visual: { x: 101, y: 203, width: 390, height: 844 },
    });
    const moving = editor.createElement("shape.geo", {
      visual: { x: 109, y: 239, width: 20, height: 20 },
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
    const { interaction } = interactionFor(editor, "select", { snap: GRID });

    interaction.onPointerDown(pointer({ clientX: 119, clientY: 249 }));
    interaction.onPointerMove(pointer({ clientX: 129, clientY: 254 }));
    expect(visualOf(editor, moving)).toMatchObject({ x: 121, y: 244 });
    interaction.onPointerUp(pointer({ clientX: 129, clientY: 254 }));
  });

  test("a group drags as one box: the union snaps, every member moves", () => {
    const { editor, a, b, group } = grouped();
    const wall = editor.createElement("shape.geo", {
      visual: { x: 500, y: 400, width: 40, height: 40 },
    });
    editor.selection.set([group]);
    const { interaction } = interactionFor(editor, "select", { snap: OBJECTS });

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    // The union's right edge (300) moves to 495, five short of the wall.
    interaction.onPointerMove(pointer({ clientX: 245, clientY: 50 }));
    expect(visualOf(editor, a)).toMatchObject({ x: 200 });
    expect(visualOf(editor, b)).toMatchObject({ x: 400 });
    expect(visualOf(editor, wall)).toMatchObject({ x: 500 });
    interaction.onPointerUp(pointer({ clientX: 245, clientY: 50 }));
  });

  test("a resize snaps only the edge the handle owns", () => {
    const { editor, interaction, moving } = neighbours(OBJECTS);

    interaction.startResize(
      moving,
      "e",
      pointer({ clientX: 100, clientY: 50 }),
    );
    interaction.onPointerMove(pointer({ clientX: 295, clientY: 50 }));
    expect(visualOf(editor, moving)).toMatchObject({ x: 0, width: 300 });
    expect(interaction.guides()).toHaveLength(1);
    interaction.onPointerUp(pointer({ clientX: 295, clientY: 50 }));
    expect(interaction.guides()).toHaveLength(0);
    expect(editor.history.batching).toBe(false);
  });

  test("shift keeps the aspect ratio while resizing", () => {
    const { editor, interaction, moving } = neighbours(() => ({
      grid: false,
      objects: false,
    }));

    interaction.startResize(
      moving,
      "e",
      pointer({ clientX: 100, clientY: 50 }),
    );
    interaction.onPointerMove(
      pointer({ clientX: 200, clientY: 50, shiftKey: true }),
    );
    expect(visualOf(editor, moving)).toMatchObject({
      width: 200,
      height: 200,
      y: -50,
    });
    interaction.onPointerUp(pointer({ clientX: 200, clientY: 50 }));
  });

  test("a persisted aspect ratio stays locked without Shift", () => {
    const { editor, interaction, moving } = neighbours(() => ({
      grid: false,
      objects: false,
    }));
    editor.apply([
      { type: "updateVisual", id: moving, visual: { aspectRatio: 2 } },
    ]);
    interaction.startResize(
      moving,
      "e",
      pointer({ clientX: 100, clientY: 50 }),
    );
    interaction.onPointerMove(pointer({ clientX: 200, clientY: 50 }));
    expect(visualOf(editor, moving)).toMatchObject({
      width: 200,
      height: 100,
      y: -25,
      aspectRatio: 2,
    });
    interaction.onPointerUp(pointer({ clientX: 200, clientY: 50 }));
  });
});
