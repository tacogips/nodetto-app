# tsh-04a-navigation

- planId: tsh-04a-navigation
- planPath: impl-plans/active/tsh-04a-navigation.md
- progressPath: impl-plans/progress/tsh-04a-navigation.md
- wave: 2
- dependsOn: tsh-01a-ir, tsh-01b-layout, tsh-01c-edits, tsh-01d-values
- Design: `design-docs/specs/design-table-sheet.md`, section 6
  (state, mouse, cell editor, keys).
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`.
- writePaths:
  - `packages/ui-solid/src/table-sheet/selection.ts` (new)
  - `packages/ui-solid/src/table-sheet/selection.test.ts` (new)
  - `packages/ui-solid/src/table-sheet/keyboard.ts` (new)
  - `packages/ui-solid/src/table-sheet/keyboard.test.ts` (new)
  - `packages/ui-solid/src/table-sheet/cell-commit.ts` (new)
  - `packages/ui-solid/src/table-sheet/cell-commit.test.ts` (new)
  - `packages/ui-solid/src/table-sheet/CellEditor.tsx` (new)
  - `packages/ui-solid/src/table-sheet/SelectionOverlay.tsx` (new)
  - `packages/ui-solid/src/table-sheet/TableSheet.css` (new)
  - `impl-plans/progress/tsh-04a-navigation.md`
  - `tmp/tsh-s780/tsh-04a-navigation`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan adds the Excel-like active cell and range, keyboard navigation,
the in-place cell editor and the selection overlay. Every document change
goes through `applyTableSheetEdit` (one `updateSemantic`, one undo entry).

tsh-08 mounts these pieces in `Canvas.tsx` and `interaction/*`. Do not edit
those files. Clipboard is tsh-04b and resize is tsh-04c; do not import them.

## Non-goals

- No canvas or pointer wiring.
- No clipboard: `handleTableSheetKey` returns false for Cmd/Ctrl+C, X and V.
- No resize.
- No multi-line editor (user-qa Q4).

## Contracts to export (tsh-08 depends on these names)

```ts
// selection.ts
export interface TableSheetCellRef { readonly rowId: string; readonly columnId: string }
export interface TableSheetSelectionState { readonly elementId: ElementId;
  readonly active: TableSheetCellRef; readonly anchor: TableSheetCellRef;
  readonly editing: boolean; readonly seed?: string }
export interface TableSheetSelection {
  state(): TableSheetSelectionState | null;                       // Solid accessor
  activate(elementId: ElementId, cell: TableSheetCellRef): void;  // anchor = active, editing false
  extend(cell: TableSheetCellRef): void;
  move(editor: Editor, dRow: number, dCol: number, options?: { extend?: boolean; wrap?: boolean }): void;
  range(editor: Editor): TableSheetRange | null;                  // inclusive indices from the current semantic
  startEditing(seed?: string): void; stopEditing(): void; clear(): void;
  reconcile(editor: Editor): void;   // clears when the element is gone or deselected, or its ids vanished
}
export function createTableSheetSelection(): TableSheetSelection;
export function tableSheetCellClick(editor: Editor, selection: TableSheetSelection,
  elementId: ElementId, cell: TableSheetCellRef, options: { shift: boolean }): void;
// keyboard.ts
export interface TableSheetKeyContext { editor: Editor; selection: TableSheetSelection }
export function handleTableSheetKey(event: KeyboardEvent, ctx: TableSheetKeyContext): boolean; // true = consumed
// cell-commit.ts
export function commitCellText(editor: Editor, selection: TableSheetSelection, text: string,
  move: "down" | "right" | "left" | "none"): TableSheetEditResult | null;
export function cellEditorInitialText(editor: Editor, selection: TableSheetSelection): string;
// CellEditor.tsx / SelectionOverlay.tsx
export function TableSheetCellEditor(props: { editor: Editor; selection: TableSheetSelection; onDone: () => void }): JSX.Element;
export function TableSheetSelectionOverlay(props: { editor: Editor; selection: TableSheetSelection }): JSX.Element;
```

## File-level changes and key points

- `selection.ts`:
  - A Solid `createSignal` store holding ids, not indices, so concurrent
    edits do not shift the selection.
  - `move` clamps at the edges. With `wrap`, moving past the last column
    goes to the first column of the next row, and moving before the first
    column goes to the last column of the previous row. It clamps at the
    table corners. `extend` keeps the anchor.
  - `tableSheetCellClick`:
    - If the clicked cell is already active, it is a checkbox cell and
      `shift` is false, toggle it with one `applyTableSheetEdit` and
      `setCellValue`.
    - Otherwise, with `shift`, extend; without it, activate.
- `keyboard.ts`. Return false (not consumed) when `selection.state()` is
  null or the element is not in `editor.selection`. Otherwise:
  - arrows move; Shift+arrow extends; Tab and Shift+Tab move with wrap
  - Enter and F2 start editing
  - a single printable character with no meta, ctrl or alt starts editing
    with `startEditing(key)` (the seed)
  - Delete and Backspace clear the range with one `clearRange` through
    `applyTableSheetEdit`
  - Escape calls `selection.clear()`, and the element stays selected
  - Each consumed key calls `preventDefault()` and returns true.
  - Cmd/Ctrl+C, X, V and Z, and every other shortcut, return false.
- `cell-commit.ts`:
  - `commitCellText` calls `setCellText`, then moves.
    - "down" on the last row stays, and does not grow the table.
    - "right" and "left" move with wrap.
  - An uncoercible value is cleared, and the result carries `skipped`.
  - Text equal to `clipboardCellText` of the stored value applies nothing.
  - `cellEditorInitialText` returns the seed when present, otherwise
    `clipboardCellText` of the stored value, never the layout display.
  - Both stop editing.
- `CellEditor.tsx`:
  - Imitate the placement in `packages/ui-solid/src/TextEditor.tsx`
    (camera transform to a screen box), using the cell box from
    `tableSheetLayout`.
  - Input by column type:
    - text, number and checkbox: `<input type="text">`
    - select: `<select>` with an empty option
    - date: `<input type="date">`
  - Autofocus.
  - Keys:
    - Enter commits and moves down.
    - Tab and Shift+Tab commit and move right or left.
    - Escape calls `stopEditing()` with no commit.
    - Blur commits with "none".
    - Stop propagation of handled keys. Call `onDone()` after each.
- `SelectionOverlay.tsx`:
  - A 2px accent rectangle around the active cell and a translucent range
    fill.
  - `pointer-events: none`. Never part of export.
- `TableSheet.css`: editor and overlay styles. The overlay may use
  `--app-*` overlay tokens.

## Pitfalls

- Never call `editor.apply` per keystroke. Commit only on Enter, Tab or
  blur.
- Read the element fresh with `editor.store.get(id)`. Do not cache the
  semantic.
- Import core symbols only from `@nodetto/core` and IR from `@nodetto/ir`.

## Tests (bun test with a real `Editor`; imitate `packages/ui-solid/src/interaction-test-helpers.ts` setup; DOM-free except `KeyboardEvent`-like objects)

Create the table with `editor.createElement("table.sheet", { semantic: defaultTableSheetSemantic(), visual: {x:0, y:0} })`
and select it.

- `selection.test.ts`:
  - activate c1/r1, then `move(0,1)` -> c2; at the last column it clamps
  - Tab wrap from r1/c3 -> r2/c1
  - Shift extend -> range `{top:0, left:0, bottom:1, right:1}`
  - after deleting the active column, `reconcile` -> state null
  - a click on an active checkbox cell -> toggled, with one history entry
- `keyboard.test.ts`:
  - ArrowDown -> active row + 1, returns true, element `visual.x/y`
    unchanged
  - Delete over a 2x2 range -> cells cleared; one undo restores them
  - key "a" -> editing with seed "a"
  - Escape -> state null, `editor.selection` still has the table
  - Meta+Z and Meta+C -> false
- `cell-commit.test.ts`:
  - commit "Widget" with "down" -> stored, the active cell moves down, one
    undo entry
  - "down" on the last row -> stays, and the row count is unchanged
  - Tab at the last column -> wraps
  - "x" in a number column -> cleared, `skipped` 1
  - unchanged text -> no history entry
  - initial text of `"alpha\nbeta"` -> `"alpha\nbeta"`

## Verification (exits 0 and shows at least 1 test with 0 failures; log under `tmp/tsh-s780/tsh-04a-navigation/final/`)

1. `bun test ./packages/ui-solid/src/table-sheet/selection.test.ts ./packages/ui-solid/src/table-sheet/keyboard.test.ts ./packages/ui-solid/src/table-sheet/cell-commit.test.ts` -> `navigation.log`

Static checks (tsh-00): `bunx biome check` on the nine owned files, then
`bun run typecheck`.

## Done criteria

- Every contract above is exported with these names.
- Verification 1 exited 0 with at least 15 tests.
- No edits outside writePaths. The progress log is complete.
