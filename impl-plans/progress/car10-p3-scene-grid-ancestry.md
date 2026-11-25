# car10-p3-scene-grid-ancestry progress

Status: done (implementation phase; formal reviews and integration pending).

- Capture ancestry uses nanometre grids for bounds, buckets, query points and lazy edge indexes, with `gridCross`. Original millimetre loops and order remain intact.
- The independent oracle uses BigInt determinants. Both cyclic triangle starts retain [3, 4] and differ from the solid control. The determinant is 1n.
- Before the fix, the focused new regression failed with [4]; see `tmp/car10-r10/car10-p3-scene-grid-ancestry/pre-fix.log`.
- Solid control SHA-256: `4e79a49509e7e31ca09f07bc252b57affc87f814f798a5d13b22584843ca93b0`; see `tmp/car10-r10/car10-p3-scene-grid-ancestry/control-digest.log`.
- `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts`: exit 0, 35 passed, 0 failed; see `tmp/car10-r10/car10-p3-scene-grid-ancestry/verification.log`.
- Workspace typecheck, lint, verification and release parity run at integration as required by dispatch. Formal review and commit are downstream.
