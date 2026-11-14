# pcb-svg-01-core-view-model

- planId: pcb-svg-01-core-view-model
- planPath: impl-plans/active/pcb-svg-01-core-view-model.md
- wave: 1; dependsOn: none
- design: design-docs/specs/design-pcb-svg-export.md sections 3, 6, 9, 11
  (rollout step 1); user QA design-docs/user-qa/pcb-svg-export.md Q3
- progress log: impl-plans/progress/pcb-svg-01-core-view-model.md
- scratch and logs: tmp/pcb-svg-s538/pcb-svg-01-core-view-model/
  (git-ignored)

## Intent

The PCB exporter must use the same geometry and colour code as the desktop
canvas. Move the pure PCB view model and the layer colour table from
`packages/ui-solid` into `packages/core`, so that `packages/core/src/svg-export`
(plan pcb-svg-03) can call it. The canvas output must stay exactly the same.
This plan pins the contract used by plan pcb-svg-03.

## Repository context

- Source to move: `packages/ui-solid/src/shapes/pcb-view.ts` (359 lines):
  `PcbViewPath`, `PcbViewCircle`, `PcbViewPrimitive`, `PCB_LAYER_COLORS`,
  `PCB_HOLES_COLOR`, `pcbLayerColor`, private helpers `page`, `path`,
  `outlinePath`, `boardPoint`, `graphicPaths`, `padPaths`, and
  `pcbViewModel(element, hidden)`.
- `packages/ui-solid/src/pcb-state.ts:isPcbLayerHidden` (lines 82-90): pure,
  moves to core with the same body. `isPcbElementShown` in the same file
  keeps calling it.
- Users that must keep compiling without edits:
  `packages/ui-solid/src/shapes/PcbShapeView.tsx` (`pcbViewModel`),
  `packages/ui-solid/src/pcb-overlay.ts` (`pcbViewModel`, `PcbViewPrimitive`),
  `packages/ui-solid/src/PcbLayersPanel.tsx` (`pcbLayerColor`),
  `packages/ui-solid/src/shapes/pcb-view.test.ts`.
- Barrel to extend: `packages/core/src/pcb-board/index.ts` (explicit named
  exports, no `export *`; imitate its existing `geometry.ts` block).
  `packages/core/src/index.ts:364` already has
  `export * from "./pcb-board/index.ts"`; do not edit `index.ts`.
- Inside core, import geometry from the sibling modules, not from
  `@nodetto/core`: `./geometry.ts` (`arcCenter`, `arcIsClockwise`,
  `footprintToBoard`, `padCopperOutline`, `padPrimitiveOutlines`, type
  `PcbOutline`) and `../pcb/font.ts` (`strokeTextBlock`). `@nodetto/ir`
  imports (`PCB_PAGE_SCALE`, `pcbRotate`, the semantic types) stay as is.

## Contract (other plans rely on this exactly)

New file `packages/core/src/pcb-board/view.ts` exporting:

- types `PcbViewPath`, `PcbViewCircle`, `PcbViewPrimitive` (same fields as
  today: path `{kind:"path", d, stroke, width, fill, layer}`, circle
  `{kind:"circle", cx, cy, r, stroke, width, fill, layer}`)
- `PCB_LAYER_COLORS`, `PCB_HOLES_COLOR` (`"#202020"`), `pcbLayerColor(layer)`
  (same values and fallbacks)
- new `PCB_BOARD_COLOR = "#2f4a3a"` (exported constant, with a one-line
  doc comment: dark board colour behind exported PCB pages; not used by the
  canvas)
- `isPcbLayerHidden(hidden: ReadonlySet<string>, layer: string): boolean`
- `pcbViewModel(element: Element, hidden: ReadonlySet<string> = new Set(),
  num: (value: number) => string = String): readonly PcbViewPrimitive[]`

`num` spells every number that is written into a `d` string. `cx`, `cy`,
`r` and `width` stay raw numbers.

## File-level changes

1. `packages/core/src/pcb-board/view.ts` (new): move the code verbatim,
   then thread `num` through every path-data site. Sites that build `d`
   today and all need `num`:
   - `outlinePath` (circle form and the segment loop, including the arc
     radius and the `page(...).join(" ")` calls). Give it a `num` parameter.
   - `graphicPaths`: text polylines (`${p[0]} ${p[1]}`), line, arc (also
     the radius), arc fallback line, rect/polygon (`transform(pt).join(" ")`).
   - `padPaths`: calls to `outlinePath` and the slot path (all eight
     coordinates and the two radii).
   - `pcbViewModel`: arc track (`start.join(" ")`, radius, `end.join(" ")`),
     polyline track, zone outline and zone fill polygons.
   Pass `num` down as a parameter; do not use module-level mutable state.
   Replace `a.join(" ")` with `` `${num(a[0])} ${num(a[1])}` `` (a small
   private helper such as `xy(point, num)` is fine).
2. `packages/core/src/pcb-board/index.ts`: add one export block from
   `./view.ts` with the names in the contract above.
3. `packages/ui-solid/src/shapes/pcb-view.ts`: replace the whole body with a
   re-export from `@nodetto/core` of `pcbViewModel`, `PCB_LAYER_COLORS`,
   `PCB_HOLES_COLOR`, `pcbLayerColor` and the types `PcbViewPath`,
   `PcbViewCircle`, `PcbViewPrimitive`. Keep the file (imports elsewhere
   point at it).
4. `packages/ui-solid/src/pcb-state.ts`: delete the local `isPcbLayerHidden`
   body, import it from `@nodetto/core`, and re-export it
   (`export { isPcbLayerHidden }` or equivalent) so existing imports keep
   working. Keep its doc comment on the core copy. Do not change anything
   else in this file.
5. `impl-plans/progress/pcb-svg-01-core-view-model.md` (new): progress log.

## Key points and pitfalls

- Canvas output must not change by one byte. `String(n)` equals `${n}` and
  `Array.prototype.join` spelling for every number, including `-0` (`"0"`)
  and exponent forms. So the default `num = String` keeps
  `pcb-view.test.ts` strings such as `"M 50 65 L 50 75"` identical. Do not
  round, `toFixed`, or re-order anything.
- Keep the primitive order, the footprint graphics sort (back side first),
  the via ring colour `#e0c674` with width `1.2`, the zone fill suffix `59`,
  hidden text skip, and the `[]` return for `visual.hidden` and
  `pcb.board`. Keep `Math.hypot` where it is used today (do not "fix" it).
- `packages/core` must not import from `packages/ui-solid`, `solid-js` or
  `@nodetto/core` (self-import). Use relative imports inside core.
- Do not put `view.ts` in `packages/core/src/pcb/`. The boundary test
  `packages/core/src/pcb/boundary.test.ts` forbids imports from outside
  that folder.
- Must typecheck under `noUncheckedIndexedAccess`: keep today's `?? [0, 0]`
  guards on `points[0]`/`points[1]`; any new tuple index must be guarded or
  destructured from a `PcbXY`.
- No regex split. No new loops over all elements.
- Do not edit `PcbShapeView.tsx`, `pcb-overlay.ts`, `PcbLayersPanel.tsx`,
  `pcb-view.test.ts`, `packages/core/src/index.ts` or any svg-export file.

## Tests

No new test file is required; the moved code is covered by the unchanged
ui-solid test. Situations that must hold:

- `pcbViewModel(element)` called through `@nodetto/core` and through
  `packages/ui-solid/src/shapes/pcb-view.ts` -> identical results
  (same function object re-exported).
- Existing `pcb-view.test.ts` cases (scaled tracks and hidden layers, arc
  tracks, offset pad copper and holes, slot paths, zone fills with hidden
  fills, text orientation and mirror) -> pass with no edits.
- Spot check in a scratch script (not committed), saved to the scratch dir:
  `pcbViewModel(trackElement, new Set(), (n) => n.toFixed(1))` -> the `d`
  string uses one decimal everywhere, which proves every site honours `num`.
  Do this for an arc track, a polyline track, a zone with a fill, a
  footprint with a slot pad, a roundrect pad and a text graphic, using
  `test-fixtures/kicad/two-layer.kicad_pcb` via `importKicadPcb` and
  `pcbDocumentFromPlan`. Check that no `d` contains a number with more than
  one decimal. Record the command and its output file in the progress log.

## Verification (each must exit 0; save full logs in the scratch dir)

- `bun test packages/ui-solid/src/shapes/pcb-view.test.ts packages/ui-solid/src/pcb-interaction.test.ts`
  -> all pass, 0 fail.
- `bun test packages/core/src/pcb-board packages/core/src/pcb` -> all pass.
- `bun run typecheck` -> exit 0.
- `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess 2>&1 | grep "error TS" | grep -v "\.test\.ts" | grep -v "apps/desktop/scripts/fixtures"`
  -> no output (the tsc command itself exits 2 because of the 91 baseline
  test errors; that is expected).
- `bunx biome check packages/core/src/pcb-board/view.ts packages/core/src/pcb-board/index.ts packages/ui-solid/src/shapes/pcb-view.ts packages/ui-solid/src/pcb-state.ts`
  -> no errors.
- `git diff --exit-code packages/ui-solid/src/shapes/pcb-view.test.ts packages/ui-solid/src/shapes/PcbShapeView.tsx packages/ui-solid/src/pcb-overlay.ts packages/ui-solid/src/PcbLayersPanel.tsx packages/core/src/index.ts`
  -> exit 0 (untouched).
- `grep -n "ui-solid\|solid-js\|@nodetto/core" packages/core/src/pcb-board/view.ts`
  -> no output.

## Done criteria

- `packages/core/src/pcb-board/view.ts` exists and exports every contract
  name; `packages/ui-solid/src/shapes/pcb-view.ts` contains only re-exports.
- `PCB_BOARD_COLOR === "#2f4a3a"`.
- All verification commands meet their expected result, and the progress
  log lists each command, exit code and log path.

## Non-goals

- No SVG export code, no board background, no CLI or docs changes.
- No change to canvas colours, stroke widths or the layer table values.
- Do not add a core test for the view model; do not move
  `pcb-view.test.ts`.

## Worker protocol

- Before each edit, read the file fresh and record its SHA-256 in the
  progress log; after the edit, record the new SHA-256. If a file changed
  since your last read and you did not make the change (drift), stop editing
  it, record the drift in the progress log and continue only on your other
  paths. Reconciliation repairs drift serially.
- Edit only the writePaths of this plan. Write only your own progress log.
- Do not run workspace-wide formatters, do not edit `bun.lock`, and do not
  run git commit, branch, stash or worktree commands.
- Progress log content: status, files changed with pre/post hashes, each
  verification command with exit code and log path, open issues.
