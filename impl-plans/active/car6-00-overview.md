# car6-00-overview: audit round 6 corrections

- Task: `car6-r6`; dispatch manifest `impl-plans/active/car6-r6-dispatch.json`.
- Source: round-6 audit of the 3D CAD pages and AI capture, base `0a35708`, head
  `feat/ai-capture` at `6f58a74f717475d515122570804c9a63a7fd6bb8` plus the uncommitted
  round 5 working tree. Four findings (three high, one medium). No GitHub issue exists;
  the workflowInput is the issue body.
- Design (accepted by step 3): `design-docs/specs/design-ai-capture.md` section 24
  (R6-1 to R6-4, 24.2 plan grouping and gates, 24.3 decisions, 24.5 risks). Where it and
  an earlier section disagree, section 24 wins.
- Evidence root: `tmp/car6-r6/<planId>/` (outside every artifact root).

## Plans and waves

| Wave | Plan | Rule | Owns | dependsOn |
| --- | --- | --- | --- | --- |
| 1 | car6-f1-diagnostic-tokens | R6-1 | `apps/cli/src/ids.ts`, new `ids.test.ts`, `capture-cad.test.ts`, `cad-command.test.ts` | none |
| 1 | car6-f2b-incomplete-describe | R6-2 core | `packages/core/src/capture/{report,describe}.ts` and tests | none |
| 1 | car6-f3-request-scan-budget | R6-3 | `crates/capture/src/{lattice,interference,census,tool_view}.rs`, `tests/interference.rs` | none |
| 2 | car6-f2a-coarse-incomplete | R6-2 Rust | `crates/capture/src/{lattice,interference,report}.rs`, `tests/{interference,render}.rs` | f3 |
| 2 | car6-f4-not-sampled-notes | R6-4 + R6-2 desktop test | `describe.ts`, `describe.test.ts`, `export-handlers.ts`, `export-handlers.test.ts`, new `capture-cad-census.test.ts` | f2b |
| 3 | car6-f2c-incomplete-cli | R6-2 CLI + native | `capture-interference-options.ts` and test, `capture-cad.test.ts`, native `capture.test.ts`, `docs/capture.md` | f1, f2b, f2a |

Every chain is a shared file or a real contract (design 24.2). No two plans of the same
wave share a file.

## Cross-plan contracts (pinned; do not change them in a plan)

- Rust report JSON: inside `analysis`, after the `cappedWithoutHit` array, the key
  `"incomplete":[[a,b],...]` appears only when non-empty (f2a writes it; f2b parses it).
- TS `SolidAnalysisReport.incomplete?: readonly (readonly [number, number])[]` (f2b).
  `describeInterference` returns `incomplete: number` and CLI JSON
  `incomplete?: readonly (readonly [string, string])[]` only when non-empty (f2b).
- `describeBodies` returns `notSampled: readonly string[]` (f4).
- Rust: `ToolView::triangle_cost(&self, ray: &Ray) -> usize`,
  `BoundaryBudget { triangles, triangle_limit }`,
  `charge_scan(&mut self, count: usize, triangles: usize) -> bool`,
  `sample_axes(.., triangle_limit: u64)`, `sample_pair(.., triangle_limit: u64)`,
  `sample_body_axis_with(.., triangles_left: &mut u64, ..)`,
  `const REQUEST_TRIANGLE_ENTRIES_PER_BUDGET_RAY: u64 = 32` (f3). f2a builds on them.
- No golden regenerated, no NCS1 change, no error-code change, no change to existing
  messages when the new states are absent.

## Worker rules (every plan)

1. Edit only the plan's `writePaths`. Your progress log is
   `impl-plans/progress/<planId>.md`; you may append an `## Implementation status`
   section to your own plan file. Never edit another plan's log or plan, this overview,
   the manifest, lockfiles, indexes or design docs.
2. Before each file edit read the file fresh and record its sha256 in the progress log;
   record the post-edit sha256 and a one-line intent. If a file changed since your last
   read and you did not change it, stop editing it, record the drift and re-read.
3. Write the regression test first, run it on the unmodified code and record the
   failing output. Pinned literals (f3 prism-only control) are recorded on the
   unmodified working tree before any production edit; the log must show that run
   first. Performance tests assert deterministic counters, never wall clock.
4. Cargo always runs with `CARGO_TERM_QUIET=true` and `CARGO_TARGET_DIR` named in the
   plan. Run `rustfmt --edition 2021` on touched Rust files only.
5. TypeScript: strict typing, indexed reads type-check under `noUncheckedIndexedAccess`,
   Biome clean on touched files (one variable per declaration). English only, no emojis.
6. Never relax or delete an existing test, threshold or deadline. Timing rule (design
   24.2): a crate gate failing only on a timing assertion gets at most three attempts in
   total, each logged; then the failing test alone runs once with its exact name, e.g.
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f3 cargo test --release -p nodetto-capture --lib tiles::tests::many_tools_exceed_limit_within_budget -- --exact --nocapture`
   (or `tiles::tests::many_sparse_bodies_build_within_budget`). The log must show
   `running 1 test`. Report full-gate failures and the isolated outcome separately; a
   passing isolated run never turns the gate into a pass.
7. Never regenerate goldens. If an existing pin or golden changes, stop and report
   `blocked` (f3 may first apply its one allowed constant change, see its plan).
8. Native parity runs only after
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=<plan target> cargo build --release -p nodetto-cli`
   in the same plan, with `NODETTO_CLI_TEST_BINARY` set to that binary.
9. Per-plan verification is focused. `bun run typecheck`, `bun run lint`,
   `mise run verify` and the full native suite run once at integration.
10. Evidence goes under `tmp/car6-r6/<planId>/`. No `*.test.ts` may remain under
    `target/` or `tmp/` when the plan finishes.
11. A failure caused by a sibling's in-progress edit is rerun after the sibling's
    progress log reads `done`; never fix it by editing the sibling's files.
12. Only read-only git (`git diff`, `git show`, `git status`). No commits, branches,
    stashes or worktrees. Preserve every round 5 uncommitted change.
13. Progress log: status (`in-progress` / `done` / `blocked`), edited files with pre/post
    sha256, every verification command with exit status and complete log path under
    `target/<plan target>/logs/` or the evidence root, the pre-fix failing evidence and
    measured counters.

## Integration gates (after all six plans are done; each exits 0 and records its log)

1. `bun run typecheck && bun run lint`
2. `CARGO_TERM_QUIET=true mise run verify`
3. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
4. `sh -c 'for root in target tmp; do if [ -d "$root" ]; then matches=$(find "$root" -name "*.test.ts" -print) || exit 1; if [ -n "$matches" ]; then printf "%s\n" "$matches"; exit 1; fi; fi; done'`
