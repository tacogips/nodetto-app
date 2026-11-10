# tsh-04c-resize

- planId: tsh-04c-resize
- planPath: impl-plans/active/tsh-04c-resize.md
- progressPath: impl-plans/progress/tsh-04c-resize.md
- wave: 2
- dependsOn: tsh-01a-ir, tsh-01b-layout, tsh-01c-edits
- Design: `design-docs/specs/design-table-sheet.md` section 6 (Resize).
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`.
- writePaths:
  - `packages/ui-solid/src/table-sheet/resize.ts` (new)
  - `packages/ui-solid/src/table-sheet/resize.test.ts` (new)
  - `impl-plans/progress/tsh-04c-resize.md`
  - `tmp/tsh-s780/tsh-04c-resize`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan adds column and row border hit testing and the resize drag. A
drag is one undo step. tsh-08 calls these functions from
`interaction/pointer.ts`. This plan does not import tsh-04a or tsh-04b.

## Non-goals

- No pointer wiring, no cursors and no selection state.

## Contracts to export

```ts
export type TableSheetRegion =
  | { kind: "column-border"; columnId: string } | { kind: "row-border"; rowId: string }
  | { kind: "cell"; rowId: string; columnId: string };
export function tableSheetRegionAt(layout: TableSheetLayout, point: Vec, zoom: number): TableSheetRegion | null;
export function beginTableSheetResize(editor: Editor, elementId: ElementId,
  region: Extract<TableSheetRegion, { kind: "column-border" | "row-border" }>, start: Vec):
  { move(point: Vec): void; end(): void; cancel(): void };
export function resetColumnWidth(editor: Editor, elementId: ElementId, columnId: string): boolean;
```

## Key points

- Hit bands:
  - The band is 4 screen px, which is `4 / zoom` page units, around each
    internal and right column border and each row bottom border.
  - Column bands span the full table height, header included, so a drag on
    the header border resizes the column.
  - Columns win where a column band crosses a row band.
  - A point inside a body cell and outside every band gives `cell`.
  - A point in the header row and outside every band gives null.
  - A point outside the table gives null.
- `beginTableSheetResize`:
  - Call `editor.beginBatch()` at start.
  - On each `move`, apply `resizeColumn` or `resizeRow` from the start size
    plus the delta, through `applyTableSheetEdit`. The core clamps it.
  - `end()` calls `editor.endBatch()`. A drag with no net change records no
    history entry.
  - `cancel()` calls `editor.abortBatch()` (`packages/core/src/editor/facade/core.ts:abortBatch`).
    Imitate `packages/ui-solid/src/interaction/lifecycle.ts`. It reverts
    every move and records no history entry and no redo.
  - Do NOT call `endBatch()` and then apply a restore. That would add a
    second undo entry.
- `resetColumnWidth`: one `applyTableSheetEdit` with `resizeColumn(..., 120)`
  (`TABLE_SHEET_DEFAULT_COLUMN_WIDTH`). Returns whether it changed
  anything.

## Tests (`resize.test.ts`; a real `Editor`; table created with an explicit semantic: columns 160/120/80, 3 rows)

- `tableSheetRegionAt` at x=160 (the border between c1 and c2), y=50, zoom
  1 -> column-border c1. At zoom 2, a point 3 px away is no longer a hit.
- A point at a row bottom border -> row-border. Where a column band crosses
  it -> column-border.
- A drag with 3 moves (+10, +20, +30) then `end()` -> width 190, and one
  undo restores 160.
- A drag with moves +10 and +20 then `cancel()` -> width 160, no history
  entry, and `editor.undo()` leaves the table semantic deep-equal.
- A drag far below the minimum -> 24.
- `resetColumnWidth` on c1 -> 120 and true. A second call -> false.

## Verification (exits 0 and shows at least 1 test with 0 failures; log under `tmp/tsh-s780/tsh-04c-resize/final/`)

1. `bun test ./packages/ui-solid/src/table-sheet/resize.test.ts` -> `resize.log`

Static checks (tsh-00): `bunx biome check packages/ui-solid/src/table-sheet/resize.ts packages/ui-solid/src/table-sheet/resize.test.ts --diagnostic-level=warn`,
then `bun run typecheck`.

## Done criteria

- The contracts are exported, and verification 1 exited 0 with at least 6
  tests.
- The progress log is complete.
