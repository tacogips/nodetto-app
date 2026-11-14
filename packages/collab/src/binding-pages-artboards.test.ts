import { expect, test } from "bun:test";
import {
  copySelectionStyle,
  pasteSelectionStyle,
  renameSelectedLayers,
  replaceSelectedNoteText,
  swapArtboardOrientation,
  addLayoutGrid,
  setGroupMask,
  updateLayoutGrid,
} from "@nodetto/core";
import type { FrameSemantic, GroupSemantic } from "@nodetto/ir";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { freeformDocument } from "./test-fixtures.ts";
import { Wire, peer, expectConverged } from "./binding-test-helpers.ts";

test("layer visibility and locks converge and a remote unlock restores editing", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const id = a.editor.getSnapshot().elements[0]?.id;
  if (!id) throw new Error("fixture requires an element");
  a.editor.apply([
    { type: "updateVisual", id, visual: { hidden: true, locked: true } },
  ]);
  wire.flush();
  expect(b.editor.store.get(id)?.visual.hidden).toBe(true);
  expect(b.editor.store.get(id)?.visual.locked).toBe(true);
  b.editor.apply([
    { type: "updateVisual", id, visual: { hidden: false, locked: false } },
  ]);
  wire.flush();
  a.editor.apply([{ type: "updateVisual", id, visual: { x: 250 } }]);
  wire.flush();
  expect(b.editor.store.get(id)?.visual.x).toBe(250);
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("batch note replacement converges and undo preserves concurrent peer appearance", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  const one = a.editor.createElement("text.note", {
    semantic: {
      text: "Old title",
      marks: [{ kind: "bold", start: 4, end: 9 }],
    },
  });
  const two = a.editor.createElement("text.note", {
    semantic: { text: "Old subtitle" },
  });
  a.binding.attach();
  const b = peer(wire);
  b.binding.attach();
  wire.flush();
  try {
    a.editor.selection.set([one, two]);
    expect(replaceSelectedNoteText(a.editor, "Old", "New brand")).toBe(2);
    b.editor.apply([
      {
        type: "updateVisual",
        id: one,
        visual: { style: { color: "#123456" }, x: 250 },
      },
    ]);
    wire.flush();
    expectConverged(a, b, wire);
    expect(b.editor.getText(one)).toBe("New brand title");
    expect(b.editor.store.get(one)?.semantic).toMatchObject({
      marks: [{ kind: "bold", start: 10, end: 15 }],
    });
    const saved = a.editor.getSnapshot();
    expect(parseDocument(serializeDocument(saved))).toEqual(saved);
    expect(a.binding.undo()).toBe(true);
    wire.flush();
    expectConverged(a, b, wire);
    expect(a.editor.getText(one)).toBe("Old title");
    expect(a.editor.getText(two)).toBe("Old subtitle");
    expect(a.editor.store.get(one)?.visual.x).toBe(250);
    expect(a.editor.store.get(one)?.visual.style?.color).toBe("#123456");
    expect(a.binding.redo()).toBe(true);
    wire.flush();
    expectConverged(a, b, wire);
    expect(b.editor.getText(two)).toBe("New brand subtitle");
  } finally {
    a.binding.detach();
    b.binding.detach();
  }
});

test("batch layer naming converges and local undo preserves peer content", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  const one = a.editor.createElement("text.note", {
    semantic: { text: "One" },
  });
  const two = a.editor.createElement("text.note", {
    semantic: { text: "Two" },
  });
  a.binding.attach();
  const b = peer(wire);
  b.binding.attach();
  wire.flush();
  try {
    a.editor.selection.set([one, two]);
    expect(
      renameSelectedLayers(a.editor, { pattern: "Control {n}", digits: 2 }),
    ).toBe(2);
    b.editor.setText(one, "Peer text");
    wire.flush();
    expect(b.editor.store.get(one)?.visual.layerName).toBe("Control 02");
    expect(b.editor.store.get(two)?.visual.layerName).toBe("Control 01");
    expectConverged(a, b, wire);
    expect(a.binding.undo()).toBe(true);
    wire.flush();
    expect(a.editor.store.get(one)?.visual.layerName).toBeUndefined();
    expect(a.editor.store.get(two)?.visual.layerName).toBeUndefined();
    expect(a.editor.getText(one)).toBe("Peer text");
    expectConverged(a, b, wire);
  } finally {
    a.binding.detach();
    b.binding.detach();
  }
});

test("remote active-page deletion follows tab neighbors and restores the peer's local view", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  const first = a.editor.currentPageId;
  const middle = a.editor.createPage({ name: "Middle" });
  const last = a.editor.createPage({ name: "Last" });
  a.editor.setCurrentPage(first);
  a.binding.attach();
  const b = peer(wire);
  b.binding.attach();
  wire.flush();
  try {
    b.editor.setCurrentPage(last);
    const view = { x: 750, y: -300, z: 1.5 };
    b.editor.camera.set(view);
    b.editor.setCurrentPage(middle);
    a.editor.deletePage(middle);
    wire.flush();
    expect(b.editor.currentPageId).toBe(last);
    expect(b.editor.camera.get()).toEqual(view);
    expect(a.editor.currentPageId).toBe(first);
    expectConverged(a, b, wire);
    expect(a.binding.undo()).toBe(true);
    wire.flush();
    expect(b.editor.currentPageId).toBe(last);
    expect(b.editor.store.getPage(middle)).toBeDefined();
    expectConverged(a, b, wire);
  } finally {
    a.binding.detach();
    b.binding.detach();
  }
});

test("page ordering converges with a peer rename and local undo restores legacy order only", () => {
  const wire = new Wire();
  const initial = freeformDocument();
  const a = peer(wire, {
    ...initial,
    pages: [
      { id: "a", name: "One", kind: "freeform" },
      { id: "b", name: "Two", kind: "freeform" },
      { id: "c", name: "Three", kind: "freeform" },
    ],
    elements: [],
  });
  a.binding.attach();
  const b = peer(wire);
  b.binding.attach();
  wire.flush();
  try {
    expect(a.editor.reorderPage("c", -1)).toBe(true);
    b.editor.renamePage("c", "Peer name");
    wire.flush();
    expect(a.editor.store.listPages().map((page) => page.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expectConverged(a, b, wire);
    expect(a.binding.undo()).toBe(true);
    wire.flush();
    expect(a.editor.store.listPages().map((page) => page.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(a.editor.store.getPage("c")?.name).toBe("Peer name");
    expect(
      a.editor.store.listPages().every((page) => page.order === undefined),
    ).toBe(true);
    expectConverged(a, b, wire);
    expect(a.binding.redo()).toBe(true);
    wire.flush();
    expect(a.editor.store.listPages().map((page) => page.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expectConverged(a, b, wire);
    // Both peers insert into the same interval; ID tie-breaking remains total.
    a.editor.duplicatePage("a");
    b.editor.duplicatePage("a");
    wire.flush();
    expect(a.editor.store.listPages()).toHaveLength(5);
    expect(a.editor.store.listPages()[0]?.id).toBe("a");
    expect(
      a.editor.store
        .listPages()
        .slice(-2)
        .map((page) => page.id),
    ).toEqual(["c", "b"]);
    expectConverged(a, b, wire);
  } finally {
    a.binding.detach();
    b.binding.detach();
  }
});

test("a group mask and concurrent mask rotation converge with isolated undo", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const mask = a.editor.buildElement("shape.geo", {
    semantic: { geo: "ellipse" },
    visual: { x: 20, y: 20, width: 100, height: 100 },
  });
  const content = a.editor.buildElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: { x: 0, y: 0, width: 160, height: 160 },
  });
  const group = a.editor.buildElement("group", {
    semantic: { memberIds: [mask.id, content.id] },
  });
  a.editor.apply(
    [mask, content, group].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  expect(setGroupMask(a.editor, group.id, mask.id)).toBe(true);
  b.editor.apply([
    { type: "updateVisual", id: mask.id, visual: { rotation: 30 } },
  ]);
  wire.flush();
  for (const client of [a, b]) {
    expect(
      (client.editor.store.get(group.id)?.semantic as GroupSemantic).maskId,
    ).toBe(mask.id);
    expect(client.editor.store.get(mask.id)?.visual.rotation).toBe(30);
    expect(
      client.editor.createShapeContext().clipPolygonOf?.(content.id),
    ).toHaveLength(32);
  }

  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(
      (client.editor.store.get(group.id)?.semantic as GroupSemantic).maskId,
    ).toBe(mask.id);
    expect(client.editor.store.get(mask.id)?.visual.rotation).toBeUndefined();
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("concurrent layout-grid fields merge and undo remains peer-local", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const frame = a.editor.buildElement("frame", {
    semantic: { name: "Responsive web" },
    visual: { x: 0, y: 0, width: 1440, height: 900 },
  });
  a.editor.apply([{ type: "createElement", element: frame }]);
  expect(
    addLayoutGrid(a.editor, frame.id, "columns", "responsive-columns"),
  ).toBe(true);
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  expect(
    updateLayoutGrid(a.editor, frame.id, 0, {
      kind: "columns",
      id: "responsive-columns",
      count: 4,
      gutter: 16,
      margin: 16,
      color: "#ef4444",
      opacity: 0.3,
    }),
  ).toBe(true);
  expect(
    updateLayoutGrid(b.editor, frame.id, 0, {
      kind: "columns",
      id: "responsive-columns",
      count: 4,
      gutter: 24,
      margin: 16,
      color: "#ef4444",
      opacity: 0.12,
    }),
  ).toBe(true);
  wire.flush();
  for (const client of [a, b])
    expect(
      (client.editor.store.get(frame.id)?.semantic as FrameSemantic)
        .layoutGrids?.[0],
    ).toMatchObject({ gutter: 24, opacity: 0.3 });

  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b])
    expect(
      (client.editor.store.get(frame.id)?.semantic as FrameSemantic)
        .layoutGrids?.[0],
    ).toMatchObject({ gutter: 16, opacity: 0.3 });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("device safe-area insets merge by side with peer-local undo", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const frame = a.editor.buildElement("frame", {
    semantic: {
      name: "iPhone",
      platform: "ios",
      safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
    },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  a.editor.apply([{ type: "createElement", element: frame }]);
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  for (const [client, patch] of [
    [a, { top: 59 }],
    [b, { bottom: 40 }],
  ] as const) {
    const semantic = client.editor.store.get(frame.id)
      ?.semantic as FrameSemantic;
    client.editor.apply([
      {
        type: "updateSemantic",
        id: frame.id,
        semantic: {
          ...semantic,
          safeArea: { ...semantic.safeArea!, ...patch },
        },
      },
    ]);
  }
  wire.flush();
  for (const client of [a, b])
    expect(
      (client.editor.store.get(frame.id)?.semantic as FrameSemantic).safeArea,
    ).toEqual({ top: 59, right: 0, bottom: 40, left: 0 });

  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b])
    expect(
      (client.editor.store.get(frame.id)?.semantic as FrameSemantic).safeArea,
    ).toEqual({ top: 59, right: 0, bottom: 34, left: 0 });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("style paste converges with remote content edits and undo preserves peer content", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const source = a.editor.createElement("node.generic", {
    visual: { style: { fill: "#123456", strokeWidth: 4 } },
  });
  const target = a.editor.createElement("node.generic", {
    semantic: { label: "Before" },
    visual: { style: { fill: "#abcdef" } },
  });
  const b = peer(wire);
  b.binding.attach();
  wire.flush();
  a.editor.selection.set([source]);
  copySelectionStyle(a.editor);
  a.editor.selection.set([target]);
  pasteSelectionStyle(a.editor);
  b.editor.apply([
    { type: "updateSemantic", id: target, semantic: { label: "Peer content" } },
  ]);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get(target)?.visual.style).toEqual({
      fill: "#123456",
      strokeWidth: 4,
    });
    expect(client.editor.store.get(target)?.semantic).toEqual({
      label: "Peer content",
    });
  }
  expectConverged(a, b, wire);
  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get(target)?.visual.style).toEqual({
      fill: "#abcdef",
    });
    expect(client.editor.store.get(target)?.semantic).toEqual({
      label: "Peer content",
    });
  }
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("orientation and peer content edits converge, and local undo preserves remote content", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const child = a.editor.buildElement("shape.geo", {
    semantic: { geo: "rect", label: "Before" },
    visual: {
      x: 20,
      y: 30,
      width: 350,
      height: 48,
      horizontalConstraint: "stretch",
    },
  });
  const frame = a.editor.buildElement("frame", {
    semantic: { name: "Phone", platform: "ios", memberIds: [child.id] },
    visual: { x: 0, y: 0, width: 390, height: 844, aspectRatio: 390 / 844 },
  });
  a.editor.apply(
    [frame, child].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const b = peer(wire);
  b.binding.attach();
  wire.flush();
  expect(swapArtboardOrientation(a.editor, frame.id)).toBe(true);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: child.id,
      semantic: { geo: "rect", label: "Peer edit" },
    },
  ]);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.getBounds(frame.id)).toMatchObject({
      width: 844,
      height: 390,
    });
    expect(client.editor.getBounds(child.id)?.width).toBe(804);
    expect(client.editor.store.get(child.id)?.semantic).toMatchObject({
      label: "Peer edit",
    });
  }
  expectConverged(a, b, wire);
  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.getBounds(frame.id)).toMatchObject({
      width: 390,
      height: 844,
    });
    expect(client.editor.getBounds(child.id)?.width).toBe(350);
    expect(client.editor.store.get(child.id)?.semantic).toMatchObject({
      label: "Peer edit",
    });
  }
  expectConverged(a, b, wire);
  expect(a.binding.redo()).toBe(true);
  wire.flush();
  expect(b.editor.getBounds(child.id)?.width).toBe(804);
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("remote page renames preserve each collaborator's active page and remembered views", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const first = a.editor.currentPageId;
  const second = a.editor.createPage({ name: "Mobile" });
  const selectedLayer = a.editor.createElement("node.generic", {
    semantic: { label: "Checkout" },
  });
  const b = peer(wire);
  b.binding.attach();
  wire.flush();
  a.editor.setCurrentPage(first);
  b.editor.setCurrentPage(first);
  const firstView = { x: 60, y: 70, z: 0.5 };
  const secondView = { x: -800, y: -400, z: 2 };
  b.editor.camera.set(firstView);
  b.editor.setCurrentPage(second);
  b.editor.camera.set(secondView);
  b.editor.selection.set([selectedLayer]);
  a.editor.renamePage(second, "Mobile checkout");
  wire.flush();
  expect(a.editor.currentPageId).toBe(first);
  expect(b.editor.currentPageId).toBe(second);
  expect(b.editor.camera.get()).toEqual(secondView);
  expect([...b.editor.selection.ids()]).toEqual([selectedLayer]);
  b.editor.setCurrentPage(first);
  expect(b.editor.camera.get()).toEqual(firstView);
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});
