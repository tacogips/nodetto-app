# car5-00-overview: audit round 5 corrections

- Task: `car5-r5`; dispatch manifest `impl-plans/active/car5-r5-dispatch.json`.
- Source: round-5 audit of the 3D CAD pages and AI capture, base `0a35708`, head
  `feat/ai-capture` at `70977f468c57c5c34cc55c1cd1487e89b7a72bfe`, six findings (three
  high, three medium). No GitHub issue exists; the workflowInput is the issue body.
- Design (accepted by step 3): `design-docs/specs/design-ai-capture.md` section 23
  (R5-1, R5-3, R5-4, R5-6, plan grouping, gates) and `design-docs/specs/design-cad3d.md`
  section 22 (R5-2, R5-5). Where they and an earlier section disagree, they win.
- Evidence root: `tmp/car5-r5/<planId>/` (outside every artifact root).

## Plans (one wave, no dependsOn, no shared files)

| Plan | Finding | Owns |
| --- | --- | --- |
| car5-f1-sibling-cut | R5-1 function-capture-visible-sibling-cut-report (high) | `describe.ts`, `describe.test.ts`, native `capture.test.ts`, new `shared-cut.test.ts` |
| car5-f2-kernel-strict | R5-2 function-cad-kernel-strict-indexed-reads (medium) | `manifold-kernel.ts`, `manifold-kernel.test.ts`, `strict-index.test.ts` |
| car5-f3-lattice-scan | R5-3 performance-interference-mesh-triangle-scans (high) | `lattice.rs`, `tool_view.rs`, `tests/interference.rs` |
| car5-f4-open-mesh-hit | R5-4 performance-open-mesh-nearest-hit-allocation (medium) | `mesh.rs`, `tests/overlay_alloc.rs` |
| car5-f5-pcb-outline-index | R5-5 performance-cad-pcb-outline-page-rescans (medium) | `pcb-outline.ts`, `history.ts`, `evaluate.ts`, `pcb-outline.test.ts` |
| car5-f6-diagnostic-ids | R5-6 maintainability-capture-diagnostic-id-scope (high) | `capture-cad.ts`, `capture-command.ts`, `capture-cad.test.ts` |

The intake's possible chains are designed away: R5-1 needs no Rust and no
`capture-cad.ts`; R5-3 counts visits in `tool_view.rs`, not `mesh.rs`.

## Cross-plan facts (pinned; do not change them in a plan)

- No NCS1, report JSON, golden or error-code change in any plan. The only new message
  texts are the R5-1 sibling text and the R5-2 `Invalid Manifold mesh data: ...` errors.
- `crates/capture/src/{raster.rs,raster/**,prism.rs,census.rs,lib.rs,report.rs}`, capture
  goldens and `docs/capture.md` are untouched by every plan.
- f1, f3 and f4 all compile the `nodetto-capture` crate (f1 through `nodetto-cli`); f2's
  strict program compiles all of `@nodetto/core`, including f1's `describe.ts` and f5's
  `history.ts`/`evaluate.ts`.

## Worker rules (every plan)

1. Edit only the plan's `writePaths`. Your progress log is
   `impl-plans/progress/<planId>.md`; never edit another plan's log, this overview, the
   manifest, lockfiles, indexes or design docs.
2. Before each file edit read the file fresh and record its sha256 in the progress log;
   record the post-edit sha256. If a file changed since your last read and you did not
   change it, stop editing it, record the drift and re-read.
3. Write the regression test first, run it on the unmodified code and record the
   failing output (or baseline counts). Pinned literals (R5-3, R5-4, R5-5) are recorded
   on the unmodified working tree before any production edit, and the log must show
   that run first. Performance tests assert deterministic counters, never wall clock.
4. Cargo always runs with `CARGO_TERM_QUIET=true` and `CARGO_TARGET_DIR=target/<planId>`.
   Run `rustfmt` on touched Rust files only.
5. TypeScript: strict typing, indexed reads type-check under `noUncheckedIndexedAccess`,
   Biome clean on touched files (one variable per declaration). `packages/io` never
   imports `@nodetto/core`; `packages/core/src/pcb` imports only itself. English only,
   no emojis.
6. Never relax or delete an existing test, threshold or deadline. Timing tests may be
   retried up to three times under load, then run in isolation before reporting. A
   fixed gate that cannot pass is reported `blocked`, never relaxed.
7. Never regenerate goldens.
8. Native parity runs only after
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/<planId> cargo build --release -p nodetto-cli`
   in the same plan, with `NODETTO_CLI_TEST_BINARY` set to that binary.
9. Per-plan verification is focused. `bun run typecheck`, `bun run lint`,
   `mise run verify` and `mise run test-cli` run once at integration.
10. Evidence goes under `tmp/car5-r5/<planId>/`. No `*.test.ts` may remain under
    `target/` or `tmp/` when the plan finishes.
11. A failure caused by a sibling's in-progress edit is rerun after the sibling's
    progress log reads `done`; never fix it by editing the sibling's files.
12. Only read-only git (`git diff`, `git show`, `git status`). No commits, branches,
    stashes or worktrees.
13. Progress log: status (`in-progress` / `done` / `blocked`), edited files with pre/post
    sha256, every verification command with exit status and complete log path under
    `target/<planId>/logs/`, the pre-fix failing evidence, pinned literals and measured
    counters.

## Integration gates (after all six plans are done; each exits 0)

1. `bun run typecheck && bun run lint`
2. `CARGO_TERM_QUIET=true mise run verify`
3. `CARGO_TERM_QUIET=true mise run test-cli`
4. `sh -c 'for root in target tmp; do if [ -d "$root" ]; then matches=$(find "$root" -name "*.test.ts" -print) || exit 1; if [ -n "$matches" ]; then printf "%s\n" "$matches"; exit 1; fi; fi; done'`
