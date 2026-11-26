# schematic-06-io-kicad-netlist-linear

- planId: schematic-06-io-kicad-netlist-linear; wave 1; dependsOn: none
- design: section 8.3 "Existing importer work bounds" (netlist.ts bullets,
  `stats` option), 13 item 19
- progress log: impl-plans/progress/schematic-06-io-kicad-netlist-linear.md

## Intent

Make the existing KiCad `.net` importer linear without changing any result,
and add the optional `stats` option to `importKicad`. The schematic import
(plan 38) runs this importer on the native CLI.

## Non-goals

No change to diagnostics, net names, node order, symbol mapping or the
`.kicad_sch` importer (plans 15, 20). No `diagonalBudget` (plan 15).

## writePaths

- packages/io/src/kicad/netlist.ts
- packages/io/src/kicad/index.ts
- packages/io/src/kicad/netlist.test.ts
- impl-plans/progress/schematic-06-io-kicad-netlist-linear.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `index.ts:importKicad(text, options: {fileName: string; stats?: KicadImportStats})`
  with `export interface KicadImportStats { nodeVisits: number;
  segmentCandidates: number; diagonalWork: number; diagonalBudgetLimit?: number;
  labelVisits: number }`. Pass `stats` to `importNetlist` and (unused until
  plan 15) to `importSchematic` as an optional trailing parameter.
- `netlist.ts`:
  - lines ~79-85: build `Map<reference, nodeRow[]>` once from all nets
    before the component loop; look up per component.
  - lines ~160-176: build a `Set` of `` `${reference}\u0000${pin}` `` while
    collecting `netParts`; the singleton check reads the set.
  - `stats.nodeVisits += 1` for every node row visited.

## Pitfalls

- Preserve the first-seen order of node rows per reference (the original
  filter kept net order then node order).
- Duplicate-reference components keep the existing skip and diagnostic.
- Do not change the shape of `BreadboardImportResult`.

## Tests (netlist.test.ts, additions only)

- N=500 resistors, 2 nodes each in distinct 2-node nets: `stats.nodeVisits
  <= 2 * nodes + nets`.
- existing fixtures (`test-fixtures/kicad/led-button.net`,
  `unknown-symbols.net`) produce exactly the same plans as before (existing
  assertions unchanged).

## Verification

- `bun test packages/io/src/kicad/netlist.test.ts packages/io/src/kicad/symbol-map.test.ts packages/core/src/breadboard/kicad-golden.test.ts`
  exits 0.
- `bunx biome check <owned .ts files>` exits 0.

## Done criteria

Existing assertions untouched and passing; new work-count test passes.
