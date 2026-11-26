# schematic-41-ui-keys-drag

- planId: schematic-41-ui-keys-drag; wave 11; dependsOn: schematic-39-ui-wire-tool
- design: sections 7.3 Keys, 3.3 Moves rule 1 (drag), 4.2 snap
- progress log: impl-plans/progress/schematic-41-ui-keys-drag.md

## writePaths

- packages/ui-solid/src/interaction/circuit.ts
- packages/ui-solid/src/interaction/transform.ts
- packages/ui-solid/src/schematic-keys-move.test.ts (new)
- impl-plans/progress/schematic-41-ui-keys-drag.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `circuit.ts:rotatePartsByKey`: on a schematic page with schematic parts,
  power or labels selected and no modifier: `r` -> rotate clockwise,
  `Shift+R` counter-clockwise, `x` -> mirror parts. Elsewhere unchanged;
  `TOOL_KEYS` unchanged.
- `transform.ts` (~lines 243-249, where breadboard uses
  `snapBreadboardDelta`): when the moving set has a schematic element, compute
  the delta with `snapSchematicDelta` (snapping on or off) and build every
  schematic element's destination with `shiftedTarget(origin, delta)` before
  calling `editor.moveElements`. Non-schematic elements unchanged.

## Tests

- `r` on a selected schematic resistor rotates; `r` on a freeform page with
  nothing schematic keeps the rectangle tool behaviour; `x` mirrors.
- drag tie: joined origins -1 and -0.999 with snapping off and drag delta
  -0.005 -> both -1.01.
- drag with snapping on lands the anchor on the lattice.

## Verification

- `bun test packages/ui-solid/src/schematic-keys-move.test.ts packages/ui-solid/src/breadboard-interaction.test.ts packages/ui-solid/src/schematic-wire.test.ts`
  exits 0. `schematic-wire.test.ts` is plan 39's test on the shared
  `circuit.ts`.
- `bunx biome check <owned .ts files>` exits 0.
