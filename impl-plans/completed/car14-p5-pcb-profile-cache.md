# car14-p5-pcb-profile-cache

- planId: car14-p5-pcb-profile-cache; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car14-p5-pcb-profile-cache.md
- Finding: `performance-capture-shared-pcb-outline-ancestry-rebuilds`
  (medium).
- Design: `design-docs/specs/design-ai-capture.md` 31.1 R14-5 (this
  corrects 30.1 R13-3 rule 1).
- Worker rules: `car14-00-overview.md`.
- Evidence: `tmp/car14-r14/car14-p5-pcb-profile-cache/`.

## Intent and context

`buildCadCaptureModel`'s `tool` callback
(`packages/core/src/capture/scene.ts`, near `:513-540`) admits only
whole-sketch extrusions to the walk-local `profileCache`:
`whole = feature.type === "cad.extrude" && feature.semantic.loops === undefined`.

Every `cad.pcb` reference to a board returns the same memoized outline
array (`pcb-outline.ts:139-145`). K references therefore rebuild the
same containment forest K times.

Widen the predicate to include `cad.pcb`.

Non-goals:
- Do not touch `PROFILE_CACHE_MIN_WORK` (4096), `normaliseToolLoops`, the
  R12-3 budget, `chargeTool`, `makeTool`, `sweptBounds`, face IDs, body
  creation, `history.ts` or `pcb-outline.ts`.
- No second cache. Keep keying by array identity.
- Do not edit the R13-3 tests ("shared whole profiles reuse ancestry and
  preserve scene bytes", "ordinary capture avoids profile cache work").

## Changes (`packages/core/src/capture/scene.ts`)

1. Change the predicate to:
   `const whole = feature.type === "cad.pcb" || (feature.type === "cad.extrude" && feature.semantic.loops === undefined);`
2. Update the comment above it: PCB references share the memoized outline
   array.

Nothing else changes. Normalization depends only on the loops, so a hit
cannot change bytes. Each tool is still charged with its own
`loopCounts`.

## Tests (`packages/core/src/capture/scene.test.ts`)

Imitate:
- `sharedProfileRun` and `checkSharedOracle` (near `:1874-1957`);
- the PCB-page construction of
  "builds a reference body using another page's PCB geometry" (`:245`);
- `testBoard`, `edge` and `boardReference` from `../cad/testing/pcb.ts`.

Add a helper `sharedBoardRun(n: number, k: number)`:
- One board on a PCB page. Its Edge.Cuts holds, for i in 0..n-1:
  - a slanted rim polygon `[[0, y], [1000, y + 1000], [1000, y + 1001], [0, y + 1]]`
    with `y = 2 * i`;
  - a square hole of side 0.125 at `(500, y + 500.5)`.
  These are the shallow `ancestryFixture` shapes (`:1565-1578`). Use
  polygon-kind `edge` shapes, as the pcb-outline tests do for explicitly
  closed polygons.
- K `cad.pcb` references with IDs `ref-<i>` and thickness `1 + i / 8`
  (all distinct).
- Collect with `collectCadInput`, then run `buildCadCaptureModel` with
  `stats.ancestry = ancestryStats()` and
  `stats.profileCache = profileCacheStats()`.

Test `shared PCB outlines reuse ancestry and preserve scene bytes`
(timeout `120_000`), for (N, K) in (256, 8), (512, 16) and (1024, 32):
- No errors and no `overLimit`.
- These equal the K = 1 run of the same N:
  - `ancestryWork(stats.ancestry)`;
  - `indexEntries`;
  - `forestFallbacks`;
  - `profileCache.prepared`.
- `profileCache` matches `{ admitted: 1, lookups: K - 1, hits: K - 1 }`.
- Log the totals. Before the fix the work grows K-fold; save that run as
  `fail-before.log`.

At (256, 8) only:
- Scene oracle: with the request of `checkSharedOracle`, the
  `prepareCadCapture` bytes equal `writeCaptureScene` with each tool's
  loops rebuilt from `oracleNormalise(pcbBoardOutline(input, "board").loops)`.
  Face IDs are numbered from `sources`, as in `checkSharedOracle`.
- Every body has `reference === true`.
- Each body's bounds have `min[2] === 0` and `max[2]` equal to its own
  thickness.
- Point charging: the total prism points over `model.tools` (the sum of
  `points.length / 2`) equal K times the K = 1 total.
- If the PCB Y-flip or micrometre rounding makes direct coordinates
  awkward, take the loops from `pcbBoardOutline`. Do not hand-compute
  them.

Unedited and passing: the R13-3 tests, the ordinary guard (zero lookups,
admitted and hits), the PCB reference test at `:245`, the touching-shell
tests and `loop-forest.test.ts`.

## Verification (each exits 0)

1. `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts`
2. `bun test packages/core/src/capture/scene.test.ts packages/core/src/cad/loop-forest.test.ts`

## Done criteria

- [x] Commands 1-2 exit 0.
- [x] `fail-before.log` and the measured work totals are recorded.
- [x] The plan edits stay inside writePaths.
- [x] The progress log reads `done`. Formal reviews and integration follow downstream.
