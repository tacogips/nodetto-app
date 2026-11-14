import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { type CommandIo, runCli } from "./commands.ts";

function setup() {
  let document = serializeDocument(new Editor().getSnapshot());
  let ops = "[]";
  const io: CommandIo = {
    readText: (path) => (path === "ops.json" ? ops : document),
    writeText: (_path, text) => {
      document = text;
    },
    readStdin: () => ops,
  };
  const run = (args: string[]) => runCli(args, io, "test");
  const edit = (operations: unknown[], json = false) => {
    ops = JSON.stringify(operations);
    return run([
      "edit",
      "doc.jsonl",
      "--ops",
      "ops.json",
      ...(json ? ["--format", "json"] : []),
    ]);
  };
  return { run, edit, document: () => document };
}

test("edit reports only newly introduced warnings and validate strict exits 3", () => {
  const x = setup();
  const add = {
    op: "add",
    type: "uml.component",
    semantic: { name: "Ledger", kind: "actor" },
  };
  const result = x.edit([add]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("warning operation 0 (add)");
  expect(result.stdout).toContain("semantic.kind");
  expect(x.run(["validate", "doc.jsonl"]).stderr).toContain(
    "semantic.unknownField",
  );
  const strict = x.run(["validate", "doc.jsonl", "--strict"]);
  expect(strict.exitCode).toBe(3);
  expect(strict.stderr).toEndWith("1 validation warning(s) with --strict.\n");
  const id = parseDocument(x.document()).elements[0]!.id;
  const clean = x.edit(
    [{ op: "update", id, semantic: { name: "Updated" } }],
    true,
  );
  expect(JSON.parse(clean.stdout).warnings).toEqual([]);
  const update = x.edit(
    [
      { op: "update", id, semantic: { name: "Again" } },
      { op: "update", id, semantic: { another: true } },
    ],
    true,
  );
  expect(JSON.parse(update.stdout).warnings).toMatchObject([
    {
      operation: 1,
      op: "update",
      element: id,
      path: "semantic.another",
      code: "semantic.unknownField",
    },
  ]);
  const y = setup();
  expect(y.run(["validate", "doc.jsonl", "--strict"]).exitCode).toBe(0);
  const json = y.edit([add], true);
  const output = JSON.parse(json.stdout);
  expect(output.warnings).toMatchObject([
    {
      operation: 0,
      op: "add",
      element: output.created[0].id,
      path: "semantic.kind",
      code: "semantic.unknownField",
    },
  ]);
});

test("actor is discoverable, drawable and connectable", () => {
  const x = setup();
  expect(x.run(["shapes", "actor"]).stdout).toContain("geo:actor");
  expect(
    x.run(["draw", "doc.jsonl", "geo:actor", "--label", "Visitor"]).exitCode,
  ).toBe(0);
  const actor = parseDocument(x.document()).elements[0]!;
  expect(actor).toMatchObject({
    type: "shape.geo",
    semantic: { geo: "actor", label: "Visitor" },
    visual: { width: 60, height: 110 },
  });
  expect(x.run(["draw", "doc.jsonl", "geo:rect"]).exitCode).toBe(0);
  const other = parseDocument(x.document()).elements.find(
    (element) => element.id !== actor.id,
  )!;
  expect(
    x.run(["draw", "doc.jsonl", "edge", "--from", actor.id, "--to", other.id])
      .exitCode,
  ).toBe(0);
  expect(
    parseDocument(x.document()).elements.some(
      (element) => element.type === "edge.generic",
    ),
  ).toBe(true);
  const types = x.run(["types", "--kind", "architecture"]).stdout;
  expect(types).toContain("usecase.node");
  expect(types).toContain("usecase.relationship");
  expect(types).toContain("geo:actor");
});
