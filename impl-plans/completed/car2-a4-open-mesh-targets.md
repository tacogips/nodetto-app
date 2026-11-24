# car2-a4-open-mesh-targets: display-only meshes are not Boolean targets (R2-1)

- planId: car2-a4-open-mesh-targets
- Wave: 4
- dependsOn: car2-a2-core-wiring. That plan provides the typed
  `CaptureMeshDecoder` and the switch to `nmeshCapture`, so this plan's
  native gate runs Rust eligibility.
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-1 and
  section 20.3 (routing evidence), and section 19.1 F1 (the construction
  walk, the eligibility table and the tests).
- Progress log: `impl-plans/progress/car2-a4-open-mesh-targets.md`

## Intent

A cut, add or intersect that targets an open or ineligible imported mesh
must fail with `cad.body.missing` before any target receives a step, as it
does in the app. The mesh itself stays drawn and its status stays ok.

## Non-goals

- Do not change the renderer, `cad check` or the wireframe. Their mesh
  visitors keep returning a boolean.
- Do not report `cad.mesh.open` for the mesh's own feature (design 19.4).
- Do not add point charging; that is plan a5-charged-walk.

## Changes

1. `packages/core/src/cad/construction.ts`
   - The visitor gains the signature `mesh?(feature, info: { readonly
     targeted: boolean }): boolean | "display-only"`.
   - Before the walk, compute `targetedMeshes = new Set(all values of
     history.targets)`.
   - The result is handled as follows:
     - `false` sets `cad.mesh.invalid`, as today;
     - `"display-only"` keeps the status ok and does not add the mesh to
       `bodies`;
     - anything else adds the mesh to `bodies`.
   - The existing absent-target check (`:108-113`) then fails later
     features with `missingTarget`, which gives `cad.body.missing` for a
     mesh. Dependants fail with `cad.reference.failed` through the
     existing rule.
2. `packages/core/src/capture/scene.ts`, mesh visitor:
   - Call `decodeMesh(data, { needTarget: info.targeted })`.
   - After `addBody(..)`, return `"display-only"` when `info.targeted &&
     result.booleanTarget === false`. Otherwise return true.

## Pitfalls

- The body is still added to the capture model, so the surface stays
  visible. Only the walk's Boolean body set excludes it.
- A hidden mesh follows the same rule.
- Do not compute eligibility for untargeted meshes.

## Tests

1. `packages/core/src/capture/scene.test.ts`
   - Replace the expectation at `:324-342` (a difference step on a single
     open triangle). With a real decoder (`decodeCaptureMeshWith`) on
     `triangle.nmesh.txt`:
     - the cut has error `cad.body.missing`;
     - the mesh body has only `[union]`.
   - Use the shared negative documents: a 10 x 10 x 5 mm block, plus a 2
     x 3 mm through-cut that targets the block and one of:
     - (1) the single triangle;
     - (2) the mixed-winding tetrahedron;
     - (3) the double-sided triangle;
     - (4) the coplanar tetrahedron;
     - (5) the translated flat shell.

     Each document also has a sketch on the cut's face.
   - In each negative document:
     - the cut fails `cad.body.missing`;
     - the face sketch fails;
     - the block steps are `[union]`;
     - the mesh body is present;
     - `prepareCadCapture` NCS1 bytes equal the same document with the cut
       `suppressed`. Fails before: the block gets a difference step.
   - Positive controls, where both targets get one difference step and
     there are no errors:
     - the tetrahedron in both orientations;
     - the thin bar together with the block, cut at XY (2, 2);
     - the translated thin bar.
2. `packages/cad-kernel/src/worker-host.test.ts`: the same documents
   through the real worker give the same cut and sketch statuses.
   Negative: `cad.body.missing` and a failed sketch. Positive: ok.
3. `apps/cli/native/src/engine_tests.rs`: intercept `native.nmeshCapture`.
   - Capturing the triangle document calls it with `needTarget === true`,
     and the packet's eligibility bit is false.
   - The tetrahedron document gives true.
4. `apps/cli/src/native-parity/capture.test.ts`
   - The triangle document's image bytes equal those of its suppressed-cut
     twin, and stdout reports `cad.body.missing` for the cut.
   - The tetrahedron control's image differs from its suppressed-cut twin.

## Verification

- `bun test packages/core/src/capture packages/core/src/cad packages/cad-kernel/src/worker-host.test.ts`
  must exit 0.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a4-open-mesh-targets cargo test -p nodetto-cli`
  must exit 0.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a4-open-mesh-targets cargo build --release -p nodetto-cli`,
  then
  `NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a4-open-mesh-targets/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/native-parity/cad.test.ts`.
  Both must exit 0.
- `bunx biome check --diagnostic-level=warn` on every touched TS file must
  exit 0.
- `rustfmt --edition 2021 apps/cli/native/src/engine_tests.rs`

## Done when

- All the cases pass, and `check.test.ts`, `wireframe.test.ts` and
  `evaluate.test.ts` pass unedited.
- The progress log reads `done`.
