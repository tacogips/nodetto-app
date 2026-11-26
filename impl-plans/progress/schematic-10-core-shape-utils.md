# schematic-10-core-shape-utils progress

## Start

2026-11-26 UTC. Dependency schematic-08-core-symbols is accepted by dispatch; design section 4.3 matches the plan.

## Files

Pre-edit and final hashes are recorded in `tmp/schematic-s933/schematic-10-core-shape-utils/pre-hashes.txt` and `final-source-hashes.txt`. Per-edit intentions and intermediate hashes are in the same evidence directory. Added `packages/core/src/shapes/schematic.ts` and `schematic.test.ts`; updated `packages/core/src/shapes/index.ts` to register the utilities. This progress file was absent before this work.

## Commands

- `bun test packages/core/src/shapes/schematic.test.ts`: exit 0, 4 pass, 0 fail; `tmp/schematic-s933/schematic-10-core-shape-utils/tests.log`.
- `bunx biome check packages/core/src/shapes/schematic.ts packages/core/src/shapes/schematic.test.ts packages/core/src/shapes/index.ts`: exit 0; `tmp/schematic-s933/schematic-10-core-shape-utils/biome.log`.
- `bunx biome check --write packages/core/src/shapes/schematic.ts packages/core/src/shapes/schematic.test.ts packages/core/src/shapes/index.ts`: initial lint failure recorded in `format.log`, corrected declaration and reran successfully in `format-final.log`.

## Drift

No concurrent changes observed in owned files. Final source hashes are recorded for downstream comparison.

## Sibling diagnostics

The independent registry plan reported an existing combined registry-test conflict; it is outside this plan's scope.

## Open issues

None owned by this plan. Formal review and serial integration remain downstream.

## Done checklist

- [x] Register 18 fixed-size shape utilities with bounds and hit tests; focused test covers all types and wire segment tolerance.
- [x] Implement joinable target and wire-interior lookups; tests cover pins, ends, bends, ties, hidden elements and endpoints.
- [x] Focused test and owned-file Biome checks pass.

## Review revision SCH10-ROTATED-HITTEST

Corrected the hit-test frame for parts and power at odd quarter rotations without changing bounds or lookup helpers. Added editor-path lead and outside probes at 0, 90 and 270 degrees. The pre-fix regression failed as expected (`revision-reproduction.log`). Final focused, predecessor and adjacent test gates and Biome checks are recorded in `revision-tests-final.log`, `revision-adjacent-tests-final.log` and `revision-biome-final.log`. Formal re-review remains downstream.
