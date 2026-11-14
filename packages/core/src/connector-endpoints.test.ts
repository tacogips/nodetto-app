import { describe, expect, test } from "bun:test";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { Editor } from "./editor.ts";
import { setGenericConnectorEndpoint } from "./connector-endpoints.ts";
import {
  connectorWaypointFromPage,
  endpointReaderFor,
  resolveConnector,
} from "./shapes/connector.ts";
function route(editor: Editor, id: string) {
  const edge = editor.store.get(id)!;
  return resolveConnector(
    edge,
    editor.createShapeContext(),
    endpointReaderFor(edge.type),
  )!;
}

describe("detached connector endpoints", () => {
  test("both free endpoints and authored bends round-trip, move, copy and export", () => {
    const editor = new Editor();
    const fromPoint = { x: 100, y: 100 };
    const toPoint = { x: 400, y: 300 };
    const waypoints = [
      { x: 100, y: 250 },
      { x: 400, y: 250 },
    ];
    const id = editor.createElement("edge.generic", {
      semantic: {
        fromPoint,
        toPoint,
        routing: "manual",
        routingWaypoints: waypoints.map((point) =>
          connectorWaypointFromPage(point, fromPoint, toPoint),
        ),
      },
    });
    expect(route(editor, id).start).toEqual(fromPoint);
    expect(route(editor, id).end).toEqual(toPoint);
    route(editor, id).waypointPoints!.forEach((point, index) => {
      expect(point.x).toBeCloseTo(waypoints[index]!.x);
      expect(point.y).toBeCloseTo(waypoints[index]!.y);
    });
    expect(editor.hitTest({ x: 200, y: 250 })).toBe(id);
    editor.selection.set([id]);
    expect(editor.nudgeSelection(20, 30)).toBe(true);
    expect(route(editor, id).start).toEqual({ x: 120, y: 130 });
    expect(route(editor, id).end).toEqual({ x: 420, y: 330 });
    expect(route(editor, id).waypointPoints![0]!.y).toBeCloseTo(280);
    const copy = new Editor({
      document: parseDocument(serializeDocument(editor.getSnapshot())),
    });
    expect(route(copy, id).points).toEqual(route(editor, id).points);
    expect(editor.exportPageSvg()).toContain('points="120,130');
    expect(editor.copySelection()).toBe(true);
    const pasted = editor.paste()[0]!;
    expect(route(editor, pasted).start).toEqual({ x: 136, y: 146 });
    expect(route(editor, pasted).end).toEqual({ x: 436, y: 346 });
    editor.undo();
    expect(editor.store.has(pasted)).toBe(false);
  });
  test("detach and reattach preserve intermediate points and take one undo step", () => {
    const editor = new Editor();
    const a = editor.createElement("node.generic", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const b = editor.createElement("node.generic", {
      visual: { x: 400, y: 0, width: 100, height: 100 },
    });
    const points = [
      { x: 150, y: 200 },
      { x: 350, y: 200 },
    ];
    const id = editor.createElement("edge.generic", {
      semantic: {
        from: a,
        to: b,
        fromPort: "bottom",
        toPort: "top",
        routing: "manual",
        routingWaypoints: points.map((point) =>
          connectorWaypointFromPage(point, { x: 50, y: 50 }, { x: 450, y: 50 }),
        ),
      },
    });
    const before = editor.history.undoSize;
    expect(
      setGenericConnectorEndpoint(editor, id, "to", {
        point: { x: 600, y: 300 },
      }),
    ).toBe(true);
    expect(editor.store.get(id)!.semantic).toMatchObject({
      from: a,
      fromPort: "bottom",
      toPoint: { x: 600, y: 300 },
    });
    expect(editor.store.get(id)!.semantic).not.toHaveProperty("toPort");
    expect(route(editor, id).end).toEqual({ x: 600, y: 300 });
    route(editor, id).waypointPoints!.forEach((point, i) => {
      expect(point.x).toBeCloseTo(points[i]!.x);
      expect(point.y).toBeCloseTo(points[i]!.y);
    });
    expect(editor.history.undoSize).toBe(before + 1);
    editor.undo();
    expect(editor.store.get(id)!.semantic).toMatchObject({
      to: b,
      toPort: "top",
    });
    editor.redo();
    expect(
      setGenericConnectorEndpoint(editor, id, "to", { shape: b, port: "left" }),
    ).toBe(true);
    expect(editor.store.get(id)!.semantic).not.toHaveProperty("toPoint");
    expect(route(editor, id).end).toEqual({ x: 400, y: 50 });
    route(editor, id).waypointPoints!.forEach((point, i) => {
      expect(point.x).toBeCloseTo(points[i]!.x);
      expect(point.y).toBeCloseTo(points[i]!.y);
    });
  });
  test("typed and prototype connectors cannot lose semantic endpoints", () => {
    const editor = new Editor();
    const a = editor.createElement("state.node");
    const b = editor.createElement("state.node", { visual: { x: 300, y: 0 } });
    const id = editor.connectSmart(a, b)!;
    expect(
      setGenericConnectorEndpoint(editor, id, "to", {
        point: { x: 200, y: 200 },
      }),
    ).toBe(false);
    expect(editor.store.get(id)!.semantic).toMatchObject({ from: a, to: b });
  });
});
