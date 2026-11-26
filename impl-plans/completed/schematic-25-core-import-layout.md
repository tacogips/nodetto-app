# schematic-25-core-import-layout

- planId: schematic-25-core-import-layout; wave 6;
  dependsOn: schematic-02-ir-registry, schematic-21-core-netlist-names
- design: section 8.3 (input validation, part mapping from actual pins,
  names, placement, stubs and labels)
- progress log: impl-plans/progress/schematic-25-core-import-layout.md

## Intent

Lay out a `BreadboardImportPlan` (from the existing `importKicad`) as a new
schematic document whose netlist reproduces the plan's partition through net
labels on pin stubs.

## Non-goals

No CLI wiring (plan 38); no change to `importKicad` or the desktop open flow.

## writePaths

- packages/core/src/schematic/import-layout.ts (new)
- packages/core/src/schematic/import-layout.test.ts (new)
- impl-plans/progress/schematic-25-core-import-layout.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contract

```ts
export function layoutSchematicImport(plan: BreadboardImportPlan):
  { readonly document?: Document; readonly diagnostics: readonly BreadboardImportDiagnostic[] };
```

## Rules (design 8.3, implement exactly)

- Validation first (no elements created on error): `schematic.importPinInTwoNets`,
  `schematic.importTooManyPins` (P > 256).
- P = pins appearing in plan nodes (never `parameters.pinCount`).
- Mapping table: resistor/led/diode/potentiometer/battery identity when P
  subset; capacitor (`polarized` for electrolytic); transistor -> bjt by
  pinout letters E1 B2 C3; header -> connector when P is exactly 1..max and
  max <= 40; ic -> `schematic.ic` with P ascending, first ceil(|P|/2) left;
  button: two pins ascending -> 1,2, else bond groups if not split;
  fallback `schematic.ic` box with exactly P + `schematic.importPartAsBox`;
  empty P -> skip + `schematic.importSkippedPart`.
- Names: trim, first holder reserves, duplicates/empty via `firstUnusedName`
  (plan 21) with `schematic.importRenamedNet` / `schematic.importEmptyNetName`.
- Placement: rotation 0, 4-pitch gap, wrap at 120 pitches, rows separated by
  tallest box + 6 pitches; canonical coordinates.
- Stubs: 2-pitch orthogonal wire from each pin outward + label with final
  name, for every node of a >=2-node net and for a one-node net whose final
  name differs from `N_<reference>_<pin>`.
- Ids `part-<n>`, `wire-<n>`, `label-<n>`; page `{id:"page-1", kind:
  "schematic", name: "Schematic"}`; title `plan.title`.

## Tests (use `importKicad` from `@nodetto/io/kicad`; core may import io in tests)

- `test-fixtures/kicad/led-button.kicad_sch` and `.net`: page netlist
  (`computeSchematicConnectivity` + `toSchematicNetlist`) has exactly the
  plan partition and names.
- SW_SPST LEFT/RIGHT distinct; SW_Push P={1,3} -> 1,2; split PushButton ->
  ic box + warning; sparse ic 1,3,7,9 keeps pins 7 and 9 in their nets;
  41-pin `nodetto:Header` -> ic box with `LAST` on pin 41; 40 pins ->
  connector; R1.1 in two nets -> `importPinInTwoNets`, no document; 257-pin
  DIP -> `importTooManyPins`; `SENSE` singleton labelled; `A` and ` A ` ->
  `A`, `A_2` + warning; empty name -> `N_<ref>_<pin>`.
- the output document validates and is byte-stable across two runs.

Fixtures for these cases are built as strings inside the test.

## Verification

- `bun test packages/core/src/schematic/import-layout.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
