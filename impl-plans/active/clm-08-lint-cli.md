# clm-08-lint-cli

- planId: clm-08-lint-cli
- planPath: impl-plans/active/clm-08-lint-cli.md
- progressPath: impl-plans/progress/clm-08-lint-cli.md
- wave: 3
- dependsOn: clm-03-lint-core (provides `lintNodeOverlaps`,
  `planTextWrapFixes` and `NODE_OVERLAP_PAGE_KINDS`) and
  clm-04-edit-usability (`warnings.ts`, `--quiet`, and the wave-2 owner of
  the shared CLI files).
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, section D
  ("Page selection", D1, D2, D3) and the D rows of "Verification". Owner
  questions Q1 (text-layout rules only on their existing page kinds) and Q4.
- writePaths:
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/lint-fix.ts` (new)
  - `apps/cli/src/lint-images.ts` (new)
  - `apps/cli/src/lint-rules.test.ts` (new)
  - `apps/cli/src/text-layout-lint.test.ts`
  - `apps/cli/src/breadboard-commands.test.ts`. It asserts the
    `LINT_NO_PAGES` wording; update only that assertion.
  - `apps/cli/src/native-parity/lint-rules.test.ts` (new)
  - `apps/cli/src/help.ts`
  - `apps/cli/src/ai-commands.test.ts`
  - `docs/cli.md`
  - `README.md`
  - `impl-plans/progress/clm-08-lint-cli.md`
  - `tmp/clm-s725/clm-08-lint-cli`
  - `target`
- artifactRoots: `target`

## Intent and context

`lint` gains three things: it lints ERD, state and UML pages for overlapping
nodes, it reports missing images, and `--fix` wraps overflowing text.

- `commands.ts:lintCommand` (about lines 246-430) selects pages and maps
  rule outputs into `LintFindingRow`.
- `LINT_NO_PAGES` is at about line 96.
- `CommandIo` has `exists` and `readAttachment` in both Bun
  (`local-io.ts`) and native (`native-engine.ts`).
- The edit write path, `edit-command.ts:runOperations`, reads, applies a
  batch, re-reads and writes atomically.

## Non-goals

- No `--metrics` (clm-09).
- No text-layout rules on erd, state or uml pages (Q1 default).
- Export warnings do not change.
- No Rust, and no core edits.

## File-level changes

1. `commands.ts:lintCommand`
   - Page selection follows the design D table: add erd, state and uml, and
     any page that contains an `image.raster`.
   - Per page:
     - bpmn and breadboard: unchanged, plus image findings;
     - text-layout kinds: unchanged, plus `node-overlap` on flowchart, plus
       images;
     - erd, state and uml: `node-overlap` and images;
     - other kinds that have images: images only.
   - Findings within a page are sorted the same way as today: rule output
     order, then the appended rules in the order node-overlap, then
     image-missing.
   - Update `LINT_NO_PAGES` to name the new kinds.
   - Add the flag `--fix`. With a `.bpmn` input it exits 2 with
     `--fix needs a nodetto document`.
2. `lint-images.ts`:
   `lintImages(io, documentPath, document, pageId): LintFindingRow[]`.
   - Applies to `image.raster` elements with `isRelativeAttachmentPath(src)`.
   - Build the path by joining the document's directory and `src` with `/`
     by string operations. Use the `lastIndexOf("/")` of the document path;
     do not use `node:path`.
   - If `!io.exists?.(joined)`, the reason is `file not found`.
   - Otherwise try `io.readAttachment?.(documentPath, src)`. If it throws,
     the reason is
     `cannot be read (outside the document folder, too large, or unreadable)`.
   - Rule id `image-missing`, severity `error`, message
     `image src "<src>" <reason>`.
   - Data URLs are skipped. When `io.readAttachment` is missing, the check
     is skipped.
3. `lint-fix.ts`: `lintFix(io, path, pageIds, format)`.
   - Call `planTextWrapFixes` per selected text-layout page.
   - Convert each fix into an update operation,
     `{op:"update", id, semantic:{[field]: after}}`.
   - Run the operations through `runOperations` (`edit-command.ts`), so the
     write is canonical, atomic and retried on concurrent change.
   - Nothing is written when there are no fixes.
   - Then re-lint the written file, and report the fixed lines plus the
     remaining findings. Text: `fixed <element id> <rule-id>: <n> line break(s)`.
     JSON: add `fixes: [{pageId, elementId, ruleId, field, before, after}]`
     to the existing report shape.
   - The exit code follows the remaining error findings.
4. `help.ts` (`lint`):
   - the page and rule table;
   - `node-overlap` (warning) and `image-missing` (error);
   - `--fix`, its behavior and idempotency;
   - the CJK break rules in one sentence.
5. `docs/cli.md` and `README.md`: matching text, and a `lint --fix` example.

## Pitfalls

- A document whose only pages are ERD pages previously failed with
  `LINT_NO_PAGES`. It now lints. Update any assertion of the old behavior in
  `text-layout-lint.test.ts` and record it.
- Bun and native must print identical reason strings. Never include the
  host error message.
- `--fix` must not touch text that does not overflow. A second `--fix` must
  write nothing: the file hash is unchanged.
- Keep the JSON report field order and existing fields. Only add `fixes`
  when `--fix` is given.

## Tests (input -> expected)

`lint-rules.test.ts`, with an in-memory io:
- A pure ERD document with two coincident tables `orders` and `items` ->
  exit 0, one `node-overlap` warning naming both and the page.
- Contained tables -> 1 finding. Touching tables -> none.
- An image whose `src` is `assets/missing.png` -> exit 1, `image-missing`
  `file not found`.
- An existing image -> no finding.
- A data URL -> skipped.
- A freeform page with overlapping shapes -> no `node-overlap`.
- `lint --fix` on a flowchart node with an overflowing label:
  - the file is rewritten, the report lists the fix, and a re-lint has no
    width finding;
  - a second run writes nothing (same hash);
  - with `--format json`, `fixes` has `before` and `after`.
- `--fix` with a `.bpmn` input -> exit 2.
- `--fix` on a document with nothing to fix -> nothing written.

`native-parity/lint-rules.test.ts` (`compare` from `harness.ts`, in temp
dirs): the ERD overlap, the missing image (including a file that escapes
the document folder) and `--fix`. The fixed file content must match.

## Verification (each must exit 0)

1. `bun test apps/cli/src/lint-rules.test.ts apps/cli/src/text-layout-lint.test.ts apps/cli/src/breadboard-commands.test.ts apps/cli/src/bpmn-commands.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/commands.test.ts`.
2. `bun run typecheck`.
3. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/lint-rules.test.ts apps/cli/src/native-parity/text-layout.test.ts`.
   It must run more than 0 tests, and all must pass. Use up to 3 attempts
   on a deadline timeout.
4. `bunx biome check <owned TS files>`.

## Done criteria

- Verification commands 1 to 4 exit 0, with their logs recorded.
- `git diff --stat` shows only writePaths. (`commands.test.ts` is only run,
  not edited. If it needs a change, stop and record drift.)
