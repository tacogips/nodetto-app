# dps-17d-pdf-text-individual

- planId: dps-17d-pdf-text-individual (session 864, wave 1, dependsOn: none)
- Design: `design-docs/specs/design-document-pages-snippets.md` section
  10.2 "Test seams: text runs for single PDFs", section 7.3.1, and the
  owner decision for `text-runs.test.ts`.
- Parent: `impl-plans/active/dps-17-wiring.md` Changes 4
  (`AssetExportSection.tsx`) and 5 ("Page PDF").
- writePaths:
  - `packages/core/src/document-export/text-runs.ts`
  - `packages/core/src/document-export/text-runs.test.ts`
  - `packages/ui-solid/src/raster-export.ts`
  - `packages/ui-solid/src/inspector/AssetExportSection.tsx`
  - `packages/ui-solid/src/raster-export-text.test.ts` (new)
  - `impl-plans/progress/dps-17d-pdf-text-individual.md`
  - `tmp/dps-s864/dps-17d-pdf-text-individual`
  - `target` (artifact root only)
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

Single PDF exports (page, artboard and selection scope in
`AssetExportSection.tsx:146-150`) call `pngToPdf(png, w, h, options, signal)`
without text runs. Snippet text is therefore not extractable from them.
`pngToPdf` already takes a 6th `textRuns?: readonly PdfTextRun[]`
(`packages/ui-solid/src/pdf-export.ts:92-109`). `documentPdfPlan`
(`packages/core/src/document-export/pdf-document.ts:50-56`) shows how to
call `collectTextRuns`.

## Contracts

- `collectTextRuns(store, registry, pageId, rect, extractors = PDF_TEXT_RUN_EXTRACTORS, include?: (element: Element) => boolean): PdfTextRun[]`.
  - When `include` is given, elements for which it returns false are
    skipped before extraction.
  - The default (undefined) keeps today's behaviour. Existing callers stay
    untouched.
- `rasterExportSnapshot(editor, options)` keeps every current field and
  adds `textRuns: PdfTextRun[]`:
  - `rect` comes from the root `<svg ... viewBox="x y w h">` of the
    produced SVG. Use the same regex as `svgRasterDimensions`
    (`packages/core/src/export-geometry.ts:10-11`); a small local helper
    is fine. Pass x, y, width and height.
  - `pageId` is `editor.currentPageId`.
  - Page scope (`wholePage`): no `include`.
  - Artboard scope (`artboardId`) and selection scope:
    `include = (e) => ids.has(e.id)`, where `ids` is
    `new Set(expandContainers(editor.store, seed, createShapeContext(editor.store, editor.registry, 1)))`
    and `seed` is `[artboardId]` or `[...editor.selection.ids()]`. Both
    helpers are exported from `@nodetto/core`. This is the same set
    `renderArtboardSvg` and `renderSelectionSvg` draw
    (`packages/core/src/svg-export/document.ts:746-790`).
  - Runs are relative to the rect origin, already done by
    `collectTextRuns`.
- `AssetExportSection.tsx`: when `kind === "pdf"`, pass `data.textRuns` as
  the 6th argument of `pngToPdf`. Change nothing else.

## Non-goals

- Do not touch `pdf-document.ts`, `pdf-pages.ts`, `pdf-export.ts`,
  extractors, the CLI or the desktop handlers.
- No change to the SVG or PNG paths.

## Test cases

`text-runs.test.ts` (owner decision):

- Replace `expect(PDF_TEXT_RUN_EXTRACTORS).toEqual({})` with
  `expect(Object.keys(PDF_TEXT_RUN_EXTRACTORS).sort()).toEqual(["text.code", "text.markdown"])`.
  Keep every other assertion.
- New: an `include` returning false for the inside element -> `[]`.
  `include` undefined -> the same result as before.

`raster-export-text.test.ts` (Bun, no DOM; imitate
`packages/ui-solid/src/pdf-export.test.ts:60-` for the synthetic PNG and
`extractPdfText` from `@nodetto/core`):

- A page with a `text.code` holding `'const label = "日本語"; // 𠮷 é\tend'`
  and a `text.markdown` holding `"# Ünïcode **太字** 😀"`:
  - page-scope snapshot -> `textRuns` texts equal the
    `collectTextRuns(...)` texts over the same rect;
  - `pngToPdf(syntheticPng, w, h, { pageSize: "artwork", orientation: "portrait", marginMm: 0 }, undefined, snapshot.textRuns)`
    then `extractPdfText` -> equals those run texts exactly, in order.
- Select only the code snippet (the markdown snippet overlaps the
  selection bounds) -> selection-scope runs contain only code-snippet
  text.
- An artboard (frame) containing only the markdown snippet ->
  artboard-scope runs contain the markdown text and no code text.
- A page with no snippets -> `textRuns` is `[]`.

## Pitfalls

- Do not compute the rect from `svgRasterDimensions` alone: it drops the
  origin, so runs would be offset.
- `expandContainers` must use a fresh shape context, not the editor's
  render context.
- Keep `pending` and abort handling in `AssetExportSection` as is.

## Verification (exit 0; logs in `tmp/dps-s864/dps-17d-pdf-text-individual/`)

1. `bun test packages/core/src/document-export packages/ui-solid/src/raster-export-text.test.ts packages/ui-solid/src/pdf-export.test.ts`
   -> 0 fail (`pdf-document.test.ts` stays unchanged and green).
2. `bun run typecheck` -> exit 0.
3. `bunx biome check --diagnostic-level=warn packages/core/src/document-export/text-runs.ts packages/core/src/document-export/text-runs.test.ts packages/ui-solid/src/raster-export.ts packages/ui-solid/src/inspector/AssetExportSection.tsx packages/ui-solid/src/raster-export-text.test.ts`
   -> exit 0.

## Acceptance criteria

- Each individual PDF export scope yields extractable snippet text (the
  tests above).
- `git diff packages/core/src/document-export/pdf-document.ts` is empty.
- `rg -n "textRuns" packages/ui-solid/src/inspector/AssetExportSection.tsx`
  matches.

## Progress

`impl-plans/progress/dps-17d-pdf-text-individual.md`: sha256 before and
after each file, commands with exit codes and log paths. No git state
changes.
