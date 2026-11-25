# car13-p5-native-parity

- planId: car13-p5-native-parity; wave 4
- dependsOn: car13-p1-touching-witness, car13-p2-profile-side-index,
  car13-p3-shared-ancestry-cache, car13-p4c-contact-eligibility
- progressPath: impl-plans/progress/car13-p5-native-parity.md
- Findings:
  - `function-capture-mesh-prism-touching-face`;
  - `maintainability-capture-touching-shell-mesh-eligibility`;
  - the unlanded R12-7.
- Design: `design-docs/specs/design-ai-capture.md` 30.1 R13-5 and 29.1
  R12-7.
- Worker rules: `car13-00-overview.md`.
- Evidence: `tmp/car13-r13/car13-p5-native-parity/`.

## Intent and context

This plan adds tests only, run against a fresh release binary. It proves
the round-13 fixes end to end through the real STL import, the default
camera fit, the native NMESH decoder and the CLI exit codes. It replaces
car12-p7.

Non-goals:
- No production edits.
- No change to existing tests, including the triangle and tetrahedron
  open-mesh cases near `:1042`.

## Changes (`apps/cli/src/native-parity/capture.test.ts`)

Imitate the patterns already in this file:
- `nativeTest`;
- `Bun.spawnSync([binary, "capture", ...])` from the touching test
  (`:753-856`);
- `writeBinaryStl` plus `stlToInlineMesh` from the sheet test (`:858-900`);
- `cadPixels(...).world` (`:270-289`) as used at `:390-400`.

For the mesh, plate and cut documents, imitate the touching-shell
documents in `packages/core/src/capture/scene.test.ts` (from car12-p6c).
Read the `--json` shape from `apps/cli/src/capture-cad.ts:137-162` and
`packages/core/src/capture/report.ts`.

1. Tall flush test:
   - Fixture: an outward 12-triangle binary STL box at X -1..1, Y 0..8,
     Z -35.25..0, imported as a mesh body. Upper body: a rectangle
     (-1,0)..(1,8) on `xy`, extruded 156.75 mm as a new body.
   - For `--view front` and `--view back`, run
     `capture <doc> --view <v> --size 64x64 --fail-on-interference --json --output <png> --force`
     with no zoom or target.
     - Expect exit 0, and zero pairs and zero candidates in the JSON.
     - The PNG bytes equal the same capture with `--no-interference`.
   - Penetration control: the upper sketch at base `xy`, offset -0.01,
     distance 156.76.
     - Expect exit 1 in both views, with exactly one pair naming the mesh
       and extrusion body IDs.
2. R12-7 short contact:
   - Fixture: an STL box X -32..32, Y 0..8, Z -4..0, and the rectangle
     (-32,0)..(32,8) extruded 4 mm.
   - Run `--view back|front --size 64x64 --zoom 1.08 --target 0,0,0.25 --fail-on-interference`.
     - Expect exit 0, stdout containing `interference: 0`, and PNG bytes
       equal to the `--no-interference` capture.
   - Overlap control: offset -0.01, distance 4.01.
     - Expect exit 1 and `interference: 1` in both views.
3. Welded shells:
   - Documents: edge contact, face contact and crossed-diagonal face
     contact. Each has mesh box A [0,10]^2 x [0,5] welded with B (edge:
     [10,20]x[10,20]; face and crossed: [10,20]x[0,10]), a 10 x 10 plate
     sketched at z = 5 and extruded 5 mm, and a cut rectangle x 1..3,
     y 1..3 from z 0 to 10 targeting both the mesh and the plate.
   - Each has an uncut twin without the cut feature.
   - Capture with `--view top --size 160x160 --json`. For each cut
     document:
     - exit 0 and no `cad.body.missing`;
     - the mesh body's report field `open` is `false`;
     - PNG bytes differ from the uncut twin's;
     - `camera.mmPerPixel <= 0.25` (the reviewer computed 0.135);
     - `world([2, 2, 10])` equals the background colour, while the uncut
       twin's does not;
     - `world([6, 6, 10])` (plate) is not background in either capture;
     - `world([15, 15, 5])` (edge contact) or `world([15, 5, 5])` (face
       and crossed) is not background in either capture.

Pitfalls:
- Build STL bytes in the test. Never copy data from issues or screenshots.
- Each new case must actually run. Without `NODETTO_CLI_TEST_BINARY`,
  `nativeTest` skips; the gate log must show the cases as passed.
- Use the background constant already used at `:390`.

## Verification (each exits 0)

1. `bunx biome check apps/cli/src/native-parity/capture.test.ts`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p5 cargo build --release -p nodetto-cli && test -x "$PWD/target/car13-p5/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car13-p5/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
   - Every new test is listed as passed, not skipped. Existing tests pass
     unedited.

## Done criteria

- Commands 1-2 exit 0.
- The fail-before evidence is saved: with the pre-fix tree the tall case
  exits 1 and the welded cases report `cad.body.missing`. That evidence is
  a source trace or a log, never a build of an older commit.
- The diff stays inside writePaths.
- The progress log reads `done`.
