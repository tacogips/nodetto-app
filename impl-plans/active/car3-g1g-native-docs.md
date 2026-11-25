# car3-g1g-native-docs

- planId: car3-g1g-native-docs; planPath: impl-plans/active/car3-g1g-native-docs.md
- progressPath: impl-plans/progress/car3-g1g-native-docs.md
- wave: 4; dependsOn: car3-g1e-production-layers (both fixes and the cap are in the binary)
- Findings: R3-1 and R3-2 native parity, docs.
- Design: `design-ai-capture.md` 21.1 R3-1 (native tests), R3-2 (native test, docs),
  21.5 g1g row and Dispatch.
- writePaths: `apps/cli/src/native-parity/capture.test.ts`, `docs/capture.md`,
  `apps/cli/src/capture-docs.test.ts`, `tmp/capture/m09/timing.json`,
  `tmp/capture/m23/timing.json`, `tmp/car3-r3b/car3-g1g-native-docs`,
  `impl-plans/progress/car3-g1g-native-docs.md`, `target`, `tmp/cad3d`
  (`capture-docs.test.ts` only if it fails because of the changed paragraph; the two
  timing files are outputs of existing tests at `capture.test.ts:178,317` and `749`)
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md` (section car3-r3b).

## Intent

Tie the shipped binary to both fixes. These cases are regression guards: their
fail-before evidence is the Rust tests of g1b to g1e. No older binary is built.

## Changes

- `capture.test.ts`: two new `nativeTest` blocks (30_000 ms), in the style of
  `capture.test.ts:568-658` (`save`, `document`, `CAD_TEST_PAGE`). For expected
  exit 1, use `Bun.spawnSync` directly as at lines 505-519, because `runCad` asserts
  exit 0. Every capture uses
  `--size 64x64 --zoom 1.08 --fail-on-interference --output <name>.png --force`.
  1. "native capture ignores touching bodies and fails 0.01 mm overlaps":
     - Stacked caps, `--view front`:
       - `sketch("lower","a1")` with `rectangle("lower",0,0,16,8)`, and
         `extrude("lower-x","a2",{ sketch: "lower", distance: 0.9375, op: "new" })`.
       - `sketch("upper","a3",{ base: "xy", offset: 0.9375 })` with the same
         rectangle and distance 1.0625.
       - Expect exit 0 and stdout containing `interference: 0`.
       - Control: upper offset 0.9275, distance 1.0725 -> exit 1 and stdout
         containing `interference: 1`.
     - Shared side, `--view top`:
       - rectangles `(0,0,8,8)` and `(8,0,8,8)`, each extruded 2 mm as `new`.
       - Expect exit 0 and `interference: 0`.
       - Control: second rectangle `(7.99,0,8.01,8)` -> exit 1 and `interference: 1`.
  2. "native capture keeps a PCB board visible through an imported sheet":
     - Elements: `boardReference()`, `testBoard(1.2)` and
       `edge("rim",{ kind: "rect", start: [0,0], end: [30,40] })` on
       `[CAD_TEST_PAGE, PCB_TEST_PAGE]`.
     - Add `cadElement("sheet","cad.mesh","a5",{ name: "Cover sheet", data })`. Build
       `data` with `stlToInlineMesh(writeBinaryStl([{ positions, triangles }]))`, using
       `@nodetto/io/cad-mesh` and `@nodetto/io/stl` (the production STL importer).
       The sheet is two triangles at z 5, covering x -5..35 and y -5..45.
     - First confirm the board's world bounds (for example a `--json` capture without
       the sheet). If the board is not inside 0..30 x 0..40 at z <= 1.2, move the sheet
       to cover it with margin and lie above it.
     - Run `--view top` without `--fail-on-interference`.
     - Expect exit 0. Stdout lists `Controller board` and `Cover sheet`, and the line
       that contains `Controller board` does not contain `hidden behind other bodies`.
- `docs/capture.md:74-78`: after "Reference bodies are drawn at 45% over what is
  behind", state:
  - every translucent body in front of the nearest solid (open meshes and reference
    bodies) is mixed in depth order;
  - a body seen through them counts as drawn;
  - a picture whose stacked translucent layers exceed the per-worker storage bound is
    refused with the existing "too heavy for this picture size" message.

  Edit nothing else.

## Pitfalls

- Never reuse names or data from user screenshots or issues. Use the generic names
  above.
- Do not change existing tests, deadlines or digests. If an existing digest changes,
  stop and report it: only a touching-contact (R3-1) or overlap-condition (R3-2)
  scene may change, and it needs an owning-plan reason.
- Timing tests may be retried up to three times under load, then run in isolation.
- Indexed reads typed for `noUncheckedIndexedAccess`; Biome clean (one variable per
  declaration).

## Verification (exit 0, runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1g-native-docs cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car3-g1g-native-docs/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/capture-docs.test.ts && bunx biome check --diagnostic-level=warn apps/cli/src/native-parity/capture.test.ts`
   -> the new and existing native cases pass, the docs test passes and Biome is clean.
   Record the test counts.

## Done criteria

- Both native blocks and the docs paragraph exist, and the gate passes.
- No `*.test.ts` is left under `target/` or `tmp/`.
- Progress log `done`, with hashes, commands, exit codes, log paths and the board
  bounds check.

## Amendment 2026-11-25 (blocked-wave-scope-or-contract, round 1)

- The done criterion "No `*.test.ts` is left under `target/` or `tmp/`" now means the
  plan-delta scan, which is the last manifest `verification` entry and overview rule 9.
  It must exit 0 and leave `tmp/car3-r3b/car3-g1g-native-docs/stray-delta.txt` empty.
  Create the evidence directory first.
- The 753 inventoried `tmp/car1-r1/*` copies are not this plan's. Do not write them,
  and do not report them as a blocker.
