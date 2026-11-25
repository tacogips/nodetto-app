# car4-f8-face-resolution

- planId: car4-f8-face-resolution; wave 2; dependsOn: car4-f4-swept-extents
- planPath: impl-plans/active/car4-f8-face-resolution.md
- progressPath: impl-plans/progress/car4-f8-face-resolution.md
- Finding: maintainability-cad-face-resolution-rules (R4-8, medium).
- Design: `design-docs/specs/design-cad3d.md` section 21 R4-8.
- writePaths: `packages/core/src/cad/history.ts`, `packages/core/src/cad/history.test.ts`,
  `tmp/car4-r4/car4-f8-face-resolution`, `impl-plans/progress/car4-f8-face-resolution.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car4-00-overview.md`.

## Intent and context

`geometryFor` (`history.ts:582-598` at `3f9ce78`; lines may have moved after f4) and
`sketchFrameLookup` (`:653-682`) each dispatch sketch, extrude, PCB and mesh features.
Design section 20 (R3-6 step 3) requires the cached lookup to apply exactly the
per-item logic of `geometryFor`. Extract one single-feature update used by both.

Non-goals: no public type, export or UI caller change; dependency traversal, caching
and failure propagation stay with their callers; `withinExtent` (owned by f4, already
landed) is not touched.

## Changes (`history.ts`)

- Private `function resolveFeatureGeometry(geometry: ReturnType<typeof
  createCadGeometry>, item: <typed feature> | undefined): boolean` applying today's
  rule: sketch sets its frame; unsuppressed extrude sets its tool; unsuppressed PCB
  reference sets its tool; unsuppressed mesh succeeds without geometry; anything else
  fails. Increments `cadGeometryWork.featureUpdates` (new field, initial 0).
- `geometryFor`: `if (!status ok || !resolveFeatureGeometry(...)) return null`.
- `sketchFrameLookup`: `ok = status ok && dependencies resolved &&
  resolveFeatureGeometry(...)`.

## Pitfalls

- Keep the short-circuit: `resolveFeatureGeometry` is NOT called when status or
  dependencies already failed (today the cached path skips the geometry call then).
- Suppressed extrude and PCB fail; suppressed mesh fails; unsuppressed mesh succeeds.
- Reset `featureUpdates` in the test helper `resetWork` (`history.test.ts:369`).

## Tests (`history.test.ts`, imitate `chain` at `:375` and the tests at `:397-417`)

- `extrudeGeometryOf` and `sketchFrameLookup` each raise `featureUpdates` by the number
  of features they resolve (fails before: field absent).
- Valid, suppressed-extrude and broken (failed ancestor) face chains: the cached frame
  for the face sketch is non-null exactly when `extrudeGeometryOf` for an extrusion on
  that sketch is not a failure, and the frames are equal.
- Existing profile-build count assertion passes unchanged.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/cad/history.ts packages/core/src/cad/history.test.ts && bun test packages/core/src/cad/history.test.ts packages/core/src/cad/preview.test.ts packages/core/src/cad/frames.test.ts`

## Done criteria

- One update function used by both lookups; parity on three chains; existing tests
  unchanged; progress log `done`.

Implementation complete; formal review and integration gates remain downstream. See
`impl-plans/progress/car4-f8-face-resolution.md` for verification evidence.
