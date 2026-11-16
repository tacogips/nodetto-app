import {
  buildPdfTextLayer,
  emitPdfTextLayer,
  type PdfLiteral,
  type PdfLiteralDict,
  type PdfOptions,
  type PdfPageSpec,
  type PdfTextRun,
  pdfLayout,
} from "@nodetto/core";
import type { PDFObject, PDFPage, PDFRef } from "pdf-lib";

export {
  PDF_PAGE_SIZES,
  type PdfOptions,
  type PdfOrientation,
  type PdfPageSize,
  pdfLayout,
} from "@nodetto/core";

export interface PdfPageImage {
  png: Blob;
  spec: PdfPageSpec;
}

export async function pagesToPdf(
  pages: readonly PdfPageImage[],
  signal?: AbortSignal,
): Promise<Blob> {
  const check = () => {
    if (signal?.aborted) throw new Error("PDF export cancelled.");
  };
  check();
  if (!pages.length) throw new Error("PDF export needs at least one page.");
  const { PDFDocument, PDFName } = await import("pdf-lib");
  check();
  const doc = await PDFDocument.create();
  check();
  doc.setCreator("Nodetto");
  const pdfPages: PDFPage[] = [];
  for (const { png, spec } of pages) {
    const bytes = await png.arrayBuffer();
    check();
    const image = await doc.embedPng(bytes);
    check();
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
  check();
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
  check();
  const result = await doc.save({ useObjectStreams: false });
  check();
  return new Blob([result], { type: "application/pdf" });
}

/** Embed the rendered artwork so every font and paint matches PNG export. */
export async function pngToPdf(
  png: Blob,
  width: number,
  height: number,
  options: PdfOptions,
  signal?: AbortSignal,
  textRuns?: readonly PdfTextRun[],
): Promise<Blob> {
  if (signal?.aborted) throw new Error("PDF export cancelled.");
  return pagesToPdf(
    [
      {
        png,
        spec: {
          width,
          height,
          layout: pdfLayout(width, height, options),
          textRuns: textRuns ?? [],
        },
      },
    ],
    signal,
  );
}
