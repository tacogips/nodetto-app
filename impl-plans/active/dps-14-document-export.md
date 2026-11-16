# dps-14-document-export

- planId: dps-14-document-export. Wave 2.
- dependsOn: dps-03-model, dps-04-page-geometry, dps-05-pdf-text-layer,
  dps-06-pdf-native.
- Design: sections 7.1 to 7.4 of
  `design-docs/specs/design-document-pages-snippets.md`, plus user-qa Q3
  and Q7.
- writePaths:
  - New core files:
    - `packages/core/src/document-export/markdown.ts`
    - `packages/core/src/document-export/markdown.test.ts`
    - `packages/core/src/document-export/pdf-document.ts`
    - `packages/core/src/document-export/pdf-document.test.ts`
  - Existing CLI files: `apps/cli/src/export-command.ts`,
    `apps/cli/src/raster-backend.ts`, `apps/cli/src/native-engine.ts`.
  - New CLI test: `apps/cli/src/export-document.test.ts`.
  - Logs and artifacts: `impl-plans/progress/dps-14-document-export.md`,
    `tmp/dps-s861/dps-14-document-export`, `target`.
- sharedPaths: `packages/core/src/document-export/index.ts`, created by
  dps-05. Append exactly `export * from "./markdown.ts";` and
  `export * from "./pdf-document.ts";`.
- artifactRoots: `target`.

## Intent and context

This plan covers document export in core and in the CLI:

- the Markdown document with its group SVG assets;
- the multi-page PDF plan;
- `nodetto-cli export --format pdf --document` and `--format markdown`;
- the Bun and native `pagesToPdf` encoders.

dps-17 fills `PDF_TEXT_RUN_EXTRACTORS` and wires the app dialog. This plan
already passes that constant at every call site, so snippet text appears
once dps-17 lands.

## Non-goals

- No app or desktop UI.
- No changes to `help.ts` or `docs/cli.md` (dps-17).
- No change to existing single-format semantics apart from adding the
  text layer to CLI PDF.

## Contract

```ts
export interface MarkdownDocumentExport { markdown: string; assets: { name: string; svg: string }[] }
export function exportMarkdownDocument(editor: Editor, options: { assetDir: string; embed?: boolean; resolveAsset?: (source: string) => string }): MarkdownDocumentExport;
export interface DocumentPdfPagePlan { ref: DocumentPageRef; svg: string; spec: PdfPageSpec }
export const MAX_DOCUMENT_PDF_PAGES = 500;
export function documentPdfPlan(editor: Editor, options: { background: string | null; extractors?: Readonly<Record<string, TextRunExtractor>> }): DocumentPdfPagePlan[]; // throws on 0 or >500 refs
// apps/cli/src/export-command.ts RasterBackend gains:
pagesToPdf?(pages: readonly { png: Uint8Array; spec: PdfPageSpec }[]): Promise<Uint8Array>;
```

## Rules

- Markdown (design 7.2, revised):
  - The refs come from `documentPageSequence`.
  - Members come from `frameParents` and `expandContainers`
    (`packages/core/src/frame-tree.ts`):
    - (a) elements whose parent entry is the ref's frame `F`;
    - (b) elements with no parent entry whose bounds centre lies in
      `rect`;
    - without a frame, every top-level element is a candidate.
  - Remove `F` itself and every page frame. Remove hidden elements
    (`context.isHidden`) and mask sources (`isMaskSource`).
  - Collect into a `Set`, then drop any candidate inside another
    candidate's `expandContainers` expansion.
  - Sort by `(top, left, id)`.
  - Emission:
    - `text.markdown` is emitted verbatim, with trailing newlines trimmed.
    - `text.code` becomes a backtick fence of length
      `max(3, longest run + 1)`, with info = language, or empty when
      `plain`.
    - Each maximal run of other members becomes one asset:
      `renderSelectionSvg(store, registry, pageId, new Set(ids), { padding: 16, background: null, resolveAsset })`.
      - Name `page-<refIndex+1>-<groupIndex+1>.svg`.
      - Reference `![Diagram page-R-G](<assetDir>/page-R-G.svg)`.
      - With `embed`, the reference is
        `data:image/svg+xml;base64,<base64 of UTF-8>` and `assets` stays
        empty.
  - A null SVG (nothing drawable) is skipped without consuming a group
    number.
  - Blocks are joined by `\n\n`, and the output ends with exactly one `\n`.
  - For base64, reuse an existing core helper if
    `rg -n "base64" packages/core/src/compare-images.ts packages/core/src/shapes/index.ts`
    shows a pure one. Otherwise write a small pure encoder. Do not use
    `Buffer` or `btoa`, because Boa lacks them.
- PDF plan:
  - For each ref:
    - `svg = editor.exportPageSvgOf(ref.pageId, { viewport: ref.rect, background })`;
    - `layout = pdfLayout(rect.width, rect.height, { pageSize: "artwork", orientation: "portrait", marginMm: 0 })`;
    - `textRuns = collectTextRuns(store, registry, pageId, rect, extractors ?? PDF_TEXT_RUN_EXTRACTORS)`.
  - Throw `Error("Document has N pages; PDF export supports at most 500.")`
    above the limit, and `Error("Document has nothing to export.")` for 0.
- CLI:
  - Add `"markdown"` to `EXPORT_FORMATS` and the boolean flag `--document`.
    Check how `parseArgs` handles boolean flags in `commands.ts`, and
    follow it.
  - `--document`:
    - only with `--format pdf`;
    - conflicts with `--page`, `--element`, `--frames`, `--pdf-page`,
      `--orientation` and `--margin`; each conflict is a one-line error with
      the existing usage exit code (2);
    - requires `--output`;
    - flow: rasterize each plan SVG at the PDF scale (default 2), then
      `renderer.pagesToPdf`, then write atomically, then the `Wrote ...`
      stderr summary with the page count.
  - `--format markdown`:
    - requires `--output` ending in `.md`;
    - writes the Markdown atomically;
    - when there are assets, creates `<dir>/<stem>.assets/` (imitate the
      `--output-dir` handling at `export-command.ts:309`) and writes each
      SVG atomically;
    - stale files are left alone.
  - The existing single-page PDF path uses `renderer.pagesToPdf` when
    present, with one page whose `textRuns` come from `collectTextRuns`
    over the exported SVG's viewBox (`svgViewBox`), and the existing
    layout. Otherwise it falls back to `pngToPdf`.
- Bun `raster-backend.ts`: `pagesToPdf` uses the same pdf-lib sink approach
  as dps-13 (`emitPdfTextLayer`, `useObjectStreams:false`). Wire it into
  the default backend object that `export-command.ts` uses.
- `native-engine.ts`:
  - declare `native.pdfPages(pngs: Uint8Array, spec: string): Uint8Array`;
  - implement `pagesToPdf` by concatenating the PNGs and passing
    `nativePdfSpec(buildPdfTextLayer(specs), pages)` (dps-05).

## Pitfalls

- SVG and Markdown bytes must be identical for the same document across
  app and CLI. Only use functions that take the document state.
- Never include the page frame as its own member.
- Keep existing CLI output for every existing flag combination. The test
  fakes without `pagesToPdf` must still pass.

## Tests (input -> expected)

- Markdown:
  - A page frame containing only one Markdown and one code snippet gives
    both texts once and zero assets.
  - A mixed page (Markdown, then 2 shapes and a connector, then code)
    gives one asset whose SVG contains the shapes and neither the snippet
    text nor the frame rect.
  - A group member gives one asset, with no duplicated child.
  - Two pages in tab order keep their order.
  - Code containing a run of 3 backticks gives a 4-backtick fence.
  - `embed` gives a data URI and empty assets.
  - The output is deterministic.
  - The existing `renderSelectionSvg` single-frame test still passes.
- PDF plan:
  - 3 refs give 3 plans with layouts sized `rect * 0.75`.
  - 501 frames throw the limit error.
  - A fake extractor's runs appear in the specs.
- CLI (`export-document.test.ts`, Bun backend):
  - `--document --page p1` exits 2 with the conflict message.
  - `--format markdown --output out.md` writes `out.md` and
    `out.assets/page-1-1.svg` in a temp dir.
  - `--format pdf --document` on a 2-frame fixture writes a PDF whose
    `extractPdfText` page count is 2.
  - The existing export tests are unchanged and passing.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-14-document-export/)

1. `bun test packages/core/src/document-export apps/cli/src/export-document.test.ts apps/cli/src/export-command.test.ts`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn packages/core/src/document-export/markdown.ts packages/core/src/document-export/markdown.test.ts packages/core/src/document-export/pdf-document.ts packages/core/src/document-export/pdf-document.test.ts apps/cli/src/export-command.ts apps/cli/src/raster-backend.ts apps/cli/src/native-engine.ts apps/cli/src/export-document.test.ts`

## Done criteria

- Both formats work in the Bun CLI.
- The native binding is declared.
- All three commands exit 0.
- The progress log records the commands, exit codes, log paths and the
  hashes of shared files.

## Coordination

Re-read each file before editing and record hashes. No git state changes.
