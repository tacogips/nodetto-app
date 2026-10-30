# tll-06-overview: text-layout lint revision (Q1 page kinds, Q2 wide width)

- planId: tll-06-overview (coordination only; no writePaths)
- Design, accepted by step 3 with no revision needed:
  `design-docs/specs/design-text-layout-lint.md` (Status: REVISED,
  2026-10-30).
- User QA: `design-docs/user-qa/text-layout-lint.md`. Q1 and Q2 are
  RESOLVED. Q3 and Q4 stay at their defaults.
- Sessions: opus-terra-design-and-implement-review-loop-session-552
  (tll-07 and tll-08 accepted, tll-09 implemented) and session-555
  (continuation: review tll-09, implement tll-10 and tll-11). The s555
  dispatch manifest is `impl-plans/active/text-layout-lint-s555-dispatch.json`.
- Issue: none (workflowInput only).
- gitPush=false. Base 45cc69f, which already implements the first version
  of the lint (plans tll-00..05, session 551). Session 555 starts at
  5b65f96.
- Scratch root for session 555: `tmp/text-layout-lint-s555/<planId>/`
  (git-ignored). Session 552 logs stay under `tmp/text-layout-lint-s552/`.
  Never put `*.test.ts` files under `tmp/`.
- Progress logs: `impl-plans/progress/<planId>.md`.

## Intent

The text-layout lint (`label-overflow`, `label-collision`, `note-overflow`)
is already committed. This revision applies two owner decisions:

- Q1: lint and export warnings cover `architecture`, `freeform` and
  `flowchart` pages, not only `architecture`.
- Q2: label and note line-width checks count East Asian Wide (`W`) and
  Fullwidth (`F`) graphemes at 1.0 em, and other graphemes at the export's
  0.55 em. This is done by a new lint-only helper. Export wrapping and all
  export bytes stay identical.

The revision also adds native parity for a wide label and for freeform and
flowchart pages. After final verification, the tll plans are archived.

## Waves and ownership

Session 552 (done): tll-07-wide-width and tll-08-help-docs are accepted at
5b65f96 and are not dispatched again. tll-09-core-rules is implemented at
5b65f96 but not yet reviewed.

Session 555 waves (strictly serial, see design "Rollout constraints",
"Verification order"):

| Wave | Plan | Depends on | Owns (summary) |
| --- | --- | --- | --- |
| - | tll-07-wide-width | - | accepted: `packages/core/src/wide-text-width.ts` and its test; the `export` keyword on `graphemes` in `text-layout.ts` |
| - | tll-08-help-docs | - | accepted: `apps/cli/src/help.ts`, `docs/cli.md` |
| 1 | tll-09-core-rules | 07 | re-validate and repair only if needed: `packages/core/src/text-layout-lint/rules.ts`, `rules.test.ts`, `engine.test.ts`, CLI fixture `apps/cli/src/__fixtures__/text-layout.ts` |
| 2 | tll-10-cli-lint-export | 09 | `LINT_NO_PAGES` in `apps/cli/src/commands.ts`, `text-layout-lint.test.ts`, `text-layout-export.test.ts`, `breadboard-commands.test.ts` |
| 3 | tll-11-native-parity | 09, 10 | one new block appended to `apps/cli/src/native-parity.test.ts` |

Why waves:

- 07 pins the helper API that 09 imports.
- 08 touches only help and docs text, so it is independent.
- 09 changes `TEXT_LAYOUT_LINT_PAGE_KINDS` and the rule logic, and adds the
  wide fixture that 10 and 11 consume. It goes through review in wave 1
  of session 555.
- 10 owns every CLI test file that changes because freeform becomes
  lintable. It is the first plan whose gate runs all of
  `bun test apps/cli/src`.
- 11 runs after 10 because `mise run test-cli` runs all of
  `bun test apps/cli/src`. Its gate therefore never waits on a concurrent
  or later plan, and it is never recorded as `pending-join`.

Known transient state: after 09 and before 10 is done, these three CLI
tests fail because freeform becomes lintable:

- `apps/cli/src/text-layout-lint.test.ts` "freeform pages are not lintable
  or selectable" (:87);
- `apps/cli/src/text-layout-export.test.ts` "layout warnings exclude
  freeform, element, clean and semantic exports" (:104);
- `apps/cli/src/breadboard-commands.test.ts` "lint reports the combined
  no-page message" (:141-160).

10 fixes them, and 09 must not edit them. No other CLI test changes:
`export-command.test.ts` and `commands.test.ts` export freeform and
flowchart pages, but they check stderr only with `toContain`, and their
elements have no layout findings.

## Pinned cross-plan contracts

From `packages/core/src/wide-text-width.ts` (tll-07). It is not exported from
`@nodetto/core`'s index. Import it relatively, only from
`text-layout-lint/rules.ts`.

```ts
export const WIDE_GLYPH_WIDTH = 1;
export const EAST_ASIAN_WIDE_RANGES: readonly number[]; // flat inclusive [start, end] pairs, for tests
export function isWideCodePoint(codePoint: number): boolean;
export function wideAwareTextWidth(text: string, fontSize: number, letterSpacing?: number): number;
export function wideAwareLineCount(line: string, maxWidth: number, fontSize: number, letterSpacing?: number): number;
```

From `packages/core/src/text-layout.ts` (tll-07):
`export function graphemes(text: string): string[]` (export keyword only).

From `@nodetto/core` (tll-09):
`TEXT_LAYOUT_LINT_PAGE_KINDS` equals `["architecture", "freeform", "flowchart"]`.
The rest of the index surface is unchanged.

From `apps/cli/src/__fixtures__/text-layout.ts` (tll-09). The existing
exports are unchanged (builders return `string`; page id
`page-architecture`, page name `Architecture` for every kind). Additions:

```ts
export function textLayoutWideDocument(kind?: string): string; // default "architecture"
export const TEXT_LAYOUT_WIDE_EXPECTED: readonly { readonly ruleId: string; readonly elementId: string }[];
```

Wide fixture element ids: `node-wide`, `node-ascii`, `geo-wide`,
`note-wide`. Expected lint order: `label-overflow node-wide`,
`label-overflow geo-wide`, `note-overflow note-wide` (twice).

`LINT_NO_PAGES` text (tll-10):
`The document contains no BPMN, breadboard, architecture, freeform or flowchart pages.`

Export stderr line format (unchanged):
`warning: ${ruleId} ${elementId}: ${message}\n`.

## Per-worker protocol (every plan)

1. Before editing a file, read it fresh and record its sha256
   (`shasum -a 256 <path>`) in your progress log. Record it again after the
   edit.
2. Before the first edit, write an intent snapshot to your progress log:
   what you will change and why.
3. Drift: if a file changes since your last read and you did not change it,
   stop editing that file and record the drift. Never overwrite another
   plan's edits. Repair happens serially after the wave joins.
4. Edit only your `writePaths`.
   - No state-changing git commands (`add`, `commit`, `stash`, `checkout`,
     `reset`, `switch`, `branch`, `worktree`).
   - Read-only `git diff` and `git status` are fine.
5. No workspace-wide formatters. Format only your own files with
   `bunx biome format --write <files>`, and check them with
   `bunx biome check <files>`.
6. Edit only your own progress log. Record each verification command, its
   exit code, the full log path under the scratch root and the key output
   lines.
7. Logging rules:
   - Run commands in the foreground.
   - No `&`, `nohup` or `tee`.
   - Redirect output to a log, for example
     `<cmd> > tmp/text-layout-lint-s555/<planId>/x.log 2>&1; echo "exit=$?"`.
   - Run bun tests with `BUN_OPTIONS=--jsx-runtime=classic`.
   - Run any cargo command with `CARGO_TERM_QUIET=true`.
8. Shared-input gates are commands that read files a same-wave or
   later-wave sibling may be editing:
   - repo-wide `bun run typecheck`;
   - `bun test apps/cli/src` beyond your own test files;
   - `mise run test-cli`.

   In session 555 the waves are serial, so no sibling edits these inputs
   while a gate runs. A gate counts as a pass only when every earlier plan
   it reads has `STATUS: done` as the last line of its progress log. If a
   failure traces to another plan's file, record it and the owning plan,
   and do not edit that file. Never fix a failure by editing a file that a
   later plan owns.
9. When all of your work and checks are complete, write `STATUS: done` as
   the last line of your progress log, and nothing after it.

## Global non-goals and invariants (every plan)

- Do not touch these:
  - `packages/io/src/bpmn`;
  - any file under `packages/core/src/svg-export/`;
  - `packages/core/src/label-layout.ts`, `node-label.ts` and
    `shapes/connector/*`.
- In `packages/core/src/text-layout.ts`, the only allowed change is the
  `export` keyword on `graphemes` (tll-07). `wrapTextLines`, `glyphAdvance`,
  `estimatedTextWidth`, `measureTextNote` and the constants stay
  byte-identical.
- No change under `apps/cli/native/**`, `Cargo.toml` or `Cargo.lock`. No new
  golden JSONL under `packages/io/src/__fixtures__`. No change to
  `examples/**`.
- Exported SVG, PNG and PDF bytes must not change for any document. The
  existing export, golden and snapshot tests must pass unchanged.
- Existing BPMN and breadboard lint output and order must not change. Rule
  ids stay `label-overflow`, `label-collision` and `note-overflow`. Lint exit
  codes must not change.
- Out of scope:
  - wide-aware `label-collision` or note proximity;
  - wide-aware label height;
  - new JSON fields;
  - configuration and export `--strict` (Q4);
  - `--element` warnings (Q3);
  - page kinds other than the three.
- Fixtures are self-authored and generic. Do not use any external issue,
  customer, organisation, person, product or file name. No emojis in source
  text, docs or logs. Test code may use `\u{...}` escapes where a code point
  needs pinning.
- No version bump, no release, no commit, no push.

## Serial finalization (not owned by any worker plan)

After the integration review passes, the workflow finalization does the
following:

- Run the full verification on the combined tree:
  - `bun test packages/core packages/io apps/cli/src`;
  - `bun run typecheck`;
  - `mise run lint-ts`;
  - `mise run check`;
  - `CARGO_TERM_QUIET=true mise run test-cli`, with non-zero tests run and
    none skipped in `native-parity.test.ts`.
- Archive the plans per `impl-plans/README.md`:
  - move `tll-00`..`tll-11` from `impl-plans/active/` to
    `impl-plans/completed/`;
  - keep the progress logs in `impl-plans/progress/`;
  - keep `text-layout-lint-s551-dispatch.json`,
    `text-layout-lint-s552-dispatch.json` and
    `text-layout-lint-s555-dispatch.json` in `active/` with their
    pre-archive `planPath` values;
  - add a Completed section with a plan table and verification outcomes to
    `impl-plans/README.md`, and name the text-layout manifests in its list
    of historical manifests.

## Final verification (combined tree)

| Command | Must show |
| --- | --- |
| `bun test packages/core/src/wide-text-width.test.ts packages/core/src/text-layout-lint apps/cli/src` | exit 0, 0 fail |
| `bun test packages/core packages/io` | exit 0, 0 fail (export goldens unchanged) |
| `bun run typecheck` | exit 0 |
| `mise run lint-ts` | exit 0 |
| `mise run check` | exit 0 |
| `CARGO_TERM_QUIET=true mise run test-cli` | exit 0; the new parity block ran (not skipped) |
| `grep -rln "wide-text-width" packages apps --include=*.ts` | only `packages/core/src/text-layout-lint/rules.ts` and `packages/core/src/wide-text-width.test.ts` |
| `git diff --stat 45cc69f -- packages/core/src/svg-export packages/core/src/label-layout.ts packages/core/src/node-label.ts packages/io/src apps/cli/native Cargo.toml Cargo.lock` | empty |
