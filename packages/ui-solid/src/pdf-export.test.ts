import { expect, test } from "bun:test";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { pdfLayout, pngToPdf } from "./pdf-export.ts";

const options = {
  pageSize: "artwork",
  orientation: "portrait",
  marginMm: 10,
} as const;
const png = new Blob(
  [
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=",
      "base64",
    ),
  ],
  { type: "image/png" },
);

test("PDF fits artwork at physical CSS size independent of raster density", async () => {
  const blob = await pngToPdf(png, 800, 400, options);
  expect(blob.type).toBe("application/pdf");
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  expect(doc.getPageCount()).toBe(1);
  expect(doc.getPage(0).getSize()).toEqual({ width: 600, height: 300 });
  const images = doc
    .getPage(0)
    .node.Resources()
    ?.lookup(PDFName.of("XObject"), PDFDict);
  expect(images?.keys().length).toBe(1);
});

test("paper PDF respects orientation, margins and aspect ratio without cropping", () => {
  for (const pageSize of ["a4", "letter"] as const) {
    const box = pdfLayout(1600, 400, {
      pageSize,
      orientation: "landscape",
      marginMm: 15,
    });
    expect(box.pageWidth).toBeGreaterThan(box.pageHeight);
    expect(box.width / box.height).toBeCloseTo(4);
    expect(box.x).toBeCloseTo((15 * 72) / 25.4);
    expect(box.y).toBeGreaterThan((15 * 72) / 25.4);
    expect(box.x + box.width).toBeLessThan(box.pageWidth);
  }
});

test("invalid PDF geometry and cancelled operations fail without producing a document", async () => {
  for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    expect(() => pdfLayout(width, 100, options)).toThrow();
  expect(() => pdfLayout(20000, 100, options)).toThrow("too large");
  expect(() => pdfLayout(100, 100, { ...options, marginMm: 51 })).toThrow(
    "margins",
  );
  const abort = new AbortController();
  abort.abort();
  await expect(pngToPdf(png, 100, 100, options, abort.signal)).rejects.toThrow(
    "cancelled",
  );
});

test("multi-page PDF preserves page sizes and exact Unicode text", async () => {
  const { extractPdfText } = await import("@nodetto/core");
  const { pagesToPdf } = await import("./pdf-export.ts");
  const first = 'const label = "日本語"; // 𠮷 é\tend';
  const second = "# Ünïcode 太字 😀";
  const spec = (
    width: number,
    height: number,
    textRuns: import("@nodetto/core").PdfTextRun[],
  ) => ({
    width,
    height,
    layout: pdfLayout(width, height, options),
    textRuns,
  });
  const blob = await pagesToPdf([
    {
      png,
      spec: spec(800, 400, [
        { x: 10, y: 20, size: 12, text: first, font: "mono" },
      ]),
    },
    {
      png,
      spec: spec(400, 800, [
        { x: 10, y: 20, size: 12, text: second, font: "sans" },
        { x: 10, y: 40, size: 12, text: second, font: "sans-bold" },
      ]),
    },
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  expect((await extractPdfText(bytes)).pages).toEqual([
    first,
    `${second}\n${second}`,
  ]);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPages().map((page) => page.getSize())).toEqual([
    { width: 600, height: 300 },
    { width: 300, height: 600 },
  ]);
  await expect(pagesToPdf([])).rejects.toThrow("at least one page");
});

test("single-page PDF optionally includes selectable text", async () => {
  const { extractPdfText } = await import("@nodetto/core");
  const run = {
    x: 1,
    y: 2,
    size: 12,
    text: "日本語\t𠮷",
    font: "mono",
  } as const;
  const withText = await pngToPdf(png, 100, 100, options, undefined, [run]);
  const withoutText = await pngToPdf(png, 100, 100, options);
  expect(
    (await extractPdfText(new Uint8Array(await withText.arrayBuffer()))).pages,
  ).toEqual([run.text]);
  expect(
    (await extractPdfText(new Uint8Array(await withoutText.arrayBuffer())))
      .pages,
  ).toEqual([""]);
});
