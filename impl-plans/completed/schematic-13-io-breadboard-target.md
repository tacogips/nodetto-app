# schematic-13-io-breadboard-target

- planId: schematic-13-io-breadboard-target; wave 5; dependsOn: schematic-12-io-formatters
- design: section 8.1 steps 2a-2d (projectability preflight, direct
  `mapKicadSymbol`, equivalence)
- progress log: impl-plans/progress/schematic-13-io-breadboard-target.md

## Intent

Project a `SchematicNetlist` into a `BreadboardNetlistSemantic` target for
the existing breadboard parity card, or fail explicitly.

## Non-goals

No editor intent (plan 26), no UI (37), no CLI (38).

## writePaths

- packages/io/src/schematic/breadboard-target.ts (new)
- packages/io/src/schematic/breadboard-target.test.ts (new)
- packages/io/src/schematic/index.ts
- packages/io/src/index.ts
- impl-plans/progress/schematic-13-io-breadboard-target.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contract

```ts
export function breadboardTargetFromSchematic(netlist: SchematicNetlist, options: { pageName: string }):
  { readonly target?: BreadboardNetlistSemantic; readonly diagnostics: readonly BreadboardImportDiagnostic[] };
```

## Rules

1. Preflight (one pass, Map of references): `schematic.duplicateReference`
   (lists all holders' element ids), `schematic.unannotatedReference`
   (reference ends with `?`), `schematic.unprojectablePart` (pin numbers not
   exactly 1..n, or n > 40). Any error -> no target.
2. Map each component via `mapKicadSymbol` (`packages/io/src/kicad/symbol-map.ts`,
   unchanged) with `lib "nodetto"`, its `partName`, reference, value, pins
   (number as string, name), footprint `""`. Pass mapping warnings through.
3. Translate nodes with a per-reference pinMap lookup; sort nodes by
   component natural order (`compareReferences`) then mapped pin; nets by
   first node; names verbatim.
4. Return `{source: "<pageName>.net", format: "kicad_net", parts, nets}`.
- `schematic/index.ts` and `packages/io/src/index.ts`: export the function
  and the formatters from plan 12.

## Pitfalls

- Never re-parse KiCad text in production code; the round trip is test-only.
- Switch maps to button pins 1 and 3 (row 9 `SW_Push`).

## Tests

- equivalence: for a projectable netlist with every symbol type, target
  equals `importKicad(exportSchematicKicadNetlist(n).text, {fileName}).plan.target`.
- sparse ic 1,3,7,9 -> `unprojectablePart`, no target; 48 pins -> same.
- dense 8-pin ic -> DIP-8 with nodes on pins 1..8 only; 5-pin ic -> header.
- duplicate `R1` (resistor + switch) -> `duplicateReference`, no target;
  `R?` -> `unannotatedReference`.

## Verification

- `bun test packages/io/src/schematic/breadboard-target.test.ts packages/io/src/kicad/symbol-map.test.ts packages/io/src/schematic/formatters.test.ts`
  exits 0. `formatters.test.ts` is plan 12's test on the shared
  `packages/io/src/schematic/index.ts`.
- `bunx biome check <owned .ts files>` exits 0.
