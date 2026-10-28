import { expect, test } from "bun:test";
import {
  Editor,
  insertUiBlock,
  createSelectionResizeSnapshot,
  resizeSelection,
  rotateElement,
  rotateSelectionBy,
} from "@nodetto/core";
import type { FrameSemantic } from "@nodetto/ir";
import { erdDocument, freeformDocument } from "./test-fixtures.ts";
import {
  Wire,
  peer,
  elementIn,
  expectConverged,
} from "./binding-test-helpers.ts";

test("mixed engineering and UI component edits converge without flattening database references", () => {
  const wire = new Wire();
  const initial = erdDocument();
  const a = peer(wire, initial);
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const designPage = a.editor.createPage({ name: "Mobile UI" });
  const component = insertUiBlock(a.editor, "button", { x: 20, y: 20 });
  const instance = a.editor.createComponentInstance(component, {
    x: 20,
    y: 100,
  });
  if (!instance) throw new Error("missing UI instance");
  const semantic = a.editor.store.get(instance)?.semantic as FrameSemantic;
  a.editor.apply([
    {
      type: "updateSemantic",
      id: instance,
      semantic: { ...semantic, autoRefresh: true },
    },
  ]);
  wire.flush();
  b.editor.setCurrentPage(designPage);
  const target = semantic.memberIds?.[0];
  const source = (b.editor.store.get(component)?.semantic as FrameSemantic)
    .memberIds?.[0];
  if (!target || !source) throw new Error("missing component labels");
  b.editor.setText(target, "Local mobile label");
  wire.flush();
  a.editor.setText(source, "Shared label");
  a.editor.selection.set([source]);
  a.editor.setSelectionStyle({ color: "#abcdef" });
  wire.flush();
  expect(b.editor.getText(target)).toBe("Local mobile label");
  expect(b.editor.store.get(target)?.visual.style?.color).toBe("#abcdef");
  for (const element of initial.elements) {
    expect(a.editor.store.get(element.id)?.semantic).toEqual(element.semantic);
    expect(b.editor.store.get(element.id)?.semantic).toEqual(element.semantic);
  }
  b.editor.setText("t-users", "customers");
  wire.flush();
  expect(a.editor.getText("t-users")).toBe("customers");
  expect(a.editor.store.get("e-rel-1")?.semantic).toEqual(
    initial.elements.find((element) => element.id === "e-rel-1")?.semantic,
  );
  expect(a.editor.getText(target)).toBe("Local mobile label");
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("automatic component refresh preserves remote overrides and synchronizes inherited styles", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const child = a.editor.buildElement("text.note", {
    semantic: { text: "Default" },
  });
  const source = a.editor.buildElement("frame", {
    semantic: { name: "Button", component: true, memberIds: [child.id] },
  });
  a.editor.apply([
    { type: "createElement", element: source },
    { type: "createElement", element: child },
  ]);
  const id = a.editor.createComponentInstance(source.id);
  if (!id) throw new Error("missing instance");
  wire.flush();
  const target = (b.editor.store.get(id)?.semantic as FrameSemantic)
    .memberIds?.[0];
  if (!target) throw new Error("missing target");
  b.editor.setText(target, "Remote override");
  wire.flush();
  a.editor.setText(child.id, "New default");
  a.editor.apply([
    {
      type: "updateSemantic",
      id,
      semantic: {
        ...(a.editor.store.get(id)?.semantic as object),
        autoRefresh: true,
      },
    },
  ]);
  a.editor.selection.set([child.id]);
  a.editor.setSelectionStyle({ fontSize: 32 });
  expect(a.editor.store.get(target)?.visual.style?.fontSize).toBe(32);
  wire.flush();
  expect(b.editor.getText(target)).toBe("Remote override");
  expect(b.editor.store.get(target)?.visual.style?.fontSize).toBe(32);
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("frame clipping converges and remote toggles change picking", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const node = a.editor.buildElement("node.generic", {
    visual: { x: 1080, y: 1020, width: 60, height: 40 },
  });
  const frame = a.editor.buildElement("frame", {
    semantic: { name: "Screen", clipContent: true, memberIds: [node.id] },
    visual: { x: 1000, y: 1000, width: 100, height: 100 },
  });
  a.editor.apply([
    { type: "createElement", element: frame },
    { type: "createElement", element: node },
  ]);
  wire.flush();
  expect(b.editor.hitTest({ x: 1120, y: 1040 })).toBeNull();
  b.editor.apply([
    {
      type: "updateSemantic",
      id: frame.id,
      semantic: { ...(frame.semantic as object), clipContent: false },
    },
  ]);
  wire.flush();
  expect(a.editor.hitTest({ x: 1120, y: 1040 })).toBe(node.id);
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("auto layout membership and derived geometry converge between editors", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const child = a.editor.buildElement("node.generic", {
    visual: { x: 50, y: 50, width: 100, height: 40 },
  });
  const frame = a.editor.buildElement("frame", {
    semantic: {
      name: "Layout",
      memberIds: [child.id],
      layout: {
        direction: "vertical",
        gap: 10,
        padding: 20,
        sizing: "hug",
        align: "start",
      },
    },
    visual: { x: 500, y: 500 },
  });
  a.editor.apply([
    { type: "createElement", element: child },
    { type: "createElement", element: frame },
  ]);
  wire.flush();
  expect(b.editor.getBounds(child.id)?.x).toBe(520);
  b.editor.resizeElement(child.id, { x: 520, y: 520, width: 200, height: 70 });
  wire.flush();
  expect(a.editor.getBounds(frame.id)?.width).toBe(240);
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("rotated auto layout converges after concurrent rotation and gap edits", () => {
  const seed = new Editor();
  const first = seed.buildElement("node.generic", {
    semantic: { label: "First" },
    visual: { x: 0, y: 0, width: 100, height: 40 },
  });
  const second = seed.buildElement("node.generic", {
    semantic: { label: "Second" },
    visual: { x: 0, y: 0, width: 100, height: 40 },
  });
  const frame = seed.buildElement("frame", {
    semantic: {
      name: "Row",
      memberIds: [first.id, second.id],
      layout: {
        direction: "horizontal",
        gap: 10,
        padding: 20,
        sizing: "fixed",
        align: "start",
      },
    },
    visual: { x: 0, y: 0, width: 400, height: 200 },
  });
  seed.apply(
    [frame, first, second].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const wire = new Wire();
  const a = peer(wire, seed.getSnapshot());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  expect(rotateElement(a.editor, frame.id, 90)).toBe(true);
  const remote = elementIn(b, frame.id).semantic as FrameSemantic;
  b.editor.apply([
    {
      type: "updateSemantic",
      id: frame.id,
      semantic: { ...remote, layout: { ...remote.layout, gap: 30 } },
    },
  ]);
  wire.flush();

  for (const client of [a, b]) {
    expect(elementIn(client, frame.id).visual.rotation).toBe(90);
    expect(elementIn(client, first.id).visual).toMatchObject({
      x: 210,
      y: -50,
      rotation: 90,
    });
    expect(elementIn(client, second.id).visual).toMatchObject({
      x: 210,
      y: 80,
      rotation: 90,
    });
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("sequence reorder converges and peer-local undo preserves a remote rename", () => {
  const seed = new Editor();
  const actor = seed.createSequenceParticipant("actor", { x: 100, y: 80 });
  const service = seed.createSequenceParticipant("service", { x: 340, y: 80 });
  const initial = seed.getSnapshot();
  const wire = new Wire();
  const a = peer(wire, initial);
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  expect(a.editor.moveSequenceElement(service, -1)).toBe(true);
  const remoteActor = elementIn(b, actor);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: actor,
      semantic: { ...(remoteActor.semantic as object), name: "Customer" },
    },
  ]);
  wire.flush();

  expect(elementIn(a, actor).semantic).toMatchObject({ name: "Customer" });
  expect(elementIn(b, service).visual.x).toBe(20);
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(a, actor).semantic).toMatchObject({ name: "Customer" });
  expect(elementIn(a, actor).visual.x).toBe(20);
  expect(elementIn(a, service).visual.x).toBe(260);
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("group rotation converges and local undo preserves a remote member edit", () => {
  const seed = new Editor();
  const left = seed.buildElement("node.generic", {
    semantic: { label: "Left" },
    visual: { x: 0, y: 0, width: 100, height: 50 },
  });
  const right = seed.buildElement("node.generic", {
    semantic: { label: "Right" },
    visual: { x: 200, y: 0, width: 100, height: 50 },
  });
  const group = seed.buildElement("group", {
    semantic: { memberIds: [left.id, right.id] },
  });
  seed.apply(
    [left, right, group].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const wire = new Wire();
  const a = peer(wire, seed.getSnapshot());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  expect(rotateElement(a.editor, group.id, 90)).toBe(true);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: left.id,
      semantic: { label: "Remote label" },
    },
  ]);
  wire.flush();
  expect(elementIn(b, group.id).visual.rotation).toBe(90);
  expect(elementIn(b, left.id).visual).toMatchObject({
    x: 100,
    y: -100,
    rotation: 90,
  });
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(a, left.id).semantic).toEqual({ label: "Remote label" });
  expect(elementIn(a, left.id).visual).toEqual(left.visual);
  expect(elementIn(a, right.id).visual).toEqual(right.visual);
  expect(elementIn(a, group.id).visual.rotation).toBeUndefined();
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("multi-selection rotation converges and local undo preserves a remote edit", () => {
  const seed = new Editor();
  const left = seed.buildElement("node.generic", {
    semantic: { label: "Left" },
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const right = seed.buildElement("node.generic", {
    semantic: { label: "Right" },
    visual: { x: 200, y: 0, width: 100, height: 100 },
  });
  seed.apply(
    [left, right].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const wire = new Wire();
  const a = peer(wire, seed.getSnapshot());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  a.editor.selection.set([left.id, right.id]);
  expect(rotateSelectionBy(a.editor, 90)).toBe(true);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: left.id,
      semantic: { label: "Remote label" },
    },
  ]);
  wire.flush();
  expect(elementIn(b, left.id).visual).toMatchObject({
    x: 100,
    y: -100,
    rotation: 90,
  });
  expect(elementIn(b, right.id).visual).toMatchObject({
    x: 100,
    y: 100,
    rotation: 90,
  });
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(a, left.id).semantic).toEqual({ label: "Remote label" });
  expect(elementIn(a, left.id).visual).toEqual(left.visual);
  expect(elementIn(a, right.id).visual).toEqual(right.visual);
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("multi-selection resize converges and local undo preserves a remote edit", () => {
  const seed = new Editor();
  const left = seed.buildElement("node.generic", {
    semantic: { label: "Left" },
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const right = seed.buildElement("node.generic", {
    semantic: { label: "Right" },
    visual: { x: 200, y: 0, width: 100, height: 100 },
  });
  seed.apply(
    [left, right].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const wire = new Wire();
  const a = peer(wire, seed.getSnapshot());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  a.editor.selection.set([left.id, right.id]);
  const snapshot = createSelectionResizeSnapshot(a.editor);
  if (!snapshot) throw new Error("expected resize snapshot");
  expect(
    resizeSelection(a.editor, snapshot, {
      x: 0,
      y: 0,
      width: 600,
      height: 200,
    }),
  ).toBe(true);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: left.id,
      semantic: { label: "Remote label" },
    },
  ]);
  wire.flush();
  expect(elementIn(b, left.id).visual).toMatchObject({
    width: 200,
    height: 200,
  });
  expect(elementIn(b, right.id).visual).toMatchObject({
    x: 400,
    width: 200,
    height: 200,
  });
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(a, left.id).semantic).toEqual({ label: "Remote label" });
  expect(elementIn(a, left.id).visual).toEqual(left.visual);
  expect(elementIn(a, right.id).visual).toEqual(right.visual);
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});
