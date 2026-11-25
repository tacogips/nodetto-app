# car8-f1-loops-box-query

- planId: car8-f1-loops-box-query; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car8-f1-loops-box-query.md
- Finding: performance-sketch-profile-pair-scans (high).
- Design: `design-docs/specs/design-ai-capture.md` 26.1 R8-1. Follow
  `impl-plans/active/car8-00-overview.md` worker rules. Evidence:
  `tmp/car8-r8/car8-f1-loops-box-query/`.

## Intent and context

`overlappingPairs` (`packages/core/src/cad/loops.ts:215-258`) picks one sweep axis via
`overlapCount` and enumerates every pair overlapping on it before rejecting on the other
axis. A plate with holes along two perpendicular edges is quadratic for both callers:
`intersection` (`loops.ts:260-302`) and the depth loop in `buildProfileLoops`
(`loops.ts:446-460`). Audit: 1,024 holes -> 24,213,509 segment and 131,840 contour
candidate visits. This runs in Boa in the native CLI, so asymptotics matter.

Non-goals: no change to `segmentIntersection`, `contains`, `makeProfile`, `walk`, the
`(minX, minY)` sort of `segments` (`loops.ts:286`), `buildLoops`/`buildProfileLoops`
signatures, `LoopStats` field names, error codes, callers, or any other file.

## Changes (`packages/core/src/cad/loops.ts`, body of `overlappingPairs` only)

Keep the signature `(boxes: readonly Bounds[], visit: (i, j) => void, count: () => void)`.
Remove the `sorted`/`overlapCount` axis choice. Implement an X sweep with a static
max-maxY tree:

1. Index orders: `byMinX` sorted by `(minX, index)`; `byMaxX` by `(maxX, index)`;
   `byMinY` by `(minY, index)`. `leafOf[index]` = position in `byMinY`; `minYs` = sorted
   minY values.
2. Complete binary tree in array layout (a `Float64Array` is fine) over the leaves; each
   node holds the largest `maxY` among active leaves below it, `-Infinity` when none.
3. For each `a` in `byMinX` order: (i) advance a pointer over `byMaxX` and deactivate
   every box with `maxX < a.minX` (strict) by setting its leaf to `-Infinity` and
   recomputing ancestors; (ii) query; (iii) activate `a` (leaf = `a.maxY`, ancestors =
   max of children).
4. Query: `limit` = count of leaves with `minY <= a.maxY` (upper-bound binary search on
   `minYs`). Descend from the root; call `count()` once on entering each node; skip a
   node whose leaf range starts at or after `limit` or whose stored max `< a.minY`. At a
   reached leaf `b`, keep the existing four-comparison inclusive test and call
   `visit(b, a)` (or `visit(a, b)`; argument order is not a contract).

Pitfalls:
- Every unordered pair with closed-box overlap must be visited exactly once and no other
  pair; never visit `(a, a)` (query before activating `a`). Equal `minX` boxes must still
  find each other (earlier one is active because `maxX >= minX`).
- Deactivation is strict `<`: touching boxes (`b.maxX === a.minX`) stay active, or the
  touching-contour test at `loops.test.ts:125` regresses.
- `first = Math.min(first, i, j)` in `intersection` and symmetric depth increments make
  results order-independent; do not add early exits to `overlappingPairs`.
- Guard typed/array reads for `noUncheckedIndexedAccess` (`?? Number.NEGATIVE_INFINITY`,
  `?? 0`); no non-null assertions in production code. Recursion depth is <= ~30; an
  explicit stack is also fine.
- Do not build per-query arrays or sort inside the sweep (keeps O(n log n)).
- Imitate the existing style: `loops.ts:boundsOf` loops, `loops.ts:indexEdge` helpers.

## Tests (`packages/core/src/cad/loops.test.ts`, append; existing tests untouched)

New test "holes along two perpendicular edges have near-linear candidate counts", using
the file's `rectangle`, `circle` helpers:
- For `h` in 128, 256, 512: `L = 9 + 3 * (h / 2)`; `rectangle("plate", 0, 0, L, L)`;
  for `k < h / 2`: `circle(\`h-${k}\`, [6 + 3 * k, 2.5], 1)` and
  `circle(\`v-${k}\`, [2.5, 6 + 3 * k], 1)`; `stats = { segmentPairs: 0,
  containmentPairs: 0 }`; `buildLoops(entities, undefined, stats)` -> has `loops`,
  `loops.length === h + 1`, exactly one loop at depth 0 (members include `plate-a`) and
  `h` loops at depth 1.
- Per doubling: both counters `> 0` and `current <= previous * 2.5`.
- 128-hole fixture with `h-0` replaced by `circle("h-0", [6, 1], 1)` (tangent to `y = 0`)
  -> `toMatchObject({ error: "cad.profile.intersect" })` and `at` defined.
- Fail-before: on unmodified source the doubling assertion fails (expected ratio ~3.9;
  step-3 probe confirmed ~4x). Record the failing output and both counter series.

## Verification (exits 0 and runs tests)

1. `bunx biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts && bun test packages/core/src/cad/loops.test.ts`
   - evidence: new test passes; existing tests at `loops.test.ts:51`, `:125`, `:209`,
     `:234` pass unedited; post-fix counter series and ratios recorded in the progress
     log; complete log under the evidence root.

## Done criteria

- `overlapCount` and the one-axis choice are gone; `overlappingPairs` uses the X sweep
  plus max-maxY tree; signature unchanged.
- Pre-fix failing log and post-fix passing log exist; command 1 exits 0.
- `git diff --name-only` limited to this plan's writePaths for this plan's edits.
- Progress log reads `done` with hashes, commands, exit codes and log paths.

## Implementation status

Implementation complete; focused gate passed with 12 tests. Baseline and final
counter evidence, hashes and logs are recorded in
`impl-plans/progress/car8-f1-loops-box-query.md`.

Completed. The test-integrity and adversarial reviews accepted it with no
findings. The integration review accepted the combined tree: combined focused
tests 22 pass, typecheck and lint exit 0
(`tmp/car8-r8/reconcile-wave-001/`), caller-path suites 419 pass. Still to run
before commit or merge, tracked in `car8-00-overview.md`:
`CARGO_TERM_QUIET=true mise run verify` and the native CAD determinism case.
