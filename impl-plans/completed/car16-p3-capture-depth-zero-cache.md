# car16-p3-capture-depth-zero-cache

- planId: car16-p3-capture-depth-zero-cache; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car16-p3-capture-depth-zero-cache.md
- Finding: `performance-capture-shared-depth-zero-profile-rescans`
  (medium).
- Design: `design-docs/specs/design-ai-capture.md` 32.1 R16-3, rules 1-5.
- Worker rules: `car16-00-overview.md`.
- Evidence: `tmp/car16-r16/car16-p3-capture-depth-zero-cache/`.

## Intent and context

`normaliseToolLoops` (`packages/core/src/capture/scene.ts:215-224`) resets
`measured` to zero and returns its input when every loop has depth 0.
`buildCadCaptureModel`'s `tool` callback (about `:513-540`) admits a
whole profile to `profileCache` only when `prepared + searched >=
PROFILE_CACHE_MIN_WORK` (4096). An all-zero profile therefore costs 0,
is never cached, and is rescanned on every extrusion (M x K).

Fix:
- Charge the all-zero scan `loops.length`.
- Admit it on the single threshold, or cumulatively per array once its
  charge is at least 64 loops.
- Keep small and one-use profiles on today's allocation-free path.

Non-goals:
- Do not change `PROFILE_CACHE_MIN_WORK`, the mixed-depth path, its
  `prepared` and `searched` values, `chargeTool`, `makeTool`,
  `sweptBounds`, face numbering, `ANCESTRY_WORK_PER_VERTEX` or explicit
  selections.
- Do not touch `history.ts`, `construction.ts` or `cad-request.ts`. The
  low finding at `cad-request.ts:209` stays.
- No cumulative bookkeeping for mixed-depth profiles.

## Changes (`packages/core/src/capture/scene.ts`)

1. `normaliseToolLoops(loops, stats?, measured?)`. The `measured` shape
   becomes `{ prepared: number; searched: number; scanned: number }`.
   Only `scene.ts` passes it; tests call without it.
   - Reset all three fields at entry.
   - Replace the leading `every` with a counted loop. `scanned` is the
     number of depth predicate evaluations: `loops.length` when all are
     0, else the index of the first non-zero depth plus 1.
   - On the all-zero path: `searched = loops.length`, `prepared = 0`, and
     return the input array itself.
   - The mixed path is otherwise unchanged.
2. Export `PROFILE_CACHE_PENDING_MIN_WORK = PROFILE_CACHE_MIN_WORK / 64`
   (64), next to `PROFILE_CACHE_MIN_WORK`.
3. `CaptureWalkStats.profileCache` gains `depthVisits: number` and
   `pendingUpdates: number`.
4. In `buildCadCaptureModel`:
   - `work` becomes `{ prepared: 0, searched: 0, scanned: 0 }`.
   - Add `let pendingWork: Map<readonly CadLoop[], number> | undefined;`.
   - After each `normaliseToolLoops` call, add `work.scanned` to
     `counters.depthVisits`. Leave `counters.prepared` as today.
   - Whole-profile admission:
     - Rule 2, unchanged: `total = prepared + searched >= 4096` admits,
       as today.
     - Otherwise, as today, update `maxDirectWork` with `total`. Then,
       only if the call returned `geometry.loops` itself (the all-zero
       path) and `geometry.loops.length >= PROFILE_CACHE_PENDING_MIN_WORK`:
       1. Create `pendingWork` lazily, counting 1 in `pendingUpdates`.
       2. Add `total` to its entry.
       3. If the sum is at least 4096, delete the entry, set
          `profileCache` (created lazily) to map the array to itself,
          and increment `admitted`. Otherwise set the new sum.
       Each set or delete counts 1 in `pendingUpdates`.
   - `lookups` and `hits` are counted exactly as today (only once
     `profileCache` exists).

Pitfalls:
- Do not put the charge into `prepared`. Existing tests pin
  `profileCache.prepared`.
- Never allocate `pendingWork` or call map methods for profiles below
  the floor, for mixed-depth profiles or for explicit selections.
- The cached value must be the same array object, so bytes are identical.
- Count `scanned` on every call. The counter is a test hook and must not
  allocate.

## Tests (`packages/core/src/capture/scene.test.ts`)

- Update `profileCacheStats()` to add `depthVisits: 0` and
  `pendingUpdates: 0`. Existing `toMatchObject` assertions stay as they
  are.
- Imitate `sharedProfileRun`, `checkSharedOracle` and `circle(id,
  sketchId, c, r)` (`:54`, `:1962-2049`). A new helper
  `depthZeroGrid(n)` (check the name is unused) makes n circles
  `c<i>` in sketch `ancestry` at `[3 * (i % 64), 3 * floor(i / 64)]`,
  `r = 1`.

Cases (timeout `120_000`):
- `depthZeroGrid(4096)`, K = 2 (`Array(2).fill(undefined)`):
  - `depthVisits 4096`, `admitted 1`, `lookups 1`, `hits 1`;
  - `checkSharedOracle` passes.
- `depthZeroGrid(256)`, K = 32:
  - `depthVisits 4096`, `admitted 1`, `lookups 16`, `hits 16`,
    `pendingUpdates > 0`;
  - `checkSharedOracle` passes.
- `depthZeroGrid(256)`, K = 64: `depthVisits 4096` and `hits 48`.
- `depthZeroGrid(63)`, K = 2: `pendingUpdates 0`, `depthVisits 126`,
  `admitted 0`.
- `depthZeroGrid(64)`, K = 2: `pendingUpdates > 0`, `admitted 0`.
- One-use guard: `buildCadCaptureModel` on
  `generateCadDocument({ features: 500, entitiesPerSketch: 1 })`:
  - `pendingUpdates 0`, `lookups 0`, `admitted 0`, `hits 0`,
    `depthVisits 500`, `maxDirectWork 1`.
  - Note on the review's baseline: `maxDirectWork 1` holds only after
    step 2. Before the fix it is 0, because the all-zero scan is not
    charged. This guard is not fail-before evidence.
- Ordinary pin: in "ordinary capture avoids profile cache work", add
  `pendingUpdates 0` and the measured `depthVisits` (expected 500).
  Do not change the existing assertions.
- These stay unedited and passing: the shared whole-profile test
  (mixed: `admitted 1, lookups 31, hits 31`), the explicit-subset test,
  the shared-PCB test and every `normaliseToolLoops` oracle test.

## Verification (each exits 0 unless stated)

1. Step 1: add only the counters (`scanned`, `depthVisits`,
   `pendingUpdates`) and the tests, with no charge and no map. Run
   `bun test packages/core/src/capture/scene.test.ts`. Expect exit 1:
   `depthZeroGrid(4096)` gives depthVisits 8192 and admitted 0. Save it as
   `fail-before.log`.
2. `export CARGO_TARGET_DIR=target/r16-capture-depth && bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts`
   - Expect 0 failures and the new tests passed. Save it as `gate.log`.

## Done criteria

- [x] Command 2 exits 0, and `fail-before.log` shows exit 1.
- [x] The measured counters for every case are in the progress log.
- [x] Every file this plan edited is in its writePaths.
- [x] The progress log reads `done`.
