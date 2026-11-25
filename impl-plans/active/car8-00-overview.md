# car8-00-overview: audit round 8 corrections

- Task: `car8-r8`; dispatch manifest `impl-plans/active/car8-r8-dispatch.json`.
- Source: round-8 audit of the 3D CAD pages and AI capture, base `0a35708`, head
  `feat/ai-capture` at `fc22c037a21b75d9b48d7bbe74cda1055e2d3104`. Two performance
  findings. No GitHub issue exists; the workflowInput is the issue body.
- Design (accepted by step 3): `design-docs/specs/design-ai-capture.md` section 26
  (26.1 R8-1 and R8-2, 26.2 grouping, gates and round-8 timing rule, 26.3 decisions,
  26.5 risks); `design-docs/specs/design-cad3d.md` section 19 F8 note. Section 26 wins
  over earlier sections.
- Evidence root: `tmp/car8-r8/<planId>/` (outside every artifact root).

## Plans (one wave, no dependsOn, no shared file)

| Plan | Rule | Owns |
| --- | --- | --- |
| car8-f1-loops-box-query | R8-1 | `packages/core/src/cad/loops.ts`, `packages/core/src/cad/loops.test.ts` |
| car8-f2-describe-source-index | R8-2 | `packages/core/src/capture/describe.ts`, `packages/core/src/capture/describe.test.ts` |

## Cross-plan contracts

None. The plans share no file, type or export. Neither plan changes an exported
signature: `buildLoops`, `buildProfileLoops`, `LoopStats` field names and
`describeBodies` keep their shapes. No caller is edited (`history.ts`,
`construction.ts`, `cad-request.ts`, `scene.ts`, `apps/cli/src/capture-cad.ts`,
`apps/desktop/src/shell/export-handlers.ts`).

## Worker rules (every plan)

1. Edit only the plan's `writePaths`. Progress log: `impl-plans/progress/<planId>.md`.
   You may append `## Implementation status` to your own plan file. Never edit another
   plan, this overview, the manifest, design docs, lockfiles or indexes.
2. Before each file edit read the file fresh and record its sha256 in the progress log;
   after the edit record the new sha256 and a one-line intent. If a file changed since
   your last read and you did not change it, stop, record the drift and re-read.
3. Write the regression test first, run it on the unmodified source and record the
   failing output (complete log under the evidence root). Then fix and record the pass.
   Performance tests assert deterministic counters, never wall clock.
4. TypeScript: strict typing; indexed reads (arrays and typed arrays) type-check under
   `noUncheckedIndexedAccess`; Biome clean on touched files (one variable per
   declaration). English only, no emojis. No new dependency.
5. Never relax, edit or delete an existing test, threshold or deadline. Never
   regenerate goldens.
6. Round-8 timing rule (design 26.2): a command whose only failures are existing timing
   or deadline tests may run up to three times in all; then each failing timing test
   runs alone (`bun test <file> --test-name-pattern '^<name>$'`). An isolated pass
   satisfies that failure, but every stage the `&&` chain skipped must still run and
   pass under the same rule. Keep every nonzero status and complete logs. Functional
   failures, or timing tests failing alone, fail the gate.
7. No Rust is built by either plan. If cargo is ever needed, use
   `CARGO_TERM_QUIET=true` and `CARGO_TARGET_DIR=target/car8-<plan suffix>`.
8. Per-plan verification is focused. `bun run typecheck`, `bun run lint`,
   `mise run verify` and the native build run once at integration.
9. At most two `bun test` or `cargo test` processes at a time across plans.
10. Evidence goes under `tmp/car8-r8/<planId>/`. No `*.test.ts` may remain under
    `target/` or `tmp/` when the plan finishes (probe scripts are `*.ts` only and are
    deleted or kept outside test discovery).
11. A failure caused by a sibling's in-progress edit is rerun after the sibling's
    progress log reads `done`; never fix it in the sibling's files.
12. Only read-only git (`git diff`, `git show`, `git status`). No commits, branches,
    stashes or worktrees. Preserve every pre-existing uncommitted change.
13. Progress log: status (`in-progress` / `done` / `blocked`), edited files with pre/post
    sha256, every verification command with exit status and complete log path, the
    pre-fix failing output and the measured counters before and after.

## Integration gates (after both plans are done; in order, each logged)

1. `bun run typecheck && bun run lint`
2. `CARGO_TERM_QUIET=true mise run verify` (expands to check, lint, test per
   `mise.toml:73-107`; on a timing-only `bun test` failure, isolate it, then run
   `CARGO_TERM_QUIET=true cargo test --workspace` separately, rule 6)
3. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts --test-name-pattern '^CAD capture is deterministic, discoverable, and within the native budget$'`
   (exactly one case passed, not skipped; `tmp/capture/m09/timing.json` recorded)
4. `sh -c 'for root in target tmp; do if [ -d "$root" ]; then matches=$(find "$root" -name "*.test.ts" -print) || exit 1; if [ -n "$matches" ]; then printf "%s\n" "$matches"; exit 1; fi; fi; done'`
