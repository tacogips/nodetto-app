import { UmlComponentType, UmlComponentRelationship } from "@nodetto/ir";
import { isConnectorTool } from "./tools.ts";
import { describe, expect, test } from "bun:test";
import { Editor, type Vec } from "@nodetto/core";
import { creationFor, GEO_TOOLS, Tool, TOOLS } from "./tools.ts";
import {
  ARTBOARD_SHAPES,
  COMMON_SHAPES,
  DIAGRAM_SHAPES,
  workspaceShapes,
  additionalShapes,
  artboardShapes,
} from "./shape-palette.ts";
import {
  interactionFor,
  harness,
  pointer,
} from "./interaction-test-helpers.ts";

describe("left shape palette creation", () => {
  for (const item of [
    ...COMMON_SHAPES,
    ...DIAGRAM_SHAPES,
    ...ARTBOARD_SHAPES,
  ]) {
    if (isConnectorTool(item.tool) || item.tool === Tool.Port) continue;
    test(`${item.tool} places a selected shape, resets the tool, and undoes in one step`, () => {
      const editor = new Editor();
      editor.camera.set({ x: 10, y: 20, z: 2 });
      const { interaction, tool } = interactionFor(editor, item.tool);
      interaction.onPointerDown(pointer({ clientX: 410, clientY: 320 }));
      interaction.onPointerUp(pointer({ clientX: 410, clientY: 320 }));
      const [placed] = editor.store.listElements();
      expect(placed).toBeDefined();
      expect(editor.store.size).toBe(1);
      expect(placed!.type).toBe(creationFor(item.tool)!.type);
      expect(editor.selection.has(placed!.id)).toBe(true);
      expect(tool()).toBe("select");
      if (item.tool === Tool.Frame) {
        expect(placed!.visual).toMatchObject({
          x: 35,
          y: 30,
          width: 320,
          height: 220,
          style: { fill: "none", stroke: "#64748b", strokeWidth: 1.5 },
        });
        expect(placed!.semantic).not.toHaveProperty("platform");
      }
      editor.undo();
      expect(editor.store.size).toBe(0);
      expect(editor.canUndo()).toBe(false);
      editor.redo();
      expect(editor.store.get(placed!.id)).toEqual(placed!);
      interaction.dispose();
    });
    test(`${item.tool} cannot place into a read-only document`, () => {
      const editor = new Editor();
      const { interaction } = interactionFor(editor, item.tool);
      editor.setReadOnly(true);
      interaction.onPointerDown(pointer());
      interaction.onPointerUp(pointer());
      expect(editor.store.size).toBe(0);
      expect(editor.canUndo()).toBe(false);
      interaction.dispose();
    });
  }

  test("semantic palettes preserve endpoint tools and workspace terminology", () => {
    expect(workspaceShapes("erd").map((item) => item.label)).toEqual([
      "Table",
      "View",
      "Materialized view",
      "Function",
      "Procedure",
      "Relation",
      "Foreign key",
      "Text",
      "Frame",
    ]);
    expect(workspaceShapes("sequence").map((item) => item.tool)).toEqual([
      "sequence.actor",
      "sequence.service",
      "sequence.database",
      Tool.SequenceMessage,
      "text.note",
      "frame",
    ]);
    expect(workspaceShapes("sequence")[3]?.label).toBe("Message");
    expect(workspaceShapes("app")[0]?.tool).toBe(Tool.IPhoneFrame);
    expect(workspaceShapes("web")[0]?.tool).toBe(Tool.WebFrame);
    expect(workspaceShapes("flow").map((item) => item.tool)).toContain(
      Tool.Diamond,
    );
    for (const id of [
      "erd",
      "class",
      "sequence",
      "flow",
      "app",
      "web",
      "all",
    ] as const) {
      const primary = workspaceShapes(id);
      const all = [...primary, ...additionalShapes(id), ...artboardShapes(id)];
      const tools = all.map((item) => item.tool);
      expect(new Set(tools).size).toBe(tools.length);
      for (const item of COMMON_SHAPES) expect(tools).toContain(item.tool);
      expect(primary.map((item) => item.tool)).toContain(Tool.Frame);
      expect(primary.map((item) => item.tool)).toContain(Tool.Text);
    }
  });
});

describe("creationFor", () => {
  test("gesture tools place nothing", () => {
    expect(creationFor("select")).toBeNull();
    expect(creationFor("hand")).toBeNull();
    expect(creationFor("edge")).toBeNull();
    expect(creationFor("comment")).toBeNull();
  });

  test("every geo tool maps onto shape.geo with its kind", () => {
    for (const tool of GEO_TOOLS) {
      const creation = creationFor(tool);
      expect(creation?.type).toBe("shape.geo");
      expect(creation?.semantic).toEqual({
        geo: tool.slice("geo:".length),
        label: "",
      });
    }
  });

  test("element tools place their own type with registry defaults", () => {
    expect(creationFor("erd.table")).toEqual({ type: "erd.table" });
    expect(creationFor("uml.class")).toEqual({ type: "uml.class" });
    expect(creationFor("node.generic")).toEqual({ type: "node.generic" });
  });

  test("sequence tools carry participant-kind intent", () => {
    expect(creationFor("sequence.actor")).toEqual({
      type: "sequence.participant",
      semantic: { kind: "actor" },
    });
    expect(creationFor("sequence.service")).toEqual({
      type: "sequence.participant",
      semantic: { kind: "service" },
    });
    expect(creationFor("sequence.database")).toEqual({
      type: "sequence.participant",
      semantic: { kind: "db" },
    });
  });

  test("mobile artboard tools carry platform-safe content insets", () => {
    expect(creationFor("frame:iphone")).toMatchObject({
      semantic: {
        platform: "ios",
        safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
      },
    });
    expect(creationFor("frame:android")).toMatchObject({
      semantic: {
        platform: "android",
        safeArea: { top: 24, right: 0, bottom: 24, left: 0 },
      },
    });
    expect(creationFor("frame:web")?.semantic).not.toHaveProperty("safeArea");
  });

  test("every tool is either a gesture or a creation", () => {
    const gestures = new Set([
      "select",
      "hand",
      "comment",
      "edge",
      Tool.ScreenTransition,
      "draw.freehand",
      "edit.points",
      "edit.paint",
      "edit.stroke-paint",
      "crop",
      Tool.Dependency,
      Tool.Realization,
      Tool.ComponentConnector,
      Tool.Relation,
      Tool.ForeignKey,
      Tool.Association,
      Tool.SequenceMessage,
      Tool.StateTransition,
      Tool.UseCaseAssociation,
      Tool.UseCaseInclude,
      Tool.UseCaseExtend,
      Tool.UseCaseGeneralization,
    ]);
    for (const tool of TOOLS) {
      expect(creationFor(tool) === null).toBe(gestures.has(tool));
    }
  });
});

test("comment placement reports an exact page point and returns to Select", () => {
  const editor = new Editor();
  editor.camera.set({ x: 10, y: -5, z: 2 });
  const placed: Vec[] = [];
  const { interaction, tool } = interactionFor(editor, "comment", {
    onCommentPlace: (point) => placed.push(point),
  });
  interaction.onPointerDown(pointer({ clientX: 100, clientY: 70 }));
  expect(placed).toEqual([{ x: 40, y: 40 }]);
  expect(tool()).toBe("select");
  expect(editor.getSnapshot().elements).toHaveLength(0);
});

test("typed drawing tools and endpoint drags reject incompatible shapes", () => {
  for (const [tool, type, connector] of [
    [Tool.ForeignKey, "erd.table", "erd.relation"],
    [Tool.Association, "uml.class", "uml.association"],
    [Tool.SequenceMessage, "sequence.participant", "sequence.message"],
  ] as const) {
    const editor = new Editor();
    const a = editor.createElement(type, { visual: { x: 0, y: 0 } });
    const b = editor.createElement(type, { visual: { x: 400, y: 0 } });
    const note = editor.createElement("text.note", {
      visual: { x: 800, y: 0 },
    });
    const { interaction, setTool } = interactionFor(editor, tool);
    const point = (id: string) => {
      const box = editor.registry
        .get(editor.store.get(id)!.type)!
        .getBounds(editor.store.get(id)!, editor.createShapeContext(1));
      if (!box) throw new Error("expected endpoint bounds");
      return pointer({ clientX: box.x + box.width / 2, clientY: box.y + 10 });
    };
    interaction.onPointerDown(point(note));
    expect(interaction.pending()).toBeNull();
    interaction.onPointerDown(point(a));
    interaction.onPointerMove(point(note));
    expect(interaction.hoverTarget()).toBeNull();
    interaction.onPointerUp(point(note));
    expect(
      editor
        .getSnapshot()
        .elements.filter((element) => element.type === connector),
    ).toHaveLength(0);
    setTool(tool);
    interaction.onPointerDown(point(a));
    interaction.onPointerMove(point(b));
    interaction.onPointerUp(point(b));
    const edge = editor
      .getSnapshot()
      .elements.find((element) => element.type === connector)!;
    expect(edge).toBeDefined();
    const before = editor.getSnapshot();
    interaction.startReconnect(edge.id, "to", point(b));
    interaction.onPointerMove(point(note));
    expect(interaction.hoverTarget()).toBeNull();
    interaction.onPointerUp(point(note));
    expect(editor.getSnapshot()).toEqual(before);
  }
});

describe("component mode pointer authoring", () => {
  test("port placement requires a component and keeps its tool until attached", () => {
    const editor = new Editor();
    const owner = editor.createElement(UmlComponentType.Component, {
      visual: { x: 100, y: 100, width: 180, height: 100 },
    });
    const { interaction, tool } = interactionFor(editor, Tool.Port);
    interaction.onPointerDown(pointer({ clientX: 20, clientY: 20 }));
    interaction.onPointerUp(pointer({ clientX: 20, clientY: 20 }));
    expect(editor.store.size).toBe(1);
    expect(tool()).toBe(Tool.Port);
    interaction.onPointerDown(pointer({ clientX: 278, clientY: 150 }));
    interaction.onPointerUp(pointer({ clientX: 278, clientY: 150 }));
    const port = editor.store
      .listElements()
      .find((item) => item.type === UmlComponentType.Port);
    expect(port?.semantic).toMatchObject({ owner, side: "right", offset: 0.5 });
    expect([...editor.selection.ids()]).toEqual([port!.id]);
    expect(tool()).toBe(Tool.Select);
    editor.undo();
    expect(editor.store.size).toBe(1);
    interaction.dispose();
  });
  for (const [tool, kind] of [
    [Tool.Dependency, UmlComponentRelationship.Dependency],
    [Tool.Realization, UmlComponentRelationship.Realization],
    [Tool.ComponentConnector, UmlComponentRelationship.Connector],
  ] as const) {
    test(`${tool} drags a typed relationship and refuses class endpoints`, () => {
      const editor = new Editor();
      const a = editor.createElement(UmlComponentType.Component, {
        visual: { x: 0, y: 0 },
      });
      const b = editor.createElement(UmlComponentType.Component, {
        visual: { x: 300, y: 0 },
      });
      editor.createElement("uml.class", { visual: { x: 600, y: 0 } });
      const { interaction } = interactionFor(editor, tool);
      interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
      interaction.onPointerUp(pointer({ clientX: 350, clientY: 50 }));
      const edge = editor.store
        .listElements()
        .find((item) => item.type === UmlComponentType.Relationship);
      expect(edge?.semantic).toEqual({ from: a, to: b, kind });
      interaction.onPointerDown(pointer({ clientX: 50, clientY: 50 }));
      interaction.onPointerUp(pointer({ clientX: 650, clientY: 50 }));
      expect(
        editor.store
          .listElements()
          .filter((item) => item.type === UmlComponentType.Relationship),
      ).toHaveLength(1);
      editor.undo();
      expect(editor.store.get(edge?.id ?? "")).toBeUndefined();
      interaction.dispose();
    });
  }
});

describe("use-case mode pointer authoring", () => {
  for (const kind of [
    "association",
    "include",
    "extend",
    "generalization",
  ] as const) {
    const tool = `usecase:${kind}` as const;
    test(`${tool} drags a typed relationship and refuses other endpoints`, () => {
      const editor = new Editor();
      const actor = editor.createElement("usecase.node", {
        semantic: { name: "Member", kind: "actor" },
        visual: { x: 0, y: 0 },
      });
      const useCase = editor.createElement("usecase.node", {
        semantic: { name: "Borrow", kind: "usecase" },
        visual: { x: 300, y: 0 },
      });
      editor.createElement("uml.class", { visual: { x: 600, y: 0 } });
      const { interaction } = interactionFor(editor, tool);
      interaction.onPointerDown(pointer({ clientX: 32, clientY: 56 }));
      interaction.onPointerUp(pointer({ clientX: 380, clientY: 36 }));
      const edge = editor.store
        .listElements()
        .find((item) => item.type === "usecase.relationship");
      expect(edge?.semantic).toMatchObject({ from: actor, to: useCase, kind });
      interaction.onPointerDown(pointer({ clientX: 32, clientY: 56 }));
      interaction.onPointerUp(pointer({ clientX: 650, clientY: 50 }));
      expect(
        editor.store
          .listElements()
          .filter((item) => item.type === "usecase.relationship"),
      ).toHaveLength(1);
      editor.undo();
      expect(editor.store.get(edge?.id ?? "")).toBeUndefined();
      interaction.dispose();
    });
  }

  test("node tools place each kind at its own default size", () => {
    for (const [tool, width, height] of [
      [Tool.UseCaseActor, 64, 112],
      [Tool.UseCase, 160, 72],
      [Tool.UseCaseSystem, 400, 320],
    ] as const) {
      const editor = new Editor();
      const { interaction } = interactionFor(editor, tool);
      interaction.onPointerDown(pointer({ clientX: 100, clientY: 100 }));
      interaction.onPointerUp(pointer({ clientX: 100, clientY: 100 }));
      const [placed] = editor.store.listElements();
      expect(placed?.type).toBe("usecase.node");
      expect(placed?.visual).toMatchObject({ width, height });
      interaction.dispose();
    }
  });
});

test("palette drops share click creation, select the new element and remain one undo step", () => {
  for (const tool of [Tool.Rectangle, Tool.Table, Tool.Class, Tool.Service]) {
    const { editor } = harness();
    const { interaction } = interactionFor(editor, "select");
    const before = editor.getSnapshot();
    interaction.placeTool(tool, { x: 500, y: 300 });
    expect(editor.store.listElements()).toHaveLength(
      before.elements.length + 1,
    );
    const [id] = editor.selection.ids();
    const created = id ? editor.store.get(id) : undefined;
    expect(created?.type).toBe(creationFor(tool)?.type);
    editor.undo();
    expect(editor.getSnapshot()).toEqual(before);
  }
});

describe("state transition authoring gestures", () => {
  test("palette creation, transition drawing, self-loops and undo", () => {
    const editor = new Editor();
    const { interaction, setTool } = interactionFor(editor, Tool.State);
    interaction.onPointerDown(pointer({ clientX: 100, clientY: 100 }));
    interaction.onPointerUp(pointer({ clientX: 100, clientY: 100 }));
    const a = [...editor.selection.ids()][0]!;
    expect(editor.store.get(a)?.type).toBe("state.node");
    setTool(Tool.State);
    interaction.onPointerDown(pointer({ clientX: 400, clientY: 100 }));
    interaction.onPointerUp(pointer({ clientX: 400, clientY: 100 }));
    const b = [...editor.selection.ids()][0]!;
    setTool(Tool.StateTransition);
    interaction.onPointerDown(pointer({ clientX: 100, clientY: 100 }));
    interaction.onPointerMove(pointer({ clientX: 400, clientY: 100 }));
    interaction.onPointerUp(pointer({ clientX: 400, clientY: 100 }));
    const edge = editor.store.get([...editor.selection.ids()][0]!)!;
    expect(edge.type).toBe("state.transition");
    expect(edge.semantic).toMatchObject({ from: a, to: b });
    editor.undo();
    expect(editor.store.get(edge.id)).toBeUndefined();
    editor.redo();
    setTool(Tool.StateTransition);
    interaction.onPointerDown(pointer({ clientX: 100, clientY: 100 }));
    interaction.onPointerMove(pointer({ clientX: 100, clientY: 20 }));
    interaction.onPointerUp(pointer({ clientX: 100, clientY: 100 }));
    expect(
      editor.store.get([...editor.selection.ids()][0]!)?.semantic,
    ).toMatchObject({ from: a, to: a });
  });
});

describe("logical relation and foreign key tools", () => {
  for (const tool of [Tool.Relation, Tool.ForeignKey]) {
    test(`${tool} creates the requested constraint kind in one undo step`, () => {
      const editor = new Editor();
      const a = editor.createElement("erd.table", { visual: { x: 0, y: 0 } });
      const b = editor.createElement("erd.table", { visual: { x: 400, y: 0 } });
      const before = editor.history.undoSize;
      const { interaction } = interactionFor(editor, tool);
      interaction.onPointerDown(pointer({ clientX: 40, clientY: 20 }));
      interaction.onPointerMove(pointer({ clientX: 440, clientY: 20 }));
      interaction.onPointerUp(pointer({ clientX: 440, clientY: 20 }));
      const id = [...editor.selection.ids()][0]!;
      expect(editor.store.get(id)?.semantic).toMatchObject({
        from: { table: a },
        to: { table: b },
      });
      expect(
        (editor.store.get(id)?.semantic as { logical?: boolean }).logical ===
          true,
      ).toBe(tool === Tool.Relation);
      expect(editor.history.undoSize).toBe(before + 1);
      editor.undo();
      expect(editor.store.get(id)).toBeUndefined();
      interaction.dispose();
    });
  }
});
