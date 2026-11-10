# tsh-02-export

- planId: tsh-02-export
- planPath: impl-plans/active/tsh-02-export.md
- progressPath: impl-plans/progress/tsh-02-export.md
- wave: 2
- dependsOn: tsh-01a-ir, tsh-01b-layout
- Design: `design-docs/specs/design-table-sheet.md` sections 4, 5, 12 (SVG assertions).
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`.
- writePaths:
  - `packages/core/src/svg-export/table-sheet.ts` (new)
  - `packages/core/src/svg-export/table-sheet.test.ts` (new)
  - `impl-plans/progress/tsh-02-export.md`
  - `tmp/tsh-s780/tsh-02-export`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan renders a `table.sheet` to SVG markup that matches the canvas.
Geometry comes only from `tableSheetLayout`. PNG and PDF rasterize this
SVG, so this module is the export parity surface. tsh-08 adds the
`case "table.sheet"` to `renderShape`. This plan must not edit
`svg-export/shapes.ts`.

## Non-goals

- No dispatch wiring and no canvas code.
- No theme or appearance input beyond `SvgTheme`.
- No new text measurement.

## File-level changes

`packages/core/src/svg-export/table-sheet.ts`:
`export function renderTableSheet(element: Element, box: Box, theme: SvgTheme): string`.

- Imitate `packages/core/src/svg-export/ui-control.ts:renderUiControl` and
  `structured-shapes.ts:renderErdTable`. Use `tag`, `wrap` and `text` from
  `./markup.ts` (they escape), `styled` from `./paint.ts` for the outer
  rect's visual style, and `fmt` for numbers.
- Get the layout with `tableSheetLayout(element)` from `../table-sheet/index.ts`.
  Use `box.x/y` from the argument only as an offset when it differs from
  `layout.box`. In practice they are equal, so assert that in a test.
- Output structure, in paint order, inside
  `<g class="nodetto-table-sheet" data-nodetto-id=...>`:
  1. Background rect: `visual.style.fill` or `theme.surface`.
  2. Stripe rects (`class="nodetto-table-sheet-stripe"`, fill
     `TABLE_SHEET_PAINT.stripeFill`).
  3. Cell fill rects (`class="nodetto-table-sheet-cell-fill"`).
  4. Header group `class="nodetto-table-sheet-header"`: a rect with
     `theme.accentSoft`, then one bold `<text>` per column
     (`font-weight="700"`), then the header bottom rule in `theme.ink`.
  5. Grid group `class="nodetto-table-sheet-grid"`: 1px lines in
     `theme.line`, between columns and between rows.
  6. Per non-empty cell `<g class="nodetto-table-sheet-cell">` with a
     `clipPath`, clipped to the cell rect:
     - text: `<text>` of `fitCellText(display, width - 16, 12)`.
       `text-anchor` is `start`, `middle` or `end` for left, center or
       right, at x = left + 8, the center, or right - 8. The baseline is
       vertically centered. Bold uses `font-weight="700"`.
     - checkbox: `<rect class="nodetto-table-sheet-checkbox">`, 14x14,
       rx 3. When checked, fill `theme.accent` plus a white check `<path>`.
       Otherwise stroke `theme.ink` with no fill.
     - pill: `<rect class="nodetto-table-sheet-pill">`, height 18, rx 9,
       fill `pill.fill`, plus `<text>` fill `pill.text`.
  7. Outer border rect: stroke from `visual.style.stroke` or `theme.ink`,
     width 1.5, no fill. Apply `opacity` through `styled`.
- clipPath ids must be deterministic and unique per document. Use
  `nodetto-ts-<elementId>-<rowIndex>-<colIndex>`, made safe through the
  existing id/attribute helpers. Look for the clip id pattern used in
  `svg-export/` first (for example `grep -n clipPath packages/core/src/svg-export/*.ts`)
  and reuse it.
- Use the font family and size from `theme.fontFamily` and
  `TABLE_SHEET_FONT_SIZE` (12).

## Pitfalls

- Never use `layout.display` without `fitCellText`. Never read stored text
  for display: newlines must render as spaces.
- Do not import from `packages/ui-solid` or anything that reads appearance
  state.
- Keep the output deterministic: no `Math.random` and no Map iteration over
  insertion-varying keys.

## Tests (`table-sheet.test.ts`, input -> expected)

Build elements by hand with `Element` literals and use `DEFAULT_SVG_THEME`.

- A 3-col table (text, number, checkbox, plus a select column) with
  header -> one header `<text>` per column with each name and
  `font-weight="700"`, and a header rect with fill `#dbe6e8`.
- Grid -> a line count equal to (columns - 1) + rows, or the documented
  internal-line count. Assert the exact count chosen.
- `striped:true` with 4 rows -> exactly 2 `nodetto-table-sheet-stripe` rects.
- Number cell 42 -> `<text` containing `text-anchor="end"` and `>42<`.
- Checkbox true -> a checkbox rect with accent fill and a check `<path`.
  False -> no path for that cell.
- Select `Doing` -> a pill rect with the palette fill for index 1, and
  text `Doing`.
- Text `"alpha\nbeta"` -> rendered text `alpha beta` with no newline in the
  output.
- A long text in a 40px column -> the rendered text ends with the ellipsis.
- A cell with `fill:"#ffeeaa"` -> a cell-fill rect with that fill. With
  `bold:true` -> `font-weight="700"`.
- `headerRow:false` -> no `nodetto-table-sheet-header` group.
- Geometry parity: for each `layout.cells` entry, the clip rect x, y,
  width and height equal the layout values (formatted with `fmt`).
- XML escaping: a cell text `a<b&c` appears escaped.

## Verification (exit 0; test commands show at least 1 test, 0 fail)

1. `bun test ./packages/core/src/svg-export/table-sheet.test.ts` -> `export.log`
2. `bun test ./packages/core/src/svg-export.test.ts` -> `svg-regression.log` (the existing export tests are unchanged)
Static checks (tsh-00; must exit 0, but they are not test commands):
`bun run typecheck` -> `typecheck.log`, and `bunx biome check packages/core/src/svg-export/table-sheet.ts packages/core/src/svg-export/table-sheet.test.ts --diagnostic-level=warn` -> `biome.log`

## Done criteria

- `renderTableSheet` is exported with the pinned signature.
- Verifications 1-4 exited 0, with logs under `tmp/tsh-s780/tsh-02-export/final/`.
- `svg-export/shapes.ts` is untouched by this plan, and the progress log is
  complete.
