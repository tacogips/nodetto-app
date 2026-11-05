# clm-00 overview: layered/route arranging, merge, edit usability, lint additions

- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, including the
  section "Plan partition (maximum concurrency)", which is binding for
  ownership and contract names.
- Owner questions: `design-docs/user-qa/cli-layout-merge-lint.md`, Q1 to Q6.
  Implement each default.
- This overview is not dispatched and has no write paths.

## Continuation 4 2026-11-05 (clm-s737) - authoritative

Manifest: `impl-plans/active/clm-s737-dispatch.json`, source commit `c5484577164daf4c4f5b57d888e1b291f84d7867`, evidence
root `tmp/clm-s737/<planId>/`. The clm-s725, clm-s731, clm-s732 and clm-s736 manifests are stale and must not be
dispatched. Supersedes every table below. Accepted and landed: clm-01, 03, 04, 06, 07, 08, 10, 12, 13, 14, 15. Each plan's
"Continuation 4" section is authoritative for that plan.

| Wave | Plan | Remaining scope | dependsOn |
| --- | --- | --- | --- |
| 1 | clm-02-connector-edit-perf | D3': marginal ratios, scoped validation, verified line reuse, timings | - |
| 1 | clm-11-container-carry | E1 CLI module and per-kind tests | - |
| 2 | clm-09-wiring | Registration, BPMN dispatch, help, docs, parity, git e2e, final gates | clm-02, clm-11 |

Open owner decision: Q11 is blocking and has no default. No plan changes depth-one output or pins the conflict inputs in a
test, and the run does not report depth-one containment as met for them. Q12 is closed, superseded by D3'.

## Continuation 3 2026-11-05 (clm-s736) - superseded by Continuation 4

Manifest: `impl-plans/active/clm-s736-dispatch.json`, base HEAD
`d5b9bac98e29bba2159f7e6791dc39938e392953`, evidence root `tmp/clm-s736/<planId>/`. The clm-s725,
clm-s731 and clm-s732 manifests are stale and must not be dispatched. Supersedes every table below.
Accepted and landed: clm-01, 03, 04, 06, 07, 08, 10, 13, 14, 15. Each plan's "Continuation 3" section
is authoritative for that plan.

| Wave | Plan | Remaining scope | dependsOn |
| --- | --- | --- | --- |
| 1 | clm-02-connector-edit-perf | D3: native attribution, removal, ratio outcome, attribution record | - |
| 1 | clm-12-bpmn-layered | D1 and settling at `D` of at least 2, D2 inset, strict depth-one identity | - |
| 2 | clm-11-container-carry | E1 CLI module and per-kind tests | clm-02 |
| 3 | clm-09-wiring | Registration, BPMN dispatch, help, docs, parity, git e2e, final gates | clm-02, 11, 12 |

Open owner decisions: Q11 is blocking and has no default. Until it is answered, no plan changes
depth-one output, no plan pins the conflict inputs in a test, and the run does not report depth-one
containment as met for them. Q12 applies only if an A7 ratio stays above 2.0x.

Each plan lists its own plan file in `writePaths` for ownership tracking only. Workers must leave it
unchanged, and a verification command checks that. Single writer of the "A7 attribution record"
subsection of the design: clm-02. In the shared working rules below, use `tmp/clm-s736/<planId>/` for
evidence.

## Amendment 2026-11-05 (clm-s732, round 1) - authoritative

Supersedes the table below. clm-06 is accepted; its reviewed edits are uncommitted on
top of `b68036c`. New plan clm-15 owns the `bun test` JSX load failure, because
`mise run verify` cannot pass without it.

| Wave | Plan | Remaining scope | dependsOn |
| --- | --- | --- | --- |
| 1 | clm-02-connector-edit-perf | All of the A7 continuation and the E1 engine option `keepMembers` | - |
| 1 | clm-12-bpmn-layered | Non-leaf parent expectation under the amended contract, evidence cleanup | - |
| 1 | clm-15-bun-test-jsx | Six `bun test` files that fail to load with the `jsxDEV` error | - |
| 2 | clm-11-container-carry | E1 CLI module and per-kind tests | clm-02 |
| 3 | clm-09-wiring | Registration, BPMN dispatch, help, docs, parity, git e2e, final gates | clm-02, 11, 12, 15 |

Round 2 (same date): clm-12 `writePaths` also lists its own plan file, for ownership and
snapshot tracking only. The worker must not edit it. Waves and dependsOn are unchanged.

## Continuation 2 2026-11-05 (clm-s732) - authoritative

Manifest: `impl-plans/active/clm-s732-dispatch.json`, base HEAD
`29f8691135fb6098a9496495f4a417e93ce0625e`, evidence root `tmp/clm-s732/<planId>/`.
The clm-s725 and clm-s731 manifests are stale and must not be dispatched. Accepted:
clm-01, 03, 04, 07, 08, 10, 13, 14.

| Wave | Plan | Remaining scope | dependsOn |
| --- | --- | --- | --- |
| 1 | clm-02-connector-edit-perf | All of the A7 continuation and the E1 engine option `keepMembers` | - |
| 1 | clm-06-route-arrange | Coverage gaps G1 to G11 and any defects they reveal | - |
| 1 | clm-12-bpmn-layered | Free-row rule, row lookup, collapsed pool contents, missing regressions | - |
| 2 | clm-11-container-carry | E1 CLI module and per-kind tests | clm-02 |
| 3 | clm-09-wiring | Registration, BPMN dispatch, help, docs, parity, git e2e, final gates | clm-02, 06, 11, 12 |

Each plan's "Continuation 2" section is authoritative and states what has landed. The
sections below it stay binding where not amended. Single owners in this run:
`apps/cli/src/edit/batch.ts`, `apps/cli/src/edit/selectors.ts`,
`apps/cli/src/edit/apply-batch.ts` and the core planner files (clm-02 in wave 1;
clm-11 for defects only in wave 2; clm-09 for one `apply-batch.ts` line in wave 3);
`apps/cli/src/edit/operations/elements.ts` (clm-11);
`apps/cli/src/arrange-modes.ts` and `arrange-modes.test.ts` (clm-06, then clm-09).
Keep evidence under 300 files per plan, because plan snapshots count them.

## Continuation 2026-11-04 (clm-s731) - history

Manifest: `impl-plans/active/clm-s731-dispatch.json`. The clm-s725 manifest
(`impl-plans/active/clm-s725-dispatch.json`) is stale and must not be
dispatched. Landed and accepted at HEAD 4d82d91: clm-01, clm-03, clm-04,
clm-07, clm-08, and the clm-02 IR/resolver/single-page work. Owner questions
Q1 to Q10; implement each default.

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | clm-02-connector-edit-perf (continuation) | A7 multi-page fixtures, profile, dirty-page planning; E1 engine `keepMembers` | - |
| 1 | clm-06-route-arrange | A2-A5 with E2.2 BPMN/ERD rules, BPMN label anchor and `bpmnFlowLabelBox`, `isLabelObstacle`, metrics, `arrange-modes.ts`, `lint-metrics.ts` | - |
| 1 | clm-10-layered-fixes | TB title band, precomputed frame ranks, `erd` in `LAYERED_PAGE_KINDS` | - |
| 1 | clm-12-bpmn-layered | `planLayeredBpmn` (E2.1) | - |
| 1 | clm-13-edit-selectors | F1-F3, F4 field rows, match report | - |
| 1 | clm-14-lint-image-path | `documentRelativePath`, traversal tests | - |
| 2 | clm-11-container-carry | `carry-members.ts`, E1 per-kind rules, update handler swap | clm-02 |
| 3 | clm-09-wiring | shared files, BPMN dispatch, `matches` passthrough, help/docs, parity, git e2e, final gates | all above |

Single owners within the continuation: `packages/core/src/bpmn/notation.ts`
(clm-06), `packages/core/src/arrange-layered.ts` (clm-10),
`apps/cli/src/edit/batch.ts` and `operations/*.ts` (clm-13 in wave 1, then
clm-11 for the carry block in wave 2), `apps/cli/src/edit/apply-batch.ts`
(clm-02 in wave 1, then clm-09 for one line), `apps/cli/src/arrange-modes.ts`
(clm-06, then clm-09 for the BPMN dispatch), `apps/cli/src/lint-diagram.ts`
(clm-14, then clm-09 for imports). Evidence root: `tmp/clm-s731/<planId>/`.
The sections below are the clm-s725 history.

## Waves and ownership

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | clm-01-merge | B1 engine and `merge-command.ts`, B3 determinism test | - |
| 1 | clm-02-connector-edit-perf | IR connector fields, resolver, A7 profile and fix, A7 deadline tests | - |
| 1 | clm-03-lint-core | D1 `node-overlap` rule, D2 wrapper and fix planner | - |
| 1 | clm-04-edit-usability | C1, C2, C3 module, A6 | - |
| 1 | clm-07-layered-core | A1 placement (pure core) | - |
| 2 | clm-06-route-arrange | A2 to A5 planner, metrics, `arrange-modes.ts`, `lint-metrics.ts` | clm-02, clm-07 |
| 2 | clm-08-lint-cli | `lint-diagram.ts`: page selection, D1 wiring, D2 `--fix`, D3 | clm-03 |
| 3 | clm-09-wiring | shared files, registration, help, docs, re-exports, CLI-level, native parity and git end-to-end tests, final gates | all |

The draft plans clm-02-edit-perf and clm-05-connector-fields both edited
`packages/core/src/shapes/connector/resolve.ts`. They are merged into
clm-02-connector-edit-perf. The draft clm-06-route-core and
clm-09-arrange-cli are replaced by clm-06-route-arrange and clm-09-wiring.

clm-08 depends only on clm-03. The fixes it applies name their target field
directly (`TextWrapFix.field`), so it does not call clm-04's `labelField`.
This narrows the design table's clm-04 dependency, which was not a real call.

### Shared files (only clm-09 edits them)

`apps/cli/src/commands.ts`, `apps/cli/src/help.ts`, `apps/cli/src/cli.ts`,
`apps/cli/src/main.ts`, `apps/cli/src/native-engine.ts`, `apps/cli/src/mcp.ts`,
`packages/core/src/index.ts`, `docs/cli.md`, `README.md`,
`design-docs/specs/export.md`, `design-docs/specs/design-cli-ai-drawing.md`.
The design names `main.ts` for the `--quiet` export path, but the real
entry is `cli.ts:runCliAsync` (called by `main.ts`), so `cli.ts` is added.

### Import rule before wiring

- Feature CLI modules may import values from `apps/cli/src/commands.ts`
  (`parseArgs`, `loadDocument`, `writeOutput`, `ok`, `fail`, `selectPage`),
  as `apps/cli/src/diff-command.ts` already does. They never edit it.
- A new core symbol that is not yet in `packages/core/src/index.ts` is
  imported by relative path, for example
  `../../../packages/core/src/document-merge.ts`. clm-09 adds the exports
  and switches those imports to `@nodetto/core`.

## Contracts (binding names, from the design)

| Symbol | Owner | Consumers |
| --- | --- | --- |
| `ConnectorRoutingSemantic.labelPosition/fromPortPosition/toPortPosition`, `connectorLabelBoxAt`, `pointAlongRoute` | clm-02 | clm-06 |
| `planLayered`, `LayeredOptions`, `columnFrames`, `LAYERED_PAGE_KINDS` | clm-07 | clm-06 |
| `planRoute`, `RouteOptions`, `pageMetrics`, `PageMetrics` | clm-06 | clm-06 CLI modules, clm-09 |
| `lintNodeOverlaps`, `NodeOverlapFinding`, `NODE_OVERLAP_PAGE_KINDS`, `wrapTextToWidth`, `planTextWrapFixes`, `TextWrapFix` | clm-03 | clm-08 |
| `mergeDocumentVersions`, `VersionConflict`, `mergeCommand` | clm-01 | clm-09 |
| `labelField`, `collapseWarnings`, `extractQuiet`, `applyQuiet`, `issueWarningKey` | clm-04 | clm-09 |
| `arrangeLayeredOrRoute`, `lintMetrics`, `formatMetricsLines` | clm-06 | clm-09 |
| `lintDiagramPages`, `DiagramLintResult`, `diagramLintApplies`, `LINT_NO_PAGES_MESSAGE` | clm-08 | clm-09 |

A plan may add an optional parameter or an extra export. It never renames
or removes a contract symbol, and it records any addition in its progress
log.

## Shared working rules (all plans)

- Before the first edit, write an intent snapshot into
  `impl-plans/progress/<planId>.md`: plan id, `git rev-parse HEAD`, and the
  files you will touch.
- Before every edit, read the file again and record its `git hash-object`.
  After the edit, record the new hash. A file outside your `writePaths`
  that changes while you work is drift: record it and leave it alone.
- Edit only your own progress log. Evidence logs go under
  `tmp/clm-s725/<planId>/` (`tmp/` is git-ignored), as `.log` or `.txt`
  files, each with the command and its exit code.
- No worktrees, branches, commits, pushes, broad formatters or lockfile
  changes. Format only your own files:
  `bunx biome format --write <owned files>`. Run cargo with
  `CARGO_TERM_QUIET=true`.
- Run `bun run typecheck` after TS changes. Core code must be safe under
  `noUncheckedIndexedAccess` (guard every indexed access).
- Boa rules: no regex `split` on whole documents, and no per-point
  destructuring in hot geometry loops. Use indexed loops.
- Fixtures and text are neutral and self-authored: widgets, orders,
  `Idle`, `Running`, `Stage0`. Never name external issues, organizations,
  reporters or downstream products.
- A wave-1 or wave-2 typecheck or native build failure caused only by a
  sibling plan's in-progress file is drift. Record it, wait, and rerun. Never
  edit the sibling's file.
- Native parity commands always set the binary:
  `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test <file>`.
  Never use a binary-less native parity command. Give native deadline tests
  up to 3 attempts before treating a timeout as a failure, and never relax
  an existing deadline.
- Every plan declares `artifactRoots ["target"]` and lists `target` in its
  writePaths. `target` is the shared cargo build output, not a source path.

## Final gates (clm-09, after every other plan)

- `CARGO_TERM_QUIET=true mise run verify` exits 0.
- `CARGO_TERM_QUIET=true mise run test-cli` exits 0, with up to 3 attempts
  on native deadline timeouts.
- `/usr/bin/time -p` CPU time of the A7 fixture edit with the new release
  binary is recorded and compared against the baseline that clm-02 recorded
  with the pre-change binary. The target is about 3 s of CPU time or less.
