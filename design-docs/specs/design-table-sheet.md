# Spreadsheet table element: `table.sheet`

Status: design, not implemented.

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

These paths were checked against the repository at `f59bef4`. No earlier
table spec exists under `design-docs/specs/`.

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
`TABLE_SHEET_DEFAULT_COLUMN_WIDTH = 120`, `TABLE_SHEET_CELL_PADDING_X = 8`,
`TABLE_SHEET_FONT_SIZE = 12`.

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

All edits are pure functions in `packages/core/src/table-sheet/edits.ts`.
Each one takes a `TableSheetSemantic` and returns a new one, or a typed
error for a limit or type violation. The app and the CLI apply the result
as one `updateSemantic` command. That is one `apply`, so it is one undo
entry, and it uses the normal validation and collab path. No new `Command`
kind is added.

Edit functions: `setCell(rowId, columnId, value | undefined)`,
`setCellStyle`, `clearRange`, `insertRow(at)`, `deleteRows(ids)`,
`insertColumn(at, type?)`, `deleteColumns(ids)`. Deleting the last column
is refused. Then `renameColumn`, `retypeColumn`, `setColumnOptions`,
`setColumnAlign`, `resizeColumn(id, width)`, `resizeRow(id, height)`,
`setHeaderRow`, `setStriped`. Ids are passed in through an `IdSource`
parameter. Sizes are rounded to integers and clamped to the limits.

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

Interaction lives in new ui-solid modules:
`packages/ui-solid/src/table-sheet/selection.ts` (state),
`keyboard.ts`, `cell-editor.tsx`, `resize.ts` and `clipboard.ts`.

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
- Clipboard (`table-sheet/tsv.ts` in core, `clipboard.ts` in ui-solid):
  - Copy and Cut on an active range write TSV with
    `serializeTsv(clipboardValues(semantic, range))`. `clipboardValues` reads
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
    named `Column N` (width 120) are appended past the last column. Values
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
    `Column 1..N`. Types default to `text`. `--data` takes a JSON array of row
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
  add op. `shapes`/`draw` get the catalogue shape id `table:sheet`.
- Help text in `help.ts` and docs in `docs/cli.md`.

## 9. Toolbox

A new `Tool.Sheet = "table.sheet"` (label "Sheet", icon `table`) sits in the
General palette group. `Tool.Table` stays as `erd.table`. Creation places the
default 3x3 table: columns `Name` (text, 160), `Status` (select, options
`Todo/Doing/Done`, 120) and `Done` (checkbox, 80), plus 3 empty rows. The
bounds are 360 x 116. The column and row ids come from the editor's
`IdSource`. The catalogue shape id is `table:sheet`.

## 10. Collaboration and repository boundary

- Only `createElement`, `updateSemantic` and `updateVisual` are emitted. The
  private nodetto-cloud Worker's exhaustive `authoring-discovery.ts` over
  `Command` kinds is therefore unaffected. The integration review should
  confirm that `packages/core/src/commands.ts` has no diff.
- Collab merges at cell granularity (section 1). Concurrent paste or resize
  on the same cell is last writer wins, the same as any field.
- No server code, auth, secrets, deployment config, version bump or release.

## 11. Module ownership and plan split

At most two waves before wiring. Dependencies are declared only on real
contracts.

| Plan | Wave | Depends on | Owns (new unless noted) |
|---|---|---|---|
| P1 model | 1 | none | `packages/ir/src/semantics/table.ts`, `packages/ir/src/registry/table.ts`, `packages/ir/src/registry/table.test.ts`. IR-internal registration (edit): `semantics.ts`, `registry.ts`, `packages/ir/src/index.ts`, `registry.test.ts`. `packages/io/src/__fixtures__/table-sheet.jsonl` plus the `GOLDEN` entry (edit `golden.test.ts`) and `packages/io/src/jsonl/table-sheet.test.ts`. `packages/core/src/table-sheet/{index,layout,paint,shape,edits,coerce,tsv,grid}.ts` with tests beside them, and the barrel line `export * from "./table-sheet/index.ts"` in `packages/core/src/index.ts`. |
| P2 export | 2 | P1 | `packages/core/src/svg-export/table-sheet.ts` + `table-sheet.test.ts` |
| P3 canvas view | 2 | P1 | `packages/ui-solid/src/shapes/TableSheetView.tsx`, `TableSheetView.css`, `table-sheet-view.test.ts` |
| P4 cell editing | 2 | P1 | `packages/ui-solid/src/table-sheet/{selection,keyboard,clipboard,resize}.ts`, `cell-editor.tsx` + tests |
| P5 inspector | 2 | P1 | `packages/ui-solid/src/inspector/TableSheetSection.tsx` + `table-sheet-section.test.ts` |
| P6 CLI | 2 | P1 | `apps/cli/src/table-command.ts`, `apps/cli/src/edit/operations/table.ts` + tests (`table-command.test.ts`, `edit/operations/table.test.ts`) |
| P7 docs | 2 | P1 | `docs/editing.md` (table section and limits), `docs/cli.md`, `docs/import-export.md` (SVG/PNG note), this spec's status line |
| P8 wiring | 3 | P2-P7 | `packages/core/src/shapes/index.ts`, `svg-export/shapes.ts`, `tools.ts`, `shape-catalogue.ts`; `packages/ui-solid/src/shapes/ShapeView.tsx`, `Canvas.tsx`/`interaction/pointer.ts`/`interaction/keyboard.ts` hooks, `Inspector.tsx`, `shape-palette.ts`; `apps/cli/src/commands.ts`, `help.ts`, `edit/batch.ts`, `types-command.ts`, `edit/operation-fields.test.ts`, `cli-wiring.test.ts`; `README.md`; end-to-end tests (export SVG through `renderShape`, CLI create→lint→export) |

Intentional divergence from the intake's "wiring owns registry index and
core index.ts": P1 owns IR-internal registration and one barrel line in core
`index.ts`. The reasons:

1. The packages export only `"."`, so wave-2 plans cannot import P1's code
   until it is re-exported.
2. `registry.test.ts` and the golden coverage test fail unless registration,
   the type list and the fixture land together.

Every cross-package dispatch and registration file is still owned only by
P8.

Every plan sets `artifactRoots: ["target"]`. writePaths include the tests
beside each owned module.

## 12. Verification

Every command must exit 0 and run at least one test:

- `bun test packages/ir/src/registry/table.test.ts packages/io/src/jsonl`
- `bun test packages/core/src/table-sheet packages/core/src/svg-export/table-sheet.test.ts`
- `bun test packages/ui-solid/src/table-sheet packages/ui-solid/src/shapes/table-sheet-view.test.ts packages/ui-solid/src/inspector/table-sheet-section.test.ts`
- `bun test apps/cli/src/table-command.test.ts apps/cli/src/edit/operations/table.test.ts apps/cli/src/cli-wiring.test.ts`
- `bun test packages/ir packages/io packages/core` (includes the existing
  `erd.table` tests, which must be unchanged)
- `bun run typecheck`, `mise run lint`, `mise run test`
- `mise run test-cli`, up to 3 attempts under load, without relaxing
  deadlines
- `mise run build-cli` and `mise run build`

Required test assertions:

- Validation: each issue code in section 3 has a failing case. Each limit is
  tested at the boundary and at the boundary plus one.
- Bounds: the bounds equal the sum of column widths and row heights,
  including the `headerRow: false` case and the empty case.
- Edits: each edit is one `updateSemantic`, and one undo restores the prior
  payload. A resize drag gives one history entry.
- TSV: parse and serialize round-trip, including quoted tabs and newlines.
  Paste growth and the over-limit rejection are tested.
- Clipboard preservation, core `packages/core/src/table-sheet/tsv.test.ts`
  plus ui-solid `packages/ui-solid/src/table-sheet/clipboard.test.ts`, using
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
