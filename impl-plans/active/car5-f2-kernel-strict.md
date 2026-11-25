# car5-f2-kernel-strict

- planId: car5-f2-kernel-strict; wave 1; dependsOn: none
- planPath: impl-plans/active/car5-f2-kernel-strict.md
- progressPath: impl-plans/progress/car5-f2-kernel-strict.md
- Finding: function-cad-kernel-strict-indexed-reads (R5-2, medium).
- Design: `design-docs/specs/design-cad3d.md` 22 R5-2.
- writePaths: `packages/cad-kernel/src/manifold-kernel.ts`,
  `packages/cad-kernel/src/manifold-kernel.test.ts`,
  `packages/ui-solid/src/cad/strict-index.test.ts`,
  `tmp/car5-r5/car5-f2-kernel-strict`, `impl-plans/progress/car5-f2-kernel-strict.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d` (`worker-host.test.ts` writes
  `tmp/cad3d/m7/roundtrip.log`).

Follow the worker rules in `impl-plans/active/car5-00-overview.md`.

## Intent and context

`mesh()` in `manifold-kernel.ts:116-153` reads Manifold buffers by index. Rooted at
`packages/cad-kernel/src/index.ts` and `worker.ts`, a program with
`noUncheckedIndexedAccess` has seven diagnostics (lines 121, 122, 125, 128, 148-150).
Truncated buffers can also skip required reads entirely (numProp 3 fast path; loop
bounds taken from truncated arrays).

Non-goals: no change to `index.ts` exports, worker protocol, compiler settings, evaluator
error mapping, or valid output.

## Changes (`manifold-kernel.ts`)

- New module-level, test-exported (not re-exported from `index.ts`):
  `export function readManifoldMesh(mesh: ManifoldMeshBuffers, namesOf: (original: number) => readonly string[] | undefined): KernelMesh`
  where `ManifoldMeshBuffers` is a structural interface of `numProp: number`,
  `vertProperties: Float32Array`, `triVerts: Uint32Array`, `runIndex: Uint32Array`,
  `runOriginalID: Uint32Array`, `faceID: Uint32Array` (match the installed
  `manifold-3d` getMesh field types).
- `mesh(handle)` becomes `readManifoldMesh(get(handle).solid.getMesh(), (original) => sources.get(original)?.names)`.
- Coverage checks first, before the `numProp === 3` fast path and any loop; each failure
  throws `new Error("Invalid Manifold mesh data: <what failed>")`:
  - `numProp` integer >= 3; `vertProperties.length % numProp === 0`;
  - `triVerts.length % 3 === 0`; every `triVerts` value < `vertProperties.length / numProp`;
  - only when `triVerts.length > 0`: `runIndex.length === runOriginalID.length + 1`,
    `runIndex[0] === 0`, last entry `=== triVerts.length`, entries non-decreasing
    multiples of 3, `faceID.length === triVerts.length / 3`.
- Empty `triVerts`: output as today (positions converted from the checked buffer, empty
  triangles/triFace/faceNames); run arrays not inspected.
- A local helper `at(array, index, field): number` returns the value or throws
  `Invalid Manifold mesh data: missing <field> at <index>`; use it for run bounds,
  original ids, face ids and coordinates so the file compiles strictly. No `!`.
- Keep `Missing Manifold face <original>/<faceId>` for a present face id without a name.
- Keep run order, first-seen face order and zero-length-run skipping.

## Pitfalls

- Do not drop the fast path; just validate before it, so valid bytes are identical.
- Do not wrap errors into `SolidFailure` or change caller handling.
- Do not change compiler options in `strict-index.test.ts`; only extend roots.

## Tests

`strict-index.test.ts`: roots become `cad-ui.tsx`,
`packages/cad-kernel/src/index.ts`, `packages/cad-kernel/src/worker.ts` (one program;
rename the test title to cover all three). Before: 7 diagnostics; after: "".

`manifold-kernel.test.ts` (buffer literals into `readManifoldMesh`):
- `triVerts [0,1,2]`, numProp 3, 8 properties -> throws `Invalid Manifold mesh data`.
- `triVerts [0,1,2]`, numProp 4, 9 properties -> throws.
- nonempty triVerts, `runOriginalID []`, `runIndex [0, 3]` -> throws.
- `runIndex` one entry short -> throws; short `faceID` -> throws.
- valid empty mesh -> empty triangles/triFace/faceNames.
- valid two-run buffer with a zero-length run -> expected positions, triangle order,
  triFace and faceNames.
- present face id without a name -> throws `Missing Manifold face`.
- Existing real-Manifold provenance and measurement tests unchanged.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/cad-kernel/src/manifold-kernel.ts packages/cad-kernel/src/manifold-kernel.test.ts packages/ui-solid/src/cad/strict-index.test.ts && bun test packages/ui-solid/src/cad/strict-index.test.ts packages/cad-kernel/src/manifold-kernel.test.ts packages/cad-kernel/src/worker-host.test.ts`
   - evidence: strict test fails before with 7 diagnostics (log), zero after; truncation
     cases pass; worker-host tests pass (real Manifold output meets the checks).

A strict diagnostic in a sibling's in-progress file (`describe.ts`, `history.ts`,
`evaluate.ts`, `pcb-outline.ts`) is rerun after that sibling is `done` (rule 11).

## Done criteria

- Zero strict diagnostics for three roots; all cases pass; progress log `done`.

## Implementation status

- Done: strict diagnostics are zero for all three roots; buffer regressions and focused gate passed (15 tests). See `impl-plans/progress/car5-f2-kernel-strict.md`.
- Formal review and workspace integration verification remain downstream.
