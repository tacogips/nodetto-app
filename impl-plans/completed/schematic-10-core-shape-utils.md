# schematic-10-core-shape-utils

- planId: schematic-10-core-shape-utils; wave 3; dependsOn: schematic-08-core-symbols
- design: section 4.3
- progress log: impl-plans/progress/schematic-10-core-shape-utils.md

## Intent

Register shape utils for the 18 schematic types (bounds, hit-test, no
resize) and the two lookup helpers used by the wire tool.

## Non-goals

No rendering, no snapping, no wire tool.

## writePaths

- packages/core/src/shapes/schematic.ts (new)
- packages/core/src/shapes/schematic.test.ts (new)
- packages/core/src/shapes/index.ts
- impl-plans/progress/schematic-10-core-shape-utils.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `shapes/schematic.ts`: `schematicShapeUtils` imitating
  `packages/core/src/shapes/breadboard.ts:breadboardShapeUtils`:
  - `getBounds`: symbol box for parts/power (`schematicBox`), wire point
    bounds grown by 3 page units, 6-unit square for junction/noConnect,
    estimated text box for label (reuse the text width estimator the
    breadboard labels use).
  - `hitTest`: box for parts/power/labels; within 4 units of a segment for
    wires; within 4 units of the point for junction/noConnect.
  - `canResize` false for all.
- Export helpers:
  `schematicPinAt(store, pageId, point): SchematicSnapTarget | undefined`
  returns the nearest joinable target within 4 units: part pin, power pin,
  wire end, junction, label anchor (never a wire bend).
  `SchematicSnapTarget = {kind: "pin"|"power"|"wireEnd"|"junction"|"label"; elementId; pin?; end?: 0|1; x; y}`.
  `schematicWireInteriorAt(store, pageId, point): readonly ElementId[]`
  returns wires whose path contains the point away from their ends (bends
  count as path).
- `shapes/index.ts`: register `schematicShapeUtils` next to
  `breadboardShapeUtils`.

## Pitfalls

- These are UI-hover helpers: linear scans over the page are acceptable, no
  index needed. Skip hidden elements.
- Ties: prefer the nearest; equal distance -> element order.

## Tests

- getBounds per type non-empty; resize disabled.
- hitTest on a wire segment midpoint true, 5 units off false.
- schematicPinAt near a resistor pin returns kind `pin` with its number; near
  a wire bend returns undefined; near a wire end returns `wireEnd`.
- schematicWireInteriorAt on a segment interior returns the wire; on its end
  returns [].

## Verification

- `bun test packages/core/src/shapes/schematic.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
