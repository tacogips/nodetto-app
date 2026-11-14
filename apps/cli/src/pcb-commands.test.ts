import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  encodePcbBoardZip,
  exportPcbBoard,
  pcbDocumentFromPlan,
} from "@nodetto/core";
import { importKicadPcb, parseDocument, serializeDocument } from "@nodetto/io";
import type { Document, Element, Page } from "@nodetto/ir";
import { PDFDocument } from "pdf-lib";
import {
  EXIT_ERROR,
  EXIT_OK,
  EXIT_WARNINGS,
  type CommandIo,
  runCli,
} from "./commands.ts";
import { exportCommand, type RasterBackend } from "./export-command.ts";
import * as raster from "./raster-backend.ts";

const fixturePath = join(
  import.meta.dir,
  "../../../test-fixtures/kicad/two-layer.kicad_pcb",
);
const fixture = readFileSync(fixturePath, "utf8");
const fixtureName = "two-layer.kicad_pcb";
const imported = importKicadPcb(fixture, { fileName: fixtureName });
if (!imported.plan) throw new Error("PCB fixture did not import");
const fixtureDocument = pcbDocumentFromPlan(imported.plan, {
  pageName: imported.plan.title,
});

function memoryIo(text: Record<string, string> = {}) {
  const files = new Map(Object.entries(text));
  const binary = new Map<string, Uint8Array>();
  const io: CommandIo & {
    files: Map<string, string>;
    binary: Map<string, Uint8Array>;
  } = {
    files,
    binary,
    readText(path) {
      const value = files.get(path);
      if (value === undefined) throw new Error("ENOENT");
      return value;
    },
    writeText(path, value) {
      files.set(path, value);
    },
    writeBytes(path, value) {
      binary.set(path, value);
    },
    readBytes(path) {
      const value = binary.get(path);
      if (value === undefined) throw new Error("ENOENT");
      return value;
    },
    exists: (path) => files.has(path) || binary.has(path),
  };
  return io;
}

const cli = (args: readonly string[], io: CommandIo) =>
  runCli(args, io, "test");

test("pcb import writes a valid PCB document and reports its board summary", () => {
  const io = memoryIo({ [fixturePath]: fixture });
  const result = cli(
    ["pcb", "import", fixturePath, "--output", "out.jsonl"],
    io,
  );
  expect(result.exitCode).toBe(EXIT_OK);
  const document = parseDocument(io.files.get("out.jsonl") as string);
  expect(document.pages[0]?.kind).toBe("pcb");
  expect(document.elements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: "pcb.board" }),
      expect.objectContaining({ type: "pcb.footprint" }),
      expect.objectContaining({ type: "pcb.track" }),
      expect.objectContaining({ type: "pcb.via" }),
    ]),
  );
  expect(result.stderr).toContain("5 footprints");
  expect(result.stderr).toContain("footprints");
  expect(result.stderr).toContain("2 vias");
  expect(result.stderr).toContain("nets.");
});

test("pcb import without output prints deterministic serialized JSONL", () => {
  const io = memoryIo({ [fixturePath]: fixture });
  const result = cli(["pcb", "import", fixturePath], io);
  expect(result.exitCode).toBe(EXIT_OK);
  expect(result.stdout).toBe(serializeDocument(fixtureDocument));
  expect(result.stderr).toContain("Board ");
});

test("pcb import uses the pinned form when the board has no outline", () => {
  const noOutline = fixture
    .split("\n")
    .filter((line) => !line.includes('(layer "Edge.Cuts")'))
    .join("\n");
  const result = cli(
    ["pcb", "import", "no-outline.kicad_pcb"],
    memoryIo({ "no-outline.kicad_pcb": noOutline }),
  );
  expect(result.exitCode).toBe(EXIT_OK);
  expect(result.stderr).toContain("Board with no outline:");
  expect(result.stderr).toContain("5 footprints");
});

test("pcb import reports errors and strict warnings without writing", () => {
  const warningSource = fixture.replace(
    /\)\s*$/,
    "  (dimension (type aligned) (pts (xy 0 0) (xy 1 1)))\n)",
  );
  const io = memoryIo({
    "bad.kicad_sch": "(kicad_sch (version 20250101))",
    "warning.kicad_pcb": warningSource,
  });
  const bad = cli(["pcb", "import", "bad.kicad_sch"], io);
  expect(bad.exitCode).toBe(EXIT_ERROR);
  expect(bad.stderr).toContain("kicad.unknownRoot");
  const strict = cli(
    [
      "pcb",
      "import",
      "warning.kicad_pcb",
      "--output",
      "never.jsonl",
      "--strict",
    ],
    io,
  );
  expect(strict.exitCode).toBe(EXIT_WARNINGS);
  expect(strict.stderr).toContain("warning: warning.kicad_pcb:");
  expect(strict.stderr).toContain("with --strict");
  expect(io.files.has("never.jsonl")).toBe(false);
  const permissive = cli(["pcb", "import", "warning.kicad_pcb"], io);
  expect(permissive.exitCode).toBe(EXIT_OK);
  expect(permissive.stderr).toContain("warning: warning.kicad_pcb:");
});

test("pcb gerber writes the same deterministic ZIP as the core exporter", () => {
  const io = memoryIo({ "board.jsonl": serializeDocument(fixtureDocument) });
  const result = cli(
    ["pcb", "gerber", "board.jsonl", "--output", "exports/board.zip"],
    io,
  );
  expect(result.exitCode).toBe(EXIT_OK);
  const expected = exportPcbBoard(fixtureDocument, "pcb-page-1", {
    name: "board",
  });
  expect(typeof expected).not.toBe("string");
  expect(io.binary.get("exports/board.zip")).toEqual(
    encodePcbBoardZip(expected as Exclude<typeof expected, string>),
  );
  expect(result.stderr).toContain(
    "Wrote Gerber and drill files to exports/board.zip.",
  );
});

test("pcb gerber strict mode does not write when export reports warnings", () => {
  const warningDocument: Document = {
    ...fixtureDocument,
    elements: fixtureDocument.elements.map((element) =>
      element.type === "pcb.zone"
        ? {
            ...element,
            semantic: {
              ...(element.semantic as Record<string, unknown>),
              filled: [],
            },
          }
        : element,
    ),
  };
  const io = memoryIo({ "warning.jsonl": serializeDocument(warningDocument) });
  const result = cli(
    ["pcb", "gerber", "warning.jsonl", "--output", "blocked.zip", "--strict"],
    io,
  );
  expect(result.exitCode).toBe(EXIT_WARNINGS);
  expect(result.stderr).toContain("warning: Zone on GND has no fill");
  expect(io.binary.has("blocked.zip")).toBe(false);
});

test("pcb gerber validates output and selects among PCB pages", () => {
  const primary = fixtureDocument.pages[0] as Page;
  const second = { ...primary, id: "pcb-page-2", name: "Second" };
  const twoPages: Document = {
    ...fixtureDocument,
    pages: [primary, second],
    elements: [
      ...fixtureDocument.elements,
      ...fixtureDocument.elements.map((element: Element) => ({
        ...element,
        id: `second-${element.id}`,
        page: second.id,
      })),
    ],
  };
  const io = memoryIo({
    "one.jsonl": serializeDocument(fixtureDocument),
    "two.jsonl": serializeDocument(twoPages),
    "empty.jsonl": serializeDocument({
      ...fixtureDocument,
      pages: [{ ...(fixtureDocument.pages[0] as Page), kind: "freeform" }],
    }),
  });
  expect(cli(["pcb", "gerber", "one.jsonl"], io).stderr).toContain(
    "requires --output <file.zip>",
  );
  const noPage = cli(["pcb", "gerber", "empty.jsonl", "--output", "x.zip"], io);
  expect(noPage.exitCode).toBe(EXIT_ERROR);
  expect(noPage.stderr).toContain("The document contains no PCB pages.");
  const ambiguous = cli(
    ["pcb", "gerber", "two.jsonl", "--output", "x.zip"],
    io,
  );
  expect(ambiguous.exitCode).toBe(EXIT_ERROR);
  expect(ambiguous.stderr).toContain("The document has 2 PCB pages");
  const selected = cli(
    ["pcb", "gerber", "two.jsonl", "--page", "Second", "--output", "x.zip"],
    io,
  );
  expect(selected.exitCode).toBe(EXIT_OK);
});

test("pcb commands require a recognized subcommand and expose detailed help", () => {
  for (const args of [["pcb"], ["pcb", "foo"]]) {
    const result = cli(args, memoryIo());
    expect(result.exitCode).toBe(EXIT_ERROR);
    expect(result.stderr).toContain(
      "pcb expects the import or gerber subcommand.",
    );
  }
  expect(cli(["help", "pcb"], memoryIo()).stdout).toContain(
    "nodetto-cli pcb gerber <doc.jsonl> --output <file.zip>",
  );
});

test("export draws the PCB page as SVG, PNG and PDF", async () => {
  const io = memoryIo({ "board.jsonl": serializeDocument(fixtureDocument) });
  const svg = await exportCommand(io, ["board.jsonl", "--format", "svg"]);
  expect(svg.exitCode).toBe(EXIT_OK);
  for (const type of [
    "pcb.track",
    "pcb.footprint",
    "pcb.via",
    "pcb.zone",
    "pcb.graphic",
  ])
    expect(svg.stdout).toContain(`data-type="${type}"`);
  expect(svg.stdout).toContain('data-layer="pcb-board"');
  expect(svg.stdout).not.toContain("unsupported:");

  const rendered: string[] = [];
  const backend: RasterBackend = {
    rasterize: async (source) => {
      rendered.push(source);
      return new Uint8Array([1]);
    },
    pngToPdf: async () => new Uint8Array([2]),
  };
  for (const format of ["png", "pdf"]) {
    const result = await exportCommand(
      io,
      ["board.jsonl", "--format", format, "--output", `out.${format}`],
      backend,
    );
    expect(result.exitCode).toBe(EXIT_OK);
    expect(rendered.at(-1)).toContain('data-type="pcb.track"');
    expect(rendered.at(-1)).toContain('data-layer="pcb-board"');
    expect(rendered.at(-1)).not.toContain("unsupported:");
  }

  const pngIo = memoryIo({ "board.jsonl": serializeDocument(fixtureDocument) });
  const png = await exportCommand(
    pngIo,
    ["board.jsonl", "--format", "png", "--scale", "1", "--output", "out.png"],
    raster,
  );
  expect(png.exitCode).toBe(EXIT_OK);
  expect([...pngIo.binary.get("out.png")!.slice(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  const pdfIo = memoryIo({ "board.jsonl": serializeDocument(fixtureDocument) });
  const pdf = await exportCommand(
    pdfIo,
    ["board.jsonl", "--format", "pdf", "--output", "out.pdf"],
    raster,
  );
  expect(pdf.exitCode).toBe(EXIT_OK);
  const pdfDocument = await PDFDocument.load(pdfIo.binary.get("out.pdf")!);
  expect(pdfDocument.getPageCount()).toBe(1);
});
