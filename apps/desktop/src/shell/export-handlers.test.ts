import { expect, test } from "bun:test";
import { Editor, extractPdfText } from "@nodetto/core";
import type { ExportBackend } from "../file/backend.ts";
import { createExportHandlers } from "./export-handlers.ts";

const png = new Blob(
  [
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=",
      "base64",
    ),
  ],
  { type: "image/png" },
);

function fixture(
  rasterizeSvg: (svg: string, scale: number) => Promise<Blob> = async () => png,
) {
  const editor = new Editor();
  editor.loadDocument({ ...editor.getSnapshot(), title: "Paper" });
  for (const x of [0, 300]) {
    editor.createElement("frame", {
      semantic: { name: "Page", page: { size: "a4", orientation: "portrait" } },
      visual: { x, y: 0, width: 200, height: 250 },
    });
  }
  editor.createElement("text.code", {
    semantic: { code: "const answer = 42;", language: "javascript" },
    visual: { x: 20, y: 30, width: 150, height: 60 },
  });
  editor.createElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: { x: 320, y: 30, width: 100, height: 80 },
  });
  const picked: [string, string][] = [];
  const writes: { path: string; bytes: Uint8Array }[] = [];
  const errors: (string | null)[] = [];
  const backend: ExportBackend = {
    available: true,
    pickExportPath: async (name, extension) => {
      picked.push([name, extension]);
      return `/out/${name}`;
    },
    writeBytes: async (path, bytes) => {
      writes.push({ path, bytes });
    },
    writeText: async () => {
      throw new Error("unexpected writeText");
    },
  };
  return {
    picked,
    writes,
    errors,
    handlers: createExportHandlers(
      { editor, exportBackend: backend },
      (message) => errors.push(message),
      { rasterizeSvg },
    ),
  };
}

test("document PDF writes two pages with extractable snippet text", async () => {
  const { handlers, picked, writes, errors } = fixture();
  await handlers.exportDocumentPdf(1, "#ffffff");
  expect(picked).toEqual([["Paper.pdf", "pdf"]]);
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toBe("/out/Paper.pdf");
  expect(new TextDecoder().decode(writes[0].bytes.slice(0, 5))).toBe("%PDF-");
  const text = await extractPdfText(writes[0].bytes);
  expect(text.pages).toHaveLength(2);
  expect(text.pages.join("\n")).toContain("const answer = 42;");
  expect(errors.at(-1)).toBeNull();
});

test("document Markdown writes a ZIP with Markdown and SVG asset", async () => {
  const { handlers, picked, writes, errors } = fixture();
  await handlers.exportDocumentMarkdown();
  expect(picked).toEqual([["Paper.zip", "zip"]]);
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toBe("/out/Paper.zip");
  const zip = new TextDecoder().decode(writes[0].bytes);
  expect(zip).toContain("Paper.md");
  expect(zip).toMatch(/Paper\.assets\/[a-zA-Z0-9_.-]+\.svg/);
  expect(errors.at(-1)).toBeNull();
});

test("document PDF reports rasterizer failures without writing", async () => {
  const { handlers, writes, errors } = fixture(async () => {
    throw new Error("boom");
  });
  await handlers.exportDocumentPdf(1, "#ffffff");
  expect(writes).toEqual([]);
  expect(errors.at(-1)).toBe("could not export: boom");
});
