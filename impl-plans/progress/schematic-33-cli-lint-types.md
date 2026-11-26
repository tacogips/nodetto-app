# schematic-33-cli-lint-types progress

## Start (UTC)
2026-11-26. Dependency schematic-28-core-exports is accepted in the assigned runtime implementation item. Design section 9 matches this plan.

## Files
- `apps/cli/src/commands.ts`: pre-hash in `tmp/schematic-s933/schematic-33-cli-lint-types/pre-hashes.txt`; final hash in `final-source-hashes.txt` in the same evidence directory.
- `apps/cli/src/lint-schematic.test.ts`: new file; final hash in `final-source-hashes.txt`.
- `impl-plans/progress/schematic-33-cli-lint-types.md`: new progress record; final hash in `final-hashes.txt` in the evidence directory.
- Edit intent and intermediate pre/post hashes are recorded under `tmp/schematic-s933/schematic-33-cli-lint-types/`.

## Commands
- `bun test apps/cli/src/lint-schematic.test.ts apps/cli/src/breadboard-commands.test.ts`: exit 0, 12 pass, 0 fail, 96 assertions; `tmp/schematic-s933/schematic-33-cli-lint-types/tests-final.log`.
- `bunx biome check apps/cli/src/commands.ts apps/cli/src/lint-schematic.test.ts`: exit 0; `tmp/schematic-s933/schematic-33-cli-lint-types/biome-final.log`.
- Initial Biome write reported three test fixture string style diagnostics; fixed and reran. Log: `tmp/schematic-s933/schematic-33-cli-lint-types/biome-write.log`.

## Drift
No unexpected drift observed. Sources re-read after edits and final source hashes recorded.

## Sibling diagnostics
None observed. Workspace-wide typecheck is reserved for the serial integration gate under the accepted plan.

## Open issues
Formal test-integrity, adversarial and integration review are downstream workflow steps.

## Done checklist
- [x] Schematic ERC and conditional PCB parity included in lint; JSON carries optional pin and subject page ID.
- [x] Text and JSON warning behavior, duplicate error, PCB-only behavior and cross-page missing part tested.
- [x] All 18 schematic types listed, added to a new schematic page, and validated.
- [x] Breadboard CLI regression and owned-file Biome checks passed.
