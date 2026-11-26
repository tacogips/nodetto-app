# schematic-17-core-move-contract progress

## Start (UTC)
2026-11-25 20:12 UTC. Dependencies schematic-02 and schematic-09 accepted by dispatch. Plan matches design 3.3 moves.

## Files
Pre-edit and final SHA-256 hashes are recorded in `tmp/schematic-s933/schematic-17-core-move-contract/pre-hashes.txt` and `final-source-hashes.txt`. The new test and this progress file did not exist before this work. Intent snapshots and intermediate hashes are in the same evidence directory.

## Commands
- `bunx biome check --write packages/core/src/editor/facade/element-editing.ts packages/core/src/editor/facade/selection-editing.ts packages/core/src/editor/schematic-move.test.ts`: exit 0, `format.log`.
- `bun test packages/core/src/editor/schematic-move.test.ts packages/core/src/editor.test.ts`: exit 0, 16 pass, 0 fail, `tests.log`.
- `bunx biome check packages/core/src/editor/facade/element-editing.ts packages/core/src/editor/facade/selection-editing.ts packages/core/src/editor/schematic-move.test.ts`: exit 0, `biome.log`.

## Drift
No competing edits observed in owned sources. Source diffs reviewed after formatting; final hashes recorded. Typecheck is deferred to the serial integration gate as required by the plan dispatch.

## Sibling diagnostics
None observed.

## Open issues
None for this plan. Formal integrity and adversarial review and serial integration belong to downstream workflow steps.

## Done checklist
- [x] Schematic absolute move destinations use canonicalTarget; other types remain unchanged.
- [x] Schematic nudges use shiftedTarget with the shared delta; wire points remain offsets.
- [x] Regression tests cover the negative tie, absolute target, and non-schematic behavior; existing editor tests pass unchanged.
- [x] Focused test and Biome gates pass.
