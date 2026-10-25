# breadboard-16-cli

- planId: breadboard-16-cli
- planPath: impl-plans/active/breadboard-16-cli.md
- wave: 5; dependsOn: breadboard-03-io-formatters, breadboard-04-io-kicad, breadboard-07-core-connectivity-erc, breadboard-09-core-import-layout, breadboard-10-core-ratsnest-parity
- design: design-docs/specs/design-breadboard.md section 9 (lint,
  breadboard bom/netlist/import), 8.1 (pipeline), user-QA Q8, Q10
- progress log: impl-plans/progress/breadboard-16-cli.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^apps/cli/src/(commands|help|breadboard-command|breadboard-commands\.test)\.ts`

## Intent

Surface breadboard ERC and parity in `nodetto-cli lint`. Add the
`breadboard` command group:
- `bom`
- `netlist --format kicad|spice`
- `import <file.kicad_sch|file.net>`

They build the netlist model with core and format or import with io, with
deterministic output and the existing exit-code conventions.

## Non-goals

- No new generic `export` format, no MCP changes (MCP derives from
  `COMMAND_HELP`) and no native-engine changes.
- No README edits. That is plan 18.

## writePaths

- apps/cli/src/breadboard-command.ts (new)
- apps/cli/src/breadboard-commands.test.ts (new)
- apps/cli/src/commands.ts
- apps/cli/src/help.ts
- impl-plans/progress/breadboard-16-cli.md

## sharedPaths

none

## File-level changes

### commands.ts: lint (commands.ts:210-359)

- Select every `bpmn` and every `breadboard` page in page order, or the
  page given with `--page`.
- With neither kind, fail with exactly
  `The document contains no BPMN or breadboard pages.` Change only the two
  lint uses (commands.ts:263 and 271). The `bpmn export` message at
  commands.ts:416 stays `The document contains no BPMN pages.`
- Read `.bpmnlintrc` / `--config` only when the selected pages include a
  `bpmn` page. BPMN behaviour and output stay byte-identical.
- Breadboard pages use `lintBreadboardPage` (it includes parity).
- Text rows follow the existing format: the element column is
  `<elementId>`, and the message names the reference and pin.
- JSON: each breadboard finding adds `"pin": <n>` only when it has a pin.
  `elementIds` is not written.
- Exit codes are unchanged: 0, then 1 (`EXIT_DRIFT`) when any error
  finding exists, then 2 for usage.

### breadboard-command.ts and dispatch

`breadboardCommand(io, args)`, dispatched from `runCli` with
`case "breadboard":` next to `drawio` (commands.ts:761-764). Imitate
`drawioCommand`, `parseArgs` and `writeOutput`.
- `bom <doc.jsonl> [--page <id|name>] [--output <file.csv> | --check <file.csv>] [--strict]`
- `netlist <doc.jsonl> --format kicad|spice [--page] [--output | --check] [--strict]`
  - pipeline: `parseDocumentResult`, page selection,
    `computeBreadboardConnectivity`, `toBreadboardNetlist`, then the io
    formatter
  - the single breadboard page is chosen automatically; with several and
    no `--page`, exit 2 with a message listing them
  - `--output` and `--check` together -> exit 2
  - `--check` drift -> exit 1, comparing with `normalizeNewlines` as
    existing check commands do
  - warnings go to stderr as `warning: <text>`
  - `--strict` with warnings -> exit 3 (`EXIT_WARNINGS`)
  - an unknown subcommand or a missing or unknown `--format` -> usage,
    exit 2
- `import <file> [--output <file.jsonl>] [--strict]`
  - pipeline: `importKicad(io.readText(path), {fileName: basename})`, then
    `layoutBreadboardImport(plan)`, then `serializeDocument`
  - each diagnostic is one stderr line,
    `<severity>: <file>[:<line>:<column>]: <code>: <message>`
  - no plan -> exit 1, writing nothing to stdout or the output file
  - `--strict` with any warning -> exit 3 and write nothing
  - otherwise JSONL goes to stdout, or `--output` with a
    `Wrote breadboard document to <path>.` stderr note

### help.ts

- Add a `breadboard` entry to `COMMAND_HELP`, imitating `bpmn` and
  `drawio`, covering the three subcommands and their flags.
- Update the `lint` entry text to "Lint BPMN and breadboard pages".
- Update the `OVERVIEW` lines (help.ts:27-29).

## Pitfalls

- `commands.test.ts`, `mcp*.test.ts` and `native-parity.test.ts` must stay
  unedited and green. MCP tool lists derive from `COMMAND_HELP` keys
  automatically.
- A read failure on the input path -> exit 2 or 1, following the existing
  `Cannot read <path>: ...` convention. Never let a stack trace escape.
- Import from `@nodetto/core` and `@nodetto/io` (main index) only.

## Tests (input -> expected), in `breadboard-commands.test.ts`

Imitate `apps/cli/src/bpmn-commands.test.ts`, with in-memory `CommandIo`.
Build documents as literal JSONL, through `layoutBreadboardImport`, or
with Editor intents. Do not import core's `test-builder.ts` (overview
invariant).
- lint, breadboard page with a duplicate R1 -> exit 1 and a text row
  containing `duplicate-reference`
- lint, clean breadboard page -> exit 0 and empty stdout
- lint `--format json` with a pin finding -> the object has `"pin"`; a
  finding without a pin -> no `pin` key
- lint, freeform-only document -> exit `EXIT_ERROR` (the `fail()`
  default, unchanged) with the exact new message
- lint, mixed bpmn and breadboard document -> both pages reported, with
  BPMN rows unchanged
- `breadboard bom` -> CSV on stdout with the pinned header
- `--output` writes the file
- `--check` against identical content -> exit 0; against drifted content
  -> exit 1
- `netlist --format kicad` -> starts with `(export (version "E")`
- `--format spice` -> ends with `.end\n`
- `--format foo` -> exit 2
- two breadboard pages and no `--page` -> exit 2
- `--strict` with an unannotated `R?` -> exit 3
- `breadboard import test-fixtures/kicad/led-button.net` (read the real
  fixture through the io) -> exit 0, and stdout JSONL parses and validates
  with a `breadboard` page
- `breadboard import test-fixtures/kicad/legacy.sch` -> exit 1,
  `kicad.legacyFormat` on stderr, empty stdout
- `breadboard import test-fixtures/kicad/unknown-symbols.net --strict` ->
  exit 3
- lint of the imported `led-button.net` document -> exit 1, with both
  `pin-not-in-hole` and `parity-missing-connection` rows (design 11,
  user-QA Q8 and Q9)

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-16-cli
bun test apps/cli/src/breadboard-commands.test.ts   # exit 0, >0 pass, 0 fail
bun test apps/cli > tmp/breadboard-mode-s485/breadboard-16-cli/cli.log 2>&1   # G2 (commands.test.ts, bpmn-commands.test.ts, mcp tests unedited and green)
bun run typecheck > tmp/breadboard-mode-s485/breadboard-16-cli/typecheck.log 2>&1   # G1
bunx biome check apps/cli/src/breadboard-command.ts apps/cli/src/breadboard-commands.test.ts apps/cli/src/commands.ts apps/cli/src/help.ts   # exit 0
bun apps/cli/src/main.ts breadboard import test-fixtures/kicad/led-button.net > tmp/breadboard-mode-s485/breadboard-16-cli/import.jsonl; echo "exit=$?"   # exit=0
bun apps/cli/src/main.ts breadboard import test-fixtures/kicad/legacy.sch; echo "exit=$?"   # exit=1
git diff --quiet -- apps/cli/src/commands.test.ts apps/cli/src/bpmn-commands.test.ts   # exit 0
```

## Done criteria

- `grep -n 'case "breadboard"' apps/cli/src/commands.ts` prints one line.
- `grep -n 'The document contains no BPMN or breadboard pages.' apps/cli/src/commands.ts` prints one line.
- All verification lines pass, with exit codes and counts in the progress log.
