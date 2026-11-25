# car14-p3-profile-extents

- planId: car14-p3-profile-extents; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car14-p3-profile-extents.md
- Finding: `performance-cad-shared-multiloop-extent-rescans` (medium).
- Design: `design-docs/specs/design-ai-capture.md` 31.1 R14-3.
- Worker rules: `car14-00-overview.md`.
- Evidence: `tmp/car14-r14/car14-p3-profile-extents/`.

## Intent and context

`withinExtent` (`packages/core/src/cad/history.ts:411-433`) reads each
loop's cached extrema once per extrusion. `sweptBounds`
(`packages/core/src/cad/bounds.ts:82-114`) reads them once per
non-constant axis. K whole-sketch extrusions of one M-loop XY profile
therefore cost 3MK reads, although they share the same `profile.loops`
array and the same frame object.

Aggregate the extrema once per loop array and frame.

Non-goals:
- Do not change `loopExtents`, `extremaCache`, the span arithmetic, the
  constant-axis shortcut, `CAD_MAX_EXTENT_MM`, error codes or messages.
- Do not touch `history.ts` outside `withinExtent` and its import line.
  p4 edits `pcb()` next.
- Do not touch `scene.ts` or `check.ts`. They call `sweptBounds`
  unchanged.

## Changes

1. `bounds.ts`:
   - `cadBoundsWork` becomes `{ vertexProjections: 0, extremaReads: 0 }`.
   - Add
     `export function profileExtents(loops: readonly { readonly points: ArrayLike<number> }[], frame: CadFrame): { readonly min: Vec3; readonly max: Vec3 }`:
     - With `loops.length === 1`, read `loops[0]` safely
       (`noUncheckedIndexedAccess`), add 1 to `extremaReads` and return
       `loopExtents(points, frame)`. Store nothing new.
     - Otherwise use a module
       `WeakMap<object, { frame: CadFrame; min: Vec3; max: Vec3 }>` keyed
       by the `loops` array. A hit requires `cached.frame === frame`.
     - On a miss, call `loopExtents` once per loop (each adds 1 to
       `extremaReads`), take the per-axis min and max, store the result,
       and return it.
     - With zero loops, return infinite min and max, which matches
       today's empty loop.
   - `sweptBounds`: call `profileExtents(loops, frame)` once, before the
     axis loop. On non-constant axes use its `min[axis]` and `max[axis]`
     in place of the per-loop walk. Constant axes keep using `origin`.
     The `start`/`end` arithmetic is unchanged.
2. `history.ts` `withinExtent`: replace the per-loop walk with one
   `profileExtents(loops, frame)` and today's `withinAxis` checks on its
   `min` and `max` for each axis. Import `profileExtents` from
   `./bounds.ts`.

Two-step order (design 31.1 R14-3 item 5):
1. Counter only. Add `extremaReads` and increment it in today's
   `withinExtent` and `sweptBounds` loops, one per `loopExtents` result
   used, with no behaviour change. Write the new tests and run them. Save
   that run as `fail-before.log`; the shared test shows 3MK. Also record
   the ordinary document's `extremaReads` and `vertexProjections` (the
   before values).
2. Change. Implement `profileExtents` and the two call sites, then rerun.

Pitfalls:
- Key by array identity, never by contents or sketch ID. Explicit
  subsets are fresh arrays (`history.ts:622-631`) and must not hit the
  whole profile's entry.
- A cache entry with a different frame object must be recomputed, not
  reused. Rotated frames are distinct objects.
- `withinExtent`'s decision must stay identical. The comparison is
  monotone in `base`, so testing the aggregate min and max is exact. Do
  not add a tolerance.
- Return readonly values. Callers must not mutate them; `sweptBounds`
  builds new arrays.

## Tests (`packages/core/src/cad/check.test.ts`)

Reuse `report`, `sketch`, `extrude` and `cadElement`, as in the test at
`:322`. Use the circle entity that `cad/testing/generate.ts` uses.

- Shared multi-loop profile: one XY sketch with M disjoint radius-1
  circles (for example, centres at `(3 * i, 0)`) and K whole-sketch `new`
  extrusions with distances 1..K, for M = K in 128, 256, 512 and 1024.
  -> no errors, `extremaReads === M`, and `vertexProjections` equals the
  summed vertex count of the profile (measured once per size, and equal
  for K = 1 and K = M).
- Oracle equivalence:
  - The test defines local `oracleSwept` and `oracleWithin` with today's
    per-loop and per-axis algorithms, built on the exported
    `loopExtents`.
  - Compare `checkCadPage(...).bounds` with the oracle on:
    - a whole profile;
    - an explicit `loops` subset;
    - a rotated frame (a sketch on a side face of an earlier extrusion);
    - a negative distance;
    - a symmetric extrusion.
  - Every comparison must give exact equality.
- Extent limit: a profile with a small square at the origin and a square
  near X = 9,999.5 mm.
  - A whole-profile extrusion of a sketch offset that pushes the far
    square past 10,000 -> `cad.limit`.
  - An extrusion that selects only the small square -> no error.
  - Both decisions match `oracleWithin`.
- Ordinary pin: `checkCadPage` on
  `generateCadDocument({ features: 500, entitiesPerSketch: 18 })`.
  - `extremaReads` equals the measured after-value (pinned literal) and
    is at most the recorded before value.
  - `vertexProjections` equals the recorded before value.
- Unedited and passing: `:53` (bounds follow face frames), `:179`
  (extent limits), `:322` (projections) and `:360` (swept formula).

## Verification (each exits 0)

1. `bunx biome check packages/core/src/cad/bounds.ts packages/core/src/cad/history.ts packages/core/src/cad/check.test.ts`
2. `bun test packages/core/src/cad/check.test.ts packages/core/src/cad/history.test.ts`

## Done criteria

- [x] Commands 1-2 exit 0.
- [x] `fail-before-all.log` (3MK) and the ordinary before and after values are
  recorded.
- [x] The diff stays inside writePaths.
- [x] The progress log reads `done`.
