# dps-13-pdf-app-encoder

- planId: dps-13-pdf-app-encoder. Wave 2.
- dependsOn: dps-05-pdf-text-layer.
- Design: sections 7.3 and 7.3.1 of
  `design-docs/specs/design-document-pages-snippets.md`.
- writePaths: `packages/ui-solid/src/pdf-export.ts`,
  `packages/ui-solid/src/pdf-export.test.ts`,
  `impl-plans/progress/dps-13-pdf-app-encoder.md`,
  `tmp/dps-s861/dps-13-pdf-app-encoder`, `target`.
- sharedPaths: none.
- artifactRoots: `target`.

## Intent and context

The app PDF encoder, `pngToPdf` (pdf-lib, one raster page), gains
multi-page output and the Unicode text layer. dps-17 calls it from the
Export dialog and the inspector asset export.

## Non-goals

- No call-site changes in `AssetExportSection.tsx`, `ExportDialog.tsx` or
  apps/desktop. Those belong to dps-17.
- No new dependency.

## Contract

```ts
export interface PdfPageImage { png: Blob; spec: PdfPageSpec } // spec from @nodetto/core (dps-05)
export async function pagesToPdf(pages: readonly PdfPageImage[], signal?: AbortSignal): Promise<Blob>;
export async function pngToPdf(png: Blob, width: number, height: number, options: PdfOptions, signal?: AbortSignal, textRuns?: readonly PdfTextRun[]): Promise<Blob>; // existing args unchanged; new optional textRuns
```

## Rules

- `pagesToPdf`:
  1. `PDFDocument.create()` and `setCreator("Nodetto")`.
  2. For each page, embed the PNG, then
     `addPage([layout.pageWidth, layout.pageHeight]).drawImage(image, layout)`.
     This is the same code as today.
  3. `const layer = buildPdfTextLayer(specs)`.
  4. `emitPdfTextLayer(layer, sink)`, where the sink uses:
     - `doc.context.obj` with converted literals: `{name}` becomes
       `PDFName.of`, `{ref}` becomes the ref, arrays and dicts recurse,
       numbers stay;
     - `doc.context.register`;
     - `doc.context.stream` or `flateStream`, by the `compress` flag;
     - `page.node.setFontDictionary(PDFName.of(name), ref)`;
     - `page.node.addContentStream(ref)`.

     These APIs are confirmed in pdf-lib 1.17.1 (`cjs/core/PDFContext.d.ts:42,73-76`,
     `cjs/core/structures/PDFPageLeaf.d.ts:30,34`).
  5. `doc.save({ useObjectStreams: false })`.
  - Check `signal` between steps, as today.
- `pngToPdf` delegates to `pagesToPdf` with one page. Its spec is
  `{ width, height, layout: pdfLayout(width, height, options), textRuns: textRuns ?? [] }`.
  Existing callers behave the same, apart from the `useObjectStreams`
  change.
- Zero pages throws `Error("PDF export needs at least one page.")`.

## Pitfalls

- `PDFName.of` takes names without the slash. Strip a leading `/` if the
  differences entries carry it.
- Do not compress the ToUnicode or CharProcs streams; the `compress` flag
  from the emitter decides.
- Keep the abort behaviour from the existing test.

## Tests (bun:test, synthetic 1x1 PNG Blobs as in the existing test)

- Existing tests still pass: MediaBox, and abort rejects.
- `pagesToPdf` with 2 pages of different sizes gives
  `extractPdfText` (dps-05) page count 2, and each MediaBox matches its
  layout.
- Exact Unicode: runs `const label = "日本語"; // 𠮷 é\tend` (mono) and
  `# Ünïcode 太字 😀` (sans and sans-bold) extract exactly those strings,
  in order.
- `pngToPdf` with `textRuns` extracts the run text. Without runs it
  extracts empty text and keeps the image XObject.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-13-pdf-app-encoder/)

1. `bun test packages/ui-solid/src/pdf-export.test.ts`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn packages/ui-solid/src/pdf-export.ts packages/ui-solid/src/pdf-export.test.ts`

## Done criteria

- `pagesToPdf` exists and the exact-text test passes.
- All three commands exit 0.
- The progress log records the commands, exit codes and log paths.

## Coordination

Edit only your writePaths. Re-read before each edit and record hashes. No
git state changes.

## Implementation status

The encoder and host-level tests are implemented. All three required checks pass
on the current shared tree; see `impl-plans/progress/dps-13-pdf-app-encoder.md`.
Formal review and stable-tree integration verification remain downstream.
