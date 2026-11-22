import type { PDFObject, PDFPage, PDFRef } from "pdf-lib";
import { existsSync } from "node:fs";
import {
  type PdfOptions,
  type PdfPageSpec,
  type PdfLiteral,
  type PdfLiteralDict,
  buildPdfTextLayer,
  emitPdfTextLayer,
  pdfLayout,
  rasterDimensions,
  svgRasterDimensions,
} from "@nodetto/core";

import { FALLBACK_FONT_FILES, FONT_FILES } from "./render-profile.ts";

export function fontOptions(fontDir: string | undefined, fallback: boolean) {
  const files = FONT_FILES.filter((path) => existsSync(path));
  const dirs = fontDir === undefined ? [] : [fontDir];
  if (!files.length && !dirs.length) return { loadSystemFonts: true };
  // Match on the file name, but return the family name the font declares.
  const family = (file: string, name: string, fallback: string) =>
    files.some((path) => path.includes(file)) ? name : fallback;
  const sans = family(
    "Helvetica",
    "Helvetica",
    family("DejaVuSans", "DejaVu Sans", "Arial"),
  );
  return {
    loadSystemFonts: false,
    fontFiles: [
      ...files,
      ...(fallback ? FALLBACK_FONT_FILES.filter(existsSync) : []),
    ],
    fontDirs: dirs,
    defaultFontFamily: sans,
    sansSerifFamily: sans,
    monospaceFamily: family(
      "Menlo",
      "Menlo",
      family("DejaVuSansMono", "DejaVu Sans Mono", "Consolas"),
    ),
  };
}

/** Rasterize editor-generated SVG. resvg is loaded lazily: svg export never needs it. */
export async function rasterize(
  svg: string,
  scale: number,
  fontDir: string | undefined,
  fallback = false,
): Promise<Uint8Array> {
  const viewport = svgRasterDimensions(svg);
  rasterDimensions(viewport.width, viewport.height, scale);
  const { Resvg } = await import("@resvg/resvg-js");
  const rendered = new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
    font: fontOptions(fontDir, fallback),
  }).render();
  return rendered.asPng();
}

export async function pngToPdf(
  png: Uint8Array,
  width: number,
  height: number,
  options: PdfOptions,
): Promise<Uint8Array> {
  const layout = pdfLayout(width, height, options);
  const { PDFDocument } = await import("pdf-lib");
  const document = await PDFDocument.create();
  document.setCreator("Nodetto");
  const image = await document.embedPng(png);
  document
    .addPage([layout.pageWidth, layout.pageHeight])
    .drawImage(image, layout);
  return document.save();
}

export async function pagesToPdf(
  pages: readonly { png: Uint8Array; spec: PdfPageSpec }[],
): Promise<Uint8Array> {
  if (!pages.length) throw new Error("PDF export needs at least one page.");
  const { PDFDocument, PDFName } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setCreator("Nodetto");
  const pdfPages: PDFPage[] = [];
  for (const { png, spec } of pages) {
    const image = await doc.embedPng(png);
    const page = doc.addPage([spec.layout.pageWidth, spec.layout.pageHeight]);
    page.drawImage(image, spec.layout);
    pdfPages.push(page);
  }
  const convert = (value: PdfLiteral<PDFRef>): PDFObject => {
    if (typeof value === "number") return doc.context.obj(value);
    if (Array.isArray(value)) return doc.context.obj(value.map(convert));
    if ("name" in value && typeof value.name === "string")
      return PDFName.of(value.name.replace(/^\//, ""));
    if (
      "ref" in value &&
      value.ref instanceof Object &&
      "objectNumber" in value.ref
    )
      return value.ref as PDFRef;
    const entries: Record<string, PDFObject> = {};
    for (const [key, item] of Object.entries(value))
      entries[key] = convert(item);
    return doc.context.obj(entries);
  };
  const entries = (dict: PdfLiteralDict<PDFRef>) => {
    const result: Record<string, PDFObject> = {};
    for (const [key, value] of Object.entries(dict))
      result[key] = convert(value);
    return result;
  };
  emitPdfTextLayer<PDFRef>(buildPdfTextLayer(pages.map(({ spec }) => spec)), {
    dict: (dict) => doc.context.register(doc.context.obj(entries(dict))),
    stream: (content, dict, compress) =>
      doc.context.register(
        compress
          ? doc.context.flateStream(content, entries(dict))
          : doc.context.stream(content, entries(dict)),
      ),
    setPageFont: (index, name, ref) =>
      pdfPages[index].node.setFontDictionary(PDFName.of(name), ref),
    addPageContent: (index, ref) => pdfPages[index].node.addContentStream(ref),
  });
  return doc.save({ useObjectStreams: false });
}
