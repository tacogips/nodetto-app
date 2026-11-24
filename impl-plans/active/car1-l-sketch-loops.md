# car1-l-sketch-loops: bounds-narrowed segment and containment candidates (F8)

- planId: car1-l-sketch-loops. Wave 1. dependsOn: none. Gate: none.
- Design: `design-docs/specs/design-cad3d.md` 19 F8.
- Progress log: `impl-plans/progress/car1-l-sketch-loops.md`.

## Intent

Disjoint sketch contours in a horizontal or a vertical row no longer cost
quadratic pair scans in segment intersection or contour containment.

## Non-goals

- Do not edit `history.ts` (plan b1).
- Do not change the `buildLoops` signature beyond an optional trailing
  test-only stats argument.
- No change to predicates, error codes, `at` ids, depth values or loop
  order.

## Changes (`packages/core/src/cad/loops.ts`)

1. Add a helper that, given 2D boxes, chooses the axis (X or Y) with
   fewer overlapping pairs, counted in O(n log n) after sorting (ties go
   to X). It then sweeps that axis and yields each bbox-overlapping pair
   `(i, j)`.
2. `intersection(profiles)` (`:209-238`):
   - Keep the existing `segments` order: sort by `(minX, minY)`.
   - Use the sweep only to enumerate candidate pairs.
   - For each pair that passes `segmentIntersection`, track the minimum
     index in that order.
   - Return `segments[min]`. That is exactly the first segment the old
     loop would return: the old loop returns `a` at the smallest `i` that
     has any intersecting later `j`.
3. Depth loop (`:383-396`): count the containers of each selected
   profile only among the profiles whose bounds overlap it, found by the
   same sweep at profile level. Keep `contains` unchanged.
4. Add an optional `stats?: { segmentPairs: number; containmentPairs: number }`
   as the last parameter of `buildLoops`, test-only.

## Pitfalls

- The reported segment must be the old one, even when several pairs
  intersect. Never return the first pair the sweep happens to find.
- Bounding boxes are inclusive (`<=`), as in the old filter.
- Profiles with identical bounds must still be compared.

## Tests (`packages/core/src/cad/loops.test.ts`)

- Rows of 160, 320 and 640 disjoint circles, horizontal and vertical:
  `segmentPairs` and `containmentPairs` grow by at most 2.5x per
  doubling. Before the fix the vertical segment count and both
  containment counts grow about 4x; record the pre-fix numbers.
- Several crossing segments in one sketch: the same `cad.profile.intersect`
  `at` id as before, checked against a test helper that runs the old
  nested loop.
- The existing intersection, nesting, winding and error-id tests pass
  unchanged.

## Verification

1. `biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts && bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/history.test.ts packages/core/src/cad/check.test.ts`
   must exit 0.
2. `bun run typecheck && bun test packages/core/src/cad packages/core/src/capture/scene.test.ts`
   must exit 0.

## Done when

- Counts are near-linear in both layouts.
- Every existing loops assertion is unchanged.

## Implementation status

Adaptive bounds sweeps and focused regressions are implemented. Both required
verification gates pass on the current shared tree; baseline counts and the
negative control are recorded in the progress log. See `impl-plans/progress/car1-l-sketch-loops.md`.
Formal review and final integration are downstream workflow steps.
