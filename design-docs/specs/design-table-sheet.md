# Spreadsheet table element: `table.sheet`

Status: design, not implemented. Revised for the session 778 continuation
(section 14): the plan split in section 11, the core file layout in
section 4 and section 6, and the `Column N` naming rule in section 6 changed.
The behavior is otherwise the same as the reviewed 9f4414b design.

A new first-class element type, `table.sheet`. It shows and edits tabular
data the way an Excel sheet or a Notion table does. It has ordered typed
columns, ordered rows, an optional header row, optional zebra striping and
per-cell style overrides. `erd.table` models database tables. Its schema,
behavior, rendering and tests do not change.

Scope: IR registry and validation, JSONL round trip, Solid canvas view,
SVG/PNG export parity, in-place cell editing with Excel-like keys, TSV
clipboard, row and column resizing, an inspector section, a toolbox entry
that creates a 3x3 table, CLI authoring (inline data, CSV/TSV, cell edits,
lint, export) and docs.

Non-goals: formulas, sorting, filtering, merged cells, frozen panes,
multi-line cell layout, per-cell fonts other than bold, HTML/mobile code
handoff, draw.io/Mermaid/D2 export, Rust-native code changes, and new
`Command` kinds.

## 1. Baseline and integration points

These paths were checked against the repository at `f59bef4` and rechecked
at `87365fb`. No earlier table spec exists under `design-docs/specs/`. At
`87365fb`, `packages/ir/src/semantics/table.ts` already holds the full
section 2 contract (types, `TABLE_SHEET_LIMITS`, `TABLE_SHEET_ID_PATTERN`,
`isTableSheetDate`, `tableSheetValueMatches`). Nothing else in this design
exists yet.

- Element type definitions use the `ElementTypeDefinition` contract in
  `packages/ir/src/registry/definition.ts`: `type`, `category`, `keyOrder`,
  `onReferenceDeleted`, `validateSemantic` and `references`. The
  definitions are aggregated in `packages/ir/src/registry.ts` (`DEFINITIONS`).
  Payload types are mapped in `packages/ir/src/semantics.ts`
  (`SemanticByType`). `packages/ir/src/ui-controls.ts` is the precedent for a
  self-contained module that holds both the type and the definition.
- `packages/ir/src/validate.ts` warns `semantic.unknownField` for keys that
  are missing from `keyOrder`. It also recurses into objects and arrays that
  `keyOrder.children` declares.
- `packages/io/src/jsonl/canonical.ts` writes declared keys first. It then
  writes the remaining keys sorted by code unit, so record-valued maps stay
  deterministic without a declared order.
- `packages/ir/src/registry.test.ts` pins the sorted list of registered
  types. `packages/io/src/jsonl/golden.test.ts` requires every registered
  type to appear in a golden fixture under `packages/io/src/__fixtures__/`.
- Core geometry goes through `ShapeUtil` (`packages/core/src/shape-util.ts`).
  The utils are registered in `packages/core/src/shapes/index.ts`.
  `packages/core/src/shapes/erdTable.ts` already derives its height from the
  semantic payload, and this design follows the same pattern.
- SVG export dispatches per type in `renderShape`
  (`packages/core/src/svg-export/shapes.ts`). PNG and PDF rasterize that SVG
  (`apps/cli/src/export-command.ts`, `packages/ui-solid/src/raster-export.ts`),
  so SVG parity also gives PNG parity.
- The canvas view dispatches in `packages/ui-solid/src/shapes/ShapeView.tsx`.
  Double-click goes to `onEditRequest(id, region)` in
  `packages/ui-solid/src/interaction/pointer.ts`. Canvas keys are handled in
  `packages/ui-solid/src/interaction/keyboard.ts`, which skips events whose
  target `isEditableTarget` reports as editable.
- The `Command` union is in `packages/core/src/commands.ts`. The kinds used
  here are `createElement`, `updateSemantic` and `updateVisual`. **No
  `updateElement` kind exists.** The intake's "updateElement" maps to
  `updateSemantic` for payload edits and `updateVisual` for moves. Undo
  coalescing uses `History.beginBatch`/`endBatch`
  (`packages/core/src/history.ts`).
- Collab (`packages/collab/src/diff.ts`) reconciles arrays of id-carrying
  items by id and writes object keys individually. Rows and columns are
  id-carrying arrays. Cells are a record keyed by column id. So two people
  who edit different cells or rename different columns commute.
- Appearance invariant (`design-docs/specs/design-appearance.md`, section 2):
  document element paint must be the same in every app theme. Exports take
  no appearance input. "Renders in light and dark themes" therefore means
  the table paints identically and stays legible with the light and the dark
  canvas background.
- Toolbox: `Tool` and creation are in `packages/core/src/tools.ts`, the
  palette is in `packages/ui-solid/src/shape-palette.ts`, and the shape IDs
  for `draw` and `shapes` are in `packages/core/src/shape-catalogue.ts`.
  `Tool.Table` already means `erd.table` and keeps that meaning.
- CLI: `edit` applies JSON operations through `runOperations`
  (`apps/cli/src/edit-command.ts`), which writes atomically and retries on
  contention. Ops dispatch in `apps/cli/src/edit/batch.ts`. The generic `add`
  op (`apps/cli/src/edit/operations/add.ts`) already creates any registered
  type from an inline `semantic`.
- The native CLI (`apps/cli/native`) embeds the shared TypeScript bundle in
  Boa, so it needs no Rust change. `mise run test-cli` runs the native
  binary against `apps/cli/src` tests.

## 2. Semantic model

New file `packages/ir/src/semantics/table.ts`. Types and limits:

```ts
export const TABLE_SHEET_COLUMN_TYPES = ["text", "number", "checkbox", "select", "date"] as const;
export const TABLE_SHEET_ALIGNS = ["left", "center", "right"] as const;

export interface TableSheetColumn {
  readonly id: string;            // stable, unique among columns
  readonly name: string;          // header text; may be ""
  readonly width: number;         // integer px
  readonly type: TableSheetColumnType;
  readonly options?: readonly string[]; // select only, unique, non-empty
  readonly align?: TableSheetAlign;     // default: right for number, center for checkbox, else left
}
export type TableSheetCellValue = string | number | boolean;
export interface TableSheetCell {
  readonly value?: TableSheetCellValue;
  readonly bold?: boolean;
  readonly align?: TableSheetAlign;
  readonly fill?: string;         // #rgb | #rrggbb | #rrggbbaa
}
export interface TableSheetRow {
  readonly id: string;            // stable, unique among rows
  readonly height?: number;       // integer px; omitted = TABLE_SHEET_DEFAULT_ROW_HEIGHT
  readonly cells: Readonly<Record<string, TableSheetCell>>; // keyed by column id; may be {}
}
export interface TableSheetSemantic {
  readonly columns: readonly TableSheetColumn[];
  readonly rows: readonly TableSheetRow[];
  readonly headerRow?: boolean;   // omitted = true
  readonly striped?: boolean;     // omitted = false
}
```

Rules that keep the model deterministic:

- An empty cell is an absent key. A cell object must contain at least one
  key. Editing helpers delete a cell that has no value and no style.
- `headerRow` is written only as `false`, and `striped` only as `true`.
  Defaults are omitted, the same as `withOptionalFlag` in
  `packages/ui-solid/src/inspector/edits.ts`.
- `bold: false`, an `align` equal to the column default, and an empty `fill`
  are dropped by the editing helpers. Validation still accepts them.
- Value per column type:
  - `text`: string, may contain any characters.
  - `number`: finite JSON number.
  - `checkbox`: boolean.
  - `select`: string equal to one of the column's `options`.
  - `date`: string `YYYY-MM-DD` that names a real calendar date (ISO 8601
    calendar date, no time or zone).
- Id grammar for rows and columns: `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`. This
  rules out `__proto__`, so record keys are safe. Readers must still use
  `Object.hasOwn`. The app generates ids with the core ULID source
  (`packages/core/src/ids.ts`), which is collision-safe across collab peers.
  CLI imports use deterministic `c1..cN` / `r1..rN`.

Key order (`TABLE_SHEET` definition `keyOrder`):

```
keys: ["columns", "rows", "headerRow", "striped"]
children:
  columns: { keys: ["id", "name", "type", "width", "align", "options"] }
  rows:    { keys: ["id", "height", "cells"] }
```

`cells` deliberately has no `children` entry. Its keys are column ids, so
declaring it would raise `semantic.unknownField` warnings for every cell.
The canonical writer sorts cell keys and cell fields by code unit, so the
output stays deterministic. Semantic sizes are not declared as
`coordinates`. They are validated as integers instead of being rounded.

Category `node`, `onReferenceDeleted: "detach"`, `references: noReferences`.

## 3. Validation

Implemented in `packages/ir/src/registry/table.ts` (`TABLE_SHEET`). The
validator uses the existing `checkObject/checkArray/checkString/
checkNumber/checkBoolean/checkEnum` helpers and their generic codes
(`type.*`, `field.missing`, `value.min`, `value.max`). It adds these
table-specific codes, all with severity `error`:

| Code | Raised when |
|---|---|
| `id.duplicate` | Two columns, or two rows, share an id. Reuses the existing code. |
| `table.id` | A row or column id breaks the id grammar. |
| `table.noColumns` | `columns` is empty. |
| `table.limit` | Over a size limit: columns, rows, text length, name length, option count or option length. The message names the limit. |
| `table.size` | `width` or `height` is not an integer inside its range. |
| `table.unknownColumn` | A key in `cells` is not a column id. |
| `table.cellEmpty` | A cell object has no keys. |
| `table.cellType` | `value` does not match the column type. This includes a select value missing from `options` and an invalid date. |
| `table.options` | `options` on a non-select column, or a duplicate or empty option. |
| `table.cellFill` | `fill` is not a hex color. |

Limits are exported as constants from `semantics/table.ts` and documented in
`docs/editing.md`:

| Limit | Value |
|---|---|
| Columns | 1 to 100 |
| Rows | 0 to 1000 |
| Cell text (`string` value) | 10000 UTF-16 code units |
| Column name | 200 |
| Select options per column | 100, each 1 to 200 |
| Column width | integer 24 to 2000 |
| Row height | integer 20 to 2000 |

Valid tables round-trip through `parseDocument`/`serializeDocument`
unchanged. A golden fixture `packages/io/src/__fixtures__/table-sheet.jsonl`
covers every column type, cell styles, `headerRow: false`, `striped: true`,
a custom row height and an empty row. Its file name is added to `GOLDEN`.

## 4. Geometry and layout (shared by canvas and export)

New directory `packages/core/src/table-sheet/`, exported through
`packages/core/src/table-sheet/index.ts`. Constants:
`TABLE_SHEET_HEADER_HEIGHT = 32`, `TABLE_SHEET_DEFAULT_ROW_HEIGHT = 28`,
`TABLE_SHEET_CELL_PADDING_X = 8` and `TABLE_SHEET_FONT_SIZE = 12` live in
`layout.ts`. `TABLE_SHEET_DEFAULT_COLUMN_WIDTH = 120` lives in `columns.ts`
next to the `Column N` rule (section 6), because only column creation uses
it.

Core module files (each file has one owning plan; section 11):

| File | Exports |
|---|---|
| `layout.ts` | size constants above, `readTableSheet`, `tableSheetBounds`, `tableSheetLayout`, `fitCellText`, layout types |
| `paint.ts` | `TABLE_SHEET_PAINT` |
| `shape.ts` | `tableSheetShapeUtil`, `defaultTableSheetSemantic` |
| `types.ts` | `TableSheetRange`, `TableSheetEditCode`, `TableSheetEditResult` (types only) |
| `edits.ts` | style and structure edits that need no value coercion |
| `apply.ts` | `applyTableSheetEdit` |
| `delimited.ts` | `parseTsv`, `serializeTsv`, `parseCsv` (pure text codecs) |
| `coerce.ts` | `coerceCellText`, `clipboardCellText` and the value edits `setCellValue`, `setCellText`, `clearRange`, `retypeColumn` |
| `columns.ts` | `TABLE_SHEET_DEFAULT_COLUMN_WIDTH`, `nextTableSheetColumnName`, `insertColumn` |
| `grid.ts` | `clipboardGrid`, `pasteGrid`, `tableSheetFromGrid` |
| `index.ts` | `export *` from each file above |

The split follows what each file needs at runtime. Everything that needs
value coercion or the `Column N` rule is in `coerce.ts`, `columns.ts` and
`grid.ts`. The other files never import those.

- Bounds: `x`/`y` come from `visual`. `width = Σ column.width`. `height =
  (headerRow ? 32 : 0) + Σ (row.height ?? 28)`. One exception keeps an empty
  table a hit target: with zero rows and `headerRow: false`, the height is
  one default row (28). Stored `visual.width`/`visual.height` are ignored
  and never written by table edits.
- `ShapeUtil` (`table-sheet/shape.ts`, `tableSheetShapeUtil`):
  `canResize: false`, because size follows the data and changes only through
  column and row resizes. `getBounds` and `hitTest` use the bounds above.
  Ports default to edge midpoints. `defaultSemantic()` returns the 3x3 table
  in section 9. `defaultVisual()` is `{x: 0, y: 0}`.
- `tableSheetLayout(element)` returns a pure layout: column `x`/`width`,
  the header box, row `y`/`height`, and one entry per visible cell. Each
  entry has the column type, resolved alignment, bold, fill, stripe flag,
  a display string and a render kind (`text`, `checkbox`, `pill`). The
  display string is `String(number)` with no locale, the ISO date as stored,
  or the select option. Line breaks in text show as spaces. The display
  string is presentation only. The clipboard, the cell editor's initial
  value, retype coercion and CLI output never read it. They read the stored
  value (section 6). Both the canvas
  view and the SVG exporter read only this layout for geometry. That single
  source is the parity guarantee.
- Ellipsis: the canvas uses CSS `text-overflow: ellipsis` with real font
  metrics. The SVG uses `fitCellText(text, maxWidth)`, which truncates by
  grapheme with `estimatedTextWidth`/`wideAwareTextWidth`
  (`packages/core/src/text-layout.ts`) and appends "…". It also clips each
  cell with a `clipPath`. Glyph-exact text equality between canvas and
  export is not a goal. Geometry, colors and typed-cell glyphs must match.

## 5. Rendering

The same paint applies on the canvas and in export. Paint constants live in
`table-sheet/paint.ts`. Theme colors come from the document tokens
`--nodetto-*` on the canvas and from the matching `SvgTheme` fields in
export.

- Outer border: `visual.style.stroke` (default ink), width 1.5. Body
  background: `visual.style.fill` (default surface). `opacity` is honored.
  Other style keys are ignored.
- Header row (when `headerRow !== false`): accent-soft fill, bold column
  names, a bottom rule in ink. Header cells use the column alignment.
- Gridlines: 1px in the `line` token between every column and every row.
- Striping (`striped: true`): odd body rows (0-based index 1, 3, ...) get the
  constant `TABLE_SHEET_STRIPE_FILL`, a fixed translucent ink. A cell `fill`
  paints over the stripe.
- Text cells: single line, vertically centered, padding 8, ellipsis.
- Number cells: right-aligned by default.
- Checkbox cells: a 14px rounded square, centered by default. When `true`,
  it has an accent fill and a white check mark. When `false` or absent, it
  has an ink outline only.
- Select cells: a Notion-like pill. It is a rounded rect, height 18, radius
  9, with the option text inside. The color comes from a fixed 8-color
  palette indexed by `options.indexOf(value) % 8`, so colors are stable and
  need no stored color.
- Date cells: display string `YYYY-MM-DD`, left-aligned.
- Per-cell `bold`, `align` and `fill` override the defaults.

Canvas: `packages/ui-solid/src/shapes/TableSheetView.tsx` with
`TableSheetView.css`. Elements are absolutely positioned from
`tableSheetLayout`, never laid out by CSS grid, so pixel geometry equals the
core bounds. The view shows the active cell and range highlight from the
interaction state (section 6) as an overlay. That highlight is never
exported.

Export: `packages/core/src/svg-export/table-sheet.ts` (`renderTableSheet(element,
box, theme)`) emits groups with stable class names: `nodetto-table-sheet`,
`-header`, `-grid`, `-cell`, `-checkbox`, `-pill`. Tests can then assert the
structure. Wiring adds a `case "table.sheet"` to `renderShape`.

## 6. Editing

All edits are pure functions in `packages/core/src/table-sheet/`. Each one
takes a `TableSheetSemantic` and returns a `TableSheetEditResult`: a new
semantic, or a typed error for a limit or type violation. The app applies
the result through `applyTableSheetEdit` as one `updateSemantic` command.
That is one `apply`, so it is one undo entry, and it uses the normal
validation and collab path. The CLI applies it through its existing
operation path. No new `Command` kind is added. When an edit changes
nothing, it returns the input object itself (`result.semantic === s`), and
`applyTableSheetEdit` applies nothing, so there is no empty undo entry.

Edit functions, by file:

- `edits.ts` (no coercion): `setCellStyle`, `insertRow(at, ids)`,
  `deleteRows(ids)`, `deleteColumns(ids)` (refuses the last column with
  `table.lastColumn`), `moveColumn`, `renameColumn`, `setColumnOptions`
  (clears select values that are no longer options and counts them in
  `skipped`), `setColumnAlign`, `resizeColumn(id, width)`,
  `resizeRow(id, height)`, `setHeaderRow`, `setStriped`.
- `coerce.ts` (value writes): `setCellValue(rowId, columnId, value |
  undefined)`, `setCellText(rowId, columnId, text)`, `clearRange(range)`,
  `retypeColumn(id, type)`.
- `columns.ts`: `insertColumn(at, ids, type?)`.
- `grid.ts`: `pasteGrid(at, grid, ids)`, `tableSheetFromGrid(grid,
  options)`.

Ids are passed in through an `IdSource` parameter. Sizes are rounded to
integers and clamped to the limits.

`Column N` naming rule (`columns.ts`, binding for every code path that
creates a column without a given name):

- A column name uses N when it equals exactly `"Column " + N`, where N is a
  positive decimal integer with no leading zero (`^Column [1-9][0-9]*$`,
  case-sensitive, one space).
- `nextTableSheetColumnName(columns)` returns `Column N` for the smallest
  positive N that no column name uses.
- `insertColumn(s, at, ids, type?)` creates `{ id: ids(), name:
  nextTableSheetColumnName(s.columns), type: type ?? "text", width: 120 }`.
  It sets no `align` or `options` key, even for `select`, and adds no
  cells. `at` is clamped to `0..columns.length`. At 100 columns it returns
  `table.limit` and the input is unchanged.
- `pasteGrid` appends the columns it needs left to right. Each one is a
  `text` column of width 120 named by the same rule, with the columns
  already appended in the same paste counted as used.
- `tableSheetFromGrid` with `header: false` names every column by the rule,
  which gives `Column 1..N`. With `header: true`, header fields are used as
  names verbatim (an empty field gives `""`). Columns past the end of the
  header record are named by the rule.
- Examples: the default 3x3 (`Name`, `Status`, `Done`) gives `Column 1`.
  `[Column 1, Column 3]` gives `Column 2`. `[Column 2]` gives `Column 1`.
  `Column 01` and `column 1` do not use 1.

Value coercion (`table-sheet/coerce.ts`) is shared by typing, paste,
retype and the CLI:

- `number`: trimmed text matching `^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$`
  becomes a number.
- `checkbox`: `true/false/1/0/yes/no/x` (case-insensitive) become booleans.
- `date`: a valid `YYYY-MM-DD`.
- `select`: exact option match. Paste and the CLI append unknown non-empty
  values as new options, up to the option limit.
- `text`: any string.
- Empty input clears the value. Input that cannot be coerced leaves the cell
  empty and is counted in the result's `skipped`.
- `retypeColumn` runs coercion over the existing values. Retyping to
  `select` seeds `options` with the distinct existing display strings in row
  order, capped at the limit. Retyping away from `select` drops `options`.

Interaction lives in new ui-solid modules under
`packages/ui-solid/src/table-sheet/`, in three independent groups:

- Navigation and editing: `selection.ts` (state and
  `tableSheetCellClick`), `keyboard.ts`, `cell-commit.ts`, `CellEditor.tsx`,
  `SelectionOverlay.tsx` and `TableSheet.css`. The active-cell and range
  highlight is this group's overlay component, not part of
  `TableSheetView`.
- Clipboard: `clipboard.ts`. Its functions take an explicit target
  (`{ elementId, range }` for copy and cut, `{ elementId, row, column }`
  indices for paste) and a `TableClipboardPort`. They never import the
  selection module. Paste returns the result and the pasted range.
  `handleTableSheetKey` does not handle Cmd/Ctrl+C/X/V. Wiring routes those
  keys to the clipboard while a cell is active, converts the selection into
  the target, and selects the pasted range afterwards.
- Resize: `resize.ts` (`tableSheetRegionAt`, `beginTableSheetResize`,
  `resetColumnWidth`). It reads only the core layout and edits.

- State: `{ elementId, active: {row, col}, anchor?: {row, col}, editing:
  boolean }`. It is per canvas, UI-only and never stored in the document.
  It is cleared when the element is deselected or deleted, or when its
  row or column ids disappear.
- Mouse: the first click selects the element (unchanged). A click on a
  cell of the already selected table sets the active cell. Shift-click
  extends the range. Double-click on a cell opens the cell editor through
  the existing `onEditRequest` path. Wiring intercepts a `table.sheet` target
  inside `Canvas.tsx` (line 139, before `props.onEditRequest`) and opens the
  cell editor there. Hosts such as apps/desktop and nodetto-cloud need no
  change and never see table edit requests. A checkbox cell toggles on a
  single click when it is already active.
- Cell editor: a single-line `<input>` placed over the cell from the layout
  and the camera transform. For select columns it uses a `<select>`, for
  date an `<input type="date">`. The editor is an editable target, so canvas
  shortcuts stay inactive while it is open. Keys while editing: Enter
  commits and moves down, Tab and Shift+Tab commit and move right and left,
  and Escape cancels. Moving past the last column wraps to the next row.
  Enter on the last row commits without growing. Blur commits.
- Keys while a cell is active and not editing, handled before the canvas
  shortcuts in `keyboard.ts`: arrow keys move the active cell, and Shift+arrow
  extends the range. Enter and F2 start editing. A printable key starts
  editing and replaces the content. Delete and Backspace clear the range in
  one edit. Escape clears the cell selection and keeps the element selected.
  Tab and Shift+Tab move. Canvas arrow-key nudges and element deletion do not
  fire while a cell is active.
- Clipboard (`delimited.ts` and `grid.ts` in core, `clipboard.ts` in
  ui-solid):
  - Copy and Cut on an active range write TSV with
    `serializeTsv(clipboardGrid(semantic, range))`. `clipboardGrid` reads
    stored cell values directly. It never uses the layout display string,
    and no line-break normalization, clipping or ellipsis applies:
    - `text`: the stored string, exactly, including tabs, `\n`, `\r\n` and
      quotes.
    - `number`: `String(value)`.
    - `checkbox`: `TRUE`/`FALSE`.
    - `select`: the option string.
    - `date`: the stored `YYYY-MM-DD`.
    - An empty cell: an empty field.

    A field that contains a tab, `\r`, `\n` or a quote is wrapped in quotes
    with inner quotes doubled, the same as Excel. Rows are joined with `\n`.
    `parseTsv(serializeTsv(grid))` must equal `grid` exactly. Cut writes the
    clipboard first and then clears the range with one `clearRange` →
    `updateSemantic`, so Cut is one undo step.
  - Paste reads `text/plain`. The parser accepts `\r\n` or `\n`, quoted
    fields and a single trailing newline. The grid is written from the
    active cell. Rows are appended past the last row, and `text` columns
    (width 120, named by the `Column N` rule above) are appended past the
    last column. Values
    are coerced per target column. The whole paste is one `updateSemantic`.
    If the result would exceed a limit, nothing changes.
  - With no active cell, the existing element copy and paste are unchanged.
- Resize (`resize.ts`): while the table is selected, a 4-screen-px band on
  each internal and right column border, and on each row bottom border,
  shows a resize cursor. Columns win where the two bands cross. A drag runs
  inside `beginBatch`/`endBatch`, applying `resizeColumn`/`resizeRow` on each
  move, so the drag is one undo step. Double-clicking a column border resets
  the width to 120.
- Moving the whole table still uses the existing selection drag
  (`updateVisual` x/y).

## 7. Inspector

`packages/ui-solid/src/inspector/TableSheetSection.tsx` has these controls:

- Header row switch and striped switch.
- A column list. Each row has the name, a type selector, the width (via
  `NumberInput`), alignment, select options (one per line) and a delete
  button. A "Move up/down" control uses `moveItem`.
- "Add row", "Add column" and "Delete row" buttons. "Delete row" acts on the
  active row when there is one, otherwise the last row.

Each control commit calls one core edit function and one `updateSemantic`.
Wiring adds the `Match` in `Inspector.tsx` and the type label "Table
(sheet)".

## 8. CLI

- Inline data uses the existing `edit` `add` op:
  `{"op":"add","type":"table.sheet","semantic":{...}}`. Given fields are
  merged over the 3x3 defaults, and `columns`/`rows` lists replace the
  defaults.
- New `edit` op `set-cells` (`apps/cli/src/edit/operations/table.ts`):
  `{"op":"set-cells","id":"<table id>","cells":[{"row":"<id>|<0-based
  index>","column":"<id>|<index>|<name>","value":<json>|null,"bold"?,
  "align"?,"fill"?}]}`. Values are coerced with `coerce.ts`. `null` clears
  the value. An unknown row or column, or a value that cannot be coerced,
  fails the op with its index, and the batch stays all-or-nothing.
- New command `nodetto-cli table` (`apps/cli/src/table-command.ts`):
  - `table create <doc.jsonl> (--csv <file> | --tsv <file> | --data <json>)
    [--page <id|name>] [--id <id>] [--x <n> --y <n>] [--no-header]
    [--types t1,t2,...] [--widths w1,w2,...]`. The first record holds the
    column names unless `--no-header` is given, in which case the names are
    `Column 1..N` (the `Column N` rule in section 6). Types default to `text`. `--data` takes a JSON array of row
    arrays. The command builds the semantic with `tableSheetFromGrid` in
    core and runs one `add` op through `runOperations`, so it gets atomic
    write, retry and the output format. CSV follows RFC 4180: quoted fields,
    doubled quotes, embedded newlines, and an optional UTF-8 BOM. Ragged rows
    are padded. A row longer than the header adds columns. Files are read
    only through `CommandIo`.
  - `table set <doc.jsonl> <table-id> --cell <row>:<col> --value <text>`
    (repeatable). It is sugar for one `set-cells` op.
- `lint` and `validate` report the table issue codes through the existing
  validation path, with no new lint rule. `export` (SVG/PNG/PDF) renders
  through `renderShape`. `types table.sheet` lists the fields and an example
  add op. `shapes`/`draw` get the catalogue shape id `table.sheet`
  (catalogue ids are `ToolKind` values, the same as `erd.table`).
- Help text in `help.ts` and docs in `docs/cli.md`.

## 9. Toolbox

A new `Tool.Sheet = "table.sheet"` (label "Sheet", icon `table`) sits in the
General palette group. `Tool.Table` stays as `erd.table`. Creation places the
default 3x3 table: columns `Name` (text, 160), `Status` (select, options
`Todo/Doing/Done`, 120) and `Done` (checkbox, 80), plus 3 empty rows. The
bounds are 360 x 116. `defaultTableSheetSemantic()` uses the fixed ids
`c1..c3` and `r1..r3`. Ids only need to be unique within one table, and
`Tool` creation takes the util's static defaults. Rows and columns added
later in the app get `newElementId` (ULID) ids. The catalogue shape id is
`table.sheet`.

## 10. Collaboration and repository boundary

- Only `createElement`, `updateSemantic` and `updateVisual` are emitted. The
  private nodetto-cloud Worker's exhaustive `authoring-discovery.ts` over
  `Command` kinds is therefore unaffected. The integration review should
  confirm that `packages/core/src/commands.ts` has no diff.
- Collab merges at cell granularity (section 1). Concurrent paste or resize
  on the same cell is last writer wins, the same as any field.
- No server code, auth, secrets, deployment config, version bump or release.

## 11. Module ownership and plan split

Session 776 used one wave-1 plan (`tsh-01-model`, 354 plan lines, about 25
files). Its worker stopped after two files, so this split replaces
`tsh-01-model` and `tsh-04-cell-editing`. There are two waves before
wiring. Each file has exactly one owner, and every plan is sized for one
worker: about 150 plan lines or fewer and at most four source files plus
their tests. Exact exported names and signatures are pinned in
`impl-plans/active/tsh-00-overview.md`. The plans implement them verbatim.

Wave 1. These four plans depend only on code committed at `87365fb`: the
section 2 IR contract and existing core modules such as `ShapeUtil`,
`Editor`, `IdSource` and `text-layout.ts`.

| Plan | Owns (new unless noted) |
|---|---|
| tsh-01a-ir | `packages/ir/src/registry/table.ts`; `packages/ir/src/registry/table.test.ts` (extend the 87365fb file); IR-internal registration (edit): `packages/ir/src/semantics.ts`, `registry.ts`, `index.ts`, `registry.test.ts`; `packages/io/src/__fixtures__/table-sheet.jsonl`, the `GOLDEN` entry in `packages/io/src/jsonl/golden.test.ts`, `packages/io/src/jsonl/table-sheet.test.ts`; the core barrel `packages/core/src/table-sheet/index.ts` and the single line `export * from "./table-sheet/index.ts";` in `packages/core/src/index.ts`. `packages/ir/src/semantics/table.ts` already meets the contract and may change only to fix a defect a test exposes. |
| tsh-01b-layout | `packages/core/src/table-sheet/layout.ts`, `paint.ts`, `shape.ts`, `layout.test.ts`, `shape.test.ts` |
| tsh-01c-edits | `packages/core/src/table-sheet/types.ts`, `edits.ts`, `apply.ts`, `delimited.ts`, `edits.test.ts`, `apply.test.ts`, `delimited.test.ts` |
| tsh-01d-values | `packages/core/src/table-sheet/coerce.ts`, `columns.ts`, `grid.ts`, `coerce.test.ts`, `columns.test.ts`, `grid.test.ts` |

Rules that keep wave 1 independent:

- No wave-1 file imports, at runtime, a file owned by another wave-1 plan.
  The only cross-plan reference is `import type` of `types.ts` from
  tsh-01d-values. Its full content (three type declarations) is pinned
  verbatim in tsh-00. Type-only imports are erased at runtime, so the
  tests of every plan run whether or not a sibling has finished.
- Each plan keeps its own small private cell-write helper. For example,
  `edits.ts` and `coerce.ts` each drop a cell left with no keys. The
  helpers are not shared, so there is no runtime edge.
- Wave-1 tests import modules by relative path (`./layout.ts`) and never
  through `./index.ts`, `../index.ts` or `@nodetto/core`. The barrel
  `index.ts` and its core line from tsh-01a-ir do not resolve until all
  four plans have landed. Tests that avoid the barrel are unaffected.
  tsh-01a-ir's own tests are IR and io tests. `@nodetto/io` depends only on
  `@nodetto/ir`, so they never load core.
- `bun run typecheck` and the directory run
  `bun test ./packages/core/src/table-sheet/` are wave-1 exit gates. They
  run once all four wave-1 plans have reported, before wave 2 starts. They
  are not per-plan verification commands.

Wave 2. Each plan depends only on wave 1, through `@nodetto/ir` and
`@nodetto/core`.

| Plan | Depends on | Owns (new unless noted) |
|---|---|---|
| tsh-02-export | 01a, 01b | `packages/core/src/svg-export/table-sheet.ts` + `table-sheet.test.ts` |
| tsh-03-view | 01a, 01b | `packages/ui-solid/src/shapes/TableSheetView.tsx`, `TableSheetView.css`, `table-sheet-view.test.ts` |
| tsh-04a-navigation | 01a-01d | `packages/ui-solid/src/table-sheet/selection.ts`, `keyboard.ts`, `cell-commit.ts`, `CellEditor.tsx`, `SelectionOverlay.tsx`, `TableSheet.css` + `selection.test.ts`, `keyboard.test.ts`, `cell-commit.test.ts` |
| tsh-04b-clipboard | 01a, 01c, 01d | `packages/ui-solid/src/table-sheet/clipboard.ts` + `clipboard.test.ts` |
| tsh-04c-resize | 01a, 01b, 01c | `packages/ui-solid/src/table-sheet/resize.ts` + `resize.test.ts` |
| tsh-05-inspector | 01a-01d | `packages/ui-solid/src/inspector/TableSheetSection.tsx` + `table-sheet-section.test.ts` |
| tsh-06-cli | 01a, 01c, 01d | `apps/cli/src/table-command.ts`, `apps/cli/src/edit/operations/table.ts`, CLI-internal op dispatch `apps/cli/src/edit/batch.ts`, `edit/operation-fields.ts`, `edit/operation-fields.test.ts` (edit) + `table-command.test.ts`, `edit/operations/table.test.ts`. It exports `TABLE_HELP`. |
| tsh-07-docs | 01a | `docs/editing.md` (table section and limits), `docs/cli.md`, `docs/import-export.md` (SVG/PNG note) |

The three tsh-04 plans do not import each other. `tableSheetCellClick`
belongs to tsh-04a. `handleTableSheetKey` leaves Cmd/Ctrl+C/X/V to wiring
(section 6).

Wave 3, tsh-08-wiring (depends on every wave-2 plan) has exclusive
ownership of:

- core: `packages/core/src/shapes/index.ts`, `svg-export/shapes.ts`,
  `tools.ts`, `shape-catalogue.ts`
- ui-solid: `packages/ui-solid/src/shapes/ShapeView.tsx`, the `Canvas.tsx`,
  `interaction/pointer.ts` and `interaction/keyboard.ts` hooks (including
  clipboard key routing, overlay and editor mounting, and selection
  reconcile), `Inspector.tsx`, `shape-palette.ts`
- CLI: `apps/cli/src/commands.ts`, `help.ts`, `types-command.ts`,
  `cli-wiring.test.ts`
- `README.md`, and this spec's status line, set to implemented
- the end-to-end tests: SVG export through `renderShape`, and CLI
  create, lint and export

Intentional divergence from the intake's "wiring owns registry index and
core index.ts". tsh-01a-ir owns IR-internal registration, the core
`table-sheet/index.ts` barrel and one barrel line in core `index.ts`. The
reasons:

1. The packages export only `"."`, so wave-2 plans in ui-solid and the CLI
   cannot import wave-1 code until it is re-exported.
2. `registry.test.ts` and the golden coverage test fail unless registration,
   the type list and the fixture land together.

Every cross-package dispatch and registration file is still owned only by
tsh-08.

Every plan sets `artifactRoots: ["target"]`. writePaths include the tests
beside each owned module, the plan's progress log and evidence directory,
and any private helper or constant file the plan creates inside its own
directory.

## 12. Verification

Per-plan verification commands must each exit 0 and run at least one test.
They name only `./`-prefixed test files that the same plan creates or that
already exist. A directory argument is allowed only for a directory where
every test file belongs to that plan. `packages/core/src/table-sheet/` and
`packages/ui-solid/src/table-sheet/` are shared by several plans, so plans
list their own files explicitly. No plan lists an informational,
expected-to-fail or binary-less command, for example
`env -u NODETTO_CLI_TEST_BINARY ...`. Examples:

- tsh-01a-ir: `bun test ./packages/ir/src/registry/table.test.ts
  ./packages/ir/src/registry.test.ts ./packages/ir/src/registry/erd.test.ts`
  and `bun test ./packages/io/src/jsonl/table-sheet.test.ts
  ./packages/io/src/jsonl/golden.test.ts`
- tsh-01b-layout: `bun test ./packages/core/src/table-sheet/layout.test.ts
  ./packages/core/src/table-sheet/shape.test.ts`
- tsh-01c-edits: `bun test ./packages/core/src/table-sheet/edits.test.ts
  ./packages/core/src/table-sheet/apply.test.ts
  ./packages/core/src/table-sheet/delimited.test.ts`
- tsh-01d-values: `bun test ./packages/core/src/table-sheet/coerce.test.ts
  ./packages/core/src/table-sheet/columns.test.ts
  ./packages/core/src/table-sheet/grid.test.ts`

Each plan also runs `bunx biome check` on its own files. Repo-wide
`bun run typecheck` is a wave exit gate (section 11). A failure there that
comes only from a sibling's unfinished file is recorded and rerun. The
worker does not fix it.

Wave and final gates:

- after wave 1: `bun run typecheck` and `bun test
  ./packages/core/src/table-sheet/`
- after wave 2: `bun run typecheck`
- tsh-08 and integration review: `bun test packages/ir packages/io
  packages/core` (includes the existing `erd.table` tests, which must be
  unchanged), `bun run typecheck`, `mise run lint`, `mise run test`,
  `mise run test-cli` (up to 3 attempts under load, without relaxing
  deadlines), `mise run build-cli` and `mise run build`

Required test assertions:

- Validation: each issue code in section 3 has a failing case. Each limit is
  tested at the boundary and at the boundary plus one.
- Bounds: the bounds equal the sum of column widths and row heights,
  including the `headerRow: false` case and the empty case.
- Edits: each edit is one `updateSemantic`, and one undo restores the prior
  payload. A resize drag gives one history entry.
- TSV: parse and serialize round-trip, including quoted tabs and newlines.
  Paste growth and the over-limit rejection are tested.
- `Column N`: `columns.test.ts` covers every example in section 6, plus
  `insertColumn` at the 100-column limit. `grid.test.ts` covers a
  multi-column paste growth (`Column 1`, `Column 2` appended to the default
  3x3) and `tableSheetFromGrid` with `header: false` and with a record
  longer than the header.
- Clipboard preservation, core `packages/core/src/table-sheet/grid.test.ts`
  and `delimited.test.ts`, plus ui-solid `packages/ui-solid/src/table-sheet/clipboard.test.ts`, using
  self-authored values:
  - A text range holding `"alpha\nbeta"`, `"tab\there"`, `say "hi"` and
    `"line1\r\nline2"` goes through Copy then Paste into another range. The
    pasted stored values must equal the originals exactly, not the
    space-normalized display string.
  - The same values go through Cut then Paste and are restored exactly.
    Cut produces exactly one history entry, and one undo restores the cut
    range.
  - Typed values serialize as `String(number)`, `TRUE`/`FALSE`, the option
    text and `YYYY-MM-DD`, and paste back into same-typed columns
    unchanged.
  - The canvas and SVG still show `"alpha beta"` for the multiline cell.
- SVG: a header `<text>` per column, gridlines, a stripe rect, a checkbox
  check path, a pill rect with option text, a right-aligned number
  (`text-anchor="end"`), and cell geometry equal to `tableSheetLayout`.
- CLI: CSV and TSV create, `--data` create, `set-cells`, lint reporting
  `table.cellType`, and SVG export containing `nodetto-table-sheet`.
- `git diff --stat` shows no change to `packages/core/src/commands.ts`,
  `packages/ir/src/registry/erd.ts` or `packages/core/src/shapes/erdTable.ts`.

## 13. Decided defaults

These were open in the intake. They are recorded in
`design-docs/user-qa/table-sheet.md`.

- Dates are ISO `YYYY-MM-DD` only.
- Numbers display as `String(value)`, with no locale grouping.
- Select pill colors come from the option index into a fixed palette, so no
  color is stored.
- The cell editor is single-line. Newlines can enter text cells only
  through paste or the CLI.

## 14. Continuation (session 778)

- Baseline reused without redesign: sections 2, 3, 5, 7, 8, 10 and 13, the
  owner defaults in `design-docs/user-qa/table-sheet.md` and the plans
  `tsh-02`, `tsh-03` and `tsh-05` to `tsh-08` from `9f4414b`.
- Session 776 blocked because one worker owned all of wave 1 and stopped
  after two files, so `bun test ./packages/core/src/table-sheet/` ran zero
  tests. Section 11 splits that work into four wave-1 plans and splits
  `tsh-04` into three wave-2 plans. Plans `tsh-01-model` and
  `tsh-04-cell-editing` are superseded. `impl-plans/progress/tsh-01-model.md`
  stays as history.
- Partial work at `87365fb`: `packages/ir/src/semantics/table.ts` is
  complete for section 2. `packages/ir/src/registry/table.test.ts` holds
  primitive tests, and tsh-01a-ir extends it with the validation cases.
- The `Column N` rule (section 6) replaces the 776 rule "N = column count
  after insert". The 776 test expectation `Column 4` for the default 3x3
  becomes `Column 1`.
- Edit result codes (`table.limit`, `table.cellType`, `table.lastColumn`,
  `table.unknownRow`, `table.unknownColumn`) are return values of the core
  edit functions. They are not new validation codes.
- Evidence root for this run: `tmp/tsh-s780/<planId>/` (renamed from
  `tmp/tsh-s778` in session 780 so it matches the active taskId).

## 15. Continuation (session 780)

- The design, section 11 split and plans committed at `fc2ef3b` are reused
  unchanged. Run 778 failed at dispatch only: every entry of
  `impl-plans/active/tsh-s778-dispatch.json` lacked `acceptanceCriteria`.
- The `Column N` rule is already pinned in section 6, in
  `impl-plans/active/tsh-00-overview.md` and in its owning plan
  `tsh-01d-values` (`columns.ts`, `grid.ts`). `tsh-01c-edits` explicitly
  does not own `insertColumn`, naming or paste. No plan edit is needed.
- Dispatch contract for this run: exactly one active manifest,
  `impl-plans/active/tsh-s780-dispatch.json`, with the 13 plans of
  section 11 (`tsh-01a`..`tsh-01d` wave 1, `tsh-02`..`tsh-07` wave 2,
  `tsh-08-wiring` wave 3). Every entry has `planId`, `planPath`,
  `progressPath`, `wave`, `dependsOn` (the section 11 "Depends on"
  column), `writePaths`, `sharedPaths`, `verification`,
  `artifactRoots: ["target"]` and a non-empty `acceptanceCriteria` array of
  non-empty strings copied from that plan's `## Done criteria` section.
  The field shape follows `tsh-s776-dispatch.json`.
  `tsh-s778-dispatch.json` is deleted in the same checkpoint. The
  superseded stubs `tsh-01-model` and `tsh-04-cell-editing` stay on disk
  and are not dispatched.
- The evidence root is `tmp/tsh-s780/<planId>/`. It matches the manifest
  `evidenceRoot` `tmp/tsh-s780` for taskId `tsh-s780`. The plans' former
  `tmp/tsh-s778` log path was renamed mechanically at the checkpoint. It is
  a log directory name only and does not change scope.
