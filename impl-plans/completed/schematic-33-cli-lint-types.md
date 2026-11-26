# schematic-33-cli-lint-types

- planId: schematic-33-cli-lint-types; wave 8; dependsOn: schematic-28-core-exports
- design: section 9 (`lint`, `types`, page creation via `edit`)
- progress log: impl-plans/progress/schematic-33-cli-lint-types.md

## Intent

`nodetto-cli lint` covers schematic pages (and PCB pages only when a
schematic page exists); `types --kind schematic` lists the 18 types.

## Non-goals

No `schematic` command group or help text (plan 38). The no-page lint
message in `apps/cli/src/lint-diagram.ts:24` is NOT changed.

## writePaths

- apps/cli/src/commands.ts
- apps/cli/src/lint-schematic.test.ts (new)
- impl-plans/progress/schematic-33-cli-lint-types.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `commands.ts` lint (~lines 370-560): include `schematic` pages in `pages`
  and `notationIds`; run `lintSchematicPage`; include `pcb` pages only when
  `document.pages.some(kind === "schematic")` and run
  `schematicPcbParityFindings(document, page.id, firstSchematicPageId)`.
  JSON rows add `pin` when defined and `pageId` when the finding has one.
- `types-command.ts` already lists the 18 types (plan 01); this plan only
  tests it.

## Tests (lint-schematic.test.ts; imitate `breadboard-commands.test.ts`)

- schematic doc with a dangling wire -> text row and JSON row with
  `ruleId: "dangling-wire-end"`; exit code 0 for warnings only, 1 with a
  duplicate reference.
- PCB-only document: output identical to current behaviour (no parity rows).
- PCB + schematic: missing-part row with `pageId`.
- `types --kind schematic` lists 18 types.
- `edit` `add-page` kind `schematic` plus `add` of each of the 18 types,
  then `validate` exits 0.

## Verification

- `bun test apps/cli/src/lint-schematic.test.ts apps/cli/src/breadboard-commands.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
