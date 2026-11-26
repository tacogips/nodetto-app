# schematic-29-core-tools-catalogue

- planId: schematic-29-core-tools-catalogue; wave 8; dependsOn: schematic-28-core-exports
- design: section 7.3 (Tools, Shape search)
- progress log: impl-plans/progress/schematic-29-core-tools-catalogue.md

## Intent

Schematic tool ids, creation table and the shape-search category, so the UI
palette and the CLI `shapes`/`edit add {"shape": ...}` see schematic symbols.

## writePaths

- packages/core/src/tools.ts
- packages/core/src/shape-catalogue.ts
- packages/core/src/index.ts
- packages/core/src/schematic/tools.test.ts (new)
- impl-plans/progress/schematic-29-core-tools-catalogue.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `tools.ts`: `Tool.Schematic*` ids `schematic:<kind>` (resistor, capacitor,
  capacitor-polarized, inductor, diode, led, npn, pnp, nmos, pmos, switch,
  push-button, potentiometer, battery, voltage-source, connector, ic, ground,
  power-rail, wire, junction, label, no-connect); `SCHEMATIC_TOOLS`,
  `SchematicToolKind`, `SCHEMATIC_CREATIONS` entries for `creationFor`
  (imitate `BREADBOARD_TOOLS`/`BREADBOARD_CREATIONS`): wire has no creation
  type (gesture tool). Include the schematic tools in every aggregate list or
  union that already includes the breadboard tools (for example `TOOLS`,
  `ToolKind`, `canUseTool`), exactly as breadboard does.
- `shape-catalogue.ts`: category `{id:"schematic", label:"Schematic"}` with
  every tool except wire.
- `core/index.ts`: export `SCHEMATIC_TOOLS`, `SchematicToolKind` next to the
  breadboard tool exports (~line 746).

## Tests

- every schematic tool except wire has `creationFor` with a `schematic.*`
  type and the right patch (npn `{polarity:"npn"}`, push-button
  `{style:"push"}`, ground `{style:"ground", net:"GND"}`).
- shape catalogue category `schematic` lists 22 entries.

## Verification

- `bun test packages/core/src/schematic/tools.test.ts packages/core/src/schematic/index.test.ts`
  exits 0. `index.test.ts` is plan 28's test on the shared
  `packages/core/src/index.ts`.
- `bunx biome check <owned .ts files>` exits 0.
