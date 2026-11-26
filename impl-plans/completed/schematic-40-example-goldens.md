# schematic-40-example-goldens

- planId: schematic-40-example-goldens; wave 8;
  dependsOn: schematic-13-io-breadboard-target, schematic-28-core-exports
- design: sections 10 (example), 11 (`export-golden.test.ts`)
- progress log: impl-plans/progress/schematic-40-example-goldens.md

## writePaths

- examples/schematic/led-switch.jsonl (new)
- examples/schematic/README.md (new)
- examples/schematic/led-switch.netlist.txt (new)
- examples/schematic/led-switch.net (new)
- packages/core/src/schematic/export-golden.test.ts (new)
- impl-plans/progress/schematic-40-example-goldens.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- Example (design 10): BT1 `9V` with a `VCC` rail symbol on `+` and a ground
  on `-`; SW1 toggle from `VCC` to a `SW_OUT` label; R1 `470` from `SW_OUT`
  to D1; D1 cathode to ground; C1 `100n` from `SW_OUT` to ground through a
  junction T. Lattice coordinates, canonical JSONL.
- Goldens generated once from the real pipeline (core connectivity +
  `toSchematicNetlist` + io formatters) and committed; the test compares byte
  for byte.
- README: what the example shows and the expected lint and nets.

## Tests (export-golden.test.ts; imitate `breadboard/export-golden.test.ts`)

- `lintSchematicPage` returns no findings; nets `GND`, `SW_OUT`, `VCC`,
  `N_R1_2`.
- text and KiCad outputs equal the golden files.
- SVG export of the example in a light and a dark `SvgTheme` contains the
  expected role counts (1 `schematic-junction`, 5 symbol bodies).

## Verification

- `bun test packages/core/src/schematic/export-golden.test.ts` exits 0.
- `bunx biome check packages/core/src/schematic/export-golden.test.ts` exits 0.
