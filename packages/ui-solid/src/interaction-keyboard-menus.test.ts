import { describe, expect, test } from "bun:test";
import { Editor, endpointReaderFor, resolveConnector } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import {
  type EditRegion,
  editRegionAt,
  NUDGE_GRID_STEP,
  type Scheduler,
  shortcutKey,
} from "./interaction.ts";
import type { ToolKind } from "./tools.ts";
import {
  interactionFor,
  harness,
  pointer,
  mouse,
  keyboard,
  visualOf,
  grouped,
} from "./interaction-test-helpers.ts";

/** A scheduler the test fires by hand, standing in for setTimeout. */
function manualScheduler(): { schedule: Scheduler; fire: () => void } {
  const pending: (() => void)[] = [];
  const schedule: Scheduler = (callback) => {
    pending.push(callback);
    return () => {
      const at = pending.indexOf(callback);
      if (at >= 0) {
        pending.splice(at, 1);
      }
    };
  };
  return {
    schedule,
    fire: () => {
      for (const callback of pending.splice(0)) {
        callback();
      }
    },
  };
}

describe("arrow-key nudges coalesce (design 3.2)", () => {
  test("presses within the window collapse into one undo step", () => {
    const editor = new Editor();
    const shape = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    editor.selection.set([shape]);
    const timer = manualScheduler();
    const { interaction } = interactionFor(editor, "select", {
      schedule: timer.schedule,
    });
    const before = editor.history.undoSize;

    interaction.onKeyDown(keyboard("ArrowRight"));
    interaction.onKeyDown(keyboard("ArrowRight"));
    interaction.onKeyDown(keyboard("ArrowRight"));
    interaction.onKeyDown(keyboard("ArrowDown", { shiftKey: true }));
    expect(visualOf(editor, shape)).toMatchObject({ x: 3, y: NUDGE_GRID_STEP });
    expect(editor.history.batching).toBe(true);

    timer.fire();
    expect(editor.history.batching).toBe(false);
    expect(editor.history.undoSize).toBe(before + 1);
    editor.undo();
    expect(visualOf(editor, shape)).toMatchObject({ x: 0, y: 0 });
  });

  test("any other edit closes the nudge batch before it runs", () => {
    const editor = new Editor();
    const shape = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    editor.selection.set([shape]);
    const timer = manualScheduler();
    const { interaction } = interactionFor(editor, "select", {
      schedule: timer.schedule,
    });
    const before = editor.history.undoSize;

    interaction.onKeyDown(keyboard("ArrowLeft"));
    interaction.onKeyDown(keyboard("Delete"));
    expect(editor.history.batching).toBe(false);
    // Two steps: the nudge, then the delete.
    expect(editor.history.undoSize).toBe(before + 2);
    // The timer, if it still fired, must not touch history.
    timer.fire();
    expect(editor.history.batching).toBe(false);
    editor.undo();
    expect(editor.store.has(shape)).toBe(true);
    expect(visualOf(editor, shape)).toMatchObject({ x: -1 });
  });

  test("a pointer gesture after a nudge gets its own batch", () => {
    const editor = new Editor();
    const shape = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    editor.selection.set([shape]);
    const timer = manualScheduler();
    const { interaction } = interactionFor(editor, "select", {
      schedule: timer.schedule,
    });
    const before = editor.history.undoSize;

    interaction.onKeyDown(keyboard("ArrowRight"));
    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerMove(pointer({ clientX: 90, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 90, clientY: 50 }));
    expect(editor.history.batching).toBe(false);
    expect(editor.history.undoSize).toBe(before + 2);
    expect(visualOf(editor, shape)).toMatchObject({ x: 41 });
  });

  test("with nothing selected the arrows are left to the browser", () => {
    const editor = new Editor();
    const { interaction } = interactionFor(editor, "select");
    const event = keyboard("ArrowUp");
    interaction.onKeyDown(event);
    expect(event.defaultPrevented).toBe(false);
    expect(editor.history.batching).toBe(false);
  });
});

describe("keyboard map (design 5)", () => {
  test("tool letters switch tools, but not while typing in a field", () => {
    const { interaction, tool } = harness();
    const expected: readonly (readonly [string, ToolKind])[] = [
      ["r", "geo:rect"],
      ["o", "geo:ellipse"],
      ["d", "geo:diamond"],
      ["n", "node.generic"],
      ["t", "text.note"],
      ["l", "edge"],
      ["h", "hand"],
      ["v", "select"],
    ];
    for (const [key, kind] of expected) {
      interaction.onKeyDown(keyboard(key));
      expect(tool()).toBe(kind);
    }

    interaction.onKeyDown(keyboard("r", { target: { tagName: "INPUT" } }));
    expect(tool()).toBe("select");
    interaction.onKeyDown(
      keyboard("r", { target: { tagName: "DIV", isContentEditable: true } }),
    );
    expect(tool()).toBe("select");
    // Shifted letters are not tool keys.
    interaction.onKeyDown(keyboard("R", { shiftKey: true }));
    expect(tool()).toBe("select");
  });

  test("handled keys and IME composition do not activate navigation tools", () => {
    const { interaction, tool } = harness();
    const handled = keyboard("h");
    handled.preventDefault();
    interaction.onKeyDown(handled);
    interaction.onKeyDown(keyboard(" ", { code: "Space", isComposing: true }));
    expect(tool()).toBe("select");
    expect(interaction.temporaryHand()).toBe(false);
  });

  test("holding space pans with the select tool and lets go on keyup", () => {
    const { editor, interaction, shape, tool } = harness();

    const down = keyboard(" ", { code: "Space" });
    interaction.onKeyDown(down);
    expect(down.defaultPrevented).toBe(true);
    expect(tool()).toBe("hand");
    expect(interaction.temporaryHand()).toBe(true);
    // Key repeat must not re-capture the "previous" tool as hand.
    interaction.onKeyDown(keyboard(" ", { code: "Space", repeat: true }));

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
    interaction.onPointerMove(pointer({ clientX: 60, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 60, clientY: 50 }));
    expect(editor.camera.get().x).toBe(10);
    expect(visualOf(editor, shape)).toMatchObject({ x: 0 });

    interaction.onKeyUp(keyboard(" ", { code: "Space" }));
    expect(tool()).toBe("select");
    expect(interaction.temporaryHand()).toBe(false);
  });

  test("the select tool comes back even if space was held from another tool", () => {
    const { interaction, tool, setTool } = harness();
    setTool("geo:rect");
    interaction.onKeyDown(keyboard(" "));
    expect(tool()).toBe("hand");
    interaction.onKeyUp(keyboard(" "));
    expect(tool()).toBe("geo:rect");
  });

  test("clipboard, duplicate and group chords reach the editor", () => {
    const { editor, interaction, shape } = harness();
    const other = editor.createElement("shape.geo", {
      visual: { x: 300, y: 0, width: 100, height: 100 },
    });
    editor.selection.set([shape, other]);

    interaction.onKeyDown(keyboard("d", { metaKey: true }));
    expect(editor.store.size).toBe(4);

    interaction.onKeyDown(keyboard("g", { metaKey: true }));
    const group = [...editor.selection.ids()];
    expect(group).toHaveLength(1);
    expect(editor.store.get(group[0] as ElementId)?.type).toBe("group");
    interaction.onKeyDown(keyboard("g", { metaKey: true, shiftKey: true }));
    expect(editor.selection.size).toBe(2);

    interaction.onKeyDown(keyboard("g", { metaKey: true, altKey: true }));
    const frame = [...editor.selection.ids()];
    expect(frame).toHaveLength(1);
    expect(editor.store.get(frame[0] as ElementId)?.type).toBe("frame");
    editor.undo();

    editor.selection.set([shape]);
    interaction.onKeyDown(keyboard("c", { ctrlKey: true }));
    expect(editor.canPaste()).toBe(true);
    interaction.onKeyDown(keyboard("v", { ctrlKey: true }));
    expect(editor.store.size).toBe(5);
    interaction.onKeyDown(keyboard("x", { ctrlKey: true }));
    expect(editor.store.size).toBe(4);
  });

  test("z-order keys with and without the modifier", () => {
    const { editor, interaction, shape } = harness();
    const above = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const top = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const order = () =>
      editor.store
        .getPageElements(editor.currentPageId)
        .map((element) => element.id);
    editor.selection.set([shape]);

    interaction.onKeyDown(keyboard("]"));
    expect(order()).toEqual([above, shape, top]);
    interaction.onKeyDown(keyboard("]", { metaKey: true }));
    expect(order()).toEqual([above, top, shape]);
    interaction.onKeyDown(keyboard("["));
    expect(order()).toEqual([above, shape, top]);
    interaction.onKeyDown(keyboard("[", { metaKey: true }));
    expect(order()).toEqual([shape, above, top]);
  });

  test("zoom chords step about the viewport centre; shift+1 fits", () => {
    const { editor, interaction } = harness();
    const viewport = { width: 800, height: 600 };
    const zoomed = interactionFor(editor, "select", {
      viewport: () => viewport,
    });

    zoomed.interaction.onKeyDown(keyboard("=", { metaKey: true }));
    expect(editor.camera.get().z).toBe(1.25);
    const centre = editor.camera.screenToPage({ x: 400, y: 300 });
    zoomed.interaction.onKeyDown(keyboard("=", { metaKey: true }));
    expect(editor.camera.get().z).toBe(1.5);
    const after = editor.camera.screenToPage({ x: 400, y: 300 });
    expect(after.x).toBeCloseTo(centre.x, 6);
    expect(after.y).toBeCloseTo(centre.y, 6);
    zoomed.interaction.onKeyDown(keyboard("-", { metaKey: true }));
    expect(editor.camera.get().z).toBe(1.25);
    zoomed.interaction.onKeyDown(keyboard("0", { metaKey: true }));
    expect(editor.camera.get().z).toBe(1);

    editor.camera.set({ x: 900, y: 900, z: 3 });
    zoomed.interaction.onKeyDown(
      keyboard("!", { shiftKey: true, code: "Digit1" }),
    );
    // Fit never zooms past 100 % and centres the content.
    expect(editor.camera.get().z).toBe(1);
    const shown = editor.camera.pageToScreen({ x: 50, y: 50 });
    expect(shown.x).toBeCloseTo(400, 6);
    expect(shown.y).toBeCloseTo(300, 6);

    zoomed.interaction.onKeyDown(
      keyboard("@", { shiftKey: true, code: "Digit2" }),
    );
    expect(editor.camera.get().z).toBe(4);
    // The plain interaction (no viewport, no container) leaves the camera be.
    interaction.onKeyDown(keyboard("0", { metaKey: true }));
    expect(editor.camera.get().z).toBe(1);
  });

  test("cmd+shift+e is left for the shell", () => {
    const { interaction } = harness();
    const event = keyboard("e", { metaKey: true, shiftKey: true });
    interaction.onKeyDown(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("edit requests (design 3.3)", () => {
  function editing(editor: Editor, tool: ToolKind = "select") {
    const requests: (readonly [ElementId, EditRegion])[] = [];
    const bound = interactionFor(editor, tool, {
      onEditRequest: (id, region) => {
        requests.push([id, region]);
      },
    });
    return { requests, ...bound };
  }

  test("double-click on an erd.table reports the title or the row", () => {
    const editor = new Editor();
    const table = editor.createElement("erd.table", {
      visual: { x: 0, y: 0, width: 240 },
      semantic: {
        tableName: "users",
        columns: [
          { id: "id", name: "id", dataType: "uuid", pk: true },
          { id: "name", name: "name", dataType: "text" },
          { id: "email", name: "email", dataType: "text" },
        ],
      },
    });
    const { interaction, requests } = editing(editor);

    interaction.onDoubleClick(mouse(20, 10));
    interaction.onDoubleClick(mouse(20, 32 + 24 * 1 + 5));
    interaction.onDoubleClick(mouse(20, 32 + 24 * 2 + 23));
    expect(requests).toEqual([
      [table, "title"],
      [table, { row: 1 }],
      [table, { row: 2 }],
    ]);
    // Empty canvas asks for nothing.
    interaction.onDoubleClick(mouse(900, 900));
    expect(requests).toHaveLength(3);
  });

  test("uml.class rows count attributes then methods", () => {
    const editor = new Editor();
    const id = editor.createElement("uml.class", {
      visual: { x: 0, y: 0, width: 200 },
      semantic: {
        name: "Account",
        attributes: [
          { id: "a1", name: "id" },
          { id: "a2", name: "owner" },
        ],
        methods: [{ id: "m1", name: "close" }],
      },
    });
    const element = editor.store.get(id);
    const box = editor.getBounds(id);
    if (!element || !box) {
      throw new Error("expected the class to have bounds");
    }
    const at = (y: number) => editRegionAt(element, box, { x: 10, y });
    expect(at(10)).toBe("title");
    expect(at(32 + 5)).toEqual({ row: 0 });
    expect(at(32 + 22 + 5)).toEqual({ row: 1 });
    expect(at(32 + 44 + 5)).toEqual({ row: 2 });

    const bare = editor.createElement("uml.class", {
      semantic: { name: "Empty", attributes: [], methods: [] },
    });
    const bareElement = editor.store.get(bare);
    const bareBox = editor.getBounds(bare);
    if (!bareElement || !bareBox) {
      throw new Error("expected the class to have bounds");
    }
    // The reserved blank compartments are body, not a row that does not exist.
    expect(editRegionAt(bareElement, bareBox, { x: 10, y: 40 })).toBe("body");
    expect(editRegionAt(bareElement, bareBox, { x: 10, y: 60 })).toBe("body");
  });

  test("shapes report the body and connector segments insert waypoints", () => {
    const editor = new Editor();
    const a = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const b = editor.createElement("shape.geo", {
      visual: { x: 400, y: 0, width: 100, height: 100 },
    });
    const edge = editor.connect(a, b) as ElementId;
    const { interaction, requests } = editing(editor);
    const undoSize = editor.history.undoSize;

    interaction.onDoubleClick(mouse(50, 50));
    // Off the midpoint, which is where a label is added instead.
    interaction.onDoubleClick(mouse(150, 56));
    expect(requests).toEqual([[a, "body"]]);
    expect(editor.store.get(edge)?.semantic).toMatchObject({
      from: a,
      to: b,
      routing: "manual",
      routingWaypoints: [{ u: 0.25, v: 0 }],
    });
    expect([...editor.selection.ids()]).toEqual([edge]);
    expect(editor.history.undoSize).toBe(undoSize + 1);
    expect(editor.undo()).toBe(true);
    expect(editor.store.get(edge)?.semantic).toMatchObject({ from: a, to: b });
    expect(editor.store.get(edge)?.semantic).not.toHaveProperty("routing");
  });

  test("double-click on an edge label or an unlabelled midpoint edits the label", () => {
    const editor = new Editor();
    const a = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const b = editor.createElement("shape.geo", {
      visual: { x: 400, y: 0, width: 100, height: 100 },
    });
    const edge = editor.connect(a, b) as ElementId;
    const { interaction, requests } = editing(editor);

    // The route runs along y = 50; its midpoint is at x = 250.
    interaction.onDoubleClick(mouse(250, 50));
    expect(requests).toEqual([[edge, "body"]]);
    // Above an empty label there is no edge to hit: nothing happens.
    interaction.onDoubleClick(mouse(250, 20));
    expect(requests).toHaveLength(1);

    editor.setText(edge, "charges\ncard");
    // The upper line of a two-line label sits well clear of the route.
    interaction.onDoubleClick(mouse(255, 30));
    expect(requests).toEqual([
      [edge, "body"],
      [edge, "body"],
    ]);
    expect(editor.store.get(edge)?.semantic).not.toHaveProperty("routing");
  });

  test("double-click preserves an orthogonal route while converting it", () => {
    const editor = new Editor();
    const from = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const to = editor.createElement("shape.geo", {
      visual: { x: 300, y: 200, width: 100, height: 100 },
    });
    const edge = editor.connect(from, to) as ElementId;
    editor.apply([
      {
        type: "updateSemantic",
        id: edge,
        semantic: {
          from,
          to,
          routing: "orthogonal",
          routingAxis: "horizontal",
          routingBend: 0.5,
          routingAvoidObstacles: false,
        },
      },
    ]);
    const before = resolveConnector(
      editor.store.get(edge)!,
      editor.createShapeContext(),
      endpointReaderFor("edge.generic"),
    );
    const { interaction } = interactionFor(editor, "select");
    interaction.onDoubleClick(mouse(200, 100));
    const after = resolveConnector(
      editor.store.get(edge)!,
      editor.createShapeContext(),
      endpointReaderFor("edge.generic"),
    );
    expect(editor.store.get(edge)?.semantic).toMatchObject({
      routing: "manual",
    });
    const expected = [
      before?.points[0],
      before?.points[1],
      { x: 200, y: 100 },
      before?.points[2],
      before?.points[3],
    ];
    expect(after?.points).toHaveLength(expected.length);
    after?.points.forEach((point, index) => {
      expect(point.x).toBeCloseTo(expected[index]?.x ?? 0, 2);
      expect(point.y).toBeCloseTo(expected[index]?.y ?? 0, 2);
    });
  });

  test("enter and F2 edit the single selected editable element", () => {
    const { editor, shape } = harness();
    const other = editor.createElement("shape.geo", {
      visual: { x: 300, y: 0, width: 100, height: 100 },
    });
    const { interaction, requests } = editing(editor);

    interaction.onKeyDown(keyboard("Enter"));
    interaction.onKeyDown(keyboard("F2"));
    expect(requests).toEqual([
      [shape, "body"],
      [shape, "body"],
    ]);

    editor.selection.set([shape, other]);
    interaction.onKeyDown(keyboard("Enter"));
    expect(requests).toHaveLength(2);
  });

  test("placing a text note or node opens the editor immediately", () => {
    const editor = new Editor();
    const { interaction, requests, tool, setTool } = editing(
      editor,
      "text.note",
    );

    interaction.onPointerDown(pointer({ clientX: 300, clientY: 200 }));
    interaction.onPointerUp(pointer({ clientX: 300, clientY: 200 }));
    const [note] = editor.store.listElements();
    expect(note?.type).toBe("text.note");
    expect(note?.semantic).toEqual({ text: "" });
    expect(requests).toEqual([[note?.id as ElementId, "body"]]);
    expect(tool()).toBe("select");

    setTool("node.generic");
    interaction.onPointerDown(pointer({ clientX: 700, clientY: 200 }));
    interaction.onPointerUp(pointer({ clientX: 700, clientY: 200 }));
    expect(requests).toHaveLength(2);

    setTool("erd.table");
    interaction.onPointerDown(pointer({ clientX: 700, clientY: 600 }));
    interaction.onPointerUp(pointer({ clientX: 700, clientY: 600 }));
    expect(requests).toHaveLength(2);
  });

  test("a pointer down inside the slot layer starts nothing", () => {
    const { editor, interaction, shape } = harness();
    editor.selection.clear();
    const inSlot = {
      closest: (selector: string) =>
        selector === ".nodetto-slot-layer" ? {} : null,
    };
    interaction.onPointerDown(
      pointer({ clientX: 50, clientY: 50, target: inSlot }),
    );
    interaction.onPointerMove(pointer({ clientX: 90, clientY: 50 }));
    interaction.onPointerUp(pointer({ clientX: 90, clientY: 50 }));
    expect(editor.selection.size).toBe(0);
    expect(visualOf(editor, shape)).toMatchObject({ x: 0 });
  });
});

describe("context menu (design 3.6)", () => {
  function withMenu(editor: Editor) {
    const calls: {
      readonly at: { readonly screen: unknown; readonly page: unknown };
      readonly hit: ElementId | null;
    }[] = [];
    const bound = interactionFor(editor, "select", {
      onContextMenu: (at, hit) => {
        calls.push({ at, hit });
      },
    });
    return { calls, ...bound };
  }

  test("right-click selects the hit and suppresses the browser menu", () => {
    const { editor, shape } = harness();
    editor.selection.clear();
    const { interaction, calls } = withMenu(editor);

    const event = mouse(50, 50);
    interaction.onContextMenu(event);
    expect(event.defaultPrevented).toBe(true);
    expect([...editor.selection.ids()]).toEqual([shape]);
    expect(calls[0]).toEqual({
      at: { screen: { x: 50, y: 50 }, page: { x: 50, y: 50 } },
      hit: shape,
    });

    // Empty canvas reports no hit and leaves the selection alone.
    interaction.onContextMenu(mouse(900, 900));
    expect(calls[1]?.hit).toBeNull();
    expect([...editor.selection.ids()]).toEqual([shape]);
  });

  test("right-click on a member of a selected group keeps the group", () => {
    const { editor, group } = grouped();
    editor.selection.set([group]);
    const { interaction, calls } = withMenu(editor);

    interaction.onContextMenu(mouse(50, 50));
    expect(calls[0]?.hit).toBe(group);
    expect([...editor.selection.ids()]).toEqual([group]);
  });

  test("shift+F10 opens on the selection's centre", () => {
    const { editor, shape } = harness();
    const { interaction, calls } = withMenu(editor);

    interaction.onKeyDown(keyboard("F10", { shiftKey: true }));
    expect(calls[0]).toEqual({
      at: { screen: { x: 50, y: 50 }, page: { x: 50, y: 50 } },
      hit: shape,
    });
  });
});

describe("shortcutKey", () => {
  test("Option chords use the physical key macOS would otherwise rewrite", () => {
    expect(shortcutKey({ key: "¬", code: "KeyL", altKey: true }, true)).toBe(
      "l",
    );
    expect(shortcutKey({ key: "©", code: "KeyG", altKey: true }, true)).toBe(
      "g",
    );
    expect(shortcutKey({ key: "Z", code: "KeyZ", altKey: false }, true)).toBe(
      "z",
    );
    expect(
      shortcutKey({ key: "]", code: "BracketRight", altKey: true }, true),
    ).toBe("]");
  });

  test("AltGr text input elsewhere never becomes a shortcut letter", () => {
    // Polish AltGr+A arrives as Ctrl+Alt with key "ą".
    const altGr = {
      key: "ą",
      code: "KeyA",
      altKey: true,
      getModifierState: (key: string) => key === "AltGraph",
    };
    expect(shortcutKey(altGr, false)).toBe("ą");
    expect(shortcutKey(altGr, true)).toBe("ą");
    // Ctrl+Alt without AltGr off macOS keeps the layout's character too.
    expect(shortcutKey({ key: "g", code: "KeyG", altKey: true }, false)).toBe(
      "g",
    );
    expect(shortcutKey({ key: "ą", code: "KeyA", altKey: true }, false)).toBe(
      "ą",
    );
  });
});
