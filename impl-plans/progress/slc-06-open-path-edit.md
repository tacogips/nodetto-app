# slc-06-open-path-edit progress

Intent: carry closed state inside each world contour through anchor dragging, inspector edits, and contour removal; serialize only open flags. Add regression coverage for both minima and rotated dragging.

Pre-edit SHA-256: see `tmp/shape-lateral-s544/slc-06-open-path-edit/pre-edit.sha256`.
Final source SHA-256: see `tmp/shape-lateral-s544/slc-06-open-path-edit/final.sha256`.
Per-edit intentions and readbacks are in the same evidence directory.

Verification:
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/compound-path.test.ts packages/core/src/open-path.test.ts packages/core/src/pcb-import.test.ts`: exit 0, 19 passed, 0 failed; `core.log`.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid`: exit 0, 584 passed, 0 failed; `ui.log`. Pending serial join: slc-07 progress not yet done.
- `bunx tsc -p tsconfig.json --noEmit`: exit 0; `tsc.log`. Pending serial join: slc-07 progress not yet done.
- `bunx biome check packages/core/src/compound-path-edit.ts packages/core/src/index.ts packages/core/src/compound-path.test.ts packages/ui-solid/src/CompoundPathHandles.tsx packages/ui-solid/src/inspector/PathSection.tsx`: exit 0; `biome.log`.
- `grep -c 'export interface PathWorldContour' packages/core/src/compound-path-edit.ts`: exit 0, count 1; `grep-interface.log`.
- `grep -c 'splitStrokeSegment(points(), pointIndex(), true)' packages/ui-solid/src/inspector/PathSection.tsx`: exit 1, count 0 as expected; `grep-split.log`.
- `git diff --check` on owned source files: exit 0; `diff-check.log`.

All implementation criteria are met. Formal reviews and combined-tree gates belong to the downstream workflow.

STATUS: done
