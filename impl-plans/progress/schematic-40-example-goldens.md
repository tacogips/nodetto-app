# schematic-40-example-goldens progress

## Start (UTC)

2026-11-26. Dependencies 13 and 28 are accepted in the dispatched implementation item. The plan matches design sections 10 and 11.

## Files

All six authored files were absent before this plan. Current source post-hashes are in `tmp/schematic-s933/schematic-40-example-goldens/source-hashes.txt`; the progress log's post-hash and all final hashes are in `final-hashes.txt` in the same directory. Initial generated outputs were revised; their pre-revision hashes and the test's pre-format hash are in `pre-revision-hashes.txt` and `pre-format-hash.txt`. Per-edit intents are in `edit-001-intent.md` through `edit-005-intent.md` there.

## Commands

- `bun test packages/core/src/schematic/export-golden.test.ts`: exit 0, 3 passed, 0 failed; `tmp/schematic-s933/schematic-40-example-goldens/test.log`.
- `bunx biome check packages/core/src/schematic/export-golden.test.ts`: exit 0; `tmp/schematic-s933/schematic-40-example-goldens/biome.log`.
- `bunx biome check --write packages/core/src/schematic/export-golden.test.ts`: exit 0; `tmp/schematic-s933/schematic-40-example-goldens/format.log`.
- `bun tmp/schematic-s933/schematic-40-example-goldens/generate.ts`: exit 0; `tmp/schematic-s933/schematic-40-example-goldens/generate-revision.log`.

## Drift

None observed. The example's `N_R1_2` label is explicit: sorted reference naming otherwise yields `N_D1_1`. The outputs use the real core connectivity and io formatter pipeline.

## Sibling diagnostics

No workspace-wide gate was run during fanout.

## Open issues

Formal test-integrity, adversarial and integration reviews and final integration gates are downstream.

## Done checklist

- [x] Original canonical LED/switch example with junction and expected nets; clean lint and exact node membership checked in `export-golden.test.ts`.
- [x] Both generated goldens compared byte for byte.
- [x] Light and dark SVG junction and five part notation roles checked.
- [x] Focused test and Biome gates pass.
