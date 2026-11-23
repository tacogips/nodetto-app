# M16 capture-16-docs-final (revision 8, session 889)

Parent reference only; not dispatched. Revision 8 follows design revision
7 (CAP-R7-01 to CAP-R7-04, owner decision of 2026-11-23) and supersedes
revision 7 of this file (three repository-wide gates, the `tmp` evidence
root, the `impl-plans/README.md` Completed entry and the Measured table
from `tmp/capture` logs).

## Split (dispatch `capture-s889`)

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | `capture-16a-help-docs.md` | Two help lines in `capture-help.ts`, `docs/capture.md`, `docs/cli.md` section and AI line, `capture-docs.test.ts` | - |
| 1 | `capture-16b-budgets.md` | Measurements under `target/capture-m16/`, design 10.3 table | - |
| 2 | `capture-16c-finalize.md` | Measured values into `docs/capture.md`, three targeted gates, design header and overview Progress marked accepted with the deferral sentence | M16a, M16b |

M16a and M16b write disjoint files. The design file is written by M16b
(10.3 only) and then by M16c (header only), in that order.

## Rules for all three

- Artifact roots exactly `target`; nothing is written under the repository
  `tmp/`. Native parity (`apps/cli/src/native-parity/capture.test.ts`,
  writes `tmp/capture/m09` and `tmp/capture/m23`) and
  `apps/cli/src/mcp-stdio.test.ts` are excluded and deferred to the full
  verification after the workflow.
- Deferred and NOT yet run: `mise run verify`, browser/Chromium/Vite tests,
  the whole native parity suite, `cargo test --workspace`,
  `cargo test -p nodetto-native`.
- Every verification command exits 0 and runs at least one test; cargo
  runs with `CARGO_TERM_QUIET=true` and `CARGO_TARGET_DIR=target/capture-m16`
  (M16a uses `target/capture-m16a` for its logs and runs no cargo).
- CLI unit tests run with `UPDATE_CAPTURE_FIXTURES=0`; tracked fixtures
  stay unchanged.
- No test, deadline or budget is relaxed; timing tests get up to three
  attempts, then run alone; every attempt is logged.
- No `README.md`, `impl-plans/README.md`, `mise.toml`, cad3d design or
  cad3d plan edit. Plans are not moved; archiving is the workflow's job.
- Each plan writes progress only to its own plan file, with
  `git hash-object` before and after each owned file and drift stops.

## Operative M16 gates (design 8.5)

1. `CARGO_TARGET_DIR=target/capture-m16 sh -c 'bun run typecheck && bunx biome check apps/cli/src/capture-help.ts apps/cli/src/capture-docs.test.ts && bun test apps/cli/src/capture-docs.test.ts apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/table-docs.test.ts'`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m16 cargo test -p nodetto-capture`
3. `UPDATE_CAPTURE_FIXTURES=0 CARGO_TARGET_DIR=target/capture-m16 bun test apps/cli/src/capture-command.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-io.test.ts apps/cli/src/capture-interference-options.test.ts apps/cli/src/mcp-image.test.ts`

M16c runs them on the final tree with logs under `target/capture-m16/gates/`.

## Acceptance

M16 is accepted when M16a, M16b and M16c are accepted by their per-plan
reviews and M16c's gates pass. Until then the design header and the
overview keep M16 pending (CAP-R7-04).

## Progress

Revision 8 written by the session 889 plan author. Sub-plans record their
own progress.
