# schematic-34-ui-export-dialog

- planId: schematic-34-ui-export-dialog; wave 8;
  dependsOn: schematic-13-io-breadboard-target, schematic-28-core-exports
- design: section 7.3 Export dialog
- progress log: impl-plans/progress/schematic-34-ui-export-dialog.md

## Intent

A `schematic` format in the export dialog, enabled on schematic pages, with
"Netlist (text)" and "KiCad netlist (.net)" buttons.

## writePaths

- packages/ui-solid/src/ExportDialog.tsx
- packages/ui-solid/src/schematic-export.ts (new)
- packages/ui-solid/src/schematic-export.test.ts (new)
- impl-plans/progress/schematic-34-ui-export-dialog.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `schematic-export.ts` (imitate `breadboard-export.ts`):
  `schematicExportEnabled(pageKind)`, `schematicExportText(document, pageId,
  kind: "text" | "kicad")` returning `{text, warnings, extension}` via core
  connectivity + netlist and io formatters.
- `ExportDialog.tsx`: format id `schematic` in the "Diagram source" group
  (imitate the breadboard entries at ~lines 121, 225, 619) and a new prop
  `exportSchematic(kind: "text" | "kicad")`.

## Tests

- enablement only for `schematic`; text and kicad outputs for a tiny doc
  start with `# nodetto schematic netlist 1` / `(export (version "E")`.

## Verification

- `bun test packages/ui-solid/src/schematic-export.test.ts packages/ui-solid/src/breadboard-export.test.ts` exits 0.
- `bunx biome check <owned files>` exits 0.
