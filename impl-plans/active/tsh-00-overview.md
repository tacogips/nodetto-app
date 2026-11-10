# tsh-00 overview: spreadsheet table element `table.sheet` (session 778)

- Design (binding): `design-docs/specs/design-table-sheet.md`, sections 1-14.
  Section 11 gives the plan split, and section 6 gives the `Column N` rule.
- Owner questions: `design-docs/user-qa/table-sheet.md`, Q1 to Q6. Implement
  every default.
- Issue: none. The source is the runtime workflowInput of session 778, which
  continues the blocked session 776.
- Base: `87365fb` plus the plan commit of this run. The plan commit also
  carries a contract seed: `packages/ir/src/semantics.ts` re-exports
  `./semantics/table.ts`, and `packages/ir/src/index.ts` re-exports the
  section 2 symbols. That makes the committed IR contract importable from
  `@nodetto/ir` before wave 1 starts.
- Evidence root: `tmp/tsh-s778/<planId>/`. Progress log:
  `impl-plans/progress/<planId>.md`. Do not push, merge or bump versions.
- This overview is not dispatched and has no write paths.
- Superseded plans: `tsh-01-model` and `tsh-04-cell-editing`. Never
  dispatch them. `impl-plans/progress/tsh-01-model.md` is kept as history.

## Waves and ownership

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | tsh-01a-ir | IR validation, IR registration, golden fixture, core barrel | - |
| 1 | tsh-01b-layout | core `layout.ts`, `paint.ts`, `shape.ts` | - |
| 1 | tsh-01c-edits | core `types.ts`, `edits.ts`, `apply.ts`, `delimited.ts` | - |
| 1 | tsh-01d-values | core `coerce.ts`, `columns.ts`, `grid.ts` | - |
| 2 | tsh-02-export | `renderTableSheet` | 01a, 01b |
| 2 | tsh-03-view | `TableSheetView` | 01a, 01b |
| 2 | tsh-04a-navigation | selection, keyboard, cell editor, overlay | 01a, 01b, 01c, 01d |
| 2 | tsh-04b-clipboard | TSV copy, cut, paste | 01a, 01c, 01d |
| 2 | tsh-04c-resize | border hit test, resize drag | 01a, 01b, 01c |
| 2 | tsh-05-inspector | `TableSheetSection` | 01a, 01b, 01c, 01d |
| 2 | tsh-06-cli | `table` command, `set-cells` op | 01a, 01c, 01d |
| 2 | tsh-07-docs | user docs and the drift test | 01a |
| 3 | tsh-08-wiring | every shared dispatch and registration file | all wave 2 |

Each file has exactly one owner. tsh-06 owns the CLI-internal op dispatch
files `apps/cli/src/edit/batch.ts`, `operation-fields.ts` and
`operation-fields.test.ts`. `commands.ts`, `help.ts` and `types-command.ts`
stay with tsh-08.

## Wave-1 independence rules (design section 11)

- No wave-1 file imports, at runtime, a file owned by another wave-1 plan.
  IR primitives come from `@nodetto/ir`, which the contract seed makes
  available. Core primitives come from existing core modules by relative
  path.
- The only cross-plan reference is from tsh-01d-values:
  `import type { TableSheetEditResult, TableSheetRange } from "./types.ts"`.
  It must be a type-only import. tsh-01c-edits writes `types.ts` with the
  exact content pinned below.
- Wave-1 tests import modules by relative path (`./edits.ts`), never through
  `./index.ts`, `../index.ts` or `@nodetto/core`.
- Each plan has private helpers. Do not import another plan's helper. For
  example, the "drop a cell left with no keys" rule is implemented
  separately in `edits.ts` and in `coerce.ts`.

## Pinned contracts (exact names; do not rename)

```ts
// @nodetto/ir (committed in 87365fb, exported by the contract seed)
TABLE_SHEET_COLUMN_TYPES, TableSheetColumnType, TABLE_SHEET_ALIGNS, TableSheetAlign,
TableSheetColumn, TableSheetCellValue, TableSheetCell, TableSheetRow, TableSheetSemantic,
TABLE_SHEET_LIMITS, TABLE_SHEET_ID_PATTERN, isTableSheetDate, tableSheetValueMatches
// tsh-01a-ir
export const TABLE_SHEET: ElementTypeDefinition;            // packages/ir/src/registry/table.ts
SemanticByType["table.sheet"]: TableSheetSemantic

// tsh-01b-layout: layout.ts
export const TABLE_SHEET_HEADER_HEIGHT = 32, TABLE_SHEET_DEFAULT_ROW_HEIGHT = 28,
  TABLE_SHEET_CELL_PADDING_X = 8, TABLE_SHEET_FONT_SIZE = 12;
export function readTableSheet(semantic: unknown): TableSheetSemantic;   // defensive, never throws
export function tableSheetBounds(visual: { x?: number; y?: number }, semantic: unknown): Box;
export interface TableSheetHeaderCell { columnId; columnIndex; x; y; width; height; text; align }
export interface TableSheetCellLayout { rowId; columnId; rowIndex; columnIndex; x; y; width; height;
  kind: "empty" | "text" | "checkbox" | "pill"; display: string; align: TableSheetAlign;
  bold: boolean; fill?: string; checked?: boolean; pill?: { fill: string; text: string } }
export interface TableSheetLayout { box: Box; headerHeight: number;
  columns: readonly { id; index; x; width; type; align }[];
  rows: readonly { id; index; y; height; striped: boolean }[];
  header: readonly TableSheetHeaderCell[];      // empty when headerRow === false
  cells: readonly TableSheetCellLayout[] }      // row-major, every row x column
export function tableSheetLayout(element: Element): TableSheetLayout;  // page coordinates
export function fitCellText(text: string, maxWidth: number, fontSize: number): string;
// paint.ts
export const TABLE_SHEET_PAINT: { stripeFill: string; checkboxSize: 14; pillHeight: 18; pillRadius: 9;
  pillPalette: readonly { fill: string; text: string }[] /* length 8 */ };
// shape.ts
export const tableSheetShapeUtil: ShapeUtil;      // canResize false; defaultVisual {x:0,y:0}
export function defaultTableSheetSemantic(): TableSheetSemantic;   // 3x3, ids c1..c3 / r1..r3

// tsh-01c-edits: types.ts (verbatim, plus one import type line for TableSheetSemantic)
export interface TableSheetRange { readonly top: number; readonly left: number;
  readonly bottom: number; readonly right: number }                 // inclusive indices
export type TableSheetEditCode = "table.limit" | "table.cellType" | "table.lastColumn"
  | "table.unknownRow" | "table.unknownColumn";
export type TableSheetEditResult =
  | { readonly ok: true; readonly semantic: TableSheetSemantic; readonly skipped: number }
  | { readonly ok: false; readonly code: TableSheetEditCode; readonly message: string };
// edits.ts: every function is (s: TableSheetSemantic, ...) => TableSheetEditResult
setCellStyle(s, rowId, columnId, style: { bold?: boolean | null; align?: TableSheetAlign | null; fill?: string | null })
insertRow(s, at: number, ids: IdSource)  deleteRows(s, rowIds: readonly string[])
deleteColumns(s, columnIds: readonly string[])   moveColumn(s, from: number, to: number)
renameColumn(s, id, name)  setColumnOptions(s, id, options: readonly string[])
setColumnAlign(s, id, align: TableSheetAlign | undefined)
resizeColumn(s, id, width)  resizeRow(s, id, height)  setHeaderRow(s, on)  setStriped(s, on)
// apply.ts
applyTableSheetEdit(editor: Editor, id: ElementId,
  edit: (s: TableSheetSemantic) => TableSheetEditResult): TableSheetEditResult
// delimited.ts
parseTsv(text: string): string[][]   serializeTsv(grid: readonly (readonly string[])[]): string
parseCsv(text: string): string[][]

// tsh-01d-values: coerce.ts
coerceCellText(column: TableSheetColumn, text: string): { ok: boolean; value?: TableSheetCellValue; newOption?: string }
clipboardCellText(column: TableSheetColumn, cell: TableSheetCell | undefined): string   // from STORED value
setCellValue(s, rowId, columnId, value: TableSheetCellValue | undefined): TableSheetEditResult
setCellText(s, rowId, columnId, text: string): TableSheetEditResult      // coerces; "" clears
clearRange(s, range: TableSheetRange): TableSheetEditResult
retypeColumn(s, id, type: TableSheetColumnType): TableSheetEditResult
// columns.ts
export const TABLE_SHEET_DEFAULT_COLUMN_WIDTH = 120;
nextTableSheetColumnName(columns: readonly TableSheetColumn[]): string
insertColumn(s, at: number, ids: IdSource, type?: TableSheetColumnType): TableSheetEditResult
// grid.ts
clipboardGrid(s, range: TableSheetRange): string[][]
pasteGrid(s, at: { row: number; column: number }, grid: readonly (readonly string[])[], ids: IdSource): TableSheetEditResult
tableSheetFromGrid(grid: readonly (readonly string[])[], options: { header: boolean;
  types?: readonly TableSheetColumnType[]; widths?: readonly number[] }): TableSheetEditResult  // ids c1..cN, r1..rM
```

Shared semantics of every edit:

- A result with `ok: true` and no change returns the input object itself
  (`result.semantic === s`, `skipped: 0`). `applyTableSheetEdit` applies
  nothing in that case.
- Edits never mutate their input. Untouched rows and columns are kept by
  reference.
- An unknown row id gives `table.unknownRow`. An unknown column id gives
  `table.unknownColumn`.

`Column N` rule (owned by tsh-01d-values `columns.ts`, design section 6):

- A name uses N only if it matches `^Column [1-9][0-9]*$` exactly, with N
  the number in the name. `nextTableSheetColumnName` returns `Column N` for
  the smallest positive N that no name uses.
- `insertColumn` creates `{ id: ids(), name: next, type: type ?? "text",
  width: 120 }`. It adds no `align` or `options` (even for select) and no
  cells. `at` is clamped to `0..length`. At 100 columns it returns
  `table.limit` and the input is unchanged.
- `pasteGrid` appends text columns of width 120 left to right, each named
  by the rule, counting the columns it has already appended.
- `tableSheetFromGrid`: with `header: false` the names are `Column 1..N`.
  With `header: true` the header fields are used verbatim, and columns past
  the header record are named by the rule.
- Examples: the default 3x3 gives `Column 1`. `[Column 1, Column 3]` gives
  `Column 2`. `[Column 2]` gives `Column 1`. `Column 01` and `column 1` do
  not use 1.

Wave-2 exports that tsh-08 consumes:

- tsh-02: `renderTableSheet(element: Element, box: Box, theme: SvgTheme): string`.
- tsh-03: `TableSheetView(props: { element: Element }): JSX.Element`.
- tsh-04a (`packages/ui-solid/src/table-sheet/`):
  - `selection.ts`: `TableSheetCellRef`, `TableSheetSelectionState`,
    `TableSheetSelection`, `createTableSheetSelection` and
    `tableSheetCellClick`
  - `keyboard.ts`: `TableSheetKeyContext { editor; selection }` and
    `handleTableSheetKey`, which does not handle Cmd/Ctrl+C/X/V
  - `cell-commit.ts`: `commitCellText` and `cellEditorInitialText`
  - `CellEditor.tsx`: `TableSheetCellEditor`
  - `SelectionOverlay.tsx`: `TableSheetSelectionOverlay`
  - The exact signatures are in the tsh-04a plan.
- tsh-04b (`clipboard.ts`): `TableClipboardPort`, `copyTableRange`,
  `cutTableRange` and `pasteIntoTable`, with explicit targets. The
  signatures are in the tsh-04b plan.
- tsh-04c (`resize.ts`): `TableSheetRegion`, `tableSheetRegionAt`,
  `beginTableSheetResize` and `resetColumnWidth`.
- tsh-05: `TableSheetSection(props: { editor: Editor; element: Element; activeRowId?: string })`.
- tsh-06: `tableCommand(io, args)`, `TABLE_HELP` and `setCells(batch, operation, index)`.

## Rules for every worker

- Read your plan and the design sections it cites first. Do not widen
  scope. If you need to edit a file outside your `writePaths`, stop and
  record a blocker in your progress log that names the file and the symbol.
- Implement every file your plan owns before reporting. Then run all of
  your plan's verification commands.
- Before starting, record `git hash-object` of your plan file as the intent
  snapshot.
- Plans run concurrently on one branch and one working directory:
  - Read each file fresh before every edit.
  - Record pre and post `git hash-object` per edit.
  - If the pre hash differs from your last post hash, re-read the file, keep
    the other change and record the drift.
- Edit only your own progress log. Run no state-changing git commands.
  Run Biome only on your own files.
- Must not change:
  - `packages/ir/src/registry/erd.ts`
  - `packages/ir/src/semantics/erd.ts`
  - `packages/core/src/shapes/erdTable.ts`
  - `packages/ui-solid/src/shapes/ErdTableView.tsx`
  - `packages/core/src/commands.ts`
  - any erd test
  - any version field
- Use only self-authored neutral data, such as `Widget`, `Todo`, `alpha`,
  `beta` and `#ffeeaa`. No emojis.
- Shared-engine code (`packages/ir`, `packages/core`, `apps/cli/src`):
  - No `node:*` imports outside tests.
  - Write CSV/TSV parsers as character scanners, with no regex split over
    whole inputs.
  - No `Date`, randomness or locale APIs.
- Strict TypeScript. Guard indexed lookups. Read record keys with
  `Object.hasOwn`.
- Every document change is one `editor.apply([{ type: "updateSemantic" }])`
  (through `applyTableSheetEdit`), or the existing
  `createElement`/`updateVisual` paths. Never add a `Command` kind.

## Verification rules

- Every listed verification command must exit 0 and run at least one test.
  Test paths are explicit and `./`-prefixed, and name only files the plan
  creates or that already exist.
  - A plan may name a directory only if every test in it is the plan's own.
  - `packages/core/src/table-sheet/` and `packages/ui-solid/src/table-sheet/`
    are shared, so plans must list their own files.
- Confirm that each log names only the expected files and shows 1 or more
  passing tests with 0 failing.
- Write each command's full output to `tmp/tsh-s778/<planId>/final/<name>.log`.
  Record the exit status and the pass, fail and skip counts in the progress
  log. Before repeating a run, move `final/` to `attempt-<n>/`. An incomplete
  log is not a passing check.
- Static checks are not verification commands, but each plan runs and
  records them:
  - `bunx biome check <own files> --diagnostic-level=warn` must exit 0.
  - `bun run typecheck` must exit 0, except for errors located only in a
    sibling plan's file of the same wave, or the wave-1 core barrel before
    all four wave-1 plans land. Record those with the file name. Do not fix
    them.
- Wave gates are run by reconcile/review, not by workers:
  - after wave 1: `bun run typecheck` and `bun test ./packages/core/src/table-sheet/`
  - after wave 2: `bun run typecheck`
  - tsh-08: the workspace gates, including `mise run test-cli` with up to 3
    attempts under load. Deadlines are never relaxed.

## Done for the whole set

- Every plan's done criteria are met.
- tsh-08 recorded exit 0 for `bun run typecheck`, `mise run lint`,
  `mise run test`, `mise run test-cli` (attempts recorded),
  `mise run build-cli` and `mise run build`.
- `git diff --stat 87365fb -- packages/core/src/commands.ts packages/ir/src/registry/erd.ts packages/core/src/shapes/erdTable.ts packages/ui-solid/src/shapes/ErdTableView.tsx`
  is empty.
