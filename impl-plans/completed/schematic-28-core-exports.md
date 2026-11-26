# schematic-28-core-exports

- planId: schematic-28-core-exports; wave 7;
  dependsOn: schematic-10-core-shape-utils, schematic-16-core-editor-intents,
  schematic-17-core-move-contract, schematic-22-core-erc,
  schematic-23-core-connectivity-roundtrip, schematic-24-core-svg-export,
  schematic-25-core-import-layout, schematic-26-core-breadboard-target-intent,
  schematic-27-core-pcb-parity
- design: section 12 (core exports used by ui-solid, cli, desktop)
- progress log: impl-plans/progress/schematic-28-core-exports.md

## Intent

Expose the schematic core API through `@nodetto/core` in one serial step so
parallel core plans never edited a shared barrel.

## writePaths

- packages/core/src/schematic/index.ts (new)
- packages/core/src/index.ts
- packages/core/src/schematic/index.test.ts (new)
- impl-plans/progress/schematic-28-core-exports.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `schematic/index.ts`: `export *` from symbols, coordinates, snap,
  transform, connectivity, net-names, netlist, erc, notation, import-layout,
  target-card, pcb-parity; plus `schematicShapeUtils`, `schematicPinAt`,
  `schematicWireInteriorAt` from `../shapes/schematic.ts` and `UnionFind` is
  NOT exported (internal).
- `core/index.ts`: `export * from "./schematic/index.ts"` next to the
  breadboard line (373). Resolve any name clash by renaming at the barrel only
  if a clash exists; report it in the progress log.

## Tests (index.test.ts)

- importing from `../index.ts` (core root) exposes
  `computeSchematicConnectivity`, `lintSchematicPage`, `toSchematicNetlist`,
  `layoutSchematicImport`, `schematicNotation`, `schematicPcbParityFindings`,
  `shiftedTarget`, `snapSchematicDelta` as functions.

## Verification

- `bun test packages/core/src/schematic/index.test.ts` exits 0.
- `bun test packages/core/src/schematic` exits 0 (all schematic core tests).
- `bunx biome check <owned .ts files>` exits 0.
