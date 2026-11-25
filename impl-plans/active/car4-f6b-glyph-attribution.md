# car4-f6b-glyph-attribution

- planId: car4-f6b-glyph-attribution; wave 3; dependsOn: car4-f2b-capture-assets,
  car4-f6a-export-members
- planPath: impl-plans/active/car4-f6b-glyph-attribution.md
- progressPath: impl-plans/progress/car4-f6b-glyph-attribution.md
- Finding: maintainability-capture-glyph-attribution-scope (R4-6, medium), CLI part.
- Design: `design-docs/specs/design-ai-capture.md` 22.1 R4-6 (CLI), 22.4.
- writePaths: `apps/cli/src/glyph-coverage.ts`, `apps/cli/src/capture-artwork.ts`,
  `apps/cli/src/export-command.ts`, `apps/cli/src/capture-command.test.ts`,
  `apps/cli/src/glyph-commands.test.ts`, `tmp/car4-r4/car4-f6b-glyph-attribution`,
  `impl-plans/progress/car4-f6b-glyph-attribution.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules and pinned contracts in `impl-plans/active/car4-00-overview.md`.

## Intent and context

`capture-artwork.ts` (glyph block after `fontCoverage`) and `export-command.ts:601-616`
each attribute missing glyphs to every page element for a group or frame target, while
the renderer draws only the container's members. Both must use one helper built on
`svgExportMemberIds` (f6a). The export glyph tests live in `glyph-commands.test.ts`
(`:27`, `:111`), not `export-command.test.ts`.

Non-goals: no change to warning text, order, page-level fallback warnings, image
bytes, the carrier logic of f2b in `capture-artwork.ts`.

## Changes

- `glyph-coverage.ts`: `export function attributeTargetGlyphs(input: { document:
  Document; page: Page; target: Element | undefined; editor: Editor; missing:
  ReadonlySet<number> })` returning the `attributeMissingGlyphs` shape. No target ->
  today's page list (`document.elements` with `element.page === page.id`). Target ->
  `document.elements` of the page whose id is in
  `svgExportMemberIds(editor.store, editor.registry, page.id, [target.id])`, document
  order. Then `attributeMissingGlyphs`.
- `capture-artwork.ts` and `export-command.ts`: replace the local filters with the
  helper; keep the warning loops as they are.

## Pitfalls

- A non-container target keeps today's behavior (members = the element itself).
- Do not re-read `capture-artwork.ts` assumptions from before f2b: read the file fresh.

## Tests

- `capture-command.test.ts` (imitate `:397` and `:454`): a group and a frame, each with
  an inside label and an outside label containing U+03BB; `io.fontCoverage` returns
  `missing: [0x03bb]`; capture of the group and of the frame warns only the inside id;
  whole-page capture warns both (fails before: outside id warned).
- `glyph-commands.test.ts` (imitate `:111`): the same for raster export with
  `--element` group and frame, and whole page.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn apps/cli/src/glyph-coverage.ts apps/cli/src/capture-artwork.ts apps/cli/src/export-command.ts apps/cli/src/capture-command.test.ts apps/cli/src/glyph-commands.test.ts && bun test apps/cli/src/capture-command.test.ts apps/cli/src/glyph-commands.test.ts apps/cli/src/glyph-coverage.test.ts`

## Done criteria

- Both callers use the helper; inside-only warnings for group and frame; whole page
  unchanged; progress log `done`.

## Implementation status

- Implemented; focused gate passed (62 tests). Formal review and integration gates remain downstream.
