# car14-00-overview: audit round 14 corrections

- Design: `design-docs/specs/design-ai-capture.md`, section 31
  (Revision 20).
  - Rules R14-1 to R14-6 (31.1), plan table, gates and fail-before
    evidence ownership (31.2), decisions (31.3) and risks (31.5).
  - Section 31 wins over earlier sections.
  - Sections 24, 26.2 (timing), 28.2, 29 (ordinary-input rule) and 30.2
    still apply, except that the 31.2 evidence-ownership table replaces
    the per-plan fail-before rule for these plans.
- Issue: the round-14 audit of `feat/ai-capture`, base `0a35708`, HEAD
  `83d5152a651a9bd0adb272194ac20fed7c62ca54`, plus the uncommitted
  round-12 and round-13 tree. No GitHub issue exists; the workflow input
  `requestedOutcome` is the issue body.
- The user problem has five findings:
  - (high) A locating boss clear of a flush-mounted STL makes capture
    report a false interference pair, and `--fail-on-interference`
    exits 1.
  - (high) Cancelling a shared face merges a bracket and a block before
    the disjoint-interior check, so a mesh with a second 15 mm^3 overlap
    is accepted as a boolean target.
  - (medium) K whole-sketch extrusions of one M-loop profile cost 3MK
    extrema reads in `checkCadPage`.
  - (medium) K references to one PCB reproject M vertices each (M x K).
  - (medium) K references to one PCB rebuild the same containment forest
    K times in capture.
- Superseded: car13-p5-native-parity never started and is replaced by
  car14-p6, which carries all of R13-5. Workers do not edit car12 or
  car13 plan or progress files.

## Plans and waves

| Plan | Rule | dependsOn | Wave |
| --- | --- | --- | --- |
| car14-p1-prism-slab-proof | R14-1 | - | 1 |
| car14-p2a-rust-attachment-sides | R14-2 Rust | - | 1 |
| car14-p2b-ts-attachment-sides | R14-2 TypeScript | - | 1 |
| car14-p3-profile-extents | R14-3 | - | 1 |
| car14-p5-pcb-profile-cache | R14-5 | - | 1 |
| car14-p4-pcb-frame-reuse | R14-4 | p3 | 2 |
| car14-p2c-bracket-scene-control | R14-2 scene control | p2b, p5 | 2 |
| car14-p6-native-parity | R14-6 (+ R13-5) | p1, p2a, p2c, p4 | 3 |

Shared-file chains are ordered by `dependsOn`. Re-read each file fresh
before editing it.
- `packages/core/src/cad/history.ts`: p3 (`withinExtent` body), then p4
  (`pcb()` frame).
- `packages/core/src/capture/scene.test.ts`: p5 (the shared-board test),
  then p2c (the bracket control).
- No other file has more than one owner. p1 and p2a edit different files
  of the crate `nodetto-capture` in parallel.

## Fail-before evidence ownership (design 31.2)

- Fix plans p1, p2a, p2b, p3, p4 and p5 work in this order:
  1. Write the regression.
  2. Run it before their own production edit, and save the complete
     failing log and exit status as
     `tmp/car14-r14/<planId>/fail-before.log`.
  3. Make the change, then save the passing run.
- Test-only plans p2c and p6:
  - Never revert source, check out an older commit or build a pre-fix
    binary.
  - Cite the upstream logs by path in their progress files: p2c cites
    p2b's log, and p6 cites p1's log.
  - Record only passing runs on current source. p6 uses a fresh release
    build from the current tree.

## Worker rules (every plan)

- Work only in this working tree, on `feat/ai-capture`.
  - Never push, commit, stash, reset, or create branches or worktrees.
  - Run no git command that writes.
  - English only, no emojis.
- Before each file edit:
  - Read the file fresh and record its SHA-256 in the progress log.
  - After editing, record the new SHA-256.
  - If the pre-edit hash differs from the hash last recorded for that
    file, stop and report the drift in the progress log. Do not
    overwrite. Snapshot your intended change in the progress log before
    you edit.
- Edit only the plan's `writePaths`.
  - The progress log is `impl-plans/progress/<planId>.md`.
  - Do not edit `impl-plans/README.md`, other plans, car12 or car13 files,
    `package.json`, lockfiles, `docs/` or the design document.
- Evidence goes under `tmp/car14-r14/<planId>/`.
  - Never leave a file named `*.test.ts` or `*.test.tsx` under `tmp/` or
    `target/`.
  - Probe scripts use a plain `.ts` name, for example `camera-probe.ts`.
- Rust:
  - Runs use `CARGO_TERM_QUIET=true` and
    `CARGO_TARGET_DIR=target/car14-<short plan id>`.
  - Run `cargo fmt -p nodetto-capture` after Rust edits.
- Run at most two `bun test` or `cargo test` processes at a time across
  all plans.
- Timing tests (26.2): under load, an existing timing or deadline test may
  fail in an aggregate gate. If it passes when rerun alone, it counts as
  passing; record both logs.
- If a sibling's unfinished edit stops the crate or package from
  compiling, wait until it compiles, rerun the gate and record both logs.
- Assert performance with work counters, never clocks.
- Never relax, rename or delete existing assertions or helpers.
- Indexed reads must type-check under `noUncheckedIndexedAccess`; use no
  non-null assertions.
- `packages/io` must not import `@nodetto/core`.
- Do not regenerate goldens. Add no dependency.
- Progress log content:
  - status (`in-progress`, `done` or `blocked`);
  - file hashes;
  - every command with its exit code and log path;
  - measured counters;
  - any deviation, with its reason.

## Integration (serial, after all plans land)

1. In order, under the 26.2 timing rule:
   - `bun run typecheck`
   - `bun run lint`
   - `CARGO_TERM_QUIET=true mise run verify` (goldens are checked and
     never regenerated)
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p6 cargo build --release -p nodetto-cli && test -x "$PWD/target/car14-p6/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car14-p6/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/mcp-stdio.test.ts`
   - The log must show every R14-6 and R13-5 case and the native MCP case
     as passed, not skipped.
3. No `*.test.ts` or `*.test.tsx` file may remain under `tmp/` or
   `target/`.

Plan archiving and the `impl-plans/README.md` index are done by the
workflow's archive and reconcile steps, not by workers.
