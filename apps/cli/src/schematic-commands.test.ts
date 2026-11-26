import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDocumentResult, serializeDocument } from "@nodetto/io";
import { type CommandIo, runCli } from "./commands.ts";

const root = join(import.meta.dir, "../../..");
const example = readFileSync(
  join(root, "examples/schematic/led-switch.jsonl"),
  "utf8",
);

function memoryIo(
  initial: Record<string, string>,
): CommandIo & { files: Map<string, string> } {
  const files = new Map(Object.entries(initial));
  return {
    files,
    readText(path) {
      const value = files.get(path);
      if (value === undefined) throw new Error("ENOENT");
      return value;
    },
    writeText(path, text) {
      files.set(path, text);
    },
    exists(path) {
      return files.has(path);
    },
  };
}
const run = (io: CommandIo, ...args: string[]) => runCli(args, io, "test");

function withBoard(source: string): string {
  const result = parseDocumentResult(source);
  if (!result.ok) throw new Error("invalid schematic fixture");
  return serializeDocument({
    ...result.document,
    pages: [
      ...result.document.pages,
      { id: "board", name: "Board", kind: "breadboard" },
    ],
  });
}

test("schematic netlist exports both formats, checks drift and enforces strict warnings", () => {
  const io = memoryIo({
    "doc.jsonl": example,
    "warning.jsonl": example.replace('"reference":"BT1"', '"reference":"BT?"'),
  });
  for (const format of ["text", "kicad"]) {
    const exported = run(
      io,
      "schematic",
      "netlist",
      "doc.jsonl",
      "--format",
      format,
    );
    expect(exported.exitCode).toBe(0);
    expect(exported.stdout).toStartWith(
      format === "text" ? "# nodetto schematic netlist 1" : "(export",
    );
    expect(
      run(
        io,
        "schematic",
        "netlist",
        "doc.jsonl",
        "--format",
        format,
        "--output",
        "out",
      ).exitCode,
    ).toBe(0);
    expect(io.files.get("out")).toBe(exported.stdout);
    expect(
      run(
        io,
        "schematic",
        "netlist",
        "doc.jsonl",
        "--format",
        format,
        "--check",
        "out",
      ).exitCode,
    ).toBe(0);
    io.files.set("out", "stale\n");
    expect(
      run(
        io,
        "schematic",
        "netlist",
        "doc.jsonl",
        "--format",
        format,
        "--check",
        "out",
      ).exitCode,
    ).toBe(1);
    const strict = run(
      io,
      "schematic",
      "netlist",
      "warning.jsonl",
      "--format",
      format,
      "--strict",
      "--output",
      "strict",
    );
    expect(strict.exitCode).toBe(3);
    expect(strict.stdout).toBe("");
    expect(io.files.has("strict")).toBe(false);
  }
  expect(run(io, "schematic", "netlist", "doc.jsonl").exitCode).toBe(2);
  expect(
    run(io, "schematic", "netlist", "doc.jsonl", "--format", "bad").exitCode,
  ).toBe(2);
  expect(
    run(
      io,
      "schematic",
      "netlist",
      "doc.jsonl",
      "--format",
      "text",
      "--check",
      "x",
      "--output",
      "y",
    ).exitCode,
  ).toBe(2);
});

test("schematic import handles schematic and netlist fixtures", () => {
  const fixtures = ["led-button.kicad_sch", "led-button.net"];
  const io = memoryIo(
    Object.fromEntries(
      fixtures.map((name) => [
        name,
        readFileSync(join(root, "test-fixtures/kicad", name), "utf8"),
      ]),
    ),
  );
  for (const name of fixtures) {
    const result = run(
      io,
      "schematic",
      "import",
      name,
      "--output",
      "imported.jsonl",
    );
    expect(result.exitCode).toBe(0);
    const output = io.files.get("imported.jsonl");
    if (!output) throw new Error("import did not write output");
    const parsed = parseDocumentResult(output);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.document.pages[0]?.kind).toBe("schematic");
    expect(run(io, "validate", "imported.jsonl").exitCode).toBe(0);
  }
});

test("schematic import rejects diagonal work above budget while breadboard import remains unbudgeted", () => {
  const directory = mkdtempSync(join(tmpdir(), "nodetto-schematic-budget-"));
  try {
    const n = 1000;
    const g = n + 1;
    const source = `(kicad_sch ${Array.from({ length: n }, (_, i) => `(wire (pts (xy 0 ${i / 1000}) (xy ${(g * n) / 10000} ${(10 * i + g * (n + i)) / 10000})))`).join(" ")})`;
    const path = join(directory, "budget.kicad_sch");
    writeFileSync(path, source);
    const io = memoryIo({ [path]: readFileSync(path, "utf8") });
    const result = run(
      io,
      "schematic",
      "import",
      path,
      "--output",
      "result.jsonl",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("schematic.importTooComplex");
    expect(result.stdout).toBe("");
    expect(io.files.has("result.jsonl")).toBe(false);
    expect(run(io, "breadboard", "import", path).exitCode).toBe(0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("schematic to-breadboard writes one target and rejects sparse IC pins without output", () => {
  const source = withBoard(example);
  const parsed = parseDocumentResult(source);
  if (!parsed.ok) throw new Error("invalid fixture");
  const io = memoryIo({ "doc.jsonl": source });
  const result = run(
    io,
    "schematic",
    "to-breadboard",
    "doc.jsonl",
    "--output",
    "projected.jsonl",
  );
  expect(result.exitCode).toBe(0);
  const output = parseDocumentResult(io.files.get("projected.jsonl") ?? "");
  expect(output.ok).toBe(true);
  if (output.ok)
    expect(
      output.document.elements.filter(
        (item) => item.type === "breadboard.netlist",
      ),
    ).toHaveLength(1);
  const sparse = serializeDocument({
    ...parsed.document,
    elements: [
      {
        id: "ic",
        page: "circuit",
        index: "a0",
        type: "schematic.ic",
        semantic: {
          reference: "U1",
          value: "IC",
          pins: [
            { number: 1, name: "A", side: "left" },
            { number: 3, name: "B", side: "right" },
          ],
        },
        visual: { x: 0, y: 0 },
      },
    ],
  });
  io.files.set("sparse.jsonl", sparse);
  const rejected = run(
    io,
    "schematic",
    "to-breadboard",
    "sparse.jsonl",
    "--output",
    "rejected.jsonl",
  );
  expect(rejected.exitCode).toBe(1);
  expect(rejected.stdout).toBe("");
  expect(io.files.has("rejected.jsonl")).toBe(false);
  expect(
    run(
      memoryIo({ "doc.jsonl": example }),
      "schematic",
      "to-breadboard",
      "doc.jsonl",
    ).exitCode,
  ).toBe(2);
});
