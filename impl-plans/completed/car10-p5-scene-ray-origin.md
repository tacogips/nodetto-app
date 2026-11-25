# car10-p5-scene-ray-origin

- planId: car10-p5-scene-ray-origin; wave 2; dependsOn: car10-p3-scene-grid-ancestry,
  car10-p4-edge-index-ray-origin
- progressPath: impl-plans/progress/car10-p5-scene-ray-origin.md
- Finding: performance-cad-containment-crossings-outside-ray (high), capture
  ancestor pass.
- Design: `design-docs/specs/design-ai-capture.md` 28.1 R10-2. Follow the overview
  worker rules. Evidence: `tmp/car10-r10/car10-p5-scene-ray-origin/`.

## Intent and context

After p3, `containsPoint` in `packages/core/src/capture/scene.ts` runs the grid
predicate on every edge that `forEachEdgeAtY` reports, including crossings behind
the query vertex. This plan switches it to p4's `crossingParity` and removes
`forEachEdgeAtY`, which then has no callers.

Non-goals:
- Do not change the grid conversion, bounds, bucket grid or predicate from p3.
- Do not edit `loops.ts` or `loops.test.ts`.
- No change to the kept loops, their order, NCS1, goldens or public types.

## Changes

- `packages/core/src/capture/scene.ts`: `containsPoint` returns
  `crossingParity(entry.edges, x, y, exact, stats)`. Here `exact(edge)` is p3's
  grid predicate on `entry.grid`, and the index is built lazily as now. Import
  `crossingParity` instead of `forEachEdgeAtY`.
- `packages/core/src/cad/edge-y-index.ts`: delete `forEachEdgeAtY`. First confirm
  with `rg -n forEachEdgeAtY packages apps` that only the definition remains.
  Change nothing else.

Pitfalls:
- Pass grid integers, not millimetres. p3's predicate is what makes X pruning
  exact.
- Keep the lazy build after the box test.

## Tests (`packages/core/src/capture/scene.test.ts`, append; existing tests unedited)

- Helper: add `sceneBytesOfPoints(points: readonly (readonly number[])[]): Uint8Array`
  using the same `writeCaptureScene` arguments as `indexedSceneBytes`. Make
  `indexedSceneBytes` delegate to it. The output must stay identical.
- Fixture: the same slotted rim as p4 (design 28.1 R10-2), built with
  `cadElement(id, "cad.line", "a1", { sketch: "profile", a, b })` and the same id
  contract: `a${pad5(j)}` for plate lines and `h${pad5(k)}-${j}` for holes, both
  orientations.
- New "normalisation resolves slotted-rim holes without scanning crossings behind
  the ray" (fail-before evidence). For each orientation and
  (T, H) in {(256,256), (512,256), (256,512), (512,512)}:
  - `loops = selectedLoops(entities)`, with
    `stats = { ancestorProbes: 0, indexEntries: 0, edges: { builds: 0, visits: 0, inspections: 0, bulk: 0 } }`,
    and `actual = normaliseToolLoops(loops, stats)`.
  - Expected list, built only from the vertex lists: the plate, then holes
    k = 0..H-1. The original orientation uses each list as given; a mirrored list
    is `v0, v(n-1), ..., v1`.
  - Assert:
    - `actual.map((l) => [...l.points])` equals the expected lists;
    - `indexedSceneBytes(actual)` equals `sceneBytesOfPoints(expected)`;
    - `actual` equals `oracleNormalise(loops)` element-wise (`toBe`).
  - Counter bounds as in p4: `q <= 16 * H * Math.log2(4 * T + 4)`, the T-doubling
    ratio `<= 1.5`, the both-doubling ratio `<= 2.5`, and `builds <=` the total
    vertex count of `loops`.
  - Before the fix, `bulk` stays 0 and the bounds fail. Record that log.
- The round-9 test "normalisation queries the detailed rim through one edge index"
  and all other existing tests pass unedited.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/core/src/cad/edge-y-index.ts packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts packages/core/src/cad/loops.test.ts`

## Done criteria

- `rg -n forEachEdgeAtY packages apps` finds nothing, and `scene.ts` calls
  `crossingParity`.
- The pre-fix failing log and the post-fix passing log exist, and command 1 exits
  0.
- `git diff --name-only` for this plan stays inside its writePaths, and the
  progress log reads `done`.

## Implementation status

Done: scene parity uses the grid ray origin, the obsolete query is removed, and
focused regression and verification evidence is in the progress record. Formal
review and integration gates remain downstream.
