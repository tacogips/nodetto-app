# schematic-30-cli-move-absolute

- planId: schematic-30-cli-move-absolute; wave 8; dependsOn: schematic-28-core-exports
- design: section 3.3 Moves rule 2, section 11 CLI absolute move
- progress log: impl-plans/progress/schematic-30-cli-move-absolute.md

## Intent

CLI `edit` absolute moves of schematic elements store `canonicalTarget`
values (absolute semantics kept); relative offsets use the shared-delta rule.

## writePaths

- apps/cli/src/edit/operations/elements.ts
- apps/cli/src/edit/apply-batch.test.ts
- impl-plans/progress/schematic-30-cli-move-absolute.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `elements.ts` (~lines 197-209, the move operation): for
  `isSchematicElementType`, store `canonicalTarget(x)`/`canonicalTarget(y)`
  for absolute targets; for a relative offset, if supported, use
  `shiftedTarget(origin, offset)`. Other types unchanged.

## Tests (apply-batch.test.ts additions only)

- schematic junction at x -0.125 moved to absolute 0.875 -> stored 0.88.
- existing move assertions for other types pass unchanged.

## Verification

- `bun test apps/cli/src/edit/apply-batch.test.ts` exits 0.
- `bunx biome check apps/cli/src/edit/operations/elements.ts apps/cli/src/edit/apply-batch.test.ts` exits 0.
