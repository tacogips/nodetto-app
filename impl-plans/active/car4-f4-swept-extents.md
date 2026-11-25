# car4-f4-swept-extents

- planId: car4-f4-swept-extents; wave 1; dependsOn: none
- planPath: impl-plans/active/car4-f4-swept-extents.md
- progressPath: impl-plans/progress/car4-f4-swept-extents.md
- Finding: performance-cad-repeated-swept-extent-scans (R4-4, medium).
- Design: `design-docs/specs/design-cad3d.md` section 21 R4-4.
- writePaths: `packages/core/src/cad/bounds.ts`, `packages/core/src/cad/history.ts`,
  `packages/core/src/cad/check.test.ts`, `packages/core/src/cad/history.test.ts`,
  `tmp/car4-r4/car4-f4-swept-extents`, `impl-plans/progress/car4-f4-swept-extents.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car4-00-overview.md`.

## Intent and context

`withinExtent` (`history.ts:405-430`) projects every selected vertex per extrusion, and
`checkCadPage` (`check.ts:47-49`) projects them again in `sweptBounds`
(`bounds.ts:43-79`). A 1,000-edge outline with 1,000 distances made 6,014,121
`Math.abs` calls. Project each loop once per resolved frame and reuse the extrema.

Non-goals: no change to `check.ts`, `scene.ts`, error codes/messages/precedence,
`ExtrudeGeometry`, rounding, or the 10,000 mm bound (`CAD_MAX_EXTENT_MM + 1e-9`).
f8 edits `history.ts` after this plan; touch only `withinExtent` there.

## Changes

- `bounds.ts`:
  - `export const cadBoundsWork = { vertexProjections: 0 }`.
  - `export function loopExtents(points: ArrayLike<number>, frame: CadFrame): { min:
    Vec3; max: Vec3 }`: per vertex compute `o[k] + u[k] * x + v[k] * y` for k = 0..2 in
    exactly this evaluation order (as both current loops do), increment
    `vertexProjections` once per vertex, return per-axis min and max.
  - Memoise in a module `WeakMap<object, { frame: CadFrame; min: Vec3; max: Vec3 }>`
    keyed by the `points` array; a different frame object recomputes and replaces.
  - `sweptBounds`: keep the constant-axis branch (`alongX === 0 && alongY === 0` ->
    `origin`); for other axes take `lower`/`upper` as the min/max over loops of
    `loopExtents` results. Result values must be bit-equal to today.
- `history.ts` `withinExtent`: per loop get `loopExtents`; for each axis and each `t` in
  `{t0, t1}` require `Math.abs(min + n * t) <= bound` and `Math.abs(max + n * t) <=
  bound`. Exact: the extreme vertices give the same floats and `fl(b + c)` is monotonic
  in `b`.

## Pitfalls

- Loop `points` arrays are immutable after `buildLoops`; never mutate them.
- Do not round or reorder the projection expression; do not cache across frames by
  value.
- `cad.limit` must be raised at the same place with the same message.

## Tests

- `check.test.ts`: a valid 1,000-edge outline sketch extruded once and 1,000 times with
  distinct distances; reset `cadBoundsWork.vertexProjections` before each
  `checkCadPage`; the two counts are equal (fails before: counter absent / grows with
  extrusions). Bounds equal an oracle copy of the old `sweptBounds` for positive,
  negative, symmetric and tilted (face-frame) extrusions.
- `history.test.ts`: a vertex exactly at 10,000 mm passes; one at 10,000 mm + 2e-9
  fails with `cad.limit`; a failing entity still reports before `cad.limit`.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/cad/bounds.ts packages/core/src/cad/history.ts packages/core/src/cad/check.test.ts packages/core/src/cad/history.test.ts && bun test packages/core/src/cad/check.test.ts packages/core/src/cad/history.test.ts packages/core/src/capture/determinism.test.ts`
   -> new counter and boundary tests pass; capture determinism bytes unchanged.

## Done criteria

Implementation complete; formal review and integration gates remain downstream.

- Projections independent of extrusion count; bounds bit-equal to oracle; boundary and
  precedence asserted; progress log `done`.
