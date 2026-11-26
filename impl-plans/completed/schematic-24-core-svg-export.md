# schematic-24-core-svg-export

- planId: schematic-24-core-svg-export; wave 4; dependsOn: schematic-19-core-notation
- design: section 7.1 (SVG export branch, PNG/JPG via SVG)
- progress log: impl-plans/progress/schematic-24-core-svg-export.md

## Intent

Render schematic elements in SVG export (and therefore PNG/JPG capture) from
the shared notation, in light and dark themes.

## writePaths

- packages/core/src/svg-export/notation.ts
- packages/core/src/svg-export/shapes.ts
- packages/core/src/svg-export/document.ts
- packages/core/src/schematic/svg-export.test.ts (new)
- impl-plans/progress/schematic-24-core-svg-export.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `svg-export/notation.ts`: `renderSchematicShape(element, box, notation)`
  imitating `renderBreadboardShape`, classes `schematic-<role>`.
- `svg-export/shapes.ts:renderShape`: branch for `isSchematicElementType`
  before the type switch (next to the breadboard branch), no flipX scale
  transform for schematic types.
- `svg-export/document.ts`: label pass outside the rotation group and label
  bounds (imitate the breadboard handling around lines 266-322); ink from
  `SvgTheme` fields `ink`, `muted`, `surface`, `accent`.

## Tests

- a page with one element of each type exports SVG containing
  `schematic-resistor`, `schematic-junction`, `schematic-label`.
- labels are outside the element's rotate group.
- dark `SvgTheme` ink appears in strokes; light differs.
- breadboard SVG tests unchanged.

## Verification

- `bun test packages/core/src/schematic/svg-export.test.ts packages/core/src/breadboard/svg-export-breadboard.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
