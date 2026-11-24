# car3-g2-cad-history

- planId: car3-g2-cad-history
- planPath: impl-plans/active/car3-g2-cad-history.md
- progressPath: impl-plans/progress/car3-g2-cad-history.md
- wave: 1; dependsOn: none
- Findings: performance-cad-face-frame-history-replay (R3-5, medium),
  performance-cad-shared-sketch-extrusion-rescans (R3-6, medium).
- Design: `design-docs/specs/design-cad3d.md` section 20 R3-5, R3-6 and "Work
  measurement".
- writePaths: `packages/core/src/cad/history.ts`,
  `packages/core/src/cad/history.test.ts`, `packages/core/src/cad/frames.test.ts`,
  `tmp/car3-r3/car3-g2-cad-history`, `impl-plans/progress/car3-g2-cad-history.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md`.

## Intent and context

R3-5: `sketchFrameLookup` (`history.ts:587-603`) caches only the requested frame;
each face-sketch miss calls `geometryFor` (`history.ts:533-556`), which creates a fresh
`createCadGeometry` and rebuilds every ancestor profile (quadratic in chain length).
R3-6: `createCadGeometry().extrude` walks every entity status
(`history.ts:496-499`) and filters every loop for an explicit selection
(`history.ts:507-515`) on every call.

Non-goals: no change to `sketchFrameLookup`'s signature, `sketchFrameOf`,
`extrudeGeometryOf`, `faceOutwardSign`, `geometryFor`, `CadGeometryStats`,
`construction.ts`, `sketch-authoring.ts`, `CadViewport.tsx`, `packages/core/src/cad/index.ts`.

## Changes (`history.ts`)

1. Test-only export `cadGeometryWork = { profileBuilds: 0, statusVisits: 0, loopProbes: 0 }`
   (mutable; not added to `cad/index.ts`). In `createCadGeometry`, in every context:
   `profileBuilds += 1` per `buildLoops` call; `statusVisits += 1` per entity status
   read; `loopProbes += 1` per profile loop examined in any selection path (index
   build counts each loop once, each index lookup counts one, any filter or scan over
   `profile.loops` counts each loop).
2. R3-6 inside `createCadGeometry`:
   - `entityFailures: Map<sketchId, Failure | null>`: first non-ok status of
     `history.entitiesOf(sketch)` in that order, computed once per sketch, consulted
     where the walk is today.
   - Beside each cached profile, a member index `Map<ElementId, number[]>` (ascending
     loop indices), built once with the profile.
   - Explicit selection: union of indices of every selected id -> sorted ascending ->
     loops. Equals the current filter: profile loop order, each loop once, unknown ids
     ignored. No selection -> `profile.loops` as today.
   - Error order unchanged: frame, entity failure, profile error, empty selection
     (`cad.profile.empty`), extent.
3. R3-5 inside `sketchFrameLookup(elements)`: one shared `createCadGeometry`, a
   `resolved: Map<ElementId, boolean>` and a feature id -> history position index. On
   a miss for sketch X: collect X's dependency closure through
   `history.dependencies`, stopping at resolved ids; sort the new ids by position;
   process each with exactly `geometryFor`'s per-item logic
   (`history.ts:541-556`). A feature fails if its status is not ok, a dependency
   failed, its own sketch/extrude/pcb geometry fails, or it is a suppressed
   extrude/pcb/mesh or another type (mirrors `geometryFor`'s `return null`). Keep the
   base-plane shortcut (`history.ts:596`) and the frame cache.

## Pitfalls

- A cached entity failure must not hide a frame failure: the frame check stays first.
- Do not let unresolved non-closure features influence a frame; only the closure is
  processed.
- Do not reorder selected loops by selection order; use profile order.
- The counters must sit at the real work sites so a regression to rescanning shows up
  as quadratic counts.

## Baseline measurement (before editing logic)

Apply a temporary increment-only patch to the unmodified `history.ts` (the counter
object plus increments at the `buildLoops` call, the status walk at 496-499 and the
filter at 511-514). Run the new tests, record the counts, revert the patch (verify
with sha256 equal to the `a964ad5` file). Keep the patch and counts in
`tmp/car3-r3/car3-g2-cad-history/` (no `*.test.ts` there).

## Tests (`history.test.ts`; reset `cadGeometryWork` before each measurement)

- Chains of 40 and 80 rectangle sketches (first on XY base, each next on the end face
  of the previous 1 mm extrusion); one lookup, resolve every frame -> sketch k origin
  z = k mm, normal +Z, in-plane axes equal to sketch 1's; `profileBuilds` 39 and 79
  (baseline about 780 and 3,160).
- Change the first extrusion's distance, new lookup -> every dependent origin moves by
  the change.
- Failed ancestor -> `null` for every dependent.
- N = 250 and 500 disjoint circles, one single-contour extrusion each, through
  `createCadGeometry().extrude` -> `statusVisits == N`, `loopProbes == 2N` (baseline
  N^2 each: 62,500 and 250,000).
- Oracle: selection with duplicates, an unknown id and reverse loop order -> equals
  `profile.loops.filter(loop => loop.members.some(id => selection.has(id)))`.
- Errors: failing entity reported before a profile error; empty selection ->
  `cad.profile.empty`.
- Existing `CadGeometryStats` `toEqual` assertions (`history.test.ts:247-298`) and
  `frames.test.ts` pass unchanged; touch `frames.test.ts` only if an exact-list
  assertion must be extended.

## Verification

1. `bunx biome check --diagnostic-level=warn packages/core/src/cad/history.ts packages/core/src/cad/history.test.ts && bun test packages/core/src/cad packages/core/src/capture`
   -> clean; all CAD and capture tests pass (NCS1 goldens and determinism unchanged,
   proving capture scene bytes are identical).

## Done criteria

- Baseline and candidate counts recorded for both fixture sizes; baseline patch
  reverted and verified by hash; command above exits 0; progress log `done`.

## Implementation status

- Source and regression coverage implemented; measured baseline and candidate counts are recorded in the plan-local evidence.
- Focused history, frame, capture and strict TypeScript checks pass. The full plan gate passed after the evaluation plan reported implementation done: 342 tests passed, 0 failed. Formal review and integration remain downstream.
