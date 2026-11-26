# schematic-27-core-pcb-parity

## Start
Recorded UTC: 2026-11-25T21:47:39.750912+00:00
Redispatch for SCH-W6-ADMISSION-MISREAD-27. Dependency schematic-21-core-netlist-names is accepted in the dispatched item. Design 8.2 and the plan are aligned.

## Files
- packages/core/src/schematic/pcb-parity.ts: absent before; post-format sha256 a911f03d4ad9b94f28d0370e037df62cf2d46020e6faf835313ae9b902efec54.
- packages/core/src/schematic/pcb-parity.test.ts: absent before; post-format sha256 9f92b7dba8c37cac887b344dc57d6bbccfb4ed324a7a077ab066531b47f078e3.
- This progress file: absent before; final hash in final-hashes.txt.
- Pre-edit snapshots and intentions: tmp/schematic-s933/schematic-27-core-pcb-parity/edit-001 through edit-005.

## Commands
- bun test packages/core/src/schematic/pcb-parity.test.ts packages/core/src/pcb: exit 0, 126 pass, 0 fail; tests.log.
- bunx biome check packages/core/src/schematic/pcb-parity.ts packages/core/src/schematic/pcb-parity.test.ts: exit 0; biome.log.
- git diff --quiet da5c257 -- packages/core/src/pcb: exit 0; pcb-diff.log.
- Biome formatting succeeded (format.log); the surrounding shell returned 1 because zsh reserves the variable named status; the final check above passed.

## Drift
No overlapping edits observed; final hashes recorded separately.

## Sibling diagnostics
None.

## Open issues
Formal test-integrity and adversarial review and serial integration are downstream.

## Done checklist
- Implemented live partition and value comparisons, first schematic selection and schematic-page missing-part locations.
- Added positive and negative cases for all rules, empty board and PCB-only documents.
- Focused tests and Biome pass; PCB source unchanged relative to checkpoint.
