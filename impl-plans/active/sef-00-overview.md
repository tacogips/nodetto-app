# sef-00 overview: style clearing, raster glyph fallback, box-label alignment

- Design (binding): `design-docs/specs/design-style-export-fixes.md`.
- Owner questions: `design-docs/user-qa/style-export-fixes.md`, Q1 and Q2. Implement
  each default.
- Manifest: `impl-plans/active/sef-s733-dispatch.json`.
- Evidence root: `tmp/sef-s733/<planId>/`.
- This overview is not dispatched and has no write paths.

## Waves and ownership

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | sef-01-edit-visual-merge | G1: visual merge, `[]`, required-field error | - |
| 1 | sef-02-edit-style-keys | G3: unknown `visual.style` key rejection | - |
| 1 | sef-03-font-coverage-host | G2: fallback list, Bun and native coverage, `rasterize` parameter, macOS gate | - |
| 1 | sef-04-glyph-attribution | G2: pure attribution and message formatting | - |
| 1 | sef-05-box-label-layout | G3: IR marker, core layout, SVG, canvas, lint geometry | - |
| 2 | sef-06-edit-box-align-writes | G3: edit-layer marker writes and link removal | sef-01, sef-02, sef-05 |
| 2 | sef-07-glyph-export-lint | G2: export flow, lint eligibility; CPU comparison including the sef-01 merge path | sef-01, sef-03, sef-04 |
| 2 | sef-08-help-docs | Help and docs | sef-01, sef-02, sef-03, sef-04, sef-05 |

This refines the design's partition for more concurrency: the design's G2 plan is split
into sef-03, 04 and 07, and its unknown-key work moves to sef-02. Files, contracts and
behavior do not change.

A file owned in both waves is edited only at that plan's wave:

- `apps/cli/src/commands.ts`: sef-03 (the `CommandIo` member), then sef-07 (lint).
- `apps/cli/src/export-command.ts`: sef-03 (the `RasterBackend` parameter), then sef-07.
- `apps/cli/src/edit/visual-patch.ts`: sef-01, then sef-06.
- `apps/cli/src/__fixtures__/test-font.ts`: sef-03, then sef-07 if the fixture needs a repair.

## Amendment 2026-11-05 (blocked-wave-scope-or-contract, round 1)

Accepted so far: sef-01, sef-02, sef-04 and sef-05. Pending: sef-03, sef-06, sef-07 and sef-08. Plan IDs, waves, dependencies and `writePaths` do not change.

- sef-06: the written-document parity contract now excludes the generated `index` on `add` batches, and the Bun PDF difference check is dropped. See that plan's amendment.
- sef-03: the accepted design revision replaces the base-face requirement with text-run rules (design section "Font sets", user-qa Q3). A document needing no fallback and a run with no fallback glyph stay byte-identical. A run containing a fallback glyph may render wholly in the fallback face. The sef-03 gate and tests are updated, and a text-run splitter stays out of scope. SEF3-ADV-MIXED-RUN-FACE stays open until sef-03 passes those tests and its reviews. sef-07 and sef-08 stay held behind sef-03.

## Pinned contracts

```ts
// apps/cli/src/commands.ts, CommandIo (sef-03)
fontCoverage?(text: string, fontDir: string | undefined):
  | { readonly needsFallback: boolean; readonly missing: readonly number[] }
  | undefined;

// apps/cli/src/export-command.ts, RasterBackend.rasterize (sef-03)
rasterize(svg: string, scale: number, fontDir: string | undefined, fallback?: boolean): Promise<Uint8Array>;

// apps/cli/src/glyph-coverage.ts (sef-04)
export interface GlyphRow { readonly elementId: string; readonly codePoints: readonly number[] }
export function attributeMissingGlyphs(elements: readonly Element[], missing: ReadonlySet<number>):
  { readonly rows: readonly GlyphRow[]; readonly unattributed: readonly number[] };
export function glyphRowsByPage(document: Document, coverage: (text: string) =>
  { readonly missing: readonly number[] } | undefined): ReadonlyMap<PageId, readonly GlyphRow[]>;
export function glyphMissingMessage(codePoints: readonly number[]): string;

// packages/core/src/label-layout.ts, exported from @nodetto/core (sef-05)
export function boxLabelVerticalAlign(visual: Visual): "top" | "middle" | "bottom";
export function alignedLabelTop(align: "top" | "bottom", height: number, contentHeight: number, padding: number): number;

// apps/cli/src/edit/visual-patch.ts (sef-01)
export function visualPatchCommand(element: Element, patch: JsonObject, index: number): Command;

// IR (sef-05)
VisualStyle.boxLabelAlign?: boolean
```

`native.fontCoverage(text, fontDir)` returns JSON text: `null` or
`{"needsFallback":bool,"missing":[number,...]}`.
`native.png(svg, scale, fontDir, fallback)` takes a boolean fourth argument.

## Rules for every worker

- Read your plan and the named design section first. Do not widen scope. If a needed
  edit falls outside your `writePaths`, stop and record a blocker in your progress log.
- Before starting, record `git hash-object` of your plan file as the intent snapshot.
  Other plans run at the same time on the same branch and working directory.
- Before each edit, read the file fresh. Record pre and post `git hash-object` per edit
  in your progress log. If the pre-edit hash differs from your last recorded post hash,
  someone else touched the file: re-read, keep their change, record the drift.
- Edit only your own progress log. Do not edit `impl-plans/README.md`, other plans or
  `impl-plans/active` and `impl-plans/completed` listings.
- No state-changing git commands: no commit, stash, checkout, reset, branch or worktree.
  Read-only git commands are fine.
- No broad formatting. Run Biome only on your own files. Do not reformat `help.ts`,
  `docs/cli.md`, `commands.ts` or `packages/core/src/index.ts`; a sibling branch edits
  them too. Keep hunks small and local.
- Never run `cargo clean`. Never delete `target/sef-baseline`.
- Every fixture, id, label and comment is self-authored and neutral (widgets, orders,
  `Idle`, `Running`). Never mention external issue numbers, organizations, reporters or
  downstream products.
- No emojis. Cargo commands use `CARGO_TERM_QUIET=true`.
- Boa rules for shared-engine code: no regex `split` on whole documents, cheap
  per-character work, no per-point destructuring in hot loops. Shared-engine modules must
  not import `node:*`. Only `local-io.ts` and `raster-backend.ts` side modules may.
- Strict TypeScript. No unchecked index lookups in `packages/core`.

## Verification rules

- Write each command's full output to `tmp/sef-s733/<planId>/final/<name>.log` and record
  its exit status in the progress log. Before repeating a gate, move `final/` to
  `attempt-<n>/`. An incomplete log is not a passing check.
- Native parity commands always set `NODETTO_CLI_TEST_BINARY` to a release binary built by
  the same command, so tests run instead of skipping. Record the pass and skip counts. A
  skipped `nativeTest` is a failure.
- For a native deadline timeout, retry up to 3 attempts before it counts as a failure, and
  compare CPU time with `/usr/bin/time -p`. Never relax a deadline.
- On a moving shared tree, a failure caused only by a sibling's unfinished file is recorded
  with the file name and rerun once that sibling finishes. It is not fixed by you.
- Workspace gates belong to reconciliation and integration review, not to worker plans:
  `CARGO_TERM_QUIET=true mise run verify` and `CARGO_TERM_QUIET=true mise run test-cli`
  (3-attempt retry for native deadlines).

## Progress logs

Each plan writes `impl-plans/progress/<planId>.md` with the intent snapshot hash, per-edit
hashes, baseline test counts, final counts, exit statuses, log paths, and any blocker or
deviation from the plan.

## Done for the whole set

- All plans' done criteria are met.
- `mise run verify` and `mise run test-cli` exit 0 on the combined tree, with `test-cli`
  running native parity, not skipping.
- `sef-07` CPU comparison against `target/sef-baseline/nodetto-cli` is recorded.
- Existing golden fixtures pass without regeneration:
  `git status --short apps/cli/src/__fixtures__ packages/io/src/__fixtures__` shows only
  `apps/cli/src/__fixtures__/test-font.ts` as a new file.
