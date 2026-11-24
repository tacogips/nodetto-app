# car2-a3-loop-normalisation: depth-bucketed ancestor search (R2-4)

- planId: car2-a3-loop-normalisation
- Wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-4.
- Progress log: `impl-plans/progress/car2-a3-loop-normalisation.md`

## Intent

`normaliseToolLoops` (`packages/core/src/capture/scene.ts:90-117`) scans
every candidate for every nested loop. Holes that come before a line-built
outline therefore cost O(holes^2). Replace that scan with a search over
depth buckets. The search must give the identical result: the greatest
containing depth below `d`, among the selected loops.

## Non-goals

- Do not edit `loops.ts`, `history.ts`, `makeTool` or
  `buildCadCaptureModel`.
- Do not add a complete-profile shortcut (design 20.4).
- Do not change loop order, parity, winding or face numbering.

## Changes

`packages/core/src/capture/scene.ts`, function `normaliseToolLoops` only:

- New signature: `normaliseToolLoops(loops: readonly CadLoop[], stats?: {
  ancestorProbes: number }): readonly CadLoop[]`.
- Keep the `every(depth === 0)` early return.
- Build `buckets: Map<number, { loop; minX; minY; maxX; maxY }[]>` keyed by
  depth. Inside each bucket, keep the order of `loops`.
- For each loop with `depth > 0`:
  - Take `(x, y)` from its first point, as today.
  - For `k = depth - 1` down to `0`, scan bucket `k`. Increment
    `stats.ancestorProbes` for every candidate examined. The first
    candidate whose bounds contain the point and whose polygon contains it
    (`containsPoint`, unchanged) sets `ancestorDepth = k` and ends the
    search.
  - If nothing matches, `ancestorDepth = -1`.
  - Keep the loop when `(depth - ancestorDepth) % 2 === 1`, as today.

## Pitfalls

- Equivalence. The current loop keeps the maximum containing depth below
  `d` (the `loop.depth > ancestorDepth` condition). Visiting the buckets in
  descending depth and stopping at the first match gives exactly that
  value. Do not change the bounding-box test or `containsPoint`.
- The candidates are the loops passed in, which are already the selected
  loops. Do not look up loops that were not selected.
- `stats` is optional and test-only. Production callers pass nothing.

## Tests (`packages/core/src/capture/scene.test.ts`)

- Probe scaling. Build a sketch through the production path, imitating the
  existing sketch fixtures in `scene.test.ts`: N circular holes followed
  by a rectangular line-built outline, with N = 500, 1,000 and 2,000. Get
  the loops through `buildLoops` from `../cad/loops.ts`.
  - After the fix, `ancestorProbes` is at most `N + 2` per run, and each
    doubling multiplies the count by at most 2.2.
  - Fails before: the pre-fix scan made 252,002, 1,004,002 and 4,008,002
    reads. Record that measurement in the progress log, using a temporary
    local counter that is not committed.
- Equivalence. Keep a verbatim copy of the pre-fix function inside the
  test as `oracleNormalise`. For each case below, the identity and order
  of the kept loops equal the oracle's:
  - a full selection;
  - a selection without the outline;
  - a selection without one hole;
  - nested islands (outline, hole, island, hole in island), with
    selections that drop each level in turn.
- Bytes. Build a perforated-plate capture with `buildCadCaptureModel` and
  `writeCaptureScene`, using the request shape from existing tests. Its
  sha256 equals the digest computed on `3cd2401` before the edit. Record
  the digest in the progress log and hard-code it in the test.

## Verification

- `bun test packages/core/src/capture/scene.test.ts packages/core/src/capture/cad-request.test.ts packages/core/src/capture/determinism.test.ts`
  must exit 0.
- `bunx biome check --diagnostic-level=warn packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts`
  must exit 0.

## Done when

- The probe, equivalence and bytes tests pass, and the existing
  capture-module tests pass unedited.
- Only `normaliseToolLoops` changed in `scene.ts`.
- The progress log reads `done`.
