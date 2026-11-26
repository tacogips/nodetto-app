# schematic-36-ui-creation

- planId: schematic-36-ui-creation; wave 9; dependsOn: schematic-29-core-tools-catalogue
- design: section 7.3 Creation
- progress log: impl-plans/progress/schematic-36-ui-creation.md

## Intent

Clicking a schematic palette tool on the canvas creates the element through
`editor.createSchematicElement`; label creation selects the label so the
inspector can focus its net field.

## writePaths

- packages/ui-solid/src/interaction/creation.ts
- packages/ui-solid/src/interaction/context.ts
- packages/ui-solid/src/schematic-interaction.test.ts (new)
- impl-plans/progress/schematic-36-ui-creation.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `context.ts`: `isSchematicPage()` next to `isBreadboardPage()`.
- `creation.ts`: branch for `creation.type.startsWith("schematic.")` calling
  `editor.createSchematicElement(type, point, patch)` and selecting the new
  id (imitate the breadboard branch ~lines 45-55). Wire tool is handled by
  plan 39; leave a guard so `Tool.SchematicWire` does nothing here.

## Tests (imitate `breadboard-interaction.test.ts`)

- resistor tool click on a schematic page creates `R1` at the snapped point
  and selects it; label tool creates `net:"NET"` selected; breadboard
  creation unchanged.

## Verification

- `bun test packages/ui-solid/src/schematic-interaction.test.ts packages/ui-solid/src/breadboard-interaction.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
