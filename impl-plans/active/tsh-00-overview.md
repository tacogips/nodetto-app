# tsh-00 overview: spreadsheet table element `table.sheet`

- Design (binding): `design-docs/specs/design-table-sheet.md`.
- Owner questions: `design-docs/user-qa/table-sheet.md` Q1 to Q5. Implement
  every default.
- Issue: none. The source is the runtime workflowInput (session 776).
- Evidence root: `tmp/tsh-s776/<planId>/`. Progress logs:
  `impl-plans/progress/<planId>.md`.
- Base commit: `f59bef4a6774948d731bc404a7fac88fd41e1883`. Do not push,
  merge or bump versions.
- This overview is not dispatched and has no write paths.

## Waves and ownership

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | tsh-01-model | IR types, validation, registration, golden fixture; core pure modules (layout, paint, shape util, edits, coerce, tsv, csv/grid) | - |
| 2 | tsh-02-export | `renderTableSheet` SVG module | tsh-01 |
| 2 | tsh-03-view | Solid `TableSheetView` + CSS + view model | tsh-01 |
| 2 | tsh-04-cell-editing | Selection state, keyboard, cell editor, clipboard, resize, selection overlay | tsh-01 |
| 2 | tsh-05-inspector | `TableSheetSection` + inspector helpers | tsh-01 |
| 2 | tsh-06-cli | `table` command, `set-cells` edit op (incl. batch dispatch + op fields) | tsh-01 |
| 2 | tsh-07-docs | docs/editing.md, docs/cli.md, docs/import-export.md, docs drift test | tsh-01 |
| 3 | tsh-08-wiring | All cross-package dispatch/registration, README, spec status, end-to-end tests | tsh-02..tsh-07 |

Each file has exactly one owner. Plan-level refinements of the design, all
with the same behavior:

1. tsh-06 owns `apps/cli/src/edit/batch.ts`, `apps/cli/src/edit/operation-fields.ts`
   and `apps/cli/src/edit/operation-fields.test.ts`. These are CLI-internal
   op dispatch files that no other plan touches, and tsh-06 needs them to
   make `set-cells` testable through `runOperations` without waiting for
   wiring. Command dispatch (`commands.ts`) and `help.ts` stay with tsh-08.
   tsh-06 exports the help text as the constant `TABLE_HELP`.
2. Toolbox default ids: `tableSheetShapeUtil.defaultSemantic()` returns the
   3x3 table with fixed ids `c1..c3` and `r1..r3`. Ids only need to be
   unique within one table, so peers cannot collide when they create
   separate tables. Rows and columns added later in the app use
   `newElementId` (ULID). This replaces the design's "IdSource at creation"
   wording, because `Tool` creation (`packages/core/src/tools.ts`,
   `return { type: tool }`) takes the util's static defaults.
3. tsh-04 draws the active-cell and range highlight in its own overlay
   component, not inside `TableSheetView`. This keeps tsh-03 and tsh-04
   independent. tsh-08 mounts the overlay.
4. Clipboard transport: tsh-04 code takes and returns plain strings through
   an injected `TableClipboardPort`. tsh-08 connects the port to
   `navigator.clipboard.writeText/readText` on Cmd/Ctrl+C/X/V while a cell is
   active.
5. Shape id: catalogue ids are `ToolKind` values
   (`packages/core/src/shape-catalogue.ts:ShapeCatalogueEntry.id`; the ERD
   table's id is `erd.table`). So `draw`/`shapes` use `table.sheet`, not
   the design's `table:sheet`. tsh-08 corrects the design wording, and
   tsh-07 documents `table.sheet`.

## Pinned contracts (tsh-01 provides; wave 2 consumes; do not rename)

```ts
// packages/ir/src/semantics/table.ts, re-exported from @nodetto/ir
export const TABLE_SHEET_COLUMN_TYPES = ["text","number","checkbox","select","date"] as const;
export type TableSheetColumnType = (typeof TABLE_SHEET_COLUMN_TYPES)[number];
export const TABLE_SHEET_ALIGNS = ["left","center","right"] as const;
export type TableSheetAlign = (typeof TABLE_SHEET_ALIGNS)[number];
export interface TableSheetColumn { id; name; width; type; options?; align? }   // design section 2
export type TableSheetCellValue = string | number | boolean;
export interface TableSheetCell { value?; bold?; align?; fill? }
export interface TableSheetRow { id; height?; cells: Readonly<Record<string, TableSheetCell>> }
export interface TableSheetSemantic { columns; rows; headerRow?; striped? }
export const TABLE_SHEET_LIMITS: {
  maxColumns: 100; maxRows: 1000; maxCellText: 10000; maxColumnName: 200;
  maxOptions: 100; maxOptionLength: 200; minColumnWidth: 24; maxColumnWidth: 2000;
  minRowHeight: 20; maxRowHeight: 2000 };
export const TABLE_SHEET_ID_PATTERN: RegExp;               // ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$
export function isTableSheetDate(value: string): boolean;  // real YYYY-MM-DD calendar date
export function tableSheetValueMatches(column: TableSheetColumn, value: unknown): boolean;
// packages/ir/src/registry/table.ts
export const TABLE_SHEET: ElementTypeDefinition;           // type "table.sheet"
SemanticByType["table.sheet"]: TableSheetSemantic

// packages/core/src/table-sheet/index.ts, re-exported from @nodetto/core
export const TABLE_SHEET_HEADER_HEIGHT = 32, TABLE_SHEET_DEFAULT_ROW_HEIGHT = 28,
  TABLE_SHEET_DEFAULT_COLUMN_WIDTH = 120, TABLE_SHEET_CELL_PADDING_X = 8,
  TABLE_SHEET_FONT_SIZE = 12;
export function readTableSheet(semantic: unknown): TableSheetSemantic;   // defensive, never throws
export function tableSheetBounds(visual: {x?: number; y?: number}, semantic: unknown): Box;
export interface TableSheetHeaderCell { columnId; columnIndex; x; y; width; height; text; align }
export interface TableSheetCellLayout {
  rowId; columnId; rowIndex; columnIndex; x; y; width; height;
  kind: "empty" | "text" | "checkbox" | "pill";
  display: string;            // presentation only (line breaks -> spaces); never for clipboard
  align: TableSheetAlign; bold: boolean; fill?: string; checked?: boolean;
  pill?: { fill: string; text: string };
}
export interface TableSheetLayout {
  box: Box; headerHeight: number;
  columns: readonly { id; index; x; width; type; align }[];
  rows: readonly { id; index; y; height; striped: boolean }[];
  header: readonly TableSheetHeaderCell[];         // empty when headerRow === false
  cells: readonly TableSheetCellLayout[];          // row-major, every row x column
}
export function tableSheetLayout(element: Element): TableSheetLayout;  // page coordinates
export function fitCellText(text: string, maxWidth: number, fontSize: number): string;
export const TABLE_SHEET_PAINT: { stripeFill: string; checkboxSize: 14; pillHeight: 18; pillRadius: 9;
  pillPalette: readonly { fill: string; text: string }[] /* length 8 */ };
export const tableSheetShapeUtil: ShapeUtil;   // canResize false; defaultVisual {x:0,y:0}
export function defaultTableSheetSemantic(): TableSheetSemantic;  // 3x3, ids c1..c3 / r1..r3

export interface TableSheetRange { top: number; left: number; bottom: number; right: number } // inclusive indices
export type TableSheetEditResult =
  | { ok: true; semantic: TableSheetSemantic; skipped: number }
  | { ok: false; code: "table.limit" | "table.cellType" | "table.lastColumn"
      | "table.unknownRow" | "table.unknownColumn"; message: string };
// edits.ts: every function is (s: TableSheetSemantic, ...) => TableSheetEditResult
setCellValue(s, rowId, columnId, value: TableSheetCellValue | undefined)
setCellText(s, rowId, columnId, text: string)            // coerces; "" clears
setCellStyle(s, rowId, columnId, style: { bold?: boolean | null; align?: TableSheetAlign | null; fill?: string | null })
clearRange(s, range)
insertRow(s, at: number, ids: IdSource)
deleteRows(s, rowIds: readonly string[])
insertColumn(s, at: number, ids: IdSource, type?: TableSheetColumnType)  // name "Column N" (N = column count after insert), width 120, type ?? "text", id ids(), no align/options; table.limit at 100
deleteColumns(s, columnIds: readonly string[])           // refuses to remove the last column
moveColumn(s, from: number, to: number)
renameColumn(s, id, name) / retypeColumn(s, id, type) / setColumnOptions(s, id, options)
setColumnAlign(s, id, align | undefined) / resizeColumn(s, id, width) / resizeRow(s, id, height)
setHeaderRow(s, on: boolean) / setStriped(s, on: boolean)
// coerce.ts
coerceCellText(column, text: string): { value?: TableSheetCellValue; ok: boolean; newOption?: string }
clipboardCellText(column, cell: TableSheetCell | undefined): string   // from STORED value
// tsv.ts
parseTsv(text: string): string[][];  serializeTsv(grid: readonly (readonly string[])[]): string;
clipboardGrid(s, range): string[][];
pasteGrid(s, at: { row: number; column: number }, grid: readonly (readonly string[])[], ids: IdSource): TableSheetEditResult
// apply.ts: the only way app/CLI code writes a table edit (one updateSemantic, none for a no-op)
applyTableSheetEdit(editor: Editor, id: ElementId, edit: (s: TableSheetSemantic) => TableSheetEditResult): TableSheetEditResult
// grid.ts
parseCsv(text: string): string[][];   // RFC 4180, optional UTF-8 BOM
tableSheetFromGrid(grid, options: { header: boolean; types?: readonly TableSheetColumnType[];
  widths?: readonly number[] }): TableSheetEditResult       // ids c1..cN, r1..rN
```

Wave-2 exported symbols that tsh-08 consumes:

- tsh-02: `renderTableSheet(element: Element, box: Box, theme: SvgTheme): string`
  in `packages/core/src/svg-export/table-sheet.ts`.
- tsh-03: `TableSheetView(props: { element: Element }): JSX.Element` in
  `packages/ui-solid/src/shapes/TableSheetView.tsx`.
- tsh-04: in `packages/ui-solid/src/table-sheet/`:
  - `createTableSheetSelection(): TableSheetSelection` (`selection.ts`)
  - `handleTableSheetKey(event: KeyboardEvent, ctx: TableSheetKeyContext): boolean` (`keyboard.ts`)
  - `tableSheetRegionAt`, `beginTableSheetResize`, `resetColumnWidth` and `tableSheetCellClick` (`resize.ts`)
  - The exact signatures are in "Contracts to export" in `impl-plans/active/tsh-04-cell-editing.md`.
  - `TableSheetCellEditor` (`CellEditor.tsx`)
  - `TableSheetSelectionOverlay` (`SelectionOverlay.tsx`)
  - `copyTableRange`, `cutTableRange` and `pasteIntoTable` (`clipboard.ts`)
  - `TableClipboardPort { writeText(text: string): void | Promise<void>; readText(): Promise<string> }`
- tsh-05: `TableSheetSection(props: { editor: Editor; element: Element; activeRowId?: string })`.
  tsh-05 does not import tsh-04 types. tsh-08 passes `selection.state()?.active.rowId`.
- tsh-06: `tableCommand(io: CommandIo, args: readonly string[]): CommandResult`
  and `TABLE_HELP: string` (`apps/cli/src/table-command.ts`); `setCells(batch, operation, index)`.

## Rules for every worker

- Read your plan and design sections first. Do not widen scope. If a needed
  edit is outside your `writePaths`, stop and record a blocker naming the
  file and symbol in your progress log.
- Before starting, record `git hash-object` of your plan file as the
  immutable intent snapshot.
- Plans run concurrently on one branch and one working directory. Read
  each file fresh before every edit, and record pre and post
  `git hash-object` per edit. If the pre hash differs from your last post
  hash, re-read the file, keep the other change and record the drift.
  Remaining overlap is repaired serially at reconciliation.
- Edit only your own progress log. Do not edit `impl-plans/README.md`, other
  plans, or the `impl-plans/active` and `impl-plans/completed` listings.
- Run no state-changing git commands: no commit, stash, checkout, reset,
  branch or worktree.
- Run Biome only on your own files (`bunx biome check --write <files>`).
  Do not format broadly.
- Must not change: `packages/ir/src/registry/erd.ts`,
  `packages/ir/src/semantics/erd.ts`, `packages/core/src/shapes/erdTable.ts`,
  `packages/ui-solid/src/shapes/ErdTableView.tsx`,
  `packages/core/src/commands.ts`, any existing erd test, and any version
  field.
- Use only self-authored neutral test data, such as `Widget`, `Todo`,
  `alpha`, `beta` and `#ffeeaa`. No real names and no third-party files.
  No emojis.
- Shared-engine code (`packages/ir`, `packages/core`, `apps/cli/src`) runs
  in Boa:
  - No `node:*` imports outside tests.
  - No regex `split` over whole documents. Write CSV/TSV parsers as
    character scanners.
  - No time, randomness or locale (`toLocaleString`, `Intl`).
- Strict TypeScript. Guard every indexed lookup for `undefined`. Read
  record keys with `Object.hasOwn`.
- Every document change is one `editor.apply([{ type: "updateSemantic", ... }])`,
  or the existing `editor.createElement` / `updateVisual` paths. Never add a
  `Command` kind.

## Verification rules

- Write each command's full output to `tmp/tsh-s776/<planId>/final/<name>.log`
  and record its exit status and pass/fail/skip counts in the progress log.
  Before repeating a gate, move `final/` to `attempt-<n>/`. An incomplete log
  is not a passing check.
- `bun test <path>` treats a path as a substring filter. Always pass the
  explicit `./`-prefixed relative path to your own test files. Confirm that
  the log names only those files and shows at least one test.
- Each plan runs `bun run typecheck` (whole repo, read-only). On a moving
  shared tree, a failure that comes only from a sibling's unfinished file is
  recorded with the file name and rerun after that sibling finishes. Do not
  fix it yourself.
- Workspace gates belong to tsh-08 and integration review:
  `mise run lint`, `mise run test`, `mise run test-cli` (up to 3 attempts
  under load, deadlines never relaxed), `mise run build-cli`,
  `mise run build`.

## Progress logs

Each plan writes `impl-plans/progress/<planId>.md` with:

- the intent snapshot hash
- per-edit pre and post hashes
- the commands run, with exit statuses, test counts and log paths
- any drift, deviation or blocker

## Done for the whole set

- Every plan's done criteria are met.
- tsh-08 has recorded exit 0 for `bun run typecheck`, `mise run lint`,
  `mise run test`, `mise run test-cli` (attempts recorded),
  `mise run build-cli` and `mise run build`.
- `git diff --stat f59bef4 -- packages/core/src/commands.ts packages/ir/src/registry/erd.ts packages/core/src/shapes/erdTable.ts`
  is empty.
