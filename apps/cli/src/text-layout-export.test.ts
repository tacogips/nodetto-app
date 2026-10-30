import { expect, test } from "bun:test";
import { Editor, lintTextLayoutPage } from "@nodetto/core";
import { parseDocument } from "@nodetto/io";
import {
  TEXT_LAYOUT_EXPECTED,
  TEXT_LAYOUT_PAGE_ID,
  textLayoutCleanDocument,
  textLayoutProblemDocument,
  textLayoutWideDocument,
} from "./__fixtures__/text-layout.ts";
import type { CommandIo } from "./commands.ts";
import { exportCommand, type RasterBackend } from "./export-command.ts";

function fixture(source: string) {
  const text = new Map<string, string>();
  const bytes = new Map<string, Uint8Array>();
  const rendered: string[] = [];
  const io: CommandIo = {
    readText: () => source,
    writeText: (path, content) => {
      text.set(path, content);
    },
    writeBytes: (path, content) => {
      bytes.set(path, content);
    },
  };
  const backend: RasterBackend = {
    rasterize: async (svg) => {
      rendered.push(svg);
      return new Uint8Array([1]);
    },
    pngToPdf: async () => new Uint8Array([2]),
  };
  return { io, text, bytes, rendered, backend };
}

const args = ["doc.jsonl", "--page", "Architecture"];

test("whole page SVG preserves bytes and reports ordered layout warnings", async () => {
  const source = textLayoutProblemDocument();
  const document = parseDocument(source);
  const editor = new Editor({ document });
  editor.setCurrentPage(TEXT_LAYOUT_PAGE_ID);
  const expectedSvg = editor.exportPageSvg({ padding: 16, background: null });
  if (expectedSvg === null) throw new Error("Expected visible page SVG");
  const findings = lintTextLayoutPage(document, TEXT_LAYOUT_PAGE_ID);
  expect(
    findings.map(({ ruleId, elementId }) => ({ ruleId, elementId })),
  ).toEqual([...TEXT_LAYOUT_EXPECTED]);
  expect(findings).toHaveLength(8);
  const warnings = findings
    .map((f) => `warning: ${f.ruleId} ${f.elementId}: ${f.message}\n`)
    .join("");
  const { io, text } = fixture(source);
  const stdout = await exportCommand(io, [...args, "--format", "svg"]);
  expect(stdout.exitCode).toBe(0);
  expect(stdout.stdout).toBe(expectedSvg);
  expect(stdout.stderr).toBe(warnings);
  const output = await exportCommand(io, [
    ...args,
    "--format",
    "svg",
    "--output",
    "out.svg",
  ]);
  expect(output.exitCode).toBe(0);
  expect(output.stdout).toBe("");
  expect(text.get("out.svg")).toBe(expectedSvg);
  expect(output.stderr).toBe(`${warnings}Wrote out.svg.\n`);
});

test("PNG and PDF retain raster input and bytes while reporting warnings", async () => {
  const architecture = fixture(textLayoutProblemDocument());
  const uml = fixture(textLayoutProblemDocument("uml"));
  const document = parseDocument(textLayoutProblemDocument());
  const warnings = lintTextLayoutPage(document, TEXT_LAYOUT_PAGE_ID)
    .map((f) => `warning: ${f.ruleId} ${f.elementId}: ${f.message}\n`)
    .join("");
  for (const format of ["png", "pdf"]) {
    const options = [...args, "--format", format, "--output", `out.${format}`];
    const result = await exportCommand(
      architecture.io,
      options,
      architecture.backend,
    );
    const reference = await exportCommand(uml.io, options, uml.backend);
    expect(result.exitCode).toBe(0);
    expect(reference.exitCode).toBe(0);
    expect(result.stderr).toStartWith(warnings);
    expect(result.stderr).toContain(
      `Wrote out.${format} (page "Architecture", `,
    );
    expect(result.stderr.endsWith(").\n")).toBe(true);
    expect(architecture.rendered.at(-1)).toBe(uml.rendered.at(-1));
    expect(architecture.bytes.get(`out.${format}`)).toEqual(
      new Uint8Array([format === "png" ? 1 : 2]),
    );
  }
});

test("layout warnings exclude other page kinds, element, clean and semantic exports", async () => {
  const cases: Array<readonly [string, readonly string[]]> = [
    [textLayoutProblemDocument("uml"), [...args, "--format", "svg"]],
    [
      textLayoutProblemDocument(),
      [...args, "--format", "svg", "--element", "node-clipped"],
    ],
    [textLayoutCleanDocument(), [...args, "--format", "svg"]],
    ...["mermaid", "d2"].map((format): readonly [string, readonly string[]] => [
      textLayoutProblemDocument(),
      [...args, "--format", format],
    ]),
  ];
  for (const [source, options] of cases) {
    const result = await exportCommand(fixture(source).io, options);
    expect(result.stderr).not.toContain("warning: label-");
    expect(result.stderr).not.toContain("warning: note-overflow");
    if (options.includes("svg")) expect(result.exitCode).toBe(0);
    if (source === textLayoutCleanDocument()) expect(result.stderr).toBe("");
  }
});

test("freeform and flowchart whole-page exports print layout warnings", async () => {
  const reference = await exportCommand(
    fixture(textLayoutProblemDocument()).io,
    [...args, "--format", "svg"],
  );
  expect(reference.exitCode).toBe(0);
  expect(reference.stderr).toContain("warning: label-overflow");
  for (const kind of ["freeform", "flowchart"]) {
    const result = await exportCommand(
      fixture(textLayoutProblemDocument(kind)).io,
      [...args, "--format", "svg"],
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(reference.stdout);
    expect(result.stderr).toBe(reference.stderr);
  }
});

test("wide labels warn on export without changing the SVG", async () => {
  const result = await exportCommand(fixture(textLayoutWideDocument()).io, [
    ...args,
    "--format",
    "svg",
  ]);
  const reference = await exportCommand(
    fixture(textLayoutWideDocument("uml")).io,
    [...args, "--format", "svg"],
  );
  expect(result.exitCode).toBe(0);
  expect(reference.exitCode).toBe(0);
  expect(result.stderr).toContain("warning: label-overflow node-wide: ");
  expect(result.stderr).not.toContain("node-ascii");
  expect(result.stdout).toBe(reference.stdout);
});
