import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import type { TableSheetSemantic } from "@nodetto/ir";
import {
  copyTableRange,
  cutTableRange,
  pasteIntoTable,
  type TableClipboardPort,
} from "./clipboard.ts";

const values = [
  ["alpha\nbeta", "tab\there"],
  ['say "hi"', "line1\r\nline2"],
];
const range = { top: 0, left: 0, bottom: 1, right: 1 };
function setup(semantic?: TableSheetSemantic) {
  const editor = new Editor();
  const table = semantic ?? {
    columns: ["c1", "c2"].map((id) => ({
      id,
      name: id,
      type: "text" as const,
      width: 120,
    })),
    rows: values.map((row, i) => ({
      id: `r${i}`,
      cells: { c1: { value: row[0] }, c2: { value: row[1] } },
    })),
  };
  const id = editor.createElement("table.sheet", {
    semantic: table,
    visual: { x: 0, y: 0 },
  });
  let text = "";
  const port: TableClipboardPort = {
    writeText: (s) => {
      text = s;
    },
    readText: async () => text,
  };
  let next = 0;
  const ids = () => `new${++next}`;
  const read = () => editor.store.get(id)?.semantic as TableSheetSemantic;
  return { editor, id, port, ids, read };
}
test("clipboard preservation copies and pastes exact stored text", async () => {
  const { editor, id, port, ids, read } = setup();
  expect(await copyTableRange(editor, { elementId: id, range }, port)).toBe(
    true,
  );
  expect(
    (
      await pasteIntoTable(
        editor,
        { elementId: id, row: 1, column: 0 },
        port,
        ids,
      )
    )?.result.ok,
  ).toBe(true);
  expect(
    read()
      .rows.slice(1)
      .map((r) => [r.cells.c1?.value, r.cells.c2?.value]),
  ).toEqual(values);
});
test("single-undo cut clears once and restores, then paste preserves text", async () => {
  const { editor, id, port, ids, read } = setup();
  const original = read();
  const before = editor.history.undoSize;
  expect(await cutTableRange(editor, { elementId: id, range }, port)).toBe(
    true,
  );
  expect(editor.history.undoSize).toBe(before + 1);
  expect(read().rows.every((r) => !r.cells.c1 && !r.cells.c2)).toBe(true);
  editor.undo();
  expect(read()).toEqual(original);
  expect(await cutTableRange(editor, { elementId: id, range }, port)).toBe(
    true,
  );
  await pasteIntoTable(editor, { elementId: id, row: 1, column: 0 }, port, ids);
  expect(
    read()
      .rows.slice(1)
      .map((r) => [r.cells.c1?.value, r.cells.c2?.value]),
  ).toEqual(values);
});
test("typed values copy and paste unchanged", async () => {
  const { editor, id, port, read } = setup({
    columns: [
      { id: "a", name: "a", type: "number", width: 120 },
      { id: "b", name: "b", type: "checkbox", width: 120 },
      { id: "c", name: "c", type: "select", width: 120, options: ["Doing"] },
      { id: "d", name: "d", type: "date", width: 120 },
    ],
    rows: [
      {
        id: "r",
        cells: {
          a: { value: 42 },
          b: { value: true },
          c: { value: "Doing" },
          d: { value: "2024-02-29" },
        },
      },
    ],
  });
  const original = read();
  await copyTableRange(
    editor,
    { elementId: id, range: { top: 0, left: 0, bottom: 0, right: 3 } },
    port,
  );
  expect(await port.readText()).toBe("42\tTRUE\tDoing\t2024-02-29");
  await pasteIntoTable(editor, { elementId: id, row: 0, column: 0 }, port);
  expect(read()).toEqual(original);
});
test("over-limit paste leaves semantic unchanged", async () => {
  const { editor, id, read } = setup();
  const original = read();
  const port = {
    writeText: () => {},
    readText: async () => Array(101).fill("a").join("\t"),
  };
  expect(
    await pasteIntoTable(editor, { elementId: id, row: 0, column: 0 }, port),
  ).toMatchObject({ result: { ok: false, code: "table.limit" }, range: null });
  expect(read()).toEqual(original);
});
test("paste grows rows and returns pasted range", async () => {
  const { editor, id, ids, read } = setup();
  const port = { writeText: () => {}, readText: async () => "x\ny" };
  expect(
    await pasteIntoTable(
      editor,
      { elementId: id, row: 1, column: 1 },
      port,
      ids,
    ),
  ).toMatchObject({
    result: { ok: true },
    range: { top: 1, left: 1, bottom: 2, right: 1 },
  });
  expect(read().rows).toHaveLength(3);
});
test("rejecting read leaves table unchanged", async () => {
  const { editor, id, read } = setup();
  const before = read();
  expect(
    await pasteIntoTable(
      editor,
      { elementId: id, row: 0, column: 0 },
      {
        writeText: () => {},
        readText: async () => {
          throw Error("denied");
        },
      },
    ),
  ).toBeNull();
  expect(read()).toEqual(before);
});
test("rejecting cut write leaves table and history unchanged", async () => {
  const { editor, id, read } = setup();
  const before = read();
  const count = editor.history.undoSize;
  expect(
    await cutTableRange(
      editor,
      { elementId: id, range },
      {
        writeText: () => {
          throw Error("denied");
        },
        readText: async () => "",
      },
    ),
  ).toBe(false);
  expect(read()).toEqual(before);
  expect(editor.history.undoSize).toBe(count);
});
test("empty clipboard and missing target are ignored", async () => {
  const { editor, id, port } = setup();
  expect(
    await pasteIntoTable(editor, { elementId: id, row: 0, column: 0 }, port),
  ).toBeNull();
  expect(
    await copyTableRange(editor, { elementId: "missing", range }, port),
  ).toBe(false);
});
