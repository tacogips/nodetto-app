# car10-p4-edge-index-ray-origin

- planId: car10-p4-edge-index-ray-origin; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car10-p4-edge-index-ray-origin.md
- Finding: performance-cad-containment-crossings-outside-ray (high), index and
  depth pass.
- Design: `design-docs/specs/design-ai-capture.md` 28.1 R10-2, including the
  slotted-rim fixture and its independent expectation. Follow the overview worker
  rules. Evidence: `tmp/car10-r10/car10-p4-edge-index-ray-origin/`.

## Intent and context

`forEachEdgeAtY` (`packages/core/src/cad/edge-y-index.ts:44-75`) prunes only by
Y, so `contains` (`packages/core/src/cad/loops.ts:405-433`) runs its exact
predicate on every crossing, including those behind the query point. That is
H(2T+2) inspections on a rim with T slots. The fix makes the index return the
parity of the rightward ray from `(x, y)`, using X bounds and bulk parity.

Non-goals:
- Do not edit `scene.ts` or `scene.test.ts` (p3 and p5).
- Keep `forEachEdgeAtY` exported and working for `scene.ts` until p5 removes it.
- Do not change `overlappingPairs`, `intersection`, error order, `CadLoop`,
  signatures or `pcb-outline.ts`.

## Changes

`packages/core/src/cad/edge-y-index.ts`:
- Index only edges with `ay !== by`. `stats.builds += n` (all vertices) per index,
  as before. Sorting by `(lo, e)` is unchanged.
- Node arrays (typed arrays allowed): the existing `maxHigh`, plus `minHigh`,
  `minX` and `maxX`, where the X values are the edge endpoints' X. Padding leaves
  hold `+inf`, `+inf` and `-inf`. Store the leaf count `m` so that a node's real
  leaves are `[start, min(end, m))`.
- `EdgeIndexStats` gains `bulk?: number`.
- New export
  `crossingParity(index, x, y, exact: (edge: number) => boolean, stats?): boolean`:
  - `limit` = the number of leaves with `lo <= y` (upper-bound search, as today).
  - For each node entered: `visits += 1`.
    - Skip the node if `start >= limit`, `maxHigh <= y` or `maxX < x`.
    - For an internal node, if `min(end, m) <= limit`, `minHigh > y` and
      `minX > x`, flip the parity when `min(end, m) - start` is odd, add 1 to
      `bulk` (when defined) and stop.
    - For a leaf: `inspections += 1` and flip the parity if `exact(edge)`.
    - Otherwise descend.
  - Never resolve a leaf in bulk.
- `forEachEdgeAtY` keeps its current behaviour on the new arrays (closed stab, so
  it remains a superset of the predicate).

`packages/core/src/cad/loops.ts`:
- `contains` keeps its bounds early exit and calls `crossingParity(getIndex(), x, y, exact, stats)`.
  `exact(edge)` is today's predicate (`:420-427`): `ay > y !== by > y` and
  `(gridCross(...) > 0) === by > ay`. Lazy per-profile indexes are unchanged.

Pitfalls:
- Prune with strict `maxX < x` and resolve in bulk only on strict `minX > x`. The
  predicate counts a downward edge whose crossing lies exactly at `x`.
- The half-open stab requires `hi > y`: skip on `maxHigh <= y` (today's prune is
  `< y`).
- Never count padding leaves, and keep indexed reads safe under
  `noUncheckedIndexedAccess`.
- The round-9 tests need `inspections > 0` and `inspections <= 4H`, which holds
  only because leaves are always exact.

## Tests (`packages/core/src/cad/loops.test.ts`, append; existing tests unedited)

- Fixture (design 28.1 R10-2). For orientation `o` in {original, mirrored} and
  (T, H):
  - The plate vertex list is `(0,0), (W,0), (W,100), (2T,100)`, then for
    `i = T-1..0`: `(2i+2,10), (2i+1,10), (2i+1,100), (2i,100)`, with
    `W = 2T + 136`.
  - Hole k is the square from `(x0,y0)` with `x0 = 2T+4+2(k%64)` and
    `y0 = 12+2*floor(k/64)`, listed counter-clockwise.
  - Mirroring maps `x -> W - x` for every vertex.
  - Lines use the file's `line(id, a, b)` from vertex j to j+1 (wrapping). Ids are
    `a${pad5(j)}` for the plate and `h${pad5(k)}-${j}` for holes.
- New "a slotted rim resolves hole containment without scanning crossings behind
  the ray" (fail-before evidence). For each orientation and
  (T, H) in {(256,256), (512,256), (256,512), (512,512)}:
  - Call `buildLoops(entities, undefined, stats)` with
    `stats = { segmentPairs: 0, containmentPairs: 0, edges: { builds: 0, visits: 0, inspections: 0, bulk: 0 } }`.
  - Expected: `H + 1` loops. Loop 0 is the plate at depth 0; loop k+1 is hole k at
    depth 1.
  - `points` equals the expectation built from the vertex lists: the original list
    as given; a mirrored list v0..v(n-1) as `v0, v(n-1), ..., v1`.
  - With `q = visits + bulk + inspections`:
    - `q <= 16 * H * Math.log2(4 * T + 4)`;
    - `q(512,256) / q(256,256) <= 1.5`;
    - `q(512,512) / q(256,256) <= 2.5`;
    - `builds <=` the total vertex count of the returned loops.
  - Log the series.
  - Before the fix, `bulk` stays 0 and `inspections` is about `H(2T+2)`, so the
    first two bounds fail in both orientations. Record that log.
- Kept passing unedited: the round-9 detailed-rim test, the round-8 two-row and
  single-row tests, first-error, touching and nesting tests, and
  `pcb-outline.test.ts`.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/core/src/cad/edge-y-index.ts packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts && bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/pcb-outline.test.ts`
   - Evidence: the new test and all existing tests pass. Counter series before and
     after go in the progress log.

## Done criteria

- `crossingParity` is exported and used by `loops.ts` `contains`, and
  `forEachEdgeAtY` remains for `scene.ts`.
- The pre-fix failing log and the post-fix passing log exist, and command 1 exits
  0.
- `git diff --name-only` for this plan stays inside its writePaths, and the
  progress log reads `done`.

## Implementation status

Implemented the index, containment seam and slotted-rim regression. Focused gate
and TypeScript typecheck pass; evidence and counter series are recorded in the
plan-local progress log. Formal review and integration remain downstream.
