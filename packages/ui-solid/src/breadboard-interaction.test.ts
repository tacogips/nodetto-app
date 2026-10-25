import { describe, expect, test } from "bun:test";
import { breadboardPins, Editor } from "@nodetto/core";
import { breadboardOverlayModel } from "./breadboard-overlay.ts";
import { createInteraction, type SnapSettings } from "./interaction.ts";
import { Tool, type ToolKind } from "./tools.ts";

function makeInteraction(initial: ToolKind, snapSettings?: SnapSettings) {
  const editor = new Editor();
  editor.setPageKind(editor.currentPageId, "breadboard");
  let tool = initial;
  const interaction = createInteraction(editor, {
    tool: () => tool,
    ...(snapSettings ? { snap: () => snapSettings } : {}),
    setTool: (value) => {
      tool = value;
    },
    container: () => undefined,
  });
  return { editor, interaction, tool: () => tool };
}

function key(keyValue: string, shiftKey = false): KeyboardEvent {
  return {
    key: keyValue,
    shiftKey,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    isComposing: false,
    target: null,
    preventDefault() {},
  } as unknown as KeyboardEvent;
}

function pointer(clientX: number, clientY: number): PointerEvent {
  return {
    clientX,
    clientY,
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

describe("breadboard interaction", () => {
  test("places parts on the hole lattice with automatic references", () => {
    const { editor, interaction } = makeInteraction(Tool.BreadboardResistor);
    interaction.placeTool(Tool.BreadboardResistor, { x: 33, y: 47 });
    const resistor = editor.store.getPageElements(editor.currentPageId)[0];
    if (!resistor) throw new Error("Expected resistor placement");
    expect(resistor?.semantic).toMatchObject({ reference: "R1" });
    expect(
      breadboardPins(resistor).find((pin) => pin.number === 1),
    ).toMatchObject({
      x: 30,
      y: 50,
    });
  });

  test("finishes a snapped wire draft with Enter and cancels a short draft", () => {
    const { editor, interaction, tool } = makeInteraction(Tool.BreadboardWire);
    interaction.placeTool(Tool.BreadboardWire, { x: 12, y: 9 });
    interaction.placeTool(Tool.BreadboardWire, { x: 40, y: 9 });
    interaction.placeTool(Tool.BreadboardWire, { x: 40, y: 31 });
    interaction.onKeyDown(key("Enter"));
    const wire = editor.store.getPageElements(editor.currentPageId)[0];
    expect(wire?.type).toBe("breadboard.wire");
    expect(wire?.visual).toMatchObject({ x: 10, y: 10 });
    expect(wire?.semantic).toMatchObject({
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 20 },
      ],
    });
    expect(tool()).toBe(Tool.Select);

    const second = makeInteraction(Tool.BreadboardWire);
    second.interaction.placeTool(Tool.BreadboardWire, { x: 10, y: 10 });
    second.interaction.onKeyDown(key("Enter"));
    expect(
      second.editor.store.getPageElements(second.editor.currentPageId),
    ).toHaveLength(0);

    const third = makeInteraction(Tool.BreadboardWire);
    third.interaction.placeTool(Tool.BreadboardWire, { x: 10, y: 10 });
    third.interaction.onKeyDown(key("Escape"));
    expect(
      third.editor.store.getPageElements(third.editor.currentPageId),
    ).toHaveLength(0);
    expect(third.interaction.wireDraft()).toBeNull();
  });

  test("Escape clears the active breadboard probe", () => {
    const { editor, interaction } = makeInteraction(Tool.Select);
    editor.setBreadboardProbe({
      pageId: editor.currentPageId,
      elementIds: [],
    });
    expect(editor.breadboardProbe()).not.toBeNull();
    interaction.onKeyDown(key("Escape"));
    expect(editor.breadboardProbe()).toBeNull();
  });

  test("r rotates a selected breadboard part and Shift+R reverses it", () => {
    const { editor, interaction } = makeInteraction(Tool.Select);
    const id = editor.createBreadboardPart("breadboard.resistor", {
      x: 20,
      y: 20,
    });
    if (!id) throw new Error("Expected resistor creation");
    editor.selection.set([id]);
    interaction.onKeyDown(key("r"));
    expect(editor.store.get(id)?.visual.rotation).toBe(90);
    interaction.onKeyDown(key("r", true));
    expect(editor.store.get(id)?.visual.rotation).toBe(0);
  });

  test("r keeps the rectangle tool fallback without a selected part", () => {
    const breadboard = makeInteraction(Tool.Select);
    breadboard.interaction.onKeyDown(key("r"));
    expect(breadboard.tool()).toBe(Tool.Rectangle);

    const freeform = new Editor();
    let tool: ToolKind = Tool.Select;
    const interaction = createInteraction(freeform, {
      tool: () => tool,
      setTool: (value) => {
        tool = value;
      },
      container: () => undefined,
    });
    interaction.onKeyDown(key("r"));
    expect(String(tool)).toBe(Tool.Rectangle);
  });

  test("drags a selected wire bend to a snapped hole", () => {
    const { editor, interaction } = makeInteraction(Tool.Select);
    const wireId = editor.createBreadboardPart(
      "breadboard.wire",
      { x: 10, y: 10 },
      {
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 20 },
        ],
      },
    );
    if (!wireId) throw new Error("Expected wire creation");
    editor.selection.set([wireId]);
    interaction.startBreadboardWirePoint(wireId, 1, pointer(40, 10));
    interaction.onPointerMove(pointer(57, 23));
    interaction.onPointerUp(pointer(57, 23));
    expect(editor.store.get(wireId)?.semantic).toMatchObject({
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 10 },
        { x: 30, y: 20 },
      ],
    });
  });

  test("snaps moved part pins only while UI snapping is enabled", () => {
    for (const grid of [true, false]) {
      const { editor, interaction } = makeInteraction(Tool.Select, {
        grid,
        objects: false,
        guides: false,
      });
      const id = editor.createBreadboardPart("breadboard.resistor", {
        x: 33,
        y: 47,
      });
      if (!id) throw new Error("Expected resistor placement");
      const element = editor.store.get(id);
      if (!element) throw new Error("Expected resistor element");
      const pinBefore = breadboardPins(element).find((pin) => pin.number === 1);
      if (!pinBefore) throw new Error("Expected resistor pin");
      editor.selection.set([id]);
      const bounds = editor.getBounds(id);
      if (!bounds) throw new Error("Expected resistor bounds");
      const start = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
      interaction.onPointerDown(pointer(start.x, start.y));
      interaction.onPointerMove(pointer(start.x + 7, start.y + 4));
      interaction.onPointerUp(pointer(start.x + 7, start.y + 4));
      const moved = editor.store.get(id);
      if (!moved) throw new Error("Expected moved resistor");
      const pinAfter = breadboardPins(moved).find((pin) => pin.number === 1);
      expect(pinAfter).toMatchObject(
        grid ? { x: 40, y: 50 } : { x: pinBefore.x + 7, y: pinBefore.y + 4 },
      );
    }
  });

  test("overlay targets honor priority and ratsnest lines disappear when wired", () => {
    const editor = new Editor();
    editor.setPageKind(editor.currentPageId, "breadboard");
    const firstId = editor.createBreadboardPart("breadboard.resistor", {
      x: 10,
      y: 10,
    });
    const secondId = editor.createBreadboardPart("breadboard.resistor", {
      x: 100,
      y: 100,
    });
    if (!firstId || !secondId) throw new Error("Expected resistor creation");
    const first = editor.store.get(firstId);
    const second = editor.store.get(secondId);
    if (!first || !second) throw new Error("Expected resistor elements");
    const firstPin = breadboardPins(first).find((pin) => pin.number === 1);
    const secondPin = breadboardPins(second).find((pin) => pin.number === 1);
    if (!firstPin || !secondPin) throw new Error("Expected resistor pins");
    const pageId = editor.currentPageId;
    const probe = {
      pageId,
      elementIds: [secondId],
      pin: { elementId: secondId, pin: 1 },
    };
    const targetId = editor.createBreadboardPart(
      "breadboard.netlist",
      {
        x: 0,
        y: 0,
      },
      {
        source: "manual",
        format: "kicad_net",
        parts: [],
        nets: [
          {
            name: "N1",
            nodes: [
              { reference: "R1", pin: 1 },
              { reference: "R2", pin: 1 },
            ],
          },
        ],
      },
    );
    if (!targetId) throw new Error("Expected target netlist creation");

    const hoverWins = breadboardOverlayModel(editor.getSnapshot(), pageId, {
      hover: { elementId: firstId, pin: 1 },
      probe,
      selection: [],
    });
    expect(hoverWins.highlight?.pins).toEqual([{ elementId: firstId, pin: 1 }]);

    const wireId = editor.createBreadboardPart(
      "breadboard.wire",
      { x: firstPin.x, y: firstPin.y },
      {
        points: [
          { x: 0, y: 0 },
          { x: secondPin.x - firstPin.x, y: secondPin.y - firstPin.y },
        ],
      },
    );
    if (!wireId) throw new Error("Expected jumper wire creation");
    const probeWins = breadboardOverlayModel(editor.getSnapshot(), pageId, {
      hover: null,
      probe: {
        ...probe,
        pin: { elementId: secondId, pin: 2 },
      },
      selection: [wireId],
    });
    expect(probeWins.highlight?.pins).toContainEqual({
      elementId: secondId,
      pin: 2,
    });
    expect(probeWins.highlight?.pins).not.toContainEqual({
      elementId: firstId,
      pin: 1,
    });
    expect(probeWins.ratsnest).toEqual([]);

    const empty = new Editor();
    empty.setPageKind(empty.currentPageId, "breadboard");
    expect(
      breadboardOverlayModel(empty.getSnapshot(), empty.currentPageId, {
        hover: null,
        probe: null,
        selection: [],
      }),
    ).toEqual({ highlight: null, ratsnest: [] });

    const disconnected = new Editor();
    disconnected.setPageKind(disconnected.currentPageId, "breadboard");
    const left = disconnected.createBreadboardPart("breadboard.resistor", {
      x: 10,
      y: 10,
    });
    const right = disconnected.createBreadboardPart("breadboard.resistor", {
      x: 100,
      y: 100,
    });
    if (!left || !right) throw new Error("Expected disconnected parts");
    disconnected.createBreadboardPart(
      "breadboard.netlist",
      { x: 0, y: 0 },
      {
        source: "manual",
        format: "kicad_net",
        parts: [],
        nets: [
          {
            name: "N1",
            nodes: [
              { reference: "R1", pin: 1 },
              { reference: "R2", pin: 1 },
            ],
          },
        ],
      },
    );
    const beforeWire = breadboardOverlayModel(
      disconnected.getSnapshot(),
      disconnected.currentPageId,
      { hover: null, probe: null, selection: [] },
    );
    expect(beforeWire.ratsnest).toHaveLength(1);
  });
});
