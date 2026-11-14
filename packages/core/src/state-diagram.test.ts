import { describe, expect, test } from "bun:test";
import {
  STATE_NODE_KINDS,
  getElementTypeDefinition,
  validateDocument,
} from "@nodetto/ir";
import {
  availableMermaidKinds,
  exportMermaid,
  parseDocument,
  serializeDocument,
} from "@nodetto/io";
import { makeEditor } from "./test-helpers.ts";
import {
  connectorDecoration,
  readDirectEndpoints,
  resolveConnector,
} from "./shapes/connector.ts";
import { stateNodeNotation } from "./shapes/state.ts";

describe("state transition diagrams", () => {
  test("all notation kinds persist and export with transition semantics", () => {
    const editor = makeEditor();
    editor.setPageKind(editor.currentPageId, "state");
    const ids = STATE_NODE_KINDS.map((kind, i) =>
      editor.createElement("state.node", {
        semantic: { kind, name: kind === "state" ? "Ready <safe>" : "" },
        visual: {
          x: i * 240,
          y: 100,
          width: kind === "state" ? 160 : 32,
          height: kind === "state" ? 72 : 32,
        },
      }),
    );
    const edges = ids.slice(1).map((id) => editor.connectSmart(ids[0]!, id)!);
    editor.apply([
      {
        type: "updateSemantic",
        id: edges[0]!,
        semantic: {
          from: ids[0],
          to: ids[1],
          trigger: "start",
          guard: "ready",
          effect: "run()",
        },
      },
    ]);
    expect(connectorDecoration(editor.store.get(edges[0]!)!)).toEqual({
      start: null,
      end: "arrow",
      label: "start [ready] / run()",
    });
    for (const id of edges)
      expect(editor.store.get(id)?.type).toBe("state.transition");
    const snapshot = editor.getSnapshot();
    expect(
      validateDocument(snapshot).filter((issue) => issue.severity === "error"),
    ).toEqual([]);
    const saved = serializeDocument(snapshot);
    expect(serializeDocument(parseDocument(saved))).toBe(saved);
    const svg = editor.exportPageSvg();
    expect(svg).toContain("Ready &lt;safe&gt;");
    expect(svg).toContain("start [ready] / run()");
    expect(svg).not.toContain("unsupported");
    expect(availableMermaidKinds(snapshot, editor.currentPageId)).toContain(
      "stateDiagram-v2",
    );
    const mermaid = exportMermaid(
      snapshot,
      editor.currentPageId,
      "stateDiagram-v2",
    );
    expect(mermaid.relationCount).toBe(3);
    expect(mermaid.code).toContain("<<choice>>");
    expect(mermaid.code).toContain("[*]");
    expect(mermaid.code).toContain("start [ready] / run()");
  });
  test("self-transitions have a visible loop that follows the state", () => {
    const editor = makeEditor();
    const node = editor.createElement("state.node", {
      visual: { x: 100, y: 100 },
    });
    const id = editor.connectSmart(node, node)!;
    const route = () =>
      resolveConnector(
        editor.store.get(id)!,
        editor.createShapeContext(),
        readDirectEndpoints,
      )!;
    const before = route();
    expect(before.points.length).toBe(5);
    expect(before.start).not.toEqual(before.end);
    editor.selection.set([node]);
    editor.moveElements([{ id: node, x: 140, y: 120 }]);
    expect(route().start.x).toBe(before.start.x + 40);
    expect(route().start.y).toBe(before.start.y + 20);
    expect(editor.exportPageSvg()).not.toContain("NaN");
  });
  test("endpoint validation, deletion, duplication, undo and readonly use existing editor policies", () => {
    const editor = makeEditor();
    const a = editor.createElement("state.node");
    const b = editor.createElement("state.node", { visual: { x: 300 } });
    const edge = editor.connectSmart(a, b)!;
    const other = editor.createElement("node.generic");
    expect(() =>
      editor.apply([
        { type: "updateSemantic", id: edge, semantic: { from: a, to: other } },
      ]),
    ).toThrow();
    editor.selection.set([a, b, edge]);
    const copies = editor
      .duplicateSelection()
      .map((id) => editor.store.get(id)!);
    const copiedEdge = copies.find((e) => e.type === "state.transition")!;
    const copiedIds = copies.map((e) => e.id);
    expect(copiedIds).toContain((copiedEdge.semantic as { from: string }).from);
    editor.selection.set([a]);
    editor.deleteSelection();
    expect(editor.store.get(edge)).toBeUndefined();
    editor.undo();
    expect(editor.store.get(edge)).toBeDefined();
    editor.setReadOnly(true);
    const before = editor.getSnapshot();
    editor.connectSmart(a, b);
    expect(editor.setText(a, "Changed")).toBe(false);
    expect(editor.getSnapshot()).toEqual(before);
  });
  test("registry rejects invalid kinds and fields and notation matches geometry", () => {
    expect(
      getElementTypeDefinition("state.node")!.validateSemantic(
        { name: "x", kind: "unknown" },
        "s",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      getElementTypeDefinition("state.transition")!.validateSemantic(
        { from: "a", to: "b", guard: 42 },
        "s",
      ).length,
    ).toBeGreaterThan(0);
    const editor = makeEditor();
    for (const kind of STATE_NODE_KINDS) {
      const id = editor.createElement("state.node", {
        semantic: { name: "", kind },
        visual: { width: 32, height: 32 },
      });
      const element = editor.store.get(id)!;
      const util = editor.getShapeUtil(element.type);
      const context = editor.createShapeContext();
      expect(util.hitTest(element, { x: 16, y: 16 }, context)).toBe(true);
      expect(util.hitTest(element, { x: 0, y: 0 }, context)).toBe(
        kind === "state",
      );
      expect(stateNodeNotation(element, editor.getBounds(id)!).length).toBe(
        kind === "final" ? 2 : 1,
      );
    }
  });
});

test("initial, final and choice nodes default to compact geometry", () => {
  const editor = makeEditor();
  for (const kind of ["initial", "final", "choice"]) {
    const id = editor.createElement("state.node", {
      semantic: { name: "", kind },
    });
    expect(editor.getBounds(id)).toMatchObject({ width: 32, height: 32 });
  }
});
