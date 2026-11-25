# car12-p6c-shell-capture-tests

- planId: car12-p6c-shell-capture-tests; wave 2; dependsOn:
  car12-p3-selected-ancestry (shared `scene.test.ts`) and
  car12-p6a-ts-shell-eligibility (the TS decoder rule)
- progressPath: impl-plans/progress/car12-p6c-shell-capture-tests.md
- Finding: `maintainability-capture-touching-shell-mesh-eligibility` (high),
  the capture-model and real-worker tests.
- Design: `design-docs/specs/design-ai-capture.md` 29.1 R12-6 tests. Follow
  the worker rules in `car12-00-overview.md`. Evidence:
  `tmp/car12-r12/car12-p6c-shell-capture-tests/`.

## Intent and context

Prove end to end, with the TypeScript decoder, that touching-shell cuts are
kept in capture and match the real Manifold worker. This is a tests-only
plan.

Non-goals:
- Do not edit production code. If a test fails because of a production
  defect, stop as `blocked` and report it.
- Do not edit p3's tests in `scene.test.ts`. Re-read the file fresh: p3 has
  edited it.

## Changes

`packages/core/src/capture/scene.test.ts`:
- Imitate the nine mesh fixtures near `:864`: how a `cad.mesh` element is
  built from STL bytes and how `decodeMesh` is passed.
- Document per fixture:
  - the binary-STL mesh;
  - a plate (10 x 10 mm sketch rectangle on base `xy` offset 5, extruded
    5 mm as a new body);
  - a cut (2 x 2 mm rectangle at x 1..3, y 1..3 on `xy`, extruded 10 mm,
    targeting the mesh and the plate);
  - an uncut control without the cut feature.
- Edge, face and crossed-diagonal contact (fail before p6a):
  - `buildCadCaptureModel` errors contain no `cad.body.missing`;
  - both the mesh body and the plate body end with a `difference` step;
  - the `prepareCadCapture` scene bytes differ from the uncut control's.
- Guards:
  - open-triangle and welded-overlap meshes keep `cad.body.missing`, and
    their scene bytes equal the uncut control's;
  - the separated mesh applies the cut.

`packages/cad-kernel/src/worker-host.test.ts`:
- Imitate the mesh fixtures near `:415`.
- For edge, face and crossed-diagonal contact, the real worker applies the
  cut, and the exported plate volume is 480 mm^3 within the file's existing
  volume tolerance.
- This is a guard (it passes before and after).

Use the same STL builder shape as p6a: a local helper per test file, with
coordinates from the design. Never import test code across packages.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/core/src/capture/scene.test.ts packages/cad-kernel/src/worker-host.test.ts`
2. `bun test packages/core/src/capture/scene.test.ts packages/cad-kernel/src/worker-host.test.ts`
   - The new cases pass, along with p3's tests and all existing tests.

## Done criteria

- Commands 1-2 exit 0.
- `git diff --name-only` stays inside writePaths, and the progress log
  reads `done`.

## Implementation status

- Done: capture and real-worker fixtures implemented; both focused gates pass.
- Formal review and combined-tree integration remain downstream.
