# schematic-03-ir-coordinate progress

## Start (UTC)

2026-11-25T19:36:03Z

## Files

Pre-edit hashes (ordered keyOrder.ts, canonical.ts, index.ts, coordinate-key.test.ts):

- Pre-hash: 64e91f2b1b4384a8bad01e4b3784f5da3f22c2e5acc34080134eaffc09f65a4d
- Pre-hash: 78e4717f4187c0adf89b7a7aa223910c8a49624d31ae07909a910c04d3279384
- Pre-hash: 08298fc1f86dd115712f09395ab9231369128d055a8173936b8b3573636ed70c
- Pre-hash: missing

Final source hashes:

```text
f3f36a6a696fd8715c10c1ee80e70e4b99a787e93c33057e65dda874cbe01df5  packages/ir/src/keyOrder.ts
84f194f601beed4b4a5a69545f17240151d5acef8652bd1a45a01342559ea1a1  packages/io/src/jsonl/canonical.ts
0b7032cf1e3692558a340a76d1059e369ea3ea0f1e1eb6189aeaa42b0523190a  packages/ir/src/index.ts
08fff516b3c00eeb1aabb8811979fea6b98941723c88dfc18012240b8f734fd9  packages/ir/src/coordinate-key.test.ts
```

## Commands

- `bunx biome check --write packages/ir/src/keyOrder.ts packages/io/src/jsonl/canonical.ts packages/ir/src/index.ts packages/ir/src/coordinate-key.test.ts`: exit 0, 0 tests; `tmp/schematic-s933/schematic-03-ir-coordinate/format.log`.
- `bun test packages/ir/src/coordinate-key.test.ts packages/io/src/jsonl/canonical.test.ts packages/ir/src/semantics/schematic.test.ts`: exit 0, 29 passed, 0 failed; `tmp/schematic-s933/schematic-03-ir-coordinate/tests.log`.
- `bun test packages/io/src/jsonl/golden.test.ts`: exit 0, 69 passed, 0 failed; `tmp/schematic-s933/schematic-03-ir-coordinate/golden.log`.
- `bunx biome check packages/ir/src/keyOrder.ts packages/io/src/jsonl/canonical.ts packages/ir/src/index.ts packages/ir/src/coordinate-key.test.ts`: exit 0, 0 tests; `tmp/schematic-s933/schematic-03-ir-coordinate/biome.log`.

## Drift

Final source hashes match post-format hashes. The predecessor's schematic exports remain in the index.

## Sibling diagnostics

Plan 06 reported a separate schematic importer stats handoff blocker; no overlap with this plan.

## Open issues

None in this plan. Formal review and integration are downstream.

## Done checklist

- [x] Moved roundCoordinate unchanged and exported both coordinate helpers; canonical retains its re-export.
- [x] Coordinate, canonical, predecessor and golden tests pass; canonical.test.ts remains unedited.
- [x] Biome passes on owned TypeScript files; no other io file edited by this plan.
