# schematic-14-io-skip-collab progress

Integration review finding SCH14-COLLAB-FIXTURE-COUNT authorizes a standalone schematicDocument() instead of changing allFixtures(); the latter remains unchanged. The fixture contains a resistor, orthogonal wire, junction, label and power symbol. D2 skips schematic elements with one warning; Mermaid skipping is covered. Y.Doc round trip and concurrent resistor move/wire endpoint edit converge.

Test-integrity finding SCH14-D2-EXTRA-WARNING was corrected: schematic-only D2 output now has exactly the schematic warning, while pages without schematic elements retain their prior behavior. The focused gate passed 18 tests, breadboard skip passed 3 tests, Biome passed, and existing D2 and breadboard tests are unchanged. Logs and pre-edit snapshots are in tmp/schematic-s933/schematic-14-io-skip-collab/. Independent review remains downstream.

Final source hashes:
6c6b0f52f506ef1757b5894808cbbbffd93292f0bf9df7372e97acb562e8d1d7  packages/io/src/d2/export.ts
e476b6e6da795fff0e1c745780ab49d64f8df792fb5706cdf29049a32bedd951  packages/io/src/schematic/skip.test.ts
8d2c24a2025050fb58d48f7ac4fe506376e1bc0cac5968597385035e03cd43ae  packages/collab/src/test-fixtures.ts
9a78f1fa620308b9f5d6f274ccaa0e2fb19f4aab3ac6156faeec844e92e08278  packages/collab/src/schematic.test.ts

## Integration review revision

INT-939-W2-TSC-14-COLLAB-TEST: narrowed the wire semantic value before reading points; the expected points and assertions are unchanged. Pre-hashes match review-final-hashes.txt. The focused gate passed 18 tests (the previous progress record also reports 18 for this command; the separate breadboard skip gate contributed three more). Biome passed on four files. The workspace tsc probe exited 2 on other diagnostics and contains zero diagnostics for packages/collab/src/schematic.test.ts. Logs: revision-tests-final.log, revision-biome-final.log, and tsc-probe.log under tmp/schematic-s933/schematic-14-io-skip-collab/. Formal review remains downstream.

Revision final source hashes:
6c6b0f52f506ef1757b5894808cbbbffd93292f0bf9df7372e97acb562e8d1d7  packages/io/src/d2/export.ts
e476b6e6da795fff0e1c745780ab49d64f8df792fb5706cdf29049a32bedd951  packages/io/src/schematic/skip.test.ts
8d2c24a2025050fb58d48f7ac4fe506376e1bc0cac5968597385035e03cd43ae  packages/collab/src/test-fixtures.ts
1d0cc2d49c2db570fff312e42d368523bfdc3b43c6cd48de07aff78686e1546c  packages/collab/src/schematic.test.ts
