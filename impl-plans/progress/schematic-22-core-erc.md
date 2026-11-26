# schematic-22-core-erc progress

Dependency schematic-18-core-connectivity is accepted by dispatch. Addressed SCH-W5-ADMISSION-MISREAD-22 by implementing the five design section 6 rules and focused tests. Formal test-integrity and adversarial reviews remain downstream.

A label at a wire end counts as an attachment even when the end lies on another wire interior. Whitespace-only names retain the connectivity layer's trimmed empty name; no extra rule is introduced. A no-connect mark exempts part pins only, not power symbols. Tests cover these decisions.

Source files were absent at the pre-snapshot. Final SHA-256 hashes are recorded in tmp/schematic-s933/schematic-22-core-erc/final-source-hashes.txt. Intent and intermediate snapshots are in the same directory. Earlier test attempts revealed fixture positioning errors, corrected without relaxing assertions; the first Biome check identified an unnecessary template literal, corrected.

- `bun test packages/core/src/schematic/erc.test.ts packages/core/src/schematic/connectivity.test.ts`: exit 0, 9 passed, 0 failed; tests-final-3.log.
- `bunx biome check packages/core/src/schematic/erc.ts packages/core/src/schematic/erc.test.ts`: exit 0; biome-final.log.

Revision INT-939-W2-TSC-22-ERC-TEST: the test helper now casts through `unknown`, preserving its runtime input and all assertions. The source diff is limited to line 27; `erc.ts` remains unchanged. Pre- and final hashes and the edit intent are recorded under tmp/schematic-s933/schematic-22-core-erc/.

- `bun test packages/core/src/schematic/erc.test.ts`: exit 0, 4 passed, 0 failed; tsc-revision-erc.log.
- `bun test packages/core/src/schematic/erc.test.ts packages/core/src/schematic/connectivity-roundtrip.test.ts`: exit 0, 10 passed, 0 failed; tsc-revision-tests.log.
- `bunx biome check packages/core/src/schematic/erc.ts packages/core/src/schematic/erc.test.ts`: exit 0; tsc-revision-biome.log.
- `bunx tsc --noEmit -p tsconfig.json`: probe exit 2 due to other plans' files; no diagnostic for erc.test.ts (tsc-probe.log). The final workspace typecheck remains a serial integration gate.
