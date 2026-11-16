# dps-17-wiring

- planId: dps-17-wiring. Wave 3, the final wiring plan.
- dependsOn: dps-01 through dps-16.
- Design: sections 3.5, 5.4, 7.4 to 7.6, 8, 10 and 11 of
  `design-docs/specs/design-document-pages-snippets.md`.
- writePaths (shared registration files and final docs):
  - IR: `packages/ir/src/registry.ts`, `packages/ir/src/registry.test.ts`.
  - io: `packages/io/src/jsonl/golden.test.ts`,
    `packages/io/src/__fixtures__/document-pages.jsonl` (new).
  - core:
    - `packages/core/src/index.ts`
    - `packages/core/src/shapes/index.ts`
    - `packages/core/src/svg-export/shapes.ts`
    - `packages/core/src/tools.ts`
    - `packages/core/src/shape-catalogue.ts`
    - `packages/core/src/shape-catalogue.test.ts`
    - `packages/core/src/editor/style-text.ts`
    - `packages/core/src/editor/types.ts`
    - `packages/core/src/document-export/extractors.ts`
    - `packages/core/src/document-snippets-wiring.test.ts` (new)
  - ui-solid:
    - `packages/ui-solid/src/shapes/ShapeView.tsx`
    - `packages/ui-solid/src/Inspector.tsx`
    - `packages/ui-solid/src/Canvas.tsx`
    - `packages/ui-solid/src/interaction/pointer.ts`
    - `packages/ui-solid/src/shape-palette.ts`
    - `packages/ui-solid/src/shortcuts.ts`
    - `packages/ui-solid/src/Toolbar.tsx`
    - `packages/ui-solid/src/ExportDialog.tsx`
    - `packages/ui-solid/src/inspector/AssetExportSection.tsx`
    - `packages/ui-solid/src/index.ts`
    - `packages/ui-solid/src/document-wiring.test.ts` (new)
  - desktop: `apps/desktop/src/shell/export-handlers.ts`,
    `apps/desktop/src/App.tsx`.
  - CLI:
    - `apps/cli/src/help.ts`
    - `apps/cli/src/types-command.ts`
    - `apps/cli/src/document-wiring.test.ts` (new)
    - `apps/cli/src/native-parity/export.test.ts`
  - Docs and examples: `docs/cli.md`, `README.md`,
    `examples/document/README.md`, `examples/document/paper.ops.json`,
    `examples/document/deck.ops.json`.
  - Logs and artifacts: `impl-plans/progress/dps-17-wiring.md`,
    `tmp/dps-s861/dps-17-wiring`, `target`.
- sharedPaths: none. Every earlier plan has landed, so this plan owns these
  files exclusively.
- artifactRoots: `target`.

## Intent and context

This plan connects every module through the shared registries, adds the
app and CLI entry points and the final docs and examples, and runs the
final gates.

## Non-goals

- No behaviour changes inside earlier plans' modules. If one is defective,
  record it and request a repair; do not rewrite it here.
- No new Command kind, dependency, CSS token or version bump.

## Changes

1. IR:
   - Add `TEXT_CODE` and `TEXT_MARKDOWN` (from `registry/document.ts`) to
     `DEFINITIONS`, next to `TABLE_SHEET` (`registry.ts:87`).
   - Update the sorted type list in `registry.test.ts`.
2. Golden fixture `document-pages.jsonl`:
   - a vertical page with two A4 page frames, a `text.markdown`, a
     `text.code` (rust, line numbers), and a `shape.geo`;
   - a horizontal page (`pageFlow: "horizontal"`) with one slide-16-9 page
     frame.

   Add it to `GOLDEN`. The content is self-authored.
3. core:
   - `shapes/index.ts` registers `codeSnippetShapeUtil` and
     `markdownSnippetShapeUtil`.
   - `svg-export/shapes.ts` dispatches `text.code` to `renderCodeSnippet`
     and `text.markdown` to `renderMarkdownSnippet`, next to `table.sheet`
     (:302).
   - `EDITABLE_FIELDS` maps `text.code` to `code` and `text.markdown` to
     `markdown`. Extend the `EditableField` union in `editor/types.ts`.
   - `document-export/extractors.ts`: `PDF_TEXT_RUN_EXTRACTORS =
     { "text.code": codeSnippetTextRuns, "text.markdown": markdownSnippetTextRuns }`.
   - `tools.ts`: `Tool.CodeSnippet` (`text.code`) and
     `Tool.MarkdownSnippet` (`text.markdown`). Imitate `Tool.Sheet` (:91,
     :819).
   - `shape-catalogue.ts`: entries "Code snippet" and "Markdown snippet" in
     General (imitate :83).
   - `packages/core/src/index.ts`: append
     `export * from "./markdown-snippet/index.ts";` and export
     `codeSnippetShapeUtil`, `renderCodeSnippet`, `renderMarkdownSnippet`
     where ui needs them. Check for name collisions.
4. ui-solid:
   - `ShapeView.tsx` renders `SnippetView` with `render` set to
     `renderCodeSnippet` or `renderMarkdownSnippet`.
   - `Inspector.tsx`:
     - labels and `Match` entries for both sections;
     - `PageFrameSection` for frames;
     - `PageFlowControl` in the no-selection page section.
   - `pointer.ts` and `Canvas.tsx`: a double-click edit request on a
     snippet mounts `SnippetTextEditor` instead of the default text editor.
     Imitate the `table.sheet` `CellEditor` branch (pointer.ts:190, 342, 514
     and Canvas.tsx:160).
   - `shape-palette.ts`: tiles for Code snippet, Markdown snippet and Page.
     The Page tile runs the `addPageFrame` action. Imitate :135.
   - `shortcuts.ts` and `Toolbar.tsx`:
     - actions `addPageFrame` ("Add page"), `nextPageFrame` ("Next page
       frame", PageDown) and `previousPageFrame` ("Previous page frame",
       PageUp);
     - canvas-only and disabled while text editing;
     - navigation is enabled when the current page has page frames;
     - the actions call the facade with the canvas viewport size from the
       existing `ActionContext`. Add a field there if missing; App.tsx
       supplies it.
   - `ExportDialog.tsx`: a "Document" group with "Document as PDF..." and
     "Document as Markdown (ZIP)...".
   - `AssetExportSection.tsx`: pass `collectTextRuns(...)` runs to
     `pngToPdf`, so single-element PDFs keep snippet text.
   - `index.ts`: export `pagesToPdf`.
5. desktop `export-handlers.ts`:
   - Document PDF:
     - `documentPdfPlan(editor, { background })`;
     - for each page, `rasterizeSvg(svg, scale)`;
     - `pagesToPdf`;
     - `saveArtwork(.pdf)`.
   - Document Markdown:
     - `exportMarkdownDocument(editor, { assetDir: "<base>.assets" })`;
     - `encodeStoredZip([{ "<base>.md" }, ...assets under "<base>.assets/"])`;
     - `saveZip`.
   - Page PDF: pass text runs to `pngToPdf`.
   - App.tsx changes only for the ActionContext viewport field, if needed.
6. CLI:
   - `help.ts`: the export usage gains `--document` and `markdown`, and the
     edit help gains `set-page-flow` and the `text.code` language rule.
   - `types-command.ts`: list both types in `GENERAL` and `TYPICAL`.
   - `document-wiring.test.ts` (Bun):
     - SVG byte identity: the CLI export of a page holding both snippets
       equals `new Editor({ document }).exportPageSvgOf(...)`;
     - `--format pdf --document` on the golden fixture gives 3 pages;
     - `extractPdfText` returns exactly
       `const label = "日本語"; // 𠮷 é\tend` and `# Ünïcode 太字 😀`;
     - the examples apply cleanly through `edit --ops` and validate with 0
       errors.
   - `native-parity/export.test.ts`: the same SVG byte identity, plus
     native `--format pdf --document` page count and exact extracted text
     equal to the Bun result.
7. Docs:
   - `docs/cli.md`: `export --format pdf --document`, `--format markdown
     --output file.md` (assets), `set-page-flow`, and `text.code` add
     examples.
   - `README.md`: one short paragraph per feature in the app and CLI
     sections.
   - Re-check `docs/editing.md` labels against the final UI (read only).
     Record any mismatch for a follow-up rather than editing it.
8. Examples (self-authored):
   - `examples/document/paper.ops.json`: a vertical flow with 2 A4 page
     frames, a Markdown title and abstract, a code snippet and a small
     `shape.geo`/`edge.generic` diagram.
   - `deck.ops.json`: `set-page-flow` horizontal and 3 slide-16-9 frames
     with Markdown bullets.
   - The README gives the run commands and export commands.

## Pitfalls

- `export *` name collisions in the core index break typecheck. Rename
  nothing in other plans; use explicit named exports where needed.
- Keyboard: PageUp and PageDown must not fire inside inputs or textareas,
  or during presentation. Presentation has its own key isolation.
- Hidden or read-only states: "Add page" is disabled in read-only
  documents.

## Tests (beyond the above)

- `document-snippets-wiring.test.ts`:
  - `validateDocument` accepts both types;
  - `renderPageSvg` contains `nodetto-code` and `nodetto-markdown`;
  - `getText`/`setText` work on snippets;
  - copy, paste and duplicate keep the semantic;
  - `PDF_TEXT_RUN_EXTRACTORS` has 2 keys.
- `document-wiring.test.ts` (ui):
  - the action enablement for the three page-frame actions (no DOM);
  - the palette contains the 3 tiles;
  - the ExportDialog format ids include the 2 document entries.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-17-wiring/)

1. `bun test packages/ir packages/io packages/core packages/ui-solid apps/cli/src/document-wiring.test.ts`
2. `bun run typecheck`
3. `mise run lint`
4. `CARGO_TERM_QUIET=true mise run verify`
5. `sh -c 'mkdir -p tmp/dps-s861/dps-17-wiring; for i in 1 2 3; do CARGO_TERM_QUIET=true mise run test-cli > tmp/dps-s861/dps-17-wiring/test-cli-$i.log 2>&1 && exit 0; grep -qiE "timed out|deadline" tmp/dps-s861/dps-17-wiring/test-cli-$i.log || exit 1; done; exit 1'`
   - It may retry only on deadline timeouts, up to 3 attempts. Deadlines
     are never relaxed.
   - Native parity must run with `NODETTO_CLI_TEST_BINARY` set by the task,
     never skipped.

## Done criteria

- Every acceptance signal in the design section 11 list is covered by a
  passing test.
- All five commands exit 0.
- The progress log records every command, its exit code, its log path and
  the attempt count.

## Coordination

Run after all earlier plans have been joined. Re-read each file before
editing and record hashes. If an earlier plan's file needs a fix, record it
as a repair finding for that plan. No git state changes.
