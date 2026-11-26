# schematic-09-core-coordinates-snap

- planId: schematic-09-core-coordinates-snap; wave 3;
  dependsOn: schematic-03-ir-coordinate, schematic-08-core-symbols
- design: sections 3.3 (per-field keys, moves rules 1-3), 4.2 (snap delta)
- progress log: impl-plans/progress/schematic-09-core-coordinates-snap.md

## Intent

Pure helpers for serialization-stable electrical keys and canonical move
targets, plus the schematic snap delta used by the move gesture.

## Non-goals

No editor/UI wiring (plans 17, 41), no connectivity.

## writePaths

- packages/core/src/schematic/coordinates.ts (new)
- packages/core/src/schematic/coordinates.test.ts (new)
- packages/core/src/schematic/snap.ts (new)
- packages/core/src/schematic/snap.test.ts (new)
- impl-plans/progress/schematic-09-core-coordinates-snap.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contracts (pinned)

```ts
// coordinates.ts
export function shiftedTarget(origin: number, sharedDelta: number): number; // roundCoordinate(roundCoordinate(origin) + roundCoordinate(sharedDelta))
export function canonicalTarget(value: number): number;                      // roundCoordinate(value)
export interface KeyPoint { readonly kx: number; readonly ky: number }      // integer hundredths
export function pinKey(element: Element, pin: SchematicPagePin): KeyPoint;  // coordinateKey(visual.x) + exact hundredths of (pin.x - visual.x)
export function wirePointKeys(element: Element): readonly KeyPoint[];      // coordinateKey(visual.x) + coordinateKey(points[i].x)
export function pointElementKey(element: Element): KeyPoint;              // junction/label/noConnect: coordinateKey(visual.x/y)
// snap.ts
export function schematicAnchor(element: Element): Vec | undefined;
export function snapSchematicDelta(store: Store, pageId: string, movingIds: readonly ElementId[], delta: Vec, snapping: boolean): Vec;
```

## Rules

- `pinKey`: the pin offset from `visual.x` is an exact multiple of 5 page
  units (plan 08), so compute it as `Math.round((pin.x - visual.x) * 100)`
  and add `coordinateKey(visual.x)`; never `coordinateKey(pin.x)`.
- `snapSchematicDelta`: measure from the canonical anchor of the first
  schematic element (element order). Snapping on: land the anchor on the
  lattice with `snapBreadboardPoint` (reuse from
  `packages/core/src/breadboard/snap.ts`). Snapping off: return
  `roundCoordinate(delta)`.

## Pitfalls

- Missing `visual.x` means 0 (as breadboard).
- Do not import `@nodetto/io`; `roundCoordinate`, `coordinateKey` come from ir.

## Tests

- `shiftedTarget(-1, -0.005) === -1.01`, `shiftedTarget(-0.999, -0.005) === -1.01`.
- `shiftedTarget(-0.125, 1)` key equals `coordinateKey(-0.125) + 100`.
- `canonicalTarget(0.875) === 0.88`.
- wire origin 0.004 + offset 10.004 -> key 1000; junction 10.008 -> 1001.
- pinKey for a resistor at visual.x 3.37 rotated 90: equals
  `coordinateKey(3.37)` + exact offset.
- snap on: anchor at (13, 7) delta (0,0) -> anchor lands at (10, 10);
  snap off: delta (0.004, 0) -> (0, 0).

## Verification

- `bun test packages/core/src/schematic/coordinates.test.ts packages/core/src/schematic/snap.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
