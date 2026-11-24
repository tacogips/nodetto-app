# car2-a2-core-wiring: capture uses the budgeted decoder and decoder bounds (R2-D callers, R2-5 shaded)

- planId: car2-a2-core-wiring
- Wave: 3
- dependsOn:
  - car2-a2-native-host (`CommandIo.decodeCaptureMesh`);
  - car2-a1-ts-decoder (`decodeCaptureMeshWith`);
  - car2-a3-loop-normalisation (`scene.ts` and `scene.test.ts` ordering);
  - car2-r-raster-rounding (`apps/cli/src/capture-command.test.ts`
    ordering: both plans add cases to that file, so this plan edits it
    only after r has finished).
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-D
  (entry points, Hosts), R2-5 (Shaded capture) and section 20.3 (staged
  rollout, routing evidence).
- Progress log: `impl-plans/progress/car2-a2-core-wiring.md`

## Intent

Switch capture to the budgeted decoder contract in one plan:

- The native CLI moves from `nmeshDecode` to `nmeshCapture`. Both are
  Rust, so there is no interpreter decode at any checkpoint.
- Bun and the desktop use `decodeCaptureMeshWith`.
- The mesh body bounds come from the decoder, so the interpreter no
  longer scans vertices.

Admitted bytes do not change.

## Non-goals

- No eligibility logic yet. Do not pass `needTarget` and do not return
  `"display-only"`; plan a4 does that.
- No point charging yet; that is plan a5-charged-walk.
- Do not touch `cad check` (`cad-command.ts`, `check.ts`,
  `CommandIo.decodeMesh`).
- Do not touch `export-command.ts`, `wireframe.ts` or `document.ts`; that
  is plan a2-export-bounds.

## Changes

1. `packages/core/src/capture/cad-request.ts`
   - Replace `CaptureMeshDecoder` with structural types. Core does not
     import `@nodetto/io`.
     - `CaptureMeshDecodeOptions { readonly maxVertices?: number; readonly
       needTarget?: boolean }`.
     - `CaptureMeshDecodeResult { readonly vertexCount: number; readonly
       triangleCount: number; readonly bounds: { readonly min: readonly
       [number, number, number]; readonly max: readonly [number, number,
       number] } | null; readonly booleanTarget?: boolean; readonly
       positions?: Float64Array; readonly triangles?: Uint32Array }`.
     - `type CaptureMeshDecoder = (data: string, options:
       CaptureMeshDecodeOptions) => CaptureMeshDecodeResult`.
   - Export all three.
2. `packages/core/src/capture/scene.ts`, mesh visitor (`:202-227`):
   - Call `options.decodeMesh(semantic.data, {})`.
   - Return false when the call throws, when `vertexCount === 0`, when
     `triangleCount === 0`, or when `positions` or `triangles` is missing.
   - Use `bounds` (copied into a `MutableBounds3`) instead of
     `pointBounds(positions)`.
   - Remove the `pointBounds` import if it becomes unused.
3. `apps/cli/src/capture-command.ts:255`: pass `io.decodeCaptureMesh`
   instead of `io.decodeMesh`.
4. `apps/cli/src/capture-cad.ts:124`: the default becomes
   `decodeCaptureMeshWith` from `@nodetto/io/nmesh`.
5. `apps/desktop/src/shell/export-handlers.ts:278`: `decodeMesh:
   decodeCaptureMeshWith`.
6. Update the test fakes to the new result shape:
   - `scene.test.ts` (`:327`, `:345`, `:353`);
   - `cad-request.test.ts` (`:22`, `:166`, `:250`, `:274`);
   - `apps/cli/src/capture-cad.test.ts:219`;
   - `apps/desktop/src/shell/export-handlers.test.ts` (`:305`, `:324`,
     `:566`, `:636`).

   Keep each test's assertion meaning. Do not change the
   `scene.test.ts:324-342` expectation; plan a4 replaces it.

## Pitfalls

- The decoder copies its own bounds. Do not alias a decoder-owned array
  into a mutable body bounds that later receives `includeBounds`.
- Bounds must be bit-equal to the old `pointBounds(positions)`. The
  decoders guarantee this; the digest test proves it.

## Tests

1. `apps/cli/src/capture-command.test.ts`, routing: a fake `CommandIo`
   with a `decodeCaptureMesh` spy and a `decodeMesh` that throws. Capturing
   a CAD page with one inline mesh calls the spy once and never calls
   `decodeMesh`. Fails before: `decodeMesh` is called.
2. `apps/cli/native/src/engine_tests.rs`, routing. Use the interception
   pattern at `:375-392`.
   - Write a JSONL document into the temp folder: a CAD page with one
     `cad.mesh` element whose data is
     `crates/capture/tests/fixtures/tetrahedron.nmesh.txt`, loaded with
     `include_str!`.
   - Wrap `native.nmeshCapture` and `native.nmeshDecode` with counters.
   - `capture` calls `nmeshCapture` once and `nmeshDecode` zero times.
   - `cad check` on the same document calls `nmeshDecode` once.
3. `scene.test.ts` or `cad-request.test.ts`: for a document with an
   asymmetric inline mesh with negative coordinates,
   `prepareCadCapture(..)` with `decodeCaptureMeshWith` gives the camera,
   the frame and NCS1 sha256 recorded on `3cd2401`, computed before the
   edit with `decodeCaptureMesh`.

## Verification

- `bun test packages/core/src/capture apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts apps/desktop/src/shell/export-handlers.test.ts`
  must exit 0.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-core-wiring cargo test -p nodetto-cli`
  must exit 0, including the routing test.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-core-wiring cargo build --release -p nodetto-cli`,
  then
  `NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a2-core-wiring/release/nodetto-cli" bun test apps/cli/src/native-parity/cad.test.ts apps/cli/src/native-parity/capture.test.ts`.
  Both must exit 0.
- `bunx biome check --diagnostic-level=warn` on every touched TS file must
  exit 0.
- `rustfmt --edition 2021 apps/cli/native/src/engine_tests.rs`

## Done when

- All commands exit 0, and the routing and digest tests pass.
- `CommandIo.decodeMesh`, `cad-command.ts` and `check.ts` are unchanged.
- The progress log reads `done`.
