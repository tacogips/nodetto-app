# kicad-pcb-08-core-shapes

- planId: kicad-pcb-08-core-shapes
- planPath: impl-plans/completed/kicad-pcb-08-core-shapes.md
- wave: 2; dependsOn: kicad-pcb-01-ir-core-contracts
- design: design-docs/specs/design-kicad-pcb.md section 6.1
- progress log: impl-plans/progress/kicad-pcb-08-core-shapes.md
- protocol: impl-plans/completed/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Register shape utils for the six `pcb.*` types, so the editor can compute
bounds, hit-test, select and marquee-select PCB elements. Geometry comes
from the semantic, in mm times `PCB_PAGE_SCALE`.

## Repository context (imitate)

- `packages/core/src/shapes/breadboard.ts:breadboardShapeUtils` and its
  registration in `packages/core/src/shapes/index.ts` (line ~130,
  `for (const util of breadboardShapeUtils) registry.register(util)`).
- `packages/core/src/shape-util.ts:ShapeUtil` (`getBounds`, `hitTest`,
  `canResize`, `defaultSemantic`, `defaultVisual`).
- `packages/core/src/shapes/breadboard.test.ts`: the test style.
- Plan 01 helpers: `footprintBounds`, `shapeBounds`, `padCopperOutline`,
  `outlineContains`; `buildPcbDocument`.

## Non-goals

- No rendering (the ui-solid views are plan 11). No resize. No ports.
- Do not edit `packages/core/src/rotation.ts`.

## writePaths

- packages/core/src/shapes/pcb.ts (new)
- packages/core/src/shapes/pcb.test.ts (new)
- packages/core/src/shapes/index.ts
- impl-plans/progress/kicad-pcb-08-core-shapes.md (new)

## sharedPaths

none

## Pinned behaviour

- `export const pcbShapeUtils: readonly ShapeUtil[]`, one per type, all
  with `canResize: false`.
- Bounds, in page units (multiply mm by `PCB_PAGE_SCALE`):
  - footprint: `footprintBounds`
  - track: point bounds grown by `width/2`, including `mid` for arcs
  - via: the disc
  - zone: the outline bounds
  - graphic: `shapeBounds(shape, width)`
  - board: `null`
- Hit tests (page point -> mm by dividing by the scale):
  - footprint: inside its bounds box
  - track: distance to any segment `<= max(width/2, 0.1)`
  - via: inside the disc
  - zone: within 0.25 mm of an outline edge only (inside the pour is not
    a hit)
  - graphic: within `max(width/2, 0.1)` of its stroke, or inside a filled
    polygon, rect or circle
  - board: false
- `defaultSemantic()` returns a minimal valid semantic for each type,
  matching the IR validation (for example a track `{layer: "F.Cu", width:
  0.25, net: "", points: [[0,0],[1,0]]}`). `defaultVisual()` returns `{}`.

## Pitfalls

- Never read `visual.x`, `visual.y`, `visual.width` or `visual.height`
  for pcb elements.
- Hit-test distances in mm, not page units: convert once.
- Zone hit-testing must not swallow clicks inside the pour (design 6.1).

## Tests (input -> expected)

- A footprint at (10, 10) mm with one 2x2 pad -> bounds
  `{x: 90, y: 90, width: 20, height: 20}`.
- A track 0.25 wide from (0,0) to (10,0) -> hit at (50, 1) page; no hit
  at (50, 5).
- A zone with a 10 mm square outline -> hit near the edge; no hit at the
  centre.
- `pcb.board` bounds -> `null`.
- `createDefaultRegistry().get("pcb.via")` exists, and its
  `canResize` is false.
- Each `defaultSemantic()` passes IR validation.

## Verification

1. `bun test packages/core/src/shapes` exits 0.
2. `bun run typecheck` exits 0.
3. `bunx biome check packages/core/src/shapes/pcb.ts packages/core/src/shapes/pcb.test.ts packages/core/src/shapes/index.ts --diagnostic-level=warn`
   exits 0.

## Done criteria

- `grep -c "pcbShapeUtils" packages/core/src/shapes/index.ts` is at
  least 1.
- All verification steps are recorded with exit code 0.
