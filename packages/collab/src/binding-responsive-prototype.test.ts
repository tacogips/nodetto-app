import { expect, test } from "bun:test";
import {
  addComponentVariantProperty,
  addPageGuide,
  pageGuides,
  updatePageGuide,
  updateComponentVariantProperty,
} from "@nodetto/core";
import type {
  FrameSemantic,
  GenericEdgeSemantic,
  ImageSemantic,
} from "@nodetto/ir";
import { erdDocument, freeformDocument } from "./test-fixtures.ts";
import {
  Wire,
  peer,
  elementIn,
  expectConverged,
} from "./binding-test-helpers.ts";

test("a responsive artboard copy converges and undoes as one transaction", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const child = a.editor.buildElement("shape.geo", {
    semantic: { geo: "rect", label: "CTA" },
    visual: {
      x: 20,
      y: 30,
      width: 1400,
      height: 48,
      horizontalConstraint: "stretch",
    },
  });
  const frame = a.editor.buildElement("frame", {
    semantic: { name: "Checkout", platform: "web", memberIds: [child.id] },
    visual: { x: 0, y: 0, width: 1440, height: 900 },
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

  const mobileId = a.editor.createResponsiveVariant(frame.id, "iphone");
  if (!mobileId) throw new Error("expected responsive variant");
  wire.flush();
  for (const client of [a, b]) {
    const mobile = client.editor.store.get(mobileId);
    expect(mobile?.visual).toMatchObject({ width: 390, height: 844 });
    expect(mobile?.semantic).toMatchObject({
      platform: "ios",
      safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
    });
    const memberId = (mobile?.semantic as FrameSemantic).memberIds?.[0];
    expect(client.editor.store.get(memberId ?? "")?.visual.width).toBe(350);
  }

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get(mobileId)).toBeUndefined();
    expect(client.editor.store.get(frame.id)).toBeDefined();
    expect(client.editor.store.get(child.id)).toBeDefined();
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("responsive source refresh converges while preserving a mobile override", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const label = a.editor.buildElement("text.note", {
    semantic: { text: "Checkout" },
    visual: {
      x: 24,
      y: 80,
      width: 1392,
      height: 40,
      horizontalConstraint: "stretch",
      style: { color: "#111827" },
    },
  });
  const source = a.editor.buildElement("frame", {
    semantic: { name: "Flow", memberIds: [label.id] },
    visual: { x: 0, y: 0, width: 1440, height: 900 },
  });
  a.editor.apply(
    [source, label].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const mobileId = a.editor.createResponsiveVariant(source.id, "android");
  if (!mobileId) throw new Error("expected responsive variant");
  const mobileLabelId = (
    a.editor.store.get(mobileId)?.semantic as FrameSemantic
  ).memberIds?.[0];
  if (!mobileLabelId) throw new Error("expected responsive label");
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  b.editor.apply([
    {
      type: "updateSemantic",
      id: mobileLabelId,
      semantic: { text: "Pay on Android" },
    },
  ]);
  a.editor.apply([
    {
      type: "updateSemantic",
      id: label.id,
      semantic: { text: "Review order" },
    },
    {
      type: "updateVisual",
      id: label.id,
      visual: { style: { color: "#7c3aed" } },
    },
  ]);
  wire.flush();
  expect(a.editor.refreshResponsiveVariant(mobileId)).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.getText(mobileLabelId)).toBe("Pay on Android");
    expect(client.editor.store.get(mobileLabelId)?.visual).toMatchObject({
      width: 312,
      style: { color: "#7c3aed" },
    });
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("responsive structure reconciliation converges and undoes atomically", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const label = a.editor.buildElement("text.note", {
    semantic: { text: "Checkout" },
    visual: {
      x: 24,
      y: 80,
      width: 1392,
      height: 40,
      horizontalConstraint: "stretch",
    },
  });
  const source = a.editor.buildElement("frame", {
    semantic: { name: "Flow", memberIds: [label.id] },
    visual: { x: 0, y: 0, width: 1440, height: 900 },
  });
  a.editor.apply(
    [source, label].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const mobileId = a.editor.createResponsiveVariant(source.id, "android");
  if (!mobileId) throw new Error("expected responsive variant");
  const mobileLabel = (a.editor.store.get(mobileId)?.semantic as FrameSemantic)
    .memberIds?.[0];
  if (!mobileLabel) throw new Error("expected mobile label");
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  b.editor.apply([
    {
      type: "updateSemantic",
      id: mobileLabel,
      semantic: { text: "Android checkout" },
    },
    {
      type: "updateVisual",
      id: mobileLabel,
      visual: { x: 1550, width: 300 },
    },
  ]);
  const action = a.editor.buildElement("shape.geo", {
    semantic: { geo: "rect", label: "Continue" },
    visual: {
      x: 24,
      y: 150,
      width: 1392,
      height: 48,
      horizontalConstraint: "stretch",
    },
  });
  a.editor.apply([
    { type: "createElement", element: action },
    {
      type: "updateSemantic",
      id: source.id,
      semantic: {
        ...(source.semantic as object),
        memberIds: [label.id, action.id],
      },
    },
  ]);
  wire.flush();

  expect(a.editor.updateResponsiveStructure(mobileId)).toBe(true);
  const actionTarget = (
    a.editor.store.get(mobileId)?.semantic as FrameSemantic
  ).instanceBindings?.find((binding) => binding.source === action.id)?.target;
  if (!actionTarget) throw new Error("expected responsive action");
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.getText(mobileLabel)).toBe("Android checkout");
    expect(client.editor.store.get(mobileLabel)?.visual).toMatchObject({
      x: 1550,
      width: 300,
    });
    expect(client.editor.store.get(actionTarget)?.visual).toMatchObject({
      x: 1544,
      width: 312,
    });
  }
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.has(action.id)).toBe(true);
    expect(client.editor.store.has(actionTarget)).toBe(false);
    expect(client.editor.getText(mobileLabel)).toBe("Android checkout");
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("persistent page guides converge by field with peer-local undo", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  expect(
    addPageGuide(a.editor, a.editor.currentPageId, "x", 320, "shared-guide"),
  ).toBe("shared-guide");
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  expect(updatePageGuide(a.editor, "shared-guide", { position: 360 })).toBe(
    true,
  );
  expect(updatePageGuide(b.editor, "shared-guide", { color: "#2563eb" })).toBe(
    true,
  );
  wire.flush();
  for (const client of [a, b])
    expect(
      pageGuides(client.editor, client.editor.currentPageId)[0],
    ).toMatchObject({ position: 360, color: "#2563eb" });

  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b])
    expect(
      pageGuides(client.editor, client.editor.currentPageId)[0],
    ).toMatchObject({ position: 360, color: "#ec4899" });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("concurrent component variant-property fields merge with isolated undo", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const definition = a.editor.buildElement("frame", {
    semantic: {
      name: "Button",
      component: true,
      variantSet: "Button",
      memberIds: [],
    },
  });
  a.editor.apply([{ type: "createElement", element: definition }]);
  expect(
    addComponentVariantProperty(
      a.editor,
      definition.id,
      "State",
      "Default",
      "state-property",
    ),
  ).toBe(true);
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  expect(
    updateComponentVariantProperty(
      a.editor,
      definition.id,
      "state-property",
      "Interaction",
      "Default",
    ),
  ).toBe(true);
  expect(
    updateComponentVariantProperty(
      b.editor,
      definition.id,
      "state-property",
      "State",
      "Hover",
    ),
  ).toBe(true);
  wire.flush();
  for (const client of [a, b])
    expect(
      (client.editor.store.get(definition.id)?.semantic as FrameSemantic)
        .variantProperties?.[0],
    ).toMatchObject({ name: "Interaction", value: "Hover" });

  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b])
    expect(
      (client.editor.store.get(definition.id)?.semantic as FrameSemantic)
        .variantProperties?.[0],
    ).toMatchObject({ name: "Interaction", value: "Default" });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("concurrent image crop fields merge with isolated undo", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const image = a.editor.buildElement("image.raster", {
    semantic: {
      src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      alt: "",
      crop: { x: 0, y: 0, width: 0.8, height: 1 },
    },
  });
  a.editor.apply([{ type: "createElement", element: image }]);
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  for (const [client, crop] of [
    [a, { x: 0.1, y: 0, width: 0.8, height: 1 }],
    [b, { x: 0, y: 0, width: 0.7, height: 1 }],
  ] as const) {
    const semantic = client.editor.store.get(image.id)
      ?.semantic as ImageSemantic;
    client.editor.apply([
      { type: "updateSemantic", id: image.id, semantic: { ...semantic, crop } },
    ]);
  }
  wire.flush();
  for (const client of [a, b])
    expect(
      (client.editor.store.get(image.id)?.semantic as ImageSemantic).crop,
    ).toEqual({ x: 0.1, y: 0, width: 0.7, height: 1 });

  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b])
    expect(
      (client.editor.store.get(image.id)?.semantic as ImageSemantic).crop,
    ).toEqual({ x: 0.1, y: 0, width: 0.8, height: 1 });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("prototype triggers and transitions converge with independent undo", () => {
  const wire = new Wire();
  const initial = erdDocument();
  const a = peer(wire, initial);
  a.binding.attach();
  const source = a.editor.buildElement("node.generic", {
    semantic: { label: "Continue" },
  });
  const start = a.editor.buildElement("frame", {
    semantic: { name: "Start", memberIds: [source.id] },
  });
  const target = a.editor.buildElement("frame", {
    semantic: { name: "Target", memberIds: [] },
    visual: { x: 500 },
  });
  const link = a.editor.buildElement("edge.generic", {
    semantic: { from: source.id, to: target.id, prototype: true },
  });
  a.editor.apply(
    [start, source, target, link].map((element) => ({
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
      type: "updateSemantic",
      id: link.id,
      semantic: {
        ...(elementIn(a, link.id).semantic as GenericEdgeSemantic),
        label: "Continue now",
      },
    },
    {
      type: "updateSemantic",
      id: start.id,
      semantic: {
        ...(elementIn(a, start.id).semantic as FrameSemantic),
        prototypeOverflow: "vertical",
      },
    },
    {
      type: "updateVisual",
      id: source.id,
      visual: { prototypeFixed: true },
    },
  ]);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: link.id,
      semantic: {
        ...(elementIn(b, link.id).semantic as GenericEdgeSemantic),
        prototypeAction: "open-overlay",
        prototypeTrigger: "after-delay",
        prototypeDelay: 750,
        prototypeTransition: "smart",
        prototypeDuration: 420,
        prototypeOverlayPosition: "manual",
        prototypeOverlayX: 32,
        prototypeOverlayY: 64,
        prototypeOverlayBackdrop: true,
        prototypeOverlayDismiss: true,
      },
    },
  ]);
  wire.flush();
  for (const client of [a, b])
    expect(elementIn(client, link.id).semantic).toMatchObject({
      label: "Continue now",
      prototypeAction: "open-overlay",
      prototypeTrigger: "after-delay",
      prototypeDelay: 750,
      prototypeTransition: "smart",
      prototypeDuration: 420,
      prototypeOverlayPosition: "manual",
      prototypeOverlayX: 32,
      prototypeOverlayY: 64,
      prototypeOverlayBackdrop: true,
      prototypeOverlayDismiss: true,
    });
  for (const client of [a, b]) {
    expect(elementIn(client, start.id).semantic).toMatchObject({
      prototypeOverflow: "vertical",
    });
    expect(elementIn(client, source.id).visual.prototypeFixed).toBe(true);
  }
  expectConverged(a, b, wire);
  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(elementIn(client, link.id).semantic).toEqual({
      from: source.id,
      to: target.id,
      prototype: true,
      label: "Continue now",
    });
    for (const element of initial.elements)
      expect(client.editor.store.get(element.id)?.semantic).toEqual(
        element.semantic,
      );
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("merges concurrent accessibility fields with peer-local undo", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const id = a.editor.createElement("text.note", {
    semantic: { text: "Continue" },
  });
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  a.editor.apply([
    {
      type: "replaceAccessibility",
      id,
      accessibility: { role: "button", label: "Continue checkout" },
    },
  ]);
  b.editor.apply([
    {
      type: "replaceAccessibility",
      id,
      accessibility: { disabled: true },
    },
  ]);
  wire.flush();
  for (const client of [a, b])
    expect(elementIn(client, id).accessibility).toEqual({
      role: "button",
      label: "Continue checkout",
      disabled: true,
    });
  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b])
    expect(elementIn(client, id).accessibility).toEqual({ disabled: true });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});
