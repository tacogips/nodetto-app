# tsh-01c-edits

- planId: tsh-01c-edits
- planPath: impl-plans/active/tsh-01c-edits.md
- progressPath: impl-plans/progress/tsh-01c-edits.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-table-sheet.md`, section 6 (edits,
  clipboard TSV) and section 8 (CSV).
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`. The
  signatures for this plan are pinned there under "tsh-01c-edits".
- writePaths:
  - `packages/core/src/table-sheet/types.ts` (new)
  - `packages/core/src/table-sheet/edits.ts` (new)
  - `packages/core/src/table-sheet/edits.test.ts` (new)
  - `packages/core/src/table-sheet/apply.ts` (new)
  - `packages/core/src/table-sheet/apply.test.ts` (new)
  - `packages/core/src/table-sheet/delimited.ts` (new)
  - `packages/core/src/table-sheet/delimited.test.ts` (new)
  - `impl-plans/progress/tsh-01c-edits.md`
  - `tmp/tsh-s780/tsh-01c-edits`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan provides:

- the shared edit result types
- the style and structure edits that need no value coercion
- `applyTableSheetEdit`, the only way app code writes a table edit: one
  `updateSemantic`, which is one undo entry
- the pure TSV/CSV text codecs

Value writes, coercion and the `Column N` rule belong to tsh-01d. Do not
implement `setCellValue`, `setCellText`, `clearRange`, `retypeColumn`,
`insertColumn` or the grid functions here.

## Non-goals

- No coercion, no column naming and no paste.
- No index or barrel edits.
- No new `Command` kind.

## File-level changes

1. `types.ts`:
   - It holds exactly the three pinned declarations, plus
     `import type { TableSheetSemantic } from "@nodetto/ir";`.
   - No runtime code. tsh-01d imports it type-only.
2. `edits.ts`: the pinned functions.
   - Each returns `{ok:true, semantic, skipped}` or `{ok:false, code,
     message}`.
   - A no-op returns the input object with `skipped: 0`.
   - Every function is pure and keeps untouched rows and columns by
     reference.
   - `setCellStyle`:
     - `null` removes a key. Drop `bold:false`, an `align` equal to the
       column's default alignment (number right, checkbox center, else
       left, or the column's own `align`), and an empty `fill`.
     - Remove the cell key when the cell has no keys left.
     - Do not validate `fill` format beyond an empty check. Validation
       catches the rest.
   - `insertRow(s, at, ids)`:
     - Inserts `{id: ids(), cells: {}}` with no `height`.
     - `at` is clamped to `0..rows.length`.
     - At 1000 rows it returns `table.limit`.
   - `deleteRows`:
     - Unknown ids give `table.unknownRow`.
     - Deleting all rows is allowed.
   - `deleteColumns`:
     - Removes those keys from every row's `cells`, and drops rows' empty
       cells.
     - Removing every column gives `table.lastColumn`.
     - Unknown ids give `table.unknownColumn`.
   - `moveColumn(s, from, to)`: clamps both indices. `from === to` is a
     no-op.
   - `renameColumn`: truncates nothing. A name over 200 gives `table.limit`.
   - `setColumnOptions`:
     - Accepts only select columns, otherwise `table.cellType`.
     - De-duplicates the options and drops empty ones.
     - Over 100 options, or an option over 200, gives `table.limit`.
     - Clears values that are no longer options and counts them in
       `skipped`.
   - `setColumnAlign`: `undefined` removes the key.
   - `resizeColumn`/`resizeRow`: round, then clamp to 24..2000 and 20..2000.
     Equal to the current value is a no-op. `resizeRow` writes `height`
     even when it equals 28. Only the no-op rule applies.
   - `setHeaderRow(true)` removes the key, and `false` writes `false`.
     `setStriped(true)` writes `true`, and `false` removes it.
3. `apply.ts`: `applyTableSheetEdit(editor, id, edit)`.
   - Read the element fresh with `editor.store.get(id)`.
   - Missing or not `type === "table.sheet"` -> `{ok:false,
     code:"table.unknownRow", message}`. Do not add a code.
   - Pass `element.semantic` as `TableSheetSemantic` (the editor holds only
     validated documents). Do not import `layout.ts`, which belongs to
     tsh-01b.
   - On `ok:true` with `result.semantic !== current`, call
     `editor.apply([{ type: "updateSemantic", id, semantic }])` exactly
     once. Look at `packages/core/src/editor/facade/core.ts` for `apply`'s
     signature, and imitate an existing `updateSemantic` caller.
   - Return the result unchanged.
4. `delimited.ts`: character scanners. No regex split over whole input.
   - `serializeTsv`:
     - Quote a field containing a tab, `\r`, `\n` or `"`, doubling inner
       quotes.
     - Fields are joined with `\t`, rows with `\n`. No trailing newline.
   - `parseTsv`:
     - Handles quoted fields, `\r\n` and `\n`.
     - Ignores exactly one trailing line break.
     - `""` -> `[]`.
     - Invariant: `parseTsv(serializeTsv(g))` deep-equals `g` for any grid
       with at least one row and one field.
   - `parseCsv`: RFC 4180.
     - Comma separator, quoted fields, doubled quotes and embedded newlines.
     - Strips one leading U+FEFF.
     - `\r\n` or `\n`, and one trailing line break ignored.
     - Ragged rows are returned as-is. Padding is tsh-01d's job.

## Tests (input -> expected)

Build semantic fixtures locally. Do not import `shape.ts` or other plans'
files.

- `edits.test.ts`:
  - each edit leaves a deep-frozen input unchanged
  - `insertRow(s3x3, 3, () => "x1")` -> the last row is `{id:"x1", cells:{}}`
  - 1000 rows + `insertRow` -> `table.limit`
  - `deleteColumns(s, ["c1","c2","c3"])` -> `table.lastColumn`
  - deleting c2 removes `c2` keys from cells
  - `setCellStyle({bold:true})` then `{bold:null}` -> the cell key is
    removed
  - `resizeColumn(..., 10)` -> 24; `resizeColumn(..., 160)` on a column of
    width 160 -> the same object
  - `setStriped(false)` -> no `striped` key; `setHeaderRow(false)` ->
    `headerRow:false`
  - `setColumnOptions(["Todo"])` with a cell `Doing` -> the cell value is
    cleared and `skipped` is 1
  - `moveColumn(s, 0, 2)` -> order c2, c3, c1
  - an unknown row id -> `table.unknownRow`
- `apply.test.ts`. Use `new Editor()`. Create the table with
  `editor.createElement("table.sheet", { semantic, visual: {x:0, y:0} })`,
  passing an explicit semantic. Core validation accepts it whether or not
  tsh-01a has registered the type.
  - `setStriped(true)` through apply -> one history entry, and
    `editor.undo()` restores the prior semantic
  - a no-op edit -> history depth unchanged
  - an `ok:false` edit -> semantic unchanged
  - a missing id -> `ok:false`
- `delimited.test.ts`:
  - exact round trip of
    `[["alpha\nbeta","tab\there"],["say \"hi\"","line1\r\nline2"]]`
  - `"a\tb\r\nc\td\r\n"` -> `[["a","b"],["c","d"]]`, with no extra row
  - CSV with a BOM, a quoted comma, a doubled quote and an embedded newline
    parses correctly
  - a ragged CSV is returned ragged

## Verification (exits 0 and shows at least 1 test with 0 failures; log under `tmp/tsh-s780/tsh-01c-edits/final/`)

1. `bun test ./packages/core/src/table-sheet/edits.test.ts ./packages/core/src/table-sheet/apply.test.ts ./packages/core/src/table-sheet/delimited.test.ts` -> `edits.log`

Static checks (tsh-00): `bunx biome check` on the seven owned files, then
`bun run typecheck`. Errors confined to sibling wave-1 files or the barrel
are recorded, not fixed.

## Done criteria

- `types.ts` matches tsh-00 verbatim.
- Every pinned `edits.ts`, `apply.ts` and `delimited.ts` function is
  exported.
- Verification 1 exited 0 with at least 15 tests.
- `git diff --stat -- packages/core/src/commands.ts` is empty, and the
  progress log is complete.
