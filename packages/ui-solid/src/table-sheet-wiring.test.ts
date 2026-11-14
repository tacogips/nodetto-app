import { expect, test } from "bun:test";
import {
  defaultTableSheetSemantic,
  Editor,
  tableSheetLayout,
} from "@nodetto/core";
import { interactionFor, keyboard, mouse } from "./interaction-test-helpers.ts";
import { createTableSheetSelection } from "./table-sheet/selection.ts";
import { tableSheetRegionAt } from "./table-sheet/resize.ts";

test("sheet navigation and deletion do not move or delete the element", () => {
  const editor = new Editor();
  const id = editor.createElement("table.sheet", {
    semantic: defaultTableSheetSemantic(),
    visual: { x: 0, y: 0 },
  });
  editor.selection.set([id]);
  const selection = createTableSheetSelection();
  selection.activate(id, { rowId: "r1", columnId: "c1" });
  const { interaction } = interactionFor(editor, "select", {
    tableSheetSelection: selection,
  });
  interaction.onKeyDown(keyboard("ArrowRight"));
  expect(selection.state()?.active.columnId).toBe("c2");
  expect(editor.store.get(id)?.visual.x).toBe(0);
  interaction.onKeyDown(keyboard("Delete"));
  expect(editor.store.get(id)).toBeDefined();
  interaction.onKeyDown(keyboard("Escape"));
  expect(selection.state()).toBeNull();
  expect(editor.selection.has(id)).toBe(true);
  interaction.onKeyDown(keyboard("ArrowRight"));
  expect(editor.store.get(id)?.visual.x).toBe(1);
  interaction.dispose();
});

test("sheet double-click is intercepted while generic nodes request editing", () => {
  const editor = new Editor();
  const id = editor.createElement("table.sheet", {
    semantic: defaultTableSheetSemantic(),
    visual: { x: 0, y: 0 },
  });
  const node = editor.createElement("node.generic", {
    visual: { x: 500, y: 0, width: 100, height: 100 },
  });
  const selection = createTableSheetSelection();
  const calls: string[] = [];
  const { interaction } = interactionFor(editor, "select", {
    tableSheetSelection: selection,
    onEditRequest: (hit) => calls.push(hit),
    onTableSheetDoubleClick: (hit, point) => {
      const element = editor.store.get(hit);
      if (!element) return false;
      const region = tableSheetRegionAt(tableSheetLayout(element), point, 1);
      if (region?.kind === "cell") {
        selection.activate(hit, region);
        selection.startEditing();
      }
      return true;
    },
  });
  interaction.onDoubleClick(mouse(20, 40));
  expect(selection.state()?.elementId).toBe(id);
  expect(selection.state()?.editing).toBe(true);
  expect(calls).toEqual([]);
  interaction.onDoubleClick(mouse(520, 20));
  expect(calls).toEqual([node]);
  interaction.dispose();
});
