# tsh-03-view

- planId: tsh-03-view
- planPath: impl-plans/active/tsh-03-view.md
- progressPath: impl-plans/progress/tsh-03-view.md
- wave: 2
- dependsOn: tsh-01-model
- Design: `design-docs/specs/design-table-sheet.md` sections 1 (appearance invariant), 4, 5.
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`.
- writePaths:
  - `packages/ui-solid/src/shapes/TableSheetView.tsx` (new)
  - `packages/ui-solid/src/shapes/TableSheetView.css` (new)
  - `packages/ui-solid/src/shapes/table-sheet-view-model.ts` (new)
  - `packages/ui-solid/src/table-sheet-view.test.ts` (new)
  - `impl-plans/progress/tsh-03-view.md`
  - `tmp/tsh-s776/tsh-03-view`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan draws the table on the Solid canvas. The pixels must follow
`tableSheetLayout`, so what is drawn is what is picked and exported.
`ShapeView.tsx` dispatch is tsh-08's. The active-cell highlight is tsh-04's
overlay, not this view's.

## Non-goals

- No editing, keyboard, pointer or clipboard handling.
- No dispatch edits and no overlay.
- No appearance-dependent colors.

## File-level changes

1. `table-sheet-view-model.ts` (pure, no JSX, no CSS import): `tableSheetViewModel(element: Element)`.
   - It returns the layout converted to element-local coordinates (layout
     minus `layout.box.x/y`) plus inline style objects for each header cell,
     body cell, stripe and checkbox/pill.
   - Export the helpers `tableSheetCellStyle(cell)` and
     `tableSheetTextAlign(align)`. Imitate the pure-helper split of
     `packages/ui-solid/src/shapes/TextNoteView.tsx:textNoteStyle`.
2. `TableSheetView.tsx`: `export function TableSheetView(props: { element: Element }): JSX.Element`.
   - Imitate `packages/ui-solid/src/shapes/ErdTableView.tsx` (root
     `data-smart-paint="box"`, `fillPaintStyle`/`strokeBorderStyle` from
     `./visual.ts`) and the CSS import style of `UiControlView.tsx`
     (`import "./TableSheetView.css"`).
   - Render absolutely positioned elements from the view model, not a CSS
     grid:
     - the header band and header texts, then stripes, then cell fills,
       then gridlines (1px divs or one inline SVG layer)
     - text spans with `white-space: nowrap; overflow: hidden;
       text-overflow: ellipsis`, using the full display string
     - checkbox squares 14px; pills of height 18 and radius 9
   - Wrap repeated items in `For`.
3. `TableSheetView.css`: classes `nodetto-table-sheet`, `-header`, `-cell`,
   `-checkbox`, `-pill` and `-stripe`.
   - Colors only from document tokens: `var(--nodetto-ink)`,
     `--nodetto-line`, `--nodetto-surface`, `--nodetto-accent`,
     `--nodetto-accent-soft`. The stripe and pill colors are inline values
     from `TABLE_SHEET_PAINT`.
   - Font size 12px. Header font-weight 700.

## Invariants and pitfalls

- Appearance invariant (`design-docs/specs/design-appearance.md` section 2):
  use no `--app-*` tokens, no `prefers-color-scheme`, and no
  `.nodetto-canvas-dark` selectors. The table paints identically under
  light and dark canvas backgrounds.
- The total size equals `tableSheetBounds`, with no padding or margins
  added. Border 1.5px as `box-shadow: inset` or `outline` is acceptable
  only if it does not change the layout box. Pick one approach and state it
  in the progress log.
- Do not edit `apps/desktop/src/styles/canvas.css` or `ShapeView.tsx`.

## Tests (`packages/ui-solid/src/table-sheet-view.test.ts`, pure view model)

- 160/120/80 table at visual x=50,y=70 -> the view model root is 360x116,
  the first header cell is at left 0 and the second at left 160.
- Number cell -> the text style has `text-align: right`. A checkbox cell is
  centered. A cell with `align:"center"` overrides that.
- `"alpha\nbeta"` -> display text `alpha beta`.
- Select `Done` -> pill style background equals `TABLE_SHEET_PAINT.pillPalette[2].fill`.
- `striped:true` with 4 rows -> 2 stripe entries at the rows with index 1 and 3.
- `headerRow:false` -> no header entries, and the first row top is 0.
- Cell `fill:"#ffeeaa"`, `bold:true` -> background `#ffeeaa`, font-weight 700.

## Verification (exit 0; test commands show at least 1 test, 0 fail)

1. `bun test ./packages/ui-solid/src/table-sheet-view.test.ts` -> `view.log`
2. `bun test ./packages/ui-solid/src/erd-table-view.test.ts` -> `erd-regression.log`
3. `bun run typecheck` -> `typecheck.log` (static gate)
4. `bunx biome check packages/ui-solid/src/shapes/TableSheetView.tsx packages/ui-solid/src/shapes/TableSheetView.css packages/ui-solid/src/shapes/table-sheet-view-model.ts packages/ui-solid/src/table-sheet-view.test.ts --diagnostic-level=warn` -> `biome.log`

## Done criteria

- `TableSheetView` is exported with the pinned signature, and the view
  model is tested.
- Verifications 1-4 exited 0, with logs under `tmp/tsh-s776/tsh-03-view/final/`.
- `grep -n -- "--app-\|prefers-color-scheme\|nodetto-canvas-dark" packages/ui-solid/src/shapes/TableSheetView.css`
  prints nothing. Record the grep exit status 1 in the progress log.
