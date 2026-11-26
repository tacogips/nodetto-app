# schematic-02-ir-registry progress

## Start
See `tmp/schematic-s933/schematic-02-ir-registry/start.txt`. Dependency schematic-01 is accepted by dispatch. Design sections 3.2 and 3.3 align with this plan.

## Files and drift
Pre-hashes: `tmp/schematic-s933/schematic-02-ir-registry/pre-hashes.txt`. Per-edit intentions and post-hashes are in the same evidence directory; final source hashes are in `final-source-hashes.txt`. No observed sibling edits in these files. The active plan was not edited. Biome formatting touched only plan-owned files.

## Commands
- `bun test packages/ir/src/registry/schematic.test.ts packages/ir/src/registry.test.ts`: exit 1, 9 pass, 1 fail, `tmp/schematic-s933/schematic-02-ir-registry/tests-final.log`.
- `bun test packages/ir/src/registry/schematic.test.ts`: exit 0, 5 pass, 0 fail, `tmp/schematic-s933/schematic-02-ir-registry/schematic-test-final.log`.
- `bunx biome check packages/ir/src/registry/schematic.ts packages/ir/src/registry.ts packages/ir/src/registry/schematic.test.ts packages/ir/src/registry.test.ts`: exit 0, `tmp/schematic-s933/schematic-02-ir-registry/biome-final.log`.

## Open issue and sibling diagnostics
Existing `registry.test.ts` requires a nonempty key order for every definition, but junction and noConnect have empty payloads and must declare no semantic keys. The plan authorizes changes to that test only for adding 18 names. A fabricated key would incorrectly change unknown-field validation and serialization. Resolve the plan contradiction by amending its test-edit constraint and allowing the existing assertion to accommodate genuinely fieldless payloads, then rerun both gates. No sibling diagnostics observed.

## Done checklist
- 18 definitions, defaults, key order and structural validation implemented; focused schematic tests pass.
- Exact type list extended only with 18 names; aggregate registry test fails on the existing nonempty-key invariant. This criterion remains incomplete.
- Formal review and final integration remain downstream.

## Resolution (integration review SCH02-FIELDLESS-KEYORDER)
Integration review authorizes the narrow fieldless exception to the original test-edit restriction. Design 3.2 specifies empty payloads for exactly `schematic.junction` and `schematic.noConnect`; the registry test now requires both definitions and asserts their key orders equal `[]`. All other types retain the nonempty assertion, and the children loop is unchanged. The earlier failure above is historical.

The four source hashes matched `final-source-hashes.txt` before the repair. Updated hashes, including the unchanged active plan, are in `tmp/schematic-s933/schematic-02-ir-registry/repair-final-source-hashes.txt`.

- Registry gate: exit 0, 10 pass, 0 fail; `tmp/schematic-s933/schematic-02-ir-registry/repair-tests.log`.
- Predecessor semantics gate: exit 0, 4 pass, 0 fail; `tmp/schematic-s933/schematic-02-ir-registry/repair-predecessor.log`.
- Biome: exit 0; `tmp/schematic-s933/schematic-02-ir-registry/repair-biome.log`.
- Diff reviewed: `tmp/schematic-s933/schematic-02-ir-registry/repair-diff.log`; the only removed assertion is retained in the non-fieldless branch.

Implementation criteria are complete under the integration review amendment. Test-integrity and adversarial reviews remain downstream. The golden fixture belongs to plan 05.
