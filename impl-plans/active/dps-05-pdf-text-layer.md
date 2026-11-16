# dps-05-pdf-text-layer

- planId: dps-05-pdf-text-layer. Wave 1. dependsOn: none.
- Design: sections 7.3 and 7.3.1 of
  `design-docs/specs/design-document-pages-snippets.md`, plus user-qa Q2.
- writePaths:
  - New files:
    - `packages/core/src/document-export/pdf-pages.ts`
    - `packages/core/src/document-export/pdf-emit.ts`
    - `packages/core/src/document-export/pdf-text-extract.ts`
    - `packages/core/src/document-export/text-runs.ts`
    - `packages/core/src/document-export/extractors.ts`
    - `packages/core/src/document-export/index.ts`
    - `packages/core/src/document-export/pdf-pages.test.ts`
    - `packages/core/src/document-export/pdf-emit.test.ts`
    - `packages/core/src/document-export/text-runs.test.ts`
  - Logs and artifacts: `impl-plans/progress/dps-05-pdf-text-layer.md`,
    `tmp/dps-s861/dps-05-pdf-text-layer`, `target`.
- sharedPaths: `packages/core/src/index.ts`. Append exactly one line:
  `export * from "./document-export/index.ts";`.
- artifactRoots: `target`.

## Intent and context

Snippet text in PDF must be selectable with every Unicode character
preserved, while the pages stay raster. This plan builds the
host-independent text-layer description, a generic object emitter for
pdf-lib hosts, the run collector, and a self-authored extractor used by
tests.

The text layer is written by:

- the app encoder (dps-13);
- the Bun CLI encoder and assembly (dps-14);
- the native encoder (dps-06), which consumes the same description as JSON.

## Non-goals

- No pdf-lib import here. Core does not depend on pdf-lib.
- No rasterization, snippet layouts or font embedding.

## Contract

```ts
export type PdfFontClass = "sans" | "sans-bold" | "mono";
export interface PdfTextRun { x: number; y: number; size: number; text: string; font: PdfFontClass } // px in page coordinates, baseline y
export interface PdfPageLayout { pageWidth: number; pageHeight: number; x: number; y: number; width: number; height: number } // = pdfLayout() result
export interface PdfPageSpec { width: number; height: number; layout: PdfPageLayout; textRuns: readonly PdfTextRun[] } // width/height: px of the page image source rect; runs relative to that rect
export interface PdfType3Font { name: string; firstChar: 1; lastChar: number; widths: number[]; glyphProcs: { glyph: string; content: string }[]; differences: string[]; toUnicode: string }
export interface PdfTextLayer { fonts: PdfType3Font[]; pages: { fontNames: string[]; content: string }[] }
export function buildPdfTextLayer(specs: readonly PdfPageSpec[]): PdfTextLayer;
export interface PdfObjectSink<R> { dict(entries: PdfLiteralDict<R>): R; stream(content: string, entries: PdfLiteralDict<R>, compress: boolean): R; setPageFont(pageIndex: number, name: string, ref: R): void; addPageContent(pageIndex: number, ref: R): void }
export type PdfLiteral<R> = number | { name: string } | { ref: R } | PdfLiteral<R>[] | PdfLiteralDict<R>;
export interface PdfLiteralDict<R> { [key: string]: PdfLiteral<R> }
export function emitPdfTextLayer<R>(layer: PdfTextLayer, sink: PdfObjectSink<R>): void;
export function extractPdfText(bytes: Uint8Array): Promise<{ pages: string[] }>;
export type TextRunExtractor = (element: Element, box: Box) => readonly PdfTextRun[];
export const PDF_TEXT_RUN_EXTRACTORS: Readonly<Record<string, TextRunExtractor>>; // {} here; dps-17 fills it in extractors.ts
export function collectTextRuns(store: Store, registry: ShapeUtilRegistry, pageId: PageId, rect: Box, extractors?: Readonly<Record<string, TextRunExtractor>>): PdfTextRun[];
```

Native JSON contract (dps-06 parses exactly this, `JSON.stringify` of):

```text
{ "pages": [ { "pngLength": n, "layout": PdfPageLayout, "fontNames": [...], "content": "..." } ], "fonts": PdfType3Font[] }
```

Export a helper `nativePdfSpec(layer, pages: { pngLength: number; layout: PdfPageLayout }[]): string`
that produces it.

## Rules (design 7.3.1)

- Code assignment:
  - Iterate runs page by page, run by run, with `for (const ch of text)`.
  - Assign per class in order of first appearance, codes 1..255. The 256th
    distinct code point of a class opens the next font of that class.
  - Names are `NTs<n>`, `NTb<n>` and `NTm<n>` (n from 1).
- Widths are in 1000/em:
  - mono: 600, or 1200 for a wide code point (`isWideCodePoint`).
  - sans and sans-bold: the `LIBERATION_SANS_ADVANCES` regular or bold
    advance times `1000 / unitsPerEm` for code points 0x20..0xff, 1000 for
    wide code points, and `AVERAGE_GLYPH_WIDTH * 1000` otherwise. The tab
    uses the space advance.
  - Round to integers.
- Glyph names are `g<code>`. Each glyph proc content is `<width> 0 d0`.
  `differences` is `[1, "/g1", ...]` represented as names.
- ToUnicode text:

  ```text
  /CIDInit /ProcSet findresource begin
  12 dict begin
  begincmap
  /CMapName /Nodetto-<name> def
  /CMapType 2 def
  1 begincodespacerange <01> <FF> endcodespacerange
  ...
  endcmap
  CMapName currentdict /CMap defineresource pop
  end
  end
  ```

  - `beginbfchar` blocks hold at most 100 entries.
  - A destination is the UTF-16BE uppercase hex of the code point. A
    supplementary code point is a surrogate pair, for example
    `<D842DFB7>`.
- Page content:
  - The whole content is `q BT 3 Tr ... ET Q`.
  - For each run: `/<font> <size_pt> Tf 1 0 0 1 <x_pt> <y_pt> Tm <hex> Tj`,
    where `<hex>` is `<0A1B...>`.
  - Split the run into consecutive `Tf`/`Tj` pairs where the font changes.
  - Map coordinates with
    `x_pt = layout.x + run.x * layout.width / spec.width` and
    `y_pt = layout.pageHeight - (layout.y + run.y * layout.height / spec.height)`.
    The size is scaled the same way through the height ratio.
  - Format numbers with at most 3 decimals and no exponent.
- `emitPdfTextLayer`:
  - Each font becomes a `Type3` dict: `FontMatrix [0.001 0 0 0.001 0 0]`,
    `FontBBox [0 0 0 0]`, `FirstChar`, `LastChar`, `Widths`, `Encoding`
    (dict with `Type /Encoding` and `Differences`), `CharProcs` (a dict of
    refs to the glyph-proc streams, uncompressed) and `ToUnicode` (a ref to
    the CMap stream, uncompressed).
  - Each page gets `setPageFont` for each of its fonts and one compressed
    content stream through `addPageContent`.
  - A page with no runs gets nothing.
- `collectTextRuns`:
  - For each page element in z-order whose type has an extractor, that is
    not hidden (`context.isHidden`) and whose bounds intersect `rect`, call
    the extractor with its box.
  - Keep runs whose baseline point lies inside `rect`, translated by
    `-rect.x` and `-rect.y`.
- `extractPdfText`. It is self-authored and handles only this repository's
  output.
  - Parse `N G obj ... endobj` objects and their streams.
  - Inflate `/FlateDecode` with `DecompressionStream("deflate")`. Do not
    import `node:zlib`; the module is in the app bundle.
  - Read `/Type3` fonts and their ToUnicode `bfchar` maps.
  - Walk `/Pages` kids in order. For each page's content streams, decode
    `Tf`/`Tj` hex strings through the maps.
  - Join a page's runs with `\n` between `BT` blocks and no separator
    within a run.
  - Unsupported structures throw `Error("unsupported PDF structure: ...")`.
    Object streams are unsupported, so hosts save with
    `useObjectStreams:false`.

## Pitfalls

- Never drop or substitute characters. A combining mark or a ZWJ is its
  own code point.
- Determinism: the same specs give a byte-identical layer.
- Escape nothing in hex strings; the content is ASCII only.

## Tests (input -> expected)

- Runs `"const label = \"日本語\";"` (mono) and `"Ünïcode 太字 😀 𠮷"`
  (sans) give fonts NTm1 and NTs1. The ToUnicode for 𠮷 contains
  `<D842DFB7>`. The widths of 日 in mono are 1200.
- 300 distinct code points of one class give 2 fonts, with lastChar 255
  and 45.
- A bfchar block never has more than 100 entries.
- Two calls with the same input give deeply equal results.
- Emitting through a recording fake sink gives 1 dict per font. Each page
  gets its fonts, and a page with no runs gets no content.
- `extractPdfText` round trip: a minimal PDF hand-assembled in the test
  from `emitPdfTextLayer` output through a tiny in-test serializer
  (uncompressed objects plus one deflated content stream made with
  `CompressionStream`) extracts exactly the original run texts.
- `collectTextRuns` with a fake extractor for `text.note`:
  - an element inside the rect yields translated runs;
  - an element outside yields none;
  - a hidden element yields none.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-05-pdf-text-layer/)

1. `bun test packages/core/src/document-export`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn packages/core/src/document-export`

## Done criteria

- The contract is exported from `@nodetto/core`, with
  `PDF_TEXT_RUN_EXTRACTORS` empty.
- All three commands exit 0.
- The progress log records the commands, exit codes, log paths and the
  index.ts hashes.

## Coordination

Same rules as dps-01. No git state changes.
