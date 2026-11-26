# schematic-38-cli-schematic-command

- planId: schematic-38-cli-schematic-command; wave 9;
  dependsOn: schematic-13-io-breadboard-target, schematic-20-io-kicad-schematic-labels,
  schematic-33-cli-lint-types
- design: section 9 (`schematic netlist|import|to-breadboard`, help text,
  arrange row), 8.1, 8.3 (budget policy opt-in)
- progress log: impl-plans/progress/schematic-38-cli-schematic-command.md

## Intent

The `schematic` CLI command group and all help-text updates.

## writePaths

- apps/cli/src/schematic-command.ts (new)
- apps/cli/src/commands.ts
- apps/cli/src/help.ts
- apps/cli/src/schematic-commands.test.ts (new)
- impl-plans/progress/schematic-38-cli-schematic-command.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `schematic-command.ts` (imitate `breadboard-command.ts`, sync):
  - `schematic netlist <doc> --format text|kicad [--page] [--output|--check] [--strict]`.
  - `schematic import <file.kicad_sch|file.net> [--output] [--strict]`:
    `importKicad(text, {fileName, stats, diagonalBudget: "schematic"})` then
    `layoutSchematicImport(plan)`; diagnostics one stderr line each
    (`<severity>: <file>[:<line>:<column>]: <code>: <message>`); any error
    (including `schematic.importTooComplex`, `importPinInTwoNets`) exits 1
    writing nothing; `--strict` with warnings exits 3.
  - `schematic to-breadboard <doc> [--page] [--breadboard] [--output]`:
    netlist -> `breadboardTargetFromSchematic` -> Editor
    `setBreadboardTarget`; writes the document to stdout or `--output`;
    exit 2 when the document lacks either page kind; exit 1 and nothing
    written on projection errors.
- `commands.ts`: `case "schematic": return schematicCommand(io, rest);`
  next to `case "breadboard"`.
- `help.ts`: `schematic` entry; add `schematic` to the kind lists in
  `pages --kind`, `types --kind`, `add-page`/`set-page-mode` modes,
  `shapes --category`, the lint description and rules line, the OVERVIEW
  line, and the arrange table row
  `schematic  excluded: electrical wiring geometry`.

## Pitfalls

- If an existing help test pins an exact kind list, extend that list only
  (record the file in the progress log); MCP tool lists derive from
  `COMMAND_HELP` and need no edit.
- The budget fixture is generated inside the test and written to
  `os.tmpdir()`, removed after; never under `target/` or `tmp/`.

## Tests (schematic-commands.test.ts)

- netlist text and kicad with `--output`, `--check` match/drift (exit 1),
  `--strict` (exit 3), usage errors (exit 2).
- import of `test-fixtures/kicad/led-button.kicad_sch` and `.net` -> JSONL
  that validates.
- budget activation: generated long-lattice `.kicad_sch` (design 11) ->
  exit 1, stderr contains `schematic.importTooComplex`, empty stdout, output
  file absent; same file via `breadboard import` succeeds.
- to-breadboard success writes one card; sparse ic -> exit 1, nothing
  written.

## Verification

- `bun test apps/cli/src/schematic-commands.test.ts apps/cli/src/breadboard-commands.test.ts apps/cli/src/lint-schematic.test.ts`
  exits 0. `lint-schematic.test.ts` is plan 33's test on the shared
  `commands.ts`.
- `bunx biome check <owned .ts files>` exits 0.
