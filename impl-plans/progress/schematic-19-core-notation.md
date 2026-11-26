# schematic-19-core-notation progress

## Implementation

Implemented original palette-driven notation aligned with design section 7.1 and the accepted schematic-08 pin geometry. All 18 types produce body primitives; variants, mirrored body geometry, upright pre-rotated labels and label bounds are included. Canvas and SVG integration belong to plans 31 and 24 respectively. Formal review and integration remain downstream.

## Files and evidence

Both TypeScript files and this progress log were absent at the initial read. Per-edit reads, intent snapshots and pre/post hashes are in `tmp/schematic-s933/schematic-19-core-notation/`. Final source hashes are in `final-hashes.txt` there. The active plan remains unchanged.

## Verification

- `bun test packages/core/src/schematic/notation.test.ts`: exit 0, 4 passed, 0 failed; `tmp/schematic-s933/schematic-19-core-notation/tests-final.log`.
- `bunx biome check packages/core/src/schematic/notation.ts packages/core/src/schematic/notation.test.ts`: exit 0; `tmp/schematic-s933/schematic-19-core-notation/biome-final.log`.

## Completion criteria

- [x] Original line-art primitives cover every schematic type with designated roles and supplied palette.
- [x] Mirroring and upright rotated labels are covered by focused tests.
- [x] Focused behavioral and Biome gates pass.
- [ ] Formal review and downstream renderer integration (separate workflow steps).

## Review correction SCH19-ADV-001-WIRE-ORIGIN

Wire notation now adds visual x/y to semantic offsets before subtracting the page bounds. A regression uses the actual shape utility at visual (100, 200) and asserts `M 3 3 L 43 3`. The original four tests remain intact. Final source hashes are recorded in `tmp/schematic-s933/schematic-19-core-notation/revision-final-source-hashes.txt`; per-edit intent and snapshots are in the same directory.

- `bun test packages/core/src/schematic/notation.test.ts`: exit 0, 5 passed, 0 failed; `tmp/schematic-s933/schematic-19-core-notation/revision-tests.log`.
- `bun test packages/core/src/schematic/symbols.test.ts packages/core/src/shapes/schematic.test.ts`: exit 0, 9 passed, 0 failed; `tmp/schematic-s933/schematic-19-core-notation/revision-adjacent-tests.log`.
- `bunx biome check packages/core/src/schematic/notation.ts packages/core/src/schematic/notation.test.ts`: exit 0; `tmp/schematic-s933/schematic-19-core-notation/revision-biome.log`.
- `find target tmp/cad3d -name '*.test.ts'`: exit 1 because both artifact roots are absent; `tmp/schematic-s933/schematic-19-core-notation/revision-find.log`.

Independent test-integrity and adversarial re-review remain downstream.

## Integration revision INT-939-W2-TSC-19-NOTATION-TEST

Changed the test helper's semantic parameter to `unknown` and supplied the required bounds context. Assertions and production notation are unchanged. Pre- and final source hashes, the original test snapshot, and edit intents are recorded under `tmp/schematic-s933/schematic-19-core-notation/tsc-revision-*`; the production hash remains `e4492fbd04ae83313089503a7e06f357d6aca04bd5dea83aac8c30a06ae90ed3`.

- [x] `bun test packages/core/src/schematic/notation.test.ts packages/core/src/shapes/schematic.test.ts`: exit 0, 9 passed, 0 failed; `tsc-revision-tests.log` in the evidence directory.
- [x] `bunx biome check packages/core/src/schematic/notation.ts packages/core/src/schematic/notation.test.ts`: exit 0; `tsc-revision-biome.log`.
- [x] `bunx tsc --noEmit -p tsconfig.json`: probe exit 2, no notation.test.ts diagnostics; `tsc-probe.log`. Remaining diagnostics concern other plans' files and the final integration gate.
- [ ] Independent integrity and adversarial review of this revision belongs to subsequent workflow steps.

## Adversarial revision SCH19-IC-BODY-INSET

Reproduced the default IC body at y=25..35 with pins at y=15..45 (`ic-reproduction.log`). The body now uses a 25-unit inset on pin-bearing sides and 5 on other sides, and is omitted for empty pin tables. The new regression asserts the exact default and four-sided polygons, default pin endpoints, palette styling and empty case. Existing tests remain intact. Flip and label code is unchanged.

- Pre-hashes: `ic-repair-pre-hashes.txt`; post-source hashes: `ic-repair-post-source-before-progress.txt`; final owned-file hashes: `ic-repair-final-hashes.txt` in `tmp/schematic-s933/schematic-19-core-notation/`. Per-edit intents and snapshots are in the same directory.
- `bun test packages/core/src/schematic/notation.test.ts`: exit 0, 6 pass, 0 fail; `ic-repair-tests.log`.
- `bun test packages/core/src/union-find.test.ts packages/core/src/schematic/symbols.test.ts`: exit 0, 7 pass, 0 fail; `ic-repair-predecessor.log`.
- `bun test packages/ui-solid/src/shapes/schematic-view.test.ts packages/core/src/schematic/index.test.ts`: exit 0, 3 pass, 0 fail; `ic-repair-consumers.log`.
- `bunx biome check packages/core/src/schematic/notation.ts packages/core/src/schematic/notation.test.ts`: exit 0; `ic-repair-biome.log`.
- `find target tmp -name '*.test.ts'`: exit 0, no results; `ic-repair-find.log`.
- [x] Default IC body and pin edges match design geometry; four-sided geometry remains correct.
- [x] Focused, predecessor and consumer tests and Biome pass.
- [ ] Independent integrity and adversarial re-review is downstream.
