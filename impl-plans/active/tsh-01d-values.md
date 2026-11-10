# tsh-01d-values

- planId: tsh-01d-values
- planPath: impl-plans/active/tsh-01d-values.md
- progressPath: impl-plans/progress/tsh-01d-values.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-table-sheet.md`, section 6 (coercion,
  `Column N` rule, clipboard, paste) and section 8 (`tableSheetFromGrid`).
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`. The
  signatures for this plan are pinned there under "tsh-01d-values".
- writePaths:
  - `packages/core/src/table-sheet/coerce.ts` (new)
  - `packages/core/src/table-sheet/coerce.test.ts` (new)
  - `packages/core/src/table-sheet/columns.ts` (new)
  - `packages/core/src/table-sheet/columns.test.ts` (new)
  - `packages/core/src/table-sheet/grid.ts` (new)
  - `packages/core/src/table-sheet/grid.test.ts` (new)
  - `impl-plans/progress/tsh-01d-values.md`
  - `tmp/tsh-s778/tsh-01d-values`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan owns every function that converts text to typed values or names
new columns. That covers typing, paste, retype, the CLI create and set
paths, and column insertion. It also owns the stored-value clipboard text.

The clipboard must copy STORED values exactly. A text cell
`"alpha\nbeta"` copies as `"alpha\nbeta"`, never as the display
`"alpha beta"`.

## Non-goals

- No TSV/CSV text parsing. That is tsh-01c `delimited.ts`. Grids arrive
  already parsed as `string[][]`.
- No style or structure edits (tsh-01c), no `apply`, and no barrel.

## Cross-plan reference (the only one allowed)

`import type { TableSheetEditResult, TableSheetRange } from "./types.ts";`

- The file is written by tsh-01c with the content pinned in tsh-00.
- It must be `import type`. Never import a runtime value from `edits.ts`,
  `apply.ts`, `delimited.ts`, `layout.ts` or `shape.ts`.
- If `types.ts` does not exist yet, your tests still run. Typecheck
  failures caused only by its absence are recorded, not fixed.
- Write private helpers here. For example, write a cell value and drop a
  cell that is left with no keys.

## File-level changes

1. `coerce.ts`
   - `coerceCellText(column, text)`:
     - `text`: verbatim, no trim.
     - `number`: the trimmed text must match
       `^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$` and give a finite
       `Number`.
     - `checkbox`: trimmed, case-insensitive; `true/1/yes/x` -> true and
       `false/0/no` -> false.
     - `date`: `isTableSheetDate(trimmed)`.
     - `select`:
       - An exact option match succeeds.
       - Any other non-empty trimmed text gives `{ok:true,
         value:trimmed, newOption:trimmed}`.
       - The caller decides whether to append it.
     - Empty input (after trim, except for text, where `""` itself is
       empty) gives `{ok:true}` with no value, meaning clear.
     - Anything else gives `{ok:false}`.
   - `clipboardCellText(column, cell)` gives:
     - a stored string exactly
     - `String(n)` for a number
     - `TRUE`/`FALSE` for a checkbox
     - the option or the date as stored
     - `""` when absent
   - `setCellValue`:
     - Requires `tableSheetValueMatches(column, value)`, otherwise
       `table.cellType`.
     - `undefined` removes `value`, and the cell key goes when the cell is
       empty.
     - A string over 10000 gives `table.limit`.
   - `setCellText`:
     - Coerces the text.
     - A `newOption` is appended to the column's `options` when under 100,
       otherwise `table.limit`.
     - Not coercible: clear the value with `skipped: 1`.
     - The same stored value is a no-op (the same object).
   - `clearRange(s, range)`: removes `value` from every cell in the
     inclusive index range. Styles stay.
   - `retypeColumn(s, id, type)`:
     - For each row, `coerceCellText(newColumn, clipboardCellText(old,
       cell))`. Failures are cleared and counted.
     - To select: options are seeded from the distinct non-empty old texts,
       in row order, capped at 100.
     - Away from select: drop `options`.
     - Same type: no-op.
2. `columns.ts`
   - `TABLE_SHEET_DEFAULT_COLUMN_WIDTH = 120`.
   - `nextTableSheetColumnName` and `insertColumn` follow the `Column N`
     rule in tsh-00 exactly.
3. `grid.ts`
   - `clipboardGrid(s, range)`: `clipboardCellText` per cell over the
     clamped inclusive range, row-major.
   - `pasteGrid(s, at, grid, ids)`:
     - Writes from `at`. `at` out of range is clamped to the table.
     - Appends rows (`{id: ids(), cells:{}}`) and text columns (the
       `Column N` rule, width 120, `id: ids()`) as needed.
     - Coerces per target column the same way as `setCellText`, and
       appends select new options.
     - If the result would exceed 100 columns, 1000 rows or 100 options,
       return `table.limit`. The input is unchanged and no ids are
       consumed: compute the sizes before calling `ids()`.
     - `skipped` counts the values that could not be coerced.
   - `tableSheetFromGrid(grid, {header, types, widths})`:
     - N is the maximum record length, at least 1.
     - Names: see the tsh-00 rule.
     - Rows: the records after the header (or all records), padded to N.
     - Types default to `text`. A `types` or `widths` list longer than N
       gives `table.limit` with an explanatory message.
     - Widths default to 120, then are rounded and clamped.
     - Values are coerced per column type. A non-empty value that cannot be
       coerced gives `table.cellType`, with a message naming the 1-based
       row and the column name. That is CLI strictness.
     - Select columns collect new options in first-seen order.
     - Ids are `c1..cN` and `r1..rM`.
     - Over-limit -> `table.limit`.

## Tests (input -> expected)

- `coerce.test.ts`:
  - `" 1e3 "` -> 1000; `"1,000"` -> not ok; `"YES"` -> true; `"x"` -> true
  - `"2024-13-01"` -> not ok; a select with `"Blocked"` -> `newOption`
    `"Blocked"`
  - text `"  a\tb\n"` -> stored verbatim
  - `clipboardCellText` for `"alpha\nbeta"` -> `"alpha\nbeta"`; 42 -> `"42"`;
    true -> `"TRUE"`
  - `setCellText` of `"x"` in a number column -> cleared, `skipped` 1
  - `setCellText` with an empty string on a cell holding only a value ->
    the cell key is removed
  - `retypeColumn` text to number keeps `"12"` as 12 and clears `"x"`
    (`skipped` 1); retype to select seeds the options
  - `clearRange` over 2x2 keeps `bold`
- `columns.test.ts`:
  - the default 3x3 (`Name`, `Status`, `Done`) -> `Column 1`
  - `[Column 1, Column 3]` -> `Column 2`; `[Column 2]` -> `Column 1`
  - `[Column 01]` and `[column 1]` -> `Column 1`
  - `insertColumn(s3x3, 3, () => "x1")` -> `{id:"x1", name:"Column 1",
    type:"text", width:120}` at index 3, with no `align`/`options` keys and
    the rows' cells unchanged
  - `insertColumn(s, 0, ids, "select")` -> type select at index 0, with no
    `options` key
  - 100 columns -> `table.limit` and the input is unchanged
- `grid.test.ts`:
  - `clipboardGrid` over `"alpha\nbeta"`, `"tab\there"`, `say "hi"` and
    `"line1\r\nline2"` -> those exact strings
  - copy grid -> `pasteGrid` into another range -> the stored values are
    exactly equal
  - a 2x5 paste at row 2, column 1 of the 3x3 -> 4 rows, and two appended
    columns named `Column 1` and `Column 2`, width 120, with ids from a
    counter IdSource
  - a paste needing 101 columns -> `table.limit`, the input is unchanged
    and the IdSource is never called
  - `"x"` into a number column -> cleared, `skipped` 1; an unknown select
    value -> option appended
  - `tableSheetFromGrid([["A","B"],["x","1"]], {header:false})` ->
    `Column 1` and `Column 2`, 2 rows
  - a header `["Name"]` with a record `["a","b"]` -> names `Name` and
    `Column 1`
  - `types ["text","number"]` with a bad number -> `table.cellType` naming
    row 1 and column `Qty`
  - ids are `c1..`/`r1..`

## Verification (exits 0 and shows at least 1 test with 0 failures; log under `tmp/tsh-s778/tsh-01d-values/final/`)

1. `bun test ./packages/core/src/table-sheet/coerce.test.ts ./packages/core/src/table-sheet/columns.test.ts ./packages/core/src/table-sheet/grid.test.ts` -> `values.log`

Static checks (tsh-00): `bunx biome check` on the six owned files, then
`bun run typecheck`. Errors confined to sibling wave-1 files or the barrel
are recorded, not fixed.

## Done criteria

- All pinned names are exported, and the `Column N` examples pass.
- Verification 1 exited 0 with at least 20 tests.
- The only import from a sibling-owned file is the `import type` of
  `./types.ts`. Check with `grep -n "from \"./" packages/core/src/table-sheet/coerce.ts packages/core/src/table-sheet/columns.ts packages/core/src/table-sheet/grid.ts`
  and record the output.
- The progress log is complete.
