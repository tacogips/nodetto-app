import { expect, test } from "bun:test";
import {
  emitPdfTextLayer,
  type PdfLiteral,
  type PdfLiteralDict,
  type PdfObjectSink,
} from "./pdf-emit.ts";
import { buildPdfTextLayer } from "./pdf-pages.ts";
import { extractPdfText } from "./pdf-text-extract.ts";
const layout = {
  pageWidth: 100,
  pageHeight: 100,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
};
test("emits objects and extracts compressed Unicode content", async () => {
  const texts = [
    "ASCII 日本語 😀 𠮷",
    Array.from({ length: 300 }, (_, i) => String.fromCodePoint(0x400 + i)).join(
      "",
    ),
  ];
  const layer = buildPdfTextLayer([
    {
      width: 100,
      height: 100,
      layout,
      textRuns: texts.map((text, i) => ({
        x: 1,
        y: i * 20,
        size: 12,
        font: "sans" as const,
        text,
      })),
    },
    { width: 100, height: 100, layout, textRuns: [] },
  ]);
  const entries: {
    dict?: PdfLiteralDict<number>;
    content?: string;
    compress?: boolean;
  }[] = [];
  const fonts = new Map<string, number>();
  const content: number[] = [];
  const sink: PdfObjectSink<number> = {
    dict: (dict) => {
      entries.push({ dict });
      return entries.length;
    },
    stream: (value, dict, compress) => {
      entries.push({ dict, content: value, compress });
      return entries.length;
    },
    setPageFont: (page, name, ref) => {
      expect(page).toBe(0);
      fonts.set(name, ref);
    },
    addPageContent: (page, ref) => {
      expect(page).toBe(0);
      content.push(ref);
    },
  };
  emitPdfTextLayer(layer, sink);
  expect(entries.filter((e) => e.dict?.Subtype && !e.content)).toHaveLength(
    layer.fonts.length,
  );
  expect(content).toHaveLength(1);
  const literal = (v: PdfLiteral<number>): string =>
    typeof v === "number"
      ? String(v)
      : Array.isArray(v)
        ? `[${v.map(literal).join(" ")}]`
        : "name" in v && typeof v.name === "string"
          ? `/${v.name}`
          : "ref" in v && typeof v.ref === "number"
            ? `${v.ref} 0 R`
            : `<< ${Object.entries(v)
                .map(([k, val]) => `/${k} ${literal(val)}`)
                .join(" ")} >>`;
  const parts: Uint8Array[] = [];
  const enc = new TextEncoder();
  const add = (s: string) => parts.push(enc.encode(s));
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    add(`${i + 1} 0 obj\n`);
    if (e.content !== undefined) {
      let data = enc.encode(e.content);
      if (e.compress)
        data = new Uint8Array(
          await new Response(
            new Blob([data])
              .stream()
              .pipeThrough(new CompressionStream("deflate")),
          ).arrayBuffer(),
        );
      add(
        `<< /Length ${data.length}${e.compress ? " /Filter /FlateDecode" : ""} >>\nstream\n`,
      );
      parts.push(data);
      add("\nendstream\nendobj\n");
    } else add(`${literal(e.dict ?? {})}\nendobj\n`);
  }
  const page = entries.length + 1;
  const tree = page + 1;
  const catalog = tree + 1;
  add(
    `${page} 0 obj << /Type /Page /Resources << /Font << ${[...fonts].map(([n, r]) => `/${n} ${r} 0 R`).join(" ")} >> >> /Contents ${content[0]} 0 R >> endobj\n${tree} 0 obj << /Type /Pages /Kids [${page} 0 R] >> endobj\n${catalog} 0 obj << /Type /Catalog /Pages ${tree} 0 R >> endobj\n`,
  );
  const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  expect(await extractPdfText(bytes)).toEqual({ pages: [texts.join("\n")] });
});
