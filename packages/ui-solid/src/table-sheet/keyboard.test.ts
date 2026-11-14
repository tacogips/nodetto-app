import { expect, test } from "bun:test";
import { defaultTableSheetSemantic, Editor } from "@nodetto/core";
import type { TableSheetSemantic } from "@nodetto/ir";
import { keyboard } from "../interaction-test-helpers.ts";
import { handleTableSheetKey } from "./keyboard.ts";
import { createTableSheetSelection } from "./selection.ts";

function setup() {
  const editor = new Editor();
  const semantic = defaultTableSheetSemantic();
  const id = editor.createElement("table.sheet", {
    semantic,
    visual: { x: 0, y: 0 },
  });
  editor.selection.set([id]);
  const selection = createTableSheetSelection();
  selection.activate(id, { rowId: "r1", columnId: "c1" });
  const press = (key: string, options: Parameters<typeof keyboard>[1] = {}) => {
    const event = keyboard(key, options);
    return {
      event,
      handled: handleTableSheetKey(event, { editor, selection }),
    };
  };
  return { editor, id, selection, press };
}
test("arrow moves selection without moving element", () => {
  const { editor, id, selection, press } = setup();
  const before = editor.store.get(id)?.visual;
  const result = press("ArrowDown");
  expect(result.handled).toBe(true);
  expect(result.event.defaultPrevented).toBe(true);
  expect(selection.state()?.active).toEqual({ rowId: "r2", columnId: "c1" });
  expect(editor.store.get(id)?.visual).toEqual(before);
});
test("delete clears selected range in one undoable edit", () => {
  const { editor, id, selection, press } = setup();
  const original = editor.store.get(id)?.semantic as TableSheetSemantic;
  const populated = {
    ...original,
    rows: original.rows.map((row, i) =>
      i < 2
        ? { ...row, cells: { c1: { value: "alpha" }, c2: { value: "Todo" } } }
        : row,
    ),
  };
  editor.apply([{ type: "updateSemantic", id, semantic: populated }]);
  selection.extend({ rowId: "r2", columnId: "c2" });
  const count = editor.history.undoSize;
  expect(press("Delete").handled).toBe(true);
  const cleared = editor.store.get(id)?.semantic as TableSheetSemantic;
  expect(cleared.rows.slice(0, 2).map((row) => row.cells)).toEqual([{}, {}]);
  expect(editor.history.undoSize).toBe(count + 1);
  editor.undo();
  expect(editor.store.get(id)?.semantic).toEqual(populated);
});
test("printable key begins seeded editing", () => {
  const { selection, press } = setup();
  expect(press("a").handled).toBe(true);
  expect(selection.state()).toMatchObject({ editing: true, seed: "a" });
});
test("escape clears cell selection while keeping element selected", () => {
  const { editor, id, selection, press } = setup();
  expect(press("Escape").handled).toBe(true);
  expect(selection.state()).toBeNull();
  expect(editor.selection.has(id)).toBe(true);
});
test("shortcuts remain available to host", () => {
  const { press } = setup();
  expect(press("z", { metaKey: true }).handled).toBe(false);
  expect(press("c", { metaKey: true }).handled).toBe(false);
});
