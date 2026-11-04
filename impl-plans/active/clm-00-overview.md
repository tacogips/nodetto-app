# clm-00 overview: layered/route arranging, merge, edit usability, lint additions

- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, including the
  section "Plan partition (maximum concurrency)", which is binding for
  ownership and contract names.
- Owner questions: `design-docs/user-qa/cli-layout-merge-lint.md`, Q1 to Q6.
  Implement each default.
- This overview is not dispatched and has no write paths.

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
