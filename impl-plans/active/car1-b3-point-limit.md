# car1-b3-point-limit: point limit before allocation, with exact diagnostic precedence (F4)

- planId: car1-b3-point-limit. Wave 4. dependsOn: car1-b2-open-mesh-targets,
  car1-c-body-selection, car1-b1-shared-contours. Gated on Q2 through a2.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F4 (existing
  precedence; capture walk; metadata walk; `prepareCadCapture` order;
  counters; tests) and 19.3.
- Progress log: `impl-plans/progress/car1-b3-point-limit.md`.

## Gate

If `impl-plans/progress/car1-b2-open-mesh-targets.md` does not end with
`done`, stop with `blocked: depends on b2`.

## Intent

Capture charges every tool against the writer's 4,000,000-point rule
before allocating, and stops capture work at the first excess. It keeps
the old precedence exactly: no-body, then cell, then body queries, then
camera and frame, then the writer's pre-tool checks, then the limit.

## Non-goals

- Do not change `MAX_POINTS`, any message, the NCS1 format or goldens.
- Do not touch `history.ts` (b1), the resolver body (c) or the decoders
  (a1).

## Changes

1. `packages/core/src/capture/scene-binary.ts`: export two functions,
   and make the writer use them:
   - `chargeCapturePoints(total, tool)`: the per-loop and mesh-vertex
     bounds, then the running total, throwing the existing `RangeError`
     messages;
   - `checkCaptureRequestHeader(options, counts)`: the pre-tool checks
     (header, tool count, body count).
2. `packages/core/src/capture/scene.ts`, capture walk:
   - Prism: count from the normalised loops, charge, and only then
     allocate the `Float64Array`/`Uint32Array`.
   - Mesh: call `decodeMesh(data, { maxVertices: MAX_POINTS - total, needTarget })`.
     `needTarget` is true when some later Boolean feature targets this
     mesh, from `history.targets`.
   - At the first excess:
     - the capture visitor stops for good;
     - store the writer message as `overLimit`;
     - switch to the metadata visitor for the rest of the same walk.
       It records statuses, the visible bodies' id, name, reference flag
       and conservative bounds (the same `normaliseToolLoops` and
       `sweptBounds` doubles), and the tool and body counts. It decodes
       meshes with `maxVertices: 0` and allocates no capture tool or
       array.
   - Add optional test-only `stats`: `captureVisits`, `toolArrays` and
     `metadataVisits`, plus pass-through of b1's `profileBuilds`,
     `pointArrays` and `retainedTools`.
3. `packages/core/src/capture/cad-request.ts`, `prepareCadCapture`:
   build the model, then apply in order:
   1. no-body;
   2. cell range;
   3. c's resolver over the full body list;
   4. camera and frame;
   5. `checkCaptureRequestHeader`;
   6. if `overLimit`, throw `CaptureInputError(message, undefined, true)`;
      otherwise write the scene.

## Pitfalls

- Admitted requests never enter the metadata walk, and their scene bytes
  must be identical.
- Do not count a discarded decoder array as zero. Use a1's `onAllocate`
  in the tests.
- The hidden-only overflow must still give the no-body message and the
  pre-fix feature errors.

## Tests (each fails before; Bun in `scene.test.ts` and `cad-request.test.ts`)

- Admitted at exactly 4,000,000 points (for example a 2,000-edge sketch
  and 2,000 extrusions): the scene digest equals the pre-fix run, and
  `metadataVisits` is 0.
- Visible prism overflow, then a sentinel extrusion and a sentinel mesh:
  - the existing message;
  - `toolArrays` equals the tools before the excess;
  - no capture visit after the excess, and neither sentinel reaches the
    capture visitor;
  - `onAllocate` records nothing after the excess.
- Mixed mesh overflow (prisms below the limit, then an overflowing visible
  mesh, then a sentinel mesh): zero quantized, triangle and millimetre
  allocations for both meshes.
- A targeted mesh after the excess: only edge and quantized scratch, and
  the cut's status equals the pre-fix run.
- A long unreferenced tail (1,000 extra extrusions of the same sketch
  after the excess): `profileBuilds` 1, `retainedTools` 0, `pointArrays`
  1, and no growth in `captureVisits` or `toolArrays`. The same holds
  with distinct member selections.
- A face reference in the tail: `retainedTools` 1, and statuses equal the
  pre-fix run.
- Hidden-only overflow: the no-body message and errors equal the pre-fix
  run, with the counters frozen at the excess.
- Body-query precedence: an over-limit model with
  `nonexistent,mesh-0` gives the existing unknown-body error; a valid
  query gives the point-limit error; a query naming a body created after
  the excess gives the point-limit error.
- A header error (`supersample` 4) on an over-limit model gives the
  header error.
- Native: `apps/cli/native/src/engine_tests.rs` intercepts
  `native.captureSolid` with the pattern at `:382-386`:
  - the admitted document's observed NCS1 and image digests equal the
    pre-fix run;
  - the over-limit document exits 2 with the existing message and never
    calls `captureSolid`.

  Use inline meshes for most points so the Boa walk stays in the time
  class, with prism extrusions crossing the threshold.
- Native CLI parity in `apps/cli/src/native-parity/capture.test.ts`: the
  same two documents give the pre-fix stdout and image bytes, and exit 2
  with the message. Record the durations.

## Verification

1. `biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene-binary.ts packages/core/src/capture/cad-request.ts packages/core/src/capture/scene.test.ts packages/core/src/capture/cad-request.test.ts packages/core/src/capture/scene-binary.test.ts apps/cli/src/native-parity/capture.test.ts && bun test packages/core/src/capture packages/core/src/cad`
   must exit 0.
2. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-cli -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-b3 cargo test -p nodetto-cli`
   must exit 0 with the new engine tests.
3. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-b3 cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car1-b3/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
   must exit 0. Timing may be retried up to three times.
4. `bun run typecheck && bun test apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts packages/ui-solid/src/cad/strict-index.test.ts`
   must exit 0.

## Done when

- Every counter test passes.
- Precedence is exact.
- The admitted native NCS1 and image digests are unchanged.
