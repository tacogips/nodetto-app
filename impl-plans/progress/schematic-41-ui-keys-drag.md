# schematic-41-ui-keys-drag progress

## Start (UTC)
2026-11-26 (local work began 2026-11-27 JST). Dependency schematic-39 is accepted by dispatch. Plan matches design sections 3.3, 4.2 and 7.3.

## Files
Pre-edit hashes and absent entries: `tmp/schematic-s933/schematic-41-ui-keys-drag/pre-hashes.txt`. Per-edit before snapshots, pre-hashes and intentions are in that directory. Final hashes: `post-hashes.txt` there. The active plan was not edited.

- `packages/ui-solid/src/interaction/circuit.ts`: schematic R/Shift+R rotation and X mirror; retained plan 39 wire logic.
- `packages/ui-solid/src/interaction/transform.ts`: canonical shared schematic drag delta and snap, including repeated pointer samples.
- `packages/ui-solid/src/schematic-keys-move.test.ts`: keyboard, fallback, negative tie and repeated lattice-snap regressions.
- This progress log: absent before this plan.

## Commands
- `bun test packages/ui-solid/src/schematic-keys-move.test.ts packages/ui-solid/src/breadboard-interaction.test.ts packages/ui-solid/src/schematic-wire.test.ts`: exit 0, 31 passed, 0 failed; `tests-attempt3.log`. Earlier attempts 1 and 2 failed due to test gesture setup, retained in their logs.
- `bun test packages/ui-solid/src/schematic-interaction.test.ts`: exit 0, 3 passed, 0 failed; `predecessor-tests.log`.
- `bunx biome check packages/ui-solid/src/interaction/circuit.ts packages/ui-solid/src/interaction/transform.ts packages/ui-solid/src/schematic-keys-move.test.ts`: exit 0; `biome.log`.
- Scoped `bunx biome check --write` on these three files: exit 0; `format.log`.

## Drift
Circuit diff against the fresh predecessor snapshot contains only the new import and keyboard branch (`circuit-diff.log`). No unrelated change was intentionally removed. Final hashes are recorded for downstream reconciliation.

## Sibling diagnostics
None.

## Open issues
None for this plan. Formal reviews and the serial integration gate are downstream.

## Continuation verification
- Dispatch accepted dependency schematic-39; the plan remains aligned with design sections 3.3, 4.2 and 7.3.
- Preserved subsequent circuit wire-edit changes; the circuit hash had changed since the earlier post-hash. Added an Alt-key guard for schematic shortcuts and regression assertions. Pre-edit snapshots, intentions and hashes are `edit-010` through `edit-013` in the evidence directory; final source hashes are `final-source-hashes-20261127.txt`.
- Focused plan command: exit 0, 31 passed, 0 failed, `final-tests-20261127b.log`.
- Scoped Biome check: exit 0, `final-biome-20261127b.log`. The initial format-only failure is retained in `final-biome-20261127.log` and was corrected.
- Formal integrity, adversarial and integration reviews remain downstream.

## Done checklist
- [x] Schematic rotation and mirror keys with freeform fallback: focused keyboard test.
- [x] Schematic group drag uses canonical shared deltas, including negative tie: focused drag test.
- [x] Snap anchor reaches lattice across repeated pointer samples: focused snap test.
- [x] Plan 39 wire, breadboard and plan 36 creation regressions pass; scoped Biome passes.
