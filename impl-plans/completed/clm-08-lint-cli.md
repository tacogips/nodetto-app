# clm-08-lint-cli

- planId: clm-08-lint-cli
- planPath: impl-plans/active/clm-08-lint-cli.md
- progressPath: impl-plans/progress/clm-08-lint-cli.md
- wave: 2
- dependsOn: clm-03-lint-core (`lintNodeOverlaps`, `NODE_OVERLAP_PAGE_KINDS`,
  `planTextWrapFixes`, `TextWrapFix`).
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, section D
  ("Page selection", D1, D2, D3) and the D rows of "Verification". Owner
  questions Q1 (text-layout rules stay on their current page kinds) and Q4.
- writePaths:
  - `apps/cli/src/lint-diagram.ts` (new)
  - `apps/cli/src/lint-diagram.test.ts` (new)
  - `impl-plans/progress/clm-08-lint-cli.md`
  - `tmp/clm-s725/clm-08-lint-cli`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

`lint` gains node-overlap findings on ERD, state, flowchart and UML pages,
missing-image errors, and `--fix` text wrapping. This plan writes one CLI
module with the logic. clm-09 calls it from `commands.ts:lintCommand` and
adds help and parity tests.

- `commands.ts:lintCommand` (around lines 246-430) selects pages, maps rule
  outputs to `LintFindingRow` (`elementId`, `severity`, `message`,
  `ruleId`, `pin?`), and holds `LINT_NO_PAGES` (around line 96).
- `CommandIo` has `exists` and `readAttachment` in Bun (`local-io.ts`) and
  native (`native-engine.ts`). `isRelativeAttachmentPath` is in
  `apps/cli/src/attachments.ts` or `@nodetto/core`; grep for it.
- `edit-command.ts:runOperations(io, path, operations, options)` reads,
  applies a batch, re-reads, and writes atomically.

## Non-goals

- Do not edit `commands.ts`, `help.ts`, `packages/core/src/index.ts` or any
  existing test. Import clm-03 symbols by relative path.
- No `--metrics` (clm-06). No text-layout rules on erd, state or uml pages
  (Q1). Export warnings do not change. No Rust and no core edits.

## Contract (clm-09 depends on it)

```ts
export const LINT_NO_PAGES_MESSAGE: string; // names the new kinds
export function diagramLintApplies(document: Document, page: Page): boolean; // D page table
export interface DiagramLintRow {
  readonly pageId: PageId; readonly elementId: string;
  readonly severity: "error" | "warning"; readonly ruleId: "node-overlap" | "image-missing"; readonly message: string;
}
export interface DiagramLintResult {
  readonly rows: readonly DiagramLintRow[]; readonly fixes: readonly TextWrapFix[];
  readonly written: boolean; readonly error?: string;
}
export function lintDiagramPages(io: CommandIo, documentPath: string, document: Document,
  options: { pageId?: PageId; fix: boolean; textLayoutPageIds?: readonly PageId[]; format?: "text" | "json" }): DiagramLintResult;
export function formatFixLines(fixes: readonly TextWrapFix[]): string;
```

## File-level changes (`apps/cli/src/lint-diagram.ts`)

1. Page table (design D): `diagramLintApplies` is true for erd, state, uml
   and flowchart pages, and for any page that contains an `image.raster`.
   `LINT_NO_PAGES_MESSAGE` lists BPMN, breadboard, architecture, freeform,
   flowchart, ERD, state and UML pages, and pages with images.
2. node-overlap: for pages whose kind is in `NODE_OVERLAP_PAGE_KINDS`,
   map `lintNodeOverlaps` to rows with severity `warning`.
3. image-missing, for each `image.raster` whose `semantic.src` satisfies
   `isRelativeAttachmentPath`:
   - Join the document directory and `src` with `/` by string operations,
     using `lastIndexOf("/")` on the document path. No `node:path`.
   - `io.exists?.(joined)` false -> reason `file not found`.
   - Otherwise call `io.readAttachment?.(documentPath, src)`. If it throws,
     the reason is
     `cannot be read (outside the document folder, too large, or unreadable)`.
   - Severity `error`, message `image src "<src>" <reason>`. Data URLs are
     skipped, and the check is skipped when `io.readAttachment` is absent.
4. Row order within a page: node-overlap rows, then image-missing rows,
   each by element id.
5. `fix: true`:
   - A document path ending in `.bpmn` -> `error: "--fix needs a nodetto document"`,
     and nothing is written.
   - Call `planTextWrapFixes` for each page in `textLayoutPageIds` (clm-09
     passes the selected text-layout pages).
   - Convert each fix into `{op:"update", id, semantic:{[field]: after}}`
     and run them through `runOperations` with the given format, so the
     write is canonical, atomic and retried on concurrent change. No fixes
     -> nothing written.
   - Re-read the written document, and compute `rows` on the result.
   - `formatFixLines` prints `fixed <element id> <rule-id>: <n> line break(s)`
     per fix, where n is the count of added `\n`.

## Pitfalls

- Bun and native must print identical reason strings. Never include the
  host error text.
- `--fix` never touches text that does not overflow. A second `--fix`
  writes nothing (same file hash).
- An ERD-only document used to fail with `LINT_NO_PAGES`. It now lints.
  clm-09 updates the old assertions.

## Tests (input -> expected), `lint-diagram.test.ts` with an in-memory io

- An ERD document with coincident tables `orders` and `items` -> one
  `node-overlap` warning naming both and the page.
- Contained tables -> 1 row. Touching tables -> none.
- `src` `assets/missing.png` -> an `image-missing` error, `file not found`.
- An existing image -> no row. A data URL -> skipped.
- An io whose `readAttachment` throws -> the `cannot be read` reason.
- A freeform page with overlapping shapes -> no `node-overlap`, and
  `diagramLintApplies` is false unless it has an image.
- `fix: true` on a flowchart node with an overflowing label:
  - the file is rewritten, `fixes` has `before` and `after`;
  - a second run writes nothing (same hash).
- `fix: true` with a `.bpmn` path -> `error`, nothing written.
- Nothing to fix -> `written: false`.

## Verification (each must exit 0)

1. `bun test apps/cli/src/lint-diagram.test.ts`: more than 0 tests run, and
   all pass.
2. `bun test apps/cli/src/text-layout-lint.test.ts apps/cli/src/breadboard-commands.test.ts apps/cli/src/bpmn-commands.test.ts`:
   existing lint behavior is unchanged (nothing is wired yet).
3. `bun run typecheck`.
4. `bunx biome check apps/cli/src/lint-diagram.ts apps/cli/src/lint-diagram.test.ts`.

## Done criteria

- The contract symbols exist, and verification 1 to 4 exit 0 with logs
  under `tmp/clm-s725/clm-08-lint-cli/`.
- `git status --short` shows only writePaths changed.
