# fv-47-overlap-conformance

- planId: fv-47-overlap-conformance
- planPath: impl-plans/active/fv-47-overlap-conformance.md
- progressPath: impl-plans/progress/fv-47-overlap-conformance.md
- wave: 4
- dependsOn: fv-17-overlap-model
- Design: sections 5 (exports), 6.8, 7 (overlap row and conformance rule).
- writePaths: `packages/core/src/cad/loops.ts`, `packages/core/src/cad/loops.formal.test.ts`,
  `impl-plans/progress/fv-47-overlap-conformance.md`, `tmp/fv-s942/fv-47-overlap-conformance`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Export `overlappingPairs` and tie it to the Lean vectors through its observable
behaviour (tree signal and ordered visits).

## Changes

- `packages/core/src/cad/loops.ts`: add `export` to `function overlappingPairs`
  (line 237). Nothing else; do not re-export it from any index.
- `packages/core/src/cad/loops.formal.test.ts` (new): read
  `new URL("../../../../formal/vectors/overlap.json", import.meta.url)`, typed guard;
  boxes `[minX,minY,maxX,maxY]` become `Bounds` objects; call
  `overlappingPairs(boxes, visit, count, undefined, crowded)` with a recording `visit`,
  a no-op `count`, and `crowded` recording that it was called and returning `true`;
  assert `crowded` was called exactly when `out.ok.tree`, and the visit list equals
  `out.ok.visits` in order.

## Pitfalls

- `Bounds` is a module-private interface; build objects with the four fields and
  type them through the function's parameter type
  (`Parameters<typeof overlappingPairs>[0]`).
- Do not re-implement the branch selector in the test.

## Tests

- Every vector case matches, including the axis-discriminating and tree cases.

## Acceptance criteria

- [x] The test passes; `loops.test.ts` passes unchanged.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Overlap.Model > ../tmp/fv-s942/fv-47-overlap-conformance/build.log 2>&1`
2. `bun test packages/core/src/cad/loops.formal.test.ts packages/core/src/cad/loops.test.ts > tmp/fv-s942/fv-47-overlap-conformance/test.log 2>&1`
3. `bunx biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.formal.test.ts`
