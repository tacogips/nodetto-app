# tsh-01-model

- planId: tsh-01-model
- planPath: impl-plans/active/tsh-01-model.md
- progressPath: impl-plans/progress/tsh-01-model.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-table-sheet.md` sections 1-4 and 6 (edits, coercion, clipboard), 9 (defaults), 12.
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md` ("Pinned contracts" are binding).
- writePaths:
  - `packages/ir/src/semantics/table.ts` (new)
  - `packages/ir/src/registry/table.ts` (new)
  - `packages/ir/src/registry/table.test.ts` (new)
  - `packages/ir/src/semantics.ts`
  - `packages/ir/src/registry.ts`
  - `packages/ir/src/index.ts`
  - `packages/ir/src/registry.test.ts`
  - `packages/io/src/__fixtures__/table-sheet.jsonl` (new)
  - `packages/io/src/jsonl/golden.test.ts`
  - `packages/io/src/jsonl/table-sheet.test.ts` (new)
  - `packages/core/src/table-sheet/index.ts` (new)
  - `packages/core/src/table-sheet/layout.ts` (new)
  - `packages/core/src/table-sheet/layout.test.ts` (new)
  - `packages/core/src/table-sheet/paint.ts` (new)
  - `packages/core/src/table-sheet/shape.ts` (new)
  - `packages/core/src/table-sheet/shape.test.ts` (new)
  - `packages/core/src/table-sheet/edits.ts` (new)
  - `packages/core/src/table-sheet/edits.test.ts` (new)
  - `packages/core/src/table-sheet/coerce.ts` (new)
  - `packages/core/src/table-sheet/coerce.test.ts` (new)
  - `packages/core/src/table-sheet/tsv.ts` (new)
  - `packages/core/src/table-sheet/tsv.test.ts` (new)
  - `packages/core/src/table-sheet/grid.ts` (new)
  - `packages/core/src/table-sheet/grid.test.ts` (new)
  - `packages/core/src/table-sheet/apply.ts` (new)
  - `packages/core/src/table-sheet/apply.test.ts` (new)
  - `packages/core/src/index.ts` (one barrel line only)
  - `impl-plans/progress/tsh-01-model.md`
  - `tmp/tsh-s776/tsh-01-model`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan creates the data contract that every other plan builds on. It
covers four things:

- the `table.sheet` payload types, limits and validation in `@nodetto/ir`
- registration of the type inside the IR package, with the golden JSONL fixture
- the pure core modules: geometry/layout, paint constants, `ShapeUtil`,
  edit functions, value coercion, TSV, and CSV/grid import
- a barrel export so wave-2 plans can import everything through
  `@nodetto/core`

Nothing here touches the DOM, the CLI dispatch or the canvas. Do not
register the `ShapeUtil` in `packages/core/src/shapes/index.ts`. That is
tsh-08's job.

## Non-goals

- No SVG rendering (tsh-02), no Solid code, no CLI.
- No formulas, sorting or merged cells.
- No changes to erd files or `commands.ts`.

## File-level changes

1. `packages/ir/src/semantics/table.ts`
   - Add the types, `TABLE_SHEET_COLUMN_TYPES`, `TABLE_SHEET_ALIGNS`,
     `TABLE_SHEET_LIMITS`, `TABLE_SHEET_ID_PATTERN`, `isTableSheetDate` and
     `tableSheetValueMatches`, exactly as pinned in tsh-00.
   - `isTableSheetDate` checks `^\d{4}-\d{2}-\d{2}$`, months 1-12 and day
     ranges with leap years. Use integer arithmetic only, no `Date`. This
     keeps it deterministic in Boa.
   - Imitate `packages/ir/src/semantics/erd.ts` (`as const` tuples plus derived types).
2. `packages/ir/src/registry/table.ts`: `TABLE_SHEET: ElementTypeDefinition`.
   - Imitate `packages/ir/src/registry/erd.ts:ERD_TABLE` and `packages/ir/src/ui-controls.ts:uiControlDefinition`.
   - `category: "node"`, `onReferenceDeleted: "detach"`, `references: noReferences`.
   - keyOrder: `keys ["columns","rows","headerRow","striped"]`.
     children: `columns {keys ["id","name","type","width","align","options"]}`
     and `rows {keys ["id","height","cells"]}`.
   - Pitfall: do NOT add `cells` to the rows children. Its keys are column
     ids, and `validate.ts` would then warn `semantic.unknownField` for every
     cell.
   - validateSemantic: use the `checks.ts` helpers. The codes are in design
     section 3:
     - `table.id`, `id.duplicate` (separately for columns and rows),
       `table.noColumns`, `table.limit`, `table.size`
     - `table.unknownColumn`, `table.cellEmpty`, `table.cellType`,
       `table.options`, `table.cellFill`
   - Limits:
     - `table.limit` is raised when columns exceed 100 or rows exceed 1000.
       The message names the limit.
     - String values are capped at 10000 code units, column names at 200,
       options at 100 per column, and each option at 1 to 200 code units.
     - `table.size` is raised when width is not an integer in 24..2000, or
       height not an integer in 20..2000.
   - `fill` must match `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`.
   - Optional `headerRow` and `striped` are booleans, and `align` uses
     `checkEnum`.
   - Iterate cells with `Object.keys`. A key that is not a column id gives
     `table.unknownColumn` at `${path}.rows[i].cells.${key}`.
3. `packages/ir/src/semantics.ts`: import `TableSheetSemantic`, add
   `export * from "./semantics/table.ts"`, and add
   `"table.sheet": TableSheetSemantic` to `SemanticByType`.
4. `packages/ir/src/registry.ts`: import `TABLE_SHEET` and append it to
   `DEFINITIONS` right after `ERD_TABLE`.
5. `packages/ir/src/index.ts`: export the new symbols, following that
   file's existing export style. Export `TABLE_SHEET` only if the other
   definitions are exported.
6. `packages/ir/src/registry.test.ts`: add `"table.sheet"` to the expected
   sorted type list.
7. `packages/io/src/__fixtures__/table-sheet.jsonl`: one document, one
   freeform page, one `table.sheet` element. It covers:
   - all five column types
   - a select with 3 options and an aligned column
   - a cell with bold, align and fill
   - a text value containing `\n`
   - a row with `height: 40` and a row with `cells: {}`
   - `headerRow: false`, `striped: true`
   Generate it in canonical form: write it, then run
   `serializeDocument(parseDocument(text))` once in a scratch script under
   `tmp/tsh-s776/tsh-01-model/` and save that output. Append
   `"table-sheet"` to `GOLDEN` in `golden.test.ts`.
8. `packages/io/src/jsonl/table-sheet.test.ts`: round-trip and validation
   tests (below).
9. `packages/core/src/table-sheet/*`: implement the pinned signatures.
   - `layout.ts`:
     - `readTableSheet` copies the defensive reads in
       `packages/ui-solid/src/shapes/ErdTableView.tsx:semanticOf`.
     - `tableSheetBounds` follows the
       `packages/core/src/shapes/erdTable.ts:erdTableBounds` pattern:
       width is the sum of column widths; height is
       `(headerRow !== false ? 32 : 0)` plus the sum of row heights; with
       zero rows and no header the height is 28.
     - `tableSheetLayout` is row-major. Default alignment is right for
       number, center for checkbox, otherwise left; cell `align` overrides
       column `align`, which overrides the default.
     - Striping: `striped` is true for odd row index when `s.striped`.
     - `display`: `String(number)`, the ISO date, the option text, or text
       with each `\r\n`, `\n` or `\r` replaced by one space. Checkbox cells
       get `kind:"checkbox"` and `display:""`. Select cells get
       `kind:"pill"`, and `pill` comes from
       `TABLE_SHEET_PAINT.pillPalette[options.indexOf(value) % 8]`. An
       absent value gives `kind:"empty"`.
     - `fitCellText` truncates by `graphemes` using `wideAwareTextWidth` and
       appends the ellipsis. Both are in `packages/core/src/text-layout.ts`
       and `packages/core/src/wide-text-width.ts`. Read their signatures
       before use.
   - `paint.ts`: `TABLE_SHEET_PAINT`. `stripeFill` is a fixed hex with
     alpha. The 8 pill fill/text pairs are fixed hex values with text
     contrast of at least 4.5:1.
   - `shape.ts`: `tableSheetShapeUtil` (`type "table.sheet"`,
     `canResize: false`, `getBounds`/`hitTest` via `tableSheetBounds`, no
     `resize`) and `defaultTableSheetSemantic()`:
     - columns: Name text 160, Status select [Todo, Doing, Done] 120,
       Done checkbox 80
     - 3 rows with `cells: {}`
     - ids `c1`-`c3`, `r1`-`r3`
     - the bounds are 360x116
   - `edits.ts`: every function is pure and returns a new object. It never
     mutates its input and preserves untouched rows and columns by
     reference.
     - Drop empty cells, and drop `bold:false`, an `align` equal to the
       column default, and empty `fill`.
     - Round sizes and clamp them to the limits.
     - Write `headerRow` only as `false` and `striped` only as `true`.
     - Return `{ok:false, code:"table.limit"}` instead of exceeding a limit.
     - `deleteColumns` removes those keys from every row's `cells`, and
       refuses with `table.lastColumn` when no column would remain.
     - `insertColumn(s, at, ids, type?)` defaults, binding for tsh-05 and
       tsh-04:
       - The new column is named `Column N`, where N is the column count
         after insertion (1-based), the same rule as `pasteGrid`. A
         default 3x3 gives `Column 4`.
       - Width is `TABLE_SHEET_DEFAULT_COLUMN_WIDTH` (120).
       - Type is the `type` argument, otherwise `text`. A new `select` column
         has no `options` key until options are set.
       - The id is `ids()`. No `align` is set and no cells are added.
       - `at` is clamped to 0..columns.length.
       - When the table already has 100 columns, return
         `{ok:false, code:"table.limit"}`.
     - `insertRow(s, at, ids)` inserts `{ id: ids(), cells: {} }` with no
       `height`. `at` is clamped. At 1000 rows it returns `table.limit`.
     - `retypeColumn` coerces existing values through `coerceCellText`
       applied to `clipboardCellText` of the old value. Retyping to select
       seeds options from distinct non-empty strings in row order, capped
       at 100; retyping away from select drops `options`. Unconvertible
       values are cleared and counted in `skipped`.
   - `coerce.ts`: the rules in design section 6.
     - number regex `^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$` on the
       trimmed text, and the result must be finite
     - checkbox: true/false/1/0/yes/no/x, case-insensitive, trimmed
     - date: `isTableSheetDate` on the trimmed text
     - select: exact option match; otherwise a non-empty value returns
       `newOption`
     - text: any string, verbatim, with no trimming
     - `clipboardCellText` reads the STORED value: exact string,
       `String(n)`, `TRUE`/`FALSE`, the option, the date, or `""` when
       absent.
   - `tsv.ts`:
     - `serializeTsv`: quote a field containing a tab, `\r`, `\n` or `"`,
       doubling inner quotes. Join fields with `\t` and rows with `\n`, with
       no trailing newline.
     - `parseTsv` is a char scanner that handles quoted fields, `\r\n` and
       `\n`, and ignores one trailing newline. Required invariant:
       `parseTsv(serializeTsv(g))` deep-equals `g` for any grid with at
       least one row.
     - `clipboardGrid` uses `clipboardCellText`, never `layout.display`.
     - `pasteGrid` writes from `at`, appending rows (ids from `ids`) and
       text columns named `Column N` with width 120. N is the next 1-based
       column position. It coerces per target column and appends select
       `newOption`s up to the limit. If any limit would be exceeded it
       returns `{ok:false, code:"table.limit"}` and changes nothing.
   - `grid.ts`:
     - `parseCsv` is an RFC 4180 char scanner: quoted fields, doubled
       quotes, embedded newlines, optional leading `﻿`, and `\r\n` or
       `\n`.
     - `tableSheetFromGrid`: when `header` is true, the first record gives
       the names; otherwise names are `Column 1..N`. N is the maximum record
       length, and ragged rows are padded with empty cells.
     - Types default to text, and a `types` entry with the wrong length
       gives `table.limit` with an explanatory message only if it is longer
       than N. Widths default to 120.
     - Values are coerced per type. A value that cannot be coerced returns
       `{ok:false, code:"table.cellType", message}` naming row and column.
       This is CLI strictness.
     - Ids are `c1..cN` and `r1..rM`.
   - `apply.ts`: `applyTableSheetEdit(editor: Editor, id: ElementId, edit:
     (s: TableSheetSemantic) => TableSheetEditResult): TableSheetEditResult`.
     - It reads the element fresh from `editor.store.get(id)` and returns
       `{ok:false, code:"table.unknownRow"}` with a message when the
       element is missing or not a `table.sheet`. Do not add a code.
     - When the result is ok and `semantic` is not deep-equal to the
       current one, it issues exactly one
       `editor.apply([{ type: "updateSemantic", id, semantic }])`.
     - Imitate `packages/core/src/editor.ts` lines 85-92, which already
       issue `updateSemantic`.
     - It applies nothing for a no-op, so no empty history entry is
       created.
   - `index.ts` re-exports every pinned symbol.
10. `packages/core/src/index.ts`: add exactly one line,
    `export * from "./table-sheet/index.ts";`, next to the existing
    `export * from "./bpmn/index.ts";`. Do not touch other lines.

## Invariants

- No `Command` kind is added. `@nodetto/core` does not register the util.
- Core modules import from `@nodetto/ir` only, never from `../../ir`.
- Edits are deterministic. They use no `Date`, randomness or locale. Ids
  come only from the `IdSource` argument.
- erd.table validation output is unchanged: `bun test ./packages/ir/src/registry/erd.test.ts` still passes.

## Tests to add (input -> expected)

- `registry/table.test.ts`:
  - `defaultTableSheetSemantic`-shaped payload and fixture payload -> `expectValid`
  - duplicate column id -> `id.duplicate`; duplicate row id -> `id.duplicate`
  - `__proto__` column id -> `table.id`; `columns: []` -> `table.noColumns`
  - 101 columns -> `table.limit`; 100 -> valid; 1001 rows -> `table.limit`; 1000 -> valid
  - text of 10001 chars -> `table.limit`; 10000 -> valid
  - width 23, 2001, 24.5 -> `table.size`; height 19 -> `table.size`
  - cell key `zz` -> `table.unknownColumn`; `{}` cell -> `table.cellEmpty`
  - number column `"5"` -> `table.cellType`; checkbox `1` -> `table.cellType`
  - select `"Nope"` -> `table.cellType`; date `2023-02-29` -> `table.cellType`; `2024-02-29` -> valid
  - options on a text column -> `table.options`; duplicate option -> `table.options`
  - fill `red` -> `table.cellFill`
  - unknown semantic key `extra` -> no error. The `validateDocument`
    warning appears, and no warning is raised for cell keys.
- `jsonl/table-sheet.test.ts`:
  - the fixture serializes back byte-for-byte
  - `validateDocument` has no errors and no `semantic.unknownField`
  - cell keys written in a different order -> canonical sorted output
- `layout.test.ts`:
  - 3 columns 160/120/80, 3 default rows -> bounds 360x116
  - `headerRow:false` -> 84; rows `[]` with no header -> 28; a row height 40 is counted
  - number default align right, checkbox center, cell align overrides
  - the display of `"alpha\nbeta"` is `"alpha beta"`
  - pill color index stable; striped flag on rows 1 and 3 only
  - `fitCellText("abcdefghij", 30, 12)` ends with the ellipsis and fits;
    short text is unchanged
- `shape.test.ts`:
  - `getBounds` equals `tableSheetBounds`, and stored `visual.width` is ignored
  - `hitTest` is inside/outside correctly
  - `canResize` is false; the default is 3x3 with the pinned ids
- `edits.test.ts`:
  - each edit returns a new object and leaves the input deep-equal to a
    frozen copy
  - `deleteColumns` of the last column -> `table.lastColumn`
  - `insertColumn(default3x3, 3, ids)` with a deterministic IdSource
    returning `"x1"` -> the new column is
    `{id:"x1", name:"Column 4", type:"text", width:120}` at index 3, with no
    `align`/`options` keys and every row's `cells` unchanged
  - `insertColumn(s, 0, ids, "number")` -> type number at index 0, named
    `Column 4`
  - `insertColumn` on a 100-column table -> `table.limit` and the input is
    unchanged
  - `insertRow(default3x3, 3, ids)` -> row `{id:"x1", cells:{}}` appended
  - `insertRow` at 1001 rows -> `table.limit`
  - `setCellText` `""` removes the cell when it has no style
  - `setCellStyle({bold:null})` removes `bold`
  - `retypeColumn` text->number keeps `"12"` as 12 and clears `"x"`
    (skipped 1); retype to select seeds options
  - `resizeColumn(…, 10)` clamps to 24; `setStriped(false)` removes the key
- `coerce.test.ts`:
  - `" 1e3 "` -> 1000; `"1,000"` -> not ok; `"YES"` -> true
  - `"2024-13-01"` -> not ok; select unknown -> `newOption`
  - text `"  a\tb\n"` -> stored verbatim
  - `clipboardCellText` of a text `"alpha\nbeta"` -> `"alpha\nbeta"`, not `"alpha beta"`
- `tsv.test.ts`:
  - serialize/parse round trip of `[["alpha\nbeta","tab\there"],["say \"hi\"","line1\r\nline2"]]`, which is exact
  - Excel-style input with CRLF rows and a trailing CRLF -> grid without an extra row
  - `clipboardGrid` for a range containing `"alpha\nbeta"` returns the
    stored string exactly
  - `pasteGrid` at the bottom-right grows rows and columns, with
    `Column 4`, width 120 and ids from a deterministic IdSource
  - `pasteGrid` over 100 columns -> `table.limit` and the input is unchanged
  - `pasteGrid` of `"x"` into a number column -> cell cleared, skipped 1
  - `pasteGrid` of an unknown select value -> option appended
  - copy then paste into another range preserves `"alpha\nbeta"`,
    `"tab\there"`, `say "hi"` and `"line1\r\nline2"` exactly (pure-level
    preservation)
- `apply.test.ts` (use `new Editor()`. `table.sheet` is registered in the
  IR, so `createElement` validates it):
  - `setCellText` through apply -> one history entry, and `editor.undo()`
    restores the prior semantic
  - a no-op edit -> no history entry
  - an `ok:false` edit -> semantic unchanged
  - a missing id -> ok false
- `grid.test.ts`:
  - CSV with a BOM, quoted comma, doubled quote and embedded newline parses
    correctly
  - ragged rows are padded; header names are used; `header:false` gives
    `Column 1..N`
  - `types ["text","number"]` with a bad number -> `table.cellType` naming
    the row and column
  - ids are `c1..`/`r1..`

## Verification (each must exit 0; test commands must show at least 1 test and 0 fail)

1. `bun test ./packages/ir/src/registry/table.test.ts ./packages/ir/src/registry.test.ts ./packages/ir/src/registry/erd.test.ts` -> log `ir.log`
2. `bun test ./packages/io/src/jsonl/table-sheet.test.ts ./packages/io/src/jsonl/golden.test.ts` -> `io.log`
3. `bun test ./packages/core/src/table-sheet` -> `core.log`. The log must list only files under `packages/core/src/table-sheet/`.
4. `bun test ./packages/core/src/semantic-field-audit.test.ts` -> `audit.log`. The fixture produces no unknown-field warnings.
5. `bun run typecheck` -> `typecheck.log` (static gate)
6. `bunx biome check <every file in writePaths that exists, excluding tmp and target> --diagnostic-level=warn` -> `biome.log` (static gate)

## Done criteria

- Every listed file exists, and `git diff -- packages/core/src/index.ts` adds exactly one line.
- Verifications 1-6 exited 0, with logs under `tmp/tsh-s776/tsh-01-model/final/`.
- `git diff --stat -- packages/ir/src/registry/erd.ts packages/core/src/shapes/erdTable.ts packages/core/src/commands.ts` is empty.
- The progress log has the intent hash, the per-edit hashes and the
  command results.
