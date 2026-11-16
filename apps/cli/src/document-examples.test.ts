import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { validateDocument } from "@nodetto/ir";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { PDFDocument } from "pdf-lib";
import type { CommandIo } from "./commands.ts";
import { Batch } from "./edit/batch.ts";
import type { JsonObject } from "./edit/operation-input.ts";
import { exportCommand } from "./export-command.ts";
import { helpFor } from "./help.ts";
import * as raster from "./raster-backend.ts";

const root = join(import.meta.dir, "../../..");
const seed = `{"kind":"document","schemaVersion":1,"id":"document-example","title":"Document example"}
{"kind":"page","id":"p1","name":"Document","pageKind":"freeform"}
`;

for (const name of ["paper", "deck"] as const) {
  test(`${name} example applies, validates and exports`, async () => {
    const editor = new Editor({ document: parseDocument(seed) });
    const batch = new Batch(editor);
    const ops = JSON.parse(
      readFileSync(join(root, `examples/document/${name}.ops.json`), "utf8"),
    ) as JsonObject[];
    for (const [index, op] of ops.entries()) batch.apply(op, index);
    batch.dispose();
    const doc = editor.getSnapshot();
    expect(
      validateDocument(doc).filter((issue) => issue.severity === "error"),
    ).toEqual([]);
    const frames = doc.elements.filter((element) => element.type === "frame");
    if (name === "paper") {
      expect(frames).toHaveLength(2);
      expect(
        frames.every(
          (frame) =>
            (frame.semantic as { page?: { size?: string } }).page?.size ===
            "a4",
        ),
      ).toBe(true);
      expect(
        doc.elements.filter((element) => element.type === "text.code"),
      ).toHaveLength(1);
      expect(
        doc.elements.filter((element) => element.type === "text.markdown")
          .length,
      ).toBeGreaterThan(0);
      expect(
        doc.elements.filter((element) => element.type === "shape.geo").length,
      ).toBeGreaterThanOrEqual(2);
      expect(
        doc.elements.filter((element) => element.type === "edge.generic"),
      ).toHaveLength(1);
    } else {
      expect(doc.pages[0]?.pageFlow).toBe("horizontal");
      expect(frames).toHaveLength(3);
      expect(
        frames.every(
          (frame) =>
            (frame.semantic as { page?: { size?: string } }).page?.size ===
            "slide-16-9",
        ),
      ).toBe(true);
      expect(
        doc.elements.filter((element) => element.type === "text.markdown"),
      ).toHaveLength(3);
    }
    const bytes = new Map<string, Uint8Array>();
    const io: CommandIo = {
      readText: () => serializeDocument(doc),
      writeText: () => {},
      writeBytes: (path, value) => {
        bytes.set(path, value);
      },
      ensureDir: async () => {},
    };
    const pdf = await exportCommand(
      io,
      ["in.jsonl", "--format", "pdf", "--document", "--output", "out.pdf"],
      raster,
    );
    expect(pdf.exitCode).toBe(0);
    if (name === "paper")
      expect(
        (await PDFDocument.load(bytes.get("out.pdf")!)).getPageCount(),
      ).toBe(2);
    const markdown = await exportCommand(
      io,
      ["in.jsonl", "--format", "markdown", "--output", "out.md"],
      raster,
    );
    expect(markdown.exitCode).toBe(0);
  });
}

test("CLI documentation and help cover document authoring forms", () => {
  const docs = readFileSync(join(root, "docs/cli.md"), "utf8");
  expect(docs).toContain("--format markdown --document");
  expect(docs).toContain("set-page-flow");
  expect(helpFor("export")).toContain("--format markdown --document");
  expect(helpFor("edit")).toContain("set-page-flow");
});
