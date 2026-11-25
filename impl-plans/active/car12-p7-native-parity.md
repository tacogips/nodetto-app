# car12-p7-native-parity

- planId: car12-p7-native-parity; wave 3; dependsOn: car12-p1, p2a, p2b,
  p3, p4, p5, p6a, p6b, p6c (the release binary bundles the TypeScript core
  and must build from a settled tree)
- progressPath: impl-plans/progress/car12-p7-native-parity.md
- Findings: `function-capture-mesh-prism-touching-face` and
  `maintainability-capture-touching-shell-mesh-eligibility`, native CLI
  parity.
- Design: `design-docs/specs/design-ai-capture.md` 29.1 R12-7 and 29.2
  gates. Follow the worker rules in `car12-00-overview.md`. Evidence:
  `tmp/car12-r12/car12-p7-native-parity/`.

## Intent and context

Show, with the release native CLI, that a flush STL/extrusion contact
reports no interference in both views and that touching-shell cuts render.
This is a tests-only plan.

Non-goals:
- No production edits. On failure, stop as `blocked` with logs.
- Do not change existing parity tests.

## Changes (`apps/cli/src/native-parity/capture.test.ts`)

- Imitate the contact test near `:785-855` (spawn, flags, exit and stdout
  checks) and the STL helpers near `:863` (`stlToInlineMesh`).
- Flush contact:
  - Mesh: a closed binary-STL box X -32..32, Y 0..8, Z -4..0.
  - Upper body: the rectangle (-32,0)..(32,8) on `xy`, extruded 4 mm as a
    new body.
  - For `--view back` and `--view front`, run `capture <doc> --view <v>
    --size 64x64 --zoom 1.08 --target 0,0,0.25 --fail-on-interference
    --output <png> --force` -> exit 0, stdout contains `interference: 0`.
  - The same view with `--no-interference` -> identical PNG bytes (no
    hatch).
  - Overlap control: sketch on base `xy` at offset -0.01, distance 4.01,
    both views -> exit 1 and `interference: 1`.
- Touching shells: the edge, face and crossed-diagonal meshes with the plate
  and cut from R12-6, plus each uncut control.
  - Run `--view top --size 64x64` -> exit 0, no `cad.body.missing` in the
    output, and PNG bytes differ from the uncut control's.
- Use `nativeTest` and the existing temp-dir cleanup pattern.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check apps/cli/src/native-parity/capture.test.ts`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p7 cargo build --release -p nodetto-cli && test -x "$PWD/target/car12-p7/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car12-p7/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
   - The log lists the new tests as passed, not skipped
     (`native-parity/harness.ts:6-13` skips when the variable is unset).

## Done criteria

- Commands 1-2 exit 0, with the logs saved.
- `git diff --name-only` stays inside writePaths, and the progress log
  reads `done`.
