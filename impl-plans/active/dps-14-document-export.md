# dps-14-document-export

- planId: dps-14-document-export. Session 863 wave 1, run in parallel with
  dps-15. Revised 2026-11-16 for the owner decision IR-DPS14-HOST-MKDIR and
  the review finding DR-DPS14-MARKDOWN-DOCUMENT.
- dependsOn (this run): none. Accepted and committed at e8fd3c4:
  dps-03-model, dps-04-page-geometry, dps-05-pdf-text-layer,
  dps-06-pdf-native, dps-13-pdf-app-encoder.
- Design: sections 7.1 to 7.4, 10.1 and 11 of
  `design-docs/specs/design-document-pages-snippets.md`, plus user-qa Q3
  and Q7.
- writePaths:
  - core: `packages/core/src/document-export/markdown.ts`,
    `markdown.test.ts`, `pdf-document.ts`, `pdf-document.test.ts`,
    `packages/core/src/document-export/index.ts` (append two lines only).
  - CLI: `apps/cli/src/export-command.ts`, `apps/cli/src/raster-backend.ts`,
    `apps/cli/src/native-engine.ts`, `apps/cli/src/export-document.test.ts`
    (new), `apps/cli/src/commands.ts` (the `CommandIo.ensureDir?` member
    only), `apps/cli/src/local-io.ts`, `apps/cli/src/local-io.test.ts` (new).
  - native: `apps/cli/native/src/engine.rs`,
    `apps/cli/native/src/engine_tests.rs`.
  - Logs and artifacts: `impl-plans/progress/dps-14-document-export.md`,
    `tmp/dps-s863/dps-14-document-export`, `target` (artifact root).
- sharedPaths: none.

## Intent and context

Nothing of this plan exists in the tree yet (`markdown.ts` and
`pdf-document.ts` are absent; the CLI has no `--document` or `markdown`).
Deliver the core Markdown document export and multi-page PDF plan, the CLI
`export --document` (pdf and markdown) and `--format markdown`, the Bun and
native `pagesToPdf`, and the new host function `CommandIo.ensureDir`.

Existing contracts to consume (do not edit them):

- `documentPageSequence(store, registry)` and `DocumentPageRef` in
  `packages/core/src/page-frames/sequence.ts` (the design names
  `document-export/sequence.ts`; the real file is in `page-frames/`).
- `collectTextRuns(store, registry, pageId, rect, extractors?)` in
  `document-export/text-runs.ts`; `PDF_TEXT_RUN_EXTRACTORS` in
  `extractors.ts` is `{}` until dps-17 fills it.
- `buildPdfTextLayer`, `nativePdfSpec(layer, pages)`, `PdfPageSpec` in
  `document-export/pdf-pages.ts`; `emitPdfTextLayer` in `pdf-emit.ts`;
  async `extractPdfText(bytes): Promise<{ pages: string[] }>` in
  `pdf-text-extract.ts` (tests only).
- `renderSelectionSvg` in `packages/core/src/svg-export/document.ts:746`;
  `frameParents`, `expandContainers` in `packages/core/src/frame-tree.ts`.
- App encoder to imitate for pdf-lib: `packages/ui-solid/src/pdf-export.ts:pagesToPdf`.
- Native host `pdfPages(pngs, specJson)` already exists
  (`engine.rs` "pdfPages" arm, name list at engine.rs:235).

## Non-goals

- No app or desktop UI, no `help.ts`, no `docs/*` (dps-17).
- No registry change: `text.code`/`text.markdown` are not in IR
  `DEFINITIONS` until dps-17. Tests must not need them (see Pitfalls).
- No new dependency, no Command kind, no change to existing single-format
  output except adding the text layer to CLI PDF.

## Contract

```ts
export interface MarkdownDocumentExport { markdown: string; assets: { name: string; svg: string }[] }
export function exportMarkdownDocument(editor: Editor, options: { assetDir: string; embed?: boolean; resolveAsset?: (source: string) => string }): MarkdownDocumentExport;
export interface DocumentPdfPagePlan { ref: DocumentPageRef; svg: string; spec: PdfPageSpec }
export const MAX_DOCUMENT_PDF_PAGES = 500;
export function documentPdfPlan(editor: Editor, options: { background: string | null; extractors?: Readonly<Record<string, TextRunExtractor>> }): DocumentPdfPagePlan[];
// RasterBackend (export-command.ts:101) gains:
pagesToPdf?(pages: readonly { png: Uint8Array; spec: PdfPageSpec }[]): Promise<Uint8Array>;
// CommandIo (commands.ts:89) gains:
ensureDir?(path: string): Promise<void>;
```

`exportMarkdownDocument`, `documentPdfPlan` and `MAX_DOCUMENT_PDF_PAGES` are
consumed by dps-17 (desktop handlers); keep the names exactly.

## Changes

1. `markdown.ts` (design 7.2): refs from `documentPageSequence`;
   candidates from `frameParents` (members of `F`) plus top-level elements
   whose bounds centre is inside `rect` (all top-level when no frame);
   remove `F` and every page frame, hidden elements (`context.isHidden`)
   and mask sources (`isMaskSource`); dedupe by `Set`; drop candidates
   inside another candidate's `expandContainers`; sort `(top, left, id)`.
   Emit `text.markdown` verbatim (trailing newlines trimmed); `text.code`
   as a backtick fence of length `max(3, longest backtick run + 1)`, info =
   language or empty for `plain`; each maximal run of other members is one
   `renderSelectionSvg(..., { padding: 16, background: null, resolveAsset })`
   asset named `page-<R>-<G>.svg`, referenced `![Diagram page-R-G](<assetDir>/page-R-G.svg)`
   or as a `data:image/svg+xml;base64,` URI with `embed` (then `assets` is
   empty). A null SVG is skipped and does not consume a group number.
   Blocks joined by `\n\n`; output ends with exactly one `\n`. Base64: reuse
   a pure core helper if one exists, else a small pure encoder (no `Buffer`,
   no `btoa`).
2. `pdf-document.ts`: per ref, `editor.exportPageSvgOf(pageId, { viewport: rect, background })`,
   `pdfLayout(w, h, { pageSize: "artwork", orientation: "portrait", marginMm: 0 })`,
   `collectTextRuns(..., extractors ?? PDF_TEXT_RUN_EXTRACTORS)`. Throw
   `Error("Document has nothing to export.")` for 0 refs and
   `Error("Document has N pages; PDF export supports at most 500.")` above
   500.
3. `index.ts`: append `export * from "./markdown.ts";` and
   `export * from "./pdf-document.ts";`. Check `bun run typecheck` for
   barrel name collisions.
4. `commands.ts`: add only the optional `ensureDir?` member with a doc
   comment, next to `writeBytes?` (:110). Touch nothing else in the file.
5. `local-io.ts`: `ensureDir` via `mkdir(path, { recursive: true })` from
   `node:fs/promises`, resolving `void`.
6. `engine.rs`: add an `"ensureDir"` arm next to `"writeBytes"` (:103) that
   calls `std::fs::create_dir_all` (via `host_error` on failure) and returns
   `JsValue::undefined()`; add `'ensureDir'` to the name list at :235.
   `native-engine.ts`: declare `ensureDir(path: string): void` and
   `pdfPages(pngs: Uint8Array, spec: string): Uint8Array` on `native`; map
   `ensureDir: async (path) => native.ensureDir(native.path(path))` in `io`;
   add `pagesToPdf` to the export renderer object (:75-92) that
   concatenates the PNGs and passes
   `nativePdfSpec(buildPdfTextLayer(specs), pages.map(p => ({ pngLength, layout })))`.
7. `raster-backend.ts`: `pagesToPdf` with pdf-lib imitating
   `ui-solid/src/pdf-export.ts:pagesToPdf` (`emitPdfTextLayer`,
   `useObjectStreams: false`), wired into the default backend object
   `export-command.ts` uses.
8. `export-command.ts` (design 7.4):
   - Add `"markdown"` to `EXPORT_FORMATS` and the boolean flag `--document`
     (follow the existing boolean-flag parsing).
   - `--document` is accepted with `--format pdf` and `--format markdown`;
     any other format is `--document is valid only with --format pdf or markdown.`
     exit 2. It conflicts with `--page`, `--element`, `--frames`,
     `--pdf-page`, `--orientation`, `--margin` (one-line error, exit 2).
     Requires `--output`.
   - `--format markdown` with or without `--document` is one code path: the
     same conflicts apply, `--output` must end in `.md`, same bytes, same
     summary. Order: compute export; if `assets.length > 0` then
     `ensureDir` missing -> `This host cannot create directories.` exit 1,
     else `await io.ensureDir(<dir>/<stem>.assets)`, write each SVG
     atomically, then write the `.md` last. Stale files are left alone.
   - `--format pdf --document`: `documentPdfPlan`, rasterize each SVG at the
     PDF scale (default 2), `renderer.pagesToPdf`, atomic write, `Wrote ...`
     summary with the page count.
   - Existing single-page PDF: use `pagesToPdf` when present (one page,
     runs from `collectTextRuns` over the SVG viewBox), else `pngToPdf`.

## Pitfalls

- IR `DEFINITIONS` lacks `text.code`/`text.markdown` until dps-17. Core
  tests build fixtures with `packages/core/src/test-helpers.ts`
  (`document`, `element`, `makeEditor`) and explicit `visual` boxes, as
  `document-export/text-runs.test.ts` does. CLI tests in
  `export-document.test.ts` use only registered types (`shape.geo`,
  `edge.*`, `frame` with `semantic.page`); CLI snippet output is tested by
  dps-17.
- Never include a page frame as a member. Do not edit `frame-tree.ts`.
- Bytes must be identical across app and CLI; derive everything from
  document state.
- Test fakes of `RasterBackend` without `pagesToPdf` and of `CommandIo`
  without `ensureDir` must keep working. Do not edit
  `export-command.test.ts`.
- Write the `.md` after the assets; do not call `ensureDir` when there are
  no assets.

## Tests (input -> expected)

- markdown.test.ts: frame with one Markdown and one code snippet -> both
  once, zero assets; Markdown, 2 shapes + connector, code -> one asset with
  the shapes and neither snippet text nor frame rect; group member -> one
  asset, no duplicated child; two pages -> tab order kept; code with a
  3-backtick run -> 4-backtick fence; `embed` -> data URI, empty assets;
  two runs -> identical output. Existing `renderSelectionSvg` tests pass.
- pdf-document.test.ts: 3 refs -> 3 plans sized `rect * 0.75`; 501 frames
  -> limit error; empty document -> nothing-to-export error; a fake
  extractor's runs appear in the specs.
- local-io.test.ts (temp dir): nested missing path created; second call
  resolves; path that is an existing file rejects.
- engine_tests.rs: `native.ensureDir(native.path('a/b/c'))` twice in a
  temp dir -> directory exists, no error (imitate
  `binary_views_write_only_the_selected_bytes_and_attachments_stay_confined`).
- export-document.test.ts (Bun backend, temp dir): `--document --page p1`
  -> exit 2 conflict; `--document --format svg` -> exit 2 with the 7.4
  message; `--format markdown --document --page p1` -> exit 2;
  `--format markdown --output <tmp>/out/doc.md` into a fresh `out/` ->
  `doc.md` and `doc.assets/page-1-1.svg`, rerun exits 0; explicit
  `--format markdown --document --output a/doc.md` vs shorthand
  `b/doc.md` -> byte-identical `.md`, same asset names, byte-identical
  SVGs; page frames with no drawable members -> no `doc.assets/`;
  `--format pdf --document` on a 2-frame fixture -> `extractPdfText` gives
  2 pages; an io without `ensureDir` and assets -> exit 1 with the message.

## Verification (each must exit 0; logs go to tmp/dps-s863/dps-14-document-export/)

1. `bun test packages/core/src/document-export apps/cli/src/export-document.test.ts apps/cli/src/export-command.test.ts apps/cli/src/local-io.test.ts`
   (all tests pass, new files report > 0 tests).
2. `bun run typecheck`
3. `bunx biome check --diagnostic-level=warn packages/core/src/document-export apps/cli/src/export-command.ts apps/cli/src/raster-backend.ts apps/cli/src/native-engine.ts apps/cli/src/export-document.test.ts apps/cli/src/commands.ts apps/cli/src/local-io.ts apps/cli/src/local-io.test.ts`
4. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/dps-14 cargo test -p nodetto-cli`
   (the new ensureDir test passes).
5. `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/cli/native/Cargo.toml --check`

## Done criteria

- Every test listed above exists and passes; all five commands exit 0.
- `rg -n "It is valid only with" apps/cli/src/export-command.ts` finds
  nothing PDF-only; `rg -n "ensureDir" apps/cli/src/local-io.ts apps/cli/native/src/engine.rs apps/cli/src/native-engine.ts`
  matches in all three.
- The progress log records each command, exit code, log path, and the
  pre/post hashes of every edited existing file.

## Coordination

Parallel with dps-15 on the same working tree; the write sets are disjoint.
Re-read each file right before editing and record its hash; if a hash
changed unexpectedly, stop and record drift. Edit only the writePaths and
your own progress log. No git state changes.
