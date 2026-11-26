# schematic-21-core-netlist-names

- planId: schematic-21-core-netlist-names; wave 5; dependsOn: schematic-18-core-connectivity
- design: section 5.2 (ordering, explicit-name priority, `firstUnusedName`)
- progress log: impl-plans/progress/schematic-21-core-netlist-names.md

## Intent

Build the `SchematicNetlist` from connectivity with unique, deterministic net
names.

## Non-goals

No formatters (io plan 12), no ERC.

## writePaths

- packages/core/src/schematic/net-names.ts (new)
- packages/core/src/schematic/netlist.ts (new)
- packages/core/src/schematic/netlist.test.ts (new)
- impl-plans/progress/schematic-21-core-netlist-names.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contract

```ts
export function firstUnusedName(base: string, suffixes: Iterable<string>, taken: Set<string>): string;
export function assignNetNames(nets: readonly { code: number; explicit?: string; base: string }[]): readonly string[];
export function toSchematicNetlist(document: Document, pageId: PageId, connectivity: SchematicConnectivity): SchematicNetlist;
```

## Rules

- Components: visible parts sorted by `compareReferences` (ir) then id;
  pins from `schematicPinDefs`, partName/description from plan 08.
- Nets: every net with at least one part pin; unconnected pins one-node nets;
  nodes by component order then pin; nets by first node; codes 1..n.
- Names: explicit (alphabetically first power name, else first label text)
  reserved first and unchanged; generated `N_<ref>_<pin>`, then
  `<base>_<code>`, `<base>_<code>_2`, ... first unused.

## Tests

- second-order collision: labels `N_J3_1_3` on J1.1, `N_J3_1` on J2.1,
  J3.1 unnamed -> names `N_J3_1_3`, `N_J3_1`, `N_J3_1_3_2`, memberships
  unchanged.
- power name beats label; alphabetically first label wins.
- ordering of components (`R2` before `R10`, `R?` last) and nets.

## Verification

- `bun test packages/core/src/schematic/netlist.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
