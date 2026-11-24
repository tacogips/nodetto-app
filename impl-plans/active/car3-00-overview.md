# car3-00-overview: audit round 3 corrections

- Task: `car3-r3`; dispatch manifest `impl-plans/active/car3-r3-dispatch.json`.
- Source: audit round 3 of `feat/ai-capture`, base `0a35708`, head `a964ad5`, seven
  major findings. Issue reference: `round-3-audit:feat/ai-capture@a964ad5`; no
  GitHub issue exists.
- Design (accepted): `design-docs/specs/design-ai-capture.md` section 21 (R3-1, R3-2,
  R3-7, plan grouping, gates) and `design-docs/specs/design-cad3d.md` section 20
  (R3-3 to R3-6). Where these sections and an earlier section disagree, they win.
- Evidence root: `tmp/car3-r3/<planId>/` (outside every artifact root).

## Plans (one wave, disjoint writePaths, no dependencies)

| Plan | Findings | Design |
| --- | --- | --- |
| car3-g1-capture-raster | R3-1 touching-cap interference, R3-2 translucent layers | ai-capture 21.1 R3-1, R3-2 |
| car3-cad-drag | R3-3 drag Cut-to-Add targets | cad3d 20 R3-3 |
| car3-cad-evaluate | R3-4 intermediate solid retention | cad3d 20 R3-4 |
| car3-g2-cad-history | R3-5 frame replay, R3-6 shared sketch rescans | cad3d 20 R3-5, R3-6 |
| car3-native-attachment | R3-7 attachment byte round trip | ai-capture 21.1 R3-7 |

## Worker rules (every plan)

1. Edit only the plan's `writePaths`. Your progress log is
   `impl-plans/progress/<planId>.md`; never edit another plan's log, this overview, the
   manifest, `impl-plans/README.md`, lockfiles or indexes.
2. Before each file edit, read the file fresh and record its sha256 in the progress
   log; record the post-edit sha256 after. If a file changed since your last read and
   you did not change it, stop editing that file, record the drift and re-read.
3. Write the regression test first and run it on the unmodified code. Record the
   failing output (or the measured baseline counts) in the progress log. Every fix
   needs a test that fails before and passes after; performance tests assert
   deterministic counts, never wall-clock time.
4. Cargo always runs with `CARGO_TERM_QUIET=true` and the plan's own
   `CARGO_TARGET_DIR=target/car3-<plan>`. Run `rustfmt` on touched Rust files only
   (`cargo fmt` of the whole workspace is reserved for integration).
5. TypeScript: strict typing, indexed reads type-check under
   `noUncheckedIndexedAccess`, Biome clean on touched files (one variable per
   declaration). `packages/io` never imports `@nodetto/core`;
   `packages/core/src/pcb` imports only itself. English only, no emojis.
6. Never relax or delete an existing test or deadline. Timing tests may be retried up
   to three times under load, then run in isolation before reporting.
7. Native parity runs only after
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-<plan> cargo build --release -p nodetto-cli`
   in the same plan, with `NODETTO_CLI_TEST_BINARY` set to that binary.
8. Per-plan verification is focused. `bun run typecheck`, `bun run lint`,
   `mise run verify` and `mise run test-cli` run once at integration.
9. Evidence goes under `tmp/car3-r3/<planId>/`. No `*.test.ts` file may remain under
   `target/` or `tmp/` when the plan finishes.
10. A failure caused by a sibling plan's in-progress edit is rerun after the sibling's
    progress log reads `done`; never fix it by editing the sibling's files.
11. No git operations other than read-only ones (`git diff`, `git show`, `git status`).
    No commits, branches, stashes or worktrees inside a plan.
12. Progress log format: status (`in-progress` / `done` / `blocked`), edited files with
    pre/post sha256, every verification command with exit status and complete log
    path under `target/car3-<plan>/logs/`, the pre-fix failing evidence, and any
    golden or literal recorded with its reason.

## Must not regress

The 21 round-1 and round-2 findings named in the workflow input, in particular
`performance-interference-boundary-fold`, `performance-interference-sparse-pairs`,
`maintainability-capture-raster-rounding` and `maintainability-cad-add-targets`.
Accepted and unchanged: about 224 MB native CLI startup, `cadCreationAllowed` on cloud
documents, 3D CAD capture only from the native CLI and desktop app, the paired TS and
Rust nmesh decoders, the local copy in `packages/core/src/pcb/lines.ts`.

## Integration gates (after all five plans are done; each exits 0)

1. `bun run typecheck && bun run lint`
2. `CARGO_TERM_QUIET=true mise run verify`
3. `CARGO_TERM_QUIET=true mise run test-cli`
4. `sh -c 'for root in target tmp; do if [ -d "$root" ]; then matches=$(find "$root" -name "*.test.ts" -print) || exit 1; if [ -n "$matches" ]; then printf "%s\n" "$matches"; exit 1; fi; fi; done'`
