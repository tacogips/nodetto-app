# schematic-47-core-snap-exclude

- planId: schematic-47-core-snap-exclude; wave 9;
  dependsOn: schematic-10-core-shape-utils (sole earlier owner of
  `packages/core/src/shapes/schematic.ts` and its test)
- design: section 3.3 "Key-preserving interactive writes", section 4.3,
  section 7.3 "Electrical classification at the key" and wire point rule 4,
  section 13 item 20 (revision 12)
- progress log: impl-plans/progress/schematic-47-core-snap-exclude.md
- revision: 2 (SCH-DESIGN-WIRE-CANONICAL-CONTACT, comm-000004;
  SCH-DESIGN-DRAG-LABEL, comm-000050)

## Intent

Give the wire tool (plan 39) and wire point editing (plan 46) one core
contract. Proximity ranking excludes the edited wire, and contacts are
counted at the stored-field electrical key, with key-preserving write
helpers. Scope change from revision 1: this plan no longer stops at
exclusion. It also supplies the key-based contact lookup, and no longer
touches `schematicWireInteriorAt`.

## Non-goals

- No behaviour change for existing callers. `excludeId` is optional, and
  `key` is an added field. `schematicWireInteriorAt` and the connectivity
  engine stay unchanged.

## writePaths

- packages/core/src/shapes/schematic.ts
- packages/core/src/shapes/schematic.test.ts
- packages/core/src/schematic/coordinates.ts
- packages/core/src/schematic/index.ts (named re-export of
  `schematicContactsAt` and `SchematicContacts`)
- impl-plans/progress/schematic-47-core-snap-exclude.md, target, tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Repository context

- `shapes/schematic.ts` `schematicPinAt` (~125-173) ranks targets by raw
  distance within `RADIUS`. `schematicWireInteriorAt` (~174-195) is
  raw-position based.
- `schematic/coordinates.ts`: `KeyPoint`, `pinKey`, `wirePointKeys`,
  `pointElementKey`. Connectivity (`connectivity.ts` ~170-190) treats a key
  as interior when it lies on an axis segment of `wirePointKeys` and is not
  that wire's first or last key. Bends count as interior.

## Changes

- `coordinates.ts`: `keyCoordinate(k) = roundCoordinate(k * 0.01)` and
  `localCoordinateForKey(k, originField) = keyCoordinate(k -
  coordinateKey(originField))`.
- `SchematicSnapTarget` gains `readonly key: KeyPoint`. `schematicPinAt(store,
  pageId, point, excludeId?: ElementId)` skips the excluded element before
  `consider`. The key comes from `pinKey`, the first or last
  `wirePointKeys` entry, or `pointElementKey`. Compute it for the winner
  only, or cheaply per candidate, without per-element allocation beyond
  what exists today.
- `schematicContactsAt(store, pageId, key, excludeId?) : SchematicContacts
  = {wires: readonly ElementId[]; labels: readonly ElementId[]; joinables:
  number}` counts at exactly `key`. It skips hidden and excluded elements
  and makes one linear pass. `wires` uses the engine's interior rule on
  `wirePointKeys`. `joinables` counts pins, power pins, wire ends and
  junctions.

## Tests (append to schematic.test.ts; existing cases unchanged)

- Exclusion: wire W with an end at (0,0) and a resistor pin at (3,0). At
  (1,0) `schematicPinAt` returns W's end with key (0,0). With `excludeId: W`
  it returns the pin with its `pinKey`.
- Canonical crossing: wire A from (-20,0) to (20,0), wire B stored at
  `visual.x = 0.004` with local points (0,-20),(0,20), label CLK at (0,0).
  `schematicContactsAt` at key (0,0) gives `wires` [A, B] (order-free),
  `labels` [CLK] and `joinables` 0. With B excluded it gives [A]. The same
  holds after `serializeDocument` / `parseDocument` from `@nodetto/io`
  into a fresh store, as in `connectivity-roundtrip.test.ts`.
- A key equal to a wire's own end is not interior to that wire, while a
  bend key is.
- `localCoordinateForKey(-1000, -0.125)` is `-9.87`, and
  `coordinateKey(-0.125) + coordinateKey(-9.87) = -1000`.

## Verification

- `bun test packages/core/src/shapes/schematic.test.ts` exits 0.
- `bunx biome check packages/core/src/shapes/schematic.ts packages/core/src/shapes/schematic.test.ts packages/core/src/schematic/coordinates.ts packages/core/src/schematic/index.ts` exits 0.

## Done criteria

Gate passes, no existing assertion is edited, and nothing outside writePaths
is edited.
