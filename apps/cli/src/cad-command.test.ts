import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CAD_ELEMENT_TYPES, shortPageId } from "@nodetto/ir";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { runCli, type CommandIo } from "./commands.ts";
import { createMcpServer } from "./mcp.ts";

const source = readFileSync(
  new URL("./__fixtures__/cad-bracket.jsonl", import.meta.url),
  "utf8",
);
const document = parseDocument(source);
const noWrite = () => {
  throw new Error("cad check must never write");
};
const io: CommandIo = { readText: () => source, writeText: noWrite };
const check = (...args: string[]) =>
  runCli(["cad", "check", "bracket.jsonl", ...args], io, "test");

test("cad check reports every CAD page and its extrusion tool bounds", () => {
  expect(check()).toEqual({
    exitCode: 0,
    stdout:
      "Angle bracket: 2 features, 6 entities, 0 errors\n" +
      "Spare model: 0 features, 0 entities, 0 errors\n",
    stderr: "",
  });
  const result = check("--json");
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual([
    {
      pageId: "bracket",
      features: 2,
      entities: 6,
      errors: [],
      bounds: { min: [2, 0, 0], max: [14, 18, 14] },
    },
    { pageId: "spare", features: 0, entities: 0, errors: [], bounds: null },
  ]);
});

test.each(["bracket", "Angle bracket", shortPageId("bracket")])(
  "cad check accepts the page selector %s",
  (query) => {
    const result = check("--page", query);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "Angle bracket: 2 features, 6 entities, 0 errors\n",
    );
  },
);

test("cad check reports invalid profiles with exit 1 and supports selecting a clean page", () => {
  const broken = serializeDocument({
    ...document,
    elements: document.elements.filter(({ id }) => id !== "bracket-top"),
  });
  const run = (...args: string[]) =>
    runCli(
      ["cad", "check", "broken.jsonl", ...args],
      { ...io, readText: () => broken },
      "test",
    );
  expect(run().exitCode).toBe(1);
  expect(run().stdout).toContain("bracket-e cad.profile.open\n");
  const result = run("--json");
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stdout)[0]).toEqual({
    pageId: "bracket",
    features: 2,
    entities: 5,
    errors: [{ id: "bracket-extrude", code: "cad.profile.open" }],
    bounds: null,
  });
  expect(run("--page", "spare").exitCode).toBe(0);
});

test("cad check sorts diagnostics by element ID regardless of JSONL record order", () => {
  const keep = ["bracket-bottom", "bracket-extrude"];
  const [header, ...records] = serializeDocument({
    ...document,
    elements: document.elements.filter(({ id }) => keep.includes(id)),
  })
    .trimEnd()
    .split("\n");
  const pages = records.filter((record) => record.includes('"kind":"page"'));
  const elements = records.filter((record) =>
    record.includes('"kind":"element"'),
  );
  const run = (rows: readonly string[], ...args: string[]) =>
    runCli(
      ["cad", "check", "broken.jsonl", "--page", "bracket", ...args],
      { ...io, readText: () => [header, ...pages, ...rows, ""].join("\n") },
      "test",
    );
  const reversed = elements.slice().reverse();
  const text = run(reversed);
  expect(text).toEqual(run(elements));
  expect(text.exitCode).toBe(1);
  expect(text.stdout).toContain(
    "bracket-b cad.reference.missing\nbracket-e cad.reference.missing\n",
  );
  const json = run(reversed, "--json");
  expect(json).toEqual(run(elements, "--json"));
  expect(JSON.parse(json.stdout)[0].errors).toEqual(
    keep.map((id) => ({ id, code: "cad.reference.missing" })),
  );
});

test("cad check exits 2 for bad arguments, an invalid file or no CAD page", () => {
  for (const args of [
    ["cad"],
    ["cad", "export", "bracket.jsonl"],
    ["cad", "check"],
    ["cad", "check", "bracket.jsonl", "extra"],
    ["cad", "check", "bracket.jsonl", "--page"],
    ["cad", "check", "bracket.jsonl", "--page", "notes"],
    ["cad", "check", "bracket.jsonl", "--json=true"],
  ])
    expect(runCli(args, io, "test").exitCode).toBe(2);
  const plain = serializeDocument({
    ...document,
    pages: document.pages.filter(({ kind }) => kind !== "cad3d"),
    elements: document.elements.filter(({ page }) => page === "notes"),
  });
  for (const text of [plain, "malformed"]) {
    const result = runCli(
      ["cad", "check", "plain.jsonl"],
      { ...io, readText: () => text },
      "test",
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      text === plain ? "no 3D CAD pages" : "not a valid nodetto document",
    );
  }
});

test("types and help advertise CAD authoring and check", () => {
  expect(runCli(["--help"], io, "test").stdout).toContain("cad check");
  const types = runCli(
    ["types", "--kind", "cad3d", "--format", "json"],
    io,
    "test",
  );
  expect(types.exitCode).toBe(0);
  const entries: { type: string; pageKinds: string[] }[] = JSON.parse(
    types.stdout,
  );
  expect(entries.map(({ type }) => type).sort()).toEqual(
    [...CAD_ELEMENT_TYPES].sort(),
  );
  expect(entries.every(({ pageKinds }) => pageKinds.join() === "cad3d")).toBe(
    true,
  );
  const help = runCli(["cad", "--help"], io, "test").stdout;
  for (const text of [
    "Exit codes: 0 clean, 1 CAD errors, 2 usage",
    "cad.order.forward      A feature depends on a later feature.",
    "cad.profile.open       Profile edges do not form closed loops.",
    "cad.mesh.invalid       An imported mesh has invalid fields.",
  ])
    expect(help).toContain(text);
});

test("MCP cad check returns the CLI report and edit enforces the CAD boundary", async () => {
  const server = createMcpServer(io, "test");
  const client = new Client({ name: "cad-test", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const result = await client.callTool({
      name: "nodetto_cad",
      arguments: { args: ["check", "bracket.jsonl", "--json"] },
    });
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual(check("--json"));

    for (const [operation, code] of [
      [{ op: "add", type: "shape.geo", page: "bracket" }, "page.contentKind"],
      [{ op: "set-page-kind", id: "notes", kind: "cad3d" }, "page.kindLocked"],
    ] as const) {
      const edit = await client.callTool({
        name: "nodetto_edit",
        arguments: {
          args: ["bracket.jsonl", "--ops", "-"],
          stdin: JSON.stringify([operation]),
        },
      });
      expect(edit.isError).toBe(true);
      expect(edit.structuredContent).toMatchObject({
        exitCode: 2,
        stderr: expect.stringContaining(code),
      });
    }
  } finally {
    await client.close();
    await server.close();
  }
});
