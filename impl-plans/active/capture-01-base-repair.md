# M1 capture-01-base-repair

- dependsOn: -
- Design: sections 1.1 (fact 16), 8.4
- writePaths: `packages/core/src/cad/check.ts`,
  `packages/io/src/jsonl/cad-format.test.ts` (both only through the patch
  below), `impl-plans/active/capture-00-overview.md` (progress row). The
  commit also adds the files that are untracked when this milestone
  starts: `design-docs/specs/design-ai-capture.md` and
  `impl-plans/active/capture-*` (plans and the patch), unchanged.
- Pre-authorised: exactly the two hunks of
  `impl-plans/active/capture-base-repair.patch`. They are the changes that
  commit `75d239b` on `feat/cad3d-pages` makes to these two files. No other
  line of either file may change, and no other file of that commit is taken.

## Why

At `ebcac57` the repository does not pass its own checks (evidence in
`tmp/capture/design/typecheck.log` and `bun-test.log`):

- `bun run typecheck` exits 2 with
  `packages/core/src/cad/check.ts(114,35): error TS2345` and
  `(118,28): error TS2339`: a `cad.pcb` feature reaches the extrude branch
  of `checkCadPage`.
- `bun test` has 2 failures in `packages/io/src/jsonl/cad-format.test.ts`
  (lines 103 and 207): the fixture gained a board reference and PCB page
  records that two assertions did not expect.

Every later milestone lists `bun run typecheck`, and the final milestone
lists `mise run verify`, so the base has to be green first. The cad3d
branch already contains the repair; taking the same bytes means the later
merge of the two branches has identical changes on both sides and no
conflict.

## Steps

1. `git apply impl-plans/active/capture-base-repair.patch`
2. Do not edit the result by hand. If the patch does not apply, stop and
   report (the base moved); do not write an own fix.
3. Record the outputs of the verification commands under `tmp/capture/m01/`.
4. Commit the two files, the progress row, the design document and the
   capture plan files.

## Tests

No new test. The repaired checks are the tests:

- `packages/core/src/cad/check.test.ts` and the rest of
  `packages/core/src/cad` pass.
- `packages/io/src/jsonl/cad-format.test.ts` passes (it failed before).
- The whole `bun test` passes once, recorded in `tmp/capture/m01/full.log`.
  If a test with a time limit fails, re-run it once alone and record both
  runs; any other failure is reported, not repaired here.

## Acceptance criteria

- `bun run typecheck` and `bun run lint:ts` exit 0.
- Source files differ from `ebcac57` in exactly the two files, and the
  patch is fully applied (`git apply --reverse --check` succeeds).
- No file of cad3d M18 or M21 scope is added.

## Verification (each must exit 0)

1. `sh -c 'git apply --reverse --check impl-plans/active/capture-base-repair.patch && bun run typecheck && bun test packages/core/src/cad/check.test.ts packages/io/src/jsonl/cad-format.test.ts'`
2. `sh -c 'bun run lint:ts && bun test packages/core/src/cad'`
3. `sh -c 'mkdir -p tmp/capture/m01; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m01/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m01/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/check.test.ts'`
4. `sh -c 'mkdir -p tmp/capture/m01 && bun test > tmp/capture/m01/full.log 2>&1'`
5. `sh -c 'CARGO_TERM_QUIET=true cargo test -p nodetto-native && CARGO_TERM_QUIET=true cargo test -p nodetto-cli'`

## Progress

Pending.
