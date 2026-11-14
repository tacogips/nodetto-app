# tll-00-overview: text-layout lint for architecture pages

- planId: tll-00-overview (coordination only; no writePaths)
- Design, accepted by step 3 with no revision needed:
  `design-docs/specs/design-text-layout-lint.md`.
- User QA: `design-docs/user-qa/text-layout-lint.md` Q1-Q4. Implement the
  defaults.
- Session: opus-terra-design-and-implement-review-loop-session-551.
- Issue: none (workflowInput only).
- gitPush=false. Base a9728e6.
- Scratch root: `tmp/text-layout-lint-s551/<planId>/` (git-ignored). Never put
  `*.test.ts` files there.
- Progress logs: `impl-plans/progress/<planId>.md`.

## Intent

Make text-layout problems on `architecture` pages visible from
`nodetto-cli`. Today they can only be seen in an exported PNG.

- A new core lint, `lintTextLayoutPage`, has three warning rules:
  - `label-overflow`;
  - `label-collision`;
  - `note-overflow`.
- It reuses the SVG export's own layout functions and element boxes.
- `nodetto-cli lint` lints architecture pages next to BPMN and breadboard
  pages.
- `nodetto-cli export --format svg|png|pdf` of a whole architecture page
  prints the same findings as `warning: <ruleId> <elementId>: <message>`
  lines on stderr. Its output does not change.

## Waves and ownership

| Wave | Plan | Depends on | Owns (summary) |
| --- | --- | --- | --- |
| 1 | tll-01-core-lint | - | `packages/core/src/text-layout-lint/*`, `estimatedTextWidth` in `text-layout.ts`, core `index.ts` export lines, the CLI fixture builder `apps/cli/src/__fixtures__/text-layout.ts` |
| 1 | tll-02-cli-help-docs | - | `apps/cli/src/help.ts` (overview, lint, export), `docs/cli.md` lint sentence |
| 2 | tll-03-cli-lint | 01 | `lintCommand` in `apps/cli/src/commands.ts`, `LINT_NO_PAGES`, two strings in `breadboard-commands.test.ts`, new `text-layout-lint.test.ts` |
| 2 | tll-04-cli-export | 01 | `apps/cli/src/export-command.ts` warnings, new `text-layout-export.test.ts` |
| 3 | tll-05-native-parity | 03, 04 | `apps/cli/src/native-parity.test.ts` text-layout cases |

Why waves:

- 01 pins the core API and the shared fixture. It checks the fixture
  against the real lint, so later waves can assert an exact finding set.
- 03 and 04 edit different files and only consume 01.
- 05 compares the TS and native CLIs for lint and export, so it needs both
  03 and 04.

## Pinned cross-plan contracts

From `@nodetto/core` (tll-01):

```ts
export const TEXT_LAYOUT_LINT_RULE_IDS: readonly ["label-overflow", "label-collision", "note-overflow"];
export type TextLayoutLintRuleId = (typeof TEXT_LAYOUT_LINT_RULE_IDS)[number];
export const TEXT_LAYOUT_LINT_PAGE_KINDS: readonly PageKind[]; // ["architecture"]
export interface TextLayoutLintFinding { readonly elementId: ElementId; readonly ruleId: TextLayoutLintRuleId; readonly severity: "warning"; readonly message: string }
export function lintTextLayoutPage(document: Document, pageId: PageId): readonly TextLayoutLintFinding[];
export function estimatedTextWidth(text: string, fontSize: number, letterSpacing?: number): number;
```

From `apps/cli/src/__fixtures__/text-layout.ts` (tll-01):

```ts
export const TEXT_LAYOUT_PAGE_ID = "page-architecture"; // page name "Architecture"
export interface TextLayoutFixture { readonly source: string; readonly pageId: string }
export function textLayoutCleanDocument(kind?: PageKind): TextLayoutFixture;   // default "architecture"
export function textLayoutProblemDocument(kind?: PageKind): TextLayoutFixture; // default "architecture"
export function textLayoutDenseDocument(count: number): TextLayoutFixture;
export const TEXT_LAYOUT_EXPECTED: readonly { readonly ruleId: string; readonly elementId: string }[]; // problem doc findings, lint order
```

Element ids in the problem document are fixed strings, listed in tll-01
"Fixture layout".

The export stderr line format is
`warning: ${ruleId} ${elementId}: ${message}\n`.

`LINT_NO_PAGES` text is
`The document contains no BPMN, breadboard or architecture pages.`

## Per-worker protocol (every plan)

1. Before editing a file, read it fresh and record its sha256
   (`shasum -a 256 <path>`) in your progress log. Record it again after the
   edit.
2. Before the first edit, write an intent snapshot to your progress log:
   what you will change and why.
3. Drift: if a file changes since your last read and you did not change it,
   stop editing that file and record the drift. Never overwrite another
   plan's edits. Repair happens serially after the wave joins.
4. Edit only your `writePaths`, and your `sharedPaths` exactly as the plan
   allows.
   - No state-changing git commands (`add`, `commit`, `stash`, `checkout`,
     `reset`, `switch`, `branch`).
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
   - Redirect output to a log, for example `<cmd> > tmp/text-layout-lint-s551/<planId>/x.log 2>&1; echo "exit=$?"`.
   - Run any cargo command with `CARGO_TERM_QUIET=true`.
   - Run bun tests with `BUN_OPTIONS=--jsx-runtime=classic`.
8. Shared-input gates are commands that read files a same-wave sibling may
   be editing: repo-wide `bunx tsc -p tsconfig.json --noEmit`, and
   `bun test apps/cli/src` beyond your own test files.
   - A gate counts as a pass only when each such sibling has `STATUS: done`
     as the last line of its progress log.
   - If a failure traces to a sibling's file, record it and the owning plan.
     Do not edit that file.
   - If the sibling is not done when you finish, record the gate as
     `pending-join` with its owner.
9. When all of your work and checks are complete, write `STATUS: done` as
   the last line of your progress log, and nothing after it.

## Global non-goals and invariants (every plan)

- Do not touch these:
  - `packages/io/src/bpmn` (a parallel branch is changing it);
  - any file under `packages/core/src/svg-export/`;
  - `packages/core/src/label-layout.ts`, `node-label.ts` and
    `shapes/connector/*`;
  - `apps/cli/native/**`;
  - `packages/io/src/__fixtures__/**`;
  - `examples/**`.
- Exported SVG, PNG and PDF bytes must not change. Existing BPMN and
  breadboard lint output and order must not change. Lint exit codes must not
  change (0 clean or warnings, 1 error findings, 2 usage, parse or config).
- Out of scope (user-qa defaults Q1-Q4):
  - new JSON fields;
  - configuration;
  - export `--strict`;
  - other page kinds;
  - `--element` warnings;
  - real-font measurement.
- Test data are self-authored and generic: "Payment gateway", "HTTPS",
  "gRPC", "Audit log", "Private network", "Retry policy", "Message queue".
  They never name any external issue, customer, organisation, person,
  product or file.
- English only, no emojis.
- No version bump, no release.

## Final verification (serial, after wave 3, owned by reconciliation)

- `bun run typecheck` exits 0.
- `mise run lint-ts` exits 0.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/text-layout-lint`
  exits 0.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core apps/cli/src`
  exits 0.
- `CARGO_TERM_QUIET=true mise run check` exits 0.
- `BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run test-cli`
  exits 0, and the native parity text-layout tests run (not skipped).
- `git diff --quiet a9728e6 -- packages/io/src/bpmn packages/core/src/svg-export packages/core/src/label-layout.ts packages/core/src/node-label.ts apps/cli/native packages/io/src/__fixtures__`
  exits 0.
- Every `pending-join` gate in any tll progress log is rerun and passes.
- `git status --short` shows nothing outside the union of the plans'
  writePaths, `impl-plans/` and the design docs.
- During finalization, reconciliation adds a "Text-layout lint" entry to
  `impl-plans/README.md`. This is not a worker task.
