# slc-04 open path rendering progress

Intent and per-edit before/after evidence: `tmp/shape-lateral-s544/slc-04-open-path-render/intent-*.txt`. The accepted design section 4 and plan agree; slc-01 is accepted by dispatch. Changes separate open and closed geometry, render open strokes without fill, restrict picking to strokes, and omit open contours from region consumers. No changes were made to compound-path-edit.ts or compound-path.test.ts. Scoped Biome formatting followed the edits; final hashes are in `tmp/shape-lateral-s544/slc-04-open-path-render/final-hashes.txt`.

Verification on the moving shared tree:
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/open-path.test.ts packages/core/src/compound-path.test.ts packages/core/src/svg-export.test.ts`: exit 0, 64 passed, 0 failed, `tmp/shape-lateral-s544/slc-04-open-path-render/core.log`.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core`: exit 1, 1426 passed, 4 skipped, 1 failed, `tmp/shape-lateral-s544/slc-04-open-path-render/core-all.log`; sibling slc-03's actor catalogue addition conflicts with the existing expectation in `packages/core/src/shape-catalogue.test.ts`.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid`: exit 1, 583 passed, 1 failed, `tmp/shape-lateral-s544/slc-04-open-path-render/ui.log`; sibling slc-03's actor addition conflicts with `packages/ui-solid/src/shape-search.test.ts`.
- `bunx tsc -p tsconfig.json --noEmit`: exit 2, `tmp/shape-lateral-s544/slc-04-open-path-render/tsc.log`; errors in sibling files `packages/io/src/drawio/drawio.test.ts` and `packages/ir/src/validate.test.ts`.
- `bunx biome check packages/core/src/shapes/compound-path.ts packages/core/src/svg-export/shapes.ts packages/core/src/boolean-operations.ts packages/core/src/pcb-export.ts packages/core/src/mobile-code/swift-modifiers.ts packages/core/src/mobile-code/compose-modifiers.ts packages/ui-solid/src/shapes/CompoundPathView.tsx packages/core/src/open-path.test.ts`: exit 0, `tmp/shape-lateral-s544/slc-04-open-path-render/biome.log`.
- `git diff --check -- packages/core/src/shapes/compound-path.ts packages/core/src/svg-export/shapes.ts packages/core/src/boolean-operations.ts packages/core/src/pcb-export.ts packages/core/src/mobile-code/swift-modifiers.ts packages/core/src/mobile-code/compose-modifiers.ts packages/ui-solid/src/shapes/CompoundPathView.tsx`: exit 0, `tmp/shape-lateral-s544/slc-04-open-path-render/diff-check.log`.

Shared gates require sibling repairs and rerun on the joined tree. Formal reviews and git finalization are downstream.

Current-source reruns (logs under `tmp/shape-lateral-s544/slc-04-open-path-render/`):
- Focused core command: exit 0, 64 passed, 0 failed, `core-rerun.log`.
- Core aggregate: exit 0, 1427 passed, 4 skipped, 0 failed, `core-all-rerun.log`.
- UI aggregate: exit 0, 584 passed, 0 failed, `ui-rerun.log`.
- Typecheck: exit 0, `tsc-rerun.log`.
- Scoped Biome: exit 0, `biome-rerun.log`.
- Shared-input gates remain pending serial join because slc-03 and slc-05 progress logs do not yet end in STATUS: done. Earlier failures above are superseded by these reruns.
- Source hashes match the pre-node snapshot; no source was overwritten in this continuation. Formal reviews and git finalization remain downstream.
STATUS: done
