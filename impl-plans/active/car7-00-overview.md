# car7-00-overview: audit round 7 corrections

- Task: `car7-r7`; dispatch manifest `impl-plans/active/car7-r7-dispatch.json`.
- Source: round-7 audit of the 3D CAD pages and AI capture, base `0a35708`, head
  `feat/ai-capture` at `2be9db17d22603cf1abe8e21bf0fa39a8b0e4769` plus the uncommitted
  round 6 working tree. Two high findings and one low fixture typing error. No GitHub
  issue exists; the workflowInput is the issue body.
- Design (accepted by step 3): `design-docs/specs/design-ai-capture.md` section 25
  (R7-1, R7-2, 25.2 grouping and gates, 25.3 decisions, 25.5 risks). R7-1 builds on
  section 24.1 R6-2. Where section 25 and an earlier section disagree, section 25 wins.
- Round 6 status: car6-f1, f2b, f3 and f4 landed. car6-f2a and car6-f2c never ran and
  are superseded by car7-f1a and car7-f1b; their plan files are history, not executed.
- Evidence root: `tmp/car7-r7/<planId>/` (outside every artifact root).

## Plans (one wave, no dependsOn, no shared file)

| Plan | Rule | Owns |
| --- | --- | --- |
| car7-f1a-coarse-witness | R7-1 Rust producer + native case | `crates/capture/src/{lattice,interference,report}.rs`, `crates/capture/tests/{interference,render}.rs`, `apps/cli/src/native-parity/capture.test.ts`, timing outputs `tmp/capture/m09/timing.json`, `tmp/capture/m23/timing.json` |
| car7-f1b-incomplete-exit | R7-1 exit rule, help, docs, fixture | `apps/cli/src/{capture-interference-options.ts,capture-interference-options.test.ts,capture-cad.test.ts,capture-help.ts}`, `apps/cli/src/capture-help/interference.ts`, `docs/capture.md`, `packages/core/src/capture/report.test.ts` |
| car7-f2-picture-triangle-bound | R7-2 | `crates/capture/src/raster.rs`, `crates/capture/src/raster/{budget.rs,tests.rs}` |

## Cross-plan contracts (pinned; do not change them in a plan)

- Rust report JSON: inside `analysis`, right after the `cappedWithoutHit` array,
  `"incomplete":[[a,b],...]` only when non-empty (f1a writes it; the TS parser already
  reads it). `incomplete` is a subset of `cappedWithoutHit`; `checked` is unchanged.
- `interferenceExitCode(report, true)` is 1 when pairs, unchecked candidates or a
  non-empty `analysis.incomplete` exist; refinement-only caps stay 0 (f1b).
- Picture refusal string is unchanged (f2): `The scene is too heavy for this picture size
  (picture boundary scans over <allowance>). Use a smaller --size.`
- No golden regenerated, no NCS1 change, no error-code change, no change to existing
  messages when the new states are absent.

## Worker rules (every plan)

1. Edit only the plan's `writePaths`. Progress log: `impl-plans/progress/<planId>.md`.
   You may append `## Implementation status` to your own plan file. Never edit another
   plan, this overview, the manifest, design docs, lockfiles or indexes.
2. Before each file edit read the file fresh and record its sha256 in the progress log;
   after the edit record the new sha256 and a one-line intent. If a file changed since
   your last read and you did not change it, stop, record the drift and re-read.
3. Write the regression test first, run it on the unmodified code and record the failing
   output (f2: run after the measurement-only step, see its plan). Performance tests
   assert deterministic counters, never wall clock.
4. Cargo always with `CARGO_TERM_QUIET=true` and the plan's `CARGO_TARGET_DIR`. Run
   `rustfmt --edition 2021` on touched Rust files only.
5. TypeScript: strict typing, indexed reads type-check under `noUncheckedIndexedAccess`,
   Biome clean on touched files (one variable per declaration). English only, no emojis.
6. Never relax or delete an existing test, threshold or deadline. Timing rule (design
   24.2): a crate gate failing only on a timing assertion gets at most three attempts in
   total, each logged; then the failing test alone runs once with its exact name, e.g.
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f2 cargo test --release -p nodetto-capture --lib tiles::tests::many_tools_exceed_limit_within_budget -- --exact --nocapture`.
   The log must show `running 1 test`. Report full-gate failures and the isolated outcome
   separately; a passing isolated run never turns the gate into a pass.
7. Never regenerate goldens. If an existing pin or golden changes, stop and report
   `blocked` (f2 may first apply its one allowed constant change, see its plan).
8. Native parity runs only after
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=<plan target> cargo build --release -p nodetto-cli`
   in the same plan, with `NODETTO_CLI_TEST_BINARY` set to that binary.
9. Per-plan verification is focused. `bun run typecheck`, `bun run lint` and
   `mise run verify` run once at integration.
10. Evidence goes under `tmp/car7-r7/<planId>/`. No `*.test.ts` may remain under
    `target/` or `tmp/` when the plan finishes.
11. A compile or bundle failure caused by a sibling's in-progress edit is rerun after
    the sibling's progress log reads `done`; never fix it in the sibling's files.
12. Only read-only git (`git diff`, `git show`, `git status`). No commits, branches,
    stashes or worktrees. Preserve every pre-existing uncommitted change.
13. Progress log: status (`in-progress` / `done` / `blocked`), edited files with pre/post
    sha256, every verification command with exit status and complete log path, the
    pre-fix failing evidence and measured counters.

## Integration gates (after all three plans are done; each exits 0 and records its log)

1. `bun run typecheck && bun run lint` (typecheck exit 0 needs f1b's `as const` fix)
2. `CARGO_TERM_QUIET=true mise run verify`
3. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
4. `sh -c 'for root in target tmp; do if [ -d "$root" ]; then matches=$(find "$root" -name "*.test.ts" -print) || exit 1; if [ -n "$matches" ]; then printf "%s\n" "$matches"; exit 1; fi; fi; done'`
