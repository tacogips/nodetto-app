# clm-09-wiring

## Continuation 2 2026-11-05 (clm-s732) - authoritative

Status at HEAD `29f8691135fb6098a9496495f4a417e93ce0625e`: nothing of this plan has
started; `impl-plans/progress/clm-09-wiring.md` does not exist. Scope is the s731
section and the base plan below, plus the additions here. Replace `tmp/clm-s731` and
`tmp/clm-s725` with `tmp/clm-s732` in every path. Manifest:
`impl-plans/active/clm-s732-dispatch.json`.

- wave: 3; dependsOn: clm-02-connector-edit-perf, clm-06-route-arrange,
  clm-11-container-carry, clm-12-bpmn-layered. Accepted and landed: clm-01, 03, 04,
  07, 08, 10, 13, 14.
- This plan is the single owner of the shared files. It writes no feature logic,
  apart from the BPMN dispatch and the lines listed below.

### writePaths additions (pre-authorized)

- `apps/cli/src/arrange-modes.test.ts`: the test at line 124 asserts that layered on
  BPMN exits 2. The dispatch makes it exit 0, so this test must change here.
- `apps/cli/src/lint-metrics.test.ts`, `apps/cli/src/lint-diagram.test.ts`,
  `apps/cli/src/merge-command.test.ts`, `apps/cli/src/warnings.test.ts`,
  `apps/cli/src/edit/report.test.ts`, `apps/cli/src/edit/carry-members.ts`,
  `apps/cli/src/edit/apply-batch.test.ts`: import switches or assertions that wiring
  intentionally changes only.
- `apps/cli/src/native-parity/harness.ts`, `apps/cli/src/native-parity/documents.test.ts`,
  `apps/cli/src/native-parity/drawing.test.ts`, `apps/cli/src/native-parity/text-layout.test.ts`,
  `apps/cli/src/native-parity/edit-performance.test.ts`: only if `mise run test-cli`
  shows that wiring changed an asserted output. Never relax a deadline.
- `apps/cli/src/draw-command.ts`, `apps/cli/src/export-command.ts`: only for `--quiet`
  or collapsed warnings, if `cli.ts` and `commands.ts` are not enough.
- `packages/core/src/bpmn/index.ts`: only if `bpmnFlowLabelBox` is exported through it.
- `apps/cli/src/__fixtures__/bpmn-layered.ts` (new): a builder for a BPMN page of 3
  pools, 6 lanes and 60 units with neutral names, for the timing below and
  `layout.test.ts`.

Record every touched pre-authorized file in the progress log.

### Added file-level changes

- `arrange-modes.ts` BPMN dispatch: on a `bpmn` page with `--mode layered`, exit 2 for
  `--frames` and for `--direction TB`, with a message saying pools are horizontal
  (design E2.1). Otherwise call `planLayeredBpmn`, apply `containerCommands` then
  `unitCommands` with `{ placed }`, then run the route stage. Add both command counts to
  `count` so `--check` is correct. Add `bpmn` to the accepted kinds for layered only
  through this branch; `LAYERED_PAGE_KINDS` keeps its value.
- Production-core strict check: the `node-overlap.ts` annotation (round 1 below).
- Native timing, recorded per design "Continuation 2 verification": `/usr/bin/time -p`
  on the release binary for `arrange --mode route --page Grid` on the `multiPage`
  fixture document and `arrange --mode layered` on the `bpmn-layered` fixture document,
  with times and exit statuses in `tmp/clm-s732/clm-09-wiring/timing.log`. Write the
  documents with an inline `bun -e` into `tmp/clm-s732/clm-09-wiring/work/` as `.jsonl`
  data. There is no fixed threshold; a quadratic slowdown (doubling the units more than
  triples the time) is a blocker to record against the owning plan.

### Pitfalls

- `mise run verify` may rewrite tracked `apps/desktop/src-tauri/gen/schemas/*.json`.
  Restoring them is not this plan's job; commits stage explicit paths only.
- `--quiet` must not hide match lines (F2), and `--strict --quiet` must still exit 3.
- The MCP tool `nodetto_edit` takes free-form args and uses `COMMAND_HELP.edit`, so
  there is no schema change: `mcp.test.ts` asserts that the description mentions `where`
  and `select`, and the tool list includes `nodetto_merge`.
- A defect in a feature module is a finding for the owning plan. Do not fix it here.

### Done criteria (mechanical)

- Manifest verification commands exit 0. The native command and `mise run test-cli`
  use up to 3 attempts, each attempt's log kept.
- `timing.log` has the four A7 ops sets against `target/clm-baseline/nodetto-cli` and
  the two arrange timings.

## Continuation 2026-11-04 (clm-s731) - authoritative

This section supersedes the header fields below (wave, dependsOn,
writePaths, evidence paths) and adds work. Everything below still applies
except where amended here. Nothing of this plan has landed yet.

- wave: 3; dependsOn: clm-02-connector-edit-perf, clm-06-route-arrange,
  clm-10-layered-fixes, clm-11-container-carry, clm-12-bpmn-layered,
  clm-13-edit-selectors, clm-14-lint-image-path (accepted dependencies
  clm-01, clm-03, clm-04, clm-07, clm-08 are landed).
- Design additions: E1 table (help), E2 table (help), F1-F4 (help, report,
  parity), "Continuation partition" (clm-09 row), Verification rows E1, E2,
  F1-F4, A7 continuation (final timing), "Native parity".
- writePaths (clm-s731): every writePath listed below, plus
  - `apps/cli/src/edit/apply-batch.ts` (one line: `matches: batch.matches`
    in the returned `BatchResult`)
  - `apps/cli/src/edit-command.ts` (only if the text/JSON report needs
    `matches` passed through; record whether touched)
  with `tmp/clm-s725/clm-09-wiring` replaced by
  `tmp/clm-s731/clm-09-wiring`. sharedPaths: none; artifactRoots: `target`.
- sharedPathNotes additions:
  - `apps/cli/src/arrange-modes.ts`: add the BPMN layered dispatch only (call
    `planLayeredBpmn`, apply `containerCommands` then `unitCommands` with
    `{ placed }` through `editor.apply`, then the route stage), and switch
    relative core imports to `@nodetto/core`.
  - `apps/cli/src/lint-diagram.ts`: relative-import switch only (clm-14 owns
    the logic).
  - `apps/cli/src/edit/apply-batch.ts`: the one `matches` line only.

### Amendment 2026-11-04 (integration-paths-outside-writePaths, round 1)

- Finding IR-CORE-STRICT-NODE-OVERLAP:
  `packages/core/src/diagram-lint/node-overlap.ts:97` reports TS7022 under
  `noUncheckedIndexedAccess`. The `system` arrow function's inferred type
  depends on its own use. This breaks the constraint that the core must
  compile with that flag. The file was landed by accepted clm-03, and no
  pending plan owned it.
- Decision:
  - Add `packages/core/src/diagram-lint/node-overlap.ts` to the clm-09
    writePaths.
  - The fix is annotation only: give `system` an explicit `boolean` return
    type. No behavior change.
- Added verification:
  - `bun test packages/core/src/diagram-lint/node-overlap.test.ts` must pass
    unchanged.
  - `sh -c 'mkdir -p tmp/clm-s731/clm-09-wiring/final; bun run typecheck --noUncheckedIndexedAccess > tmp/clm-s731/clm-09-wiring/final/strict.log 2>&1; ! grep -E "^packages/core/src/" tmp/clm-s731/clm-09-wiring/final/strict.log | grep -v "\.test\.ts(" | grep -q .'`
    must exit 0. It shows that no production `packages/core/src` file
    reports a diagnostic. Test-file diagnostics are baseline and out of
    scope.

### Added file-level changes

- `packages/core/src/index.ts`: also export `planLayeredBpmn`,
  `bpmnFlowLabelBox`, `isLabelObstacle`, `ROUTE_PAGE_KINDS` (if not already),
  and switch `apps/cli/src/edit/carry-members.ts` relative core imports if any.
- `help.ts` `edit`: the E1 per-kind table (text from design E1, including
  the error rules and the "attachments always follow" note), `name:`,
  `where` keys, `expect`, `select`, the match report line, resolution order
  (exact id, @ref, name:, prefix). `arrange`: the E2 page-kind table with
  exclusion reasons and the BPMN rows/columns rule (`--frames`/TB exit 2 on
  BPMN). `lint --metrics`: supported page kinds.
- `docs/cli.md` and `README.md`: the same content with neutral examples (the
  design F2 delete example uses `Approve`/`Update status`).
- MCP: no schema change (`nodetto_edit` uses free-form args and
  `COMMAND_HELP.edit`); `mcp.test.ts` asserts the edit tool description
  mentions `where` and `select`.

### Added tests

- `cli-wiring.test.ts`: `arrange --mode layered` on a BPMN page (exit 0, lane
  invariants hold, rerun `--check` exit 0) and on an ERD page with frames;
  `edit` with `where`/`expect` mismatch -> exit 2 and the file unchanged;
  `edit` text report shows `operation <i> (delete): matched 1 element(s)`;
  JSON report has `matches`; `--quiet` keeps match lines; `carryMembers:false`
  on a pool through `runCli`.
- `native-parity/edit-usability.test.ts`: add E1 (pool move with
  `carryMembers:false`, lane x error), F1 (ambiguous name error text), F2
  (expect mismatch, no write), F3 (select then update).
- `native-parity/layout.test.ts`: add BPMN layered, BPMN route with a moved
  label, ERD route, and `lint --metrics` on a BPMN page.
- `native-parity/lint-rules.test.ts`: add the `../` document-path case from
  clm-14.

### Amended verification

- Verification 1 adds `apps/cli/src/edit/selectors.test.ts apps/cli/src/edit/carry-members.test.ts apps/cli/src/edit-frame-carry.test.ts`.
- Verification 2 adds `packages/core/src/arrange-layered.test.ts packages/core/src/arrange-layered-bpmn.test.ts packages/core/src/arrange-route.test.ts packages/core/src/diagram-lint/metrics.test.ts packages/core/src/keep-members.test.ts packages/core/src/dirty-pages.test.ts`.
- Verification 4 runs with up to 3 attempts using the loop form from clm-02
  continuation verification 5 (logs `native-1.log`..`native-3.log` under
  `tmp/clm-s731/clm-09-wiring/final/`), followed by
  `grep -E '^ *[1-9][0-9]* pass$'` and `grep -E '^ *0 fail$'` on the green log.
- Verification 7 (`mise run test-cli`): up to 3 attempts, each attempt's log
  under `tmp/clm-s731/clm-09-wiring/final/test-cli-<n>.log`.
- Verification 8 timing: all four A7 ops sets (single, multiPage,
  mixedSingle, mixedMulti from `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`)
  with `/usr/bin/time -p` for `target/release/nodetto-cli` and
  `target/clm-baseline/nodetto-cli`, into
  `tmp/clm-s731/clm-09-wiring/timing.log`; record user CPU ratios
  multiPage/single and mixedMulti/mixedSingle (target <= 1.5).
- Done criteria add: `grep -n "planLayeredBpmn" apps/cli/src/arrange-modes.ts`
  and `grep -n "matches: batch.matches" apps/cli/src/edit/apply-batch.ts`
  match.

---

- planId: clm-09-wiring
- planPath: impl-plans/active/clm-09-wiring.md
- progressPath: impl-plans/progress/clm-09-wiring.md
- wave: 3
- dependsOn: clm-01-merge, clm-02-connector-edit-perf, clm-03-lint-core,
  clm-04-edit-usability, clm-06-route-arrange, clm-07-layered-core,
  clm-08-lint-cli.
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections "CLI
  surface", B1 (registration), B2, B3 (documentation), C3 (`--quiet`, and
  collapsing in `loadDocument` and `validate`), D ("Page selection"),
  "A3 metrics" (CLI output), "Help and documentation", "Verification" and
  "Plan partition".
- writePaths:
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/help.ts`
  - `apps/cli/src/cli.ts`
  - `apps/cli/src/main.ts`
  - `apps/cli/src/native-engine.ts`
  - `apps/cli/src/mcp.ts`
  - `packages/core/src/index.ts`
  - `apps/cli/src/merge-command.ts`
  - `apps/cli/src/arrange-modes.ts`
  - `apps/cli/src/lint-metrics.ts`
  - `apps/cli/src/lint-diagram.ts`
  - `apps/cli/src/cli-wiring.test.ts` (new)
  - `apps/cli/src/merge-git.test.ts` (new)
  - `apps/cli/src/native-parity/layout.test.ts` (new)
  - `apps/cli/src/native-parity/merge.test.ts` (new)
  - `apps/cli/src/native-parity/edit-usability.test.ts` (new)
  - `apps/cli/src/native-parity/lint-rules.test.ts` (new)
  - `apps/cli/src/ai-commands.test.ts`
  - `apps/cli/src/commands.test.ts`
  - `apps/cli/src/mcp.test.ts`
  - `apps/cli/src/mcp-stdio.test.ts`
  - `apps/cli/src/text-layout-lint.test.ts`
  - `apps/cli/src/breadboard-commands.test.ts`
  - `docs/cli.md`
  - `README.md`
  - `design-docs/specs/export.md`
  - `design-docs/specs/design-cli-ai-drawing.md`
  - `impl-plans/progress/clm-09-wiring.md`
  - `tmp/clm-s725/clm-09-wiring`
  - `target`
- sharedPaths: none
- sharedPathNotes:
  - `apps/cli/src/merge-command.ts`, `arrange-modes.ts`, `lint-metrics.ts`
    and `lint-diagram.ts`: switch relative core imports to `@nodetto/core`
    only. No logic changes.
  - Existing test files: update only assertions that the new wiring
    intentionally changes (the `LINT_NO_PAGES` wording, the MCP tool list,
    help text, and an ERD-only document now linting). Record each change.
  - `main.ts` and `mcp.ts`: edit only if `cli.ts`/`help.ts` are not enough.
    Record whether they were touched.
- artifactRoots: `target`

## Intent and context

This plan is the single owner of the shared registration files. It
connects the feature modules from the earlier waves, documents every new
command, mode, flag and field, adds CLI-level and native parity tests, and
runs the final gates.

- `commands.ts:runCli` (around line 870) dispatches commands.
  `arrangeCommand` (around 741), `lintCommand` (around 246) and
  `loadDocument` (around 156) are here.
- `cli.ts:runCliAsync` (called by `main.ts`) and
  `native-engine.ts:nodettoRun` handle export and open outside `runCli`.
- `help.ts:COMMAND_HELP` feeds the MCP tool list, so a `merge` entry creates
  `nodetto_merge`.
- The native parity harness is `apps/cli/src/native-parity/harness.ts`
  (`compare`).

## Non-goals

- No feature logic. If a feature module is defective, record a Step-5
  finding for the owning plan and stop that item. Do not fix it here.
- `tidy`, `overlaps` and `edit --arrange` are unchanged. Without the new
  flags, output stays byte-identical.
- No Rust changes and no deadline relaxation.

## File-level changes

1. `packages/core/src/index.ts`: add named exports next to the existing
   groups:
   - `mergeDocumentVersions`, `VersionConflict` (`./document-merge.ts`);
   - `planLayered`, `LayeredOptions`, `columnFrames`, `LAYERED_PAGE_KINDS`;
   - `planRoute`, `RouteOptions`, `ROUTE_PAGE_KINDS`, `pageMetrics`,
     `PageMetrics`;
   - `lintNodeOverlaps`, `NodeOverlapFinding`, `NODE_OVERLAP_PAGE_KINDS`,
     `wrapTextToWidth`, `planTextWrapFixes`, `TextWrapFix`.
   Then switch the four CLI modules' relative imports to `@nodetto/core`.
2. `commands.ts`
   - `runCli`: call `extractQuiet` first, dispatch the cleaned args, call
     `applyQuiet(command, result)` last. Add
     `case "merge": return mergeCommand(io, rest);`.
   - `arrangeCommand`: when `--mode` is `layered` or `route`, return
     `arrangeLayeredOrRoute(io, args)`. Add `layered|route` to the mode
     validation message. `tidy`/`overlaps` keep their path. Passing
     `--reset-manual`, `--frames` or `--ids` with tidy or overlaps exits 2.
   - `loadDocument`: collapse warning lines with `collapseWarnings` and
     `issueWarningKey`. `warningCount` keeps the real count, so `--strict`
     still exits 3.
   - `validate` text output: collapse the same way.
   - `lintCommand`:
     - Select pages with today's rule OR `diagramLintApplies`, and replace
       `LINT_NO_PAGES` with `LINT_NO_PAGES_MESSAGE`.
     - New flags `--fix` and `--metrics`.
     - With `--fix`, call `lintDiagramPages(..., { fix: true, textLayoutPageIds })`
       first. On `error`, exit 2. Then reload the document and lint as
       usual, printing `formatFixLines` before the table. JSON adds `fixes`.
     - Append `DiagramLintRow`s to each page's findings after the existing
       rule rows.
     - With `--metrics`, print `formatMetricsLines` after the findings.
       JSON adds `metrics` per page and `summary.metrics` totals. The exit
       code is unchanged.
3. `cli.ts:runCliAsync` and `native-engine.ts:nodettoRun`: apply
   `extractQuiet` before their export/open handling and `applyQuiet` once on
   the result. Pass the cleaned args to `runCli` and strip only once (the
   helper is idempotent anyway).
4. `help.ts`:
   - OVERVIEW: `merge` under "Convert and check", and the global `--quiet`.
   - `arrange`: modes, `--direction`, `--frames`, `--ids`, `--reset-manual`,
     eligible page kinds, and the manual-setting rule (Q6). Examples use
     `Stage0` frames.
   - `edit`: `label` on update with the mapping table (`text.note` text,
     `frame` name, `node.generic` label, `state.node` name, `erd.table`
     tableName, `state.transition` trigger, `edge.generic` label); the
     `carryMembers` default (members move, including ones placed earlier in
     the batch) and `carryMembers:false`; unknown fields are rejected with
     valid fields listed.
   - `lint`: the page/rule table, `node-overlap`, `image-missing`, `--fix`
     with the CJK break rule, and `--metrics`.
   - `merge`: usage (`MERGE_USAGE`), conflict policy (ours kept, arrays
     atomic, delete rules), exit codes 0/1/2, and the git driver lines from
     design B2.
   - `export`: the determinism guarantee. `validate`/`export`: `--quiet`
     and collapsing.
5. `docs/cli.md` and `README.md`: the same user-facing content, the git
   driver recipe, the SVG regeneration recipe with a post-merge hook
   example, and `lint --fix`/`--metrics` examples.
6. `design-docs/specs/export.md`: one Goals bullet and one Rollout bullet
   with the text-export determinism guarantee.
   `design-docs/specs/design-cli-ai-drawing.md`: update the pointer line
   only if the help wording differs.

## Tests (input -> expected)

- `cli-wiring.test.ts` (through `runCli`, in-memory io):
  - `merge` is dispatched, and its exit codes are 0/1/2.
  - `arrange --mode layered` and `--mode route` are dispatched.
    `--reset-manual` with tidy -> exit 2. `tidy` output is unchanged.
  - `lint` on an ERD-only document -> node-overlap rows. `--fix` and
    `--metrics` text and JSON. Without the flags, output is unchanged.
  - `validate --quiet` drops warnings and keeps the summary.
    `validate --strict --quiet` -> exit 3. `--format json` keeps every
    warning. `--quiet` after `--` stays positional.
  - 42 identical unknownField warnings -> one collapsed line.
- `merge-git.test.ts` (real `git` in a temp dir; a missing `git` fails the
  test, it does not skip):
  - Setup: init, local user config, `.gitattributes` with
    `*.jsonl merge=nodetto`, and `merge.nodetto.driver` set to
    `"<process.execPath>" "<abs main.ts>" merge %O %A %B --output %A`, or to
    the native binary when `NODETTO_CLI_TEST_BINARY` is set.
  - Disjoint edits -> `git merge` exits 0, and the file has both edits in
    canonical form.
  - The same field edited differently -> `git merge` exits non-zero, the
    file keeps ours canonically, and the output contains `conflict:`.
- Native parity (`compare`, binary from `NODETTO_CLI_TEST_BINARY`):
  - `layout.test.ts`: layered, route, the reset regression,
    `lint --metrics`, and an A7-fixture `arrange --mode layered` deadline
    (10000 ms, spawn timeout 60000, test timeout 120000).
  - `merge.test.ts`: clean, conflict and error merges, the git driver
    scenario with the binary, and Bun-equals-native SVG export of a
    determinism fixture.
  - `edit-usability.test.ts`: update label, an unknown-field error,
    `carryMembers:false`, collapsed warnings, and `--quiet` on `validate`,
    `edit` and `export --format svg`.
  - `lint-rules.test.ts`: ERD overlap, a missing image (including one that
    escapes the document folder), and `--fix` with identical fixed file
    content.
- `ai-commands.test.ts`: help for `merge`, `arrange`, `edit`, `lint` and
  `export` shows the new content. OVERVIEW lists `merge` and `--quiet`.
  `mcp.test.ts`: the tool list includes `nodetto_merge`.

## Verification (each must exit 0)

1. `bun test apps/cli/src/cli-wiring.test.ts apps/cli/src/merge-git.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/commands.test.ts apps/cli/src/mcp.test.ts apps/cli/src/mcp-stdio.test.ts apps/cli/src/text-layout-lint.test.ts apps/cli/src/breadboard-commands.test.ts`.
2. `bun test apps/cli/src/merge-command.test.ts apps/cli/src/arrange-modes.test.ts apps/cli/src/lint-metrics.test.ts apps/cli/src/lint-diagram.test.ts apps/cli/src/warnings.test.ts apps/cli/src/edit-performance.test.ts`.
3. `bun run typecheck`.
4. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/layout.test.ts apps/cli/src/native-parity/merge.test.ts apps/cli/src/native-parity/edit-usability.test.ts apps/cli/src/native-parity/lint-rules.test.ts apps/cli/src/native-parity/edit-performance.test.ts apps/cli/src/merge-git.test.ts`:
   more than 0 tests run, and all pass. Use up to 3 attempts on a deadline
   timeout.
5. `bunx biome check <owned TS files>`.
6. `CARGO_TERM_QUIET=true mise run verify`.
7. `CARGO_TERM_QUIET=true mise run test-cli`, with up to 3 attempts on
   native deadline timeouts. Record each attempt.
8. Run `/usr/bin/time -p target/release/nodetto-cli edit <A7 fixture doc> --ops <A7 ops>`
   and the same with clm-02's baseline binary
   `target/clm-baseline/nodetto-cli` (amendment round 1), both into
   `tmp/clm-s725/clm-09-wiring/timing.log`. Record both CPU times and the
   ratio. The target is about 3 s of CPU time or less. If the baseline
   binary is missing, compare against clm-02's `baseline-native.log`
   instead, and record that as a verification gap.

## Done criteria

- `grep -n '"merge"' apps/cli/src/commands.ts apps/cli/src/help.ts` matches.
  `grep -n "arrangeLayeredOrRoute\|lintDiagramPages\|extractQuiet" apps/cli/src/commands.ts`
  matches all three.
- `grep -rn "packages/core/src" apps/cli/src --include=*.ts` finds no
  relative core imports in the four feature modules.
- Verification 1 to 8 exit 0, with logs and the timing comparison recorded
  in the progress log.
- `git status --short` shows only this plan's writePaths changed in this
  wave.
