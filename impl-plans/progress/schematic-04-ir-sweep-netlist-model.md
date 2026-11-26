# schematic-04-ir-sweep-netlist-model progress

## Start (UTC)
2026-11-25T19:50:38Z. Dependencies 01 and 03 accepted by dispatch. Plan matches design sections 3.4 and 5.1.

## Files
- packages/ir/src/segment-sweep.ts: missing -> 5fe2911c88015ba51fef7bd09d05ddd1af349c679376ba35872777cf3fac2cf2
- packages/ir/src/segment-sweep.test.ts: missing -> c2b1c42db6273470c7481faacc9ecfb99b3deb66a9ebcbd41853a8f210fb8b31
- packages/ir/src/schematic.ts: missing -> 8c453e8f560156e3dc19c7e9dbc9ab27a81e3afcf36db10f4469ded30e34a28d
- packages/ir/src/index.ts: 0b7032cf1e3692558a340a76d1059e369ea3ea0f1e1eb6189aeaa42b0523190a -> b8db32c7d6cca1dd724e48ed7b6f0f373ed63ef476bafab9460db23680cc0d46
- This progress file: new. Hash recorded in final-hashes.txt.

## Commands
- `bun test packages/ir/src/segment-sweep.test.ts packages/ir/src/semantics/schematic.test.ts packages/ir/src/coordinate-key.test.ts`: exit 0, 11 pass, 0 fail; tmp/schematic-s933/schematic-04-ir-sweep-netlist-model/tests.log.
- `bunx biome check packages/ir/src/segment-sweep.ts packages/ir/src/segment-sweep.test.ts packages/ir/src/schematic.ts packages/ir/src/index.ts`: exit 0; tmp/schematic-s933/schematic-04-ir-sweep-netlist-model/biome.log.
- `bunx biome check --write packages/ir/src/segment-sweep.ts packages/ir/src/segment-sweep.test.ts packages/ir/src/schematic.ts packages/ir/src/index.ts`: output tmp/schematic-s933/schematic-04-ir-sweep-netlist-model/format.log. Wrapper exited 1 after the command because zsh reserves `status`; final check above passes.

## Drift
No unexpected drift observed; predecessor index exports preserved. Pre/post hashes and per-edit intentions are in tmp/schematic-s933/schematic-04-ir-sweep-netlist-model/.

## Sibling diagnostics
None observed in this plan's gates.

## Open issues
Formal test-integrity and adversarial reviews and final integration remain downstream.

## Done checklist
- [x] Export sweep and its types; inclusive endpoints, overlapping segments and disjoint gaps covered.
- [x] Export schematic netlist model with breadboard net reuse.
- [x] Work-count tests cover disjoint crowded row and sparse grid; predecessor tests pass.
- [x] Focused Biome check passes.
