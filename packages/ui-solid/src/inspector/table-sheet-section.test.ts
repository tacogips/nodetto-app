import { expect, test } from "bun:test";
import {
  Editor,
  applyTableSheetEdit,
  defaultTableSheetSemantic,
  insertColumn,
  insertRow,
  retypeColumn,
  setColumnOptions,
  setStriped,
  type TableSheetEditResult,
} from "@nodetto/core";
import type { TableSheetSemantic } from "@nodetto/ir";
import {
  columnTypeLabel,
  formatOptionLines,
  parseOptionLines,
  rowToDelete,
} from "./table-sheet-section.ts";

test("option lines are trimmed, deduplicated and capped", () => {
  expect(parseOptionLines("Todo\r\n Doing \n\nTodo\nDone")).toEqual([
    "Todo",
    "Doing",
    "Done",
  ]);
  expect(
    parseOptionLines(
      Array.from({ length: 101 }, (_, i) => `Option ${i}`).join("\n"),
    ),
  ).toHaveLength(100);
  expect(formatOptionLines(["A", "B"])).toBe("A\nB");
  expect(columnTypeLabel("checkbox")).toBe("Checkbox");
});
test("chooses active or last row", () => {
  const s = defaultTableSheetSemantic();
  expect(rowToDelete(s, "r1")).toBe("r1");
  expect(rowToDelete(s, "stale")).toBe("r3");
  expect(rowToDelete({ ...s, rows: [] })).toBeUndefined();
});
test("inspector edits each form one undo step", () => {
  const editor = new Editor();
  const initial = defaultTableSheetSemantic();
  const id = editor.createElement("table.sheet", {
    semantic: initial,
    visual: { x: 0, y: 0 },
  });
  const check = (
    edit: (s: TableSheetSemantic) => TableSheetEditResult,
    verify: (s: TableSheetSemantic) => void,
  ) => {
    const before = editor.store.get(id)?.semantic;
    const count = editor.history.undoSize;
    expect(applyTableSheetEdit(editor, id, edit).ok).toBe(true);
    expect(editor.history.undoSize).toBe(count + 1);
    verify(editor.store.get(id)?.semantic as TableSheetSemantic);
    editor.undo();
    expect(editor.store.get(id)?.semantic).toEqual(before);
  };
  check(
    (s) => insertRow(s, s.rows.length, () => "newrow"),
    (s) => expect(s.rows).toHaveLength(4),
  );
  check(
    (s) => insertColumn(s, s.columns.length, () => "newcol"),
    (s) =>
      expect(s.columns.at(-1)).toMatchObject({ name: "Column 1", width: 120 }),
  );
  check(
    (s) => setColumnOptions(s, "c2", parseOptionLines("New\nOther")),
    (s) => expect(s.columns[1]?.options).toEqual(["New", "Other"]),
  );
  check(
    (s) => retypeColumn(s, "c1", "number"),
    (s) => expect(s.columns[0]?.type).toBe("number"),
  );
  check(
    (s) => setStriped(s, true),
    (s) => expect(s.striped).toBe(true),
  );
});
