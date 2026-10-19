import { expect, test } from "bun:test";
import { Store } from "./store.ts";
import { groupOf } from "./group.ts";
import { frameParents } from "./frame-tree.ts";
import { document, element, makeEditor, TEST_PAGE } from "./test-helpers.ts";

const child = element({
  id: "child",
  type: "erd.table",
  semantic: { tableName: "t", columns: [] },
  visual: { x: 10, y: 10 },
});
const group = element({
  id: "group",
  type: "group",
  semantic: { memberIds: [child.id] },
});

test("page cache invalidates both pages before notifying a move", () => {
  const other = { ...TEST_PAGE, id: "other" };
  const store = new Store(document([child], [TEST_PAGE, other]));
  const first = store.getPageElements(TEST_PAGE.id);
  expect(store.getPageElements(TEST_PAGE.id)).toBe(first);
  store.getPageElements(other.id);
  store.subscribe(() => {
    expect(store.getPageElements(TEST_PAGE.id)).toEqual([]);
    expect(store.getPageElements(other.id).map((e) => e.id)).toEqual([
      child.id,
    ]);
  });
  store.commit({ update: [{ ...child, page: other.id }] });
});

test("group index follows updates, removal, insertion and document replacement", () => {
  const store = new Store(document([child, group]));
  expect(groupOf(store, child.id)?.id).toBe(group.id);
  store.commit({ update: [{ ...group, semantic: { memberIds: [] } }] });
  expect(groupOf(store, child.id)).toBeNull();
  store.commit({ insert: [group] });
  expect(groupOf(store, child.id)?.id).toBe(group.id);
  store.commit({ remove: [group.id] });
  expect(groupOf(store, child.id)).toBeNull();
  store.loadDocument(document([child, group]));
  expect(groupOf(store, child.id)?.id).toBe(group.id);
  store.loadDocument(document([child]));
  expect(groupOf(store, child.id)).toBeNull();
});

test("duplicate and self group memberships keep deterministic ownership", () => {
  const store = new Store(
    document([
      child,
      group,
      { ...group, id: "aaa", semantic: { memberIds: [child.id, "aaa"] } },
    ]),
  );
  expect(groupOf(store, child.id)?.id).toBe("aaa");
  expect(groupOf(store, "aaa")).toBeNull();
});

test("frame scans are shared within a context and refreshed after moving", () => {
  const frame = element({
    id: "frame",
    type: "frame",
    index: "a0",
    semantic: {},
    visual: { x: 0, y: 0, width: 400, height: 400 },
  });
  const editor = makeEditor({ document: document([frame, child]) });
  const context = editor.createShapeContext();
  const parents = frameParents(editor.store, TEST_PAGE.id, context);
  expect(parents.get(child.id)).toBe(frame.id);
  expect(frameParents(editor.store, TEST_PAGE.id, context)).toBe(parents);
  editor.store.commit({ update: [{ ...child, visual: { x: 500, y: 500 } }] });
  expect(
    frameParents(editor.store, TEST_PAGE.id, editor.createShapeContext()).has(
      child.id,
    ),
  ).toBe(false);
});
