import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { shortPageId } from "@nodetto/ir";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { runCli, type CommandIo } from "./commands.ts";
import { exportCommand } from "./export-command.ts";

function fixture() {
  const editor = new Editor();
  const flow = editor.createPage({ name: "Flow", kind: "sequence" });
  editor.createElement("sequence.participant", {
    semantic: { name: "Excluded actor", kind: "actor", order: "a0" },
  });
  const schema = editor.createPage({ name: "Schema", kind: "erd" });
  editor.createElement("erd.table", {
    semantic: { tableName: "selected_users", columns: [] },
  });
  let saved = serializeDocument(editor.getSnapshot());
  let writes = 0;
  const io: CommandIo = {
    readText: () => saved,
    writeText: (_path, value) => {
      writes++;
      saved = value;
    },
    readStdin: () =>
      JSON.stringify([
        { op: "rename-page", id: shortPageId(schema), name: "Renamed schema" },
      ]),
  };
  return {
    editor,
    flow,
    schema,
    io,
    get saved() {
      return saved;
    },
    get writes() {
      return writes;
    },
  };
}

test("pages lists all identities in display order and filters kinds without writing", () => {
  const f = fixture();
  const list = runCli(
    ["pages", "mixed.jsonl", "--format", "json"],
    f.io,
    "test",
  );
  expect(list.exitCode).toBe(0);
  const rows = JSON.parse(list.stdout);
  expect(rows).toHaveLength(3);
  expect(rows[2]).toMatchObject({
    number: 3,
    name: "Schema",
    kind: "erd",
    id: f.schema,
    shortId: shortPageId(f.schema),
  });
  const filtered = runCli(
    ["pages", "mixed.jsonl", "--format", "json", "--kind", "erd"],
    f.io,
    "test",
  );
  expect(JSON.parse(filtered.stdout)).toEqual([rows[2]]);
  const text = runCli(["pages", "mixed.jsonl"], f.io, "test");
  expect(text.stdout).toContain(shortPageId(f.schema));
  expect(text.stdout).toContain(f.schema);
  expect(f.writes).toBe(0);
  expect(
    runCli(["pages", "mixed.jsonl", "--kind", "invalid"], f.io, "test")
      .exitCode,
  ).toBe(2);
});

test("short IDs select the same page for inspect, artwork export, DDL and edits", async () => {
  const f = fixture();
  const alias = shortPageId(f.schema);
  const inspect = runCli(
    ["inspect", "mixed.jsonl", "--format", "json", "--page", alias],
    f.io,
    "test",
  );
  expect(
    JSON.parse(inspect.stdout).pages.map(
      (page: { id: string; shortId: string }) => [page.id, page.shortId],
    ),
  ).toEqual([[f.schema, alias]]);
  for (const format of ["svg", "mermaid", "d2"]) {
    const result = await exportCommand(f.io, [
      "mixed.jsonl",
      "--page",
      alias,
      "--format",
      format,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("selected_users");
    expect(result.stdout).not.toContain("Excluded actor");
  }
  expect(
    runCli(["ddl", "mixed.jsonl", "--page", alias], f.io, "test").stdout,
  ).toContain("selected_users");
  const edited = runCli(["edit", "mixed.jsonl", "--ops", "-"], f.io, "test");
  expect(edited.exitCode).toBe(0);
  expect(
    parseDocument(f.saved).pages.find((page) => page.id === f.schema)?.name,
  ).toBe("Renamed schema");
  expect(
    shortPageId(
      parseDocument(f.saved).pages.find((page) => page.id === f.schema)!.id,
    ),
  ).toBe(alias);
});

test("aliases persist through saving, reopening and reordering without changing element references", () => {
  const f = fixture();
  const before = parseDocument(f.saved);
  const reopened = new Editor({ document: before });
  reopened.reorderPage(f.schema, -1);
  reopened.renamePage(f.schema, "Renamed");
  const after = parseDocument(serializeDocument(reopened.getSnapshot()));
  const byId = (document: typeof before) =>
    document.pages.map((page) => [page.id, shortPageId(page.id)]).sort();
  expect(byId(after)).toEqual(byId(before));
  expect(after.elements).toEqual(before.elements);
});

test("BPMN export and lint accept short page IDs in mixed files", () => {
  const editor = new Editor();
  const id = editor.createPage({ name: "Process", kind: "bpmn" });
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: () => {
      throw new Error("read-only test");
    },
  };
  for (const command of [["bpmn", "export"], ["lint"]]) {
    const byId = runCli([...command, "mixed.jsonl", "--page", id], io, "test");
    const byAlias = runCli(
      [...command, "mixed.jsonl", "--page", shortPageId(id)],
      io,
      "test",
    );
    expect(byAlias).toEqual(byId);
    expect(byAlias.exitCode).not.toBe(2);
  }
});
