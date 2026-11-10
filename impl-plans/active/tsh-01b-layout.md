# tsh-01b-layout

- planId: tsh-01b-layout
- planPath: impl-plans/active/tsh-01b-layout.md
- progressPath: impl-plans/progress/tsh-01b-layout.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-table-sheet.md`, sections 4, 5 and 9.
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`. The
  signatures for this plan are pinned there under "tsh-01b-layout".
- writePaths:
  - `packages/core/src/table-sheet/layout.ts` (new)
  - `packages/core/src/table-sheet/layout.test.ts` (new)
  - `packages/core/src/table-sheet/paint.ts` (new)
  - `packages/core/src/table-sheet/shape.ts` (new)
  - `packages/core/src/table-sheet/shape.test.ts` (new)
  - `impl-plans/progress/tsh-01b-layout.md`
  - `tmp/tsh-s780/tsh-01b-layout`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan builds the single geometry source shared by the canvas (tsh-03),
SVG export (tsh-02), hit testing and resize (tsh-04c): bounds, a pure
layout, the paint constants, and the `ShapeUtil` with the 3x3 default.
Parity between canvas and export depends on both sides reading only
`tableSheetLayout`.

## Non-goals

- No SVG markup, no Solid code, and no edits or coercion.
- Do not register the util in `shapes/index.ts`. tsh-08 does that.
- Do not touch `index.ts` files. tsh-01a owns the barrel.

## File-level changes

1. `layout.ts`
   - Constants as pinned: header 32, default row 28, padding 8, font 12.
     Do NOT define `TABLE_SHEET_DEFAULT_COLUMN_WIDTH`. It belongs to
     tsh-01d `columns.ts`, and the barrel would collide.
   - `readTableSheet(semantic)`: a defensive read that never throws.
     - Imitate `packages/ui-solid/src/shapes/ErdTableView.tsx:semanticOf`.
     - Drop malformed columns and rows.
     - Use `Object.hasOwn` for cell keys.
     - Return `{columns: [], rows: []}` for garbage input.
   - `tableSheetBounds(visual, semantic)`: imitate
     `packages/core/src/shapes/erdTable.ts:erdTableBounds`.
     - The width is the sum of the column widths.
     - The height is `(headerRow !== false ? 32 : 0)` plus the sum of
       `height ?? 28` over the rows.
     - With zero rows and `headerRow: false`, the height is 28.
     - Stored `visual.width`/`visual.height` are ignored.
   - `tableSheetLayout(element)`: page coordinates from `visual.x/y`.
     - Columns accumulate x. Rows accumulate y below the header.
     - `cells` holds every row x column, row-major.
     - Default alignment: number right, checkbox center, otherwise left.
       Cell `align` overrides column `align`, which overrides the default.
     - `striped`: odd row index when `semantic.striped === true`.
     - `kind` and `display`:
       - absent value: `empty`, with display `""`
       - checkbox: `checkbox`, with `checked` and display `""`
       - select: `pill`, with
         `pill = TABLE_SHEET_PAINT.pillPalette[options.indexOf(v) % 8]`
         and display equal to the option
       - number: `text`, with display `String(n)`
       - text: `text`, with display equal to the text after each `\r\n`,
         `\n` or `\r` becomes one space
       - date: `text`, with display equal to the stored ISO date
     - `header` is empty when `headerRow === false`. Header cell text is the
       column name, and its align is the column alignment.
   - `fitCellText(text, maxWidth, fontSize)`:
     - If the text fits, return it unchanged.
     - Otherwise drop whole graphemes (`graphemes` from `../text-layout.ts`)
       and append `…` until it fits. Measure with `wideAwareTextWidth` from
       `../wide-text-width.ts`. Read its signature first.
     - Never return a string wider than `maxWidth`, unless it is the lone
       `…`.
2. `paint.ts`: `TABLE_SHEET_PAINT`.
   - `stripeFill` is a fixed translucent ink hex with alpha.
   - The 8 `pillPalette` pairs are fixed hex values with text contrast of at
     least 4.5:1.
   - No theme input (appearance invariant, design section 1).
3. `shape.ts`:
   - `tableSheetShapeUtil`: `type "table.sheet"`, `canResize: false`, no
     `resize`. `getBounds` uses `tableSheetBounds`. `hitTest` uses
     `boxContains` from `../geometry.ts` on the bounds. `defaultVisual()`
     returns `{x:0, y:0}`. `defaultSemantic()` returns
     `defaultTableSheetSemantic()`.
   - `defaultTableSheetSemantic()`:
     - columns `{id:"c1",name:"Name",type:"text",width:160}`,
       `{id:"c2",name:"Status",type:"select",width:120,options:["Todo","Doing","Done"]}`
       and `{id:"c3",name:"Done",type:"checkbox",width:80}`
     - rows r1..r3, each with `cells: {}`
     - Return a fresh object on each call.

## Pitfalls

- Import IR types and values from `@nodetto/ir`. Import core helpers by
  relative path.
- Treat `visual.x`/`y` as 0 when absent.
- Do not use `Intl` or `toLocaleString` for numbers.

## Tests (input -> expected)

- `layout.test.ts`:
  - default 3x3 bounds -> `{x:0, y:0, width:360, height:116}`
  - `headerRow:false` -> height 84; no rows and no header -> 28; one row
    with height 40 is counted as 40
  - a cell layout box equals the column x/width and row y/height; the first
    body row y is 32
  - number defaults to right, checkbox to center, and a cell align override
    wins
  - `"alpha\nbeta"` displays as `"alpha beta"`; `"a\r\nb"` as `"a b"`
  - pill color index is stable for `Doing` (index 1)
  - with `striped:true`, the striped flag is set on rows 1 and 3 only
  - `fitCellText("abcdefghij", 30, 12)` ends with `…` and its width is at
    most 30; `fitCellText("ab", 100, 12)` returns `"ab"`
  - `readTableSheet(null)` and `readTableSheet({columns:"x"})` -> empty and
    no throw
- `shape.test.ts`:
  - `getBounds` equals `tableSheetBounds`; a stored `visual.width: 999` is
    ignored
  - `hitTest` is inside at (10,10) and outside at (400,10)
  - `canResize` is false
  - the default ids are c1..c3 and r1..r3; two calls return distinct
    objects

## Verification (exits 0 and shows at least 1 test with 0 failures; log under `tmp/tsh-s780/tsh-01b-layout/final/`)

1. `bun test ./packages/core/src/table-sheet/layout.test.ts ./packages/core/src/table-sheet/shape.test.ts` -> `layout.log`

Static checks (tsh-00):
`bunx biome check packages/core/src/table-sheet/layout.ts packages/core/src/table-sheet/layout.test.ts packages/core/src/table-sheet/paint.ts packages/core/src/table-sheet/shape.ts packages/core/src/table-sheet/shape.test.ts --diagnostic-level=warn`,
then `bun run typecheck`. Errors confined to sibling wave-1 files or the
barrel are recorded, not fixed.

## Done criteria

- All five files exist and export the pinned names.
- Verification 1 exited 0 with at least 10 tests.
- No file outside writePaths was changed. The progress log is complete.
