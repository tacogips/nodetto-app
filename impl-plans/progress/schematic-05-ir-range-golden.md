# schematic-05-ir-range-golden progress

## Start (UTC)
2026-11-25T20:13:35.613770+00:00 (recorded at completion; pre-edit snapshots retained)

## Files
Pre-edit hashes and intent snapshots:

Path: packages/ir/src/validate.ts
Pre-hash: 9584c8e21eaefa7c4a49ddd0809919c743b5e2f346f8607192d6897e6c70a1b8
Intent: Add schematic-only finite visual x/y range diagnostics after visual validation.

Path: packages/ir/src/validate.test.ts
Pre-hash: 54d2bcb040980bd9163859446d1bf8ff245cdac2e5596f7fc3baa126f85e3168
Intent: Append boundary and isolation validation cases without changing existing cases.

Path: packages/io/src/jsonl/golden.test.ts
Pre-hash: efef22ecb2cc22b96931eee952e62851bc2674efd6eba240352536dc17951e8f
Intent: Add schematic to GOLDEN only.

Path: packages/io/src/__fixtures__/schematic.jsonl
Pre-hash: absent
Intent: Create canonical hand-authored fixture covering all 18 schematic types.

Path: impl-plans/progress/schematic-05-ir-range-golden.md
Pre-hash: absent
Intent: Record plan execution, hashes, verification, drift and done criteria.

Final source SHA-256:
```
695fd419d30930db2f3dfbb2e106961ecdaa51658c6abff1a3cdfa5994ba1c59  packages/ir/src/validate.ts
115e0ef0cbe8b7efc338d74db2b34274e0d28d0c3a074ff417bc6a2a0dc9579c  packages/ir/src/validate.test.ts
8d9c25bb183feab1a178903600b3eb1d49c7cc68eae852f12290bccf21cce8e5  packages/io/src/jsonl/golden.test.ts
24df6c2094c2cce551e010896721623b52cf4bceb7af79605500229cb20be787  packages/io/src/__fixtures__/schematic.jsonl
```
Progress pre-state: absent; final hash is recorded in tmp/schematic-s933/schematic-05-ir-range-golden/progress-final-hash.txt.

## Commands
- `bun test packages/ir/src/validate.test.ts packages/io/src/jsonl/golden.test.ts`: exit 0, 119 pass, 0 fail; tmp/schematic-s933/schematic-05-ir-range-golden/tests.log.
- `bun test packages/ir/src/registry/schematic.test.ts packages/ir/src/registry.test.ts`: exit 0, 10 pass, 0 fail; tmp/schematic-s933/schematic-05-ir-range-golden/predecessor.log.
- `bunx biome check --write packages/ir/src/validate.ts packages/ir/src/validate.test.ts packages/io/src/jsonl/golden.test.ts`: exit 0; tmp/schematic-s933/schematic-05-ir-range-golden/format.log.
- `bunx biome check packages/ir/src/validate.ts packages/ir/src/validate.test.ts packages/io/src/jsonl/golden.test.ts`: exit 0; tmp/schematic-s933/schematic-05-ir-range-golden/biome.log.

## Drift
No overlapping edits observed; final hashes recorded under the plan evidence directory.

## Sibling diagnostics
Registry predecessor tests pass.

## Open issues
None for this plan. Formal review and serial integration remain downstream.

## Done checklist
- [x] Schematic-only visual coordinate range with boundary and non-schematic tests.
- [x] Golden fixture covers 18 types, validates and reserializes byte-for-byte; all existing goldens pass (tests.log).
