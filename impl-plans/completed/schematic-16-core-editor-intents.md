# schematic-16-core-editor-intents

- planId: schematic-16-core-editor-intents; wave 5;
  dependsOn: schematic-02-ir-registry, schematic-11-core-transform-extraction
- design: sections 4.2 (rotate, mirror, parameter edits), 5.3 (annotation,
  paste), 7.3 (creation)
- progress log: impl-plans/progress/schematic-16-core-editor-intents.md

## Intent

Editor facade methods for schematic creation, rotation, mirror, parameter
edits and annotation, plus the paste annotation hook.

## Non-goals

No move contract (plan 17), no breadboard target intent (plan 26), no UI.

## writePaths

- packages/core/src/editor/schematic.ts (new)
- packages/core/src/editor/facade/notation-editing.ts
- packages/core/src/editor/paste.ts
- packages/core/src/schematic/editor-schematic.test.ts (new)
- impl-plans/progress/schematic-16-core-editor-intents.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `editor/schematic.ts` (imitate `packages/core/src/editor/breadboard.ts`):
  `buildSchematicElement(editor, rng, type, at, semantic?)` (parts and power:
  anchor snapped with `snapBreadboardPoint`, `visual.x/y` canonical, width and
  height from `schematicLocalBox`, part references annotated with
  `annotateReferences` + `SCHEMATIC_REFERENCE_PREFIX`; junction/label/
  noConnect: position = snapped point),
  `planSchematicSemanticUpdate(store, id, patch)` (rewrites x/y/width/height so
  the anchor pin key is unchanged when `pinCount`, `pins`, `polarized` or
  `style` change), `planPastedSchematicReferences(store, pageId, commands)`.
- `notation-editing.ts`, next to the breadboard block:
  `createSchematicElement(type, at, semantic?)`,
  `rotateSchematicElements(ids, 1 | -1)`, `mirrorSchematicParts(ids)`,
  `updateSchematicSemantic(id, patch)`, `annotateSchematic(pageId)`, each one
  undo step via the existing apply pattern; return false when no commands.
- `paste.ts`: when the target page kind is `schematic`, run
  `planPastedSchematicReferences` (same place as the breadboard branch).

## Pitfalls

- Never annotate on undo, redo, raw apply, import or collab updates.
- Keep the breadboard branches byte-identical in behaviour.

## Tests (editor-schematic.test.ts)

- create resistor on a schematic page -> `R1`, anchor on the lattice; second
  -> `R2`.
- paste a copy of `R1` on a schematic page -> `R2`; on a freeform page ->
  reference unchanged.
- rotate/mirror are single undo steps and keep the anchor key.
- `updateSchematicSemantic` connector `pinCount` 2 -> 6 keeps pin 1 key.
- `annotateSchematic` renumbers duplicates only.

## Verification

- `bun test packages/core/src/schematic/editor-schematic.test.ts packages/core/src/breadboard/editor-breadboard.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
