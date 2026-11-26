# schematic-19-core-notation

- planId: schematic-19-core-notation; wave 3; dependsOn: schematic-08-core-symbols
- design: section 7.1 (notation, ink palette, roles, flipX in body, upright
  labels)
- progress log: impl-plans/progress/schematic-19-core-notation.md

## Intent

Original IEC/IEEE-style line-art primitives for every schematic type, shared
by the canvas and SVG export.

## Non-goals

No SVG export wiring (plan 24), no canvas view (plan 31). No artwork copied
from any library.

## writePaths

- packages/core/src/schematic/notation.ts (new)
- packages/core/src/schematic/notation.test.ts (new)
- impl-plans/progress/schematic-19-core-notation.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contract

```ts
export interface SchematicInk { readonly ink: string; readonly muted: string; readonly surface: string; readonly accent: string }
export interface SchematicNotation { readonly body: readonly NotationPrimitive[]; readonly labels: readonly NotationPrimitive[] }
export function schematicNotation(element: Element, box: Box, ink: SchematicInk): SchematicNotation;
export function schematicLabelBounds(notation: SchematicNotation, box: Box): readonly Box[];
```
`NotationPrimitive` from `packages/core/src/bpmn/notation.ts` (each primitive
carries `role`).

## Rules

- `body` in box-local coordinates with `flipX` already applied
  (`x -> width - x`); renderers draw it inside the existing rotation
  transform, with no scale transform.
- `labels` (reference, value, net names, IC pin names/numbers) are text
  primitives with pre-rotated anchors so text stays upright (imitate
  `packages/core/src/breadboard/notation.ts:breadboardNotation` labels).
- Stroke width 1.5 page units; strokes `ink.ink`; IC body fill
  `ink.surface`; filled marks (diode triangle, arrows, junction dot) `ink.ink`.
- Roles exactly as design 7.1 (`resistor`, `capacitor-plate`, ...,
  `pin-name`).

## Pitfalls

- No hardcoded colours other than the passed palette.
- Mirror must not mirror text.

## Tests

- each of the 18 types yields at least one body primitive with its role.
- flipX resistor body x values are `width - x` of the unflipped ones; labels
  unchanged.
- palette `{ink:"#111",...}` appears in strokes; no other colour literal.
- rotated part: label anchors are pre-rotated (differ from unrotated) and
  text primitives have no rotation.

## Verification

- `bun test packages/core/src/schematic/notation.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
