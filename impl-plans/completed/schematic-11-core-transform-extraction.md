# schematic-11-core-transform-extraction

- planId: schematic-11-core-transform-extraction; wave 4;
  dependsOn: schematic-08-core-symbols, schematic-09-core-coordinates-snap
- design: sections 4.2 (rotation, mirror, `planAnchoredRotation` with
  `pivot`), 5.3 (`annotateReferences`)
- progress log: impl-plans/progress/schematic-11-core-transform-extraction.md

## Intent

Extract the breadboard rotation and annotation logic into shared helpers with
identical breadboard results, and add schematic rotate/mirror/annotate
planners that keep the anchor's position key exactly.

## Non-goals

No Editor facade methods (plan 16), no UI.

## writePaths

- packages/core/src/breadboard/rotate.ts
- packages/core/src/breadboard/annotate.ts
- packages/core/src/schematic/transform.ts (new)
- packages/core/src/schematic/transform.test.ts (new)
- impl-plans/progress/schematic-11-core-transform-extraction.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contracts

```ts
// breadboard/rotate.ts
export function planAnchoredRotation(store: Store, ids: readonly ElementId[], quarterTurns: 1 | -1,
  options: { accepts(element: Element): boolean; pinsOf(element: Element): readonly Vec[]; pivot(point: Vec): Vec }): Command[];
// planBreadboardRotation delegates with pivot = snapBreadboardPoint (unchanged results)
// breadboard/annotate.ts
export function annotateReferences(existing: readonly string[], incoming: readonly { prefix: string; reference: string }[]): readonly string[];
// annotateBreadboardParts delegates with BREADBOARD_REFERENCE_PREFIX[type]
// schematic/transform.ts
export function planSchematicRotation(store: Store, ids: readonly ElementId[], quarterTurns: 1 | -1): Command[]; // parts, power, labels
export function planSchematicMirror(store: Store, ids: readonly ElementId[]): Command[];                      // parts only, toggles flipX
export function planSchematicAnnotation(store: Store, pageId: string): Command[];
```

## Rules

- Schematic rotation/mirror: new `visual.x` = `roundCoordinate(old visual.x)`
  + exact change of the anchor's in-box offset, so the anchor `pinKey` is
  unchanged (design 4.2). Labels rotate about their own point (no x/y change).
- Annotation: duplicates and `?` references renumbered, first holder keeps,
  as `planBreadboardAnnotation`.

## Pitfalls

- Do not change any breadboard result: existing breadboard tests are the
  guard and must stay unedited.
- Do not round the schematic pivot to the lattice.

## Tests (transform.test.ts)

- off-grid resistor anchor at (3.37, 0): rotate 90 -> anchor pinKey equal
  before/after; 4 rotations return to the original visual.
- on-lattice anchor: all pins on the 10-unit lattice after each rotation.
- mirror toggles flipX and keeps the anchor key; second mirror restores.
- label rotates, x/y unchanged; wire ignored.
- annotation: two `R1` -> second becomes `R2`; `C?` -> `C1`.

## Verification

- `bun test packages/core/src/schematic/transform.test.ts packages/core/src/breadboard/annotate.test.ts packages/core/src/breadboard/editor-breadboard.test.ts`
  exits 0 (breadboard tests unchanged).
- `bunx biome check <owned .ts files>` exits 0.
