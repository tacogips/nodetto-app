# car14-p6-native-parity

- planId: car14-p6-native-parity; wave 3
- dependsOn: car14-p1-prism-slab-proof, car14-p2a-rust-attachment-sides,
  car14-p2c-bracket-scene-control, car14-p4-pcb-frame-reuse (these cover
  every other car14 plan transitively)
- progressPath: impl-plans/progress/car14-p6-native-parity.md
- Findings: `function-capture-mesh-prism-touching-face` (R14-6), plus the
  unlanded R13-5 (round-13 touching face and welded shells) and R12-7,
  which it carries.
- Design: `design-docs/specs/design-ai-capture.md` 31.1 R14-6,
  30.1 R13-5, 29.1 R12-7, and 31.2 evidence ownership.
- Worker rules: `car14-00-overview.md`.
- Evidence: `tmp/car14-r14/car14-p6-native-parity/`.
- This plan supersedes car13-p5-native-parity. Do not edit car13 files.

## Intent and context

This plan adds tests only. They run against a fresh release binary built
from the current tree, and prove the fixes end to end: real STL import,
default camera fit, native NMESH decoding and CLI exit codes.

Evidence (31.2): cite p1's
`tmp/car14-r14/car14-p1-prism-slab-proof/fail-before.log` in the progress
log. Record only passing runs.
- Never build a pre-fix binary, check out an older commit or revert
  source.
- Pre-fix outcomes (the boss contact exits 1; the welded cuts report
  `cad.body.missing`) are audit baseline descriptions, not evidence for
  this plan.

Non-goals:
- No production edits.
- No change to existing tests, including the triangle and tetrahedron
  open-mesh cases.

## Changes (`apps/cli/src/native-parity/capture.test.ts`)

Imitate the patterns already in this file:
- `nativeTest`;
- `Bun.spawnSync([binary, "capture", ...])` from the touching tests
  (near `:753-856`);
- `writeBinaryStl` plus `stlToInlineMesh` (near `:858-900`);
- `cadPixels(...).world` (`:270-289`), as used at `:390-400`.

Read the `--json` shape from `apps/cli/src/capture-cad.ts` and
`packages/core/src/capture/report.ts`.

1. Boss (R14-6):
   - Mesh: an outward 12-triangle STL box at X -1..1, Y 0..8,
     Z -35.25..0.
   - Body `upper`: the rectangle (-1,0)..(1,10) on `xy`, extruded 156.75
     as `new`.
   - Boss: the rectangle (-0.5,8.5)..(0.5,9.5) on `xy` offset -1,
     extruded 2 as a union (`op` as the existing join tests use) into
     `upper`.
   - For `--view front` and `--view back`, run
     `capture <doc> --view <v> --size 64x64 --fail-on-interference --json --output <png> --force`.
     -> exit 0, zero pairs, and PNG bytes equal to the same capture with
     `--no-interference`.
   - Do not assert zero candidates for the boss: one is legitimate.
   - Penetration: the main sketch at offset -0.01 with distance 156.76,
     boss unchanged. -> exit 1 and exactly one pair naming the mesh body
     and `upper`, in both views.
2. Tall flush (R13-5, the boss-suppressed control): the same mesh, with
   the rectangle (-1,0)..(1,8) extruded 156.75.
   - Front and back views as above -> exit 0, zero pairs, zero
     candidates, and PNG equal to `--no-interference`.
   - Penetration (offset -0.01, distance 156.76) -> exit 1 and one pair.
3. R12-7 short contact:
   - Fixture: an STL box at X -32..32, Y 0..8, Z -4..0, and the
     rectangle (-32,0)..(32,8) extruded 4.
   - `--view back|front --size 64x64 --zoom 1.08 --target 0,0,0.25 --fail-on-interference`
     -> exit 0, `interference: 0`, and PNG equal to `--no-interference`.
   - Overlap (offset -0.01, distance 4.01) -> exit 1 and
     `interference: 1`.
4. Welded shells (R13-5):
   - Documents: box A [0,10]^2 x [0,5] welded with B (edge contact:
     [10,20] x [10,20]; face and crossed-diagonal contact:
     [10,20] x [0,10]). Each has a 10 x 10 plate at z 5..10 and a cut
     at x 1..3, y 1..3, z 0..10 that targets the mesh and the plate.
     Each document has an uncut twin.
   - Capture with `--view top --size 160x160 --json`. For each cut
     document:
     - exit 0 and no `cad.body.missing`;
     - the mesh body's `open` is `false`;
     - PNG bytes differ from the uncut twin's;
     - `camera.mmPerPixel <= 0.25`;
     - `world([2, 2, 10])` is the background colour, but not in the
       uncut twin;
     - `world([6, 6, 10])` is not background in either capture;
     - `world([15, 15, 5])` (edge) or `world([15, 5, 5])` (face and
       crossed) is not background in either capture.

Pitfalls:
- Build all STL bytes in the test. Never copy issue or screenshot data.
- Without `NODETTO_CLI_TEST_BINARY`, `nativeTest` skips. The gate log
  must show every new case as passed.
- Use the background constant already used near `:390`.

## Verification (each exits 0)

1. `bunx biome check apps/cli/src/native-parity/capture.test.ts`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p6 cargo build --release -p nodetto-cli && test -x "$PWD/target/car14-p6/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car14-p6/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
   - Every new case is listed as passed, not skipped.
   - Existing cases pass unedited.

## Done criteria

- Commands 1-2 exit 0.
- The progress log cites p1's fail-before log path, and records the
  release build log, the test log and their exit codes.
- The diff stays inside writePaths.
- The progress log reads `done`.

## Amendment 2026-11-26 (blocked-wave-scope-or-contract, round 1)

Blocker: the required native parity gate runs the existing M09 and M23
tests in `apps/cli/src/native-parity/capture.test.ts`
(`m09Evidence` at `:180`, written at `:319`; `:1002-1006`). They rewrite
`tmp/capture/m09/timing.json` and `tmp/capture/m23/timing.json`, which
were outside this plan's writePaths.

Decision:
- Add these two exact files to this plan's `writePaths` in
  `impl-plans/active/car14-r14-dispatch.json`. Their only authorized
  change is the rewrite by the existing tests during gate command 2.
- Do not hand-edit them. Do not change the existing tests or their output
  location. Do not move them under `tmp/car14-r14/` or `tmp/cad3d`.
- `artifactRoots` stays exactly `["target", "tmp/cad3d"]`.
- Nothing else changes: plan scope, verification commands, dependencies
  and the other plans.

Resume:
- Finish the draft tests already in `capture.test.ts`, using the pre-edit
  snapshot and intent files in `tmp/car14-r14/car14-p6-native-parity/`.
  Before editing, re-hash the file against `capture-post.sha256`.
- Run commands 1-2. Record in the progress log the before and after
  SHA-256 of both timing files, so the rewrite is attributed to the gate.

## Amendment 2026-11-26 (blocked-wave-scope-or-contract, round 2)

Blocker: the worker refused to start. The runtime dispatch item had
empty `dependsOn` and `acceptedPlanIds`, while the manifest still listed
four prerequisite IDs. Those prerequisites (car14-p1, p2a, p2c and p4)
are no longer manifest `plans`. They were accepted by integration review
in waves 1 and 2 and are recorded under top-level `acceptedDependencies`.

Decision, an additive authority and readback rule with no redesign:
- In `impl-plans/active/car14-r14-dispatch.json`, this plan's
  `dependsOn` is now `[]`. Every prerequisite is already accepted, so this
  matches the runtime projection.
- The plan entry gains `acceptedPlanIds`, listing all seven accepted
  plans, and a `dependencyAdmission` rule.
- Admission readback, run before any edit:
  1. `acceptedDependencies` in the committed manifest lists car14-p1,
     p2a, p2b, p3, p5, p4 and p2c.
  2. `shasum -a 256 -c tmp/car14-r14/reconcile-wave-002/wave2-tree.sha256`
     reports OK for every file.
  3. `shasum -a 256 -c tmp/car14-r14/reconcile-wave-001/combined-tree.sha256`
     reports OK for every file except
     `packages/core/src/cad/history.ts` and
     `packages/core/src/capture/scene.test.ts`. Those two are covered by
     check 2.
- If all three checks pass, proceed and record the outputs in the
  progress log. If any check fails, stop as `blocked` and name the
  failing path. Never block only because the runtime `dependsOn` or
  `acceptedPlanIds` is empty.
- Unchanged: the round-1 timing-file authorization, writePaths,
  artifactRoots, verification commands and acceptance criteria.

This is the last amendment round allowed.
