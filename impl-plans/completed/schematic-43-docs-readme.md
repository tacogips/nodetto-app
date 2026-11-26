# schematic-43-docs-readme

- planId: schematic-43-docs-readme; wave 10; dependsOn: schematic-38-cli-schematic-command
- design: section 10 (docs), 11 (docs test)
- progress log: impl-plans/progress/schematic-43-docs-readme.md

## writePaths

- docs/schematic.md (new)
- README.md
- packages/core/src/schematic/docs.test.ts (new)
- impl-plans/progress/schematic-43-docs-readme.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `docs/schematic.md` (ASCII only): the mode; the 18 element types with one
  sample record each; pin tables; connectivity rules (joinable points,
  junctions, label groups, crossings); the five ERC rules and five PCB parity
  rules as tables whose rows start ``| `<rule-id>` |``; the text netlist
  format; the KiCad mapping table; CLI usage (`edit`, `lint`, `export`,
  `capture`, `schematic netlist|import|to-breadboard`), including the
  import refusal `schematic.importTooComplex`.
- `README.md`: a short "Schematic pages" section and the CLI table entry.

## Tests (docs.test.ts; imitate `packages/core/src/breadboard/docs.test.ts`)

- ERC table rule ids equal `SCHEMATIC_ERC_RULE_IDS`; parity table ids equal
  the five PCB parity ids; every one of the 18 types is named; file is ASCII.

## Verification

- `bun test packages/core/src/schematic/docs.test.ts` exits 0.
- `bunx biome check packages/core/src/schematic/docs.test.ts` exits 0.
