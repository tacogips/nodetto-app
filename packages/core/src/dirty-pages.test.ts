import { expect, spyOn, test } from "bun:test";
import type { Command } from "./commands.ts";
import { crossLinkedPages, dirtyPages } from "./editor/dirty-pages.ts";
import { Store } from "./store.ts";
import { document, element, makeEditor, TEST_PAGE } from "./test-helpers.ts";

const otherPage = { id: "page-2", name: "Page 2", kind: "freeform" as const };
const node = element({
  id: "node",
  type: "node.generic",
  semantic: { label: "Node" },
});
const stale = element({
  id: "note",
  page: otherPage.id,
  type: "text.note",
  semantic: { text: "Hello" },
  visual: { width: 1, height: 1, textResize: "auto-width" },
});

function fixture() {
  return document([node, stale], [TEST_PAGE, otherPage]);
}

test("first apply normalizes untouched pages, subsequent apply is scoped, and undo invalidates scope", () => {
  const editor = makeEditor({ document: fixture() });
  const first = editor.apply([
    { type: "updateVisual", id: node.id, visual: { x: 1 } },
  ]);
  expect(editor.store.get("note")?.visual.width).not.toBe(1);
  expect(
    first.redo.some((command) => "id" in command && command.id === "note"),
  ).toBe(true);
  const normalized = editor.store.get("note");
  const second = editor.apply([
    { type: "updateVisual", id: node.id, visual: { x: 2 } },
  ]);
  expect(editor.store.get("note")).toBe(normalized);
  expect(
    second.redo.some((command) => "id" in command && command.id === "note"),
  ).toBe(false);
  expect(editor.undo()).toBe(true);
  expect(editor.undo()).toBe(true);
  expect(editor.store.get("note")?.visual.width).toBe(1);
  const afterUndo = editor.apply([
    { type: "updateVisual", id: node.id, visual: { x: 1 } },
  ]);
  expect(afterUndo.redo).toEqual(first.redo);
});

test("subsequent planning snapshots only the dirty page", () => {
  const editor = makeEditor({ document: fixture() });
  editor.apply([{ type: "updateVisual", id: node.id, visual: { x: 1 } }]);
  const sizes: number[] = [];
  const original = Store.prototype.getSnapshot;
  let liveScans = 0;
  const originalList = Store.prototype.listElements;
  const list = spyOn(Store.prototype, "listElements").mockImplementation(
    function (this: Store) {
      if (this === editor.store) liveScans += 1;
      return originalList.call(this);
    },
  );
  const snapshot = spyOn(Store.prototype, "getSnapshot").mockImplementation(
    function (this: Store) {
      sizes.push(this.size);
      return original.call(this);
    },
  );
  try {
    editor.apply([{ type: "updateVisual", id: node.id, visual: { x: 2 } }]);
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((size) => size <= 1)).toBe(true);
    expect(liveScans).toBeLessThanOrEqual(1);
  } finally {
    snapshot.mockRestore();
    list.mockRestore();
  }
});

test("page commands and shared design elements require whole-document planning", () => {
  const token = element({ id: "token", type: "design.token", semantic: {} });
  const style = element({
    id: "style",
    type: "design.text-style",
    semantic: {},
  });
  const master = element({
    id: "master",
    type: "frame",
    semantic: { component: true },
  });
  const store = new Store(
    document([node, stale, token, style, master], [TEST_PAGE, otherPage]),
  );
  const linked = crossLinkedPages(store);
  expect(
    dirtyPages(
      store,
      [{ type: "updateVisual", id: "node", visual: { x: 1 } }],
      linked,
    ),
  ).toEqual(new Set([TEST_PAGE.id]));
  expect(
    dirtyPages(
      store,
      [{ type: "updatePage", id: TEST_PAGE.id, page: { name: "Renamed" } }],
      linked,
    ),
  ).toBeUndefined();
  for (const id of ["token", "style", "master"]) {
    expect(
      dirtyPages(
        store,
        [{ type: "updateVisual", id, visual: { x: 1 } }],
        linked,
      ),
    ).toBeUndefined();
  }
});

test("cross-page links, new cross-page references, and duplicate ids widen planning", () => {
  const edge = element({
    id: "edge",
    type: "edge.generic",
    semantic: { from: "node", to: "note" },
  });
  const store = new Store(
    document([node, stale, edge], [TEST_PAGE, otherPage]),
  );
  const linked = crossLinkedPages(store);
  expect(linked).toEqual(new Set([TEST_PAGE.id, otherPage.id]));
  expect(
    dirtyPages(
      store,
      [{ type: "updateVisual", id: "note", visual: { x: 1 } }],
      linked,
    ),
  ).toBeUndefined();
  expect(
    dirtyPages(store, [{ type: "createElement", element: edge }], new Set()),
  ).toBeUndefined();
  const localEdge = element({
    id: "new-edge",
    type: "edge.generic",
    semantic: { from: "node", to: "note" },
  });
  expect(
    dirtyPages(
      store,
      [{ type: "createElement", element: localEdge }],
      new Set(),
    ),
  ).toBeUndefined();
});

test("widening triggers normalize stale derived values on an untouched page", () => {
  const token = element({ id: "token", type: "design.token", semantic: {} });
  const style = element({
    id: "style",
    type: "design.text-style",
    semantic: {},
  });
  const master = element({
    id: "master",
    type: "frame",
    semantic: { component: true },
  });
  const edge = element({
    id: "edge",
    type: "edge.generic",
    semantic: { from: "node", to: "note" },
  });
  const cases: { extra: ReturnType<typeof element>[]; command: Command }[] = [
    {
      extra: [],
      command: {
        type: "updatePage",
        id: TEST_PAGE.id,
        page: { name: "Renamed" },
      },
    },
    ...[token, style, master].map((item) => ({
      extra: [item],
      command: { type: "updateVisual" as const, id: item.id, visual: { x: 3 } },
    })),
    {
      extra: [edge],
      command: { type: "updateVisual", id: node.id, visual: { x: 3 } },
    },
    { extra: [], command: { type: "createElement", element: edge } },
  ];
  for (const item of cases) {
    const editor = makeEditor({
      document: document([node, stale, ...item.extra], [TEST_PAGE, otherPage]),
    });
    editor.apply([{ type: "updateVisual", id: node.id, visual: { x: 1 } }]);
    const note = editor.store.get("note");
    expect(note).toBeDefined();
    // Simulate stale stored derived data without incrementing the revision, so
    // this checks the widening trigger rather than revision invalidation.
    Object.assign(note?.visual ?? {}, { width: 1 });
    const result = editor.apply([item.command]);
    expect(editor.store.get("note")?.visual.width).not.toBe(1);
    expect(
      result.redo.some((command) => "id" in command && command.id === "note"),
    ).toBe(true);
  }
});
