# car10-p7-profile-depth-forest

- planId: car10-p7-profile-depth-forest; wave 3; dependsOn:
  car10-p4-edge-index-ray-origin, car10-p5-scene-ray-origin, car10-p6-loop-forest
- progressPath: impl-plans/progress/car10-p7-profile-depth-forest.md
- Finding: performance-cad-profile-depth-enumerates-all-ancestors (medium),
  integration.
- Design: `design-docs/specs/design-ai-capture.md` 28.1 R10-3 (Integration and
  Tests). Follow the overview worker rules. Evidence:
  `tmp/car10-r10/car10-p7-profile-depth-forest/`.

## Intent and context

`buildProfileLoops` (`packages/core/src/cad/loops.ts:556-594`) runs `contains`
in both directions for every pair of contours whose boxes overlap. For a nested
chain that is N(N-1)/2 pairs. This plan keeps that pair pass under a linear work
budget. If the budget is exceeded, it falls back to p6's `loopForest`.

Non-goals:
- Do not change intersection validation, the first-error order, the
  empty-profile check, `counterClockwise`, `CadLoop`, members and sources order,
  signatures, `pcb-outline.ts` or `history.ts`.
- Do not edit `loop-forest.ts` or `edge-y-index.ts`.

## Changes (`packages/core/src/cad/loops.ts`)

- `overlappingPairs(boxes, visit, count, stop?: () => boolean)`. Check `stop`
  after each `count()` call. When it returns true, return from the sweep loops
  and from the indexed `query` recursion and its outer loop. `intersection`
  passes no `stop`, so its behaviour is unchanged.
- `LoopStats` gains `forest?: ForestStats`, imported from `./loop-forest.ts`.
- Depth pass:
  - `E` = the sum of `profile.grid.length / 2`.
  - `budget = DEPTH_WORK_PER_VERTEX * E`, with a new
    `const DEPTH_WORK_PER_VERTEX = 32`.
  - Count work internally whether or not `stats` is given. Work is the
    containment pairs counted plus a local
    `EdgeIndexStats { builds, visits, inspections, bulk: 0 }`, which `getIndex`
    and `contains` receive.
  - After the pass, add the local edge counts into `stats.edges` when present
    (`bulk` only if `stats.edges.bulk` is defined). `stats.containmentPairs`
    keeps counting as today.
  - `stop` returns `work > budget`.
  - If the pass stopped, replace `depths` with
    `loopForest(profiles.map((p) => p.grid), profiles.map((p) => p.winding), stats?.forest).depths`.
    Otherwise keep the pass's depths.

Pitfalls:
- The abandoned pair work stays counted in `stats`. It is part of the measured
  total.
- Do not derive depths by walking `parents`. Use `depths` as returned.
- Profiles with `winding === 0` still produce `cad.profile.empty` afterwards, as
  today.
- Record each existing fixture's pair work against its budget in the progress
  log: the round-8 two-row and single-row tests, the round-9 detailed rim, and
  p4's slotted rim. They must stay on the pair path. If one exceeds the budget,
  stop and report it; never relax a test.

## Tests

- `packages/core/src/cad/loops.test.ts`, new "nested chains derive depth from
  immediate parents" (fail-before evidence).
  - Fixture: for N in {1025, 2049, 4097}, with `S = 2N + 2`, rect i has the
    vertex list `(i,i), (S-i,i), (S-i,S-i), (i,S-i)`. It is drawn as four
    `line(`r${pad5(i)}-${j}`, v_j, v_{j+1})`.
  - Selections:
    - all loops (pick undefined): N loops, loop i has depth i and points equal
      rect i's list;
    - rect floor(N/2) omitted (pick = every other id): N - 1 loops, each other
      rect keeps depth i and its exact points;
    - sparse (pick = `r${pad5(0)}-0` and `r${pad5(N-1)}-0`): two loops, depths 0
      and N - 1, with exact points.
  - Use
    `stats = { segmentPairs: 0, containmentPairs: 0, edges: { builds: 0, visits: 0, inspections: 0, bulk: 0 }, forest: { events: 0, steps: 0 } }`
    and
    `W = containmentPairs + builds + visits + inspections + bulk + events + steps`.
  - Assert `W(2N) / W(N) <= 2.5` for each selection, and log the series.
  - Before the fix (p4 code), W grows about 4 times. Record that log.
- `packages/core/src/capture/scene.test.ts`, new "a sparse nested-chain selection
  keeps the 400-byte outer prism" (behaviour guard).
  - Elements: `sketch("chain", "a1")`, N = 1025 rects as `cad.line` with ids
    `r${pad5(i)}-${j}`, and
    `extrude("chain-solid", "a2", { sketch: "chain", loops: ["r00000-0", "r01024-0"], distance: 1, op: "new" })`.
  - Run `prepareCadCapture` with the p3 request shape.
  - Expected: `scene.length === 400`. `model.tools[0].loops` has one loop whose
    `points` equal `[0,0, S,0, S,S, 0,S]`.
- All existing tests in both files pass unedited.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/loop-forest.test.ts packages/core/src/cad/pcb-outline.test.ts packages/core/src/cad/history.test.ts packages/core/src/capture/scene.test.ts`

## Done criteria

- `loops.ts` imports `loopForest`, has `DEPTH_WORK_PER_VERTEX = 32`, and
  `overlappingPairs` accepts `stop`.
- The pre-fix failing log, the post-fix passing log and the fixture budget table
  exist, and command 1 exits 0.
- `git diff --name-only` for this plan stays inside its writePaths, and the
  progress log reads `done`.

## Implementation status

Done: bounded pair pass, forest fallback, nested-chain and sparse-scene regressions, fixture budget evidence, and focused gate. Formal review and integration remain downstream; see `impl-plans/progress/car10-p7-profile-depth-forest.md`.
