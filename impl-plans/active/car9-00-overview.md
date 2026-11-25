# car9-00-overview: audit round 9 corrections

- Task: `car9-r9`; dispatch manifest `impl-plans/active/car9-r9-dispatch.json`.
- Source: round-9 audit of the 3D CAD pages and AI capture, base `0a35708`, head
  `feat/ai-capture` at `aede81d4f21f42d701a081bc1e80e29ae4f5524e`. Two findings:
  `performance-cad-containment-perimeter-rescans` (high) and
  `function-mcp-inline-image-replaced-before-readback` (medium). No GitHub issue
  exists; the workflowInput is the issue body.
- Design (accepted by step 3): `design-docs/specs/design-ai-capture.md` sections 4.5,
  11 and 27 (27.1 R9-1 and R9-2 with the Bun and native staging, 27.2 grouping and
  gates, 27.3 decisions, 27.4 intentional differences, 27.5 risks). Section 27 wins
  over earlier sections. The design already updated 4.5 and 11; no plan edits a
  design document.
- Evidence root: `tmp/car9-r9/<planId>/` (outside every artifact root).

## Plans

| Plan | Rule | Owns | dependsOn | Wave |
| --- | --- | --- | --- | --- |
| car9-p1-edge-index-loops | R9-1 index + depth pass | new `packages/core/src/cad/edge-y-index.ts`, `packages/core/src/cad/loops.ts`, `packages/core/src/cad/loops.test.ts` | - | 1 |
| car9-p3-mcp-bun | R9-2 Bun | `apps/cli/src/mcp.ts`, `apps/cli/src/mcp.test.ts` | - | 1 |
| car9-p4-mcp-native | R9-2 native | `apps/cli/native/src/engine.rs`, `apps/cli/native/src/mcp.rs`, `apps/cli/native/src/engine_tests.rs` | - | 1 |
| car9-p2-scene-edge-index | R9-1 ancestor pass | `packages/core/src/capture/scene.ts`, `packages/core/src/capture/scene.test.ts` | p1 | 2 |

## Cross-plan contracts

- p1 -> p2: `packages/core/src/cad/edge-y-index.ts` exports exactly
  `EdgeIndexStats`, `EdgeYIndex`, `buildEdgeYIndex(points: ArrayLike<number>,
  stats?: EdgeIndexStats): EdgeYIndex` and `forEachEdgeAtY(index: EdgeYIndex, y:
  number, visit: (edge: number) => void, stats?: EdgeIndexStats): void`, where
  `EdgeIndexStats = { builds: number; visits: number; inspections: number }`. Edge
  `e` runs from vertex `(e + n - 1) % n` to vertex `e`. p2 only imports it and never
  edits it.
- p3 and p4 share no file, type or export. Both keep the same note texts, MIME
  rules, `structuredContent` and exit codes.
- No plan edits callers (`pcb-outline.ts`, `history.ts`, `cad-request.ts`,
  `capture-cad.ts`, `export-handlers.ts`, `capture-command.ts`, `native-engine.ts`,
  `main.rs`), `docs/`, goldens or lockfiles.

## Worker rules (every plan)

1. Edit only the plan's `writePaths`. Progress log: `impl-plans/progress/<planId>.md`.
   You may append `## Implementation status` to your own plan file. Never edit another
   plan, this overview, the manifest, design docs, lockfiles or indexes.
2. Before each file edit read the file fresh and record its sha256 in the progress log;
   after the edit record the new sha256 and a one-line intent. If a file changed since
   your last read and you did not change it, stop, record the drift and re-read.
3. Write the regression test first and record the failing run on the pre-fix code
   (complete log under the evidence root), then fix and record the pass. p3 and p4
   use the two stages of design 27.1 so the recorded failure is functional (call A
   receives B's bytes), never a type or compile error.
4. TypeScript: strict typing; indexed reads type-check under
   `noUncheckedIndexedAccess`; no non-null assertions in production code; Biome clean
   on touched files (one variable per declaration). Rust: `cargo fmt`, clippy
   `-D warnings`, no `unsafe`, no panics on host input. English only, no emojis. No
   new dependency.
5. Never relax, edit or delete an existing test, threshold or deadline except the
   fixture adaptations listed in design 27.4 (named in p3 and p4). Never regenerate
   goldens.
6. Timing rule (design 26.2, reused by 27): a command whose only failures are existing
   timing or deadline tests may run up to three times in all; then each failing timing
   test runs alone. An isolated pass satisfies that failure, but every stage an `&&`
   chain skipped still runs. Keep every nonzero status and complete logs.
7. Cargo always with `CARGO_TERM_QUIET=true` and the plan's own
   `CARGO_TARGET_DIR=target/car9-<suffix>`.
8. Per-plan verification is focused. `bun run typecheck`, `bun run lint`,
   `mise run verify` and the release build run once at integration.
9. At most two `bun test` or `cargo test` processes at a time across plans.
10. No `*.test.ts` may remain under `target/` or `tmp/` when a plan finishes.
11. A failure caused by a sibling's in-progress edit is rerun after the sibling's
    progress log reads `done`; never fix it in the sibling's files. In particular
    `cargo test -p nodetto-cli` bundles the TypeScript sources (p4 vs p1/p2).
12. Only read-only git (`git diff`, `git show`, `git status`). No commits, branches,
    stashes or worktrees. Preserve every pre-existing uncommitted change.
13. Progress log: status (`in-progress` / `done` / `blocked`), edited files with pre/post
    sha256, every command with exit status and complete log path, the pre-fix failing
    output and, for p1/p2, the counter series before and after.

## Integration gates (after all plans are done; in order, each logged)

1. `bun run typecheck && bun run lint`
2. `CARGO_TERM_QUIET=true mise run verify` (goldens checked, never regenerated; rule 6)
3. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/mcp-stdio.test.ts`
   (the `compiled` stdio cases and native capture parity run, not skipped)
4. `sh -c 'for root in target tmp; do if [ -d "$root" ]; then matches=$(find "$root" -name "*.test.ts" -print) || exit 1; if [ -n "$matches" ]; then printf "%s\n" "$matches"; exit 1; fi; fi; done'`
