import { expect, test } from "bun:test";
import { Editor, keyBetween } from "@nodetto/core";
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

function orderedPages(initial: readonly string[]) {
  const editor = new Editor();
  const first = editor.store.listPages()[0]!.id;
  editor.renamePage(first, initial[0]!);
  for (const name of initial.slice(1)) editor.createPage({ name });
  let saved = serializeDocument(editor.getSnapshot());
  let ops = "[]";
  const io: CommandIo = {
    readText: () => saved,
    writeText: (_path, value) => {
      saved = value;
    },
    readStdin: () => ops,
  };
  const edit = (operations: readonly object[]) => {
    ops = JSON.stringify(operations);
    return runCli(["edit", "doc.jsonl", "--ops", "-"], io, "test");
  };
  const names = () =>
    new Editor({ document: parseDocument(saved) }).store
      .listPages()
      .map((page) => page.name);
  const pages = () => parseDocument(saved).pages;
  return { edit, names, pages };
}

test("edit add-page places the new page before or after another page", () => {
  const f = orderedPages(["Alpha", "Beta", "Gamma"]);
  expect(
    f.edit([
      { op: "add-page", name: "Inserted", kind: "erd", after: "Alpha" },
      { op: "add-page", name: "Front", before: "Alpha", ref: "front" },
      { op: "add-page", name: "Tail" },
    ]).exitCode,
  ).toBe(0);
  expect(f.names()).toEqual([
    "Front",
    "Alpha",
    "Inserted",
    "Beta",
    "Gamma",
    "Tail",
  ]);
});

test("edit add-page honours an explicit order key between two pages", () => {
  const f = orderedPages(["Alpha", "Beta"]);
  const [alpha, beta] = f.pages().map((page) => page.order!);
  const between = keyBetween(alpha!, beta!, () => 0.5);
  expect(
    f.edit([{ op: "add-page", name: "Middle", order: between }]).exitCode,
  ).toBe(0);
  expect(f.names()).toEqual(["Alpha", "Middle", "Beta"]);
  expect(f.pages().find((page) => page.name === "Middle")?.order).toBe(between);
});

test("edit move-page reorders existing pages and rejects bad placements", () => {
  const f = orderedPages(["Alpha", "Beta", "Gamma"]);
  expect(
    f.edit([{ op: "move-page", id: "Gamma", before: "Alpha" }]).exitCode,
  ).toBe(0);
  expect(f.names()).toEqual(["Gamma", "Alpha", "Beta"]);
  expect(
    f.edit([{ op: "move-page", id: "Gamma", after: "Beta" }]).exitCode,
  ).toBe(0);
  expect(f.names()).toEqual(["Alpha", "Beta", "Gamma"]);
  const taken = f.pages().find((page) => page.name === "Alpha")!.order!;
  for (const [operation, message] of [
    [{ op: "move-page", id: "Beta" }, "move-page needs"],
    [
      { op: "move-page", id: "Beta", before: "Alpha", after: "Gamma" },
      "only one of",
    ],
    [
      { op: "move-page", id: "Beta", after: "Beta" },
      "cannot be placed after itself",
    ],
    [{ op: "move-page", id: "Beta", order: "a0" }, "fractional key"],
    [{ op: "move-page", id: "Beta", order: taken }, "already used"],
  ] as const) {
    const result = f.edit([operation]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(message);
  }
  expect(f.names()).toEqual(["Alpha", "Beta", "Gamma"]);
});

test("edit points element operations given a page id to the page operations", () => {
  const f = orderedPages(["Alpha", "Beta"]);
  const beta = f.pages().find((page) => page.name === "Beta")!.id;
  const result = f.edit([{ op: "update", id: beta, semantic: { label: "x" } }]);
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("is a page, not an element");
  expect(result.stderr).toContain("move-page");
});

test("pages copy-shapes copies references and handles no-write cases", () => {
  const source = new Editor();
  const a = source.store.listPages()[0];
  if (!a) throw new Error("missing initial page");
  source.renamePage(a.id, "A");
  const first = source.createElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: { x: 10, y: 20 },
  });
  const second = source.createElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: { x: 30, y: 40 },
  });
  source.createElement("edge.generic", {
    semantic: { from: first, to: second },
  });
  const b = source.createPage({ name: "B" });
  source.createElement("shape.geo", { semantic: { geo: "rect" } });
  source.createPage({ name: "C" });
  let saved = serializeDocument(source.getSnapshot());
  let writes = 0;
  const io: CommandIo = {
    readText: () => saved,
    writeText: (_path, value) => {
      writes++;
      saved = value;
    },
  };
  const run = (...args: string[]) =>
    runCli(["pages", "copy-shapes", "doc.jsonl", ...args], io, "test");
  const dry = run(
    "--from",
    "prev",
    "--to",
    "B",
    "--dry-run",
    "--format",
    "json",
  );
  expect(dry.exitCode).toBe(0);
  expect(JSON.parse(dry.stdout)).toMatchObject({
    written: false,
    copied: expect.any(Array),
  });
  expect(JSON.parse(dry.stdout).copied).toHaveLength(3);
  expect(writes).toBe(0);
  for (const [from, to, message] of [
    ["prev", "A", "has no previous page"],
    ["next", "C", "has no next page"],
    ["B", "B", "same page"],
  ]) {
    const result = run("--from", from!, "--to", to!);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(message!);
    expect(result.stderr).toContain("Nothing was written.");
    expect(writes).toBe(0);
  }
  const empty = run("--from", "C", "--to", "A");
  expect(empty.exitCode).toBe(0);
  expect(empty.stdout).toContain("Copied 0 elements");
  expect(writes).toBe(0);
  const result = run("--from", "prev", "--to", "B", "--format", "json");
  expect(result.exitCode).toBe(0);
  expect(writes).toBe(1);
  const copied: string[] = JSON.parse(result.stdout).copied;
  const doc = parseDocument(saved);
  expect(doc.elements.filter((element) => element.page === b)).toHaveLength(4);
  expect(copied).toHaveLength(3);
  expect(
    copied.every(
      (id) =>
        !source.getSnapshot().elements.some((element) => element.id === id),
    ),
  ).toBe(true);
  const copiedElements = copied.map((id) =>
    doc.elements.find((element) => element.id === id),
  );
  expect(copiedElements[0]?.visual).toEqual(source.store.get(first)?.visual);
  expect(copiedElements[1]?.visual).toEqual(source.store.get(second)?.visual);
  expect(copiedElements[2]?.semantic).toEqual({
    from: copied[0],
    to: copied[1],
  });
});
