# dps-17e-desktop-export-tests

- planId: dps-17e-desktop-export-tests (session 864, wave 1, dependsOn: none)
- Design: `design-docs/specs/design-document-pages-snippets.md` sections
  7.5 and 10.2 ("Desktop handlers", "ExportDialog").
- Parent: `impl-plans/active/dps-17-wiring.md` Changes 4 (ExportDialog) and 5.
- writePaths:
  - `apps/desktop/src/shell/export-handlers.ts`
  - `apps/desktop/src/shell/export-handlers.test.ts` (new)
  - `packages/ui-solid/src/ExportDialog.tsx`
  - `packages/ui-solid/src/export-dialog-document.test.ts` (new)
  - `packages/ui-solid/src/export-dialog-artboards.test.ts` (extension
    only, if it fails because of the new exports)
  - `impl-plans/progress/dps-17e-desktop-export-tests.md`
  - `tmp/dps-s864/dps-17e-desktop-export-tests`
  - `target` (artifact root only)
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

The Document export entries and handlers exist but have no behavioural
tests:

- dialog entries and groups: `ExportDialog.tsx:132-141` and `:193-202`;
- handlers: `export-handlers.ts:164-210`.

`exportDocumentPdf` calls `rasterizeSvg`, which needs a DOM. Add the
smallest injection seam so Bun can test the handlers.

## Contracts

- `createExportHandlers(source: ExportSource, setExportError: (m: string | null) => void, deps: { readonly rasterizeSvg?: (svg: string, scale: number) => Promise<Blob> } = {}): ExportHandlers`.
  - `exportDocumentPdf` uses `deps.rasterizeSvg ?? rasterizeSvg`.
  - Existing callers (App.tsx) pass two arguments and are unchanged. Do
    not edit App.tsx.
- `ExportDialog.tsx`:
  - move the `formatGroups` literal to module scope as
    `export const EXPORT_FORMAT_GROUPS: readonly { label: string; ids: readonly Format[] }[]`,
    with unchanged content and order, and use it inside the component;
  - add
    `export function documentExportFormats(props: Pick<ExportDialogProps, "exportDocumentPdf" | "exportDocumentMarkdown">): readonly { id: Format; label: string; enabled: boolean }[]`
    that returns the two Document entries exactly as built today;
  - `formats()` spreads `...documentExportFormats(props)` in place of the
    two literals, so the order is unchanged.
  - Export the `Format` type only if the test needs it.

## Non-goals

- No dialog UI or label change, no new menu item, no Tauri command.
- Do not change `pagesToPdf`, `documentPdfPlan` or
  `exportMarkdownDocument`. Do not edit `AssetExportSection.tsx`
  (dps-17d).

## Test cases

`apps/desktop/src/shell/export-handlers.test.ts` (Bun). Imitate
`apps/desktop/src/shell/document-commands.test.ts` for imports.

- Fake `ExportBackend`:
  - `available: true`;
  - `pickExportPath(name, ext)` records its arguments and returns
    `/out/${name}`;
  - `writeBytes` records the path and bytes;
  - other members throw.
- Fake rasterizer: returns a fixed valid 1x1 PNG Blob. Reuse the
  synthetic PNG technique of `packages/ui-solid/src/pdf-export.test.ts`.
- Document PDF: an editor whose document title is `"Paper"`, with two A4
  page frames (`semantic.page`), one containing a `text.code`.
  `exportDocumentPdf(1, "#ffffff")`:
  - writes one file, with extension `"pdf"` and name `"Paper.pdf"`;
  - the bytes start with `%PDF-`;
  - the PDF has 2 pages: count `/Type /Page` objects, or reuse the page
    count technique in `apps/cli/src/export-document.test.ts`;
  - `extractPdfText(bytes)` (from `@nodetto/core`) contains the code text;
  - `setExportError` was last called with `null`.
- Document Markdown: the same editor plus one `shape.geo` outside the
  snippets. `exportDocumentMarkdown()` writes `Paper.zip`, and its stored
  ZIP bytes contain the entry names `Paper.md` and
  `Paper.assets/<asset>.svg`. Check the names by decoding the ZIP central
  directory or with a text search, as
  `packages/ui-solid/src/export-dialog-artboards.test.ts:20-25` does.
- Failure: a rasterizer that rejects with `Error("boom")` -> no write, and
  `setExportError` receives `"could not export: boom"`.

`packages/ui-solid/src/export-dialog-document.test.ts`:

- `EXPORT_FORMAT_GROUPS[0]` equals
  `{ label: "Document", ids: ["document-pdf", "document-markdown"] }`.
- `documentExportFormats({})` -> both entries present, labels
  `"Document as PDF..."` and `"Document as Markdown (ZIP)..."`, both
  disabled.
- With both callbacks -> both enabled. With only the PDF callback -> only
  `document-pdf` enabled.

## Pitfalls

- The title source is `source.editor.getSnapshot().title`. Set it through
  the editor's existing title API, not by mutating the snapshot.
- `downloadBlob` must not run in tests (`available: true`).
- Keep `createExportHandlers`' returned object shape identical.

## Verification (exit 0; logs in `tmp/dps-s864/dps-17e-desktop-export-tests/`)

1. `bun test apps/desktop/src/shell/export-handlers.test.ts packages/ui-solid/src/export-dialog-document.test.ts packages/ui-solid/src/export-dialog-artboards.test.ts`
   -> 0 fail.
2. `bun run typecheck` -> exit 0.
3. `bunx biome check --diagnostic-level=warn apps/desktop/src/shell/export-handlers.ts apps/desktop/src/shell/export-handlers.test.ts packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/export-dialog-document.test.ts`
   -> exit 0.

## Acceptance criteria

- Both new test files pass.
- `rg -n "EXPORT_FORMAT_GROUPS|documentExportFormats" packages/ui-solid/src/ExportDialog.tsx`
  matches.
- `git diff apps/desktop/src/App.tsx` is empty.

## Progress

`impl-plans/progress/dps-17e-desktop-export-tests.md`: sha256 before and
after each file, commands with exit codes and log paths. No git state
changes.
