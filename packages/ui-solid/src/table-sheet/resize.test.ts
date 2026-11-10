import { expect, test } from "bun:test";
import { Editor, tableSheetLayout } from "@nodetto/core";
import type { TableSheetSemantic } from "@nodetto/ir";
import {
  beginTableSheetResize,
  resetColumnWidth,
  tableSheetRegionAt,
} from "./resize.ts";

const semantic: TableSheetSemantic = {
  columns: [
    { id: "c1", name: "A", type: "text", width: 160 },
    { id: "c2", name: "B", type: "text", width: 120 },
    { id: "c3", name: "C", type: "text", width: 80 },
  ],
  rows: [
    { id: "r1", cells: {} },
    { id: "r2", cells: {} },
    { id: "r3", cells: {} },
  ],
};
function setup() {
  const editor = new Editor();
  const id = editor.createElement("table.sheet", {
    semantic,
    visual: { x: 0, y: 0 },
  });
  const current = () => editor.store.get(id)?.semantic as TableSheetSemantic;
  const layout = tableSheetLayout(editor.store.get(id)!);
  return { editor, id, current, layout };
}
const col = { kind: "column-border", columnId: "c1" } as const;
test("column borders use screen-scaled bands", () => {
  const { layout } = setup();
  expect(tableSheetRegionAt(layout, { x: 160, y: 50 }, 1)).toEqual(col);
  expect(tableSheetRegionAt(layout, { x: 163, y: 50 }, 2)).toEqual({
    kind: "cell",
    rowId: "r1",
    columnId: "c2",
  });
  expect(tableSheetRegionAt(layout, { x: 50, y: 10 }, 1)).toBeNull();
  expect(tableSheetRegionAt(layout, { x: -1, y: 50 }, 1)).toBeNull();
});
test("row borders and crossing priority", () => {
  const { layout } = setup();
  expect(tableSheetRegionAt(layout, { x: 50, y: 60 }, 1)).toEqual({
    kind: "row-border",
    rowId: "r1",
  });
  expect(tableSheetRegionAt(layout, { x: 160, y: 60 }, 1)).toEqual(col);
});
test("moves form one undo step", () => {
  const { editor, id, current } = setup();
  const count = editor.history.undoSize;
  const drag = beginTableSheetResize(editor, id, col, { x: 0, y: 0 });
  for (const x of [10, 20, 30]) drag.move({ x, y: 0 });
  drag.end();
  expect(current().columns[0]?.width).toBe(190);
  expect(editor.history.undoSize).toBe(count + 1);
  editor.undo();
  expect(current()).toEqual(semantic);
});
test("cancel restores without undo or redo", () => {
  const { editor, id, current } = setup();
  const count = editor.history.undoSize;
  const drag = beginTableSheetResize(editor, id, col, { x: 0, y: 0 });
  drag.move({ x: 10, y: 0 });
  drag.move({ x: 20, y: 0 });
  drag.cancel();
  expect(current()).toEqual(semantic);
  expect(editor.history.undoSize).toBe(count);
  expect(editor.canRedo()).toBe(false);
});
test("minimum width is clamped", () => {
  const { editor, id, current } = setup();
  const drag = beginTableSheetResize(editor, id, col, { x: 0, y: 0 });
  drag.move({ x: -1000, y: 0 });
  drag.end();
  expect(current().columns[0]?.width).toBe(24);
});
test("reset returns whether width changed", () => {
  const { editor, id, current } = setup();
  expect(resetColumnWidth(editor, id, "c1")).toBe(true);
  expect(current().columns[0]?.width).toBe(120);
  expect(resetColumnWidth(editor, id, "c1")).toBe(false);
});
test("row drag and zero net drag", () => {
  const { editor, id, current } = setup();
  const n = editor.history.undoSize;
  const drag = beginTableSheetResize(
    editor,
    id,
    { kind: "row-border", rowId: "r1" },
    { x: 0, y: 0 },
  );
  drag.move({ x: 0, y: 10 });
  drag.move({ x: 0, y: 0 });
  drag.end();
  expect(current()).toEqual(semantic);
  expect(editor.history.undoSize).toBe(n);
});
