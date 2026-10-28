# pcb-svg-03-svg-renderer

- planId: pcb-svg-03-svg-renderer
- planPath: impl-plans/active/pcb-svg-03-svg-renderer.md
- wave: 2; dependsOn: pcb-svg-01-core-view-model
- design: design-docs/specs/design-pcb-svg-export.md sections 4, 5, 6, 7
  (rows "Fixture page renders every element kind", "One geometry",
  "Board background", "Hidden text and hidden elements", "Determinism",
  "Non-PCB goldens unchanged"), 9, 11
- progress log: impl-plans/progress/pcb-svg-03-svg-renderer.md
- scratch and logs: tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/ (git-ignored)

## Intent

`renderPageSvg`, `renderSelectionSvg` and `renderArtboardSvg` currently draw
every `pcb.*` element as an `unsupported: <type>` placeholder. Render them
with the shared view model from plan pcb-svg-01 and paint a dark board
rectangle behind the PCB content. Every SVG, PNG and PDF export path (desktop
and CLI) consumes these strings, so this one change fixes all formats.
Non-PCB output must stay byte-identical.

## Repository context

- Contract from plan pcb-svg-01 (already merged when this starts):
  `pcbViewModel(element, hidden = new Set(), num = String)`,
  `PCB_BOARD_COLOR` (`"#2f4a3a"`), types `PcbViewPrimitive`, all in
  `packages/core/src/pcb-board/view.ts`. Import them relatively
  (`../pcb-board/view.ts`), not from `@nodetto/core`.
- `packages/core/src/svg-export/shapes.ts:renderShape`: checks
  `isBreadboardElementType` and `isBpmnShapeType` before the `switch`; the
  `default` case calls `renderUnsupported`. Add the PCB check in the same
  place.
- `packages/core/src/svg-export/markup.ts`: `fmt` (two decimals, no `-0`),
  `tag(name, attrs)` (numbers spelled with `fmt`, `undefined` attributes
  skipped, attributes in insertion order).
- `packages/core/src/svg-export/notation.ts:renderBreadboardShape` and
  `renderNotationPrimitive`: an example of turning model primitives into
  tags.
- `packages/core/src/svg-export/document.ts:renderElementsSvg`: the loop
  computes `visible` per element and pushes it to `boxes` (lines 269-271).
  The final body array (lines 459-476) writes defs, then the background
  rect (only when `background !== null`), then the backdrops, connectors and
  shapes layers. `unionBoxes` is already imported from `../geometry.ts`.
- `isPcbElementType` is exported by `@nodetto/ir` (`packages/ir/src/pcb.ts:160`).
- Fixture loading in a core test: imitate
  `packages/core/src/pcb-board/fixture.test.ts` (reads
  `test-fixtures/kicad/two-layer.kicad_pcb` with `resolve(import.meta.dir,
  ...)`, `importKicadPcb` from `@nodetto/io`, `pcbDocumentFromPlan`, then
  `new Editor({ document })`). `@nodetto/io` is a core devDependency.

## File-level changes

1. `packages/core/src/svg-export/pcb-shapes.ts` (new):
   `export function renderPcbShape(element: Element): string`.
   - Calls `pcbViewModel(element, new Set(), fmt)`.
   - Path primitive -> `tag("path", ...)` with attributes in exactly this
     order: `d`, `stroke`, `stroke-width` (from `width`), `fill`, then
     `fill-opacity` only for 8-digit fills (below), then
     `stroke-linecap: "round"`, `stroke-linejoin: "round"`.
   - Circle primitive -> `tag("circle", ...)`: `cx`, `cy`, `r`, `stroke`,
     `stroke-width`, `fill`, then `fill-opacity` only for 8-digit fills.
   - 8-digit fill: when `fill` starts with `#` and has length 9, write
     `fill = fill.slice(0, 7)` and
     `fill-opacity = fmt(Number.parseInt(fill.slice(7), 16) / 255)`
     (`"59"` -> `0.35`). Any other fill is written unchanged with no
     `fill-opacity` attribute (pass `undefined` so `tag` skips it).
   - Concatenate the tags in model order with `""` as the separator; return
     `""` for an empty model (`pcb.board`, hidden element, all-hidden text).
   - Do not write `vector-effect`, `data-*` attributes or a wrapping group;
     `elementGroup` in `document.ts` already wraps every element.
2. `packages/core/src/svg-export/shapes.ts`: import `isPcbElementType` from
   `@nodetto/ir` (add to the existing import) and `renderPcbShape` from
   `./pcb-shapes.ts`; add
   `if (isPcbElementType(element.type)) return renderPcbShape(element);`
   right after the BPMN check and before the `switch`. No other change.
3. `packages/core/src/svg-export/document.ts`, `renderElementsSvg` only:
   - Declare `const pcbBoxes: Box[] = []` next to `boxes`.
   - In the loop, where `visible` is pushed to `boxes`, also push it to
     `pcbBoxes` when `isPcbElementType(element.type)` and the element went
     down the non-edge branch (it was rendered). Import `isPcbElementType`
     from `@nodetto/ir` (existing import block) and `PCB_BOARD_COLOR` from
     `../pcb-board/view.ts`.
   - After the loop, `const board = unionBoxes(pcbBoxes)`.
   - In the body array, insert one item immediately after the page
     background item:
     `board === null ? "" : tag("rect", { "data-layer": "pcb-board", x: board.x, y: board.y, width: board.width, height: board.height, fill: PCB_BOARD_COLOR })`.
     The existing `.filter((part) => part !== "")` removes it when empty.
   - Change nothing else (no change to bounds, padding, viewBox, the page
     background rect, layer order or the root attributes).
4. `packages/core/src/svg-export/pcb-shapes.test.ts` (new), see Tests.
5. `impl-plans/progress/pcb-svg-03-svg-renderer.md` (new): progress log.

## Key points and pitfalls

- Non-PCB bytes must not change. The board rect must be `""` whenever no
  PCB element rendered. Do not touch `basic-shapes.ts`, `theme.ts`,
  `paint.ts`, `markup.ts`, `connectors.ts` or any golden test or fixture.
  `renderUnsupported` stays for unknown types (the test in
  `packages/core/src/svg-export.test.ts:487` expects it for
  `future.widget`).
- The board rect goes before the backdrops/connectors/shapes layers and
  after the page background rect, so an explicit background fills the
  whole view box and the board is drawn over it. Do not replace or skip
  the page background rect, and do not change `options.background`
  defaults.
- Use `visible` (already clipped and rotated) for `pcbBoxes`, not the raw
  `box`; skip elements that `continue` before rendering (hidden, clipped
  out, null box).
- PCB elements stay in the `shapes` layer in page order. Do not sort them by
  layer.
- `pcb.board` has a null box and is skipped before `renderShape`; that is
  expected, it contributes no box.
- No regex split; `parseInt` on a two-character slice is fine. Strict
  `noUncheckedIndexedAccess`: guard any array index.
- Do not import `@nodetto/core` from inside `packages/core`.
- Do not edit `packages/ui-solid` or `apps/*` files.

## Tests (`packages/core/src/svg-export/pcb-shapes.test.ts`)

Build the fixture document once (as in `pcb-board/fixture.test.ts`) and
render with `editor.exportPageSvg({ padding: 16, background: null })` or
`renderPageSvg(editor.store, editor.registry, pageId, ...)`.

- fixture page -> SVG has no `unsupported:`.
- fixture page -> contains `data-type="pcb.track"`, `data-type="pcb.via"`,
  `data-type="pcb.zone"`, `data-type="pcb.footprint"`,
  `data-type="pcb.graphic"`.
- F.Cu track group -> a path with `stroke="#c83434"`; B.Cu track group ->
  `stroke="#3466c8"`.
- the arc track (fixture line 91, F.Cu, start 23 10, end 29.25 10) -> its
  path `d` starts with `M 230 100 A ` and ends with `292.5 100`.
- footprint groups -> at least one pad path or circle with
  `fill="#c83434"`.
- via groups -> a circle with `stroke="#e0c674"` and a circle with
  `fill="#202020"`.
- zone group -> a path with `fill="#3466c8" fill-opacity="0.35"`; no
  `fill` attribute value in the whole SVG has 9 characters (`#rrggbbaa`).
- silkscreen -> the `pcb.graphic` group of the `gr_text` "Nodetto" has
  paths with `stroke="#f2eecb"`; footprint groups also contain
  `stroke="#f2eecb"` paths.
- Edge.Cuts -> at least one `pcb.graphic` group with `stroke="#d0d0d0"`.
- one geometry: for every PCB element except `pcb.board`, the number of
  `<path`/`<circle` tags inside its `<g data-id="<id>"` group equals
  `pcbViewModel(element).length`, and every path `d` equals the `d` of the
  matching primitive from `pcbViewModel(element, new Set(), fmt)` in order
  (import `fmt` from `./markup.ts`). Extract groups by scanning for
  `<g data-id="` and the matching `</g>` (no nesting inside PCB groups);
  no regex split.
- board rect -> exactly one `data-layer="pcb-board"` rect with
  `fill="#2f4a3a"` (use `PCB_BOARD_COLOR`), placed before
  `data-layer="shapes"`; its `x y width height` equal `fmt` of the union of
  `editor.registry.getOrFallback(type).getBounds(element, context)` over
  the fixture's PCB elements (or compare with `unionBoxes` of
  `createShapeContext(...).boundsOf(id)`). `renderElementsSvg` widens a box
  to at least 1 unit per side before use; every fixture PCB box is larger,
  so the plain union matches.
- `background: "#ffffff"` -> the SVG contains a page rect with
  `fill="#ffffff"` before the board rect.
- `background: null` -> no `fill="#ffffff"` rect; the board rect is still
  present.
- selection export of one track (`renderSelectionSvg` with its id) -> one
  board rect equal to that track's box.
- hidden text: an inline footprint (based on a fixture footprint, with a
  `text` graphic set `hidden: true`) -> its group has exactly one tag fewer
  per text stroke than with `hidden: false` (compare counts from
  `pcbViewModel`); simplest: assert the hidden variant's tag count equals
  `pcbViewModel(hiddenVariant).length` and is smaller than the visible
  variant's count.
- hidden element: a track with `visual.hidden: true` -> no group with its
  `data-id`.
- determinism: two renders of the fixture page -> byte-equal strings.
- non-PCB page (one `node.generic` element in a fresh Editor) -> no
  `pcb-board` in the SVG.

## Verification (each must meet the expected result; save full logs in the scratch dir)

- `bun test packages/core/src/svg-export/pcb-shapes.test.ts` -> all pass.
- `bun test packages/core/src/svg-export.test.ts packages/core/src/breadboard/export-golden.test.ts packages/core/src/bpmn/svg-export-bpmn.test.ts packages/core/src/bpmn/svg-export-layers.test.ts packages/core/src/workspace-workflow.test.ts`
  -> all pass with no edits to these files.
- `git diff --exit-code packages/core/src/svg-export.test.ts packages/core/src/breadboard packages/core/src/bpmn packages/core/src/svg-export/basic-shapes.ts packages/core/src/svg-export/markup.ts packages/core/src/svg-export/theme.ts`
  -> exit 0.
- `bun test packages/ui-solid/src/shapes/pcb-view.test.ts` -> all pass.
- `bun run typecheck` -> exit 0.
- `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess 2>&1 | grep "error TS" | grep -E "svg-export/(pcb-shapes|shapes|document)" `
  -> no output (this also covers the new test file).
- `bunx biome check packages/core/src/svg-export/pcb-shapes.ts packages/core/src/svg-export/pcb-shapes.test.ts packages/core/src/svg-export/shapes.ts packages/core/src/svg-export/document.ts`
  -> no errors.

## Done criteria

- `renderShape` routes all six `pcb.*` types to `renderPcbShape`.
- Fixture page SVG has no `unsupported:` and has the `pcb-board` rect.
- All verification commands meet their expected result; the progress log
  records commands, exit codes and log paths.

## Non-goals

- No change to the view model (plan pcb-svg-01 owns it). If a fixture
  assertion fails because of the model, record it in the progress log with
  the failing assertion and stop; reconciliation routes the fix.
- No new `SvgExportOptions` field, no hidden-layer support in exports, no
  CLI or desktop changes, no docs.

## Worker protocol

- Before each edit, read the file fresh and record its SHA-256 in the
  progress log; after the edit, record the new SHA-256. On drift (the file
  changed since your read and not by you), stop editing that file and record
  it.
- Edit only the writePaths of this plan; write only your own progress log;
  no git commit, branch, stash or worktree commands; no workspace-wide
  formatting; do not edit `bun.lock`.
