# car10-p6-loop-forest

- planId: car10-p6-loop-forest; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car10-p6-loop-forest.md
- Finding: performance-cad-profile-depth-enumerates-all-ancestors (medium),
  parent-forest module.
- Design: `design-docs/specs/design-ai-capture.md` 28.1 R10-3 (Sweep, Answer,
  Edge order, Counters, Winding 0). Follow the overview worker rules. Evidence:
  `tmp/car10-r10/car10-p6-loop-forest/`.

## Intent and context

The depth pass in `buildProfileLoops` tests every overlapping pair of contours
(`packages/core/src/cad/loops.ts:556-594`), which is N(N-1)/2 pairs for a nested
chain. This plan adds a self-contained module. It computes each contour's
immediate parent and depth with one deterministic upward sweep, in expected
O(E log E). p7 wires it in.

Non-goals:
- Do not edit `loops.ts`; that is p7.
- No re-export from `packages/core/src/cad/index.ts` or `packages/core/src/index.ts`.
- No import other than `./vec.ts` (`coordinate`, `gridCross`).

## Changes (new `packages/core/src/cad/loop-forest.ts`)

- Exports:
  - `ForestStats { events: number; steps: number }`;
  - `loopForest(grids: readonly (readonly number[])[], windings: readonly number[], stats?: ForestStats): { parents: number[]; depths: number[] }`.
- Input contract: each grid is a flat array of integer nanometre vertices. Edge
  `e` runs from vertex `(e + n - 1) % n` to vertex `e`. The contours neither cross
  nor touch. A winding of 0 is treated as positive.
- Edges: only non-horizontal edges take part. Each keeps its owner index, its
  lower point L, its upper point U and `down` = (the stored direction goes from
  higher y to lower y).
- Sweep over ascending distinct y. At each y:
  1. remove the edges with `hi == y`;
  2. insert the edges with `lo == y`;
  3. answer every contour whose representative vertex v (the minimum y, then the
     minimum x) lies at this y, in ascending x.
- Active set: a treap ordered left to right just above y. Each priority is a
  deterministic integer hash of the insertion counter, for example a `Math.imul`
  mix. Do not use `Math.random`.
- Comparator for active edges s and t, at `y_c = max(lo_s, lo_t)`:
  - Take the edge whose L lies at `y_c` and test its L against the other edge with
    `gridCross(U - L, P - L)`. A positive result means P is left of the edge.
  - A zero result means a shared lower endpoint. In that case test one edge's U
    against the other edge instead.
  - Distinct edges never compare equal. Removal uses the comparator plus identity.
- Answer for v:
  - t is the rightmost active edge with v strictly right of t
    (`gridCross(U - L, v - L) < 0`). If there is none, the parent is -1 and the
    depth is 0.
  - Otherwise let Q be t's owner. v is inside Q when
    `t.down !== (windings[Q] < 0)`.
  - Then `parents = inside ? Q : parents[Q]` and
    `depths = inside ? depths[Q] + 1 : depths[Q]`. Q was always answered earlier.
- Counters: `events += 1` per insert, removal and answer. `steps += 1` per
  comparator call or treap node visited.

Pitfalls:
- Never walk a parent chain to compute a depth. That restores quadratic work.
- Do not use floating point for ordering. `gridCross` is exact.
- Queries come after the inserts at the same y, and removals come before both.
- Keep indexed reads safe under `noUncheckedIndexedAccess`, with no non-null
  assertions.

## Tests (new `packages/core/src/cad/loop-forest.test.ts`)

- The oracle is written in the test. The parent is the smallest-area container,
  and the depth is the number of containers. Containment uses the first vertex
  and an independent BigInt crossing determinant with the half-open rule.
- Cases (`input -> parents and depths equal the oracle`):
  - a nested rectangle chain of 5, in both windings;
  - two sibling islands inside a hole inside a plate;
  - contours whose vertices share y values;
  - a contour whose representative vertex's leftward ray passes exactly through
    another contour's local-minimum vertex, and one through a local-maximum
    vertex;
  - triangles and diamonds, clockwise and counter-clockwise;
  - a single contour -> `[-1]` / `[0]`.
- Doubling: nested chains of 256, 512 and 1024 rectangles, each inset 1 mm (in
  nm). `events + steps` grows at most 2.5 times per doubling, and the depths are
  `0..N-1`.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/core/src/cad/loop-forest.ts packages/core/src/cad/loop-forest.test.ts && bun test packages/core/src/cad/loop-forest.test.ts`
   - This is a new module, so there is no fail-before run. The fail-before
     regression is p7's.

## Done criteria

- Both files exist and only import `./vec.ts` (test: `bun:test`, the module).
- Command 1 exits 0, and the counter series is logged.
- `git diff --name-only` for this plan stays inside its writePaths, and the
  progress log reads `done`.

Implementation phase: done. The standalone sweep and oracle/counter tests are
in place; p7 integration and formal review remain downstream.
