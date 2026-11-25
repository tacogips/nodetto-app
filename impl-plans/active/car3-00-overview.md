# car3-00-overview: audit round 3 corrections

- Task: `car3-r3` (first dispatch, manifest removed). The two capture raster findings
  are re-dispatched as task `car3-r3b`, manifest `impl-plans/active/car3-r3b-dispatch.json`
  (section "car3-r3b" below).
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
| car3-g1-capture-raster (superseded and deleted; see car3-r3b) | R3-1 touching-cap interference, R3-2 translucent layers | ai-capture 21.1 R3-1, R3-2, 21.5 |
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
9. Evidence goes under `tmp/car3-r3b/<planId>/` (create it first). The plan must not
   add a `*.test.ts` under `target/` or `tmp/`. Prove it with the plan-delta scan, the
   last entry of the plan's manifest `verification`: it must exit 0, and
   `tmp/car3-r3b/<planId>/stray-delta.txt` must be empty. (Amended 2026-11-25; see below.)
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

## car3-r3b (design-ai-capture.md 21.5, revision 10a)

Seven chained plans replace `car3-g1-capture-raster`. Manifest:
`impl-plans/active/car3-r3b-dispatch.json`. Evidence root: `tmp/car3-r3b/<planId>/`.
Each plan uses `CARGO_TARGET_DIR=target/<planId>`.

| Wave | Plan | Aspect | dependsOn |
| --- | --- | --- | --- |
| 1 | car3-g1a-cast-flag | R3-1 ownership flag at the cast (C1) | none |
| 1 | car3-g1b-reference-witness | R3-1 reference witness and touching fixtures (C2) | none |
| 2 | car3-g1c-production-witness | R3-1 production witness, charges, statistics | g1a, g1b |
| 2 | car3-g1d-reference-layers | R3-2 reference compositing and layer fixtures (C3) | g1b |
| 3 | car3-g1e-production-layers | R3-2 production layers with the capped arena (C4) | g1c, g1d |
| 4 | car3-g1f-layer-capacity | R3-2 retained-capacity statistic and lifecycle tests | g1e |
| 4 | car3-g1g-native-docs | Native parity for R3-1 and R3-2, docs/capture.md | g1e |

Worker rules 1-12 above apply with these changes:

- Evidence goes under `tmp/car3-r3b/<planId>/`.
- Fail-before evidence is the plan's new test failing in the working tree before the
  plan's own edit. No older commit or pre-fix binary is built (design 21.1, 21.5).
- Format owned files with `rustfmt --edition 2021 <file>`. Before formatting
  `raster.rs`, run `rustfmt --edition 2021 --check crates/capture/src/raster.rs`.
  That command also formats its child modules (`raster/*.rs`), so if the diff
  touches a file you do not own, wait for its owner (rule 10).
- Golden changes: only g1c (a removed false touching-contact hatch) and g1e (two or
  more overlapping translucent bodies), each recorded with its name and reason.

Dispatch prerequisite (checkpoint owner, before wave 1). The 753 round-1 copies listed
in `tmp/car3-r3b/checkpoint/archived-inventory.txt` (identical to
`tmp/car2-r2b/reconcile-wave-005/stray-tests.txt`) are renamed to `*.test.ts.archived`
by `sh tmp/car3-r3b/checkpoint/archive-stray-tests.sh`. The rename is reversible: strip
the suffix. The script refuses any path outside `tmp/car1-r1/car1-c-body-selection/`
and `tmp/car1-r1/car1-d-pcb-page-kind/`. Then integration gate 4 must exit 0, logged
at `tmp/car3-r3b/checkpoint/stray-scan.log`. Integration runs gate 4 again before
gate 2 and after gate 3.

## Amendment 2026-11-25 (blocked-wave-scope-or-contract, round 1)

Wave 1 (g1a, g1b) finished its code and crate gates (168 tests each, exit 0). Both
plans blocked only on the absolute stray-test scan, which found the 753 inventoried
round-1 copies. No plan may write those files, and the step4 sandbox refused
`sh tmp/car3-r3b/checkpoint/archive-stray-tests.sh` for the third time. Decisions:

- The archive is a checkpoint prerequisite (design 21.5), not plan work. Its status
  stays `pending` with an operator-execution blocker in the manifest. No plan gets
  `tmp/car1-r1/*`, and no scan exclusion is added to the gate-4 scan.
- Per plan, rule 9 now checks for plan-added copies only:
  `find target tmp -name '*.test.ts' -print | LC_ALL=C sort | LC_ALL=C comm -23 - tmp/car3-r3b/checkpoint/inventory-sorted.txt > tmp/car3-r3b/<planId>/stray-delta.txt && test ! -s tmp/car3-r3b/<planId>/stray-delta.txt`.
  `inventory-sorted.txt` is `archived-inventory.txt` sorted with `LC_ALL=C` (753
  lines) and is read-only for every plan. The check passes both before and after the
  archive. Checkpoint evidence: `stray-scan-pre-archive.log` holds 753 paths and
  0 paths outside the inventory.
- Integration gates 1 and 5 (the absolute scan) are unchanged. They stay blocked until
  the operator runs the archive and records `stray-scan.log` with exit 0.
- g1a and g1b keep their edits. On resume, each reruns its crate gate and the delta
  scan, logs both, and sets its progress log to `done`.
