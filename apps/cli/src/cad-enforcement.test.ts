import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { runCli, type CommandIo } from "./commands.ts";

const source = readFileSync(
  new URL("./__fixtures__/cad-bracket.jsonl", import.meta.url),
  "utf8",
);

function fixture(initial = source) {
  let text = initial;
  let writes = 0;
  let stdin = "";
  const io: CommandIo = {
    readText: () => text,
    readStdin: () => stdin,
    writeText: (_path, updated) => {
      writes += 1;
      text = updated;
    },
  };
  const run = (...args: string[]) => runCli(args, io, "test");
  return {
    run,
    edit(operations: unknown) {
      stdin = JSON.stringify(operations);
      return run("edit", "bracket.jsonl", "--ops", "-");
    },
    get writes() {
      return writes;
    },
    get text() {
      return text;
    },
  };
}

test.each([
  [{ op: "add", page: "bracket", type: "shape.geo" }, "page.contentKind"],
  [
    {
      op: "add",
      page: "notes",
      type: "cad.line",
      semantic: { a: [0, 0], b: [2, 0] },
    },
    "page.contentKind",
  ],
  [{ op: "set-page-kind", id: "notes", kind: "cad3d" }, "page.kindLocked"],
  [{ op: "set-page-kind", id: "bracket", kind: "freeform" }, "page.kindLocked"],
  [
    { op: "convert", id: "bracket-extrude", type: "shape.geo" },
    "CAD elements cannot be converted",
  ],
  [
    { op: "convert", id: "brief", type: "cad.sketch" },
    "CAD elements cannot be converted",
  ],
] as const)(
  "edit refuses %j and leaves the entire batch unwritten",
  (operation, code) => {
    const file = fixture();
    const result = file.edit([
      { op: "rename-page", id: "notes", name: "Draft" },
      operation,
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(code);
    if (code === "page.kindLocked") {
      expect(result.stderr).toContain("page.kind: CAD page kind is locked");
      expect(result.stderr).not.toContain("invalid element");
      expect(result.stderr).not.toContain("nodetto-cli types");
    }
    expect(file.writes).toBe(0);
    expect(file.text).toBe(source);
  },
);

test("add-page creates CAD pages and add accepts a document resource on CAD", () => {
  const file = fixture();
  const result = file.edit([
    {
      op: "add-page",
      id: "plate",
      kind: "cad3d",
      name: "Backing plate",
      ref: "plate",
    },
    {
      op: "add",
      page: "@plate",
      id: "coat",
      type: "design.token",
      semantic: { name: "Coating", kind: "color", value: "#527184" },
    },
  ]);
  expect(result.exitCode).toBe(0);
  const document = parseDocument(file.text);
  expect(document.pages.find(({ id }) => id === "plate")?.kind).toBe("cad3d");
  expect(document.elements.find(({ id }) => id === "coat")).toMatchObject({
    type: "design.token",
    page: "plate",
  });
  expect(
    file.run("cad", "check", "bracket.jsonl", "--page", "plate").stdout,
  ).toBe("Backing plate: 0 features, 0 entities, 0 errors\n");
});

test("set-page-kind can change an existing diagram page kind", () => {
  const file = fixture();
  expect(
    file.edit([{ op: "set-page-kind", id: "notes", kind: "flowchart" }])
      .exitCode,
  ).toBe(0);
  expect(
    parseDocument(file.text).pages.find(({ id }) => id === "notes")?.kind,
  ).toBe("flowchart");
});

test("delete detaches an extrude, leaving a valid file with a CAD diagnostic", () => {
  const file = fixture();
  expect(file.edit([{ op: "delete", id: "bracket-sketch" }]).exitCode).toBe(0);
  const document = parseDocument(file.text);
  expect(
    document.elements
      .filter(({ page }) => page === "bracket")
      .map(({ id }) => id),
  ).toEqual(["bracket-extrude"]);
  expect(file.run("validate", "bracket.jsonl").exitCode).toBe(0);
  const report = file.run(
    "cad",
    "check",
    "bracket.jsonl",
    "--page",
    "bracket",
    "--json",
  );
  expect(report.exitCode).toBe(1);
  expect(JSON.parse(report.stdout)[0]?.errors).toEqual([
    { id: "bracket-extrude", code: "cad.reference.missing" },
  ]);
});

test("the edit help CAD batch authors a closed, extruded profile", () => {
  const file = fixture();
  const help = file.run("help", "edit").stdout;
  const start =
    help.indexOf("Example CAD batch:\n") + "Example CAD batch:\n".length;
  const end = help.indexOf("\n]", start);
  expect(end).toBeGreaterThan(start);
  const result = file.edit(JSON.parse(help.slice(start, end + 2)));
  expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  expect(file.run("validate", "bracket.jsonl").exitCode).toBe(0);
  const report = file.run(
    "cad",
    "check",
    "bracket.jsonl",
    "--page",
    "Mount",
    "--json",
  );
  expect(report.exitCode).toBe(0);
  expect(JSON.parse(report.stdout)[0]).toMatchObject({
    features: 2,
    entities: 4,
    bounds: { min: [0, 0, 0], max: [24, 16, 4] },
  });
});

test("copy-shapes refuses both directions across the CAD boundary", () => {
  const file = fixture();
  for (const [from, to] of [
    ["notes", "bracket"],
    ["bracket", "notes"],
  ] as const) {
    expect(
      file.run(
        "pages",
        "copy-shapes",
        "bracket.jsonl",
        "--from",
        from,
        "--to",
        to,
      ),
    ).toMatchObject({
      exitCode: 2,
      stderr: expect.stringContaining("Nothing was written."),
    });
  }
  expect(file.writes).toBe(0);
});

test("arrange and lint exclude CAD pages", () => {
  const file = fixture();
  for (const mode of ["tidy", "overlaps", "layered", "route"]) {
    const result = file.run(
      "arrange",
      "bracket.jsonl",
      "--page",
      "bracket",
      "--mode",
      mode,
      "--write",
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/Mode .* support/);
  }
  expect(
    file.run("lint", "bracket.jsonl", "--page", "bracket", "--fix").exitCode,
  ).toBe(2);
  const document = parseDocument(source);
  const cadOnly = fixture(
    serializeDocument({
      ...document,
      pages: [{ id: "bracket", kind: "cad3d", name: "Bracket", mode: "app" }],
      elements: document.elements.filter(({ page }) => page === "bracket"),
    }),
  );
  const pcbOnly = fixture(
    serializeDocument({
      ...document,
      pages: [{ id: "board", kind: "pcb", name: "Board" }],
      elements: [],
    }),
  );
  const result = cadOnly.run("lint", "bracket.jsonl");
  expect(result.exitCode).toBe(2);
  expect(result).toEqual(pcbOnly.run("lint", "bracket.jsonl"));
  expect(file.run("lint", "bracket.jsonl", "--page", "notes").exitCode).toBe(0);
  expect(file.writes).toBe(0);
});
