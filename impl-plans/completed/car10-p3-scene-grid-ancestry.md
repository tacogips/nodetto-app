# car10-p3-scene-grid-ancestry

- planId: car10-p3-scene-grid-ancestry; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car10-p3-scene-grid-ancestry.md
- Finding: maintainability-capture-hole-containment-precision (medium).
- Design: `design-docs/specs/design-ai-capture.md` 6.1 and 28.1 R10-4. Follow the
  overview worker rules. Evidence: `tmp/car10-r10/car10-p3-scene-grid-ancestry/`.

## Intent and context

`containsPoint` (`packages/core/src/capture/scene.ts:85-111`) decides capture
ancestry by interpolating a crossing in floating-point millimetres (`:105`).
Sketch construction decides the same containment on the integer nanometre grid
(`packages/core/src/cad/loops.ts:405-433`, the `gridCross` predicate at
`:425-427`). On a sloped rim, the float crossing can round onto the tip X, and
capture then drops a valid hole. The fix makes capture decide on the same grid
integers while still serializing millimetres.

Non-goals:
- Do not edit `edge-y-index.ts` or `loops.ts` (owned by p4 and p7).
- Do not change the query call (`forEachEdgeAtY` stays; p5 swaps it).
- Do not change `makeTool`, face numbering, the kept `CadLoop` objects, their
  order, the return value of `normaliseToolLoops`, `prepareCadCapture`, NCS1,
  goldens or public types.

## Changes (`packages/core/src/capture/scene.ts`)

- Import `gridCross` and `NM_PER_MM` from `../cad/vec.ts`.
- `LoopEntry` gains `grid: number[]`, computed as
  `loop.points.map((v) => Math.round(v * NM_PER_MM))` (the `makeProfile`
  expression, `loops.ts:165`). Entry bounds (`minX..maxY`) are computed from
  `grid`, not from millimetres, by passing the grid to the existing bounds helper.
- `indexBucket`, the in-bucket `inside` test and the per-entry box test all
  compare grid bounds with the grid query vertex:
  `x = coordinate(grid, 0)`, `y = coordinate(grid, 1)` of the queried loop. The
  queried loop needs its own grid, so compute the grid for every loop once when
  building the entries, after the all-depth-0 early return.
- `containsPoint(entry, x, y, stats)` builds its index lazily from `entry.grid`
  and uses the `loops.ts` predicate for each reported edge: with `a` = vertex
  `(e + n - 1) % n` and `b` = vertex `e` of `entry.grid`, the edge toggles when
  `ay > y !== by > y` and `(gridCross(bx - ax, by - ay, x - ax, y - ay) > 0) === by > ay`.
- The kept loops are still the input `CadLoop` objects, with their millimetre
  `points`.

Pitfalls:
- Never mix units. Bounds, cells, the query point and the index must all be on
  the grid.
- Keep the lazy build after the box test, one index per entry per call, the probe
  order, the `break` on the first containing ancestor, `ancestorProbes` and
  `indexEntries`.
- Use the same rounding as `makeProfile`. Do not add an epsilon or a tolerance.

## Tests (`packages/core/src/capture/scene.test.ts`)

- Oracle helper update (design 28.4). Rewrite the brute-force `containsPoint`
  (about `:586-603`) and the `oracleNormalise` bounds (about `:605-630`) to work
  on `Math.round(v * 1e6)` integers, with their own BigInt determinant
  `(BigInt(bx)-BigInt(ax))*(BigInt(y)-BigInt(ay)) - (BigInt(by)-BigInt(ay))*(BigInt(x)-BigInt(ax))`.
  Use the same half-open and direction rule, and do not import `gridCross`.
  Callers of the oracle keep their assertions unchanged.
- New "capture keeps a sloped-rim triangular hole decided on the nanometre grid"
  (fail-before evidence).
  - Elements: `sketch("tri", "a1")`; rim `cad.line` ids `rim-0..3` over
    `[[970,0],[1000,0],[1100.000003,100.000001],[970,100.000001]]`, each from
    vertex j to vertex j+1; triangle `cad.line` ids `hole-0..2`; and
    `extrude("plate", "a2", { sketch: "tri", distance: 5, op: "new" })`.
  - Variant A: the triangle starts at `[1050.000002,50.000001]`, then
    `[1010,65]`, `[1000,35]`. Variant B: it starts at `[1010,65]`. The solid
    control has no triangle.
  - Request: `{ width: 256, height: 256, theme: "light", camera: { view: "top" }, interference: null }`
    through `prepareCadCapture(elements, CAD_TEST_PAGE.id, request)`.
  - Oracle assertion: the BigInt determinant of edge
    `(1000e6, 0) -> (1100000003, 100000001)` with point `(1050000002, 50000001)`
    is `1n`.
  - Expected for A and B:
    `model.tools[0].loops.map((l) => l.points.length / 2)` equals `[3, 4]`, and
    each `scene` differs from the control's `scene`. Record the control's
    SHA-256 in the progress log (expected
    `4e79a49509e7e31ca09f07bc252b57affc87f814f798a5d13b22584843ca93b0`); do not
    assert it.
  - Before the fix, A gives `[4]` and its scene equals the control. Record that
    log.
- Every existing test stays unedited and passes, including NCS1 digests, the
  omitted-ancestor tests, `checkIndexedLoops` and the round-9 detailed-rim test.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts`
   - Evidence: the new test and all existing tests pass. The timing test "builds
     20,000 CAD elements in under 1,000 ms" follows rule 6.

## Done criteria

- `scene.ts` contains no floating-point interpolation, `x < ax + ((bx - ax)`.
- The pre-fix failing log and the post-fix passing log exist, and command 1 exits
  0.
- `git diff --name-only` for this plan stays inside its writePaths, and the
  progress log reads `done`.

## Implementation status

Implementation and the focused gate are complete; formal review and integration
verification remain downstream. See `impl-plans/progress/car10-p3-scene-grid-ancestry.md`.
