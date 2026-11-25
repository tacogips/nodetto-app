# car12-00-overview: audit round 12 corrections

- Design: `design-docs/specs/design-ai-capture.md` section 29 (Revision 18),
  rules R12-1 to R12-7, plan table 29.2, decisions 29.3, risks 29.5. Section 29
  wins over earlier sections. Sections 24, 26.2 (timing) and 28.2 (plan rules)
  still apply.
- Issue: round-12 audit of `feat/ai-capture`, base `0a35708`, HEAD
  `73f73b81dfd6ef8e48f4f1125e1f51cbdca94b4d`. There is no GitHub issue; the
  workflow input `requestedOutcome` is the issue body.
- User problem: a flush STL/extrusion fit fails `--fail-on-interference`, and
  capture drops whole cuts on touching imported shells. Three CAD and capture
  paths, plus the inspector, do quadratic work on crowded or deeply selected
  sketches.

## Plans and waves

| Plan | Rule | dependsOn | Wave |
| --- | --- | --- | --- |
| car12-p1-mesh-volume-ownership | R12-1 | - | 1 |
| car12-p2a-segment-sweep | R12-2 module | - | 1 |
| car12-p3-selected-ancestry | R12-3 | - | 1 |
| car12-p4-side-face-members | R12-4 | - | 1 |
| car12-p5-inspector-targets | R12-5 | - | 1 |
| car12-p6a-ts-shell-eligibility | R12-6 TS and docs | - | 1 |
| car12-p2b-profile-sweep | R12-2 integration | p2a | 2 |
| car12-p6b-rust-shell-eligibility | R12-6 Rust | p1 | 2 |
| car12-p6c-shell-capture-tests | R12-6 scene and worker | p3, p6a | 2 |
| car12-p7-native-parity | R12-7 | all others | 3 |

Shared-file chains:
- `crates/capture/src/mesh.rs`: p1, then p6b.
- `packages/core/src/capture/scene.test.ts`: p3, then p6c.
- `apps/cli/src/native-parity/capture.test.ts`: p7 only.

## Worker rules (every plan)

- Work only in this working tree, on `feat/ai-capture`.
  - Never push, commit, stash, reset or create branches or worktrees.
  - Run no git command that writes.
  - English only, no emojis.
- Before each file edit:
  - read the file fresh and record its SHA-256 in the progress log;
  - after editing, record the new SHA-256.
  - If the pre-edit hash differs from the one last recorded for that file,
    stop and report drift in the progress log; do not overwrite.
- Edit only the plan's `writePaths`. The progress log is
  `impl-plans/progress/<planId>.md`. Do not edit `impl-plans/README.md`, other
  plans, `package.json`, lockfiles or this design document.
- Evidence goes under `tmp/car12-r12/<planId>/`. Never leave a file named
  `*.test.ts` or `*.test.tsx` under `tmp/` or `target/`; give copies an
  `.evidence` suffix.
- Rust runs use `CARGO_TERM_QUIET=true` and
  `CARGO_TARGET_DIR=target/car12-<short plan id>`. Run `cargo fmt` on edited
  Rust files.
- Run at most two `bun test` or `cargo test` processes at a time across all
  plans.
- Under load, an existing timing or deadline test may fail in an aggregate
  gate. If it passes when rerun alone, it counts as passing: record both logs.
- Each regression test first runs failing before the fix (that log is
  evidence, not a gate), then passing after it.
- Performance is asserted with work counters, never clocks.
- Never relax or delete existing assertions, except the one documented rename
  in p1.
- Indexed reads must type-check under `noUncheckedIndexedAccess`; use no
  non-null assertions.
- `packages/io` must not import `@nodetto/core`.
- Do not regenerate goldens.
- Progress log content:
  - status (`in-progress`, `done` or `blocked`);
  - file hashes;
  - commands with exit codes and log paths;
  - measured counter series;
  - any deviation, with its reason.

## Integration (serial, after all plans land)

1. Run, in order, under the 26.2 timing rule:
   - `bun run typecheck`
   - `bun run lint`
   - `CARGO_TERM_QUIET=true mise run verify`
2. Run `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p7 cargo build --release -p nodetto-cli && test -x "$PWD/target/car12-p7/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car12-p7/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/mcp-stdio.test.ts`.
   The log must show the native capture cases and the native MCP case
   (`mcp-stdio.test.ts:19-26`) as passed, not skipped.
3. Check that `find tmp target -name '*.test.ts' -o -name '*.test.tsx'`
   prints nothing.

Plan archiving and the `impl-plans/README.md` index are updated by the
workflow's archive and reconcile steps, not by workers.
