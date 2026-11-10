# tsh-04-cell-editing

- planId: tsh-04-cell-editing
- planPath: impl-plans/active/tsh-04-cell-editing.md
- progressPath: impl-plans/progress/tsh-04-cell-editing.md
- wave: 2
- dependsOn: tsh-01-model
- Design: `design-docs/specs/design-table-sheet.md` section 6 (interaction, clipboard, resize), 12.
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`.
- writePaths:
  - `packages/ui-solid/src/table-sheet/selection.ts` (new)
  - `packages/ui-solid/src/table-sheet/selection.test.ts` (new)
  - `packages/ui-solid/src/table-sheet/keyboard.ts` (new)
  - `packages/ui-solid/src/table-sheet/keyboard.test.ts` (new)
  - `packages/ui-solid/src/table-sheet/clipboard.ts` (new)
  - `packages/ui-solid/src/table-sheet/clipboard.test.ts` (new)
  - `packages/ui-solid/src/table-sheet/resize.ts` (new)
  - `packages/ui-solid/src/table-sheet/resize.test.ts` (new)
  - `packages/ui-solid/src/table-sheet/cell-commit.ts` (new)
  - `packages/ui-solid/src/table-sheet/cell-commit.test.ts` (new)
  - `packages/ui-solid/src/table-sheet/CellEditor.tsx` (new)
  - `packages/ui-solid/src/table-sheet/SelectionOverlay.tsx` (new)
  - `packages/ui-solid/src/table-sheet/TableSheet.css` (new)
  - `impl-plans/progress/tsh-04-cell-editing.md`
  - `tmp/tsh-s776/tsh-04-cell-editing`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan adds the Excel-like interaction: the active cell and range,
keyboard navigation, the in-place cell editor, the TSV clipboard, and
column and row resizing. Each document change is one
`applyTableSheetEdit` call, which is one `updateSemantic` and one undo
entry. Each resize drag is wrapped in `editor.beginBatch()`/`endBatch()`.

This plan only exports modules. tsh-08 hooks them into `Canvas.tsx`,
`interaction/pointer.ts` and `interaction/keyboard.ts`. Do not edit those
files.

## Non-goals

- No canvas wiring.
- No inspector.
- No new Command kinds.
- No multi-line editor (user-qa Q4).
- No change to element copy/paste when no cell is active.

## Contracts to export (tsh-08 depends on these names)

```ts
// selection.ts
export interface TableSheetCellRef { readonly rowId: string; readonly columnId: string }
export interface TableSheetSelectionState {
  readonly elementId: ElementId; readonly active: TableSheetCellRef;
  readonly anchor: TableSheetCellRef; readonly editing: boolean; readonly seed?: string }
export interface TableSheetSelection {
  state(): TableSheetSelectionState | null;           // Solid accessor
  activate(elementId: ElementId, cell: TableSheetCellRef): void;  // anchor = active
  extend(cell: TableSheetCellRef): void;
  move(editor: Editor, dRow: number, dCol: number, options?: { extend?: boolean; wrap?: boolean }): void;
  range(editor: Editor): TableSheetRange | null;      // inclusive indices from current semantic
  startEditing(seed?: string): void; stopEditing(): void; clear(): void;
  reconcile(editor: Editor): void;  // clears when element gone/deselected or ids vanished
}
export function createTableSheetSelection(): TableSheetSelection;
// resize.ts
export type TableSheetRegion =
  | { kind: "column-border"; columnId: string } | { kind: "row-border"; rowId: string }
  | { kind: "cell"; rowId: string; columnId: string };
export function tableSheetRegionAt(layout: TableSheetLayout, point: Vec, zoom: number): TableSheetRegion | null;
export function beginTableSheetResize(editor: Editor, elementId: ElementId,
  region: Extract<TableSheetRegion, { kind: "column-border" | "row-border" }>, start: Vec):
  { move(point: Vec): void; end(): void; cancel(): void };
export function resetColumnWidth(editor: Editor, elementId: ElementId, columnId: string): boolean;
export function tableSheetCellClick(editor: Editor, selection: TableSheetSelection, elementId: ElementId,
  cell: TableSheetCellRef, options: { shift: boolean }): void;   // toggles an already-active checkbox
// keyboard.ts
export interface TableSheetKeyContext { editor: Editor; selection: TableSheetSelection;
  clipboard: TableClipboardPort }
export function handleTableSheetKey(event: KeyboardEvent, ctx: TableSheetKeyContext): boolean; // true = consumed, preventDefault done
// clipboard.ts
export interface TableClipboardPort { writeText(text: string): void | Promise<void>; readText(): Promise<string> }
export function copyTableRange(editor, selection, port): Promise<boolean>;
export function cutTableRange(editor, selection, port): Promise<boolean>;
export function pasteIntoTable(editor, selection, port): Promise<TableSheetEditResult | null>;
// cell-commit.ts (pure-ish helpers the editor component uses; testable without DOM)
export function commitCellText(editor, selection, text: string,
  move: "down" | "right" | "left" | "none"): TableSheetEditResult | null;
export function cellEditorInitialText(editor, selection): string;  // seed ?? clipboardCellText(stored)
// CellEditor.tsx / SelectionOverlay.tsx
export function TableSheetCellEditor(props: { editor: Editor; selection: TableSheetSelection; onDone: () => void }): JSX.Element;
export function TableSheetSelectionOverlay(props: { editor: Editor; selection: TableSheetSelection }): JSX.Element;
```

## File-level changes and key points

- `selection.ts`: a Solid `createSignal` store. Keep ids, not indices, so
  concurrent edits do not shift the selection to a wrong cell.
  - `move` clamps to the table edges.
  - With `wrap`, Tab past the last column goes to the first column of the
    next row, and Shift+Tab before the first column goes to the last column
    of the previous row. Clamp at the table corners.
  - `reconcile` runs from tsh-08 on store changes.
- `keyboard.ts`: the event target is not editable (tsh-08 calls this only
  from the canvas keydown path). If `selection.state()` is null, or the
  element is not in `editor.selection`, return false.
  - Arrow keys move the active cell; Shift+arrow extends the range.
  - Tab and Shift+Tab move right and left with wrap.
  - Enter and F2 call `startEditing()`.
  - A single printable character with no meta, ctrl or alt calls
    `startEditing(key)`.
  - Delete and Backspace clear the range with one `clearRange` edit.
  - Escape calls `selection.clear()`. The element stays selected.
  - Cmd/Ctrl + C, X and V go to copy, cut and paste.
  - Every consumed key calls `preventDefault()` and returns true.
  - Cmd/Ctrl+Z, Shift+Cmd+Z and all other shortcuts return false, so the
    canvas undo stays in charge.
- `clipboard.ts`:
  - copy: `serializeTsv(clipboardGrid(semantic, range))`. Use the STORED
    values from tsh-01 and never the layout display strings (design
    section 6, TABLE-DESIGN-001).
  - cut: write the clipboard first. Only after `writeText` resolves, apply
    one `clearRange`. That is one undo entry.
  - paste: `readText()`, then `parseTsv`, then `pasteGrid` at the active
    cell with `ids = newElementId`, then one `applyTableSheetEdit`.
    - Afterwards, set the range to cover the pasted grid.
    - On `ok:false`, change nothing and return the result.
    - On a `readText` rejection, return null without throwing.
- `cell-commit.ts`:
  - Commit with `setCellText`, then move.
  - "down" on the last row commits and stays. It does not grow the table.
  - "right" and "left" move with wrap.
  - If the coerced value is invalid (for example `x` in a number column),
    the cell is cleared, as the design's coercion rules say. Record the
    skipped count in the result.
  - Text equal to the current stored clipboard text applies nothing (no
    empty undo entry).
- `CellEditor.tsx`: imitate the placement code of
  `packages/ui-solid/src/TextEditor.tsx` (camera transform to screen box)
  using the cell rect from `tableSheetLayout`.
  - Text, number and checkbox columns use `<input type="text">`; a
    checkbox cell accepts true/false text. Select columns use a `<select>`
    with an empty option. Date columns use `<input type="date">`.
  - Autofocus. The initial value is `cellEditorInitialText`, which uses the
    seed when present.
  - Keys inside the editor:
    - Enter: commit, move down
    - Tab and Shift+Tab: commit, move right or left
    - Escape: `stopEditing()` without commit
  - Blur commits with "none". After any of these, call `onDone()`.
  - Stop the propagation of handled keys so canvas shortcuts never see
    them.
- `SelectionOverlay.tsx`: a page-space rectangle around the active cell (2px
  accent) and a translucent range fill. Use `pointer-events: none`. It
  appears only in the editing overlay layer and is never exported.
- `resize.ts`:
  - The hit band is 4 screen px, `4 / zoom` page units, around each
    internal and right column border and each row bottom border.
  - A column wins where it crosses a row band.
  - `beginTableSheetResize` calls `editor.beginBatch()` at start and
    applies `resizeColumn` or `resizeRow` on each `move` from the start
    size plus delta (clamped by the core).
    - `end()` calls `editor.endBatch()`. A drag whose moves applied nothing
      (zero net delta, or every `applyTableSheetEdit` a no-op) records no
      history entry.
    - `cancel()` calls `editor.abortBatch()`. This is
      `packages/core/src/editor/facade/core.ts:abortBatch`, which calls
      `packages/core/src/history.ts:abortBatch`, and imitates
      `packages/ui-solid/src/interaction/lifecycle.ts:71`. It reverts every
      move applied since `beginBatch` through the undo runner and records no
      history entry and no redo.
    - Do NOT call `endBatch()` and then apply a restore. After the outermost
      `endBatch` the pending entry is committed, so the restore would add a
      second undo entry.
  - `resetColumnWidth` sets 120.
- `TableSheet.css`: editor and overlay styles. Overlay chrome may use the
  `--app-*` overlay tokens, because selection overlays are canvas chrome
  (design-appearance section 1).

## Pitfalls

- Never write the display string (`"alpha beta"`) to the clipboard or into
  the editor's initial value.
- Do not call `editor.apply` once per keystroke. Commit only on
  Enter, Tab or blur.
- Do not handle keys when `event.target` is an input. The cell editor owns
  those keys.
- Read the element through `editor.store.get(id)`. Do not cache the
  semantic across awaits: paste and cut re-read after the `await`.

## Tests (bun test with a real `Editor` from `@nodetto/core`; imitate `packages/ui-solid/src/interaction-test-helpers.ts` for setup; DOM-free except `KeyboardEvent`-like objects)

Create a `table.sheet` with `editor.createElement("table.sheet", ...)` and
explicit ids. If `createElement` needs a registered util, register
`tableSheetShapeUtil` on the test editor's registry locally in the test.
Check the `Editor` options for a shapes registry argument first; if none
exists, record the approach.

- `selection.test.ts`:
  - activate then move(0,1) moves to the next column; at the last column it
    clamps
  - Tab wrap goes to the next row's first column
  - Shift extend gives range indices {top,left,bottom,right}
  - deleting the active column then `reconcile` -> state is null
- `keyboard.test.ts`:
  - ArrowDown -> active row + 1 and returns true. The element visual x/y is
    unchanged, so no nudge.
  - Delete over a 2x2 range -> 4 cells cleared, and one undo restores them
  - "a" key -> editing true with seed "a"
  - Escape -> selection null, and `editor.selection` still contains the table
  - Meta+Z -> returns false
- `cell-commit.test.ts`:
  - commit "Widget" with down -> stored, active moves to the next row, one
    undo entry
  - commit on the last row with down -> stays and the row count is unchanged
  - Tab commit at the last column -> wraps
  - number column "x" -> cleared, skipped 1
  - unchanged text -> no history entry
  - initial text of a `"alpha\nbeta"` cell -> `"alpha\nbeta"`
- `clipboard.test.ts` (fake port that stores the text):
  - copy a range holding `"alpha\nbeta"`, `"tab\there"`, `say "hi"` and
    `"line1\r\nline2"`, then paste into another range -> the stored values
    are exactly equal
  - cut those values -> range cleared with exactly one history entry; paste
    elsewhere -> exact values; one undo of the cut restores the original
    range
  - typed values copy as `42`, `TRUE`, `Doing` and `2024-02-29`, and paste
    back into same-typed columns unchanged
  - paste that would exceed 100 columns -> semantic unchanged, result
    `table.limit`
  - paste past the bottom grows rows
  - a rejecting `readText` -> null and no change
- `resize.test.ts`:
  - `tableSheetRegionAt` on the border between columns 1 and 2 at zoom 1 ->
    column-border c1
  - at zoom 2 the band halves
  - a drag with 3 moves (+10, +20, +30) -> width +30, and one undo
    restores the original width
  - a drag with moves +10 and +20 followed by `cancel()` -> the width is
    back to its original value (160), the undo stack depth is unchanged
    (compare `editor.canUndo`/history depth before and after), and
    `editor.undo()` changes nothing about the table (its semantic stays
    deep-equal)
  - drag below the minimum -> 24
  - `resetColumnWidth` -> 120
  - a click on an already-active checkbox cell toggles the value in one apply

## Verification (exit 0; test commands show at least 1 test, 0 fail)

1. `bun test ./packages/ui-solid/src/table-sheet` -> `cell-editing.log`. The log must list only files under `packages/ui-solid/src/table-sheet/`.
2. `bun run typecheck` -> `typecheck.log` (static gate)
3. `bunx biome check packages/ui-solid/src/table-sheet --diagnostic-level=warn` -> `biome.log`

## Done criteria

- All contracts above are exported with these names.
- Verifications 1-3 exited 0, with logs under `tmp/tsh-s776/tsh-04-cell-editing/final/`.
- The clipboard preservation and single-undo Cut tests are present and
  pass. Name them in the progress log.
- No edits outside writePaths.
