# fv-41-zorder-conformance

- planId: fv-41-zorder-conformance
- planPath: impl-plans/active/fv-41-zorder-conformance.md
- progressPath: impl-plans/progress/fv-41-zorder-conformance.md
- wave: 5
- dependsOn: fv-11-zorder-model
- Design: sections 5 (D3), 7, 10 (z-order regressions).
- writePaths: `packages/core/src/z-order.ts`, `packages/core/src/z-order.test.ts`,
  `packages/core/src/z-order.formal.test.ts`,
  `impl-plans/progress/fv-41-zorder-conformance.md`, `tmp/fv-s942/fv-41-zorder-conformance`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Fix D3 (an `order` with a duplicate id is not refused) and tie `z-order.ts` to the
Lean vectors.

## Changes

- `packages/core/src/z-order.ts` `reorderCommands`: after computing `target` (unknown
  ids already filtered), also return `[]` when `new Set(target).size !== target.length`.
  Nothing else.
- `packages/core/src/z-order.test.ts`: append the D3 regression.
- `packages/core/src/z-order.formal.test.ts` (new): read
  `formal/vectors/z-order.json` (relative URL as in fv-40), typed guard; build elements
  with the `page`/`element` helpers style of `packages/core/src/z-order.test.ts`
  (each vector element `[id, key]` becomes an element with that id and `index`);
  call `targetOrder(ordered, new Set(selected), action)`,
  `relativeOrder(ordered, new Set(moved), new Set(anchorBlock), side)` and
  `reorderCommands(elements, order, rng)` with the B2 rng; compare ids exactly and
  map commands to `[id, index]`; `error` -> expect a thrown `RangeError`.

## Tests

- Elements `a`, `b` with order `["a","a"]` -> `[]` (fails before: two commands).
- The existing test with `["unknown","b","a"]` still passes unchanged.
- Every vector case matches.

## Pitfalls

- Do not change `targetOrder`, `relativeOrder`, `planZOrder`, `planElementOrder`.
- Element ids in vectors are plain JSON strings; use them as given.

## Acceptance criteria

- [x] All tests pass; the D3 regression failed before the fix (`before.log`).

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.ZOrder.Model > ../tmp/fv-s942/fv-41-zorder-conformance/build.log 2>&1`
2. `bun test packages/core/src/z-order.formal.test.ts packages/core/src/z-order.test.ts > tmp/fv-s942/fv-41-zorder-conformance/test.log 2>&1`
3. `bunx biome check packages/core/src/z-order.ts packages/core/src/z-order.test.ts packages/core/src/z-order.formal.test.ts`
