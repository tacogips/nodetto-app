# car12-p2a-segment-sweep

- planId: car12-p2a-segment-sweep; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car12-p2a-segment-sweep.md
- Finding: `performance-sketch-profile-pair-scans` (high), the sweep module.
- Design: `design-docs/specs/design-ai-capture.md` 29.1 R12-2, rules 1-2 and
  the `segment-sweep.test.ts` tests. Follow the worker rules in
  `car12-00-overview.md`. Evidence: `tmp/car12-r12/car12-p2a-segment-sweep/`.

## Intent and context

The crowded fallback of `intersection()` (`packages/core/src/cad/loops.ts`)
lists every overlapping box pair. That is quadratic for disjoint parallel
strips. This plan adds a self-contained Shamos-Hoey module that can only
prove disjointness. p2b wires it in.

Non-goals:
- Do not edit `loops.ts` or `loops.test.ts` (that is p2b).
- No re-export from any index.
- Import nothing but `./vec.ts` (`gridCross`; `coordinate` if needed).

## Changes (new `packages/core/src/cad/segment-sweep.ts`)

Exports:
- `interface SweepStats { events: number; steps: number; tests: number; collapsed: number }`
- `provesDisjoint(count: number, endpoints: (i: number) => readonly [number, number, number, number], touches: (i: number, j: number) => boolean, stats?: SweepStats): boolean`

Contract. Return `true` only when it is proved that no pair has overlapping
closed bounding boxes and a true `touches`. `false` means "not proved".
1. Collapse scan first. If any segment has identical endpoints, increment
   `collapsed` and return `false` before building events or nodes.
2. Box precondition. The module checks closed-interval box overlap on both
   axes before every `touches(i, j)` call. Pairs whose boxes do not overlap
   are never passed to `touches`.
3. Events are ordered by `(y, x)`, the order `loop-forest.ts` uses. The lower
   endpoint is the lexicographically smaller endpoint.
4. The status is a treap ordered along the sweep line just after the event
   point, using exact `gridCross`. Segments sharing a lower endpoint are
   ordered by the orientation of their upper endpoints, then by index.
   Imitate the comparator, insert, merge and remove of
   `packages/core/src/cad/loop-forest.ts:loopForest`, and its
   `priority(id)` hash. Use the same shift, add and xor avalanche style and
   no `Math.*` calls: the round-10 integration replaced a `Math.imul` mix
   (`impl-plans/progress/car10-p6-loop-forest.md`).
5. For each distinct event point `p`:
   - (a) `L` = segments with upper endpoint `p`, `U` = segments with lower
     endpoint `p`. Take `U ∪ L` in index order and test the first member
     against each other member, stopping at the first true test. Return
     `false` on a true test.
   - (b) Remove each `L` segment, then test its former predecessor against
     its former successor. Return `false` on a true test.
   - (c) Descend the treap by the sign of `gridCross(segment, p)`. A segment
     with orientation 0 contains `p` in its interior: return `false`.
   - (d) Insert each `U` segment and test it against its predecessor and its
     successor. Return `false` on a true test.
6. Return `true` after the last event.
7. Counters: `events` counts each event-point step and each insert and
   removal; `steps` counts each comparator call or treap node visit;
   `tests` counts each `touches` call; `collapsed` as above.

Pitfalls:
- Every contact branch returns `false`. Returning `true` in (c) would accept
  a T-touch.
- No floating point in ordering. Grid coordinates are integers and
  `gridCross` is exact.
- Do not recurse deeper than the treap's expected depth. Never walk the
  status linearly.
- Safe indexed reads under `noUncheckedIndexedAccess`.

## Tests (new `packages/core/src/cad/segment-sweep.test.ts`)

- Differential (seeded, deterministic; state the seed in the test).
  - 3,000 cases of 1-4 closed polylines with 3-7 vertices each on the
    integer grid 0..6.
  - Adjacency means consecutive in the same loop. The local `touches` is an
    exact closed-segment test that exempts an adjacent pair whose only
    common point is their shared vertex.
  - The oracle checks all pairs with the same box precondition and
    `touches`.
  - For every case: `provesDisjoint` true -> the oracle finds no touching
    pair (soundness).
  - For every case without a collapsed segment: `provesDisjoint` true
    exactly when the oracle finds none (completeness).
  - Assert, and log, the four non-zero counts: proved, not proved with a
    contact, not proved because of collapse, and oracle-disjoint.
- Collapsed: the closed polyline (0,0), (4,0), (4,0), (4,4), (0,4) -> false,
  `collapsed === 1`, `events === 0`.
- T-touch: segments (0,0)-(0,4) and (0,2)-(1,3), not adjacent -> false,
  `collapsed === 0`. The swapped input order gives the same result.
- Work: N disjoint parallel diagonal segments at N = 1024, 2048 and 4096.
  `events + steps + tests` grows at most 2.5x per doubling,
  `tests <= 3 * N`, and the result is true.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/core/src/cad/segment-sweep.ts packages/core/src/cad/segment-sweep.test.ts`
2. `bun test packages/core/src/cad/segment-sweep.test.ts`
   - Log the four case counts and the work series. This is a new module, so
     there is no fail-before run; p2b owns the regression.

## Done criteria

- Both files exist. The module imports only `./vec.ts`; the test imports
  only `bun:test` and the module.
- Commands 1-2 exit 0.
- `git diff --name-only` stays inside writePaths, and the progress log
  reads `done`.

Implementation status: done. The module and focused tests are present; both
verification commands passed. Formal review and p2b integration remain downstream.
