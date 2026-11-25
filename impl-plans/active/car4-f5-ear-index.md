# car4-f5-ear-index

- planId: car4-f5-ear-index; wave 1; dependsOn: none
- planPath: impl-plans/active/car4-f5-ear-index.md
- progressPath: impl-plans/progress/car4-f5-ear-index.md
- Finding: performance-cad-concave-preview-ear-scans (R4-5, medium).
- Design: `design-docs/specs/design-cad3d.md` section 21 R4-5 (reflex candidate list,
  exactness lemma, counter, first gate).
- writePaths: `packages/core/src/cad/triangulate.ts`,
  `packages/core/src/cad/triangulate.test.ts`, `packages/core/src/cad/preview.test.ts`,
  `tmp/car4-r4/car4-f5-ear-index`, `impl-plans/progress/car4-f5-ear-index.md`, `target`,
  `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car4-00-overview.md`.

## Intent and context

One reflex vertex disables the convex fan (`triangulate.ts:91-104`); every ear test then
scans all live vertices (`:49`). Box indexes fail on the fan slivers (step-3 measured
3.85x per doubling). Only live vertices that are not strictly convex can be the
extreme blocker in a simple polygon, so only they are tested. The only production
caller (`tool-solid.ts:42`) passes loops that `loops.ts:177-207`, `:440-442` guarantee
simple. Step-3 probe of this rule: 10,491 / 20,991 / 41,991 operations at 3,000 / 6,000
/ 12,000 vertices in both windings, ordered triangles equal.

Non-goals: no change to the fan path, ear order, `isEar`'s predicate, `orientation`,
`lowestVertex`, `tool-solid.ts`, or `preview.ts`.

## Changes (`triangulate.ts`)

- `export const triangulateWork = { candidateVisits: 0, queries: 0 }`.
- On the fallback path only: typed arrays `candPrev`, `candNext`, `isCandidate` form a
  doubly linked list, in index order, of live vertices with
  `orientation(grid, prev(v)*2, v*2, next(v)*2) <= 0` (same `direction`-normalised
  prev/next as the fan test).
- `isEar(..)`: keep the orientation test and box; then walk only the candidate list,
  skipping `a` and `c`, applying the unchanged inclusive box and three `orientation`
  tests; return false at the first blocker. Each call past the orientation test
  increments `queries` and `candidateVisits`; each candidate examined increments
  `candidateVisits`.
- After an accepted ear at `b` (`b` is never a candidate): reclassify `a` and `c`
  with their new neighbours, inserting or removing to keep index order; each
  reclassification increments `candidateVisits`.

## Pitfalls

- Inclusive predicate and collinear-on-diagonal rule unchanged: orientation `== 0`
  vertices ARE candidates.
- Insertion must keep index order (walk to the position; the list is tiny in practice
  but must stay correct for combs).
- Do not exclude walked candidates from the counter; do not change the fixture or the
  2.5x threshold.

## Tests

- `triangulate.test.ts` first gate: regular polygons of radius 100 mm at N = 3,000 /
  6,000 / 12,000, vertex 0 moved to radius 50 mm (mm coordinates; production rounding
  applies), both windings: reset counters, triangulate, assert `candidateVisits(2N) <=
  2.5 * candidateVisits(N)` for both doublings; include the counts and `queries` in the
  assertion message (fails before: counter absent; old scan quadratic).
- Oracle: a verbatim copy of the current `isEar` scan triangulator kept in the test;
  ordered triangle indices equal in both windings on existing fixtures (`:37-55`), the
  notch polygon at N = 300 / 3,000 / 6,000 / 12,000, a 200-tooth comb and a vertex
  exactly on a new diagonal.
- `preview.test.ts`: preview mesh bytes of an existing concave fixture unchanged
  (extend only if no such assertion exists).

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/cad/triangulate.ts packages/core/src/cad/triangulate.test.ts packages/core/src/cad/preview.test.ts && bun test packages/core/src/cad/triangulate.test.ts packages/core/src/cad/preview.test.ts packages/core/src/cad/tool-solid.test.ts`

## Done criteria

- Growth <= 2.5x at both doublings with counts recorded; oracle parity; existing
  comb/collinear tests unchanged; progress log `done` (or `blocked` with counts if the
  fixed gate fails).

Implementation status: complete for Step 6; formal review and integration remain downstream.
