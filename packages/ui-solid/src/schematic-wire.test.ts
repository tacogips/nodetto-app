import { expect, test } from "bun:test";
import {
  computeSchematicConnectivity,
  Editor,
  schematicPins,
} from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { createInteraction } from "./interaction.ts";
import { Tool, type ToolKind } from "./tools.ts";
import {
  classifySchematicWireTarget,
  resolveSchematicWireClick,
  SCHEMATIC_LABEL_CROSSING_MESSAGE,
} from "./interaction/schematic-wire.ts";

test("classifies a labelled crossing by stored keys and respects exclusion", () => {
  const editor = new Editor();
  const page = editor.currentPageId;
  editor.setPageKind(page, "schematic");
  editor.createSchematicElement(
    "schematic.wire",
    { x: -20, y: 0 },
    {
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
    },
  );
  const vertical = editor.createSchematicElement(
    "schematic.wire",
    { x: 0, y: -20 },
    {
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 40 },
      ],
    },
  );
  if (!vertical) throw new Error("wire missing");
  editor.apply([{ type: "updateVisual", id: vertical, visual: { x: 0.004 } }]);
  editor.createSchematicElement(
    "schematic.label",
    { x: 0, y: 0 },
    { net: "CLK" },
  );
  const result = resolveSchematicWireClick(
    editor.store,
    page,
    { x: 0, y: 0 },
    [],
    false,
  );
  expect(result.action).toBe("reject");
  if (result.action !== "reject") throw new Error("expected rejection");
  expect(result.message).toBe(SCHEMATIC_LABEL_CROSSING_MESSAGE);
  expect(
    classifySchematicWireTarget(editor.store, page, { x: 0, y: 0 }, vertical)
      .kind,
  ).toBe("label-single");
});

test("resolves both orthogonal corner orders", () => {
  const editor = new Editor();
  const page = editor.currentPageId;
  const start = [{ x: 0, y: 0 }];
  expect(
    resolveSchematicWireClick(
      editor.store,
      page,
      { x: 30, y: 20 },
      start,
      false,
    ).points,
  ).toEqual([
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 20 },
  ]);
  expect(
    resolveSchematicWireClick(editor.store, page, { x: 30, y: 20 }, start, true)
      .points,
  ).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 20 },
    { x: 30, y: 20 },
  ]);
});

function setup(editor = new Editor()) {
  if (editor.store.getPage(editor.currentPageId)?.kind !== "schematic")
    editor.setPageKind(editor.currentPageId, "schematic");
  let tool: ToolKind = Tool.SchematicWire;
  const interaction = createInteraction(editor, {
    tool: () => tool,
    setTool: (value) => {
      tool = value;
    },
    container: () => undefined,
  });
  return {
    editor,
    interaction,
    setTool: (value: ToolKind) => {
      tool = value;
    },
  };
}
function pointer(x: number, y: number, shiftKey = false): PointerEvent {
  return {
    clientX: x,
    clientY: y,
    shiftKey,
    button: 0,
    pointerId: 1,
    target: null,
    preventDefault() {},
    stopPropagation() {},
  } as unknown as PointerEvent;
}
function key(value: string): KeyboardEvent {
  return {
    key: value,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    isComposing: false,
    target: null,
    preventDefault() {},
  } as unknown as KeyboardEvent;
}
function click(
  interaction: ReturnType<typeof createInteraction>,
  x: number,
  y: number,
  shift = false,
) {
  const event = pointer(x, y, shift);
  interaction.onPointerDown(event);
  interaction.onPointerUp(event);
}
function wire(editor: Editor, x: number, y: number, dx: number, dy: number) {
  return editor.createSchematicElement(
    "schematic.wire",
    { x, y },
    {
      points: [
        { x: 0, y: 0 },
        { x: dx, y: dy },
      ],
    },
  );
}

test("pointer clicks commit both corner orders shown by preview", () => {
  for (const shift of [false, true]) {
    const { editor, interaction } = setup();
    click(interaction, 0, 0);
    interaction.onPointerMove(pointer(30, 20, shift));
    expect(interaction.wireDraft()).toEqual([
      { x: 0, y: 0 },
      shift ? { x: 0, y: 20 } : { x: 30, y: 0 },
      { x: 30, y: 20 },
    ]);
    click(interaction, 30, 20, shift);
    interaction.onKeyDown(key("Enter"));
    expect(
      editor.store.getPageElements(editor.currentPageId)[0]?.semantic,
    ).toEqual({
      points: [
        { x: 0, y: 0 },
        shift ? { x: 0, y: 20 } : { x: 30, y: 0 },
        { x: 30, y: 20 },
      ],
    });
    editor.undo();
    expect(editor.store.getPageElements(editor.currentPageId)).toHaveLength(0);
  }
});

test("two interior label endpoints commit junctions and wire as one undo", () => {
  const { editor, interaction } = setup();
  const left = wire(editor, 0, -20, 0, 40);
  const right = wire(editor, 40, -20, 0, 40);
  if (!left || !right) throw new Error("missing wires");
  editor.createSchematicElement(
    "schematic.label",
    { x: 0, y: 0 },
    { net: "A" },
  );
  editor.createSchematicElement(
    "schematic.label",
    { x: 40, y: 0 },
    { net: "B" },
  );
  click(interaction, 0, 0);
  click(interaction, 40, 0);
  expect(
    editor.store
      .getPageElements(editor.currentPageId)
      .filter((e) => e.type === "schematic.junction"),
  ).toHaveLength(2);
  expect(editor.store.getPageElements(editor.currentPageId)).toHaveLength(7);
  const nets = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  expect(nets.netOfElement(left)).toBe(nets.netOfElement(right));
  editor.undo();
  expect(editor.store.getPageElements(editor.currentPageId)).toHaveLength(4);
});

test("range rejection preserves the draft and document", () => {
  const { editor, interaction } = setup();
  const marker = editor.createSchematicElement("schematic.junction", {
    x: 100,
    y: 100,
  });
  if (!marker) throw new Error("missing history marker");
  const before = editor.getSnapshot();
  click(interaction, 0, 0);
  click(interaction, 0, 1.5e9);
  const draft = interaction.wireDraft();
  interaction.onKeyDown(key("Enter"));
  expect(interaction.wireDraft()).toEqual(draft);
  expect(editor.getSnapshot()).toEqual(before);
  expect(editor.undo()).toBe(true);
  expect(editor.store.get(marker)).toBeUndefined();
  expect(editor.redo()).toBe(true);
  expect(editor.getSnapshot()).toEqual(before);
  expect(interaction.schematicWireNotice()).toBe(
    "Wire is outside the coordinate range",
  );
  expect(() => serializeDocument(editor.getSnapshot())).not.toThrow();
});

test("Escape cancels a pending start junction", () => {
  const { editor, interaction } = setup();
  wire(editor, -20, 0, 40, 0);
  click(interaction, 0, 0);
  interaction.onKeyDown(key("Escape"));
  expect(interaction.wireDraft()).toBeNull();
  expect(editor.store.getPageElements(editor.currentPageId)).toHaveLength(1);
});

test("keeps a junction candidate only while it is the final endpoint", () => {
  for (const continuePast of [false, true]) {
    const { editor, interaction } = setup();
    const original = wire(editor, -20, 0, 40, 0);
    if (!original) throw new Error("missing original wire");
    const pin = editor.createSchematicElement("schematic.resistor", {
      x: 10,
      y: 0,
    });
    if (!pin) throw new Error("missing target");
    const part = editor.store.get(pin);
    if (!part) throw new Error("missing part");
    const anchor = schematicPins(part)[0];
    if (!anchor) throw new Error("missing pin");
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
    click(interaction, 0, 40);
    click(interaction, 4.9, 4.9);
    if (continuePast) click(interaction, 0, -30);
    interaction.onKeyDown(key("Enter"));
    const junctions = editor.store
      .getPageElements(editor.currentPageId)
      .filter((e) => e.type === "schematic.junction");
    expect(junctions).toHaveLength(continuePast ? 0 : 1);
    if (continuePast) {
      const added = editor.store
        .getPageElements(editor.currentPageId)
        .find((e) => e.type === "schematic.wire" && e.id !== original);
      if (!added) throw new Error("missing new wire");
      const nets = computeSchematicConnectivity(
        editor.getSnapshot(),
        editor.currentPageId,
      );
      expect(nets.netOfElement(original)).not.toBe(nets.netOfElement(added.id));
    }
    if (!continuePast) {
      const junction = junctions[0];
      if (!junction) throw new Error("missing junction");
      expect(junction.visual).toMatchObject({ x: 0, y: 0 });
      const nets = computeSchematicConnectivity(
        editor.getSnapshot(),
        editor.currentPageId,
      );
      expect(nets.netOfElement(original)).toBe(nets.netOfElement(junction.id));
      expect(nets.netOfPin({ elementId: pin, pin: 1 })).not.toBe(
        nets.netOfElement(original),
      );
      expect(editor.undo()).toBe(true);
      expect(editor.store.get(junction.id)).toBeUndefined();
      expect(
        editor.store
          .getPageElements(editor.currentPageId)
          .filter((e) => e.type === "schematic.wire"),
      ).toHaveLength(1);
    }
  }
});

test("rejected double-click preserves draft, document and notice", () => {
  const { editor, interaction } = setup();
  wire(editor, -20, 0, 40, 0);
  wire(editor, 0, -20, 0, 40);
  editor.createSchematicElement(
    "schematic.label",
    { x: 0, y: 0 },
    { net: "CLK" },
  );
  click(interaction, 50, 50);
  click(interaction, 60, 50);
  click(interaction, 0, 0);
  const draft = interaction.wireDraft();
  const document = editor.getSnapshot();
  const notice = interaction.schematicWireNotice();
  click(interaction, 0, 0);
  interaction.onDoubleClick({
    clientX: 0,
    clientY: 0,
    target: null,
    preventDefault() {},
  } as unknown as MouseEvent);
  expect(interaction.wireDraft()).toEqual(draft);
  expect(editor.getSnapshot()).toEqual(document);
  expect(interaction.schematicWireNotice()).toBe(notice);
  expect(notice).toBe(SCHEMATIC_LABEL_CROSSING_MESSAGE);
});

test("clamps a boundary origin while preserving local coordinates on reload", () => {
  const { editor, interaction } = setup();
  wire(editor, 1e9, 0, 10, 0);
  click(interaction, 1e9 + 10, 0);
  click(interaction, 1e9 + 10, 10);
  interaction.onKeyDown(key("Enter"));
  const added = editor.store
    .getPageElements(editor.currentPageId)
    .filter((e) => e.type === "schematic.wire")
    .at(-1);
  expect(added?.visual.x).toBe(1e9);
  expect(added?.semantic).toEqual({
    points: [
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ],
  });
  expect(
    parseDocument(serializeDocument(editor.getSnapshot())).elements.find(
      (e) => e.id === added?.id,
    ),
  ).toEqual(added);
});

test("canonical labelled crossing stays separate after reload", () => {
  const { editor, interaction } = setup();
  const a = wire(editor, -20, 0, 40, 0);
  const b = wire(editor, 0, -20, 0, 40);
  if (!a || !b) throw new Error("missing wires");
  editor.apply([{ type: "updateVisual", id: b, visual: { x: 0.004 } }]);
  editor.createSchematicElement(
    "schematic.label",
    { x: 0, y: 0 },
    { net: "CLK" },
  );
  click(interaction, 0, 0);
  expect(interaction.schematicWireNotice()).toBe(
    SCHEMATIC_LABEL_CROSSING_MESSAGE,
  );
  for (const doc of [
    editor.getSnapshot(),
    parseDocument(serializeDocument(editor.getSnapshot())),
  ]) {
    const fresh = new Editor({ document: doc });
    const target = classifySchematicWireTarget(
      fresh.store,
      editor.currentPageId,
      { x: 0, y: 0 },
    );
    expect(target.kind).toBe("label-crossing");
    const freshInteraction = setup(fresh).interaction;
    const beforeClick = fresh.getSnapshot();
    click(freshInteraction, 0, 0);
    expect(freshInteraction.schematicWireNotice()).toBe(
      SCHEMATIC_LABEL_CROSSING_MESSAGE,
    );
    expect(fresh.getSnapshot()).toEqual(beforeClick);
    expect(
      doc.elements.filter((e) => e.type === "schematic.junction"),
    ).toHaveLength(0);
    const net = computeSchematicConnectivity(doc, editor.currentPageId);
    expect(net.netOfElement(a)).not.toBe(net.netOfElement(b));
  }
});

test("accepted double-click commits exactly one wire", () => {
  const { editor, interaction } = setup();
  click(interaction, 0, 0);
  click(interaction, 30, 20);
  click(interaction, 30, 20);
  interaction.onDoubleClick({
    clientX: 30,
    clientY: 20,
    target: null,
    preventDefault() {},
  } as unknown as MouseEvent);
  expect(
    editor.store
      .getPageElements(editor.currentPageId)
      .filter((e) => e.type === "schematic.wire"),
  ).toHaveLength(1);
});

test("an endpoint on another wire interior joins only the endpoint wire", () => {
  const { editor, interaction } = setup();
  const a = wire(editor, -20, 0, 40, 0);
  const b = wire(editor, 0, -20, 0, 20);
  if (!a || !b) throw new Error("missing wires");
  click(interaction, 0, 30);
  click(interaction, 0, 0);
  const elements = editor.store.getPageElements(editor.currentPageId);
  const added = elements.find(
    (e) => e.type === "schematic.wire" && e.id !== a && e.id !== b,
  );
  if (!added) throw new Error("missing added wire");
  expect(elements.filter((e) => e.type === "schematic.junction")).toHaveLength(
    0,
  );
  const nets = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  expect(nets.netOfElement(added.id)).toBe(nets.netOfElement(b));
  expect(nets.netOfElement(a)).not.toBe(nets.netOfElement(b));
});

test("a plain crossing finished with Enter adds no junction", () => {
  const { editor, interaction } = setup();
  const a = wire(editor, -20, 0, 40, 0);
  const b = wire(editor, 0, -20, 0, 40);
  if (!a || !b) throw new Error("missing wires");
  click(interaction, 30, 30);
  click(interaction, 0, 0);
  interaction.onKeyDown(key("Enter"));
  const elements = editor.store.getPageElements(editor.currentPageId);
  expect(elements.filter((e) => e.type === "schematic.junction")).toHaveLength(
    0,
  );
  const nets = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  expect(nets.netOfElement(a)).not.toBe(nets.netOfElement(b));
});

test("a rejected finishing target retains draft, pending junction and undo history", () => {
  const { editor, interaction } = setup();
  const start = wire(editor, -20, -1e9, 40, 0);
  const target = editor.createSchematicElement("schematic.junction", {
    x: 0,
    y: 1e9,
  });
  if (!start || !target) throw new Error("missing targets");
  click(interaction, 0, -1e9);
  const draft = interaction.wireDraft();
  const before = editor.getSnapshot();
  click(interaction, 0, 1e9);
  expect(interaction.wireDraft()).toEqual(draft);
  expect(editor.getSnapshot()).toEqual(before);
  expect(interaction.schematicWireNotice()).toBe(
    "Wire is outside the coordinate range",
  );
  interaction.onDoubleClick({
    clientX: 0,
    clientY: 1e9,
    target: null,
    preventDefault() {},
  } as unknown as MouseEvent);
  expect(editor.getSnapshot()).toEqual(before);
  expect(interaction.wireDraft()).toEqual(draft);
  expect(editor.undo()).toBe(true);
  expect(editor.store.get(target)).toBeUndefined();
  expect(editor.redo()).toBe(true);
  expect(editor.getSnapshot()).toEqual(before);
  click(interaction, 0, -1e9 + 30);
  interaction.onKeyDown(key("Enter"));
  const junctions = editor.store
    .getPageElements(editor.currentPageId)
    .filter((e) => e.type === "schematic.junction");
  expect(junctions).toHaveLength(2);
  expect(junctions.some((e) => e.visual.x === 0 && e.visual.y === -1e9)).toBe(
    true,
  );
});

test("rejected double-click leaves the undo stack unchanged", () => {
  const { editor, interaction } = setup();
  wire(editor, -20, 0, 40, 0);
  wire(editor, 0, -20, 0, 40);
  const label = editor.createSchematicElement("schematic.label", {
    x: 0,
    y: 0,
  });
  if (!label) throw new Error("missing label");
  click(interaction, 50, 50);
  click(interaction, 60, 50);
  click(interaction, 0, 0);
  click(interaction, 0, 0);
  const before = editor.getSnapshot();
  const draft = interaction.wireDraft();
  const notice = interaction.schematicWireNotice();
  interaction.onDoubleClick({
    clientX: 0,
    clientY: 0,
    target: null,
    preventDefault() {},
  } as unknown as MouseEvent);
  expect(editor.getSnapshot()).toEqual(before);
  expect(interaction.wireDraft()).toEqual(draft);
  expect(interaction.schematicWireNotice()).toBe(notice);
  expect(editor.undo()).toBe(true);
  expect(editor.store.get(label)).toBeUndefined();
  expect(editor.redo()).toBe(true);
  expect(editor.getSnapshot()).toEqual(before);
});

test("a deliberate T start joins its source with one undo", () => {
  const { editor, interaction } = setup();
  const original = wire(editor, -20, 0, 40, 0);
  if (!original) throw new Error("missing original wire");
  click(interaction, 0, 0);
  click(interaction, 0, 30);
  interaction.onKeyDown(key("Enter"));
  const elements = editor.store.getPageElements(editor.currentPageId);
  const junction = elements.find((e) => e.type === "schematic.junction");
  const added = elements.find(
    (e) => e.type === "schematic.wire" && e.id !== original,
  );
  if (!junction || !added) throw new Error("missing junction or wire");
  const nets = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  expect(nets.netOfElement(original)).toBe(nets.netOfElement(added.id));
  expect(editor.undo()).toBe(true);
  expect(editor.store.get(junction.id)).toBeUndefined();
  expect(editor.store.get(added.id)).toBeUndefined();
  expect(editor.store.get(original)).toBeDefined();
});

test("lattice joinables are classified without a proximity winner", () => {
  const { editor } = setup();
  editor.createSchematicElement("schematic.junction", { x: 0, y: 0 });
  expect(
    classifySchematicWireTarget(editor.store, editor.currentPageId, {
      x: 4.9,
      y: 4.9,
    }),
  ).toEqual({
    snapped: { x: 0, y: 0 },
    key: { kx: 0, ky: 0 },
    kind: "joinable",
  });
});

test("wire notice clears after an accepted click or draft cancellation", () => {
  const { editor, interaction, setTool } = setup();
  wire(editor, -20, 0, 40, 0);
  wire(editor, 0, -20, 0, 40);
  editor.createSchematicElement("schematic.label", { x: 0, y: 0 });
  click(interaction, 0, 0);
  expect(interaction.schematicWireNotice()).toBe(
    SCHEMATIC_LABEL_CROSSING_MESSAGE,
  );
  click(interaction, 50, 50);
  expect(interaction.schematicWireNotice()).toBeNull();
  click(interaction, 0, 0);
  expect(interaction.schematicWireNotice()).toBe(
    SCHEMATIC_LABEL_CROSSING_MESSAGE,
  );
  interaction.onKeyDown(key("Escape"));
  expect(interaction.schematicWireNotice()).toBeNull();
  setTool(Tool.SchematicWire);
  expect(interaction.schematicWireNotice()).toBeNull();
  setTool(Tool.Select);
  expect(interaction.schematicWireNotice()).toBeNull();
});

test("double-click finishing on a wire body keeps the deliberate T junction", () => {
  const { editor, interaction } = setup();
  const original = wire(editor, -20, 0, 40, 0);
  if (!original) throw new Error("missing original wire");
  click(interaction, 0, 40);
  click(interaction, 0, 0);
  click(interaction, 0, 0);
  interaction.onDoubleClick({
    clientX: 0,
    clientY: 0,
    target: null,
    preventDefault() {},
  } as unknown as MouseEvent);
  const elements = editor.store.getPageElements(editor.currentPageId);
  const junctions = elements.filter((e) => e.type === "schematic.junction");
  expect(junctions).toHaveLength(1);
  const junction = junctions[0];
  const added = elements.find(
    (e) => e.type === "schematic.wire" && e.id !== original,
  );
  if (!junction || !added) throw new Error("missing junction or added wire");
  expect(junction.visual).toMatchObject({ x: 0, y: 0 });
  const nets = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  expect(nets.netOfElement(original)).toBe(nets.netOfElement(added.id));
  expect(editor.undo()).toBe(true);
  expect(
    editor.store.getPageElements(editor.currentPageId).map((e) => e.id),
  ).toEqual([original]);
});

test("returning to an earlier draft bend does not create a T junction", () => {
  const { editor, interaction } = setup();
  const original = wire(editor, -20, 0, 40, 0);
  if (!original) throw new Error("missing original wire");
  click(interaction, 0, 40);
  click(interaction, 0, 0);
  click(interaction, 30, 0);
  click(interaction, 0, 0);
  interaction.onKeyDown(key("Enter"));
  const elements = editor.store.getPageElements(editor.currentPageId);
  expect(elements.filter((e) => e.type === "schematic.junction")).toHaveLength(
    0,
  );
  const added = elements.find(
    (e) => e.type === "schematic.wire" && e.id !== original,
  );
  if (!added) throw new Error("missing new wire");
  const nets = computeSchematicConnectivity(
    editor.getSnapshot(),
    editor.currentPageId,
  );
  expect(nets.netOfElement(original)).not.toBe(nets.netOfElement(added.id));
});
