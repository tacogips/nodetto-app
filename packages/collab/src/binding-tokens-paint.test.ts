import { expect, test } from "bun:test";
import {
  bindSelectionColor,
  createColorToken,
  setColorTokenAlias,
  setElementFillGradient,
  setElementStrokeGradient,
  bindSelectionNumber,
  createNumberToken,
  updateNumberToken,
  updateColorToken,
} from "@nodetto/core";
import type { FillGradient, LayerEffect } from "@nodetto/ir";
import { erdDocument, freeformDocument } from "./test-fixtures.ts";
import { Wire, peer, expectConverged } from "./binding-test-helpers.ts";

test("concurrent token edits and new bindings resolve the merged token value", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const token = createColorToken(a.editor, "Brand", "#123456");
  const layer = a.editor
    .getSnapshot()
    .elements.find((element) => element.type !== "design.token")?.id;
  if (!token || !layer) throw new Error("missing fixture");
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  updateColorToken(a.editor, token, "Brand", "#abcdef");
  b.editor.selection.set([layer]);
  bindSelectionColor(b.editor, "fill", token);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get(layer)?.visual.colorTokens?.fill).toBe(
      token,
    );
    expect(client.editor.store.get(layer)?.visual.style?.fill).toBe("#abcdef");
  }
  expectConverged(a, b, wire);
  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(b.editor.store.get(layer)?.visual.style?.fill).toBe("#123456");
  expect(b.editor.store.get(layer)?.visual.colorTokens?.fill).toBe(token);
  expectConverged(a, b, wire);
});

test("page token modes and aliases converge with independent undo", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const primitive = createColorToken(a.editor, "Blue", "#2563eb");
  const semantic = createColorToken(a.editor, "Action", "#64748b");
  const layer = "n-idea";
  if (!primitive || !semantic) throw new Error("missing tokens");
  setColorTokenAlias(a.editor, semantic, primitive);
  a.editor.selection.set([layer]);
  bindSelectionColor(a.editor, "fill", semantic);
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  b.editor.setPageTokenMode("p1", "Dark");
  updateColorToken(a.editor, primitive, "Blue", "#1d4ed8");
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.getPage("p1")?.tokenMode).toBe("Dark");
    expect(client.editor.store.get(layer)?.visual.style?.fill).toBe("#1d4ed8");
  }

  updateColorToken(a.editor, primitive, "Blue", "#60a5fa");
  wire.flush();
  expect(b.editor.store.get(layer)?.visual.style?.fill).toBe("#60a5fa");
  expectConverged(a, b, wire);
  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.getPage("p1")?.tokenMode).toBe("Dark");
    expect(client.editor.store.get(layer)?.visual.style?.fill).toBe("#1d4ed8");
  }
  expectConverged(a, b, wire);
});

test("measurement bindings and token edits converge with derived geometry", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const token = createNumberToken(a.editor, "Card width", 180);
  const layer = a.editor
    .getSnapshot()
    .elements.find((element) => element.type !== "design.token")?.id;
  if (!token || !layer) throw new Error("missing fixture");
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  updateNumberToken(a.editor, token, "Card width", 240);
  b.editor.selection.set([layer]);
  bindSelectionNumber(b.editor, "width", token);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get(layer)?.visual.numberTokens?.width).toBe(
      token,
    );
    expect(client.editor.getBounds(layer)?.width).toBe(240);
  }
  expectConverged(a, b, wire);
});

test("gradient fills converge alongside semantic engineering edits", () => {
  const wire = new Wire();
  const a = peer(wire, erdDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const gradient: FillGradient = {
    type: "angular",
    centerX: 0.4,
    centerY: 0.3,
    angle: 25,
    stops: [
      { offset: 0, color: "#ffffff" },
      { offset: 1, color: "#2563eb", opacity: 0.75 },
    ],
  };
  a.editor.selection.set(["t-users"]);
  a.editor.setSelectionStyle({ fillGradient: gradient });
  const orders = b.editor.store.get("t-orders");
  b.editor.apply([
    {
      type: "updateSemantic",
      id: "t-orders",
      semantic: {
        ...(orders?.semantic as object),
        tableName: "purchases",
      },
    },
  ]);
  wire.flush();
  for (const client of [a, b]) {
    expect(
      client.editor.store.get("t-users")?.visual.style?.fillGradient,
    ).toEqual(gradient);
    expect(
      (client.editor.store.get("t-orders")?.semantic as { tableName: string })
        .tableName,
    ).toBe("purchases");
  }
  expectConverged(a, b, wire);
});

test("concurrent gradient geometry fields merge with isolated undo", () => {
  const wire = new Wire();
  const a = peer(wire, erdDocument());
  a.binding.attach();
  const original: FillGradient = {
    type: "linear",
    angle: 90,
    stops: [
      { offset: 0, color: "#ffffff" },
      { offset: 0.5, color: "#7c3aed" },
      { offset: 1, color: "#2563eb" },
    ],
  };
  a.editor.selection.set(["t-users"]);
  a.editor.setSelectionStyle({ fillGradient: original });
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  expect(
    setElementFillGradient(a.editor, "t-users", { ...original, angle: 0 }),
  ).toBe(true);
  expect(
    setElementFillGradient(b.editor, "t-users", {
      ...original,
      stops: original.stops.map((stop, index) =>
        index === 1 ? { ...stop, offset: 0.7 } : stop,
      ),
    }),
  ).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    const gradient =
      client.editor.store.get("t-users")?.visual.style?.fillGradient;
    expect(gradient).toMatchObject({ angle: 0 });
    expect(gradient?.stops[1]?.offset).toBe(0.7);
  }

  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    const gradient =
      client.editor.store.get("t-users")?.visual.style?.fillGradient;
    expect(gradient).toMatchObject({ angle: 0 });
    expect(gradient?.stops[1]?.offset).toBe(0.5);
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("concurrent stroke-gradient angle and stop edits merge", () => {
  const wire = new Wire();
  const a = peer(wire, erdDocument());
  a.binding.attach();
  const original: FillGradient = {
    type: "linear",
    angle: 90,
    stops: [
      { offset: 0, color: "#ffffff" },
      { offset: 0.5, color: "#7c3aed" },
      { offset: 1, color: "#2563eb" },
    ],
  };
  a.editor.selection.set(["t-users"]);
  a.editor.setSelectionStyle({ strokeGradient: original });
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  setElementStrokeGradient(a.editor, "t-users", { ...original, angle: 180 });
  setElementStrokeGradient(b.editor, "t-users", {
    ...original,
    stops: original.stops.map((stop, index) =>
      index === 1 ? { ...stop, offset: 0.75 } : stop,
    ),
  });
  wire.flush();
  for (const client of [a, b]) {
    const gradient =
      client.editor.store.get("t-users")?.visual.style?.strokeGradient;
    expect(gradient).toMatchObject({ angle: 180 });
    expect(gradient?.stops[1]?.offset).toBe(0.75);
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("effect stacks converge alongside semantic engineering edits", () => {
  const wire = new Wire();
  const a = peer(wire, erdDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const effects = [
    {
      type: "drop-shadow",
      x: 2,
      y: 6,
      blur: 4,
      color: "#123456",
      opacity: 0.4,
    },
    { type: "layer-blur", blur: 1, enabled: false },
  ] satisfies readonly LayerEffect[];
  a.editor.selection.set(["t-users"]);
  a.editor.setSelectionStyle({ effects });
  const orders = b.editor.store.get("t-orders");
  b.editor.apply([
    {
      type: "updateSemantic",
      id: "t-orders",
      semantic: {
        ...(orders?.semantic as object),
        tableName: "archived_orders",
      },
    },
  ]);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get("t-users")?.visual.style?.effects).toEqual(
      effects,
    );
    expect(
      (client.editor.store.get("t-orders")?.semantic as { tableName: string })
        .tableName,
    ).toBe("archived_orders");
  }
  expectConverged(a, b, wire);
});

test("concurrent compositing and stroke geometry merge with peer-local undo", () => {
  const wire = new Wire();
  const a = peer(wire, erdDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  a.editor.selection.set(["t-users"]);
  b.editor.selection.set(["t-users"]);
  a.editor.setSelectionStyle({ blendMode: "multiply", strokeCap: "round" });
  b.editor.setSelectionStyle({
    opacity: 0.45,
    strokeJoin: "bevel",
    strokeMiterLimit: 6,
  });
  wire.flush();
  for (const client of [a, b])
    expect(client.editor.store.get("t-users")?.visual.style).toMatchObject({
      blendMode: "multiply",
      opacity: 0.45,
      strokeCap: "round",
      strokeJoin: "bevel",
      strokeMiterLimit: 6,
    });
  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get("t-users")?.visual.style?.blendMode).toBe(
      "multiply",
    );
    expect(
      client.editor.store.get("t-users")?.visual.style?.opacity,
    ).toBeUndefined();
    expect(client.editor.store.get("t-users")?.visual.style?.strokeCap).toBe(
      "round",
    );
    expect(
      client.editor.store.get("t-users")?.visual.style?.strokeJoin,
    ).toBeUndefined();
    expect(
      client.editor.store.get("t-users")?.visual.style?.strokeMiterLimit,
    ).toBeUndefined();
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("concurrent independent corner edits merge by corner with local undo", () => {
  const wire = new Wire();
  const a = peer(wire, erdDocument());
  a.binding.attach();
  a.editor.selection.set(["t-users"]);
  a.editor.setSelectionStyle({
    cornerRadii: {
      topLeft: 8,
      topRight: 8,
      bottomRight: 8,
      bottomLeft: 8,
    },
  });
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  a.editor.setSelectionStyle({
    cornerRadii: {
      topLeft: 24,
      topRight: 8,
      bottomRight: 8,
      bottomLeft: 8,
    },
  });
  b.editor.selection.set(["t-users"]);
  b.editor.setSelectionStyle({
    cornerRadii: {
      topLeft: 8,
      topRight: 16,
      bottomRight: 8,
      bottomLeft: 8,
    },
  });
  wire.flush();
  for (const client of [a, b])
    expect(
      client.editor.store.get("t-users")?.visual.style?.cornerRadii,
    ).toEqual({
      topLeft: 24,
      topRight: 16,
      bottomRight: 8,
      bottomLeft: 8,
    });
  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b])
    expect(
      client.editor.store.get("t-users")?.visual.style?.cornerRadii,
    ).toEqual({
      topLeft: 24,
      topRight: 8,
      bottomRight: 8,
      bottomLeft: 8,
    });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});
