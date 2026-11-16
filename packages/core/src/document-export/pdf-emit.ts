import type { PdfTextLayer } from "./pdf-pages.ts";
export type PdfLiteral<R> =
  | number
  | { name: string }
  | { ref: R }
  | PdfLiteral<R>[]
  | PdfLiteralDict<R>;
export interface PdfLiteralDict<R> {
  [key: string]: PdfLiteral<R>;
}
export interface PdfObjectSink<R> {
  dict(entries: PdfLiteralDict<R>): R;
  stream(content: string, entries: PdfLiteralDict<R>, compress: boolean): R;
  setPageFont(pageIndex: number, name: string, ref: R): void;
  addPageContent(pageIndex: number, ref: R): void;
}
export function emitPdfTextLayer<R>(
  layer: PdfTextLayer,
  sink: PdfObjectSink<R>,
): void {
  const fonts = new Map<string, R>();
  for (const font of layer.fonts) {
    const procs: PdfLiteralDict<R> = {};
    for (const proc of font.glyphProcs)
      procs[proc.glyph] = { ref: sink.stream(proc.content, {}, false) };
    const cmap = sink.stream(font.toUnicode, {}, false);
    const ref = sink.dict({
      Type: { name: "Font" },
      Subtype: { name: "Type3" },
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      FontBBox: [0, 0, 0, 0],
      FirstChar: font.firstChar,
      LastChar: font.lastChar,
      Widths: font.widths,
      Encoding: {
        Type: { name: "Encoding" },
        Differences: [1, ...font.differences.map((name) => ({ name }))],
      },
      CharProcs: procs,
      ToUnicode: { ref: cmap },
    });
    fonts.set(font.name, ref);
  }
  layer.pages.forEach((page, i) => {
    if (!page.content) return;
    for (const name of page.fontNames) {
      const ref = fonts.get(name);
      if (ref === undefined) throw new Error(`Unknown PDF font ${name}`);
      sink.setPageFont(i, name, ref);
    }
    sink.addPageContent(i, sink.stream(page.content, {}, true));
  });
}
