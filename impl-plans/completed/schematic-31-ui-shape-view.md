# schematic-31-ui-shape-view

- planId: schematic-31-ui-shape-view; wave 8; dependsOn: schematic-28-core-exports
- design: section 7.1 (canvas view sharing notation primitives)
- progress log: impl-plans/progress/schematic-31-ui-shape-view.md

## Intent

Draw schematic elements on the canvas from the same primitives SVG export
uses, themed with existing CSS tokens.

## writePaths

- packages/ui-solid/src/shapes/SchematicShapeView.tsx (new)
- packages/ui-solid/src/shapes/schematic-view.ts (new)
- packages/ui-solid/src/shapes/schematic-view.test.ts (new)
- packages/ui-solid/src/shapes/ShapeView.tsx
- impl-plans/progress/schematic-31-ui-shape-view.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `schematic-view.ts`: pure helper `schematicViewModel(element, box)` calling
  `schematicNotation` with ink `{ink:"var(--nodetto-ink)", muted:
  "var(--nodetto-muted)", surface:"var(--nodetto-surface)",
  accent:"var(--nodetto-accent)"}` (imitate `shapes/breadboard-view.ts`).
- `SchematicShapeView.tsx`: render body inside the existing rotation
  transform and labels outside it (imitate `BreadboardShapeView.tsx`).
- `ShapeView.tsx`: `<Match when={isSchematicElementType(type)}>` next to the
  breadboard match (~line 198).

## Pitfalls

- No colour literals; no flipX scale transform (notation already mirrored).

## Tests (schematic-view.test.ts)

- view model for a resistor uses `var(--nodetto-ink)` strokes and the
  `schematic-resistor` role; labels separated from body.

## Verification

- `bun test packages/ui-solid/src/shapes/schematic-view.test.ts packages/ui-solid/src/shapes/breadboard-view.test.ts` exits 0.
- `bunx biome check <owned files>` exits 0.
