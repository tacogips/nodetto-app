# car9-p2-scene-edge-index

- planId: car9-p2-scene-edge-index; wave 2; dependsOn: car9-p1-edge-index-loops
- progressPath: impl-plans/progress/car9-p2-scene-edge-index.md
- Finding: performance-cad-containment-perimeter-rescans (high), ancestor pass.
- Design: `design-docs/specs/design-ai-capture.md` 27.1 R9-1. Follow
  `impl-plans/active/car9-00-overview.md` worker rules. Evidence:
  `tmp/car9-r9/car9-p2-scene-edge-index/`.

## Intent and context

`normaliseToolLoops` (`packages/core/src/capture/scene.ts:184-247`) calls
`containsPoint` (`scene.ts:79-95`) at `scene.ts:237`, which walks every edge of the
candidate ancestor loop for each query. With H holes in a plate of P = H + 3 edges
that is H(H+3) edge reads before Rust receives the scene. Reuse p1's index.

Non-goals: do not edit `packages/core/src/cad/edge-y-index.ts` or `loops.ts` (p1).
No change to `CadLoop`, `loopBounds`, `indexBucket`, the probe order and merge of
`local`/`oversized`, `ancestorProbes`, `indexEntries`, the kept-loop order, the
return value of `normaliseToolLoops`, `makeTool`, `buildCadCaptureModel`,
`prepareCadCapture`, NCS1 or any caller.

## Changes (`packages/core/src/capture/scene.ts`)

- Import `buildEdgeYIndex`, `forEachEdgeAtY`, `type EdgeIndexStats`,
  `type EdgeYIndex` from `../cad/edge-y-index.ts` (contract in the overview).
- `LoopEntry` gains an optional mutable `edges?: EdgeYIndex`, built lazily from
  `entry.loop.points` the first time the entry reaches the exact test, with
  `stats?.edges`. One build per entry per `normaliseToolLoops` call.
- The stats parameter type becomes
  `{ ancestorProbes: number; indexEntries?: number; edges?: EdgeIndexStats }`.
- `containsPoint` keeps its predicate verbatim:
  `ay > y !== by > y && x < ax + ((bx - ax) * (y - ay)) / (by - ay)` toggles
  `inside`, with `a` = vertex `(e + n - 1) % n`, `b` = vertex `e`, read with
  `coordinate(points, ...)`, applied only to edges from `forEachEdgeAtY`.
- Keep the box test at `scene.ts:232-236` before the exact test, so entries
  rejected by bounds never build.

Pitfalls:
- Millimetre doubles stay doubles; never convert to the grid or round.
- Do not move the lazy build before the bounds check; do not build per probe.
- Do not change iteration order or the `break` on the first containing ancestor.
- Indexed reads guarded for `noUncheckedIndexedAccess`.

## Tests (`packages/core/src/capture/scene.test.ts`, append; existing tests untouched)

New test "normalisation queries the detailed rim through one edge index":
- Rim fixture for H in 256, 512, 1024, sketch id `"profile"`, built with
  `cadElement(id, "cad.line", "a1", { sketch: "profile", a, b })` (imported from
  `../cad/testing/documents.ts`, already imported by the file) and the file's
  `circle(id, "profile", c, 1)`. Geometry identical to p1: rim segments from
  `[256*i/H, y_i]` to `[256*(i+1)/H, y_(i+1)]`, `y_i = 512` even / `513` odd, then
  right side, bottom (`y = 0`) and left side; holes at
  `[2.5 + 3*(k%64), 2.5 + 3*Math.floor(k/64)]`.
- `loops = selectedLoops(entities)`; `stats = { ancestorProbes: 0, indexEntries: 0, edges: { builds: 0, visits: 0, inspections: 0 } }`;
  `actual = normaliseToolLoops(loops, stats)`; `expected = oracleNormalise(loops)`.
- Assert `actual.length === expected.length`, each `actual[i]` is `expected[i]`
  (`toBe`), and `indexedSceneBytes(actual)` equals `indexedSceneBytes(expected)`.
- Edge counters each > 0; `builds <= sum(loop.points.length / 2)` over `loops`;
  `inspections <= 4 * H`; per doubling `builds + visits + inspections` <= previous
  * 2.5. Log the series.
- Fail-before: with p1 landed and `scene.ts` unmodified the edge counters stay 0, so
  the `> 0` assertion fails. Record that log.

## Verification (exits 0 and runs tests)

1. `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts`
   - evidence: the new test passes; the omitted-intermediate-ancestor tests
     ("omits leading odd levels ...", the `nestedSelections` table, "finds the
     containing ancestor among two disjoint islands ...", "keeps an island inside
     another loop's bounding box but outside its polygon"), the perforated and
     indexed-loop tests and "builds 20,000 CAD elements in under 1,000 ms" (timing
     rule) pass unedited; counter series in the progress log; complete log under
     the evidence root.

## Done criteria

- `containsPoint` reads only edges returned by `forEachEdgeAtY`; one build per entry.
- Pre-fix failing log and post-fix passing log exist; command 1 exits 0.
- `git diff --name-only` for this plan's edits stays inside its writePaths.
- Progress log reads `done` with hashes, commands, exit codes and log paths.

## Implementation status

Implementation complete; focused gate passed. See
`impl-plans/progress/car9-p2-scene-edge-index.md` for hashes and evidence.
Formal review and integration gates remain downstream.
