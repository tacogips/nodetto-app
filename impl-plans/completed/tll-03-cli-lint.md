# tll-03-cli-lint

- planId: tll-03-cli-lint
- planPath: impl-plans/active/tll-03-cli-lint.md
- wave: 2
- dependsOn: tll-01-core-lint
- Design: `design-docs/specs/design-text-layout-lint.md`, section "CLI:
  nodetto-cli lint", plus "Test plan" (CLI lint part).
- Read `impl-plans/active/tll-00-overview.md` first.

## Intent and context

`nodetto-cli lint` must accept architecture pages:

- with `--page`, an architecture page resolves;
- without `--page`, architecture pages are linted next to BPMN and
  breadboard pages;
- architecture findings come from `lintTextLayoutPage` and use the existing
  text and JSON report shapes.

Today `apps/cli/src/commands.ts:lintCommand` filters to `bpmn|breadboard`
(:289) and fails with `LINT_NO_PAGES` (:94).

## Non-goals

- Do not change BPMN or breadboard routing, `.bpmnlintrc` or `--config`
  discovery (keyed on `hasBpmn`), the `pin` handling, the text table format,
  the summary line, or the exit-code computation.
- Add no JSON field. No configuration for text-layout rules.
- Do not touch `export-command.ts` (tll-04), `help.ts` (tll-02),
  `native-parity.test.ts` (tll-05) or the fixture builder (tll-01; read-only
  here).

## writePaths

- apps/cli/src/commands.ts
- apps/cli/src/breadboard-commands.test.ts
- apps/cli/src/text-layout-lint.test.ts (new)
- impl-plans/progress/tll-03-cli-lint.md
- tmp/text-layout-lint-s551/tll-03-cli-lint

sharedPaths: none.

## File-level changes

### `apps/cli/src/commands.ts`

1. Add `lintTextLayoutPage` and `TEXT_LAYOUT_LINT_PAGE_KINDS` to the
   existing `@nodetto/core` import (lines 1-15).
2. Change `LINT_NO_PAGES` (:94) to
   `"The document contains no BPMN, breadboard or architecture pages."`.
3. In `lintCommand`, the page filter (:289-291) becomes
   `page.kind === "bpmn" || page.kind === "breadboard" || TEXT_LAYOUT_LINT_PAGE_KINDS.includes(page.kind)`.
   Keep document order and keep the existing `selectPage(document, query, pages, LINT_NO_PAGES)`
   call.
4. In the `reports` mapping, replace the two-way ternary with a three-way
   branch:
   - `bpmn` goes to `lintBpmnPage` (unchanged);
   - `breadboard` goes to `lintBreadboardPage` (unchanged, with `pin`);
   - otherwise (architecture) it is
     `lintTextLayoutPage(document, page.id).map(({ elementId, severity, message, ruleId }) => ({ elementId, severity, message, ruleId }))`.
5. Nothing else changes. The JSON writer already emits
   `{elementId, severity, message, ruleId}` and adds `pin` only for
   breadboard.

### `apps/cli/src/breadboard-commands.test.ts`

Change only the two string literals at :150 and :158 to the new
`LINT_NO_PAGES` text. No other edits.

### `apps/cli/src/text-layout-lint.test.ts` (new)

- Use `runCli(args, io, "test")` with an in-memory io, as
  `apps/cli/src/dense-relations.test.ts:12` does:
  `{ readText: () => source, writeText: () => {} }`.
- When a test needs several files, use the `memoryIo` pattern from
  `breadboard-commands.test.ts:25`.
- Fixtures come from `./__fixtures__/text-layout.ts`:
  - `textLayoutCleanDocument`
  - `textLayoutProblemDocument`
  - `TEXT_LAYOUT_EXPECTED`
  - `TEXT_LAYOUT_PAGE_ID`
- Expected findings come from `lintTextLayoutPage` in `@nodetto/core` or
  from `TEXT_LAYOUT_EXPECTED`.

## Test cases to add (`input -> expected`)

- Clean document, `lint doc.jsonl --page Architecture` -> exit `EXIT_OK`,
  stdout `""`, stderr `""`.
- Clean document, `--page page-architecture --format json` -> exit 0, and the
  parsed JSON is:
  - `pages` has length 1, with `pageId` `page-architecture` and `pageName`
    `Architecture`;
  - `findings` is `[]`;
  - `summary` is `{problems: 0, errors: 0, warnings: 0}`.
- Problem document, `lint doc.jsonl` (no `--page`), text -> exit `EXIT_OK`:
  - stdout's first line is `doc.jsonl`;
  - there is one row per `TEXT_LAYOUT_EXPECTED` entry, containing the id,
    `warning` and the rule id;
  - the last line is `8 problems (0 errors, 8 warnings)`;
  - stdout contains the pinned message
    `Label needs 3 lines (46.8 high) but the box is 30 high at 13px; export clips 2 lines.`
- Problem document, `--format json` -> exit 0:
  - each finding's keys are exactly `elementId, severity, message, ruleId`
    (no `pin`);
  - every severity is `warning`;
  - the `[ruleId, elementId]` list equals `TEXT_LAYOUT_EXPECTED` in order;
  - every message equals `lintTextLayoutPage(parseDocument(source), "page-architecture")`
    for the same index.
- Problem document built with kind `freeform`, `lint` -> exit `EXIT_ERROR`,
  stderr contains the new `LINT_NO_PAGES` text.
- Mixed document:
  - build it by reading `packages/io/src/__fixtures__/bpmn/purchase-request.jsonl`
    (read-only), opening it in `new Editor({ document: parseDocument(text) })`,
    adding an architecture page with `createPage({ id: "page-architecture", name: "Architecture", kind: "architecture" })`
    and one `node.generic` 140x30 with the long "Payment gateway ..." label,
    then serializing;
  - `lint mixed.jsonl --format json` -> the BPMN page's `findings` equal
    those from `lint purchase-request.jsonl --format json` (the BPMN page
    output is unchanged);
  - the architecture page has one `label-overflow` finding;
  - the exit code equals the BPMN-only run's exit code.
- Non-lintable page selected:
  - open the problem document in `new Editor({ document: parseDocument(source) })`,
    add `createPage({ name: "Notes", kind: "freeform" })` and serialize;
  - `lint doc.jsonl --page Notes` -> exit `EXIT_ERROR`, stdout `""`;
  - `lint doc.jsonl` (no `--page`) -> exit 0, and the JSON `pages` holds
    only `page-architecture`.
- Determinism: run the problem document twice, text and json -> identical
  stdout.

## Pitfalls

- `TEXT_LAYOUT_LINT_PAGE_KINDS` is `readonly PageKind[]`. `.includes(page.kind)`
  type-checks because `page.kind` is a `PageKind`. Do not cast to `string[]`.
- Do not move the `if (!pages.length) return fail(LINT_NO_PAGES)` guard.
  An architecture-only document must now pass it.
- Do not read `.bpmnlintrc` for architecture-only selections. Keep
  `hasBpmn` exactly as it is.
- The text output prints `page <name> (<id>)` headers only when
  `reports.length > 1`. Leave that logic alone.
- Do not edit the fixture builder. If its geometry is wrong, record drift
  against tll-01 in the progress log, and serial repair fixes it.

## Verification (each must exit 0; logs under the scratch root)

1. `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/text-layout-lint.test.ts apps/cli/src/breadboard-commands.test.ts apps/cli/src/bpmn-commands.test.ts apps/cli/src/commands.test.ts > tmp/text-layout-lint-s551/tll-03-cli-lint/focused.log 2>&1; echo "exit=$?"`.
   Evidence: 0 fail, and the existing BPMN and breadboard lint tests pass
   unchanged.
2. `bunx biome check apps/cli/src/commands.ts apps/cli/src/breadboard-commands.test.ts apps/cli/src/text-layout-lint.test.ts > tmp/text-layout-lint-s551/tll-03-cli-lint/biome.log 2>&1; echo "exit=$?"`.
3. Shared-input gate (tll-04 is a same-wave sibling):
   `bunx tsc -p tsconfig.json --noEmit > tmp/text-layout-lint-s551/tll-03-cli-lint/tsc.log 2>&1; echo "exit=$?"`.
4. Shared-input gate:
   `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src > tmp/text-layout-lint-s551/tll-03-cli-lint/cli-all.log 2>&1; echo "exit=$?"`.
   Evidence: 0 fail. Native tests skip without `NODETTO_CLI_TEST_BINARY`.
5. `git diff -U0 apps/cli/src/breadboard-commands.test.ts`.
   Evidence: only the two string lines changed.

## Done criteria

- Commands 1-5 meet their evidence, or a gate is recorded as `pending-join`
  with its owner.
- `grep -c "no BPMN or breadboard pages" apps/cli/src/commands.ts apps/cli/src/breadboard-commands.test.ts`
  prints 0 for both files.
- The progress log has hashes, the intent snapshot and `STATUS: done` as
  the last line.
