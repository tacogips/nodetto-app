# car13-p3-shared-ancestry-cache

- planId: car13-p3-shared-ancestry-cache; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car13-p3-shared-ancestry-cache.md
- Finding: `performance-capture-shared-profile-ancestry-rebuilds` (medium).
- Design: `design-docs/specs/design-ai-capture.md` 30.1 R13-3.
- Worker rules: `car13-00-overview.md`.
- Evidence: `tmp/car13-r13/car13-p3-shared-ancestry-cache/`.

## Intent and context

`buildCadCaptureModel` calls `normaliseToolLoops(geometry.loops,
stats?.ancestry)` for every tool (`packages/core/src/capture/scene.ts:494`).
K whole-sketch extrusions share one loop array (`history.ts:579`), so
ancestry work is K times one normalization.

Add a walk-local, threshold-gated cache keyed by array identity, admitted
only for whole-sketch extrusions whose cost is at least 4,096 units.
Ordinary documents create no map, make no lookup and store nothing.

Non-goals:
- Do not edit `history.ts`, `construction.ts`, `loop-forest.ts` or
  `cad-request.ts`.
- Do not change the R12-3 fallback budget (`ANCESTRY_WORK_PER_VERTEX`, the
  `work > budget` check at `:260`), the retained loops, their order or the
  scene bytes.
- Do not reorder normalization and `chargeTool`.

## Changes (`packages/core/src/capture/scene.ts`)

1. `normaliseToolLoops(loops, stats?, work?: { prepared: number; searched: number })`:
   - When `work` is given, set `work.prepared` and `work.searched` before
     every return.
   - `prepared` is the sum of `loop.points.length` over `loops`: the
     coordinates rounded and bounds-scanned at `:220-226`. It is 0 on the
     early return at `:218`.
   - `searched` is the local `work` counter (`:243`) at return, including
     the forest-fallback return.
   - Do not feed `prepared` into the budget comparison.
2. Export `PROFILE_CACHE_MIN_WORK = 4096`.
3. Add `profileCache?: { lookups: number; admitted: number; hits: number; prepared: number; maxDirectWork: number }`
   to `CaptureWalkStats` (`:375-380`).
4. In `buildCadCaptureModel`:
   - Allocate one `{ prepared: 0, searched: 0 }` per walk.
   - Declare `let profileCache: Map<readonly CadLoop[], readonly CadLoop[]> | undefined`.
   - In the `tool` callback (`:491`):
     - When `feature.type === "cad.extrude" && feature.semantic.loops === undefined`:
       - If `profileCache` exists, look up `geometry.loops` and count
         `lookups`. A hit counts `hits` and reuses the stored loops; skip
         normalization.
       - On a miss, normalize with the work object. If
         `prepared + searched >= PROFILE_CACHE_MIN_WORK`, create the map
         if needed, store the result and count `admitted`. Otherwise
         update `maxDirectWork` with the maximum.
     - Every other tool (PCB, explicit `loops`) normalizes directly, with
       no lookup and no insertion.
     - Add `prepared` to `stats.profileCache.prepared` for every
       normalization actually performed.
     - Update counters only when `stats?.profileCache` is set.
   - `chargeTool`, `makeTool`, `sweptBounds` and body or step creation stay
     per tool, on the (possibly cached) loops.
   - Verify that none of them mutates `loops` and record that in the
     progress log. The cached value type is `readonly CadLoop[]`.

Pitfalls:
- Do not create the map eagerly, and do not look up for non-whole-sketch
  tools. The ordinary guard counts both.
- Do not cache by sketch ID or by contents. Use array identity only.
- A hit must not change `stats.ancestry`. That is the whole point.

## Tests (`packages/core/src/capture/scene.test.ts`)

Reuse the R12-3 shallow fixture builder and the full-scene oracle helpers
already in this file (`oracleNormalise`, the `writeCaptureScene` oracle
from car12-p3).

- Slanted rim: shallow sketch N = 1024 with K = 1 and K = 32 `new`
  extrusions of distances 1..K, whole sketch.
  - Expect equal ancestry totals (`depthLookups + ancestorProbes +
    indexEntries + edge builds/visits/inspections/bulk + forest.events +
    forest.steps`), equal `forestFallbacks` and equal
    `profileCache.prepared` for K = 1 and K = 32.
  - K = 32 gives `admitted 1`, `lookups 31`, `hits 31`.
  - Fails before the fix.
- Sparse high-vertex fixture:
  - One sketch with `rectangle(0, 0, 10, 10)`, a radius-1 circle at (5, 5)
    and 64 radius-100 circles at (300 + 300 * (i % 8),
    300 + 300 * floor(i / 8)), with K = 1 and K = 32.
  - Expect no errors, no `overLimit`, `forestFallbacks 0`, equal ancestry
    totals and equal `prepared` for K = 1 and K = 32, and `prepared` at
    least `PROFILE_CACHE_MIN_WORK`. Log `prepared` (the reviewer measured
    32,840).
  - K = 32 gives `admitted 1`, `lookups 31`, `hits 31`.
  - This must fail under an admission on searched units alone (238).
- Oracle: for both K = 32 fixtures, the `prepareCadCapture` scene bytes
  equal the oracle bytes, and each body's bounds come from its own distance.
- Explicit subsets: on the N = 1024 sketch, two extrusions with different
  heavy `loops` selections.
  - Expect bytes equal to the oracle, ancestry totals equal to the sum of
    the two single-extrusion runs, and `lookups 0`, `admitted 0`, `hits 0`.
- Ordinary guard (a new test): `generateCadDocument({ features: 500, entitiesPerSketch: 18 })`.
  - Expect `lookups 0`, `admitted 0`, `hits 0`, `ancestorProbes 5000`,
    `indexEntries 5500`, `forestFallbacks 0`, and
    `maxDirectWork * 4 <= PROFILE_CACHE_MIN_WORK`.
  - The calibration predicts at most 775 (656 prepared plus 119 searched).
  - If this fails, set the constant to the smallest power of two that is at
    least 4 x the measured value, capped at 32,768, and record it. A value
    above 8,192 means blocked: report it.
- The existing ancestry, deep, shallow, ordinary (`:1727-1737`) and
  touching-shell tests stay unedited and pass.

## Verification (each exits 0)

1. `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts`
2. `bun test packages/core/src/capture/scene.test.ts packages/core/src/cad/loop-forest.test.ts`

## Done criteria

- Commands 1-2 exit 0.
- The fail-before log is saved.
- `maxDirectWork` and `prepared` values are recorded.
- The diff stays inside writePaths.
- The progress log reads `done`.

## Implementation status

Done: the assigned implementation and focused gates passed. Formal review and
workspace integration are downstream. See the plan-local progress log for
hashes, calibration and evidence.
