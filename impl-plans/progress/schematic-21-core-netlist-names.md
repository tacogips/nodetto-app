# schematic-21-core-netlist-names progress

Implemented design section 5.2: visible components and pin nets are ordered deterministically, explicit power and label names are reserved before generated names, and collisions are resolved through firstUnusedName. The second-order collision, explicit priority, membership and natural ordering tests pass.

- `bun test packages/core/src/schematic/netlist.test.ts`: 2 pass, 0 fail; log `tmp/schematic-s933/schematic-21-core-netlist-names/tests.log`.
- `bunx biome check packages/core/src/schematic/net-names.ts packages/core/src/schematic/netlist.ts packages/core/src/schematic/netlist.test.ts`: exit 0; log `tmp/schematic-s933/schematic-21-core-netlist-names/biome.log`.
- Initial test fixture coordinates were corrected; the earlier failed run is retained in `tests-attempt1.log`.
- Implementation complete; formal review and serial integration remain downstream.

## Revision INT-939-W2-TSC-21-NETLIST-TEST

- Changed only the test helper's `Document` assertion through `unknown`; fixtures and assertions are unchanged. Pre-revision hashes matched 5/5; production files remain unchanged.
- Focused netlist and connectivity tests: 7 pass, 0 fail; netlist alone remains 2 pass. Biome: exit 0. Logs: `revision-tests.log`, `revision-netlist-tests.log`, and `revision-biome.log` in the plan evidence directory.
- TypeScript probe: no diagnostic for `netlist.test.ts`; overall exit 2 on `import-layout.test.ts` and `shape-palette.ts`, owned by other plans. See `tsc-probe.log`. Final workspace typecheck and formal reviews remain downstream.
- Revision completion criteria met; `revision-final-hashes.txt` records the final owned files.
