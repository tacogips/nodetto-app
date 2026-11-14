import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeBreadboardPcbZip, exportBreadboardPcb } from "@nodetto/core";
import { parseDocumentResult, serializeDocument } from "@nodetto/io";
import { importBpmnXml } from "@nodetto/io";
import {
  EXIT_DRIFT,
  EXIT_ERROR,
  EXIT_OK,
  EXIT_WARNINGS,
  type CommandIo,
  runCli,
} from "./commands.ts";

const fixtureRoot = join(import.meta.dir, "../../../test-fixtures/kicad");
const kicadFixtures = Object.fromEntries(
  ["led-button.net", "legacy.sch", "unknown-symbols.net"].map((name) => [
    `test-fixtures/kicad/${name}`,
    readFileSync(join(fixtureRoot, name), "utf8"),
  ]),
);

function memoryIo(initial: Record<string, string>): CommandIo & {
  readonly files: Map<string, string>;
} {
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

const cli = (args: readonly string[], io: CommandIo) =>
  runCli(args, io, "test");

function breadboardDocument(
  parts: readonly { id: string; reference: string; value?: string }[] = [],
) {
  const elements = [
    '{"kind":"document","schemaVersion":1,"id":"doc-breadboard","title":"Prototype"}',
    '{"kind":"page","id":"page-breadboard","name":"Prototype","pageKind":"breadboard"}',
    '{"kind":"element","id":"board","page":"page-breadboard","type":"breadboard.board","index":"a0","semantic":{"size":"half"}}',
    ...parts.map(
      (part, index) =>
        `{"kind":"element","id":${JSON.stringify(part.id)},"page":"page-breadboard","type":"breadboard.resistor","index":"a${index + 1}","semantic":{"reference":${JSON.stringify(part.reference)},"value":${JSON.stringify(part.value ?? "220")},"span":4,"bands":4}}`,
    ),
  ];
  return `${elements.join("\n")}\n`;
}

test("lint covers breadboard ERC/parity and keeps BPMN rows in mixed documents", () => {
  const duplicate = cli(
    ["lint", "doc.jsonl"],
    memoryIo({
      "doc.jsonl": breadboardDocument([
        { id: "r1", reference: "R1" },
        { id: "r2", reference: "R1" },
      ]),
    }),
  );
  expect(duplicate.exitCode).toBe(EXIT_DRIFT);
  expect(duplicate.stdout).toContain("duplicate-reference");

  const clean = cli(
    ["lint", "clean.jsonl"],
    memoryIo({ "clean.jsonl": breadboardDocument() }),
  );
  expect(clean.exitCode).toBe(EXIT_OK);
  expect(clean.stdout).toBe("");

  const cleanWithConfig = cli(
    ["lint", "clean.jsonl", "--config", "missing.json"],
    memoryIo({ "clean.jsonl": breadboardDocument() }),
  );
  expect(cleanWithConfig.exitCode).toBe(EXIT_OK);

  const bpmnXml =
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="p"><bpmn:startEvent id="s"/><bpmn:endEvent id="e"/></bpmn:process></bpmn:definitions>';
  const bpmnDocument = importBpmnXml(bpmnXml).document;
  const breadboardResult = parseDocumentResult(
    breadboardDocument([
      { id: "r1", reference: "R1" },
      { id: "r2", reference: "R1" },
    ]),
  );
  if (!breadboardResult.ok)
    throw new Error("test breadboard fixture failed to parse");
  const breadboard = breadboardResult.document;
  const mixed = serializeDocument({
    ...breadboard,
    id: bpmnDocument.id,
    title: "Mixed",
    pages: [...bpmnDocument.pages, ...breadboard.pages],
    elements: [...bpmnDocument.elements, ...breadboard.elements],
  });
  const result = cli(
    ["lint", "mixed.jsonl"],
    memoryIo({ "mixed.jsonl": mixed }),
  );
  expect(result.exitCode).toBe(EXIT_DRIFT);
  expect(result.stdout).toContain("page Prototype (page-breadboard)");
  expect(result.stdout).toContain("no-implicit-start");
});

test("lint JSON includes pin only when a breadboard finding has one", () => {
  const result = cli(
    ["lint", "doc.jsonl", "--format", "json"],
    memoryIo({
      "doc.jsonl": breadboardDocument([
        { id: "r1", reference: "R1" },
        { id: "r2", reference: "R1" },
      ]),
    }),
  );
  const report = JSON.parse(result.stdout) as {
    pages: { findings: Record<string, unknown>[] }[];
  };
  const findings = report.pages.flatMap((page) => page.findings);
  expect(findings.some((finding) => typeof finding.pin === "number")).toBe(
    true,
  );
  expect(
    findings
      .filter((finding) => finding.ruleId === "duplicate-reference")
      .every((finding) => !("pin" in finding)),
  ).toBe(true);
  expect(findings.every((finding) => !("elementIds" in finding))).toBe(true);
});

test("lint reports the combined no-page message", () => {
  const freeform =
    '{"kind":"document","schemaVersion":1,"id":"doc-free","title":"Free"}\n{"kind":"page","id":"page-free","name":"Free","pageKind":"freeform"}\n';
  const result = cli(
    ["lint", "free.jsonl"],
    memoryIo({ "free.jsonl": freeform }),
  );
  expect(result.exitCode).toBe(EXIT_ERROR);
  expect(result.stderr).toContain(
    "The document contains no BPMN or breadboard pages.",
  );
  const selected = cli(
    ["lint", "free.jsonl", "--page", "missing"],
    memoryIo({ "free.jsonl": freeform }),
  );
  expect(selected.exitCode).toBe(EXIT_ERROR);
  expect(selected.stderr).toContain(
    "The document contains no BPMN or breadboard pages.",
  );
});

test("breadboard BOM supports stdout, output, check, drift and strict warnings", () => {
  const io = memoryIo({
    "doc.jsonl": breadboardDocument([{ id: "r1", reference: "R1" }]),
  });
  const bom = cli(["breadboard", "bom", "doc.jsonl"], io);
  expect(bom.exitCode).toBe(EXIT_OK);
  expect(bom.stdout).toStartWith("Item,Qty,References,Value,Part,Footprint\n");
  expect(
    cli(["breadboard", "bom", "doc.jsonl", "--output", "bom.csv"], io).exitCode,
  ).toBe(EXIT_OK);
  expect(io.files.get("bom.csv")).toBe(bom.stdout);
  expect(
    cli(["breadboard", "bom", "doc.jsonl", "--check", "bom.csv"], io).exitCode,
  ).toBe(EXIT_OK);
  io.files.set("bom.csv", "stale\n");
  expect(
    cli(["breadboard", "bom", "doc.jsonl", "--check", "bom.csv"], io).exitCode,
  ).toBe(EXIT_DRIFT);
  const strict = cli(
    ["breadboard", "bom", "unannotated.jsonl", "--strict"],
    memoryIo({
      "unannotated.jsonl": breadboardDocument([{ id: "r1", reference: "R?" }]),
    }),
  );
  expect(strict.exitCode).toBe(EXIT_WARNINGS);
  expect(strict.stdout).toBe("");
});

test("breadboard netlist formats and page/usage errors", () => {
  const io = memoryIo({
    "doc.jsonl": breadboardDocument([{ id: "r1", reference: "R1" }]),
  });
  expect(
    cli(["breadboard", "netlist", "doc.jsonl", "--format", "kicad"], io).stdout,
  ).toStartWith('(export (version "E")');
  expect(
    cli(["breadboard", "netlist", "doc.jsonl", "--format", "spice"], io).stdout,
  ).toEndWith(".end\n");
  expect(
    cli(["breadboard", "netlist", "doc.jsonl", "--format", "foo"], io).exitCode,
  ).toBe(EXIT_ERROR);
  expect(
    cli(
      [
        "breadboard",
        "netlist",
        "doc.jsonl",
        "--format",
        "spice",
        "--output",
        "a",
        "--check",
        "b",
      ],
      io,
    ).exitCode,
  ).toBe(EXIT_ERROR);
  const parsed = parseDocumentResult(breadboardDocument());
  if (!parsed.ok) throw new Error("test breadboard fixture failed to parse");
  const secondPage = serializeDocument({
    ...parsed.document,
    pages: [
      ...parsed.document.pages,
      { id: "page-2", name: "Second", kind: "breadboard", order: "b" },
    ],
  });
  const ambiguous = cli(
    ["breadboard", "bom", "two.jsonl"],
    memoryIo({ "two.jsonl": secondPage }),
  );
  expect(ambiguous.exitCode).toBe(EXIT_ERROR);
  expect(ambiguous.stderr).toContain("choose one with --page");
});

test("breadboard import reads fixtures, stages a valid document and handles diagnostics", () => {
  const io = memoryIo(kicadFixtures);
  const imported = cli(
    ["breadboard", "import", "test-fixtures/kicad/led-button.net"],
    io,
  );
  expect(imported.exitCode).toBe(EXIT_OK);
  const parsed = parseDocumentResult(imported.stdout);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.document.pages[0]?.kind).toBe("breadboard");
  const lintedImport = cli(
    ["lint", "imported.jsonl"],
    memoryIo({ "imported.jsonl": imported.stdout }),
  );
  expect(lintedImport.stdout).toContain("pin-not-in-hole");
  expect(lintedImport.stdout).toContain("parity-missing-connection");
  const legacy = cli(
    ["breadboard", "import", "test-fixtures/kicad/legacy.sch"],
    io,
  );
  expect(legacy.exitCode).toBe(EXIT_DRIFT);
  expect(legacy.stdout).toBe("");
  expect(legacy.stderr).toContain("kicad.legacyFormat");
  const strict = cli(
    [
      "breadboard",
      "import",
      "test-fixtures/kicad/unknown-symbols.net",
      "--strict",
    ],
    io,
  );
  expect(strict.exitCode).toBe(EXIT_WARNINGS);
  expect(strict.stdout).toBe("");
});

test("breadboard gerber writes a ZIP of fabrication files", () => {
  const example = readFileSync(
    join(import.meta.dir, "../../../examples/breadboard/led-button.jsonl"),
    "utf8",
  );
  const written = new Map<string, Uint8Array>();
  const io = {
    ...memoryIo({ "doc.jsonl": example }),
    writeBytes(path: string, bytes: Uint8Array) {
      written.set(path, bytes);
    },
  };
  const result = cli(
    ["breadboard", "gerber", "doc.jsonl", "--output", "out/led-pcb.zip"],
    io,
  );
  expect(result.exitCode).toBe(EXIT_OK);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain(
    "warning: Hole e7 holds SW1 pin 3 and R1 pin 1; a PCB hole takes one lead",
  );
  expect(result.stderr).toContain("All 2 wire(s) are top-layer traces.");
  expect(
    result.stderr.endsWith(
      "Wrote Gerber and drill files to out/led-pcb.zip.\n",
    ),
  ).toBe(true);
  const zip = written.get("out/led-pcb.zip");
  if (!zip) throw new Error("no archive written");
  expect([...zip.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  const listing = new TextDecoder().decode(zip);
  for (const extension of ["GTL", "GBL", "GTS", "GBS", "GTO", "GKO", "DRL"])
    expect(listing).toContain(`led-pcb.${extension}`);

  const strict = cli(
    ["breadboard", "gerber", "doc.jsonl", "--output", "strict.zip", "--strict"],
    io,
  );
  expect(strict.exitCode).toBe(EXIT_WARNINGS);
  expect(written.has("strict.zip")).toBe(false);
});

test("breadboard gerber usage errors", () => {
  const io = {
    ...memoryIo({ "doc.jsonl": breadboardDocument() }),
    writeBytes() {},
  };
  const noOutput = cli(["breadboard", "gerber", "doc.jsonl"], io);
  expect(noOutput.exitCode).toBe(EXIT_ERROR);
  expect(noOutput.stderr).toContain("requires --output <file.zip>");
  const empty = cli(
    ["breadboard", "gerber", "doc.jsonl", "--output", "x.zip"],
    io,
  );
  expect(empty.exitCode).toBe(EXIT_ERROR);
  expect(empty.stderr).toContain(
    "Nothing is seated on this board, so there is no PCB to make.",
  );
  const wrongBoard = cli(
    ["breadboard", "gerber", "doc.jsonl", "--output", "x.zip", "--board", "zz"],
    io,
  );
  expect(wrongBoard.stderr).toContain(
    "No board on this page has an id starting with zz.",
  );
  const textOnly = cli(
    ["breadboard", "gerber", "doc.jsonl", "--output", "x.zip"],
    memoryIo({ "doc.jsonl": breadboardDocument() }),
  );
  expect(textOnly.stderr).toContain("This host cannot write binary files.");
});

test("breadboard gerber --outline", () => {
  const example = readFileSync(
    join(import.meta.dir, "../../../examples/breadboard/led-button.jsonl"),
    "utf8",
  );
  const written = new Map<string, Uint8Array>();
  const io = {
    ...memoryIo({ "doc.jsonl": example }),
    writeBytes(path: string, bytes: Uint8Array) {
      written.set(path, bytes);
    },
  };
  const run = (...extra: string[]) =>
    cli(
      ["breadboard", "gerber", "doc.jsonl", "--output", "pcb.zip", ...extra],
      io,
    );
  const document = parseDocumentResult(example);
  if (!document.ok) throw new Error("example does not parse");
  const page = document.document.pages.find(
    ({ kind }) => kind === "breadboard",
  );
  if (!page) throw new Error("example has no breadboard page");
  const core = (outline: "board" | "used") => {
    const pcb = exportBreadboardPcb(document.document, page.id, {
      name: "pcb",
      outline,
    });
    if (typeof pcb === "string") throw new Error(pcb);
    return encodeBreadboardPcbZip(pcb);
  };

  expect(run().exitCode).toBe(EXIT_OK);
  const byDefault = written.get("pcb.zip");
  expect(byDefault).toEqual(core("board"));
  expect(run("--outline", "board").exitCode).toBe(EXIT_OK);
  expect(written.get("pcb.zip")).toEqual(byDefault);

  const used = run("--outline", "used");
  expect(used.exitCode).toBe(EXIT_OK);
  expect(written.get("pcb.zip")).toEqual(core("used"));
  expect(written.get("pcb.zip")).not.toEqual(byDefault);
  expect(used.stderr).toContain("Board 30.98 x 32.66 mm");

  written.clear();
  const wrong = run("--outline", "square");
  expect(wrong.exitCode).toBe(EXIT_ERROR);
  expect(
    wrong.stderr.startsWith(
      "--outline must be board or used.\n\nUsage: nodetto-cli breadboard",
    ),
  ).toBe(true);
  const missing = run("--outline");
  expect(missing.exitCode).toBe(EXIT_ERROR);
  expect(missing.stderr).toContain("--outline requires a value.");
  expect(written.size).toBe(0);
});
