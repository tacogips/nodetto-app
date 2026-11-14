import { expect, test } from "bun:test";
import { Editor } from "./editor.ts";
import {
  compactPrototypeLabel,
  persistentLayerPairs,
  prototypeFlows,
  prototypeLinkGeometry,
} from "./prototype-links.ts";

test("prototype labels omit defaults and compact non-default values", () => {
  expect(compactPrototypeLabel({})).toBe("");
  expect(
    compactPrototypeLabel({
      prototypeTrigger: "after-delay",
      prototypeDelay: 2000,
    }),
  ).toBe("after 2s");
  expect(
    compactPrototypeLabel({
      prototypeAction: "open-overlay",
      prototypeTransition: "fade",
    }),
  ).toBe("overlay · fade");
  expect(
    compactPrototypeLabel({ label: "Custom", prototypeAction: "back" }),
  ).toBe("Custom");
});

test("curves meet nearest frame edges and back links are tags", () => {
  const editor = new Editor();
  const left = editor.createElement("frame", {
    semantic: { name: "Left", screenKind: "screen" },
    visual: { x: 0, y: 0, width: 200, height: 400 },
  });
  const right = editor.createElement("frame", {
    semantic: { name: "Right", screenKind: "screen" },
    visual: { x: 500, y: 0, width: 200, height: 400 },
  });
  const hotspot = editor.createElement("shape.geo", {
    visual: { x: 20, y: 40, width: 80, height: 40 },
  });
  const forward = editor.createElement("edge.generic", {
    semantic: { from: hotspot, to: right, prototype: true },
  });
  const reverse = editor.createElement("edge.generic", {
    semantic: { from: right, to: left, prototype: true },
  });
  const back = editor.createElement("edge.generic", {
    semantic: {
      from: hotspot,
      to: left,
      prototype: true,
      prototypeAction: "back",
    },
  });
  const context = editor.createShapeContext();
  expect(
    prototypeLinkGeometry(editor.store, context, editor.store.get(forward)!)
      ?.start,
  ).toEqual({ x: 100, y: 60 });
  expect(
    prototypeLinkGeometry(editor.store, context, editor.store.get(forward)!)
      ?.end?.x,
  ).toBe(500);
  expect(
    prototypeLinkGeometry(editor.store, context, editor.store.get(reverse)!)
      ?.end?.x,
  ).toBe(200);
  expect(
    prototypeLinkGeometry(editor.store, context, editor.store.get(back)!)?.kind,
  ).toBe("back-tag");
});

test("flows sort starts, traverse cycles once, and identify unreachable and hidden links", () => {
  const editor = new Editor();
  const a = editor.createElement("frame", {
    semantic: {
      name: "A",
      screenKind: "screen",
      prototypeStart: true,
      prototypeFlowName: "Z",
    },
    visual: { x: 0, y: 0, width: 200, height: 400 },
  });
  const b = editor.createElement("frame", {
    semantic: { name: "B", screenKind: "screen" },
    visual: { x: 500, y: 0, width: 200, height: 400 },
  });
  const c = editor.createElement("frame", {
    semantic: {
      name: "C",
      screenKind: "screen",
      prototypeStart: true,
      prototypeFlowName: "A",
    },
    visual: { x: 1000, y: 0, width: 200, height: 400 },
  });
  const d = editor.createElement("frame", {
    semantic: { name: "D", screenKind: "screen" },
    visual: { x: 1500, y: 0, width: 200, height: 400 },
  });
  const hotspot = editor.createElement("shape.geo", {
    visual: { x: 20, y: 20, width: 40, height: 40, hidden: true },
  });
  editor.createElement("edge.generic", {
    semantic: { from: a, to: b, prototype: true },
  });
  editor.createElement("edge.generic", {
    semantic: { from: b, to: a, prototype: true },
  });
  const dangling = editor.createElement("edge.generic", {
    semantic: { from: hotspot, to: d, prototype: true },
  });
  const result = prototypeFlows(editor.store, editor.createShapeContext());
  expect(result.flows.map((flow) => flow.name)).toEqual(["A", "Z"]);
  expect(result.flows[0]?.screens).toEqual([c]);
  expect(result.flows[1]?.screens).toEqual([a, b]);
  expect(result.unreachable).toContain(d);
  expect(result.dangling).toContain(dangling);
});

test("persistent fixed layers match relative boxes and names", () => {
  const editor = new Editor();
  const a = editor.createElement("frame", {
    semantic: { name: "A", screenKind: "screen" },
    visual: { x: 0, y: 0, width: 200, height: 400 },
  });
  const first = editor.createElement("shape.geo", {
    visual: {
      x: 10,
      y: 350,
      width: 180,
      height: 40,
      prototypeFixed: true,
      layerName: "Tabs",
    },
  });
  const b = editor.createElement("frame", {
    semantic: { name: "B", screenKind: "screen" },
    visual: { x: 500, y: 0, width: 200, height: 400 },
  });
  const second = editor.createElement("shape.geo", {
    visual: {
      x: 510,
      y: 350,
      width: 180,
      height: 40,
      prototypeFixed: true,
      layerName: "Tabs",
    },
  });
  expect(
    persistentLayerPairs(editor.store, editor.createShapeContext(), a, b),
  ).toEqual([{ from: first, to: second }]);
  editor.apply([{ type: "updateVisual", id: second, visual: { x: 513 } }]);
  expect(
    persistentLayerPairs(editor.store, editor.createShapeContext(), a, b),
  ).toEqual([]);
});
