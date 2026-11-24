# car1-j-cad-ui-strict: CAD UI compiles under noUncheckedIndexedAccess (F3)

- planId: car1-j-cad-ui-strict. Wave 1. dependsOn: none. Gate: none.
- Design: `design-docs/specs/design-cad3d.md` 19 F3.
- Progress log: `impl-plans/progress/car1-j-cad-ui-strict.md`.

## Intent

The hosted web app and the sync Worker compile the CAD UI with
`noUncheckedIndexedAccess`. The 63 diagnostics rooted at
`packages/ui-solid/src/cad-ui.tsx` must reach 0, and an automated test
must enforce it.

## Non-goals

- Do not change `tsconfig*.json`.
- Do not touch `CadSection.tsx`, `cad-edits.ts` (plan k), `pcb-insert.ts`,
  `board-picker.tsx` (plans d and d2) or `stl-import.tsx`.
- No behaviour change beyond explicit handling of a missing value.

## Changes

- Fix the indexed reads in `packages/ui-solid/src/cad/`:
  - `pick.ts` (19);
  - `theme.ts` (3);
  - `renderer.ts` (8);
  - `sketch-overlay.ts` (22);
  - `sketch-authoring.ts` (1);
  - `extrude-interaction.ts` (8);
  - `CadViewport.tsx` (2).
- Use typed tuples or checked accessors where geometry guarantees a value
  (three triangle corners, sixteen matrix entries). Imitate the
  `coordinate(points, i)` helper in `packages/core/src/cad/vec.ts`.
- Where a buffer or selection can be incomplete, return early or skip.
- New `packages/ui-solid/src/cad/strict-index.test.ts`:
  - read the options of `tsconfig.json` with
    `ts.readConfigFile` and `ts.parseJsonConfigFileContent`;
  - set `noEmit: true` and `noUncheckedIndexedAccess: true`;
  - create a program rooted at `packages/ui-solid/src/cad-ui.tsx`;
  - assert that `ts.getPreEmitDiagnostics` is empty, and print the first
    ten diagnostics on failure.

  Before the fix it reports 63.

## Pitfalls

- No non-null assertion (`!`) may hide a reachable missing case. Use `!`
  only where the type system cannot see an invariant, and leave a
  one-line comment there.
- Keep the hot loops allocation-free: no `.at()` wrappers that allocate,
  and no per-vertex array destructuring in render loops.
- The test resolves paths from `import.meta.dir`. It must not depend on
  the working directory.

## Tests

- `strict-index.test.ts`: 0 diagnostics.
- The adjacent tests pass unchanged:
  - `pick.test.ts`;
  - `theme.test.ts`;
  - `sketch-overlay.test.ts`;
  - `extrude-interaction.test.ts`;
  - `sketch-interaction.test.ts`;
  - `camera3d.test.ts`;
  - `viewport.test.tsx` (DOM runs).

## Verification

1. `biome check packages/ui-solid/src/cad/pick.ts packages/ui-solid/src/cad/theme.ts packages/ui-solid/src/cad/renderer.ts packages/ui-solid/src/cad/sketch-overlay.ts packages/ui-solid/src/cad/sketch-authoring.ts packages/ui-solid/src/cad/extrude-interaction.ts packages/ui-solid/src/cad/CadViewport.tsx packages/ui-solid/src/cad/strict-index.test.ts && bun test packages/ui-solid/src/cad/strict-index.test.ts packages/ui-solid/src/cad/pick.test.ts packages/ui-solid/src/cad/theme.test.ts packages/ui-solid/src/cad/sketch-overlay.test.ts packages/ui-solid/src/cad/extrude-interaction.test.ts packages/ui-solid/src/cad/sketch-interaction.test.ts packages/ui-solid/src/cad/camera3d.test.ts`
   must exit 0.
2. `bun run typecheck && bun test packages/ui-solid/src/cad/viewport.test.tsx`
   must exit 0, with the `ok light` and `ok dark` DOM markers. This run
   may pick up plan k's in-progress `cad-sketch.dom.tsx`. If it fails only
   there, rerun after k lands and record it.

## Done when

- [x] 0 strict diagnostics, enforced by the test.
- [x] The adjacent tests pass.
- Formal review and integration are downstream workflow steps.
