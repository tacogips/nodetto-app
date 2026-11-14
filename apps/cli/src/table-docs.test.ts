import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "bun:test";
import { TABLE_SHEET_LIMITS } from "@nodetto/ir";

const root = resolve(import.meta.dir, "../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("spreadsheet documentation tracks limits and validation codes", () => {
  const doc = read("docs/editing.md");
  for (const limit of Object.values(TABLE_SHEET_LIMITS)) {
    expect(doc).toContain(String(limit));
  }
  for (const code of [
    "table.id",
    "table.noColumns",
    "table.limit",
    "table.size",
    "table.unknownColumn",
    "table.cellEmpty",
    "table.cellType",
    "table.options",
    "table.cellFill",
  ])
    expect(doc).toContain(`\`${code}\``);
});

test("CLI guide names spreadsheet commands and input flags", () => {
  const doc = read("docs/cli.md");
  for (const term of [
    "nodetto-cli table create",
    "nodetto-cli table set",
    '"op":"set-cells"',
    "--csv",
    "--tsv",
    "--data",
    "--no-header",
  ])
    expect(doc).toContain(term);
});
