import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeStoredZip } from "../../../packages/core/src/zip.ts";
import { parseDocument, serializeDocument } from "@nodetto/io";
import type { Document, Element } from "@nodetto/ir";
import {
  EXIT_ERROR,
  EXIT_OK,
  EXIT_WARNINGS,
  type CommandIo,
  runCli,
} from "./commands.ts";

const EXTENSIONS = ["GTL", "GBL", "GTS", "GBS", "GTO", "GKO", "DRL"];
const examples = join(import.meta.dir, "../../../examples/breadboard");
const goldens = Object.fromEntries(
  EXTENSIONS.map((extension) => [
    `gerber/led-button.${extension}`,
    readFileSync(join(examples, `led-button.${extension}`), "utf8"),
  ]),
);
const encoder = new TextEncoder();
const ZIP = encodeStoredZip(
  [
    ...EXTENSIONS.map((extension) => ({
      path: `led-button.${extension}`,
      contents: encoder.encode(
        goldens[`gerber/led-button.${extension}`] as string,
      ),
    })),
    {
      path: "README.txt",
      contents: encoder.encode("Order notes, not a layer."),
    },
  ],
  "test archive",
);

function memoryIo(
  text: Record<string, string>,
  bytes: Record<string, Uint8Array> = {},
) {
  const files = new Map(Object.entries(text));
  const io: CommandIo & { files: Map<string, string> } = {
    files,
    readText(path) {
      const value = files.get(path);
      if (value === undefined) throw new Error("ENOENT");
      return value;
    },
    readBytes(path) {
      const value = bytes[path];
      if (value === undefined) throw new Error("ENOENT");
      return value;
    },
    writeText(path, value) {
      files.set(path, value);
    },
    exists: (path) => files.has(path) || path in bytes,
  };
  return io;
}

const cli = (args: readonly string[], io: CommandIo) =>
  runCli(args, io, "test");
const paths = Object.keys(goldens);
/** Layer groups in painting order (the file lists records by id). */
const layerNames = (document: Document) =>
  document.elements
    .filter((element) => element.type === "group")
    .sort((left, right) => (left.index < right.index ? -1 : 1))
    .map((element) => element.visual.layerName);

test("gerber import draws every layer of the files on one page", () => {
  const result = cli(["gerber", "import", ...paths], memoryIo(goldens));
  expect(result.exitCode).toBe(EXIT_OK);
  // The half board, 83.82 x 55.88 mm, plus its 0.1 mm edge line.
  expect(result.stderr).toStartWith("Board 83.92 x 55.98 mm, 7 layer(s):\n");
  expect(result.stderr).toContain("  Top copper: led-button.GTL (");
  const document = parseDocument(result.stdout);
  expect(document.pages).toEqual([
    expect.objectContaining({
      id: "pcb-page-1",
      name: "PCB",
      kind: "freeform",
    }),
  ]);
  expect(layerNames(document)).toEqual([
    "Bottom solder mask (led-button.GBS)",
    "Bottom copper (led-button.GBL)",
    "Top copper (led-button.GTL)",
    "Top solder mask (led-button.GTS)",
    "Top silkscreen (led-button.GTO)",
    "Drill (led-button.DRL)",
    "Board outline (led-button.GKO)",
  ]);
});

test("a ZIP archive imports like its files and skips what is not fabrication data", () => {
  const io = memoryIo({}, { "led-button-pcb.zip": ZIP });
  const fromZip = cli(
    ["gerber", "import", "led-button-pcb.zip", "--output", "pcb.jsonl"],
    io,
  );
  expect(fromZip.exitCode).toBe(EXIT_OK);
  expect(fromZip.stderr).toEndWith("Wrote PCB document to pcb.jsonl.\n");
  const zipped = parseDocument(io.files.get("pcb.jsonl") as string);
  expect(zipped.pages[0]?.name).toBe("led-button-pcb");
  const fromFiles = parseDocument(
    cli(["gerber", "import", ...paths], memoryIo(goldens)).stdout,
  );
  const shapes = (document: Document) =>
    document.elements.map(({ id, type, semantic, visual }: Element) => ({
      id,
      type,
      semantic,
      visual,
    }));
  expect(shapes(zipped)).toEqual(shapes(fromFiles));
});

test("--into adds a page after the existing ones, twice without id clashes", () => {
  const io = memoryIo(goldens);
  const base = parseDocument(
    cli(["gerber", "import", ...paths, "--page-name", "First"], io).stdout,
  );
  io.files.set("doc.jsonl", serializeDocument(base));
  const second = cli(
    [
      "gerber",
      "import",
      ...paths,
      "--into",
      "doc.jsonl",
      "--page-name",
      "Second",
    ],
    io,
  );
  expect(second.exitCode).toBe(EXIT_OK);
  expect(second.stderr).toEndWith('Added page "Second" to doc.jsonl.\n');
  const document = parseDocument(io.files.get("doc.jsonl") as string);
  expect(document.pages.map((page) => [page.id, page.name])).toEqual([
    ["pcb-page-1", "First"],
    ["pcb-page-2", "Second"],
  ]);
  expect(
    (document.pages[1]?.order ?? "") > (document.pages[0]?.order ?? ""),
  ).toBe(true);
  const ids = document.elements.map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(
    document.elements.filter((element) => element.page === "pcb-page-2"),
  ).toHaveLength(
    document.elements.filter((element) => element.page === "pcb-page-1").length,
  );
});

test("--strict fails on reader warnings; usage and input errors are explained", () => {
  const unterminated =
    "%FSLAX46Y46*%\n%MOMM*%\n%ADD10C,0.1*%\nD10*\nX0Y0D03*\n";
  const io = memoryIo(
    { ...goldens, "open.gtl": unterminated, "notes.txt": "hello" },
    { "notes.zip": encoder.encode("plain") },
  );
  const strict = cli(["gerber", "import", "open.gtl", "--strict"], io);
  expect(strict.exitCode).toBe(EXIT_WARNINGS);
  expect(strict.stderr).toBe(
    "warning: open.gtl: the file does not end with M02\n1 Gerber import warning(s) with --strict.\n",
  );
  expect(cli(["gerber", "import", "open.gtl"], io).exitCode).toBe(EXIT_OK);
  for (const [args, message] of [
    [["gerber"], "gerber expects the import subcommand."],
    [
      ["gerber", "import"],
      "gerber import expects Gerber, drill or ZIP file paths.",
    ],
    [
      ["gerber", "import", "open.gtl", "--output", "a", "--into", "b"],
      "Use --output or --into, not both.",
    ],
    [["gerber", "import", "notes.zip"], "notes.zip is not a ZIP archive."],
    [["gerber", "import", "missing.gtl"], "Cannot read missing.gtl: ENOENT"],
    [
      ["gerber", "import", "notes.txt"],
      "Cannot import: no Gerber or drill file could be read",
    ],
  ] as const) {
    const result = cli(args, io);
    expect(result.exitCode).toBe(EXIT_ERROR);
    expect(result.stderr).toContain(message);
  }
  expect(cli(["help"], io).stdout).toContain(
    "nodetto-cli gerber import       Gerber and drill files to a PCB page",
  );
});

test("edit names the validation errors of a document it refuses", () => {
  const io = memoryIo({
    "bad.jsonl":
      '{"kind":"document","schemaVersion":1,"id":"d","title":"D"}\n{"kind":"page","id":"p","name":"P","pageKind":"freeform","order":"a0"}\n',
    "ops.json": "[]",
  });
  const result = cli(["edit", "bad.jsonl", "--ops", "ops.json"], io);
  expect(result.exitCode).toBe(EXIT_ERROR);
  expect(result.stderr).toContain(
    "The document is not a valid nodetto document:\nerror: pages[0].order: expected a base62 fractional key without a trailing zero",
  );
});
