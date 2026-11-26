# schematic-37-ui-problems-panel

- planId: schematic-37-ui-problems-panel; wave 8;
  dependsOn: schematic-13-io-breadboard-target, schematic-28-core-exports
- design: section 7.3 Problems panel, 8.1 (send to breadboard), 8.2 (PCB
  rows, `pageId` focus)
- progress log: impl-plans/progress/schematic-37-ui-problems-panel.md

## writePaths

- packages/ui-solid/src/SchematicProblemsPanel.tsx (new)
- packages/ui-solid/src/schematic-problems.ts (new)
- packages/ui-solid/src/schematic-problems.test.ts (new)
- packages/ui-solid/src/index.ts
- impl-plans/progress/schematic-37-ui-problems-panel.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `schematic-problems.ts` (imitate `breadboard-problems.ts`):
  `schematicProblemRows(document, pageId)` for schematic pages (ERC) and PCB
  pages (parity vs first schematic page); `canFixSchematicReferences`;
  `sendSchematicToBreadboard(editor, schematicPageId, breadboardPageId)`:
  connectivity -> `toSchematicNetlist` -> `breadboardTargetFromSchematic` ->
  on target `editor.setBreadboardTarget`, else return diagnostics (card
  untouched).
- Row click: `focusBreadboardProbe(editor, {pageId: row.pageId ?? pageId,
  elementIds}, viewport)`.
- `SchematicProblemsPanel.tsx` (imitate `BreadboardProblemsPanel.tsx`, 300 ms
  debounce, existing CSS tokens and classes): rows, "Fix references",
  "Send to breadboard" with a page select when several breadboard pages
  exist; buttons hidden in PCB mode; failure diagnostics listed.
- `index.ts`: export the panel, its props type and the row helpers.

## Tests

- rows for each ERC rule; PCB-mode rows carry `pageId` and focusing switches
  page; send-to-breadboard success writes one card; sparse ic failure returns
  `schematic.unprojectablePart` and leaves the card unchanged.

## Verification

- `bun test packages/ui-solid/src/schematic-problems.test.ts packages/ui-solid/src/breadboard-problems.test.ts` exits 0.
- `bunx biome check <owned files>` exits 0.
