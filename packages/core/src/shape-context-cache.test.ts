import { expect, test } from "bun:test";
import { document, element, makeEditor } from "./test-helpers.ts";
import { erdTableShapeUtil } from "./shapes/erdTable.ts";

const table = element({
  id: "table",
  type: "erd.table",
  semantic: { tableName: "t", columns: [] },
  visual: { x: 0, y: 0 },
});

test("editor shares geometry until the store, zoom, registry or sampler changes", () => {
  const editor = makeEditor({ document: document([table]) });
  const first = editor.createShapeContext();
  expect(editor.createShapeContext()).toBe(first);
  editor.selection.set([table.id]);
  editor.camera.set({ x: 10, y: 20, z: 1 });
  expect(editor.createShapeContext()).toBe(first);
  expect(editor.createShapeContext(2)).not.toBe(first);
  const zoomed = editor.createShapeContext(2);
  editor.registry.register({ ...erdTableShapeUtil });
  expect(editor.createShapeContext(2)).not.toBe(zoomed);
  const beforeSampler = editor.createShapeContext();
  editor.setRasterMaskSampler(() => undefined);
  expect(editor.createShapeContext()).not.toBe(beforeSampler);
  const beforeMove = editor.createShapeContext();
  expect(beforeMove.boundsOf(table.id)?.x).toBe(0);
  editor.moveElements([{ id: table.id, x: 50, y: 0 }]);
  expect(editor.createShapeContext()).not.toBe(beforeMove);
  expect(editor.createShapeContext().boundsOf(table.id)?.x).toBe(50);
  editor.undo();
  expect(editor.createShapeContext().boundsOf(table.id)?.x).toBe(0);
});

test("selection pruning observes fresh geometry before editor notification", () => {
  const removed = { ...table, id: "removed" };
  const editor = makeEditor({ document: document([table, removed]) });
  editor.selection.set([removed.id]);
  const revision = editor.revision;
  const old = editor.createShapeContext();
  old.boundsOf(table.id);
  editor.selection.subscribe(() => {
    expect(editor.revision).toBe(revision);
    expect(editor.createShapeContext()).not.toBe(old);
    expect(editor.createShapeContext().boundsOf(table.id)?.x).toBe(75);
  });
  editor.store.commit({
    update: [{ ...table, visual: { x: 75, y: 0 } }],
    remove: [removed.id],
  });
});
