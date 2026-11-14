# tsh-06-cli

- planId: tsh-06-cli
- planPath: impl-plans/active/tsh-06-cli.md
- progressPath: impl-plans/progress/tsh-06-cli.md
- wave: 2
- dependsOn: tsh-01a-ir, tsh-01c-edits, tsh-01d-values
- Design: `design-docs/specs/design-table-sheet.md` section 8.
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md` (refinement 1: this plan owns the edit op dispatch files).
- writePaths:
  - `apps/cli/src/table-command.ts` (new)
  - `apps/cli/src/table-command.test.ts` (new)
  - `apps/cli/src/edit/operations/table.ts` (new)
  - `apps/cli/src/edit/operations/table.test.ts` (new)
  - `apps/cli/src/edit/batch.ts`
  - `apps/cli/src/edit/operation-fields.ts`
  - `apps/cli/src/edit/operation-fields.test.ts`
  - `impl-plans/progress/tsh-06-cli.md`
  - `tmp/tsh-s780/tsh-06-cli`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan adds CLI authoring for `table.sheet`:

- inline data through the existing `edit` `add` op, which needs no change
  once tsh-01a registers the type
- a new `set-cells` edit op
- a new `nodetto-cli table create|set` command that builds operations and
  runs them through `runOperations`
  (`apps/cli/src/edit-command.ts:runOperations`), so it inherits the
  atomic write, the retry on contention, and the text/json report

`commands.ts` dispatch, `help.ts`, and `types-command.ts` belong to tsh-08.
Export `TABLE_HELP` for tsh-08 to register.

## Non-goals

- No commands.ts, help.ts, cli.ts or types-command.ts edits.
- No Rust changes.
- No type inference from CSV.
- No new lint rules. Lint already reports IR validation issues.

## File-level changes

1. `edit/operations/table.ts`: `export function setCells(batch: Batch, operation: JsonObject, index: number): void`.
   - Imitate the handler style of `apps/cli/src/edit/operations/add.ts`
     and the errors of `OperationError(index, message)` in
     `edit/operation-input.ts`.
   - Operation shape:
     `{"op":"set-cells","id":"<element id or ref>","cells":[{"row": <row id string | 0-based integer>, "column": <column id | 0-based integer | unique column name>, "value"?: string|number|boolean|null, "bold"?: boolean|null, "align"?: "left"|"center"|"right"|null, "fill"?: string|null}]}`.
   - Resolve the element as other ops do. Look up how `update` resolves
     `id`/`ref` in `edit/operations/elements.ts` and reuse that resolver.
     It must be a `table.sheet`; otherwise throw
     `"set-cells" needs a table.sheet element`.
   - Resolve the row: an id match first, then a non-negative integer
     index. Resolve the column: an id, then an index, then an exact name
     match, which must be unique. An unknown row or column, or an ambiguous
     name, throws an `OperationError` that names the ref.
   - Values:
     - A string goes through `coerceCellText`. For CLI strictness, a
       non-empty string that cannot be coerced throws
       `cell (row, column): "<text>" is not a valid <type>`.
     - A select `newOption` is appended through `setColumnOptions` when
       under the limit.
     - number and boolean must pass `tableSheetValueMatches`.
     - `null` clears.
   - Style fields go through `setCellStyle`, with `null` removing.
   - Apply all cells in the op as ONE `updateSemantic`. Fold the edits on
     the semantic, then call `applyTableSheetEdit` once with a function
     returning the folded result. Propagate `ok:false` as an
     `OperationError` with its message.
2. `edit/batch.ts`:
   - Add `case "set-cells": setCells(this, operation, index); return;`
     next to `case "add"`.
   - Add `set-cells` to the unknown-op hint message list, keeping its
     order style.
3. `edit/operation-fields.ts`: add
   `"set-cells": ["op","id","ref","cells"]`. Match the actual key names
   used by the element resolver.
4. `edit/operation-fields.test.ts`: add the
   `"set-cells": ["table:setCells", ...]` handler row, following that
   test's convention. Read the test first.
5. `table-command.ts`:
   - `export const TABLE_HELP: string` and
     `export function tableCommand(io: CommandIo, args: readonly string[]): CommandResult`.
   - Imitate the argument parsing and `ok`/`fail` usage of
     `apps/cli/src/pcb-command.ts` and `merge-command.ts`.
   - `table create <doc.jsonl> (--csv <file> | --tsv <file> | --data <json>) [--page <id|name>] [--id <id>] [--x <n> --y <n>] [--no-header] [--types t1,t2,...] [--widths w1,w2,...] [--format text|json]`:
     - Exactly one source is allowed. Read files only with `io.readText`.
       Parse with `parseCsv` or `parseTsv` (core), or `JSON.parse` of an
       array of arrays of string, number or boolean. Values are converted
       with `String()`, because `tableSheetFromGrid` takes strings.
     - Call `tableSheetFromGrid`. On `ok:false`, fail with exit code 2 and
       the message.
     - Build `{op:"add", type:"table.sheet", page?, id?, visual?: {x,y}, semantic}`
       and call `runOperations(io, doc, [op], {arrange:false, dryRun:false, format})`.
       `--x` and `--y` must be given together.
   - `table set <doc.jsonl> <table-id> --cell <row>:<col> --value <text> [--cell ... --value ...] [--format text|json]`:
     - Pairs are matched in order. Split each `--cell` at the first `:`,
       because row ids cannot contain `:`. A ref of only digits is an index.
     - Build one `set-cells` op and call `runOperations`.
   - Usage errors return exit code 2 with `TABLE_HELP`. Any other
     subcommand fails with `table expects the create or set subcommand`.
   - `TABLE_HELP` documents both subcommands, the CSV/TSV rules (RFC 4180
     quoting, BOM, ragged rows padded, first record = names unless
     `--no-header`), the type list, and the limits. Name the constants from
     `TABLE_SHEET_LIMITS` in the text via template interpolation, so
     numbers never drift.

## Pitfalls

- Boa: no `node:*` imports in non-test files, and no regex `split` over the
  whole file. The parsers are core's: `parseCsv` and `parseTsv` from tsh-01c, and
  `tableSheetFromGrid` from tsh-01d. Value writes use `setCellValue` and
  `coerceCellText` (tsh-01d) and `setCellStyle` and `setColumnOptions`
  (tsh-01c). `--no-header` names follow the tsh-00 `Column N` rule.
- All-or-nothing: an invalid cell in `set-cells` must leave the file
  unchanged. This follows from batch semantics; do not write partially.
- Do not set `headerRow:false` for `--no-header`. The flag only means "the
  input has no name row".
- Keep ids deterministic: `c1..`, `r1..` from `tableSheetFromGrid`.

## Tests (input -> expected); use in-memory io like `apps/cli/src/merge-command.test.ts:fixture`

- `table-command.test.ts`:
  - `create --csv` with the text `"Name,Qty\nWidget,3\n\"Gadget, large\",\"5\"\n"` and
    `--types text,number`:
    - the written doc has one `table.sheet`, columns Name and Qty with
      ids c1 and c2, rows r1 and r2
    - Qty values are the numbers 3 and 5, and the name keeps the comma
    - `validateDocument` has no errors
    - the exit code is 0
  - `create --tsv` with a quoted field containing a newline -> the stored
    text contains `\n`
  - `create --data '[["A","B"],["x",true]]' --no-header` -> names
    `Column 1` and `Column 2`, 2 rows
  - `--types text,number` with a bad number -> exit 2, a message naming
    the row and column, and the file unchanged
  - both `--csv` and `--data` -> exit 2 with help
  - `set doc t1 --cell r1:Qty --value 7 --cell 1:0 --value Gizmo` -> both
    cells updated in one write
  - an unknown column -> exit non-zero and the file unchanged
- `edit/operations/table.test.ts`:
  - drive through `runOperations` or `applyBatch`, following the existing
    `edit/connect-routing.test.ts` setup
  - `set-cells` on a checkbox with `"yes"` -> true; `null` clears
  - `bold:true` and `fill:"#ffeeaa"` set; `fill:null` removes
  - select unknown `"Blocked"` -> option appended
  - two cells in one op -> exactly one `updateSemantic` (the undo count or
    the change count in the report is 1 element changed)
  - a non-table target -> error
  - an inline `{"op":"add","type":"table.sheet","semantic":{...}}` creates a
    valid table, which proves that inline data works

## Verification (exit 0; test commands show at least 1 test, 0 fail)

1. `bun test ./apps/cli/src/table-command.test.ts ./apps/cli/src/edit/operations/table.test.ts ./apps/cli/src/edit/operation-fields.test.ts` -> `cli.log`
2. `bun test ./apps/cli/src/edit/apply-batch.test.ts ./apps/cli/src/edit/report.test.ts ./apps/cli/src/edit/selectors.test.ts` -> `edit-regression.log`.
   These are existing tests for the batch and op path, and none of them
   loops over registered element types. Do NOT run the `./apps/cli/src/edit`
   directory, and do not run `label-field.test.ts`. That test loops over
   `ELEMENT_TYPES`, so it fails until tsh-08 registers
   `tableSheetShapeUtil`. tsh-08 owns that check.
Static checks (tsh-00; must exit 0, but they are not test commands):
`bun run typecheck` -> `typecheck.log`, and `bunx biome check apps/cli/src/table-command.ts apps/cli/src/table-command.test.ts apps/cli/src/edit/operations/table.ts apps/cli/src/edit/operations/table.test.ts apps/cli/src/edit/batch.ts apps/cli/src/edit/operation-fields.ts apps/cli/src/edit/operation-fields.test.ts --diagnostic-level=warn` -> `biome.log`

## Done criteria

- `tableCommand`, `TABLE_HELP` and `setCells` are exported, and
  `set-cells` is dispatched in `batch.ts`.
- Verifications 1-2 exited 0, and both static checks exited 0, with logs under `tmp/tsh-s780/tsh-06-cli/final/`.
- `commands.ts`, `help.ts` and `types-command.ts` are untouched by this
  plan, and the progress log is complete.
