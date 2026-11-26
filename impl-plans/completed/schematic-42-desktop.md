# schematic-42-desktop

- planId: schematic-42-desktop; wave 10;
  dependsOn: schematic-34-ui-export-dialog, schematic-35-ui-workspace-palette,
  schematic-37-ui-problems-panel
- design: sections 7.3 (panel mounts), 7.4, 7.3 Export dialog handler
- progress log: impl-plans/progress/schematic-42-desktop.md

## writePaths

- apps/desktop/src/page-workspace.ts
- apps/desktop/src/App.tsx
- apps/desktop/src/shell/export-handlers.ts
- apps/desktop/src/page-workspace.test.ts
- impl-plans/progress/schematic-42-desktop.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `page-workspace.ts`: `DEDICATED_WORKSPACES.schematic = "schematic"`,
  `DEDICATED_PAGE_NAMES.schematic = "Schematic"`.
- `App.tsx`: mount `SchematicProblemsPanel` on `schematic` pages and on `pcb`
  pages when the document has a schematic page (next to the breadboard
  mount ~line 1185, same props pattern); pass `exportSchematic` to the export
  dialog.
- `export-handlers.ts`: `exportSchematic(kind)` like `exportBreadboard`
  (~line 443): `pickExportPath(name, ext)` (`txt` or `net`) and `writeText`,
  Blob fallback, warnings shown in the dialog notice.

## Pitfalls

- The KiCad open flow (`apps/desktop/src/file/session.ts`) is NOT changed.
- No Rust changes (export extensions are free-form).

## Tests (page-workspace.test.ts additions only)

- `dedicatedWorkspaceFor("schematic") === "schematic"`,
  `dedicatedPageKindFor("schematic") === "schematic"`.

## Verification

- `bun test apps/desktop/src/page-workspace.test.ts` exits 0.
- `bunx biome check <owned files>` exits 0.
