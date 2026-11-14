# Plan 09 progress: core import layout

Implemented `layoutBreadboardImport` in `packages/core/src/breadboard/import-layout.ts` and exported it from the breadboard barrel. The deterministic document contains a half board, target netlist card, then staged parts in plan order. Part pin 1 is placed on the 10-unit lattice, boxes wrap at 66 pitches, and row spacing uses the tallest box. Per-type parameter allowlists retain supported fields and drop unknown keys. The document ID and fractional indexes are deterministic.

Added five focused tests covering element/page/card contract, lattice placement below the board, 30-part wrapping and row clearance, serialization stability plus IR validation, and unknown-parameter filtering.

## Current-source verification

- `bun test packages/core/src/breadboard/import-layout.test.ts`: exit 0; 5 passed, 0 failed; `tmp/breadboard-mode-s485/breadboard-09-core-import-layout/focused-final.log`.
- `bun test packages/core`: exit 0; 1161 passed, 4 skipped, 0 failed; `tmp/breadboard-mode-s485/breadboard-09-core-import-layout/core-final.log`.
- `bun run typecheck`: exit 2; diagnostics are confined to sibling in-progress breadboard files (`board-carry.ts`, `connectivity.ts`, `snap.ts`, `test-builder.ts`, `editor.ts`, `shapes/breadboard.ts`); no plan-09 source or test diagnostics. Complete log: `tmp/breadboard-mode-s485/breadboard-09-core-import-layout/typecheck-final.log`.
- Plan G1 own-file grep against that typecheck log: exit 0, no diagnostics; `tmp/breadboard-mode-s485/breadboard-09-core-import-layout/g1-ownregex-final.log`.
- `bunx biome check packages/core/src/breadboard/import-layout.ts packages/core/src/breadboard/import-layout.test.ts`: exit 0; `tmp/breadboard-mode-s485/breadboard-09-core-import-layout/biome-final.log`.
- Barrel count, ASCII source/progress, and diff checks are recorded under the same evidence directory.

The workspace typecheck remains an integration blocker for concurrent sibling work; it is not a plan-09 owned-file failure. Re-run workspace typecheck after sibling core plans reconcile.

## Done criteria status

- Barrel export is present exactly once: pass.
- Focused behavior and full core suite pass: 5/0 focused; 1161 passed, 4 skipped, 0 failed in core.
- G1 plan-owned typecheck scope is clean: pass; workspace typecheck remains exit 2 on sibling diagnostics and is pending integration.
- Changed-file Biome and ASCII gates pass.
- Implementation is complete for plan 09; the workspace-wide typecheck must be rerun after sibling core work is reconciled.
