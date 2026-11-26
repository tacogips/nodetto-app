# schematic-29-core-tools-catalogue progress

## Start

2026-11-26 UTC. Dependency schematic-28-core-exports is accepted by the dispatched implementation item. Design section 7.3 matches this plan.

## Files

Pre-hashes: `tmp/schematic-s933/schematic-29-core-tools-catalogue/pre-hashes.txt`. Final source hashes: `tmp/schematic-s933/schematic-29-core-tools-catalogue/source-final-hashes.txt`. Per-edit intent and intermediate hashes are in the same evidence directory. New test and progress files were absent at start.

## Commands

- `bun test packages/core/src/schematic/tools.test.ts packages/core/src/schematic/index.test.ts`: exit 0, 4 passed, 0 failed; `tmp/schematic-s933/schematic-29-core-tools-catalogue/tests.log`.
- `bunx biome check packages/core/src/tools.ts packages/core/src/shape-catalogue.ts packages/core/src/index.ts packages/core/src/schematic/tools.test.ts`: exit 0; `tmp/schematic-s933/schematic-29-core-tools-catalogue/biome.log`.
- Biome formatting output is in `format.log`; the enclosing shell returned 1 after formatting because zsh reserves the variable `status`. The subsequent independent Biome check passed.

## Drift

The pre-existing schematic root export from plan 28 was preserved. No drift observed in owned files.

## Sibling diagnostics

No workspace-wide gate was run during fanout; the serial integration gate owns it. `packages/ui-solid/src/interaction-creation.test.ts` includes `Tool.SchematicWire` in its gesture-set test due to the wave-007 serial repair. The serial reconciler must withdraw that one line and verify `git diff --quiet da5c257 -- packages/ui-solid/src/interaction-creation.test.ts`; this plan does not own that file.

## Open issues

None within this plan. Formal review and subsequent plans remain downstream.

## Done checklist

- [x] 23 tool IDs and creation mapping, including the wire creation record and variant patches; focused tests pass.
- [x] Schematic category lists 22 placeable entries; focused tests pass.
- [x] Core exports the tool list and type; plan 28 index test passes.
- [x] Owned TypeScript files pass Biome.

## Repair SCH-939-W8-WIRE-CREATION-29

The wire creation record now returns `schematic.wire`, while shape search remains at 22 entries without wire. Repair pre-hashes and per-file intent snapshots are under `tmp/schematic-s933/schematic-29-core-tools-catalogue/`. The focused core gate passed 4 tests, Biome passed, and the sibling workspace and interaction gate passed 25 tests; complete logs are `repair-tests.log`, `repair-biome.log`, and `repair-sibling-tests.log` there. `workspaces.test.ts` matches checkpoint da5c257 (`repair-workspaces-unchanged.log`). Formal review remains downstream.

## Continuation confirmation

The dispatch accepts schematic-28-core-exports. The existing implementation was retained, including the earlier wire creation repair required by the continuation. Fresh focused tests passed 4/4 and Biome passed; full logs are `tmp/schematic-s933/schematic-29-core-tools-catalogue/continuation-tests.log` and `continuation-biome.log`. Pre- and post-confirmation hashes are `continuation-pre-hashes.txt` and `continuation-post-hashes.txt` in that directory. No source files were edited in this continuation. Formal review and the serial integration gate remain downstream.
