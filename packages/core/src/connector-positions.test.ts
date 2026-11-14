import { expect, test } from "bun:test";
import { Editor } from "./editor.ts";
import {
  connectorLabelBox,
  connectorLabelBoxAt,
} from "./shapes/connector/label-box.ts";
import { pointAlongRoute } from "./shapes/connector/route.ts";
import { resolveConnector } from "./shapes/connector/resolve.ts";
import { endpointReaderFor } from "./shapes/connector/util.ts";

function resolve(editor: Editor, id: string) {
  const edge = editor.store.get(id)!;
  const context = editor.createShapeContext();
  return {
    edge,
    context,
    route: resolveConnector(edge, context, endpointReaderFor(edge.type))!,
  };
}

test("label and port fractions affect resolved geometry, with legacy midpoint unchanged", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 0, width: 100, height: 100 },
  });
  const legacy = editor.createElement("edge.generic", {
    semantic: { from: a, to: b },
  });
  const positioned = editor.createElement("edge.generic", {
    semantic: {
      from: a,
      to: b,
      fromPort: "right",
      fromPortPosition: 0.25,
      labelPosition: 0.25,
    },
  });
  const old = resolve(editor, legacy);
  const current = resolve(editor, positioned);
  expect(old.route.labelPoint).toEqual(pointAlongRoute(old.route.points, 0.5));
  expect(current.route.labelPoint).toEqual(
    pointAlongRoute(current.route.points, 0.25),
  );
  expect(current.route.start).toEqual({ x: 100, y: 25 });
  expect(connectorLabelBoxAt(current.edge, current.route.labelPoint)).toEqual(
    connectorLabelBox(current.edge, current.context)!,
  );
});

test("same-side self loop uses spread ports and preserves the unpinned legacy loop", () => {
  const editor = new Editor();
  const a = editor.createElement("state.node", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const legacy = editor.createElement("state.transition", {
    semantic: { from: a, to: a },
  });
  const pinned = editor.createElement("state.transition", {
    semantic: { from: a, to: a, fromPort: "bottom", toPort: "bottom" },
  });
  expect(resolve(editor, pinned).route.points).toEqual([
    { x: 30, y: 100 },
    { x: 30, y: 140 },
    { x: 70, y: 140 },
    { x: 70, y: 100 },
  ]);
  expect(resolve(editor, legacy).route.points).toEqual([
    { x: 100, y: 50 },
    { x: 140, y: 50 },
    { x: 140, y: -40 },
    { x: 50, y: -40 },
    { x: 50, y: 0 },
  ]);
});

test("positioned ports intersect elliptical outlines before rotation", () => {
  const editor = new Editor();
  const a = editor.createElement("state.node", {
    semantic: { kind: "initial", name: "" },
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const b = editor.createElement("state.node", {
    visual: { x: 300, y: 0, width: 100, height: 100 },
  });
  const edge = editor.createElement("state.transition", {
    semantic: { from: a, to: b, fromPort: "right", fromPortPosition: 0.25 },
  });
  const start = resolve(editor, edge).route.start;
  expect(start.y).toBeCloseTo(25);
  expect(start.x).toBeCloseTo(50 + Math.sqrt(1875));
});
