# car6-f2c-incomplete-cli

- planId: car6-f2c-incomplete-cli; wave 3; dependsOn: car6-f1-diagnostic-tokens,
  car6-f2b-incomplete-describe, car6-f2a-coarse-incomplete
- planPath: impl-plans/active/car6-f2c-incomplete-cli.md
- progressPath: impl-plans/progress/car6-f2c-incomplete-cli.md
- Finding: function-capture-coarse-scan-reported-as-refinement (R6-2, CLI, docs, native).
- Design: `design-docs/specs/design-ai-capture.md` 24.1 R6-2 (exit rule, docs, CLI and
  native tests), 24.2 gates.
- writePaths: `apps/cli/src/capture-interference-options.ts`,
  `apps/cli/src/capture-interference-options.test.ts`, `apps/cli/src/capture-cad.test.ts`,
  `apps/cli/src/native-parity/capture.test.ts`, `docs/capture.md`,
  `tmp/capture/m09/timing.json`, `tmp/capture/m23/timing.json`,
  `impl-plans/active/car6-f2c-incomplete-cli.md`,
  `impl-plans/progress/car6-f2c-incomplete-cli.md`, `tmp/car6-r6/car6-f2c-incomplete-cli`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`. Cargo target: `target/car6-f2c`.

Follow the worker rules in `impl-plans/active/car6-00-overview.md`. Start only after f1,
f2b and f2a progress logs read `done`.

## Intent and context

`interferenceExitCode` (`capture-interference-options.ts:61-68`) fails only on pairs or
unchecked candidates, so an abandoned coarse check exits 0. f2b already prints the text
and JSON; f2a already emits the native report key.

Non-goals: no change to `capture-cad.ts`, `describe.ts`, Rust, or existing native cases.

## Changes

- `interferenceExitCode`: also return 1 when `failOnInterference` and
  `(report.analysis?.incomplete?.length ?? 0) > 0`. Refinement-only caps still 0.
- `docs/capture.md` interference paragraphs (around lines 38-41 and 97): describe the
  `incomplete` state, the JSON key (report `analysis.incomplete`, CLI
  `interference.incomplete`, present only when non-empty), the two incomplete line
  wordings (not determined / found in the picture only) and the exit status.

## Tests (write first; record failures)

- `capture-interference-options.test.ts` (imitate `:36`): incomplete [[0,1]] with flag ->
  1; without flag -> 0; refinement-only cap (cappedCount 1, no incomplete) with flag -> 0.
- `capture-cad.test.ts` (imitate `"unchecked and capped analysis control exit codes ..."`,
  `:401-457`): analysis `checked 1, cappedCount 1, cappedWithoutHit [[0,1]],
  incomplete [[0,1]]`, pairs [] -> text contains
  `1 of 1 checked candidate pair incomplete` and
  `  incomplete: Plate x Block; the coarse check stopped before covering this pair, interference not determined`
  (use the harness body names); `--json` `interference.incomplete` equals
  `[["plate","block"]]`; `--fail-on-interference` exit 1. The existing ordinary-cap case
  keeps exit 0 (do not edit it).
- `native-parity/capture.test.ts`, new `nativeTest`
  `"native capture fails on a cropped dense pair that the coarse check cannot finish"`
  (30 s timeout like neighbours): generate in the test, with `encodeNmesh`,
  `canonicalize`, `toInline` and `cadElement(.., "cad.mesh", ..)` as at `:706-721`, two
  coincident meshes of 512 disjoint 1x10x10 mm boxes on a 2 mm X pitch (6,144 triangles
  each) plus a 1 mm cube body about 3,000 mm away on X. Spawn the binary directly (as at
  `:830-848`): `capture <doc> --view top --size 64x64 --zoom 8 --fail-on-interference
  --output dense.png --force`, once plain and once with `--json`. Assert exit 1 in both;
  text has no `(found in the picture only)` and has either the dense pair line ending
  `, approximate` or its `incomplete:` line; JSON agrees (pair record with
  `approximate: true`, `source: "analysis"`, or the pair in `interference.incomplete`).
  If the crop does not hide both meshes, adjust zoom/anchor distance, never the
  assertions.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn apps/cli/src/capture-interference-options.ts apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/native-parity/capture.test.ts && bun test apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f2c cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car6-f2c/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
   - evidence: the new native case is listed as passed (not skipped); existing native
     capture cases pass.

## Done criteria

- Exit rule and docs updated; unit, CLI and native cases pass; progress log `done`.
