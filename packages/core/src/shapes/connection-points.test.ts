import { describe, expect, test } from "bun:test";
import { GEO_KINDS, CONNECTOR_PORTS } from "@nodetto/ir";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { Editor } from "../editor.ts";
import {
  connectionPorts,
  endpointReaderFor,
  resolveConnector,
} from "./connector.ts";

function resolved(editor: Editor, id: string) {
  const edge = editor.store.get(id)!;
  return resolveConnector(
    edge,
    editor.createShapeContext(),
    endpointReaderFor(edge.type),
  )!;
}

describe("shared shape connection points", () => {
  test("every geometric primitive has finite outline points and rotated points follow it", () => {
    for (const geo of GEO_KINDS) {
      const editor = new Editor();
      const id = editor.createElement("shape.geo", {
        semantic: { geo },
        visual: { x: 100, y: 100, width: 160, height: 100 },
      });
      const points = connectionPorts(
        editor.store.get(id)!,
        editor.createShapeContext(),
      );
      expect(points.map((port) => port.id)).toEqual([...CONNECTOR_PORTS]);
      for (const { point } of points) {
        expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      }
      editor.apply([{ type: "updateVisual", id, visual: { rotation: 90 } }]);
      const rotated = connectionPorts(
        editor.store.get(id)!,
        editor.createShapeContext(),
      );
      points.forEach(({ point }, i) => {
        expect(rotated[i]!.point.x).toBeCloseTo(180 - (point.y - 150));
        expect(rotated[i]!.point.y).toBeCloseTo(150 + (point.x - 180));
      });
    }
  });

  test("decision tips, BPMN gateways/events, state choices and UML interfaces use their outlines", () => {
    for (const [type, semantic] of [
      ["shape.geo", { geo: "diamond" }],
      ["bpmn.gateway", {}],
      ["state.node", { kind: "choice" }],
      ["bpmn.event", {}],
      ["state.node", { kind: "initial" }],
      ["uml.interface", {}],
    ] as const) {
      const editor = new Editor();
      const id = editor.createElement(type, {
        semantic: {
          ...(editor.getShapeUtil(type).defaultSemantic() as object),
          ...semantic,
        },
        visual: { x: 0, y: 0, width: 100, height: 100 },
      });
      const points = connectionPorts(
        editor.store.get(id)!,
        editor.createShapeContext(),
      );
      expect(points[0]!.point.x).toBeCloseTo(50);
      expect(points[1]!.point.y).toBeCloseTo(50);
      expect(points[2]!.point.x).toBeCloseTo(50);
      expect(points[3]!.point.y).toBeCloseTo(50);
      expect(points[0]!.point.y).toBeLessThanOrEqual(2);
    }
  });

  test("fixed branch sides survive moves, resizing, JSONL and SVG export", () => {
    const editor = new Editor();
    const from = editor.createElement("shape.geo", {
      semantic: { geo: "diamond" },
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const to = editor.createElement("node.generic", {
      visual: { x: 300, y: 0, width: 100, height: 100 },
    });
    const edge = editor.createElement("edge.generic", {
      semantic: {
        from,
        to,
        fromPort: "bottom",
        toPort: "top",
        routing: "orthogonal",
      },
    });
    expect(resolved(editor, edge).start).toEqual({ x: 50, y: 99 });
    editor.apply([
      { type: "updateVisual", id: to, visual: { x: -300, y: -300 } },
      { type: "updateVisual", id: from, visual: { width: 200, height: 120 } },
    ]);
    const route = resolved(editor, edge);
    expect(route.start).toEqual({ x: 100, y: 119 });
    expect(route.points[1]!.y).toBeGreaterThan(120);
    expect(route.end).toEqual({ x: -250, y: -300 });
    expect(route.points.at(-2)!.y).toBeLessThan(-300);
    const copy = new Editor({
      document: parseDocument(serializeDocument(editor.getSnapshot())),
    });
    expect(resolved(copy, edge).points).toEqual(route.points);
    expect(copy.exportPageSvg()).toContain(
      `points="${route.points.map((point) => `${point.x},${point.y}`).join(" ")}"`,
    );
    for (let i = 1; i < route.points.length; i++)
      expect(
        route.points[i]!.x === route.points[i - 1]!.x ||
          route.points[i]!.y === route.points[i - 1]!.y,
      ).toBe(true);
  });

  test("state self-loops honor both fixed sides", () => {
    const editor = new Editor();
    const node = editor.createElement("state.node", {
      visual: { x: 100, y: 100, width: 100, height: 100 },
    });
    const edge = editor.connectSmart(
      node,
      node,
      {},
      { fromPort: "bottom", toPort: "left" },
    )!;
    const route = resolved(editor, edge);
    expect(route.start).toEqual({ x: 150, y: 200 });
    expect(route.end).toEqual({ x: 100, y: 150 });
    expect(route.points.length).toBeGreaterThan(3);
  });

  test("ERD mapped fields keep their row anchor, and sequence messages keep lifeline timing", () => {
    const editor = new Editor();
    const a = editor.createElement("erd.table", {
      semantic: {
        tableName: "A",
        columns: [{ id: "a1", name: "id", dataType: "int" }],
      },
      visual: { x: 0, y: 0, width: 180 },
    });
    const b = editor.createElement("erd.table", {
      semantic: {
        tableName: "B",
        columns: [{ id: "b1", name: "id", dataType: "int" }],
      },
      visual: { x: 400, y: 0, width: 180 },
    });
    const edge = editor.createElement("erd.relation", {
      semantic: {
        from: { table: a, column: "a1" },
        to: { table: b, column: "b1" },
        fromPort: "top",
        toPort: "bottom",
        cardinality: "1:*",
      },
    });
    expect(resolved(editor, edge).start.y).toBeGreaterThan(0);
    expect(resolved(editor, edge).start.y).toBe(resolved(editor, edge).end.y);
    const actor = editor.createElement("sequence.participant", {
      visual: { x: 0, y: 300 },
    });
    const service = editor.createElement("sequence.participant", {
      visual: { x: 400, y: 300 },
    });
    expect(
      connectionPorts(editor.store.get(actor)!, editor.createShapeContext()),
    ).toEqual([]);
    const message = editor.connectSmart(
      actor,
      service,
      {},
      { fromPort: "top", toPort: "bottom" },
    )!;
    expect(resolved(editor, message).start.y).toBe(
      resolved(editor, message).end.y,
    );
    expect(editor.store.get(message)!.semantic).not.toHaveProperty("fromPort");
  });
});
