import { expect, test } from "bun:test";
import { parseDocumentResult, serializeDocument } from "@nodetto/io";
import {
  validateDocument,
  type Document,
  type TableSheetSemantic,
} from "@nodetto/ir";
import { tableCommand } from "./table-command.ts";

function fixture() {
  const document: Document = {
    schemaVersion: 1,
    id: "d",
    title: "Example",
    pages: [{ id: "p", name: "Page", kind: "freeform" }],
    elements: [],
  };
  const files = new Map([["doc", serializeDocument(document)]]);
  let writes = 0;
  const io = {
    readText(path: string) {
      const value = files.get(path);
      if (value === undefined) throw Error("missing");
      return value;
    },
    writeText(path: string, text: string) {
      writes++;
      files.set(path, text);
    },
  };
  const table = () => {
    const parsed = parseDocumentResult(files.get("doc") ?? "");
    if (!parsed.ok) throw Error("invalid document");
    return {
      document: parsed.document,
      semantic: parsed.document.elements[0]
        ?.semantic as unknown as TableSheetSemantic,
    };
  };
  return { files, io, table, writes: () => writes };
}
test("create CSV with typed values, names and stable IDs", () => {
  const f = fixture();
  f.files.set("input", 'Name,Qty\nWidget,3\n"Gadget, large","5"\n');
  const result = tableCommand(f.io, [
    "create",
    "doc",
    "--csv",
    "input",
    "--types",
    "text,number",
    "--id",
    "t1",
  ]);
  expect(result.exitCode).toBe(0);
  const { document, semantic } = f.table();
  expect(document.elements[0]?.type).toBe("table.sheet");
  expect(semantic.columns.map(({ id, name }) => [id, name])).toEqual([
    ["c1", "Name"],
    ["c2", "Qty"],
  ]);
  expect(
    semantic.rows.map(({ id, cells }) => [
      id,
      cells.c1?.value,
      cells.c2?.value,
    ]),
  ).toEqual([
    ["r1", "Widget", 3],
    ["r2", "Gadget, large", 5],
  ]);
  expect(
    validateDocument(document).filter((issue) => issue.severity === "error"),
  ).toEqual([]);
});
test("TSV preserves quoted newlines and inline data without header creates names", () => {
  const f = fixture();
  f.files.set("input", 'A\tB\n"two\nlines"\tx\n');
  expect(tableCommand(f.io, ["create", "doc", "--tsv", "input"]).exitCode).toBe(
    0,
  );
  expect(f.table().semantic.rows[0]?.cells.c1?.value).toBe("two\nlines");
  const g = fixture();
  expect(
    tableCommand(g.io, [
      "create",
      "doc",
      "--data",
      '[["A","B"],["x",true]]',
      "--no-header",
    ]).exitCode,
  ).toBe(0);
  expect(g.table().semantic.columns.map((column) => column.name)).toEqual([
    "Column 1",
    "Column 2",
  ]);
  expect(g.table().semantic.rows).toHaveLength(2);
});
test("invalid inputs do not write", () => {
  const f = fixture();
  const before = f.files.get("doc");
  const invalid = tableCommand(f.io, [
    "create",
    "doc",
    "--data",
    '[["A","B"],["x","bad"]]',
    "--types",
    "text,number",
  ]);
  expect(invalid.exitCode).toBe(2);
  expect(invalid.stderr).toContain("row 1, column B");
  expect(f.files.get("doc")).toBe(before);
  expect(
    tableCommand(f.io, ["create", "doc", "--csv", "input", "--data", "[]"])
      .exitCode,
  ).toBe(2);
});
test("set updates multiple cells in one write and rejects an unknown column atomically", () => {
  const f = fixture();
  expect(
    tableCommand(f.io, [
      "create",
      "doc",
      "--data",
      '[["Name","Qty"],["a","1"],["b","2"]]',
      "--types",
      "text,number",
      "--id",
      "t1",
    ]).exitCode,
  ).toBe(0);
  const beforeWrites = f.writes();
  const result = tableCommand(f.io, [
    "set",
    "doc",
    "t1",
    "--cell",
    "r1:Qty",
    "--value",
    "7",
    "--cell",
    "1:0",
    "--value",
    "Gizmo",
  ]);
  expect(result.exitCode).toBe(0);
  expect(f.writes()).toBe(beforeWrites + 1);
  expect(f.table().semantic.rows[0]?.cells.c2?.value).toBe(7);
  expect(f.table().semantic.rows[1]?.cells.c1?.value).toBe("Gizmo");
  const before = f.files.get("doc");
  expect(
    tableCommand(f.io, [
      "set",
      "doc",
      "t1",
      "--cell",
      "r1:Missing",
      "--value",
      "bad",
    ]).exitCode,
  ).toBe(2);
  expect(f.files.get("doc")).toBe(before);
});
