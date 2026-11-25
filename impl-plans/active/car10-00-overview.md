# car10-00-overview: audit round 10 corrections

- Task: `car10-r10`; dispatch manifest `impl-plans/active/car10-r10-dispatch.json`.
- Source: round-10 audit of the 3D CAD pages and AI capture, base `0a35708`, head
  `feat/ai-capture` at `43197ca051dbca62251631b3f190b150252ee7c9`. Four findings:
  `function-capture-failed-create-removes-successful-replacement` (medium),
  `performance-cad-containment-crossings-outside-ray` (high),
  `performance-cad-profile-depth-enumerates-all-ancestors` (medium) and
  `maintainability-capture-hole-containment-precision` (medium). No GitHub issue
  exists; the workflowInput is the issue body.
- Design (accepted by step 3): `design-docs/specs/design-ai-capture.md` sections 4.3,
  6.1, 12 and 28. 28.1 has rules R10-1 to R10-4, 28.2 the grouping and gates, 28.3
  the decisions, 28.4 the intentional differences and 28.5 the risks. Section 28
  wins over earlier sections. The design is already edited; no plan edits a design
  document.
- Evidence root: `tmp/car10-r10/<planId>/`, which is outside every artifact root.
- Date: 2026-11-25.

## Plans

| Plan | Rule | Owns | dependsOn | Wave |
| --- | --- | --- | --- | --- |
| car10-p1-capture-write-rust | R10-1 native CLI | `crates/native/src/fs.rs` | - | 1 |
| car10-p2-capture-write-bun | R10-1 Bun host | `apps/cli/src/capture-io.ts`, `apps/cli/src/capture-io.test.ts`, `apps/cli/src/write-atomic.ts` | - | 1 |
| car10-p3-scene-grid-ancestry | R10-4 | `packages/core/src/capture/scene.ts`, `packages/core/src/capture/scene.test.ts` | - | 1 |
| car10-p4-edge-index-ray-origin | R10-2 index + `loops.ts` | `packages/core/src/cad/edge-y-index.ts`, `packages/core/src/cad/loops.ts`, `packages/core/src/cad/loops.test.ts` | - | 1 |
| car10-p6-loop-forest | R10-3 module | new `packages/core/src/cad/loop-forest.ts`, new `packages/core/src/cad/loop-forest.test.ts` | - | 1 |
| car10-p5-scene-ray-origin | R10-2 `scene.ts` | `packages/core/src/capture/scene.ts`, `packages/core/src/capture/scene.test.ts`, `packages/core/src/cad/edge-y-index.ts` | p3, p4 | 2 |
| car10-p7-profile-depth-forest | R10-3 integration | `packages/core/src/cad/loops.ts`, `packages/core/src/cad/loops.test.ts`, `packages/core/src/capture/scene.test.ts` | p4, p5, p6 | 3 |

## Cross-plan contracts

- p4 -> p5, p7: `packages/core/src/cad/edge-y-index.ts` exports
  - `EdgeIndexStats { builds: number; visits: number; inspections: number; bulk?: number }`;
  - `EdgeYIndex`, whose shape p4 owns;
  - `buildEdgeYIndex(points: ArrayLike<number>, stats?: EdgeIndexStats): EdgeYIndex`;
  - `crossingParity(index: EdgeYIndex, x: number, y: number, exact: (edge: number) => boolean, stats?: EdgeIndexStats): boolean`;
  - `forEachEdgeAtY`, unchanged. p4 keeps it for `scene.ts`, and p5 removes it.

  Edge `e` runs from vertex `(e + n - 1) % n` to vertex `e`. Only edges with
  `ay !== by` are indexed. `builds` grows by n, the vertex count, per index built.
- p3 -> p5: `scene.ts` `LoopEntry` carries `grid: number[]` (nanometre integers)
  plus grid bounds, and `containsPoint` uses the `loops.ts` grid predicate. p5 only
  swaps the query call.
- p6 -> p7: `packages/core/src/cad/loop-forest.ts` exports
  - `ForestStats { events: number; steps: number }`;
  - `loopForest(grids: readonly (readonly number[])[], windings: readonly number[], stats?: ForestStats): { parents: number[]; depths: number[] }`.

  The module imports only `./vec.ts` and is not re-exported.
- p1 and p2 share no file. Both keep the `"written" | "identical" | "exists"`
  (`NewFile`) results, link refusal, permissions and forced replacement.
  Desktop export (`write_export_atomic`, `write_selected_file_atomic`) is out of
  scope and must not be touched.
- No plan edits callers (`pcb-outline.ts`, `history.ts`, `cad-request.ts`,
  `apps/cli/native/src/files.rs`, `capture-command.ts`, the desktop sources),
  `crates/native/tests/file_contract.rs`, `docs/`, goldens, lockfiles or indexes.

## Worker rules (every plan)

1. Edit only the plan's `writePaths`. The progress log is
   `impl-plans/progress/<planId>.md`. You may append `## Implementation status` to
   your own plan file. Never edit another plan, this overview, the manifest, design
   docs, lockfiles or indexes.
2. Before each file edit, read the file fresh and record its sha256 in the progress
   log. After the edit, record the new sha256 and a one-line intent. If a file
   changed since your last read and you did not change it, stop, record the drift
   and re-read. Repair only your own edits.
3. Write the regression test first and record the failing run on the pre-fix code,
   with a complete log under the evidence root. Then fix and record the passing run.
   The plan names which test is the fail-before evidence.
4. TypeScript:
   - strict typing;
   - indexed reads must type-check under `noUncheckedIndexedAccess`;
   - no non-null assertions in production code;
   - Biome clean on touched files (one variable per declaration).

   Rust: `cargo fmt`, clippy `-D warnings`, no `unsafe`, no panics on input. English
   only, no emojis, no new dependency.
5. Never relax, delete or edit an existing test, threshold or deadline. The only
   exceptions are the edits design 28.4 lists and the plans name (p2's single
   in-mock line, p3's oracle helper). Never regenerate goldens.
6. Timing rule (design 26.2):
   - A command whose only failures are existing timing or deadline tests may run up
     to three times in all.
   - After that, each failing timing test runs alone, and an isolated pass counts.
   - Every stage that an `&&` chain skipped still runs.
   - Keep every nonzero status and complete logs.
   - New performance behaviour is asserted only with counters, never clocks.
7. Run cargo always with `CARGO_TERM_QUIET=true` and the plan's own
   `CARGO_TARGET_DIR=target/car10-<suffix>`.
8. Per-plan verification is focused. `bun run typecheck`, `bun run lint`,
   `mise run verify` and the release build run once, at integration.
9. Run at most two `bun test` or `cargo test` processes at a time across plans.
10. No `*.test.ts` may remain under `target/` or `tmp/` when a plan finishes.
11. If a sibling's in-progress edit causes a failure, rerun after the sibling's
    progress log reads `done`. Never fix it in the sibling's files.
12. Use only read-only git (`git diff`, `git show`, `git status`). No commits,
    branches, stashes or worktrees. Preserve every pre-existing uncommitted change.
13. The progress log records:
    - status (`in-progress` / `done` / `blocked`);
    - edited files with pre/post sha256;
    - every command with its exit status and complete log path;
    - the pre-fix failing output;
    - for the performance plans, the counter series before and after.

## Integration gates (after all plans are done; in order, each logged)

1. `bun run typecheck && bun run lint`
2. `CARGO_TERM_QUIET=true mise run verify` (goldens are checked, never regenerated;
   rule 6 applies)
3. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/mcp-stdio.test.ts`
4. `sh -c 'for root in target tmp; do if [ -d "$root" ]; then matches=$(find "$root" -name "*.test.ts" -print) || exit 1; if [ -n "$matches" ]; then printf "%s\n" "$matches"; exit 1; fi; fi; done'`
