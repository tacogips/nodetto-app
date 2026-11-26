# schematic-14-io-skip-collab

- planId: schematic-14-io-skip-collab; wave 3; dependsOn: schematic-02-ir-registry
- design: section 7.5 (Mermaid skip, D2 skip, collab fixture)
- progress log: impl-plans/progress/schematic-14-io-skip-collab.md

## Intent

Keep Mermaid and D2 exports clean for schematic pages and cover schematic
elements in collab round trips.

## Non-goals

No new export formats.

## writePaths

- packages/io/src/d2/export.ts
- packages/io/src/schematic/skip.test.ts (new)
- packages/collab/src/test-fixtures.ts
- packages/collab/src/schematic.test.ts (new)
- impl-plans/progress/schematic-14-io-skip-collab.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `d2/export.ts`: next to the breadboard skip (`isBreadboardElementType`
  around lines 565-570), skip `isSchematicElementType` elements and add one
  warning per page: `Schematic elements are not exported to D2.`
- `collab/test-fixtures.ts:allFixtures()`: add a schematic fixture (page with
  resistor, wire, junction, label, power), imitating the breadboard fixture.
- `collab/schematic.test.ts`: Y.Doc round trip, and concurrent part move +
  label `net` edit converge (imitate `packages/collab/src/breadboard.test.ts`).

## Tests

- skip.test.ts: Mermaid export of a schematic-only doc produces no nodes
  (imitate `packages/io/src/breadboard/skip.test.ts`); D2 export has no
  schematic nodes and exactly one warning.
- collab tests as above.

## Verification

- `bun test packages/io/src/schematic/skip.test.ts packages/io/src/d2/export.test.ts packages/collab/src/schematic.test.ts packages/collab/src/breadboard.test.ts`
  exits 0.
- `bunx biome check <owned .ts files>` exits 0.
