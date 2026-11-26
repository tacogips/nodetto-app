# schematic-01-ir-semantics

- planId: schematic-01-ir-semantics; wave 1; dependsOn: none
- design: sections 3.1, 3.2 (type table, enums, prefixes), 3.4 (types only)
- progress log: impl-plans/progress/schematic-01-ir-semantics.md
- protocol: impl-plans/active/schematic-00-overview.md

## Intent

Add the `schematic` page kind and mode plus the type-level contract (type
lists, prefixes, enums, payload types, pitch and coordinate limit) that every
later plan compiles against. No registry definitions yet (plan 02).

## Non-goals

No registry, validation, key order, geometry, golden fixture or netlist model
(plans 02, 04, 05, 08). No change to any existing kind, mode or type.

## writePaths

- packages/ir/src/types.ts
- packages/ir/src/semantics/schematic.ts (new)
- packages/ir/src/semantics.ts
- packages/ir/src/index.ts
- packages/ir/src/semantics/schematic.test.ts (new)
- apps/cli/src/types-command.ts (only the `TYPICAL` entry)
- impl-plans/progress/schematic-01-ir-semantics.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `types.ts`: append `"schematic"` to `PAGE_KINDS` (after `CAD_PAGE_KIND` is
  fine, keep all existing entries and order) and to `PAGE_MODES` (before
  `"all"`); add `schematic: "schematic"` to `DEDICATED_PAGE_MODES`.
- `semantics/schematic.ts` (imitate `semantics/breadboard.ts`):
  - `SCHEMATIC_PITCH = 10`, `SCHEMATIC_COORDINATE_LIMIT = 1e9`.
  - `SCHEMATIC_ELEMENT_TYPES` (18, `as const`): `schematic.resistor`,
    `capacitor`, `inductor`, `diode`, `led`, `bjt`, `mosfet`, `switch`,
    `potentiometer`, `battery`, `voltageSource`, `connector`, `ic`, `power`,
    `wire`, `junction`, `label`, `noConnect`.
  - `SCHEMATIC_PART_TYPES` (the first 13), `isSchematicElementType`,
    `isSchematicPartType`, `SCHEMATIC_REFERENCE_PREFIX` (R, C, L, D, D, Q,
    Q, SW, RV, BT, V, J, U).
  - Enums: `SCHEMATIC_BJT_POLARITIES = ["npn","pnp"]`,
    `SCHEMATIC_MOSFET_CHANNELS = ["n","p"]`,
    `SCHEMATIC_SWITCH_STYLES = ["toggle","push"]`,
    `SCHEMATIC_POWER_STYLES = ["ground","rail"]`,
    `SCHEMATIC_IC_SIDES = ["left","right","top","bottom"]`,
    `SCHEMATIC_CONNECTOR_MAX_PINS = 40`, `SCHEMATIC_IC_MAX_PINS = 256`.
  - Payload interfaces: parts carry `reference: string; value: string` plus
    design 3.2 fields (`polarized: boolean`, `polarity`, `channel`, `style`,
    `pinCount: number`, `pins: readonly {number; name; side}[]`); `power`
    `{style; net}`; `wire` `{points: readonly {x; y}[]}`; `label` `{net}`;
    `junction` and `noConnect` `{}` (use `Readonly<Record<string, never>>`
    the way breadboard declares empty payloads, if any; else an empty
    interface type alias).
- `semantics.ts`: `export * from "./semantics/schematic.ts"` next to the
  breadboard line, and add the 18 entries to `SemanticByType`.
- `index.ts`: export the new names the way breadboard names are exported
  (ir index uses explicit named exports from `./semantics.ts`).
- `apps/cli/src/types-command.ts:TYPICAL` is a `Record<PageKind, ...>`
  (line ~45), so it must gain `schematic: [the 18 type names in
  SCHEMATIC_ELEMENT_TYPES order]` in this plan (precedent: the breadboard
  plan 01 checkpoint amendment). Touch nothing else in that file.

## Patterns to imitate

`packages/ir/src/semantics/breadboard.ts:BREADBOARD_ELEMENT_TYPES`,
`isBreadboardElementType`, `BREADBOARD_REFERENCE_PREFIX`;
`packages/ir/src/types.ts:DEDICATED_PAGE_MODES`.

## Pitfalls

- `PAGE_KINDS` drives the inspector select and validation; appending is
  fine, reordering is not.
- `SemanticByType` is exhaustive over registered types; adding keys here
  without registry definitions must still typecheck (plan 02 adds the
  definitions). If a mapped-type consistency check exists between registry and
  `SemanticByType`, do not change it; plan 02 completes it.
- Do not add a `schematic` case to any switch outside ir.

## Tests (packages/ir/src/semantics/schematic.test.ts)

- `PAGE_KINDS` contains `schematic`; `pageModeOf({kind:"schematic"})` is
  `"schematic"`.
- `SCHEMATIC_ELEMENT_TYPES.length === 18`, part list is a prefix subset of 13.
- `isSchematicElementType("schematic.wire")` true; `"breadboard.wire"` false.
- Every part type has a prefix; `schematic.ic` -> `U`.

## Verification

- `bun test packages/ir/src/semantics/schematic.test.ts` exits 0, >= 4 pass.
- `bun test packages/ir/src/page-content.test.ts packages/ir/src/breadboard.test.ts packages/ui-solid/src/canvas/canvas-background.test.ts apps/cli/src/capture-command.test.ts`
  exits 0. These existing tests loop over `PAGE_KINDS`, so they now also
  exercise an empty `schematic` page. Do not edit them. If one fails only
  because generic code mishandles a new kind (for example a kind-to-label
  map typed `Record<PageKind, ...>`), add the `schematic` entry in that
  generic file, list the file in the progress log as a checkpoint amendment
  and re-run.
- `bunx biome check <owned .ts files>` exits 0.

## Done criteria

- All four test bullets present and passing; existing ir tests named above
  pass; progress log complete with hashes and command logs.
