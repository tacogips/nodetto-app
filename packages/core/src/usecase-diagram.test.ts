import { describe, expect, test } from "bun:test";
import { USECASE_NODE_KINDS, validateDocument } from "@nodetto/ir";
import {
  availableMermaidKinds,
  exportMermaid,
  parseDocument,
  serializeDocument,
} from "@nodetto/io";
import { makeEditor } from "./test-helpers.ts";
import {
  connectorDecoration,
  connectorDefaultDash,
} from "./shapes/connector.ts";
import { geoOutline } from "./shapes/geo-outline.ts";
import { useCaseNodeNotation } from "./shapes/usecase.ts";
import {
  Tool,
  creationFor,
  isConnectorTool,
  typedConnectorFor,
  useCaseRelationshipFor,
} from "./tools.ts";

describe("UML use-case diagrams", () => {
  test("each node kind gets its own default size", () => {
    const editor = makeEditor();
    const sizes = USECASE_NODE_KINDS.map((kind) => {
      const id = editor.createElement("usecase.node", {
        semantic: { name: kind, kind },
      });
      const { width, height } = editor.getBounds(id)!;
      return { kind, width, height };
    });
    expect(sizes).toEqual([
      { kind: "actor", width: 64, height: 112 },
      { kind: "usecase", width: 160, height: 72 },
      { kind: "system", width: 400, height: 320 },
    ]);
    const fallback = editor.createElement("usecase.node");
    expect(editor.store.get(fallback)?.semantic).toEqual({
      name: "Use case",
      kind: "usecase",
    });
  });

  test("notation draws a stick figure, an ellipse and a titled boundary", () => {
    const editor = makeEditor();
    const actor = editor.createElement("usecase.node", {
      semantic: { name: "Member", kind: "actor" },
    });
    const parts = useCaseNodeNotation(
      editor.store.get(actor)!,
      editor.getBounds(actor)!,
    );
    expect(parts.map((part) => part.role)).toEqual([
      "usecase-actor-head",
      "usecase-actor-body",
      "usecase-name",
    ]);
    const box = editor.getBounds(actor)!;
    const name = parts.find((part) => part.kind === "text");
    expect(name && name.kind === "text" && name.lines).toEqual(["Member"]);
    // The name sits below the figure but inside the box.
    expect(name && name.kind === "text" && name.y).toBeLessThanOrEqual(
      box.y + box.height,
    );

    const system = editor.createElement("usecase.node", {
      semantic: { name: "Lending desk", kind: "system" },
    });
    const boundary = useCaseNodeNotation(
      editor.store.get(system)!,
      editor.getBounds(system)!,
    );
    expect(boundary[0]).toMatchObject({ kind: "rect", fill: "none" });
    expect(boundary[1]).toMatchObject({
      kind: "text",
      lines: ["Lending desk"],
    });

    const useCase = editor.createElement("usecase.node", {
      semantic: { name: "Borrow item", kind: "usecase" },
    });
    expect(
      useCaseNodeNotation(
        editor.store.get(useCase)!,
        editor.getBounds(useCase)!,
      ).map((part) => part.kind),
    ).toEqual(["path", "text"]);
  });

  test("hit testing follows each kind's outline", () => {
    const editor = makeEditor();
    const context = editor.createShapeContext();
    const hit = (kind: string, x: number, y: number) => {
      const id = editor.createElement("usecase.node", {
        semantic: { name: "", kind },
      });
      const element = editor.store.get(id)!;
      return editor
        .getShapeUtil(element.type)
        .hitTest(element, { x, y }, context);
    };
    expect(hit("actor", 2, 2)).toBe(true);
    expect(hit("usecase", 80, 36)).toBe(true);
    expect(hit("usecase", 2, 2)).toBe(false);
    // The system boundary picks on its border and title strip only.
    expect(hit("system", 3, 200)).toBe(true);
    expect(hit("system", 200, 12)).toBe(true);
    expect(hit("system", 200, 200)).toBe(false);
  });

  test("a use case inside a system boundary stays clickable", () => {
    const editor = makeEditor();
    const inside = editor.createElement("usecase.node", {
      semantic: { name: "Borrow", kind: "usecase" },
      visual: { x: 100, y: 100 },
    });
    const system = editor.createElement("usecase.node", {
      semantic: { name: "Desk", kind: "system" },
    });
    expect(editor.hitTest({ x: 180, y: 136 })).toBe(inside);
    expect(editor.hitTest({ x: 200, y: 10 })).toBe(system);
  });

  test("relationships connect only use-case nodes and decorate by kind", () => {
    const editor = makeEditor();
    const actor = editor.createElement("usecase.node", {
      semantic: { name: "Member", kind: "actor" },
    });
    const borrow = editor.createElement("usecase.node", {
      visual: { x: 300 },
    });
    const check = editor.createElement("usecase.node", {
      visual: { x: 300, y: 200 },
    });
    const association = editor.connectSmart(actor, borrow)!;
    expect(editor.store.get(association)?.semantic).toEqual({
      from: actor,
      to: borrow,
      kind: "association",
    });
    const include = editor.connectUseCase(borrow, check, "include")!;
    const extend = editor.connectUseCase(check, borrow, "extend")!;
    const general = editor.connectUseCase(borrow, check, "generalization")!;
    const decoration = (id: string) =>
      connectorDecoration(editor.store.get(id)!);
    expect(decoration(association)).toEqual({
      start: null,
      end: null,
      label: "",
    });
    expect(decoration(include)).toEqual({
      start: null,
      end: "openArrow",
      label: "«include»",
    });
    expect(decoration(general)).toEqual({
      start: null,
      end: "triangle",
      label: "",
    });
    expect(connectorDefaultDash(editor.store.get(include)!)).toBe("6 4");
    expect(connectorDefaultDash(editor.store.get(general)!)).toBeUndefined();

    // Double-click edits the optional label; an empty edit drops the key.
    expect(editor.editableField(extend)).toBe("label");
    expect(editor.setText(extend, "after hours")).toBe(true);
    expect(decoration(extend).label).toBe("«extend»\nafter hours");
    expect(editor.setText(extend, "")).toBe(true);
    expect(editor.store.get(extend)?.semantic).not.toHaveProperty("label");
    expect(editor.editableField(actor)).toBe("name");

    const note = editor.createElement("text.note");
    expect(editor.connectUseCase(actor, note, "association")).toBeNull();
    expect(editor.connectUseCase(actor, actor, "association")).toBeNull();
    expect(() =>
      editor.apply([
        {
          type: "updateSemantic",
          id: association,
          semantic: { from: actor, to: note, kind: "association" },
        },
      ]),
    ).toThrow();

    editor.selection.set([borrow]);
    editor.deleteSelection();
    expect(editor.store.get(association)).toBeUndefined();
    editor.undo();
    expect(editor.store.get(association)).toBeDefined();
  });

  test("the page persists, exports to SVG and degrades in Mermaid", () => {
    const editor = makeEditor();
    editor.setPageKind(editor.currentPageId, "uml");
    const actor = editor.createElement("usecase.node", {
      semantic: { name: "Member", kind: "actor" },
    });
    const borrow = editor.createElement("usecase.node", {
      semantic: { name: "Borrow <item>", kind: "usecase" },
      visual: { x: 200 },
    });
    const check = editor.createElement("usecase.node", {
      semantic: { name: "Check card", kind: "usecase" },
      visual: { x: 200, y: 200 },
    });
    editor.connectSmart(actor, borrow);
    editor.connectUseCase(borrow, check, "include");
    const snapshot = editor.getSnapshot();
    expect(
      validateDocument(snapshot).filter((issue) => issue.severity === "error"),
    ).toEqual([]);
    const saved = serializeDocument(snapshot);
    expect(serializeDocument(parseDocument(saved))).toBe(saved);
    const svg = editor.exportPageSvg()!;
    expect(svg).toContain("usecase-actor-head");
    expect(svg).toContain("usecase-actor-body");
    expect(svg).toContain("Borrow &lt;item&gt;");
    expect(svg).toContain("«include»");
    expect(svg).not.toContain("unsupported");
    // Mermaid has no use-case diagram, so the page offers no Mermaid kind.
    expect(availableMermaidKinds(snapshot, editor.currentPageId)).toEqual([]);
    expect(
      exportMermaid(snapshot, editor.currentPageId, "flowchart").elementCount,
    ).toBe(0);
  });
});

describe("use-case tools", () => {
  test("node tools create sized use-case nodes and connectors create nothing", () => {
    expect(creationFor(Tool.UseCaseActor)).toEqual({
      type: "usecase.node",
      semantic: { name: "Actor", kind: "actor" },
      visual: { width: 64, height: 112 },
    });
    expect(creationFor(Tool.UseCase)?.visual).toEqual({
      width: 160,
      height: 72,
    });
    expect(creationFor(Tool.UseCaseSystem)?.semantic).toEqual({
      name: "System",
      kind: "system",
    });
    for (const [tool, kind] of [
      [Tool.UseCaseAssociation, "association"],
      [Tool.UseCaseInclude, "include"],
      [Tool.UseCaseExtend, "extend"],
      [Tool.UseCaseGeneralization, "generalization"],
    ] as const) {
      expect(creationFor(tool)).toBeNull();
      expect(useCaseRelationshipFor(tool)).toBe(kind);
      expect(isConnectorTool(tool)).toBe(true);
      expect(typedConnectorFor(tool)).toBe("usecase.relationship");
    }
    expect(useCaseRelationshipFor(Tool.Dependency)).toBeUndefined();
    expect(creationFor(Tool.Package)).toEqual({
      type: "shape.geo",
      semantic: { geo: "package", label: "" },
    });
  });

  test("the package outline has a name tab on the top-left", () => {
    const outline = geoOutline("package", 200, 140);
    expect(outline.kind).toBe("polygon");
    if (outline.kind !== "polygon") return;
    expect(outline.points).toBe("1,1 81,1 81,19 199,19 199,139 1,139");
    expect(outline.detail).toBe("M 1 19 L 81 19");
  });
});
