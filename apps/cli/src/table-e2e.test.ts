import { expect, test } from "bun:test";
import { parseDocument, serializeDocument } from "@nodetto/io";
import type { Document, TableSheetSemantic } from "@nodetto/ir";
import { runCli } from "./commands.ts";
import { runCliAsync } from "./cli.ts";

test("spreadsheet table CLI end to end", async () => {
  const document: Document = {
    schemaVersion: 1,
    id: "d",
    title: "Example",
    pages: [{ id: "p", name: "Page", kind: "freeform" }],
    elements: [],
  };
  const files = new Map([
    ["doc", serializeDocument(document)],
    ["data.csv", "Name,Count\nAlpha,3\n"],
  ]);
  const io = {
    readText(path: string) {
      const value = files.get(path);
      if (value === undefined) throw Error("missing");
      return value;
    },
    writeText(path: string, value: string) {
      files.set(path, value);
    },
  };
  const run = (...args: string[]) => runCli(args, io, "test");
  expect(
    run(
      "table",
      "create",
      "doc",
      "--csv",
      "data.csv",
      "--types",
      "text,number",
      "--id",
      "sheet",
    ).exitCode,
  ).toBe(0);
  expect(
    run("table", "set", "doc", "sheet", "--cell", "0:1", "--value", "9")
      .exitCode,
  ).toBe(0);
  const parsed = parseDocument(files.get("doc") ?? "");
  const semantic = parsed.elements[0]
    ?.semantic as unknown as TableSheetSemantic;
  expect(semantic.rows[0]?.cells.c2?.value).toBe(9);
  expect(run("lint", "doc").exitCode).toBe(0);
  files.set(
    "bad",
    (files.get("doc") ?? "").replace('"value":9', '"value":"x"'),
  );
  const bad = run("lint", "bad");
  expect(bad.exitCode).not.toBe(0);
  expect(bad.stderr + bad.stdout).toContain("table.cellType");
  const svg = await runCliAsync(
    ["export", "doc", "--format", "svg"],
    io,
    "test",
  );
  expect(svg.exitCode).toBe(0);
  expect(svg.stdout).toContain("nodetto-table-sheet");
  expect(run("types", "table.sheet").stdout).toContain("columns");
  expect(run("draw", "doc", "table.sheet").exitCode).toBe(0);
  const added = parseDocument(files.get("doc") ?? "").elements.find(
    (element) => element.id !== "sheet",
  )?.semantic as unknown as TableSheetSemantic;
  expect(added.columns).toHaveLength(3);
  expect(added.rows).toHaveLength(3);
});
