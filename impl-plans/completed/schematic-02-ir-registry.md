# schematic-02-ir-registry

- planId: schematic-02-ir-registry; wave 2; dependsOn: schematic-01-ir-semantics
- design: sections 3.2 (validation, key order, defaults), 3.3 (wire points
  `coordinates`), 3.5
- progress log: impl-plans/progress/schematic-02-ir-registry.md

## Intent

Register the 18 `schematic.*` types: defaults, key order, structural
validation. After this plan the editor and CLI can create and validate
schematic elements generically.

## Non-goals

No visual-field range check (plan 05), no golden fixture (05), no geometry.

## writePaths

- packages/ir/src/registry/schematic.ts (new)
- packages/ir/src/registry.ts
- packages/ir/src/registry/schematic.test.ts (new)
- packages/ir/src/registry.test.ts
- impl-plans/progress/schematic-02-ir-registry.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `registry/schematic.ts` exporting `SCHEMATIC_DEFINITIONS`, imitating
  `registry/breadboard.ts:BREADBOARD_DEFINITIONS` (category `"node"`,
  `references` returns `[]`, `onReferenceDeleted: "detach"`).
  - Defaults (design 3.2 table): resistor `10k`, capacitor `100n` +
    `polarized: false`, inductor `10u`, diode `1N4148`, led `LED`, bjt `NPN`
    + `polarity: "npn"`, mosfet `NMOS` + `channel: "n"`, switch `SW` +
    `style: "toggle"`, potentiometer `10k`, battery `9V`, voltageSource `5V`,
    connector `CONN` + `pinCount: 2`, ic `IC` + pins 1-4 left, 5-8 right,
    names empty; references `<prefix>?`; power `{style:"ground", net:"GND"}`;
    label `{net:"NET"}`; wire default two points `(0,0)`,`(20,0)`.
  - Key order: parts `reference`, `value`, then extra fields in table
    order; `ic.pins` children `number`, `name`, `side`; power `style`, `net`;
    label `net`; wire `points` with children `{keys:["x","y"],
    coordinates:["x","y"]}` (the `coordinates` list makes the JSONL writer
    round them; see `packages/ir/src/keyOrder.ts` `coordinates`).
  - `validateSemantic` errors (codes exact): `schematic.wirePoints` (<2
    points), `schematic.wireDiagonal` (consecutive points share neither x nor
    y), `schematic.icPins` (empty list, number not positive integer, duplicate
    number, more than 256), `schematic.coordinateRange` (any point x/y with
    magnitude > `SCHEMATIC_COORDINATE_LIMIT`), plus enum/integer checks
    (`pinCount` integer 1..40) via the existing helpers used by breadboard.
- `registry.ts`: import and register `SCHEMATIC_DEFINITIONS` next to
  `BREADBOARD_DEFINITIONS`.
- `registry.test.ts`: extend the exact-list test "registers the design table
  plus assets and token resources" with the 18 types (only that list).

## Pitfalls

- Electrical correctness is never a validation error (design 3.2).
- `wireDiagonal` compares raw stored numbers; equal coordinates mean
  horizontal or vertical. Zero-length segments are allowed.
- Validation must not throw on malformed payloads (non-array points); return
  diagnostics like breadboard does.

## Tests (registry/schematic.test.ts)

- default of every type validates with no diagnostics.
- wire with 1 point -> `schematic.wirePoints`.
- wire `[(0,0),(10,10)]` -> `schematic.wireDiagonal`; `[(0,0),(10,0),(10,5)]`
  -> none.
- ic with duplicate number 3 -> `schematic.icPins`; 257 pins ->
  `schematic.icPins`; sparse 1,3,7,9 -> valid.
- connector `pinCount: 41` -> error; `40` valid.
- wire point x `2e9` -> `schematic.coordinateRange`; `1e9` valid.
- bjt `polarity: "xyz"` -> enum error.

## Verification

- `bun test packages/ir/src/registry/schematic.test.ts packages/ir/src/registry.test.ts`
  exits 0.
- `bunx biome check <owned .ts files>` exits 0.

## Done criteria

All test bullets pass; registry.test.ts change is only the 18 added names.
