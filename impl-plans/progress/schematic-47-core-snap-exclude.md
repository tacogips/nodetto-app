# schematic-47-core-snap-exclude progress

## Start (UTC)
2026-11-26T13:18:34Z

## Files
Initial hashes (absent indicates no prior file):
```
e0d64ab23e38f446e70f14f6ae677242798898d2dde7b9742388959f4394ae04  packages/core/src/shapes/schematic.ts
28fb1508de57e314176f3c6879d0da7ff19c238087285f22ce74d94a819861e7  packages/core/src/shapes/schematic.test.ts
0958a5ca3145f0a5f04bb571aeec11956ae12ba742dd7b676508f24de2a6890e  packages/core/src/schematic/coordinates.ts
02485f9ac86f9d70ae3feb2da4536a2a5a9c341f2f529bfdc419e27df143582c  packages/core/src/schematic/index.ts
absent impl-plans/progress/schematic-47-core-snap-exclude.md
```
Final source hashes:
```
8e0e1f9020ac375bcd396bcb05acb1ee6c8cf1b1e4e2d6b1d4d450160b83c9e1  packages/core/src/shapes/schematic.ts
1ef8262e464d2d0e5788b8755158557ba207eef841db6ff4f993a42c8b73cb8e  packages/core/src/shapes/schematic.test.ts
3eb72b58807ba90ff1d1c4a917758514f409686c4b356182488df10fd168d71b  packages/core/src/schematic/coordinates.ts
2aae89c04063385cbbb05386b1b651adc53df73967f5b32d201058912e26d22d  packages/core/src/schematic/index.ts
```
Per-edit fresh snapshots, intentions and intermediate hashes are under `tmp/schematic-s933/schematic-47-core-snap-exclude/`.

## Commands
- `bun test packages/core/src/shapes/schematic.test.ts`: exit 0, 10 pass, 0 fail; `shape-test-final.log`.
- `bunx biome check packages/core/src/shapes/schematic.ts packages/core/src/shapes/schematic.test.ts packages/core/src/schematic/coordinates.ts packages/core/src/schematic/index.ts`: exit 0; `biome-final.log`.
- `bun test packages/core/src/schematic/coordinates.test.ts packages/core/src/schematic/snap.test.ts`: exit 0, 5 pass, 0 fail; `predecessor-coordinates.log`.
- `bun test packages/core/src/schematic/index.test.ts`: exit 0, 1 pass, 0 fail; `predecessor-index.log`.
- `bun test packages/core/src/schematic`: exit 0, 66 pass, 0 fail; `predecessor-suite.log`.
- All logs are in `tmp/schematic-s933/schematic-47-core-snap-exclude/`. Predecessor tests ran before the final test-only addition; production source did not change afterward.
- Initial formatter ran successfully (4 files, 2 formatted), but its shell wrapper exited 1 because zsh reserves `status`; the later formatter and final Biome check exited 0.

## Drift
No drift in the four source files at the post-format hash check. Files were read fresh before edits. No Git write operations.

## Sibling diagnostics
None.

## Open issues
Formal test-integrity and adversarial review and the final integration gate remain downstream.

## Done checklist
- [x] Snap exclusion precedes raw-distance ranking; targets carry stored-field keys.
- [x] Exact-key contacts classify wire interiors, labels, and joinables in one element traversal; hidden and excluded elements are skipped.
- [x] Coordinate helpers preserve stored-field keys, including the negative tie.
- [x] Crossing and exclusion regressions pass live and after serialization; endpoints and bends covered; existing assertions retained.
- [x] Focused and predecessor tests and owned-file Biome check pass; changes restricted to writePaths and plan evidence.
