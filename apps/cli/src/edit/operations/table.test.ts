import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { validateDocument, type TableSheetSemantic } from "@nodetto/ir";
import { Batch } from "../batch.ts";
import { setCells } from "./table.ts";

function setup() {
  const editor = new Editor();
  const batch = new Batch(editor);
  const semantic = {
    columns: [
      { id: "c1", name: "Done", type: "checkbox", width: 120 },
      {
        id: "c2",
        name: "State",
        type: "select",
        width: 120,
        options: ["Open"],
      },
    ],
    rows: [
      { id: "r1", cells: {} },
      { id: "r2", cells: {} },
    ],
  };
  batch.apply({ op: "add", type: "table.sheet", id: "table1", semantic }, 0);
  return {
    editor,
    batch,
    semantic: () => editor.store.get("table1")!.semantic as TableSheetSemantic,
  };
}

test("inline table and atomic typed cell updates", () => {
  const { editor, batch, semantic } = setup();
  expect(
    validateDocument(editor.getSnapshot()).filter(
      (i) => i.severity === "error",
    ),
  ).toEqual([]);
  let updates = 0;
  const unsubscribe = editor.store.subscribe((diff) => {
    if (diff.updated.includes("table1")) updates++;
  });
  setCells(
    batch,
    {
      id: "table1",
      cells: [
        {
          row: "r1",
          column: "Done",
          value: "yes",
          bold: true,
          fill: "#ffeeaa",
        },
        { row: 1, column: 1, value: "Blocked" },
      ],
    },
    0,
  );
  expect(updates).toBe(1);
  expect(semantic().rows[0]!.cells.c1).toEqual({
    value: true,
    bold: true,
    fill: "#ffeeaa",
  });
  expect(semantic().rows[1]!.cells.c2?.value).toBe("Blocked");
  expect(semantic().columns[1]!.options).toEqual(["Open", "Blocked"]);
  setCells(
    batch,
    {
      id: "table1",
      cells: [{ row: "r1", column: "c1", value: null, fill: null }],
    },
    0,
  );
  expect(semantic().rows[0]!.cells.c1).toEqual({ bold: true });
  unsubscribe();
  batch.dispose();
});

test("bad cells leave table unchanged and identify target", () => {
  const { editor, batch, semantic } = setup();
  const before = semantic();
  expect(() =>
    setCells(
      batch,
      {
        id: "table1",
        cells: [
          { row: 0, column: 0, value: "yes" },
          { row: 0, column: "missing", value: "x" },
        ],
      },
      2,
    ),
  ).toThrow("missing");
  expect(semantic()).toBe(before);
  expect(() =>
    setCells(
      batch,
      { id: "table1", cells: [{ row: "missing", column: 0, value: "yes" }] },
      0,
    ),
  ).toThrow("missing");
  expect(() =>
    setCells(
      batch,
      { id: "table1", cells: [{ row: 0, column: 0, value: "perhaps" }] },
      0,
    ),
  ).toThrow("checkbox");
  editor.createElement("node.generic", { id: "node1" });
  expect(() => setCells(batch, { id: "node1", cells: [] }, 0)).toThrow(
    "table.sheet",
  );
  batch.dispose();
});
