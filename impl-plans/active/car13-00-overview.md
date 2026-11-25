# car13-00-overview: audit round 13 corrections

- Design: `design-docs/specs/design-ai-capture.md` section 30 (Revision 19),
  rules R13-1 to R13-5, plan table 30.2, decisions 30.3, risks 30.5.
  - Section 30 wins over earlier sections.
  - R12-6 (C1 to C6) and R12-7 in section 29.1 stay valid and are referenced
    by p4a to p4c and p5.
  - Sections 24, 26.2 (timing) and 28.2 (plan rules) still apply.
- Issue: round-13 audit of `feat/ai-capture`, base `0a35708`, HEAD
  `25b4e97901f2d4188a824c9fdd1be2ec8b266157` plus the uncommitted round-12
  tree. No GitHub issue exists; the workflow input `requestedOutcome` is the
  issue body.
- User problem, four findings:
  - A tall extrusion seated flush on an imported STL box is reported as
    interfering.
  - Rust rejects welded touching shells, so native capture drops valid cuts.
  - Side-face membership work grows as M x K across extrusions of one
    outline.
  - Capture repeats contour ancestry for every extrusion of one shared
    sketch.
- Superseded round-12 plans: car12-p6b (Rust welded shells, in progress)
  and car12-p7 (native parity, never started) are replaced by car13-p4a,
  p4b, p4c and p5.
  - car13-p4b adopts the existing failing test
    `welded_edge_contact_is_closed` in `crates/capture/tests/mesh.rs`.
  - Workers do not edit car12 plan or progress files.

## Plans and waves

| Plan | Rule | dependsOn | Wave |
| --- | --- | --- | --- |
| car13-p1-touching-witness | R13-1 | - | 1 |
| car13-p2-profile-side-index | R13-2 | - | 1 |
| car13-p3-shared-ancestry-cache | R13-3 | - | 1 |
| car13-p4a-contact-module | R13-4 module | - | 1 |
| car13-p4b-contact-closure | R13-4 closure | p4a | 2 |
| car13-p4c-contact-eligibility | R13-4 eligibility | p4b | 3 |
| car13-p5-native-parity | R13-5 | p1, p2, p3, p4c | 4 |

Shared-file chains (each is ordered by dependsOn; re-read fresh):
- `crates/capture/src/lib.rs`: p4a (`#[cfg(test)] mod mesh_contact;`), then
  p4b (`mod mesh_contact;`).
- `crates/capture/src/nmesh.rs`: p4a (two constants become `pub(crate)`),
  then p4c (`target_eligible` and unit tests).
- `apps/cli/src/native-parity/capture.test.ts`: p5 only.

Gate deviation from design 30.2, intentional and stricter:
- car13-p1 runs the full crate with
  `cargo test -p nodetto-capture -- --skip welded_edge_contact_is_closed`
  instead of `--lib`. p1 changes code covered by the crate integration
  tests (`tests/interference.rs`, `overlay*.rs`, `census.rs`, `render.rs`).
- car13-p4a keeps `--lib mesh_contact`, because it changes no runtime
  behaviour.

p1 and p4a edit different files of the same crate, `nodetto-capture`, in
parallel. If a sibling's unfinished edit stops the crate from compiling,
wait until it compiles, rerun the gate and record both logs.

## Worker rules (every plan)

- Work only in this working tree, on `feat/ai-capture`.
  - Never push, commit, stash, reset, or create branches or worktrees.
  - Run no git command that writes.
  - English only, no emojis.
- Before each file edit:
  - Read the file fresh and record its SHA-256 in the progress log.
  - After editing, record the new SHA-256.
  - If the pre-edit hash differs from the hash last recorded for that file,
    stop and report the drift in the progress log. Do not overwrite.
- Edit only the plan's `writePaths`.
  - The progress log is `impl-plans/progress/<planId>.md`.
  - Do not edit `impl-plans/README.md`, other plans, car12 files,
    `package.json`, lockfiles, docs or the design document.
- Evidence goes under `tmp/car13-r13/<planId>/`.
  - Never leave a file named `*.test.ts` or `*.test.tsx` under `tmp/` or
    `target/`.
  - Probe scripts use a plain `.ts` name, for example `camera-probe.ts`.
- Rust:
  - Runs use `CARGO_TERM_QUIET=true` and
    `CARGO_TARGET_DIR=target/car13-<short plan id>`.
  - Run `cargo fmt -p nodetto-capture` after Rust edits.
- Run at most two `bun test` or `cargo test` processes at a time across all
  plans.
- Under load, an existing timing or deadline test may fail in an aggregate
  gate. If it passes when rerun alone, it counts as passing; record both
  logs.
- Every new regression test first runs failing before the fix (that log is
  evidence, not a gate), then passing after it.
  - Save it as `tmp/car13-r13/<planId>/fail-before.log`.
- Assert performance with work counters, never clocks.
- Never relax, rename or delete existing assertions, except the one
  `nmesh.rs:532` replacement specified in p4c.
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
   - `CARGO_TERM_QUIET=true mise run verify`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p5 cargo build --release -p nodetto-cli && test -x "$PWD/target/car13-p5/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car13-p5/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/mcp-stdio.test.ts`
   - The log must show the native capture cases (all R13-5 cases) and the
     native MCP case as passed, not skipped.
3. No `*.test.ts` or `*.test.tsx` file may remain under `tmp/` or `target/`.

Plan archiving and the `impl-plans/README.md` index are done by the
workflow's archive and reconcile steps, not by workers.
