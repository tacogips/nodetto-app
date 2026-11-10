import { expect, test } from "bun:test";
import { Editor } from "../editor.ts";
import { applyTableSheetEdit } from "./apply.ts";
import { setStriped, deleteRows } from "./edits.ts";
const semantic = {
  columns: [{ id: "c1", name: "A", type: "text" as const, width: 120 }],
  rows: [{ id: "r1", cells: {} }],
};
function setup() {
  const editor = new Editor();
  const id = editor.createElement("table.sheet", {
    semantic,
    visual: { x: 0, y: 0 },
  });
  return { editor, id };
}
test("one history entry and undo", () => {
  const { editor, id } = setup();
  const n = editor.history.undoSize;
  expect(applyTableSheetEdit(editor, id, (s) => setStriped(s, true)).ok).toBe(
    true,
  );
  expect(editor.history.undoSize).toBe(n + 1);
  editor.undo();
  expect(editor.store.get(id)?.semantic).toEqual(semantic);
});
test("no-op has no history entry", () => {
  const { editor, id } = setup();
  const n = editor.history.undoSize;
  applyTableSheetEdit(editor, id, (s) => setStriped(s, false));
  expect(editor.history.undoSize).toBe(n);
});
test("failure leaves semantic unchanged", () => {
  const { editor, id } = setup();
  expect(
    applyTableSheetEdit(editor, id, (s) => deleteRows(s, ["missing"])).ok,
  ).toBe(false);
  expect(editor.store.get(id)?.semantic).toEqual(semantic);
});
test("missing table fails", () => {
  const { editor } = setup();
  expect(
    applyTableSheetEdit(editor, "missing", (s) => setStriped(s, true)),
  ).toMatchObject({ ok: false, code: "table.unknownRow" });
});
