# schematic-08-core-symbols progress

## Start
2026-11-25T19:35:46Z. Dependency schematic-01-ir-semantics accepted in dispatch. Design sections 4.1 and 5.1 agree with this plan.

## Files
All four source and test files were absent before editing; see tmp/schematic-s933/schematic-08-core-symbols/pre-read.txt. Per-edit intents and pre/post hashes are in that directory. Final hashes are in final-hashes.txt. No breadboard files were changed.

## Commands
- `bun test packages/core/src/union-find.test.ts packages/core/src/schematic/symbols.test.ts`: exit 0, 6 passed, 0 failed, tests-final.log. Initial run tests.log: 5 passed, 1 failed due to negative-zero assertion; corrected and rerun.
- `bunx biome check packages/core/src/union-find.ts packages/core/src/union-find.test.ts packages/core/src/schematic/symbols.ts packages/core/src/schematic/symbols.test.ts`: exit 0, biome.log.
- `bunx biome check --write packages/core/src/union-find.ts packages/core/src/union-find.test.ts packages/core/src/schematic/symbols.ts packages/core/src/schematic/symbols.test.ts`: exit 0, format.log.

## Drift
No observed changes to owned files from siblings. Shared working tree verification is provisional pending integration.

## Sibling diagnostics
Plan 06 reported an unrelated KiCad importer ownership blocker in dispatch; no overlap with this plan.

## Open issues
Formal test-integrity and adversarial reviews and final integration are downstream.

## Done checklist
- [x] Symbol pin tables, IC layout, boxes, transforms, defaults and names: symbols.ts; symbols.test.ts.
- [x] Iterative union-find by size and tests: union-find.ts; union-find.test.ts.
- [x] Focused tests and Biome pass: tests-final.log and biome.log.

## Test-integrity revision SCH08-TI-001
Added exact resistor pin positions and directions for all quarter turns and flip-before-rotation, rotated box containment, and asymmetric BJT mirror assertions in `packages/core/src/schematic/symbols.test.ts`. The expected coordinates follow the design's 50x30 box and clockwise transform; an identity transform cannot satisfy the 90-degree case. Existing tests remain unchanged.

- `bun test packages/core/src/union-find.test.ts packages/core/src/schematic/symbols.test.ts`: exit 0, 7 passed, 0 failed; `tmp/schematic-s933/schematic-08-core-symbols/tests-review.log`.
- `bunx biome check packages/core/src/union-find.ts packages/core/src/union-find.test.ts packages/core/src/schematic/symbols.ts packages/core/src/schematic/symbols.test.ts`: exit 0; `tmp/schematic-s933/schematic-08-core-symbols/biome-review.log`.
- Pre/post edit hashes: `pre-edit-008.txt`, `post-edit-008.txt`, `pre-edit-009.txt`, `post-edit-009.txt`, `pre-edit-010.txt`, and `post-edit-010.txt` in the evidence directory. Current source hashes: `final-hashes.txt`; verified by `drift-review.log`.
- [x] SCH08-TI-001 regression assertions and focused checks complete; independent re-review pending.

## Integration revision INT-939-W2-TSC-08-SYMBOLS-TEST
- [x] Annotated the transform assertion's map callback return type as `(string | number)[]`; expected tuples and runtime behavior remain unchanged. Biome-required wrapping affects only that assertion.
- [x] Pre-revision hashes matched the previous final hashes; `revision-pre-hashes.txt`. Production `symbols.ts` remains unchanged.
- [x] `bun test packages/core/src/union-find.test.ts packages/core/src/schematic/symbols.test.ts`: exit 0, 7 pass, 0 fail; `revision-tests-final.log`.
- [x] `bunx biome check packages/core/src/union-find.ts packages/core/src/union-find.test.ts packages/core/src/schematic/symbols.ts packages/core/src/schematic/symbols.test.ts`: exit 0; `revision-biome-final.log`.
- [x] `bunx tsc --noEmit -p tsconfig.json`: probe exit 2 due to diagnostics in other plans; no diagnostic mentions `symbols.test.ts`; `tsc-probe.log`. Final workspace typecheck remains a serial integration gate.
- [x] Updated source and progress hashes: `revision-final-hashes.txt`. Independent review remains downstream.
