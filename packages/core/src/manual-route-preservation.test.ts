import { expect, test } from "bun:test";
import { Editor } from "./editor.ts";
import {
  connectorWaypointFromPage,
  endpointReaderFor,
  resolveConnector,
} from "./shapes/connector.ts";
function setup() {
  const editor = new Editor();
  const from = editor.createElement("shape.geo", {
    semantic: { geo: "diamond" },
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const to = editor.createElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: { x: 400, y: 200, width: 100, height: 100 },
  });
  const points = [
    { x: 150, y: 150 },
    { x: 300, y: 150 },
  ];
  const edge = editor.createElement("edge.generic", {
    semantic: {
      from,
      to,
      routing: "manual",
      routingWaypoints: points.map((point) =>
        connectorWaypointFromPage(point, { x: 50, y: 50 }, { x: 450, y: 250 }),
      ),
    },
  });
  const bends = () =>
    resolveConnector(
      editor.store.get(edge)!,
      editor.createShapeContext(),
      endpointReaderFor("edge.generic"),
    )!.waypointPoints!;
  return { editor, from, to, edge, points, bends };
}
function expectPoints(
  actual: readonly { x: number; y: number }[],
  expected: readonly { x: number; y: number }[],
) {
  actual.forEach((point, index) => {
    expect(point.x).toBeCloseTo(expected[index]!.x);
    expect(point.y).toBeCloseTo(expected[index]!.y);
  });
}
test("moving one shape keeps authored bends fixed across repeated drag samples and undo", () => {
  const { editor, from, points, bends } = setup();
  const before = editor.getSnapshot();
  const undoSize = editor.history.undoSize;
  editor.beginBatch();
  editor.moveElements([{ id: from, x: 80, y: 60 }]);
  expectPoints(bends(), points);
  editor.moveElements([{ id: from, x: -40, y: 120 }]);
  expectPoints(bends(), points);
  editor.endBatch();
  expect(editor.history.undoSize).toBe(undoSize + 1);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
  editor.redo();
  expectPoints(bends(), points);
});
test("moving both endpoints together carries the whole manual route", () => {
  const { editor, from, to, points, bends } = setup();
  editor.moveElements([
    { id: from, x: 100, y: 50 },
    { id: to, x: 500, y: 250 },
  ]);
  expectPoints(
    bends(),
    points.map((point) => ({ x: point.x + 100, y: point.y + 50 })),
  );
});
test("resizing one endpoint through commands also keeps bends fixed", () => {
  const { editor, from, points, bends } = setup();
  editor.apply([
    { type: "updateVisual", id: from, visual: { width: 200, height: 150 } },
  ]);
  expectPoints(bends(), points);
});

test("moving the attached end of a partially detached arrow keeps bends fixed", () => {
  const { editor, from, edge, points, bends } = setup();
  const semantic = editor.store.get(edge)!.semantic as Record<string, unknown>;
  const { to: _to, ...rest } = semantic;
  editor.apply([
    {
      type: "updateSemantic",
      id: edge,
      semantic: { ...rest, toPoint: { x: 450, y: 250 } },
    },
  ]);
  editor.moveElements([{ id: from, x: 100, y: 100 }]);
  expectPoints(bends(), points);
});
