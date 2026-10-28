import { expect, test } from "bun:test";
import type { FrameSemantic } from "@nodetto/ir";
import { erdDocument, freeformDocument } from "./test-fixtures.ts";
import {
  Wire,
  peer,
  elementIn,
  expectConverged,
} from "./binding-test-helpers.ts";

test("merges concurrent wrapping fields with peer-local undo", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const frame = a.editor.buildElement("frame", {
    semantic: {
      name: "Tags",
      memberIds: [],
      layout: {
        direction: "horizontal",
        gap: 8,
        padding: 12,
        sizing: "fixed",
        align: "start",
      },
    },
  });
  a.editor.apply([{ type: "createElement", element: frame }]);
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  const semanticIn = (client: ReturnType<typeof peer>) =>
    elementIn(client, frame.id).semantic as FrameSemantic;
  a.editor.apply([
    {
      type: "updateSemantic",
      id: frame.id,
      semantic: {
        ...semanticIn(a),
        layout: { ...semanticIn(a).layout!, wrap: true },
      },
    },
  ]);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: frame.id,
      semantic: {
        ...semanticIn(b),
        layout: { ...semanticIn(b).layout!, crossGap: 16 },
      },
    },
  ]);
  wire.flush();
  for (const client of [a, b])
    expect(semanticIn(client).layout).toMatchObject({
      wrap: true,
      crossGap: 16,
    });
  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(semanticIn(client).layout?.wrap).toBeUndefined();
    expect(semanticIn(client).layout?.crossGap).toBe(16);
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("wrapped per-line fill converges after concurrent resize and line-gap edits", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const fixedA = a.editor.buildElement("shape.geo", {
    visual: { x: 0, y: 0, width: 120, height: 20 },
  });
  const fillA = a.editor.buildElement("shape.geo", {
    visual: { x: 0, y: 0, width: 40, height: 20, layoutGrow: 1 },
  });
  const fixedB = a.editor.buildElement("shape.geo", {
    visual: { x: 0, y: 0, width: 80, height: 30 },
  });
  const fillB = a.editor.buildElement("shape.geo", {
    visual: { x: 0, y: 0, width: 40, height: 30, layoutGrow: 2 },
  });
  const frame = a.editor.buildElement("frame", {
    semantic: {
      name: "Responsive cards",
      memberIds: [fixedA.id, fillA.id, fixedB.id, fillB.id],
      layout: {
        direction: "horizontal",
        gap: 10,
        crossGap: 5,
        wrap: true,
        padding: 10,
        sizing: "fixed",
        align: "start",
      },
    },
    visual: { x: 0, y: 0, width: 200, height: 200 },
  });
  a.editor.apply(
    [frame, fixedA, fillA, fixedB, fillB].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  expect(b.editor.getBounds(fillA.id)?.width).toBe(50);
  expect(b.editor.getBounds(fillB.id)?.width).toBe(90);

  a.editor.apply([
    { type: "updateVisual", id: frame.id, visual: { width: 250 } },
  ]);
  const semantic = b.editor.store.get(frame.id)?.semantic as FrameSemantic;
  b.editor.apply([
    {
      type: "updateSemantic",
      id: frame.id,
      semantic: {
        ...semantic,
        layout: { ...semantic.layout!, crossGap: 9 },
      },
    },
  ]);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.getBounds(fillA.id)?.width).toBe(10);
    expect(client.editor.getBounds(fillB.id)).toMatchObject({
      x: 10,
      y: 49,
      width: 230,
    });
  }
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.getBounds(fillA.id)?.width).toBe(50);
    expect(client.editor.getBounds(fillB.id)).toMatchObject({
      x: 100,
      y: 39,
      width: 90,
    });
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("absolute layout mode merges with a remote responsive constraint", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const child = a.editor.buildElement("shape.geo", {
    visual: { x: 20, y: 20, width: 40, height: 40 },
  });
  const frame = a.editor.buildElement("frame", {
    semantic: {
      name: "Overlay card",
      memberIds: [child.id],
      layout: {
        direction: "vertical",
        gap: 8,
        padding: 20,
        sizing: "fixed",
        align: "start",
      },
    },
    visual: { x: 0, y: 0, width: 300, height: 200 },
  });
  a.editor.apply(
    [frame, child].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  a.editor.apply([
    {
      type: "updateVisual",
      id: child.id,
      visual: { layoutPosition: "absolute" },
    },
  ]);
  b.editor.apply([
    {
      type: "updateVisual",
      id: child.id,
      visual: { horizontalConstraint: "end" },
    },
  ]);
  wire.flush();
  for (const client of [a, b])
    expect(client.editor.store.get(child.id)?.visual).toMatchObject({
      layoutPosition: "absolute",
      horizontalConstraint: "end",
    });
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(
      client.editor.store.get(child.id)?.visual.layoutPosition,
    ).toBeUndefined();
    expect(client.editor.store.get(child.id)?.visual.horizontalConstraint).toBe(
      "end",
    );
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("concurrent auto-layout size limits merge and retain bounded geometry", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const child = a.editor.buildElement("shape.geo", {
    visual: { x: 0, y: 0, width: 40, height: 40, layoutGrow: 1 },
  });
  const frame = a.editor.buildElement("frame", {
    semantic: {
      name: "Bounded row",
      memberIds: [child.id],
      layout: {
        direction: "horizontal",
        gap: 0,
        padding: 0,
        sizing: "fixed",
        align: "start",
      },
    },
    visual: { x: 0, y: 0, width: 300, height: 80 },
  });
  a.editor.apply(
    [frame, child].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  a.editor.apply([
    { type: "updateVisual", id: child.id, visual: { minWidth: 100 } },
  ]);
  b.editor.apply([
    { type: "updateVisual", id: child.id, visual: { maxWidth: 240 } },
  ]);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get(child.id)?.visual).toMatchObject({
      minWidth: 100,
      maxWidth: 240,
      width: 240,
    });
  }
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get(child.id)?.visual.minWidth).toBeUndefined();
    expect(client.editor.store.get(child.id)?.visual.maxWidth).toBe(240);
    expect(client.editor.getBounds(child.id)?.width).toBe(240);
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

for (const swapped of [false, true])
  test(`concurrent width and padding edits reconcile geometry without repair undo entries (${swapped})`, () => {
    const wire = new Wire();
    const a = peer(wire, freeformDocument());
    a.binding.attach();
    const frame = a.editor.buildElement("frame", {
      visual: { x: 0, y: 0, width: 500, height: 200 },
    });
    const child = a.editor.buildElement("shape.geo", {
      visual: { x: 0, y: 0, width: 50, height: 30, layoutGrow: 1 },
    });
    const semantic: FrameSemantic = {
      name: "Concurrent",
      memberIds: [child.id],
      layout: {
        direction: "horizontal",
        sizing: "fixed",
        align: "start",
        gap: 0,
        padding: 20,
      },
    };
    a.editor.apply([
      { type: "createElement", element: { ...frame, semantic } },
      { type: "createElement", element: child },
    ]);
    const b = peer(wire);
    wire.flush();
    b.binding.attach();
    wire.flush();
    const resize = swapped ? b : a;
    const padding = swapped ? a : b;
    resize.editor.apply([
      { type: "updateVisual", id: frame.id, visual: { width: 700 } },
    ]);
    padding.editor.apply([
      {
        type: "updateSemantic",
        id: frame.id,
        semantic: { ...semantic, layout: { ...semantic.layout, padding: 50 } },
      },
    ]);
    wire.flush();
    for (const client of [a, b]) {
      expect(client.editor.getBounds(frame.id)?.width).toBe(700);
      expect(client.editor.getBounds(child.id)).toMatchObject({
        x: 50,
        width: 600,
      });
    }
    expectConverged(a, b, wire);
    expect(resize.binding.undo()).toBe(true);
    wire.flush();
    expect(a.editor.getBounds(child.id)).toMatchObject({ x: 50, width: 400 });
    expectConverged(a, b, wire);
    expect(padding.binding.undo()).toBe(true);
    wire.flush();
    expect(a.editor.getBounds(child.id)).toMatchObject({ x: 20, width: 460 });
    expectConverged(a, b, wire);
    expect(b.binding.canUndo()).toBe(false);
  });

test("concurrent ratio and width edits converge with derived height", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const shape = a.editor.buildElement("shape.geo", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  a.editor.apply([{ type: "createElement", element: shape }]);
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  a.editor.apply([
    { type: "updateVisual", id: shape.id, visual: { aspectRatio: 2 } },
  ]);
  b.editor.resizeElement(shape.id, {
    x: 0,
    y: 0,
    width: 240,
    height: 100,
  });
  wire.flush();

  for (const client of [a, b]) {
    expect(client.editor.store.get(shape.id)?.visual.aspectRatio).toBe(2);
    expect(client.editor.getBounds(shape.id)).toMatchObject({
      width: 240,
      height: 120,
    });
  }
  expectConverged(a, b, wire);
  expect(b.binding.undo()).toBe(true);
  wire.flush();
  expect(a.editor.getBounds(shape.id)).toMatchObject({
    width: 100,
    height: 50,
  });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("mixed fill/stretch layouts converge across remote resizing, padding edits and undo", () => {
  const wire = new Wire();
  const initial = erdDocument();
  const a = peer(wire, initial);
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  a.editor.createPage({ name: "Responsive UI" });
  const frame = a.editor.buildElement("frame", {
    visual: { x: 0, y: 0, width: 500, height: 200 },
  });
  const first = a.editor.buildElement("shape.geo", {
    visual: { x: 0, y: 0, width: 50, height: 30, layoutGrow: 1 },
  });
  const second = a.editor.buildElement("shape.geo", {
    visual: { x: 0, y: 0, width: 50, height: 30, layoutGrow: 3 },
  });
  const fixed = a.editor.buildElement("text.note", {
    semantic: { text: "Fixed label" },
    visual: { x: 0, y: 0, width: 100, height: 30 },
  });
  const semantic: FrameSemantic = {
    name: "Toolbar",
    memberIds: [first.id, second.id, fixed.id],
    layout: {
      direction: "horizontal",
      sizing: "fixed",
      align: "stretch",
      gap: 10,
      padding: 0,
      paddingTop: 5,
      paddingRight: 10,
      paddingBottom: 15,
      paddingLeft: 30,
    },
  };
  a.editor.apply([
    { type: "createElement", element: { ...frame, semantic } },
    ...[first, second, fixed].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  ]);
  wire.flush();
  expect(b.editor.getBounds(first.id)).toMatchObject({
    x: 30,
    y: 5,
    width: 85,
    height: 180,
  });
  expect(b.editor.getBounds(second.id)?.width).toBe(255);
  b.editor.apply([
    { type: "updateVisual", id: frame.id, visual: { width: 700 } },
  ]);
  wire.flush();
  expect(a.editor.getBounds(first.id)?.width).toBe(135);
  expect(a.editor.getBounds(second.id)?.width).toBe(405);
  a.editor.apply([
    {
      type: "updateSemantic",
      id: frame.id,
      semantic: {
        ...semantic,
        layout: { ...semantic.layout, paddingLeft: 50 },
      },
    },
  ]);
  wire.flush();
  expect(b.editor.getBounds(first.id)).toMatchObject({ x: 50, width: 130 });
  expect(b.editor.getBounds(second.id)?.width).toBe(390);
  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(b.editor.getBounds(first.id)).toMatchObject({ x: 30, width: 135 });
  expectConverged(a, b, wire);
  for (const element of initial.elements) {
    expect(a.editor.store.get(element.id)?.semantic).toEqual(element.semantic);
    expect(b.editor.store.get(element.id)?.semantic).toEqual(element.semantic);
  }
});
