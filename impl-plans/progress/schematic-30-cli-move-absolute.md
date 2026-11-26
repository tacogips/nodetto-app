# schematic-30-cli-move-absolute

## Start (UTC)
2026-11-26T00:10:49.078836+00:00 (recorded after implementation)

## Files
Pre-hashes:
```
961fa3bcab164a21753d5829ec3887243d6a2cf6f08b17f7584e992fddbb9a4b  apps/cli/src/edit/operations/elements.ts
cb105c6fa17a8083f07a69fe3f6aeb0c2a7f1edf0c6314de5a83d6557d522726  apps/cli/src/edit/apply-batch.test.ts
670ff0246af1f6fded428a2417d6cbeb6daf9aa0169a91fa719a2324904c8424  impl-plans/active/schematic-30-cli-move-absolute.md
```
Post-hashes:
```
266437e48b6d6571677f29a919b6e718474187754d7552543bc381a711c06c2e  apps/cli/src/edit/operations/elements.ts
fdc3301b79fcc1761eba4fb2c29ddda2b5259d113aa7dce7f15fd330b805fca0  apps/cli/src/edit/apply-batch.test.ts
```
Progress file was absent before creation. Intent snapshots and intermediate hashes are in tmp/schematic-s933/schematic-30-cli-move-absolute/.

## Commands
- `bun test apps/cli/src/edit/apply-batch.test.ts`: exit 0, 13 pass, 0 fail; tmp/schematic-s933/schematic-30-cli-move-absolute/tests-final.log.
- `bunx biome check apps/cli/src/edit/operations/elements.ts apps/cli/src/edit/apply-batch.test.ts`: exit 0; tmp/schematic-s933/schematic-30-cli-move-absolute/biome-final.log.
- Scoped `bunx biome check --write` exited 0; tmp/schematic-s933/schematic-30-cli-move-absolute/format.log. Initial check detected formatting only; tmp/schematic-s933/schematic-30-cli-move-absolute/biome-first.log.

## Drift
No source drift observed during edits; final hashes recorded in tmp/schematic-s933/schematic-30-cli-move-absolute/final-hashes.txt. Shared tree verification is subject to integration review.

## Sibling diagnostics
None observed.

## Open issues
Formal review and final integration gates are downstream.

## Done checklist
- [x] Schematic absolute moves use canonicalTarget; other types retain existing behavior.
- [x] Regression exercises -0.125 to 0.875 and expects 0.88; 13 focused tests pass.
- [x] CLI move supports absolute targets only, so no relative-offset path exists to modify.
- [x] Scoped Biome check passes.
