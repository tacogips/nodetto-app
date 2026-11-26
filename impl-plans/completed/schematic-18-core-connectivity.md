# schematic-18-core-connectivity

- planId: schematic-18-core-connectivity; wave 4;
  dependsOn: schematic-04-ir-sweep-netlist-model, schematic-08-core-symbols,
  schematic-09-core-coordinates-snap
- design: section 5.1 (all rules 1-7, joinable points, label groups, path
  lookup, output shape)
- progress log: impl-plans/progress/schematic-18-core-connectivity.md

## Intent

The connectivity engine: nets from pins, power pins, wire ends, junctions and
labels with the exact crossing/junction/label rules, on integer keys.

## Non-goals

No naming (plan 21), no ERC (plan 22).

## writePaths

- packages/core/src/schematic/connectivity.ts (new)
- packages/core/src/schematic/connectivity.test.ts (new)
- impl-plans/progress/schematic-18-core-connectivity.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contract

```ts
export interface SchematicPinRef { readonly elementId: ElementId; readonly pin: number }
export interface SchematicNet { readonly id: number; readonly pins: readonly SchematicPinRef[]; readonly powerIds: readonly ElementId[];
  readonly labelIds: readonly ElementId[]; readonly wireIds: readonly ElementId[]; readonly junctionIds: readonly ElementId[] }
export interface SchematicConnectivity { readonly nets: readonly SchematicNet[]; netOfPin(ref: SchematicPinRef): number | undefined;
  netOfElement(id: ElementId): number | undefined; noConnectAt(ref: SchematicPinRef): boolean;
  wireEndAttached(id: ElementId, end: 0 | 1): boolean; wireEndOnPathOf(id: ElementId, end: 0 | 1): ElementId | undefined;
  readonly stats: { sweepWork: number } }
export function computeSchematicConnectivity(document: Document, pageId: PageId): SchematicConnectivity;
```

## Rules (design 5.1, implement exactly)

- Keys from plan 09 (`pinKey`, `wirePointKeys`, `pointElementKey`); hidden
  elements ignored; element order by fractional index then id.
- Joinable: pins, power pins, wire ends, junctions, label anchors; bends not.
- Rule 1 coincident joinable points join (Map by key).
- Rule 2 wire ends join each other.
- Rule 3 junction joins every wire whose path (any segment, ends and bends
  included) contains it.
- Rule 4 label group per key: if the key has a non-label joinable point, only
  rule 1; else attach the group once to the first wire in element order whose
  path contains the key.
- Rule 5 nothing else joins. Rule 6 same trimmed `net` text joins (labels
  and power share one namespace). Rule 7 noConnect marks only.
- Path lookup with `sweepAxisContacts` (one call for horizontal, one for
  vertical); queries = junctions, unattached label groups, and unattached
  wire ends (for the hint).

## Pitfalls

- Wires are orthogonal (validated), so no diagonal path.
- Compute queries' candidate wires once; do not loop over all wires per query.

## Tests (connectivity.test.ts)

- endpoint join; wire end on a pin connects.
- shared interior vertex at (0,0) of two crossing wires: separate.
- label at a plain crossing: first wire only.
- labels A and B together on one wire: both join the wire; same pair on a
  crossing: first wire only.
- explicit junction at a crossing and at a shared bend joins both.
- T end on interior or bend without junction: separate,
  `wireEndOnPathOf` names the wire; with junction: joined.
- two same-named labels join islands; label `GND` joins power `GND`.
- hidden elements ignored.
- 1000 disjoint same-row wire segments each with a label: `stats.sweepWork <= 4N`.

## Verification

- `bun test packages/core/src/schematic/connectivity.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
