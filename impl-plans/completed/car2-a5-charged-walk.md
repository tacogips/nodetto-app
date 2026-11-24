# car2-a5-charged-walk: charge points before allocating capture geometry (R2-3)

- planId: car2-a5-charged-walk
- Wave: 5
- dependsOn:
  - car2-a4-open-mesh-targets, which owns the visitor in `scene.ts` and
    `construction.ts` before this plan;
  - car2-a5-point-rule (`checkScenePreTool`, `chargeTool`, `MAX_POINTS`).
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-3 and
  section 19.1 F4 (precedence list, capture walk, metadata walk, stats and
  tests).
- Progress log: `impl-plans/progress/car2-a5-charged-walk.md`

## Intent

The capture model charges every tool against the writer's point rule before
it allocates that tool's capture typed arrays. Meshes are decoded with the
remaining vertex allowance.

At the first failing charge, the same visitor switches to a metadata mode
that allocates no capture geometry. `prepareCadCapture` keeps the existing
diagnostic precedence and raises the pending limit message last. Admitted
captures are byte-identical.

## Non-goals

- Do not change any message, exit code, admitted NCS1 bytes or the writer.
- Do not edit `history.ts` or `loops.ts`. Shared contours and retention
  already landed.

## Changes

1. `packages/core/src/capture/scene.ts`, `buildCadCaptureModel`
   - Options gain `stats?: { captureVisits: number; toolArrays: number;
     metadataVisits: number }`, which is test-only.
   - Keep a `PointCharge` state and a mode flag (`capture` or
     `metadata`).
   - Prism in capture mode:
     - normalise once with `normaliseToolLoops(geometry.loops)`;
     - charge with `chargeTool(state, { kind: "prism", loopCounts })`;
     - only on success build the typed arrays (`makeTool` takes the
       normalised loops) and count `toolArrays`.
   - Mesh in capture mode:
     - call `decodeMesh(data, { maxVertices: MAX_POINTS - state.points,
       needTarget: info.targeted })`;
     - charge with `chargeTool(state, { kind: "mesh", vertices, triangles
       })`;
     - on success use the returned geometry. If the charge fails, drop any
       returned geometry.
   - On the first failure:
     - record `overLimit = message`;
     - switch to metadata mode for the rest of the walk. Never run the
       capture branch again.
   - Metadata mode, which increments `metadataVisits`:
     - prisms record `sweptBounds(frame, t0, t1, normalised loops)` and no
       arrays;
     - meshes are decoded with `{ maxVertices: 0, needTarget:
       info.targeted }`, and their `bounds` are recorded;
     - the empty-mesh and invalid-mesh results are unchanged;
     - the display-only rule of plan a4 is applied in this mode too;
     - steps record tool indices, and `toolCount` still increments.
   - The return value adds `toolCount: number` and `overLimit?: string`.
     `tools` is the allocated prefix.
2. `packages/core/src/capture/cad-request.ts`, `prepareCadCapture`
   - The order stays: no-body message, cell range, body queries, camera,
     then frame.
   - Then, inside the existing `try`, call `checkScenePreTool(options,
     { tools: model.toolCount, bodies: model.bodies.length })`.
   - Then, if `model.overLimit`, throw `new RangeError(model.overLimit)`.
     The existing catch turns it into `CaptureInputError(message,
     undefined, true)`.
   - Then call `writeCaptureScene`, as today.

## Pitfalls

- Admitted requests never enter metadata mode. Their tools and bytes must
  be identical to today's.
- Charge before `new Float64Array` or `new Uint32Array`. Do not build a
  tool and discard it.
- Hidden creators still push tools and are charged, as the writer counts
  every tool.
- The decoder throwing is still `cad.mesh.invalid`, in both modes.

## Tests

The allocation counter is a test decoder: `(data, o) =>
decodeCaptureMeshWith(data, { ...o, onAllocate })`.

1. `scene.test.ts` and `cad-request.test.ts`, following 19.1 F4:
   - Admitted exactly-4,000,000 case (one 2,000-edge sketch used by 2,000
     visible extrusions): the NCS1 sha256 equals the digest recorded on
     `3cd2401`, and `metadataVisits === 0`.
   - Visible prism overflow followed by a sentinel extrusion and a
     sentinel mesh:
     - the existing message is raised;
     - `toolArrays` equals the tools before the excess;
     - there are no capture visits after the excess;
     - the decoder records zero `positions`, `triangles` and `mm`
       allocations after the excess.

     Fails before: the arrays for every tool are allocated.
   - Mixed mesh overflow: the overflowing mesh and the sentinel mesh each
     record zero `positions`, `triangles` and `mm` allocations.
   - A targeted mesh after the excess records only `target` allocations,
     and the cut's status equals the admitted-walk status.
   - Long tail of 1,000 unreferenced extrusions plus a mesh sentinel:
     `captureVisits` and `toolArrays` do not grow after the excess.
   - Hidden-only overflow: the no-body message and the feature errors
     equal the pre-fix run.
   - Body-query precedence (V5 shape):
     - an unknown body query gives the existing unknown-body error;
     - a valid query gives the point-limit error;
     - a query naming a body after the excess resolves.
   - Writer pre-tool precedence: an over-limit model with `supersample:
     4`, through the writer options, gives the header error.
2. `apps/cli/native/src/engine_tests.rs`, with the `captureSolid`
   interception at `:375-392`:
   - the admitted document gives the NCS1 and image digests recorded on
     `3cd2401`;
   - the over-limit document exits 2 with the existing message, and
     `captureSolid` is never called.

   Inline meshes may supply most of the points, to keep Boa time small.
3. `apps/cli/src/native-parity/capture.test.ts`: the same two documents
   through the release binary give the pre-fix stdout and image bytes, and
   exit 2 with the message. Record the native durations in the progress
   log.

## Verification

- `bun test packages/core/src/capture packages/core/src/cad`
  must exit 0.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a5-charged-walk cargo test -p nodetto-cli`
  must exit 0.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a5-charged-walk cargo build --release -p nodetto-cli`,
  then
  `NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a5-charged-walk/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/native-parity/cad.test.ts`.
  Both must exit 0.
- `bunx biome check --diagnostic-level=warn` on every touched TS file must
  exit 0.
- `rustfmt --edition 2021 apps/cli/native/src/engine_tests.rs`

## Done when

- All the cases pass, and the digests are equal.
- The CLI messages and exit codes are unchanged.
- The progress log reads `done`.
