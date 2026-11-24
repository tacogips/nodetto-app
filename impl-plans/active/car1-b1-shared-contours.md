# car1-b1-shared-contours: per-sketch shared contours and reference-only retention (F4 tail memory)

- planId: car1-b1-shared-contours. Wave 1. dependsOn: none. Gate: none.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F4, the bullets
  "Shared contours (history.ts only ...)" and "Reference-only retention",
  and the counters `profileBuilds`, `pointArrays` and `retainedTools`.
- Progress log: `impl-plans/progress/car1-b1-shared-contours.md`.

## Intent

Stop every extrusion from rebuilding and retaining its own copy of a
sketch's contours. Without this, a capture past the point limit (plan B3)
still grows memory per later feature. The change is semantics-preserving
for every caller of `createCadGeometry`: construction walk, cad check,
wireframe, capture and evaluator.

## Non-goals

- Do not edit `packages/core/src/cad/loops.ts` or `loops.test.ts` (plan
  L owns the sweep).
- No capture or scene change; that is B2 and B3.
- No change to statuses, error codes, `at` fields or loop order.

## Changes

1. `packages/core/src/cad/history.ts`, `createCadGeometry` (the
   extrude-geometry path at `history.ts:480-500`):
   - Memoise `buildLoops(entities)`, called with no pick, per sketch id,
     inside the geometry instance. The memo is per walk, never global.
   - Store either `{ loops }` or the failure.
   - Resolve each extrude's selection (`semantic.loops`) as follows:
     - no selection: all loops;
     - a selection: the loops whose `members` intersect it, in list order;
     - nothing kept: `cadFailure("cad.profile.empty")` with no `at`,
       exactly as `buildLoops(entities, pick)` returns.
   - The existing checks after the profile (`depth % 2 === 0` exists,
     extent check, span) run per feature exactly as today.
   - Entity-status failures are still checked per extrude before the
     memo lookup, as today.
   - Add an optional test-only counter object to `createCadGeometry` (or
     its owner), carrying `profileBuilds` and the set of distinct
     `points` arrays handed out (`pointArrays`). Default: absent and free.
2. `packages/core/src/cad/construction.ts`:
   - Before the walk, compute `R`, the ids of features whose faces any
     sketch plane references. Read it from `history` face dependencies;
     see `history.ts:363-365` `faceDependencies`.
   - `geometry.extrudes.set(id, tool)` (`construction.ts:104-116`) only
     when `id` is in `R`. Verify every reader of `geometry.extrudes` is a
     face-reference resolver; if another reader exists, stop and report.
   - Expose `retainedTools` through the same optional stats.
   - Do not touch the mesh visitor contract; B2 changes it.

## Pitfalls

- `buildLoops(entities, pick)` validates the whole sketch (open, branch,
  intersect, winding-0 anywhere) before applying the pick. Errors must be
  identical with and without a pick; keep the unpicked call.
- Never mutate shared `CadLoop` objects or their arrays. Downstream code
  (`scene.ts` `normaliseToolLoops`, `evaluate.ts`) must keep treating them
  as read-only. Grep for writes to `.points` or `.sources`.
- `evaluate.ts` uses `createCadGeometry` too. Its caching keys
  (`contentKey`) must not depend on loop identity; check and record.

## Tests (`packages/core/src/cad/history.test.ts`; they fail before because the counters show one build and one array per extrusion)

- One closed 64-edge sketch and 64 `new` extrusions, each with
  `loops: [edgeId]` naming a different member edge: `profileBuilds == 1`
  and `pointArrays == 1`. Loops, depths and statuses equal those computed
  with `buildLoops(entities, [edgeId])` directly.
- The same sketch extruded 1,000 times with an identical selection:
  `profileBuilds == 1` and `retainedTools == 0`.
- A sketch on a face of extrusion X, then an extrusion of that sketch:
  `R` holds X, `retainedTools == 1`, and statuses equal the pre-change
  walk.
- Selection semantics:
  - a selection that matches no contour gives `cad.profile.empty` with no
    `at`;
  - a nested contour keeps its whole-sketch depth;
  - a winding-0 profile outside the selection still fails with its
    existing code and `at`.

## Verification

1. `biome check packages/core/src/cad/history.ts packages/core/src/cad/construction.ts packages/core/src/cad/history.test.ts && bun test packages/core/src/cad`
   must exit 0 with every existing core cad test passing, including
   `evaluate.test.ts`, `check.test.ts`, `wireframe.test.ts` and
   `loops.test.ts`.
2. `bun run typecheck && bun test packages/core/src/capture packages/core/src/cad/history.test.ts`
   must exit 0; capture scene bytes and digests are unchanged.

## Implementation status

Implementation and scoped verification completed; formal reviews and integration remain downstream. See `impl-plans/progress/car1-b1-shared-contours.md`.

## Done when

- The counters prove one build and one point array per contour.
- `retainedTools == |R|`.
- All core cad and capture tests pass unchanged.
- The progress log records hashes, commands and exit codes.
