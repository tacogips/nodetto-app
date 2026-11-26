# schematic-24-core-svg-export progress

## Start

2026-11-26 UTC. Dependency schematic-19 is accepted by dispatch. Plan matches design section 7.1.

## Files

Pre-edit hashes and absent paths: `tmp/schematic-s933/schematic-24-core-svg-export/pre-hashes.txt`. Final source hashes: `tmp/schematic-s933/schematic-24-core-svg-export/final-source-hashes.txt`. Intent snapshots and pre-edit contents are in the same evidence directory. The three SVG exporter files, new schematic export test, and this progress log are the only authored changes.

## Commands

- `bun test packages/core/src/schematic/svg-export.test.ts packages/core/src/breadboard/svg-export-breadboard.test.ts`: exit 0, 6 pass, 0 fail; `tmp/schematic-s933/schematic-24-core-svg-export/gate.log`.
- `bun test packages/core/src/schematic/svg-export.test.ts packages/core/src/breadboard/svg-export-breadboard.test.ts packages/core/src/schematic/notation.test.ts`: exit 0, 11 pass, 0 fail; `tmp/schematic-s933/schematic-24-core-svg-export/tests.log`.
- `bunx biome check packages/core/src/svg-export/notation.ts packages/core/src/svg-export/shapes.ts packages/core/src/svg-export/document.ts packages/core/src/schematic/svg-export.test.ts`: exit 0; `tmp/schematic-s933/schematic-24-core-svg-export/biome.log`. Scoped formatting: `format.log`.

## Drift

Reviewed the final source diff and hashes. No unexpected changes in owned files were observed. Other plans' files were not edited.

## Sibling diagnostics

None encountered.

## Open issues

Formal review and serial integration gates are downstream workflow steps.

## Done checklist

- [x] Schematic primitives render through shared notation with theme ink and schematic role classes.
- [x] Labels render outside rotation and contribute bounds; mirroring is handled by shared notation.
- [x] Focused schematic and unchanged breadboard export tests pass; predecessor notation test passes; scoped Biome passes.
