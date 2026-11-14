# PCB Pages in SVG, PNG and PDF Export

Status: design for implementation, revision 1, branch `feat/pcb-svg-export`.
Issue: "Render PCB pages correctly in diagram exports (SVG/PNG/PDF and
nodetto-cli render)" (workflow input only, no GitHub issue number;
execution `opus-luna-design-and-implement-review-loop-session-538`).
Baseline: commit `28c9ded`.

This record extends `design-docs/specs/design-kicad-pcb.md`, which listed
"SVG/PNG export of PCB pages" as out of scope (section 2) and placed the
canvas view model in `packages/ui-solid` (section 6.2). It does not change
any other decision there. `design-docs/specs/export.md` stays the record
for the export pipeline; section 1 below lists where the current code
differs from it, because this design relies on the current code.

Open user decisions, each with a default that this design implements, are
in `design-docs/user-qa/pcb-svg-export.md`.

## 1. Context (facts at `28c9ded`)

- `renderElementsSvg` (`packages/core/src/svg-export/document.ts`) draws
  every non-edge element with a non-null box through `renderShape`
  (`svg-export/shapes.ts`). `renderShape` has no `pcb.*` case, so its
  `default` branch calls `renderUnsupported` (`svg-export/basic-shapes.ts`)
  and draws a dashed box with the text `unsupported: <type>`.
- `pcb.board` has `getBounds() === null` (`packages/core/src/shapes/pcb.ts`),
  so it is skipped before `renderShape` and never drawn, on the canvas or
  in an export. The board outline is drawn by `pcb.graphic` elements and
  footprint graphics on `Edge.Cuts`.
- The canvas draws PCB elements with `PcbShapeView.tsx` over the pure view
  model `pcbViewModel(element, hidden)` in
  `packages/ui-solid/src/shapes/pcb-view.ts`, which also holds
  `PCB_LAYER_COLORS`, `PCB_HOLES_COLOR` and `pcbLayerColor`. It imports only
  `@nodetto/core` geometry (`arcCenter`, `arcIsClockwise`, `footprintToBoard`,
  `padCopperOutline`, `padPrimitiveOutlines`, `strokeTextBlock`),
  `@nodetto/ir` (`PCB_PAGE_SCALE`, `pcbRotate`) and one ui-solid helper,
  `isPcbLayerHidden` (`packages/ui-solid/src/pcb-state.ts`), which is pure.
  Other users: `pcb-overlay.ts` (`pcbViewModel`, `PcbViewPrimitive`) and
  `PcbLayersPanel.tsx` (`pcbLayerColor`).
- The view model writes path data with JavaScript number spelling
  (`${n}`, `Array.join`), for example `M 50 65 L 50 75`;
  `pcb-view.test.ts` asserts such strings.
- The canvas paints no board background. PCB element order on the page
  (design-kicad-pcb section 3.4: board, graphics, zones, tracks bottom to
  top, vias, footprints) is the canvas draw order.
- Every PNG and PDF export is a rasterisation of the `renderPageSvg`,
  `renderSelectionSvg` or `renderArtboardSvg` string:
  - Desktop: `AssetExportSection.tsx` (opened by `ExportDialog.tsx`) calls
    `rasterExportSnapshot` (`packages/ui-solid/src/raster-export.ts`), which
    calls `Editor.exportPageSvg/exportSelectionSvg/exportArtboardSvg`; PNG is
    rasterised by the webview and PDF embeds that raster
    (`packages/ui-solid/src/pdf-export.ts`). Background default: transparent
    for SVG and PNG, `#ffffff` for PDF.
  - CLI: `nodetto-cli export <doc> --format svg|png|pdf`
    (`apps/cli/src/export-command.ts`) calls the same `Editor` methods; PNG
    is rasterised with `@resvg/resvg-js`, PDF wraps that PNG. Background
    default: `null` for SVG, `#ffffff` for PNG and PDF; `--background
    <#rrggbb>|transparent` overrides it.
  - There is no `nodetto-cli render` command; "render" in the request means
    `nodetto-cli export`.
  So a correct SVG fixes all three formats in both hosts.
- `@nodetto/core` re-exports `pcb-board/index.ts` from `index.ts`. The
  `packages/core/src/pcb/` boundary test does not cover `pcb-board/`.
- Under `tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess` the
  baseline has 91 errors, all in test files and
  `apps/desktop/scripts/fixtures`; non-test sources are clean.

## 2. Scope

In scope:

1. Move the pure PCB view model and the layer colour table from
   `packages/ui-solid` into `packages/core`, unchanged in output for the
   canvas (section 3).
2. A PCB renderer in `packages/core/src/svg-export/` that serialises that
   model, and its dispatch from `renderShape` (section 4).
3. A dark board background behind PCB content in exports (section 5).
4. Tests, CLI coverage including native parity, and docs (sections 7, 8).

Out of scope: a new canvas board background or any change to canvas
appearance, following the canvas's transient layer visibility in exports
(user QA Q2), new export options or CLI flags, changes to non-PCB SVG
bytes, the Gerber exporter, the stale parts of `export.md`, version bumps.

## 3. Shared view model (`packages/core/src/pcb-board/view.ts`)

New module, a move of `packages/ui-solid/src/shapes/pcb-view.ts` with two
changes only:

- `isPcbLayerHidden(hidden, layer)` moves with it from
  `packages/ui-solid/src/pcb-state.ts` (same body).
- `pcbViewModel(element, hidden = new Set(), num = String)`: the new third
  parameter `num: (value: number) => string` spells every number written
  into a `d` string. Every `${n}` and `point.join(" ")` in path data
  becomes `num(n)` / `` `${num(x)} ${num(y)}` ``. With the default `String`
  the strings are identical to today's (`String(n)` equals `${n}` and
  `Array.join` spelling, including `-0` as `0`). Numeric fields (`cx`,
  `cy`, `r`, `width`) stay raw numbers.

Everything else is moved verbatim: primitive types (`PcbViewPath`,
`PcbViewCircle`, `PcbViewPrimitive`), `PCB_LAYER_COLORS`, `PCB_HOLES_COLOR`,
`pcbLayerColor`, the per-type geometry, the footprint graphics sort
(back side first), pad copper for each copper layer, slot and round holes
at the anchor `A`, the via ring `#e0c674` and hole, zone outline and
translucent fills (`<colour>59`), hidden text skipped, `visual.hidden` and
`pcb.board` giving `[]`. One new constant joins the table:
`PCB_BOARD_COLOR` (section 5).

Exports: `pcb-board/index.ts` adds `pcbViewModel`, `isPcbLayerHidden`,
`PCB_LAYER_COLORS`, `PCB_HOLES_COLOR`, `PCB_BOARD_COLOR`, `pcbLayerColor`
and the three primitive types; `packages/core/src/index.ts` already
re-exports the barrel. No name in that list exists in core today.

`packages/ui-solid` adapters, so existing imports keep compiling and the
canvas output does not change:

- `shapes/pcb-view.ts` becomes a re-export of the moved names from
  `@nodetto/core`.
- `pcb-state.ts` imports `isPcbLayerHidden` from `@nodetto/core` and
  re-exports it; `isPcbElementShown` keeps using it.
- `PcbShapeView.tsx`, `pcb-overlay.ts`, `PcbLayersPanel.tsx` and
  `shapes/pcb-view.test.ts` are not edited.

`packages/core` must not import from `packages/ui-solid` or Solid; the
hidden-layer set is a parameter, as today.

## 4. SVG renderer (`packages/core/src/svg-export/pcb-shapes.ts`)

`renderPcbShape(element: Element): string`:

- Calls `pcbViewModel(element, new Set(), fmt)` (`fmt` from
  `svg-export/markup.ts`: two decimals, no trailing zeros, no `-0`). Page
  units are 0.1 mm, so path data keeps 0.001 mm and the spelling is the
  same in Bun and in the Boa-based native CLI.
- Emits one tag per primitive, in model order, through `tag()`:
  - path: `d`, `stroke`, `stroke-width` (= `width`), `fill`,
    `stroke-linecap="round"`, `stroke-linejoin="round"`;
  - circle: `cx`, `cy`, `r`, `stroke`, `stroke-width`, `fill`.
  Attribute order is exactly as listed.
- A `fill` of the form `#rrggbbaa` (zone fills) is written as
  `fill="#rrggbb"` plus `fill-opacity` = `fmt(parseInt(aa, 16) / 255)`
  (`0.35` for `59`), placed directly after `fill`, because 8-digit hex is
  not SVG 1.1 and the file is a standalone artefact. String slicing only.
- `vector-effect` is not written (section 9).
- Returns `""` for `pcb.board` and when the model is empty.

Dispatch: `renderShape` checks `isPcbElementType(element.type)` (from
`@nodetto/ir`) before the `switch`, as it does for breadboard and BPMN, and
returns `renderPcbShape(element)`. `renderUnsupported` and
`basic-shapes.ts` are not changed; unknown types still get the placeholder.

Each PCB element keeps the standard `elementGroup` wrapper
(`<g data-id data-type>`); PCB elements never carry `visual.rotation`, so
no transform is added. Coordinates are absolute page units, the same space
the canvas view box uses, so the box argument is not needed.

Stacking: PCB elements are category `node`, so they go into the `shapes`
layer in page order, which equals the canvas order. No re-sorting.

## 5. Board background (`svg-export/document.ts`)

- `renderElementsSvg` collects the `visible` box of every rendered element
  whose type satisfies `isPcbElementType`. When that list is non-empty it
  emits one
  `<rect data-layer="pcb-board" x y width height fill="<PCB_BOARD_COLOR>" />`
  over `unionBoxes(list)`, placed right after the page background rect
  (or where it would be) and before the backdrops, connectors and shapes
  layers. Values are spelled with `fmt` via `tag()`.
- The union of the PCB element boxes covers the Edge.Cuts outline (its
  graphics are elements) and anything drawn outside it, so every PCB
  primitive sits on the dark board.
- The page background is unchanged: `options.background` (or each
  caller's default) still paints the whole view box, padding included,
  below the board rect; `null` still means transparent. So an explicit
  background is honoured outside the board, and the board area is dark
  in every export (user QA Q1 records this reading).
- `PCB_BOARD_COLOR = "#2f4a3a"`, a dark green: darker than every layer
  colour in the table and lighter than `PCB_HOLES_COLOR` (`#202020`), so
  non-plated holes with no copper stay visible (user QA Q3).
- With no rendered PCB element nothing is added, so non-PCB output is
  byte-identical.

Selection and artboard exports follow the same rule over the elements they
render; an artboard viewport clips the rect as it clips everything else.

## 6. Behaviour rules

- All layers are drawn in exports; the canvas's per-page hidden-layer set
  is transient UI state, not in the IR, and is not consulted (user QA Q2).
- `visual.hidden` elements, hidden ancestors and mask sources are skipped
  by `renderElementsSvg` as for every element type.
- Footprint and board texts with `hidden: true` are not drawn (shared
  model).
- PCB text is stroked paths, so PCB exports add no `<text>` and need no
  fonts.
- Output is deterministic: same document and options give the same bytes;
  the model is linear in the number of points and uses no regular
  expression split.

## 7. Tests

| Acceptance criterion | Test |
| --- | --- |
| Fixture page renders every element kind, no placeholder | `packages/core/src/svg-export/pcb-shapes.test.ts` (new): import `test-fixtures/kicad/two-layer.kicad_pcb` with `importKicadPcb` and build the page as `pcb-board/fixture.test.ts` does; `renderPageSvg` output has no `unsupported:`; it contains `data-type` groups for `pcb.track`, `pcb.via`, `pcb.zone`, `pcb.footprint`, `pcb.graphic`; F.Cu (`#c83434`) and B.Cu (`#3466c8`) track paths; an arc track path with ` A `; pad copper with fill `#c83434`; via ring `stroke="#e0c674"` and hole circle `fill="#202020"`; the zone fill `fill="#3466c8" fill-opacity="0.35"`; silkscreen text strokes `stroke="#f2eecb"`; Edge.Cuts outline `stroke="#d0d0d0"` |
| One geometry for canvas and export | same file: for each PCB element, the number of tags in its group equals `pcbViewModel(element).length`, and the first path `d` equals the model's `d` built with `fmt` |
| Board background | same file: the `pcb-board` rect precedes the shapes layer with fill `PCB_BOARD_COLOR` and equals the union of the PCB element boxes; with `background: "#ffffff"` the page rect is written first with that fill and the board rect follows; with `background: null` only the board rect is written |
| Hidden text and hidden elements | same file, inline elements: a footprint text with `hidden: true` adds no path; a `visual.hidden` track adds no group |
| Determinism | same file: two renders are byte-equal |
| Canvas unchanged | `packages/ui-solid/src/shapes/pcb-view.test.ts` unchanged and passing; `packages/ui-solid/src/pcb-interaction.test.ts` passing |
| Non-PCB goldens unchanged | `packages/core/src/svg-export.test.ts`, `packages/core/src/breadboard/export-golden.test.ts`, `packages/core/src/bpmn/svg-export-*.test.ts` pass with no edits |
| CLI SVG, PNG, PDF | `apps/cli/src/pcb-commands.test.ts`: on the imported fixture document, `export --format svg` stdout has the `pcb-board` rect and no `unsupported:`; `--format png` and `--format pdf` with a capturing `RasterBackend` hand it an SVG with `data-type="pcb.track"`; the real raster backend writes a file starting with the PNG signature and one starting with `%PDF-` (as `export-command.test.ts` does for ERD) |
| Native parity | `apps/cli/src/native-parity.test.ts` "native pcb import and gerber match the TypeScript CLI": add `export board.jsonl --format svg` and compare stdout bytes |

Desktop PNG/PDF use the same `Editor` export methods as the CLI (section
1), so no separate desktop test is added; the implementation report states
this trace.

## 8. Docs

- `docs/pcb/kicad-pcb.md`: a section "SVG, PNG and PDF export": PCB pages
  export as drawn on the canvas with all layers shown, on a dark board
  background; the chosen background colour fills the margin; hidden texts
  are left out; CLI example `nodetto-cli export board.jsonl --format svg
  --output board.svg`.
- `docs/cli.md`, section "PCB boards (KiCad)": the same example line.
- `README.md`, "PCB boards" feature bullet: add "and export the board as
  SVG, PNG or PDF".
- `design-docs/specs/design-kicad-pcb.md` section 2: the out-of-scope item
  points to this record.

## 9. Intentional divergences

- The canvas uses `vector-effect="non-scaling-stroke"`, so line widths stay
  constant in screen pixels while zooming. Exports use page-unit widths,
  equal to the canvas at zoom 1 and scaling with PNG scale like the board
  itself.
- The canvas paints no board background; exports add the dark board rect
  (section 5).
- Export path data uses two-decimal spelling; the canvas keeps JavaScript
  spelling. Both come from the same geometry code.
- Exports ignore the canvas's transient layer visibility.

## 10. Verification

- `bun test packages/core/src/svg-export.test.ts packages/core/src/svg-export/pcb-shapes.test.ts`
- `bun test packages/ui-solid/src/shapes/pcb-view.test.ts`
- `bun test packages/core/src/breadboard/export-golden.test.ts packages/core/src/bpmn apps/cli/src/pcb-commands.test.ts`
- `bun run typecheck`
- `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess`: no
  error in any non-test file and none in files this change adds or edits
  (baseline: 91 errors, all in test files and `apps/desktop/scripts/fixtures`)
- `CARGO_TERM_QUIET=true BUN_OPTIONS=--jsx-runtime=classic mise run verify`
- `CARGO_TERM_QUIET=true mise run test-cli`

## 11. Rollout constraints and risks

- Order: (1) move the model to core and turn the ui-solid files into
  adapters, run `pcb-view.test.ts`; (2) renderer, dispatch and board rect
  with core tests and the golden suites; (3) CLI tests and native parity;
  (4) docs.
- Canvas drift from the move (medium): mitigated by moving code verbatim,
  the `String` default for `num`, and the unchanged `pcb-view.test.ts`.
- Golden drift (medium): `document.ts` changes are confined to the board
  rect, emitted only when a PCB element rendered; golden suites run
  unedited.
- Parallel run `feat/canvas-theme` (worktree
  `/Users/taco/gits/tacogips/nodetto-app-canvas-theme`) owns the app theme
  and canvas background; this run owns `pcb-view.ts`, the PCB colour table
  and the board rect. A conflict is possible only if that run edits
  `svg-export/document.ts` around the background rect (low).
- Footprint bounds approximate stroke-text extents
  (`packages/core/src/shapes/pcb.ts`); text that pokes out of its
  footprint box could sit partly outside the board rect or the view box
  (low, same bounds the canvas uses for selection).
- Boa numeric differences in `Math.hypot`/trigonometry vanish under
  two-decimal spelling except at an exact rounding boundary; the parity
  fixture uses multiples of 45 degrees (low).
- `gitPush` is false; the run commits locally only.
