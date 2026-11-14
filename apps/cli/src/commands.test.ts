import { runCliAsync } from "./cli.ts";
import { expect, test } from "bun:test";
import {
  type CommandIo,
  EXIT_DRIFT,
  EXIT_ERROR,
  EXIT_OK,
  EXIT_WARNINGS,
  runCli,
} from "./commands.ts";

const ERD = [
  '{"kind":"document","schemaVersion":1,"id":"01JCLI0000000000000000000","title":"Shop"}',
  '{"kind":"page","id":"p1","name":"Schema","pageKind":"erd"}',
  '{"kind":"element","id":"t-users","page":"p1","type":"erd.table","index":"a0","semantic":{"tableName":"users","columns":[{"id":"c-id","name":"id","dataType":"varchar(36)","pk":true},{"id":"c-email","name":"email","dataType":"varchar(320)","nullable":false},{"id":"c-active","name":"active","dataType":"boolean","nullable":false,"defaultExpression":"true"}],"indexes":[{"id":"i-email","name":"ix_users_email","columns":["c-email"],"unique":true}]},"visual":{"x":0,"y":0,"width":280}}',
  "",
].join("\n");

function memoryIo(files: Record<string, string>): CommandIo & {
  readonly files: Map<string, string>;
} {
  const store = new Map(Object.entries(files));
  return {
    files: store,
    readText(path) {
      const text = store.get(path);
      if (text === undefined) throw new Error("ENOENT");
      return text;
    },
    writeText(path, text) {
      store.set(path, text);
    },
  };
}

test("ddl prints the same SQL as the inspector for the only ERD page", () => {
  const result = runCli(
    ["ddl", "doc.jsonl", "--dialect", "postgresql"],
    memoryIo({ "doc.jsonl": ERD }),
    "test",
  );
  expect(result.exitCode).toBe(EXIT_OK);
  expect(result.stdout).toContain('CREATE TABLE "users" (');
  expect(result.stdout).toContain('"id" VARCHAR(36) NOT NULL');
  expect(result.stdout).toContain('"active" BOOLEAN NOT NULL DEFAULT true');
  expect(result.stdout).toContain(
    'CREATE UNIQUE INDEX "ix_users_email" ON "users" ("email");',
  );
});

test("ddl --output writes and --check detects drift", () => {
  const io = memoryIo({ "doc.jsonl": ERD });
  const written = runCli(
    ["ddl", "doc.jsonl", "--dialect=sqlite", "--output", "schema.sql"],
    io,
    "test",
  );
  expect(written.exitCode).toBe(EXIT_OK);
  expect(io.files.get("schema.sql")).toContain('"id" TEXT NOT NULL');

  const fresh = runCli(
    ["ddl", "doc.jsonl", "--dialect=sqlite", "--check", "schema.sql"],
    io,
    "test",
  );
  expect(fresh.exitCode).toBe(EXIT_OK);

  io.files.set("schema.sql", "-- edited by hand\n");
  const stale = runCli(
    ["ddl", "doc.jsonl", "--dialect=sqlite", "--check", "schema.sql"],
    io,
    "test",
  );
  expect(stale.exitCode).toBe(EXIT_DRIFT);
  expect(stale.stderr).toContain("schema.sql is out of date");
});

test("ddl --strict fails when the export warns", () => {
  const unsafe = ERD.replace('"dataType":"boolean"', '"dataType":"bool;drop"');
  const result = runCli(
    ["ddl", "doc.jsonl", "--strict"],
    memoryIo({ "doc.jsonl": unsafe }),
    "test",
  );
  expect(result.exitCode).toBe(EXIT_WARNINGS);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("unsafe or empty type");
});

test("ddl keeps a partial index condition, and --strict fails where it cannot", () => {
  const partial = ERD.replace(
    '"columns":["c-email"],"unique":true}',
    '"columns":["c-email"],"unique":true,"where":"active = true"}',
  );
  const io = memoryIo({ "doc.jsonl": partial });
  const postgresql = runCli(
    ["ddl", "doc.jsonl", "--dialect", "postgresql", "--strict"],
    io,
    "test",
  );
  expect(postgresql.exitCode).toBe(EXIT_OK);
  expect(postgresql.stdout).toContain(
    'CREATE UNIQUE INDEX "ix_users_email" ON "users" ("email") WHERE active = true;',
  );
  const mysql = runCli(
    ["ddl", "doc.jsonl", "--dialect", "mysql", "--strict"],
    io,
    "test",
  );
  expect(mysql.exitCode).toBe(EXIT_WARNINGS);
  expect(mysql.stderr).toContain("does not support partial indexes");
  expect(runCli(["inspect", "doc.jsonl"], io, "test").stdout).toContain(
    "index ix_users_email unique where active = true",
  );
  const invalid = partial.replace('"where":"active = true"', '"where":1');
  const validated = runCli(
    ["validate", "doc.jsonl"],
    memoryIo({ "doc.jsonl": invalid }),
    "test",
  );
  expect(validated.exitCode).toBe(EXIT_ERROR);
  expect(validated.stdout + validated.stderr).toContain(".where");
});

test("ddl requires --page when several pages contain tables", () => {
  const twoPages = [
    ERD.trimEnd(),
    '{"kind":"page","id":"p2","name":"Other","pageKind":"erd"}',
    '{"kind":"element","id":"t-teams","page":"p2","type":"erd.table","index":"a0","semantic":{"tableName":"teams","columns":[{"id":"c-id","name":"id","dataType":"integer","pk":true}]}}',
    "",
  ].join("\n");
  const io = memoryIo({ "doc.jsonl": twoPages });
  const ambiguous = runCli(["ddl", "doc.jsonl"], io, "test");
  expect(ambiguous.exitCode).toBe(EXIT_ERROR);
  expect(ambiguous.stderr).toContain("choose one with --page");
  const byName = runCli(["ddl", "doc.jsonl", "--page", "Other"], io, "test");
  expect(byName.exitCode).toBe(EXIT_OK);
  expect(byName.stdout).toContain('CREATE TABLE "teams"');
  expect(byName.stdout).not.toContain('CREATE TABLE "users"');
});

test("format --check and --write use the canonical JSONL form", () => {
  const shuffled = ERD.split("\n").reverse().join("\n");
  const io = memoryIo({ "doc.jsonl": shuffled });
  expect(runCli(["format", "doc.jsonl", "--check"], io, "test").exitCode).toBe(
    EXIT_DRIFT,
  );
  expect(runCli(["format", "doc.jsonl", "--write"], io, "test").exitCode).toBe(
    EXIT_OK,
  );
  expect(runCli(["format", "doc.jsonl", "--check"], io, "test").exitCode).toBe(
    EXIT_OK,
  );
});

test("invalid documents and arguments exit with the error code", () => {
  const io = memoryIo({ "bad.jsonl": "{not json}\n" });
  expect(runCli(["validate", "bad.jsonl"], io, "test").exitCode).toBe(
    EXIT_ERROR,
  );
  expect(runCli(["ddl", "missing.jsonl"], io, "test").exitCode).toBe(
    EXIT_ERROR,
  );
  expect(
    runCli(["ddl", "bad.jsonl", "--dialect", "oracle"], io, "test").stderr,
  ).toContain('Unsupported dialect "oracle"');
  expect(runCli(["frobnicate"], io, "test").exitCode).toBe(EXIT_ERROR);
  expect(runCli(["--version"], io, "1.2.3").stdout).toBe("nodetto-cli 1.2.3\n");
});

test("arrange --write tidies overlapping tables and --check is then clean", () => {
  const stacked = [
    '{"kind":"document","schemaVersion":1,"id":"01JCLI0000000000000000001","title":"Pile"}',
    '{"kind":"page","id":"p1","name":"Schema","pageKind":"erd"}',
    '{"kind":"element","id":"t-a","page":"p1","type":"erd.table","index":"a0","semantic":{"tableName":"a","columns":[{"id":"c-id","name":"id","dataType":"integer","pk":true}]},"visual":{"x":0,"y":0,"width":200}}',
    '{"kind":"element","id":"t-b","page":"p1","type":"erd.table","index":"a1","semantic":{"tableName":"b","columns":[{"id":"c-id","name":"id","dataType":"integer","pk":true},{"id":"c-a","name":"a_id","dataType":"integer"}]},"visual":{"x":0,"y":0,"width":200}}',
    '{"kind":"element","id":"r","page":"p1","type":"erd.relation","index":"a2","semantic":{"from":{"table":"t-b","column":"c-a"},"to":{"table":"t-a","column":"c-id"},"cardinality":"*:1","logical":true}}',
    "",
  ].join("\n");
  const io = memoryIo({ "doc.jsonl": stacked });
  expect(runCli(["arrange", "doc.jsonl", "--check"], io, "test").exitCode).toBe(
    EXIT_DRIFT,
  );
  expect(runCli(["arrange", "doc.jsonl", "--write"], io, "test").exitCode).toBe(
    EXIT_OK,
  );
  expect(runCli(["arrange", "doc.jsonl", "--check"], io, "test").exitCode).toBe(
    EXIT_OK,
  );
  const text = io.files.get("doc.jsonl") ?? "";
  expect(text).toContain('"id":"t-b"');
  expect(text).toMatch(/"id":"t-b".*"visual":\{"x":3\d\d/);
  expect(
    runCli(["arrange", "doc.jsonl", "--mode", "grid"], io, "test").stderr,
  ).toContain('Unsupported mode "grid"');
  // The logical relation emits no constraint.
  expect(runCli(["ddl", "doc.jsonl"], io, "test").stdout).not.toContain(
    "FOREIGN KEY",
  );
});

test("a value option followed by another option is missing its value", () => {
  const io = memoryIo({ "doc.jsonl": ERD });
  const result = runCli(
    ["ddl", "doc.jsonl", "--output", "--strict"],
    io,
    "test",
  );
  expect(result.exitCode).toBe(EXIT_ERROR);
  expect(result.stderr).toContain("--output requires a value.");
  expect(io.files.has("--strict")).toBe(false);

  // The `=` form still allows a value that starts with "--".
  const explicit = runCli(
    ["ddl", "doc.jsonl", "--output=--strict"],
    io,
    "test",
  );
  expect(explicit.exitCode).toBe(EXIT_OK);
  expect(io.files.get("--strict")).toContain('CREATE TABLE "users"');
});

test("write failures exit with the error code, not the drift code", () => {
  const failing: CommandIo = {
    readText: (path) => {
      if (path === "doc.jsonl") return ERD;
      throw new Error("ENOENT");
    },
    writeText: () => {
      throw new Error("ENOSPC: no space left on device");
    },
  };
  for (const args of [
    ["ddl", "doc.jsonl", "--output", "schema.sql"],
    ["format", "doc.jsonl", "--write"],
    ["arrange", "doc.jsonl", "--write"],
  ]) {
    const result = runCli(args, failing, "test");
    expect(result.exitCode).toBe(EXIT_ERROR);
    expect(result.stderr).toContain("ENOSPC");
  }
});

test("DDL frame scopes validate page ownership and retain check/strict behavior", () => {
  const lines = ERD.trim().split("\n");
  const frame = {
    kind: "element",
    id: "db-frame",
    page: "p1",
    type: "frame",
    index: "a1",
    semantic: { name: "Database", memberIds: ["t-users"] },
    visual: { x: 0, y: 0, width: 500, height: 500 },
  };
  const source = [...lines, JSON.stringify(frame), ""].join("\n");
  const io = memoryIo({ "doc.jsonl": source });
  const args = [
    "ddl",
    "doc.jsonl",
    "--frame",
    "db-frame",
    "--dialect",
    "sqlite",
  ];
  const scoped = runCli(args, io, "test");
  expect(scoped.exitCode).toBe(EXIT_OK);
  expect(scoped.stdout).toContain('CREATE TABLE "users"');
  expect(runCli([...args, "--output", "scope.sql"], io, "test").exitCode).toBe(
    EXIT_OK,
  );
  expect(runCli([...args, "--check", "scope.sql"], io, "test").exitCode).toBe(
    EXIT_OK,
  );
  expect(
    runCli(["ddl", "doc.jsonl", "--frame", "t-users"], io, "test").stderr,
  ).toContain("frame on the selected --page");
  expect(
    runCli(["ddl", "doc.jsonl", "--frame", "missing"], io, "test").exitCode,
  ).toBe(EXIT_ERROR);
  const wrongPage = `${source}${JSON.stringify({ kind: "page", id: "p2", name: "Other", pageKind: "erd" })}\n`;
  const otherIo = memoryIo({ "doc.jsonl": wrongPage });
  expect(
    runCli(
      ["ddl", "doc.jsonl", "--page", "p2", "--frame", "db-frame"],
      otherIo,
      "test",
    ).exitCode,
  ).toBe(EXIT_ERROR);
  const emptyFrame = {
    ...frame,
    id: "empty",
    semantic: { name: "Empty", memberIds: [] },
  };
  io.files.set(
    "doc.jsonl",
    [source, JSON.stringify(emptyFrame), ""].join("\n"),
  );
  expect(
    runCli(["ddl", "doc.jsonl", "--frame", "empty", "--strict"], io, "test")
      .exitCode,
  ).toBe(EXIT_WARNINGS);
});

test("CLI adds a standalone line with free ends and authored intermediate points", async () => {
  const source =
    '{"kind":"document","schemaVersion":1,"id":"free-lines","title":"Free lines"}\n{"kind":"page","id":"p1","name":"Lines","pageKind":"flowchart"}\n';
  const io = memoryIo({
    "doc.jsonl": source,
    "ops.json": JSON.stringify([
      {
        op: "add",
        type: "edge.generic",
        page: "p1",
        id: "line",
        semantic: {
          fromPoint: { x: 100, y: 100 },
          toPoint: { x: 400, y: 100 },
          routing: "manual",
          routingWaypoints: [{ u: 0.5, v: 100 }],
        },
      },
    ]),
  });
  const added = runCli(["edit", "doc.jsonl", "--ops", "ops.json"], io, "test");
  expect(added.exitCode).toBe(EXIT_OK);
  const written = io.files.get("doc.jsonl")!;
  expect(written).toContain('"fromPoint":{"x":100,"y":100}');
  expect(written).not.toContain('"from":""');
  const exported = await runCliAsync(
    ["export", "doc.jsonl", "--format", "svg"],
    io,
    "test",
  );
  expect(exported.exitCode).toBe(EXIT_OK);
  expect(exported.stdout).toContain('points="100,100 250,200 400,100"');
});
