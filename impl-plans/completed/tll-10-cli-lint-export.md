# tll-10-cli-lint-export

- planId: tll-10-cli-lint-export
- planPath: impl-plans/active/tll-10-cli-lint-export.md
- wave: 2 in session 555 (runs after the tll-09 review is accepted)
- dependsOn: tll-09-core-rules
- Design: `design-docs/specs/design-text-layout-lint.md`, sections "CLI:
  `nodetto-cli lint`", "CLI: `nodetto-cli export`" and "Test plan" (the
  `text-layout-lint.test.ts`, `text-layout-export.test.ts` and
  `breadboard-commands.test.ts` bullets).
- Read `impl-plans/active/tll-06-overview.md` first.

## Intent and context

After tll-09, `TEXT_LAYOUT_LINT_PAGE_KINDS` includes `freeform` and
`flowchart`. The CLI lint filter (`apps/cli/src/commands.ts:291-296`) and
the export warning gate (`apps/cli/src/export-command.ts:337`) already read
that constant, so the behavior reaches the CLI with no logic change. This
plan does three things:

- updates the user-visible `LINT_NO_PAGES` message (`commands.ts:96-97`) to
  name all five lintable kinds;
- updates the CLI tests that used `freeform` as the "not lintable / no
  warnings" control, so they use a `uml` page instead;
- adds CLI tests for freeform and flowchart pages and for the wide-character
  fixture.

## Non-goals

- Do not change `lintCommand` logic, `selectPage`, `.bpmnlintrc` handling,
  JSON shape, exit codes or `export-command.ts`. If you find that a logic
  change is needed, stop and record it as a design contradiction in the
  progress log.
- Do not edit `apps/cli/src/__fixtures__/text-layout.ts` (tll-09),
  `native-parity.test.ts` (tll-11), `help.ts` or `docs/cli.md` (tll-08).
- Do not change the assertions of other existing tests, apart from those
  listed below.

## writePaths

- apps/cli/src/commands.ts
- apps/cli/src/text-layout-lint.test.ts
- apps/cli/src/text-layout-export.test.ts
- apps/cli/src/breadboard-commands.test.ts
- impl-plans/progress/tll-10-cli-lint-export.md
- tmp/text-layout-lint-s555/tll-10-cli-lint-export

sharedPaths: none.

## File-level changes

### `apps/cli/src/commands.ts`

- `LINT_NO_PAGES` (:96-97) becomes
  `"The document contains no BPMN, breadboard, architecture, freeform or flowchart pages."`.
  Change nothing else in the file.
- The report mapping (:340-366) already sends every non-`bpmn`,
  non-`breadboard` selected page to `lintTextLayoutPage` in its else
  branch. Leave it unchanged.

### `apps/cli/src/breadboard-commands.test.ts` (:141-160)

- The `freeform` JSONL string becomes the same document with
  `"pageKind":"uml"`. Rename the variable to `uml`, and use ids `page-uml`
  and the name `Uml` (or similar).
- Both expected strings become the new `LINT_NO_PAGES` text.
- Keep the test name.

### `apps/cli/src/text-layout-lint.test.ts`

- Replace the test `"freeform pages are not lintable or selectable"`
  (:87-106) with two tests:
  1. `"freeform and flowchart pages are lintable and selectable"`:
     - for `kind` in `freeform` and `flowchart`:
       `lint(textLayoutProblemDocument(kind), "--format", "json")` -> exit 0,
       and the findings' `{ruleId, elementId}` equal `TEXT_LAYOUT_EXPECTED`;
     - `lint(textLayoutProblemDocument(kind), "--page", "Architecture")` ->
       exit 0, and its stdout equals the architecture document's stdout for
       the same command;
     - the existing `createPage({ name: "Notes", kind: "freeform" })`
       document with `--page Notes` -> exit 0 (an empty freeform page is
       clean, stdout `""`).
  2. `"other page kinds are not lintable or selectable"`:
     - `lint(textLayoutProblemDocument("uml"))` -> `EXIT_ERROR`, and stderr
       contains the new `LINT_NO_PAGES`;
     - the architecture document plus `createPage({ name: "Classes", kind: "uml" })`
       with `--page Classes` -> `EXIT_ERROR`, and stdout is `""`.
- Add `"wide characters are reported with measured and available widths"`:
  - `lint(textLayoutWideDocument(), "--format", "json")` -> exit 0, and the
    findings' `{ruleId, elementId}` equal `TEXT_LAYOUT_WIDE_EXPECTED`;
  - the `node-wide` message is exactly
    `Label line 1 of 1 is 195 wide but the text area is 120 wide at 13px; export clips it.`;
  - there is no finding for `node-ascii`;
  - the text-format output contains `label-overflow` and `note-overflow`
    lines for the wide elements.
- Update any other existing assertion that hard-codes the old
  `LINT_NO_PAGES` string. Change nothing else.

### `apps/cli/src/text-layout-export.test.ts`

- Test "PNG and PDF retain raster input and bytes while reporting warnings"
  (:71-102): the no-warnings reference `freeform` becomes
  `textLayoutProblemDocument("uml")`. Rename the variable. The assertion
  `architecture.rendered.at(-1) === reference.rendered.at(-1)` must still
  hold, because page kind does not change rendering.
- Test "layout warnings exclude freeform, element, clean and semantic exports"
  (:104+): the first case uses `"uml"`. Rename the test to
  "... exclude other page kinds, element, clean and semantic exports".
- Add `"freeform and flowchart whole-page exports print layout warnings"`:
  - for `kind` in `freeform` and `flowchart`: SVG export to stdout of
    `textLayoutProblemDocument(kind)` -> exit 0;
  - its stdout equals the architecture document's SVG stdout byte for byte;
  - its stderr equals the architecture document's stderr. Both are the
    `warning: <ruleId> <elementId>: <message>` lines from
    `lintTextLayoutPage`.
- Add `"wide labels warn on export without changing the SVG"`:
  - SVG export of `textLayoutWideDocument()` -> stderr contains
    `warning: label-overflow node-wide: `, and not `node-ascii`;
  - stdout equals `textLayoutWideDocument("uml")`'s SVG stdout (same bytes,
    no warnings on uml).

Imitate the helpers already in each file (`lint(...)`, `fixture(...)`,
`args`). Import `textLayoutWideDocument` and `TEXT_LAYOUT_WIDE_EXPECTED` from
`./__fixtures__/text-layout.ts`.

Pitfalls:

- `textLayoutProblemDocument(kind)` takes a string page kind, and the page
  name is always `Architecture`. Use `--page Architecture` for every kind.
- Do not assert the export bytes of PNG/PDF beyond what the existing test
  already does (the test backend writes stub bytes).
- Keep fixtures generic. No new names beyond those in the fixture module.
- Before editing, run the focused command in Verification once and record
  the baseline: exactly the three failures listed in tll-06 "Known
  transient state". If anything else fails, record it and the owning plan
  (by writePaths), and do not fix it here.
- The new `LINT_NO_PAGES` must also be the message for
  `lint free.jsonl --page missing` in `breadboard-commands.test.ts` once the
  page is `uml`. `selectPage` is not reached when no page is lintable.

## Invariants

- `git diff 45cc69f -- apps/cli/src/export-command.ts` is empty.
- In `commands.ts`, only the `LINT_NO_PAGES` string changes:
  `git diff --numstat 45cc69f -- apps/cli/src/commands.ts` shows at most
  2 lines added and 2 removed.
- `commands.test.ts`, `bpmn-commands.test.ts` and `export-command.test.ts`
  are unchanged and pass.

## Verification

Logs go to `tmp/text-layout-lint-s555/tll-10-cli-lint-export/<name>.log`.
Prefix bun tests with `BUN_OPTIONS=--jsx-runtime=classic`.

| Command | Must show |
| --- | --- |
| `bun test apps/cli/src/text-layout-lint.test.ts apps/cli/src/text-layout-export.test.ts apps/cli/src/breadboard-commands.test.ts` | exit 0, 0 fail; the new test names listed in the output |
| `bun test apps/cli/src/commands.test.ts apps/cli/src/bpmn-commands.test.ts apps/cli/src/export-command.test.ts` | exit 0, 0 fail (unchanged tests) |
| `bun test apps/cli/src` (first full CLI gate; no concurrent sibling in session 555) | exit 0, 0 fail; native tests skipped without the binary |
| `grep -rn "no BPMN, breadboard or architecture pages" apps/cli/src` | no match (exit 1) |
| `bunx biome check apps/cli/src/commands.ts apps/cli/src/text-layout-lint.test.ts apps/cli/src/text-layout-export.test.ts apps/cli/src/breadboard-commands.test.ts` | exit 0 |
| `bun run typecheck` (shared-input gate) | exit 0 |
| `git diff --stat 45cc69f -- apps/cli/src/export-command.ts` | empty |

## Done criteria

- `LINT_NO_PAGES` is updated. The listed tests are rewritten or added, and
  nothing else changed.
- All commands show their required results, logged with exit codes, log
  paths and sha256 before and after for each edited file in
  `impl-plans/progress/tll-10-cli-lint-export.md`.
- The last line of the progress log is `STATUS: done`.
