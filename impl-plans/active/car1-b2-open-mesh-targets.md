# car1-b2-open-mesh-targets: atomic rejection of Boolean features with display-only mesh targets (F1)

- planId: car1-b2-open-mesh-targets. Wave 3. dependsOn:
  car1-a2-native-wiring, car1-b1-shared-contours (both touch
  `construction.ts` or `scene.ts`). Gated on Q2 through a2.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F1 ("Construction
  walk (plan B)", "Display", "Tests") and 6.1.
- Progress log: `impl-plans/progress/car1-b2-open-mesh-targets.md`.

## Gate

If `impl-plans/progress/car1-a2-native-wiring.md` does not end with
`done`, stop with `blocked: depends on a2`.

## Intent

A Boolean feature that has any display-only mesh target fails with
`cad.body.missing` and adds no step to any target, as in the editor.
Dependants fail. The mesh surface stays drawn.

## Non-goals

- No renderer change and no Rust change.
- `cad check` and the wireframe keep their boolean mesh visitor.
- No point-limit work (b3).

## Changes

1. `packages/core/src/cad/construction.ts`:
   - `CadConstructionVisitor.mesh` may return
     `boolean | "display-only"`.
   - On `"display-only"`: status ok, but do not add the mesh to the
     walk's `bodies` set. The existing absent-target check then fails
     later `add`, `cut` or `intersect` features with any such target as
     `missingTarget(target)`, which is `cad.body.missing` for a mesh,
     before `visitor.tool` runs.
2. `packages/core/src/capture/scene.ts` mesh visitor:
   - When the decoder's `booleanTarget` is false, call `addBody`
     unchanged, so the body is drawn and reported as today, and return
     `"display-only"`.
   - Otherwise return `true`.

## Pitfalls

- Dependants: a sketch on the failed cut's face must fail through the
  existing dependency rule (`cad.reference.failed`). Do not add special
  cases.
- Capture still reports no `cad.mesh.open` for the mesh's own feature
  (design 19.4).

## Tests (each fails before)

- `packages/cad-kernel/src/worker-host.test.ts` and
  `packages/core/src/capture/scene.test.ts` use the same documents built
  from the a1 fixtures: a 10 x 10 x 5 mm block, a 2 x 3 mm through-cut
  targeting the block and the mesh, and a sketch on the cut's face. The
  meshes are:
  - (1) the single triangle;
  - (2) the mixed-winding tetrahedron;
  - (3) the double-sided triangle;
  - (4) the coplanar tetrahedron;
  - (5) the translated flat shell.

  For each:
  - the worker reports the cut `cad.body.missing` and the sketch
    `cad.reference.failed`;
  - capture reports the same codes, the block has a single step, and the
    mesh body is present;
  - the capture scene bytes equal those of the same document with the
    cut suppressed. Equal NCS1 bytes imply equal pixels.
- Positive controls: the tetrahedron in both orientations, the thin bar
  and the translated thin bar. The worker accepts the cut, and capture
  appends one difference step to both bodies with no error.
- Native pixel check in `apps/cli/src/native-parity/capture.test.ts`:
  case (1) and the suppressed-cut document give equal image bytes.

## Verification

1. `biome check packages/core/src/cad/construction.ts packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts packages/cad-kernel/src/worker-host.test.ts apps/cli/src/native-parity/capture.test.ts && bun test packages/core/src/capture/scene.test.ts packages/core/src/cad packages/cad-kernel/src/worker-host.test.ts`
   must exit 0. The EPERM roundtrip-log case is pre-existing; if it
   fails, rerun it in isolation and record it.
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-b2 cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car1-b2/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
   must exit 0.
3. `bun run typecheck && bun test packages/core/src/capture packages/ui-solid/src/cad/strict-index.test.ts`
   must exit 0.

## Done when

- Worker and capture agree on all five rejected cases and on all
  controls.
- Existing capture digests are unchanged.
