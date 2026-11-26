import { expect, test } from "bun:test";
import {
  computeSchematicConnectivity,
  Editor,
  schematicPins,
  wirePointKeys,
} from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { createInteraction } from "./interaction.ts";
import { rerouteSchematicWirePoint } from "./interaction/schematic-wire-edit.ts";
import {
  SCHEMATIC_LABEL_CROSSING_MESSAGE,
  SCHEMATIC_COORDINATE_RANGE_MESSAGE,
} from "./interaction/schematic-wire.ts";
import { Tool } from "./tools.ts";

function setup() {
  const editor = new Editor();
  editor.setPageKind(editor.currentPageId, "schematic");
  const interaction = createInteraction(editor, {
    tool: () => Tool.Select,
    setTool() {},
    container: () => undefined,
  });
  return { editor, interaction };
}
function pointer(x: number, y: number): PointerEvent {
  return {
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 1,
    target: null,
    preventDefault() {},
    stopPropagation() {},
  } as unknown as PointerEvent;
}
function wire(
  editor: Editor,
  x: number,
  y: number,
  points: { x: number; y: number }[],
) {
  const id = editor.createSchematicElement(
    "schematic.wire",
    { x, y },
    { points },
  );
  if (!id) throw new Error("wire missing");
  return id;
}
function drag(
  interaction: ReturnType<typeof createInteraction>,
  id: Parameters<typeof interaction.startBreadboardWirePoint>[0],
  index: number,
  start: [number, number],
  ...moves: [number, number][]
) {
  interaction.startBreadboardWirePoint(id, index, pointer(...start));
  for (const move of moves) interaction.onPointerMove(pointer(...move));
  const last = moves.at(-1) ?? start;
  interaction.onPointerUp(pointer(...last));
}
function points(editor: Editor, id: Parameters<typeof editor.store.get>[0]) {
  const element = editor.store.get(id);
  if (!element) throw new Error("missing wire");
  return (element.semantic as { points: { x: number; y: number }[] }).points;
}
function junctions(editor: Editor) {
  return editor.store
    .getPageElements(editor.currentPageId)
    .filter((e) => e.type === "schematic.junction");
}
const base = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 20 },
];

test("reroute inserts local elbows and reports the moved index", () => {
  expect(rerouteSchematicWirePoint(base, 1, { x: 40, y: 10 })).toEqual({
    points: [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 20 },
    ],
    index: 2,
  });
  expect(
    rerouteSchematicWirePoint(
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ],
      0,
      { x: 0, y: 10 },
    ),
  ).toEqual({
    points: [
      { x: 0, y: 10 },
      { x: 0, y: 0 },
      { x: 30, y: 0 },
    ],
    index: 0,
  });
  expect(
    rerouteSchematicWirePoint(
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ],
      0,
      { x: 30, y: 0 },
    ),
  ).toBeNull();
});

test("two successive bend nudges retain identity and undo separately", () => {
  const { editor, interaction } = setup();
  const id = wire(editor, 0, 0, base);
  const before = editor.getSnapshot();
  expect(interaction.nudgeSchematicWirePoint(id, 1, 0, 10)).toBe(2);
  expect(interaction.nudgeSchematicWirePoint(id, 2, 0, 10)).toBe(2);
  expect(editor.undo()).toBe(true);
  expect(editor.undo()).toBe(true);
  expect(editor.getSnapshot()).toEqual(before);
});

test("dragging a bend preserves both pin attachments", () => {
  const { editor, interaction } = setup();
  const pinIds = [
    { x: 0, y: 0 },
    { x: 30, y: 20 },
  ].map((target) => {
    const id = editor.createSchematicElement("schematic.resistor", target);
    if (!id) throw new Error("missing part");
    const part = editor.store.get(id);
    if (!part) throw new Error("missing part");
    const anchor = schematicPins(part)[0];
    if (!anchor) throw new Error("missing pin");
    editor.apply([
      {
        type: "updateVisual",
        id,
        visual: {
          x: (part.visual.x ?? 0) + target.x - anchor.x,
          y: (part.visual.y ?? 0) + target.y - anchor.y,
        },
      },
    ]);
    return id;
  });
  const id = wire(editor, 0, 0, base);
  editor.selection.set([id]);
  drag(interaction, id, 1, [30, 0], [40, 10]);
  expect(points(editor, id)).toEqual([
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 10 },
    { x: 30, y: 10 },
    { x: 30, y: 20 },
  ]);
  const net = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  for (const pinId of pinIds) {
    expect(net.netOfPin({ elementId: pinId, pin: 1 })).toBe(
      net.netOfElement(id),
    );
  }
});

test("labelled crossing rejection overrides a prior valid move even when degenerate", () => {
  const { editor, interaction } = setup();
  wire(editor, -20, 0, [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
  ]);
  wire(editor, 0, -20, [
    { x: 0, y: 0 },
    { x: 0, y: 40 },
  ]);
  const label = editor.createSchematicElement(
    "schematic.label",
    { x: 0, y: 0 },
    { net: "CLK" },
  );
  const id = wire(editor, 0, 30, [
    { x: 0, y: 0 },
    { x: 0, y: -30 },
  ]);
  editor.selection.set([id]);
  const before = editor.getSnapshot();
  drag(interaction, id, 0, [0, 30], [0, 40], [0, 0]);
  expect(editor.getSnapshot()).toEqual(before);
  expect(junctions(editor)).toHaveLength(0);
  expect(interaction.schematicWireNotice()).toBe(
    SCHEMATIC_LABEL_CROSSING_MESSAGE,
  );
  expect(interaction.nudgeSchematicWirePoint(id, 0, 0, -30)).toBeNull();
  expect(editor.getSnapshot()).toEqual(before);
  expect(editor.undo()).toBe(true);
  expect(editor.store.get(id)).toBeUndefined();
  expect(editor.store.get(label!)).toBeDefined();
});

test("nearby pin does not replace a deliberate T on release", () => {
  const { editor, interaction } = setup();
  const a = wire(editor, -20, 0, [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
  ]);
  const pin = editor.createSchematicElement("schematic.resistor", {
    x: 10,
    y: 0,
  });
  if (!pin) throw new Error("missing pin");
  const part = editor.store.get(pin);
  if (!part) throw new Error("missing part");
  const anchor = schematicPins(part)[0];
  if (!anchor) throw new Error("missing anchor");
  editor.apply([
    {
      type: "updateVisual",
      id: pin,
      visual: {
        x: (part.visual.x ?? 0) + 3 - anchor.x,
        y: (part.visual.y ?? 0) - anchor.y,
      },
    },
  ]);
  const id = wire(editor, 0, 30, [
    { x: 0, y: 0 },
    { x: 0, y: 20 },
  ]);
  editor.selection.set([id]);
  drag(interaction, id, 0, [0, 30], [4.9, 4.9]);
  expect(junctions(editor)).toHaveLength(1);
  expect(junctions(editor)[0]?.visual).toMatchObject({ x: 0, y: 0 });
  const net = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  expect(net.netOfElement(id)).toBe(net.netOfElement(a));
  expect(net.netOfPin({ elementId: pin, pin: 1 })).not.toBe(
    net.netOfElement(a),
  );
  expect(editor.undo()).toBe(true);
  expect(junctions(editor)).toHaveLength(0);
});

test("off-grid origin preserves endpoint and junction keys through serialization", () => {
  const { editor, interaction } = setup();
  const a = wire(editor, -10, -20, [
    { x: 0, y: 0 },
    { x: 0, y: 40 },
  ]);
  const id = wire(editor, 0, 0, [
    { x: 10, y: 30 },
    { x: 10, y: 10 },
  ]);
  editor.apply([{ type: "updateVisual", id, visual: { x: -0.125, y: 0 } }]);
  editor.selection.set([id]);
  const before = editor.getSnapshot();
  drag(interaction, id, 1, [10, 10], [-10, 0]);
  const edited = editor.store.get(id);
  const junction = junctions(editor)[0];
  if (!edited || !junction) throw new Error("missing edit");
  expect(wirePointKeys(edited).at(-1)).toEqual({ kx: -1000, ky: 0 });
  expect(junction.visual).toMatchObject({ x: -10, y: 0 });
  expect(points(editor, id)[0]).toEqual({ x: 10, y: 30 });
  for (const doc of [
    editor.getSnapshot(),
    parseDocument(serializeDocument(editor.getSnapshot())),
  ]) {
    const net = computeSchematicConnectivity(doc, editor.currentPageId);
    expect(net.netOfElement(id)).toBe(net.netOfElement(a));
  }
  expect(editor.undo()).toBe(true);
  expect(editor.getSnapshot()).toEqual(before);
  expect(interaction.nudgeSchematicWirePoint(id, 1, -20, -10)).not.toBeNull();
  expect(wirePointKeys(editor.store.get(id)!).at(-1)).toEqual({
    kx: -1000,
    ky: 0,
  });
  expect(junctions(editor)[0]?.visual).toMatchObject({ x: -10, y: 0 });
  const nudgedNet = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  expect(nudgedNet.netOfElement(id)).toBe(nudgedNet.netOfElement(a));
  expect(editor.undo()).toBe(true);
  expect(editor.getSnapshot()).toEqual(before);
});

test("range rejection retains the last accepted sample and serializes", () => {
  const { editor, interaction } = setup();
  const id = wire(editor, 1e9, 0, [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]);
  editor.selection.set([id]);
  drag(interaction, id, 0, [1e9, 0], [0, 0], [-10, 0]);
  expect(points(editor, id)[0]).toEqual({ x: -1e9, y: 0 });
  expect(interaction.schematicWireNotice()).toBe(
    SCHEMATIC_COORDINATE_RANGE_MESSAGE,
  );
  expect(() =>
    parseDocument(serializeDocument(editor.getSnapshot())),
  ).not.toThrow();
  const before = editor.getSnapshot();
  expect(interaction.nudgeSchematicWirePoint(id, 0, -10, 0)).toBeNull();
  expect(editor.getSnapshot()).toEqual(before);
});

test("rerouting preserves distant fixed segments", () => {
  const original = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
    { x: 40, y: 20 },
    { x: 40, y: 40 },
  ];
  const result = rerouteSchematicWirePoint(original, 2, { x: 30, y: 30 });
  if (!result) throw new Error("reroute rejected");
  expect(result.points.slice(0, 2)).toEqual(original.slice(0, 2));
  expect(result.points.slice(-2)).toEqual(original.slice(-2));
  expect(result.points[result.index]).toEqual({ x: 30, y: 30 });
  for (let i = 1; i < result.points.length; i++) {
    const a = result.points[i - 1];
    const b = result.points[i];
    if (!a || !b) throw new Error("missing point");
    expect(a.x === b.x || a.y === b.y).toBe(true);
  }
});

test("cancelling a point drag restores geometry and history", () => {
  const { editor, interaction } = setup();
  const id = wire(editor, 0, 0, base);
  editor.selection.set([id]);
  const before = editor.getSnapshot();
  interaction.startBreadboardWirePoint(id, 1, pointer(30, 0));
  interaction.onPointerMove(pointer(40, 10));
  interaction.onKeyDown({
    key: "Escape",
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    isComposing: false,
    target: null,
    preventDefault() {},
  } as unknown as KeyboardEvent);
  expect(editor.getSnapshot()).toEqual(before);
  expect(junctions(editor)).toHaveLength(0);
  expect(editor.undo()).toBe(true);
  expect(editor.store.get(id)).toBeUndefined();
});

test("edited end does not mask a nearby pin", () => {
  const { editor, interaction } = setup();
  const pin = editor.createSchematicElement("schematic.resistor", {
    x: 10,
    y: 0,
  });
  if (!pin) throw new Error("missing pin");
  const part = editor.store.get(pin);
  if (!part) throw new Error("missing part");
  const anchor = schematicPins(part)[0];
  if (!anchor) throw new Error("missing anchor");
  editor.apply([
    {
      type: "updateVisual",
      id: pin,
      visual: {
        x: (part.visual.x ?? 0) + 3 - anchor.x,
        y: (part.visual.y ?? 0) - anchor.y,
      },
    },
  ]);
  const id = wire(editor, 0, 0, [
    { x: 0, y: 0 },
    { x: 0, y: 30 },
  ]);
  editor.selection.set([id]);
  drag(interaction, id, 0, [0, 0], [0, 10], [2, 0]);
  expect(wirePointKeys(editor.store.get(id)!)[0]).toEqual({ kx: 300, ky: 0 });
  expect(junctions(editor)).toHaveLength(0);
  const net = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  expect(net.netOfElement(id)).toBe(net.netOfPin({ elementId: pin, pin: 1 }));
});

test("dropping on a single-wire label adds one junction in the gesture undo", () => {
  const { editor, interaction } = setup();
  const a = wire(editor, -20, 0, [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
  ]);
  editor.createSchematicElement(
    "schematic.label",
    { x: 0, y: 0 },
    { net: "CLK" },
  );
  const id = wire(editor, 0, 30, [
    { x: 0, y: 0 },
    { x: 0, y: 20 },
  ]);
  editor.selection.set([id]);
  const before = editor.getSnapshot();
  drag(interaction, id, 0, [0, 30], [0, 0]);
  expect(junctions(editor)).toHaveLength(1);
  const net = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  expect(net.netOfElement(id)).toBe(net.netOfElement(a));
  expect(editor.undo()).toBe(true);
  expect(editor.getSnapshot()).toEqual(before);
});

test("out-of-range T junction is rejected before mutation", () => {
  const { editor, interaction } = setup();
  wire(editor, 1e9, 0, [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
  ]);
  const id = wire(editor, 1e9, 0, [
    { x: 10, y: 30 },
    { x: 10, y: 40 },
  ]);
  editor.selection.set([id]);
  const before = editor.getSnapshot();
  drag(interaction, id, 0, [1e9 + 10, 30], [1e9 + 10, 0]);
  expect(editor.getSnapshot()).toEqual(before);
  expect(junctions(editor)).toHaveLength(0);
  expect(interaction.schematicWireNotice()).toBe(
    SCHEMATIC_COORDINATE_RANGE_MESSAGE,
  );
  expect(() =>
    parseDocument(serializeDocument(editor.getSnapshot())),
  ).not.toThrow();
});
