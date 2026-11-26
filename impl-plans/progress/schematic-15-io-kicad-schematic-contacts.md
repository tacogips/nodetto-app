# schematic-15-io-kicad-schematic-contacts

## Start
Redispatch after SCH15-ADMISSION-MISREAD: dependencies 04, 06 and 07 are accepted in the dispatch item. Design 8.3 and the committed plan agree.

## Files
Pre-edit hashes: tmp/schematic-s933/schematic-15-io-kicad-schematic-contacts/redispatch-pre-hashes.txt. Post-edit hashes: tmp/schematic-s933/schematic-15-io-kicad-schematic-contacts/final-source-hashes.txt. The progress file was absent before this run. Intent and snapshots are in the same evidence directory.

## Commands
- `bun test packages/io/src/kicad/schematic.test.ts packages/io/src/kicad/netlist.test.ts packages/core/src/breadboard/kicad-golden.test.ts packages/io/src/kicad/diagonal-lookup.test.ts packages/ir/src/segment-sweep.test.ts`: exit 0, 30 pass, 0 fail, tests-final-5.log.
- `bunx biome check packages/io/src/kicad/schematic.ts packages/io/src/kicad/index.ts packages/io/src/kicad/schematic.test.ts`: exit 0, biome-final-3.log.
- Earlier tests-attempt1.log: 27 pass, 1 fail due to counting two pins in the sparse workload fixture; the revised distinct sparse fixture asserts the specified 3N bound.

## Drift
Source snapshots and post hashes retained in the evidence directory. No concurrent changes detected in owned files during edits.

## Sibling diagnostics
None observed.

## Open issues
Formal test-integrity and adversarial review are downstream.

## Done checklist
- [x] Normalized axis sweep, diagonal lookup, degenerate lookup, unchanged onSegment and legacy join ordering.
- [x] Optional policy, fresh diagonal work counter, stats wiring and error diagnostic.
- [x] Existing fixtures and representative generated inputs compared with legacy brute-force importer; sparse work and long-lattice budget tested.
- [x] Generated oracle variants include connected parts, disjoint mixed, overlapping parallel, short-lattice and large-coordinate midpoint geometry.
