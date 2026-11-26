# schematic-32-ui-inspector

- planId: schematic-32-ui-inspector; wave 8; dependsOn: schematic-28-core-exports
- design: section 7.3 Inspector
- progress log: impl-plans/progress/schematic-32-ui-inspector.md

## Intent

Inspector section for schematic elements: reference, value, type fields, IC
pin table, net names, rotate/mirror buttons and a per-pin net list.

## writePaths

- packages/ui-solid/src/inspector/SchematicSection.tsx (new)
- packages/ui-solid/src/inspector/schematic-edits.ts (new)
- packages/ui-solid/src/inspector/schematic-edits.test.ts (new)
- packages/ui-solid/src/Inspector.tsx
- impl-plans/progress/schematic-32-ui-inspector.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `schematic-edits.ts`: pure edit builders (imitate
  `inspector/breadboard-edits.ts`): reference, value, polarized, polarity,
  channel, style, pinCount (clamped 1..40), IC pin add/remove/reorder/edit
  (number positive integer unique; side enum), power/label net (trimmed,
  non-empty). All writes through `editor.updateSchematicSemantic`.
- `SchematicSection.tsx` (imitate `BreadboardSection.tsx`): native inputs,
  selects and buttons only (keyboard reachable); "Rotate left", "Rotate
  right", "Mirror" (parts) call `rotateSchematicElements`/
  `mirrorSchematicParts`; read-only pin list with net names from
  `computeSchematicConnectivity` + `toSchematicNetlist` memoised per store
  revision.
- `Inspector.tsx`: title for `schematic.*` ("Symbol" for parts, "Schematic"
  otherwise, ~line 207) and a `<Match>` rendering `SchematicSection` (~368).

## Tests (schematic-edits.test.ts)

- pinCount 50 clamps to 40; duplicate IC pin number rejected; empty net
  rejected; edits produce the expected semantic patch.

## Verification

- `bun test packages/ui-solid/src/inspector/schematic-edits.test.ts packages/ui-solid/src/inspector/breadboard-edits.test.ts` exits 0.
- `bunx biome check <owned files>` exits 0.
