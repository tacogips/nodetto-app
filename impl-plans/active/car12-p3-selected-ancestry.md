# car12-p3-selected-ancestry

- planId: car12-p3-selected-ancestry; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car12-p3-selected-ancestry.md
- Finding: `performance-capture-selected-loop-ancestry-work` (high).
- Design: `design-docs/specs/design-ai-capture.md` 29.1 R12-3. Follow the
  worker rules in `car12-00-overview.md`. Evidence:
  `tmp/car12-r12/car12-p3-selected-ancestry/`.

## Intent and context

`normaliseToolLoops` (`packages/core/src/capture/scene.ts:213-276`) searches
every lower depth for each contour. It makes uncounted lookups of missing
depth buckets (D x S of them) and merges the oversized list on every probe
(N^2 / 2). Keep that path for ordinary input. Past a linear budget, abandon it
and use `loopForest` once.

Non-goals:
- Do not change `loops.ts`, `loop-forest.ts`, `cad-request.ts` or the
  `CadCaptureRequest` API.
- Do not reorder normalization and `chargeTool` (`:435-438`).
- No byte changes.

## Changes (`packages/core/src/capture/scene.ts`)

- The `normaliseToolLoops` stats type gains optional `depthLookups?: number`,
  `forestFallbacks?: number` and `forest?: ForestStats` (import the type from
  `../cad/loop-forest.ts`). Existing fields are unchanged.
- Add `const ANCESTRY_WORK_PER_VERTEX = 32`.
  - The budget is that constant times the total vertex count of `loops`.
  - Work is `depthLookups + ancestorProbes + indexEntries + edge builds,
    visits, inspections and bulk`. It is counted in a local counter even
    without `stats`; pass a local `EdgeIndexStats` to `containsPoint` and
    add it into `stats.edges` when present.
  - Every iteration of the `k` loop is a depth lookup, missing buckets
    included.
- Keep the all-depth-zero early return first.
- When the work exceeds the budget:
  - abandon the first path and increment `forestFallbacks`;
  - call `loopForest(grids, windings, stats?.forest)` once, with the already
    rounded grids of every loop and `windings` all `1` (every `CadLoop` is
    counter-clockwise: `loops.ts:447-449`, `:648`);
  - `ancestorDepth = parents[i] === -1 ? -1 : loops[parents[i]].depth`;
  - keep the same filter, `depth === 0 || (depth - ancestorDepth) % 2 === 1`,
    in input order.
- `CaptureWalkStats` gains optional `ancestry?:` (the normalise stats type).
  `buildCadCaptureModel` passes `stats?.ancestry` to `normaliseToolLoops` in
  the `tool` callback.

Pitfalls:
- Do not change the abandoned path's retained result. It must be decided
  either fully by the old path or fully by the forest.
- Do not walk parent chains.
- Grids come from `Math.round(v * NM_PER_MM)`, the existing expression; do
  not add another.
- `loops[parents[i]]` must be a safe indexed read.

## Tests (`packages/core/src/capture/scene.test.ts`)

- Document fixtures (each within the 20,000-record page limit).
  - Deep. One XY sketch with D nested squares and S unit islands inside the
    innermost square, with D even. One `new` 5 mm extrusion selects only the
    islands' members through `loops`. D = S = 256, 512 and 1024.
  - Deep variant. D = S = 256, with the outermost square also selected ->
    only that square is retained.
  - Shallow. N slanted oversized quadrilateral rims, each with one square
    hole. One extrusion selects all loops. N = 1024 and 2048.
- Production work.
  - `buildCadCaptureModel(elements, page, { stats })` with
    `stats.ancestry`.
  - Total work = `depthLookups + ancestorProbes + indexEntries + edge work
    + forest.events + forest.steps`. At most 2.5x per doubling.
  - `forestFallbacks >= 1` at every size.
  - Fails before (about 4x).
- Helper doubling: `normaliseToolLoops` on the shallow raw loops at N = 1024,
  2048 and 4096 also stays within 2.5x.
- Full-scene oracle, for each deep size, the deep variant and each shallow
  size.
  - Run `prepareCadCapture` (top view, 256 x 256, no interference). Keep
    `scene` and `model`.
  - Expected loops: `buildLoops(sketch entities, selection)`, then the
    file's existing `oracleNormalise`.
  - Expected model: `{ ...model }`, with each prism tool's `loops` rebuilt
    from the oracle loops. Points go into a `Float64Array`. Face IDs are
    `2 + n` in first-appearance order of the source IDs, mirroring
    `makeTool` without calling it.
  - `writeCaptureScene(expected, options)` must equal `scene` byte for byte.
    `options` is built as at `cad-request.ts:190-198`:
    - `width: request.width`, `height: request.height`;
    - the literal `supersample: 2`;
    - the returned `camera`;
    - `colours: CAPTURE_THEMES[request.theme]`;
    - `referenceOpacity: 0.45`;
    - `interference: null`.
  - Each body's bounds equal the test's own XY min and max of the oracle
    points, with Z 0..5.
- Ordinary baseline.
  - `buildCadCaptureModel` on
    `generateCadDocument({ features: 500, entitiesPerSketch: 18 })` with
    `stats.ancestry`.
  - `forestFallbacks === 0`, and `ancestorProbes` and `indexEntries` equal
    the pre-change measured values (audit 5,000 and 5,500); pin the
    literals.
  - Record `depthLookups`.
- Existing ancestry, grid, slotted and ray-origin tests stay unedited,
  including their exact `ancestorProbes` counts. If one crosses the budget,
  stop as `blocked` with the counts. Do not raise the constant.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts`
2. `bun test packages/core/src/capture/scene.test.ts packages/core/src/cad/loop-forest.test.ts`
   - The new tests pass, and the series and baseline are logged.
   - Also save a fail-before log of the deep and shallow doubling tests
     (`tmp/car12-r12/car12-p3-selected-ancestry/fail-before.log`).

## Done criteria

- Commands 1-2 exit 0.
- `git diff --name-only` stays inside writePaths, and the progress log
  reads `done`.

## Implementation status

Implemented and focused gates passed; see `impl-plans/progress/car12-p3-selected-ancestry.md` for hashes, counters and logs. Formal review and integration gates remain with the downstream workflow.
