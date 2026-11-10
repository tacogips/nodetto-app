# tsh-05-inspector

- planId: tsh-05-inspector
- planPath: impl-plans/active/tsh-05-inspector.md
- progressPath: impl-plans/progress/tsh-05-inspector.md
- wave: 2
- dependsOn: tsh-01a-ir, tsh-01b-layout, tsh-01c-edits, tsh-01d-values
- Design: `design-docs/specs/design-table-sheet.md` section 7.
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`.
- writePaths:
  - `packages/ui-solid/src/inspector/TableSheetSection.tsx` (new)
  - `packages/ui-solid/src/inspector/table-sheet-section.ts` (new)
  - `packages/ui-solid/src/inspector/table-sheet-section.test.ts` (new)
  - `impl-plans/progress/tsh-05-inspector.md`
  - `tmp/tsh-s780/tsh-05-inspector`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan adds an inspector section that edits the table-level and
column-level properties. Each control commit is one `applyTableSheetEdit`
call, which is one undo step. tsh-08 adds the `Match` in `Inspector.tsx`
and the type label. Do not edit `Inspector.tsx`.

## Non-goals

- No cell-level styling UI. Cell bold, align and fill are authored through
  the CLI or JSONL. The inspector scope is design section 7.
- No `Inspector.tsx` edits.
- No new controls library.

## File-level changes

1. `table-sheet-section.ts` (pure helpers, no JSX):
   - `parseOptionLines(text: string): string[]`: split on `\n` or
     `\r\n`, trim each line, drop empty lines, de-duplicate while keeping
     the first occurrence, and cap at 100.
   - `formatOptionLines(options?: readonly string[]): string`.
   - `rowToDelete(s: TableSheetSemantic, activeRowId?: string): string | undefined`:
     the active row if it still exists, otherwise the last row, otherwise
     `undefined`.
   - `columnTypeLabel(type)`: Text, Number, Checkbox, Select or Date.
2. `TableSheetSection.tsx`: `export function TableSheetSection(props: { editor: Editor; element: Element; activeRowId?: string }): JSX.Element`.
   - Imitate `packages/ui-solid/src/inspector/ErdSections.tsx` (column list
     rows, move up/down) and use `packages/ui-solid/src/Switch.tsx`,
     `packages/ui-solid/src/NumberInput.tsx` and `inspector/controls.tsx`.
   - Controls and the edit function each one calls:
     - header row switch -> `setHeaderRow`
     - striped switch -> `setStriped`
     - per column:
       - name text -> `renameColumn` on commit (change/blur, not every
         keystroke)
       - type select -> `retypeColumn`
       - width `NumberInput` -> `resizeColumn`
       - alignment select (Default/Left/Center/Right) -> `setColumnAlign`
         (Default -> `undefined`)
       - options textarea (select columns only) -> `setColumnOptions`
         with `parseOptionLines` on commit
       - move up/down -> `moveColumn`
       - delete -> `deleteColumns([id])`, disabled when only one column
         remains
     - buttons:
       - "Add row" -> `insertRow(s, rows.length, newElementId)`
       - "Add column" -> `insertColumn(s, columns.length, newElementId)`
       - "Delete row" -> `deleteRows([rowToDelete(...)])`, disabled when
         there are no rows
   - When an edit returns `ok:false`, show the message inline, as existing
     sections show errors. Search `ErdSections.tsx` for its error pattern
     and imitate it. Do not throw.

## Pitfalls

- Commit on change or blur only, never per keystroke, so each control
  action is one undo entry.
- Key `For` items by column id. Do not use the index as identity, because
  that would remount inputs on move.
- Read the semantic through `readTableSheet(props.element.semantic)`.

## Tests (`table-sheet-section.test.ts`; pure helpers plus edit integration with a real `Editor`)

- `parseOptionLines("Todo\r\n Doing \n\nTodo\nDone")` -> `["Todo","Doing","Done"]`
- 101 lines -> 100 entries
- `rowToDelete` with an active row id -> that id; with a stale id -> the
  last row; with no rows -> `undefined`
- Integration: with an `Editor` holding a 3x3 table, each step below
  produces exactly one history entry. Create the table with
  `editor.createElement("table.sheet", { semantic: defaultTableSheetSemantic(), visual: {x:0, y:0} })`.
  Always pass the explicit semantic: before tsh-08 registers the util, a
  bare create gets `{}` and fails validation. After each step below, one `editor.undo()` restores the
  previous semantic:
  - "Add row" (rows 3 -> 4)
  - "Add column" (`Column 1`, width 120, because the default 3x3 has no
    `Column N` name; see the tsh-00 `Column N` rule)
  - `setColumnOptions(parseOptionLines(...))`
  - `retypeColumn` to number
  - `setStriped(true)`

## Verification (exit 0; test commands show at least 1 test, 0 fail)

1. `bun test ./packages/ui-solid/src/inspector/table-sheet-section.test.ts` -> `inspector.log`
2. `bun test ./packages/ui-solid/src/inspector/edits.test.ts` -> `inspector-regression.log`
Static checks (tsh-00; must exit 0, but they are not test commands):
`bun run typecheck` -> `typecheck.log`, and `bunx biome check packages/ui-solid/src/inspector/TableSheetSection.tsx packages/ui-solid/src/inspector/table-sheet-section.ts packages/ui-solid/src/inspector/table-sheet-section.test.ts --diagnostic-level=warn` -> `biome.log`

## Done criteria

- `TableSheetSection` is exported with the pinned props.
- Verifications 1-4 exited 0, with logs under `tmp/tsh-s780/tsh-05-inspector/final/`.
- `Inspector.tsx` is unchanged by this plan, and the progress log is
  complete.
