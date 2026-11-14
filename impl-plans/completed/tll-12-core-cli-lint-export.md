# tll-12-core-cli-lint-export

- planId: tll-12-core-cli-lint-export
- planPath: impl-plans/active/tll-12-core-cli-lint-export.md
- progressPath: impl-plans/progress/tll-12-core-cli-lint-export.md
- wave: 1 in session 556 (alone in its wave)
- dependsOn: none. The accepted dependencies are tll-07 (wide-width helper)
  and tll-08 (help and docs), both in the tree at base `fd2083b`.
- Design: `design-docs/specs/design-text-layout-lint.md`. The sections are
  "Module", "Rule `label-overflow`", "Rule `note-overflow`", "Spatial
  prefilter and determinism", "CLI: `nodetto-cli lint`", "CLI:
  `nodetto-cli export`", "Help text and CLI docs", "Test plan" and
  "Rollout constraints" (plan structure). Owner decisions are in
  `design-docs/user-qa/text-layout-lint.md` (Q1 and Q2 resolved).
- This one plan replaces the separate tll-09 review and tll-10 plans. Do
  not open or follow `tll-09`/`tll-10` as task lists, but you may read them
  as history.

## Intent and context

The text-layout lint revision is done except for the CLI. At base
`fd2083b`:

- the following are in the tree:
  - `packages/core/src/wide-text-width.ts` (accepted);
  - the help text in `apps/cli/src/help.ts:480-495` and `docs/cli.md:36-42`
    (accepted);
  - the core rule changes in `packages/core/src/text-layout-lint/`
    (implemented, not reviewed);
  - the fixtures `textLayoutWideDocument` and `TEXT_LAYOUT_WIDE_EXPECTED`
    in `apps/cli/src/__fixtures__/text-layout.ts`;
- `TEXT_LAYOUT_LINT_PAGE_KINDS` (`rules.ts:21`) is already
  `["architecture", "freeform", "flowchart"]`. `lintCommand`
  (`apps/cli/src/commands.ts:291-307`) and the export gate
  (`apps/cli/src/export-command.ts:337`) already read it, so freeform and
  flowchart pages are already lintable;
- the user-visible message `LINT_NO_PAGES` (`commands.ts:96-97`) is stale,
  and three CLI tests still encode the architecture-only behavior, so they
  fail:
  - `apps/cli/src/text-layout-lint.test.ts:87` "freeform pages are not
    lintable or selectable";
  - `apps/cli/src/text-layout-export.test.ts:104` "layout warnings exclude
    freeform, element, clean and semantic exports";
  - `apps/cli/src/breadboard-commands.test.ts:141` "lint reports the
    combined no-page message".

This plan does four things:

1. reviews the core rule implementation against the design item by item,
   and fixes any mismatch;
2. updates `LINT_NO_PAGES`;
3. updates and extends the CLI tests;
4. confirms that help and docs match.

All its gate commands exit 0 once this plan alone is done.

## Non-goals

- Do not change the export geometry or export wrapping. Do not touch:
  - `packages/core/src/svg-export/**`;
  - `packages/core/src/text-layout.ts`;
  - `packages/core/src/label-layout.ts`;
  - `packages/core/src/node-label.ts`;
  - `packages/core/src/wide-text-width.ts` and its test (accepted tll-07; a
    defect there is reported, not fixed here);
  - `packages/core/src/index.ts`;
  - `packages/io/**` (in particular `packages/io/src/bpmn`);
  - `apps/cli/native/**`, `Cargo.toml`, `Cargo.lock`.
- Do not change `apps/cli/src/export-command.ts`, `selectPage`,
  `.bpmnlintrc`/`--config` handling, the lint JSON shape or exit codes. If
  the review finds that one of these must change, stop, record it as a
  design contradiction in the progress log, and do not edit it.
- Do not edit `apps/cli/src/native-parity.test.ts`. tll-13 owns it.
- Wide-aware `label-collision`, note proximity or label height, new JSON
  fields, lint configuration, export `--strict` (Q4) and `--element`
  warnings (Q3) are out of scope. So are page kinds beyond the three.
- Do not add a golden JSONL under `packages/io/src/__fixtures__` or change
  `examples/**`.
- No version bump, no release, no commit, no push.
- Do not touch `impl-plans/active/**`, `impl-plans/completed/**` or
  `impl-plans/README.md`. Archival is serial finalization.

## writePaths

- packages/core/src/text-layout-lint/rules.ts (review; fix only on mismatch)
- packages/core/src/text-layout-lint/engine.ts (review; fix only on mismatch)
- packages/core/src/text-layout-lint/index.ts (review; fix only on mismatch)
- packages/core/src/text-layout-lint/rules.test.ts (review; fix only on mismatch)
- packages/core/src/text-layout-lint/engine.test.ts (review; fix only on mismatch)
- apps/cli/src/commands.ts
- apps/cli/src/text-layout-lint.test.ts
- apps/cli/src/text-layout-export.test.ts
- apps/cli/src/breadboard-commands.test.ts
- apps/cli/src/__fixtures__/text-layout.ts (only if a CLI test needs it)
- apps/cli/src/help.ts (only on mismatch with the design)
- docs/cli.md (only on mismatch with the design)
- impl-plans/progress/tll-12-core-cli-lint-export.md
- tmp/text-layout-lint-s556/tll-12-core-cli-lint-export
- target (artifact root: the cargo output written by `mise run check`)

sharedPaths: none. artifactRoots: `target`. It is git-ignored
(`.gitignore:12`) and holds no source.

## Per-worker protocol

1. Before editing a file, read it fresh and record
   `shasum -a 256 <path>` in the progress log. Record it again after the
   edit.
2. Before the first edit, write an intent snapshot to the progress log:
   what you will change and why.
3. Drift: if a file changes since your last read and you did not change
   it, stop editing that file and record the drift. Never overwrite it.
   Repair happens serially after the join.
4. Edit only your writePaths.
   - No state-changing git commands (`add`, `commit`, `stash`, `checkout`,
     `reset`, `switch`, `branch`, `worktree`).
   - Read-only `git diff` and `git status` are fine.
5. Format only your own edited files with
   `bunx biome format --write <files>`. No workspace-wide formatters.
6. Run every command in the foreground. Redirect output to a log under
   `tmp/text-layout-lint-s556/tll-12-core-cli-lint-export/`. Record the
   command, the exit code, the full log path and the key output lines.
   - No `&`, `nohup` or `tee`.
   - Prefix bun tests with `BUN_OPTIONS=--jsx-runtime=classic`.
   - Prefix cargo with `CARGO_TERM_QUIET=true`.
   - Never write a `*.test.ts` file under `tmp/`.
7. No emojis anywhere. Fixtures stay self-authored and generic.
8. The last line of the progress log is `STATUS: done`, written only when
   every verification command below has exited 0.

## File-level changes

### A. Core rule review (`packages/core/src/text-layout-lint/`)

Write one matches/differs line per item in the progress log, citing the
`file:line` you read. Fix only items that differ, and keep each fix inside
these files.

1. `rules.ts:21`: `TEXT_LAYOUT_LINT_PAGE_KINDS` equals
   `["architecture", "freeform", "flowchart"]`, typed
   `readonly PageKind[]`.
2. `rules.ts` imports `wideAwareTextWidth` and `wideAwareLineCount` from
   `"../wide-text-width.ts"`. It has no unused imports.
3. `labelOverflow` width check: the first rendered line with
   `line.trim() !== ""` and
   `wideAwareTextWidth(line, fontSize, letterSpacing) > A + EPS`. The two
   message templates match design "Rule `label-overflow`" exactly. The node
   ending is `export clips it.` and the geo ending is
   `export draws it past the label padding.` The height check and its
   messages are unchanged: it uses the export's line count, not a
   wide-aware count.
4. The note loop computes the wrap width as one hoisted local
   `A = Math.max(1, box.width - 2 * paddingX)`, and the same value is
   passed to `wrapTextLines`. It checks lines in this order:
   - Clipped, when `drawn < n`; message unchanged.
   - Wide line: only the first drawn line (`i < drawn`) with
     `trim() !== ""` and width `> A + EPS`, with the design message.
   - Wide wrapped height, only when `drawn === n`:
     - `n'` is the sum of `wideAwareLineCount` over all lines;
     - it uses separate `wideFree`/`wideOffset` values with the same
       `verticalAlign` formula, and must not reuse `free`/`offset`;
     - the condition is `py + wideOffset + n' * lh > box.height + EPS`;
     - the message is the design's.
   - Both wide checks run before the rotated-note `continue`. Proximity
     (finding 4) is unchanged.
5. `engine.ts` and `index.ts`: `git diff 45cc69f -- <file>` is empty.
   Output order is element page order, then the rule-id order, then the
   message `localeCompare`, with exact duplicates dropped.
6. `engine.test.ts` pins the three page kinds. `rules.test.ts` keeps every
   pre-existing test unchanged and has the `describe("wide characters")`
   cases:
   - 195 vs 120 for the node;
   - 195 vs 124 for the geo shape;
   - 182 vs 104 and 3 lines 58.8 vs 44 for the note;
   - the 120x80 note gives only the wide-line finding;
   - all `verticalAlign` variants;
   - ASCII 200x21.6 note -> no finding;
   - renderer agreement (one `<text>` line for `node-wide`).
7. The fixture module exports `textLayoutWideDocument(kind = "architecture")`
   and `TEXT_LAYOUT_WIDE_EXPECTED`. Lint order gives `node-wide`,
   `geo-wide`, `note-wide` and `note-wide`, with `node-ascii` clean. The
   existing `TEXT_LAYOUT_EXPECTED` is unchanged.

Pitfall: a "fix" that makes a failing CLI test pass by touching export
geometry or `wrapTextLines` is forbidden. If a fix seems to need such a
change, stop and record a design contradiction.

### B. `apps/cli/src/commands.ts`

- `LINT_NO_PAGES` (:96-97) becomes exactly
  `"The document contains no BPMN, breadboard, architecture, freeform or flowchart pages."`.
- Change nothing else. The filter at :291-296 and the report mapping at
  :340-366 already match "CLI: `nodetto-cli lint`". Record that they were
  confirmed.

### C. `apps/cli/src/breadboard-commands.test.ts` (:141-160)

- The no-page document becomes a `uml` page: `"pageKind":"uml"`, page id
  `page-uml`, a generic name such as `Classes`. Rename the variable to
  match.
- Both expected strings become the new `LINT_NO_PAGES`. Keep the test
  name.
- With no lintable page, `lint <file> --page missing` fails with
  `LINT_NO_PAGES` before `selectPage` is reached.

### D. `apps/cli/src/text-layout-lint.test.ts`

Replace the test at :87-106 with two tests, and add a third. Reuse the
local `lint(source, ...options)` helper (:13).

- "freeform and flowchart pages are lintable and selectable":
  - for each `kind` in `freeform` and `flowchart`,
    `lint(textLayoutProblemDocument(kind), "--format", "json")` exits
    `EXIT_OK`, and the findings' `{ruleId, elementId}` equal
    `TEXT_LAYOUT_EXPECTED`;
  - `lint(textLayoutProblemDocument(kind), "--page", "Architecture")` gives
    the same stdout as the `architecture` document. The page name is
    always `Architecture`;
  - an `Editor` document with only `createPage({ name: "Notes", kind: "freeform" })`
    and `--page Notes` exits `EXIT_OK` with stdout `""`.
- "other page kinds are not lintable or selectable":
  - `lint(textLayoutProblemDocument("uml"))` exits `EXIT_ERROR`, and stderr
    contains the new `LINT_NO_PAGES`;
  - an architecture problem document plus `createPage({ name: "Classes", kind: "uml" })`
    with `--page Classes` exits `EXIT_ERROR` with stdout `""`.
- "wide characters are reported with measured and available widths":
  - `lint(textLayoutWideDocument(), "--format", "json")` exits `EXIT_OK`,
    and its `{ruleId, elementId}` list equals `TEXT_LAYOUT_WIDE_EXPECTED`;
  - the `node-wide` message is exactly
    `Label line 1 of 1 is 195 wide but the text area is 120 wide at 13px; export clips it.`;
  - there is no finding with `elementId` `node-ascii`;
  - the text-format output contains a `label-overflow` and a
    `note-overflow` line.

Update any other assertion in this file that hard-codes the old message.
Change nothing else.

### E. `apps/cli/src/text-layout-export.test.ts`

Reuse the local `fixture(...)` helper and `args` (:13-36).

- "PNG and PDF retain raster input and bytes while reporting warnings"
  (:71-102): the no-warnings reference becomes
  `textLayoutProblemDocument("uml")`. Rename the variable. The byte
  equality with the architecture render must still hold.
- :104: the first case uses `"uml"` instead of `"freeform"`. Rename the
  test to "layout warnings exclude other page kinds, element, clean and
  semantic exports".
- Add "freeform and flowchart whole-page exports print layout warnings":
  for `freeform` and `flowchart`, the SVG export to stdout has stdout
  byte-equal to the architecture document's stdout, and stderr equal to
  the architecture document's stderr. The stderr is the
  `warning: <ruleId> <elementId>: <message>` lines.
- Add "wide labels warn on export without changing the SVG":
  - SVG export of `textLayoutWideDocument()`: stderr contains
    `warning: label-overflow node-wide: ` and does not contain
    `node-ascii`;
  - stdout equals the SVG stdout of `textLayoutWideDocument("uml")`.

Import `textLayoutWideDocument` and `TEXT_LAYOUT_WIDE_EXPECTED` where they
are needed. Do not assert PNG or PDF bytes beyond what the existing test
does.

### F. Help and docs conformance

Check the following against design "Help text and CLI docs", and record
matches/differs:

- `apps/cli/src/help.ts:29`, `:395` and `:480-495`;
- `docs/cli.md:35-42`.

Edit only on a mismatch. As of base, they are expected to match.

## Invariants

- `git diff --exit-code fd2083b -- packages/core/src/svg-export packages/core/src/text-layout.ts packages/core/src/label-layout.ts packages/core/src/node-label.ts packages/core/src/wide-text-width.ts packages/core/src/index.ts packages/io apps/cli/native Cargo.toml Cargo.lock`
  is empty. This plus the unchanged golden tests proves the export bytes
  are identical.
- `apps/cli/src/export-command.ts` is unchanged from `fd2083b`.
- `commands.test.ts`, `bpmn-commands.test.ts`, `export-command.test.ts`
  and `html-export.test.ts` are unchanged and pass. BPMN and breadboard
  lint output, order and exit codes are unchanged. The rule ids are
  unchanged.
- No file under `apps/cli/src` contains the old string
  `no BPMN, breadboard or architecture pages`.

## Test cases (input -> expected)

- freeform or flowchart problem document, `lint --format json` -> exit 0,
  `TEXT_LAYOUT_EXPECTED`.
- empty freeform page, `--page Notes` -> exit 0, empty stdout.
- uml-only document, `lint` -> `EXIT_ERROR` (2, `commands.ts:62`) with the new
  `LINT_NO_PAGES`.
- uml page via `--page Classes` -> `EXIT_ERROR`, empty stdout.
- uml-only JSONL in `breadboard-commands.test.ts`, `lint` and
  `lint --page missing` -> both give the new `LINT_NO_PAGES`.
- wide document, lint -> `TEXT_LAYOUT_WIDE_EXPECTED` and the exact
  195/120 message, with no `node-ascii` finding.
- freeform or flowchart SVG export -> the same stdout bytes and stderr as
  architecture.
- uml SVG export -> no `warning: label-` lines, and the same SVG bytes as
  architecture.
- wide SVG export -> `warning: label-overflow node-wide: ` and no
  `node-ascii`; the SVG bytes equal the uml variant.

## Verification (gate; every command must exit 0)

Run in this order after all edits:

| # | Command | Must show |
| --- | --- | --- |
| 1 | `mkdir -p tmp/text-layout-lint-s556/tll-12-core-cli-lint-export` | exit 0 |
| 2 | `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/text-layout-lint packages/core/src/wide-text-width.test.ts apps/cli/src/text-layout-lint.test.ts apps/cli/src/text-layout-export.test.ts apps/cli/src/breadboard-commands.test.ts > tmp/text-layout-lint-s556/tll-12-core-cli-lint-export/focused.log 2>&1` | exit 0, summary line ` 0 fail` and a non-zero ` <N> pass` (bun's quiet agent mode prints only summary lines and `(fail)` blocks, never per-test pass lines) |
| 3 | `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core packages/io apps/cli/src > tmp/text-layout-lint-s556/tll-12-core-cli-lint-export/core-io-cli.log 2>&1` | exit 0, `0 fail`. The export golden and snapshot tests pass unchanged. Only the `nativeTest` blocks skip (no binary) |
| 4 | `grep -rln "wide-text-width" packages apps --include='*.ts' > tmp/text-layout-lint-s556/tll-12-core-cli-lint-export/references.log 2>&1` | exit 0. The log lists only `packages/core/src/text-layout-lint/rules.ts` and `packages/core/src/wide-text-width.test.ts` |
| 5 | `git diff --exit-code fd2083b -- packages/core/src/svg-export packages/core/src/text-layout.ts packages/core/src/label-layout.ts packages/core/src/node-label.ts packages/core/src/wide-text-width.ts packages/core/src/index.ts packages/io apps/cli/native Cargo.toml Cargo.lock apps/cli/src/export-command.ts > tmp/text-layout-lint-s556/tll-12-core-cli-lint-export/boundary.log 2>&1` | exit 0, empty log |
| 6 | `test -z "$(grep -rn 'no BPMN, breadboard or architecture pages' apps/cli/src)"` | exit 0 (old message gone) |
| 7 | `mise run lint-ts > tmp/text-layout-lint-s556/tll-12-core-cli-lint-export/lint-ts.log 2>&1` | exit 0 (biome plus typecheck) |
| 8 | `CARGO_TERM_QUIET=true mise run check > tmp/text-layout-lint-s556/tll-12-core-cli-lint-export/check.log 2>&1` | exit 0 (typecheck plus `cargo check --workspace`) |

If command 3 fails in a test outside this plan's writePaths, record the
test, its file and the failure in the progress log as a blocker. Do not
edit that file. Do not write `STATUS: done` while any gate command is
non-zero.

## Done criteria

- Review items A1-A7 and F are each recorded as matches or differs, with a
  fix for every differs.
- `LINT_NO_PAGES` is updated. Tests C, D and E are rewritten or added as
  specified.
- Gate commands 1-8 exited 0. Their exit codes and log paths are recorded,
  with the sha256 before and after for every edited file.
- The last line of `impl-plans/progress/tll-12-core-cli-lint-export.md` is
  `STATUS: done`.
