# kicad-pcb-11-ui-canvas

- planId: kicad-pcb-11-ui-canvas
- planPath: impl-plans/completed/kicad-pcb-11-ui-canvas.md
- wave: 4; dependsOn: kicad-pcb-09-core-index-fixture-integration
- design: design-docs/specs/design-kicad-pcb.md sections 6.2, 6.4 (tools,
  hover, layers, R key), 5.1, 5.2, 5.4, 5.5; user QA Q1 (transient layer
  visibility) and Q5 (free track angles)
- progress log: impl-plans/progress/kicad-pcb-11-ui-canvas.md
- protocol: impl-plans/completed/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Draw PCB pages on the canvas and make them editable:

- views for the six element types
- a ratsnest and net-highlight overlay
- a PCB workspace with Track and Via tools and tool options (active
  copper layer, net, track width, via sizes)
- hover net highlight
- the R key rotates footprints
- a layer visibility list
- the desktop page-kind-to-workspace mapping

## Repository context (imitate)

- `packages/ui-solid/src/shapes/BreadboardShapeView.tsx` and
  `shapes/breadboard-view.ts` (pure view model plus a thin component);
  `shapes/ShapeView.tsx` line ~180 (`<Match
  when={isBreadboardElementType(...)}>`).
- `packages/ui-solid/src/BreadboardOverlay.tsx` and `breadboard-overlay.ts`;
  the mount in `Canvas.tsx` line ~1021 (`<Show when={isBreadboardPage()}>`)
  and `isBreadboardPage` (line ~366).
- `packages/ui-solid/src/interaction.ts`:
  - the breadboard wire tool gesture (`breadboard-wire-point`, line ~1960)
  - `breadboardHover` (line ~820)
  - key handling
  - the `beginTranslate` path (line ~1324), which already works through
    `editor.movableSelection` and `editor.moveElements` (plan 05)
- `packages/ui-solid/src/tools.ts` (`Tool.Breadboard*` ids and the list
  at line ~224) and `packages/ui-solid/src/workspaces.ts` (`WorkspaceId`,
  the `breadboard` entry at line ~101).
- `packages/ui-solid/src/breadboard-interaction.test.ts`: interaction test
  style.
- `apps/desktop/src/page-workspace.ts` and `page-workspace.test.ts`.
- Core API from `@nodetto/core` (plan 09 barrel): `padCopperOutline`,
  `padPrimitiveOutlines`, `footprintToBoard`, `shapeBounds`,
  `expandCopperLayers`, `pageCopperLayers`, `viaCopperLayers`,
  `arcCenter`, `arcIsClockwise`, `computePcbConnectivity`,
  `computePcbRatsnest`, `pcbNetHighlight`, `pcbNetNames`,
  `PCB_TRACK_DEFAULT_WIDTH`, `PCB_VIA_DEFAULT`; Editor methods
  `addPcbTrack`, `addPcbVia`, `rotatePcbFootprints`; `strokeText` and
  `strokeTextWidth` (re-exported by the plan 09 barrel). Do not edit
  core.

## Non-goals

- No inspector or Export dialog (plan 12). No core changes. No 45-degree
  constraint (Q5). Layer visibility is not saved in the document (Q1).
- Do not add pcb types to the generic rotation allow-list, and do not
  show resize or rotate handles for pcb elements. Check that the selection
  overlay already hides them because `canResize` is false and
  `canRotateElement` is false. Fix the overlay only if it does not.

## writePaths

- packages/ui-solid/src/shapes/PcbShapeView.tsx (new)
- packages/ui-solid/src/shapes/pcb-view.ts (new)
- packages/ui-solid/src/shapes/pcb-view.test.ts (new)
- packages/ui-solid/src/shapes/ShapeView.tsx
- packages/ui-solid/src/PcbOverlay.tsx (new)
- packages/ui-solid/src/pcb-overlay.ts (new)
- packages/ui-solid/src/pcb-state.ts (new)
- packages/ui-solid/src/PcbLayersPanel.tsx (new)
- packages/ui-solid/src/pcb-interaction.ts (new)
- packages/ui-solid/src/pcb-interaction.test.ts (new)
- packages/ui-solid/src/interaction.ts
- packages/ui-solid/src/Canvas.tsx
- packages/ui-solid/src/tools.ts
- packages/ui-solid/src/workspaces.ts
- packages/ui-solid/src/shape-palette.ts
- apps/desktop/src/page-workspace.ts
- apps/desktop/src/page-workspace.test.ts
- impl-plans/progress/kicad-pcb-11-ui-canvas.md (new)

## sharedPaths

none

## Pinned pieces

- `pcb-state.ts` (transient, module-level, keyed by page id):
  - `pcbHiddenLayers(pageId): ReadonlySet<string>` and
    `setPcbLayerHidden(pageId, layer, hidden)`
  - `pcbToolOptions()` and `setPcbToolOptions(patch)`, with `{layer:
    "F.Cu", net: "", width: PCB_TRACK_DEFAULT_WIDTH, viaDiameter, viaDrill}`
  - `isPcbElementShown(element, hidden): boolean`: false when every layer
    of the element is hidden. A footprint is shown when any of its pad or
    graphic layers is visible.
  - Use Solid signals so views re-render.
- `tools.ts` (imitate the `Tool.BreadboardWire` wiring at tools.ts:49,
  :239, :281 and :488):
  - `Tool.PcbTrack = "pcb:track"` and `Tool.PcbVia = "pcb:via"`
  - `PCB_TOOLS = [Tool.PcbTrack, Tool.PcbVia] as const`, type
    `PcbToolKind`
  - `PCB_CREATIONS: Readonly<Record<PcbToolKind, CreationTool>> =
    {[Tool.PcbTrack]: {type: "pcb.track"}, [Tool.PcbVia]: {type:
    "pcb.via"}}`
  - in `creationFor`, add the `case Tool.PcbTrack: case Tool.PcbVia:
    return PCB_CREATIONS[tool];` branch before `default`, so the
    exhaustive `never` check at tools.ts:745 still compiles
  - `creationFor` must be non-null for both tools: `placeShape`
    (interaction.ts:1443) returns early on null, and
    `workspaces.test.ts:78-83` asserts non-null for every non-connector
    tool of a non-design workspace
- `shape-palette.ts` (imitate `BREADBOARD_SHAPES` at shape-palette.ts:257):
  - `export const PCB_SHAPES: readonly ShapePaletteItem[] = [{tool:
    Tool.PcbTrack, label: "Track", icon: "wire"}, {tool: Tool.PcbVia,
    label: "Via", icon: "ellipse"}]`, reusing existing icon keys (no new
    icons)
  - add `...PCB_SHAPES` to `PALETTE_SHAPES` (line ~381), or
    `workspaceShapes` throws `Missing palette shape`
  - add `pcb: [Tool.PcbTrack, Tool.PcbVia]` to `PRIMARY_TOOLS` (the
    `satisfies Record<WorkspaceId, ...>` at line 379 requires it)
  - in `additionalShapes`, the `pcb` workspace gets `[...PCB_SHAPES,
    ...COMMON_SHAPES]` minus primary tools, like `breadboard`
  - in `shapePaletteGroups`, add a `"PCB"` category for `PCB_SHAPES`
    tools next to the `"Breadboard"` branch (line ~472)
- `workspaces.ts`: `WorkspaceId` gains `"pcb"`; the entry is `{id: "pcb",
  label: "PCB", design: false, shapes: false, tools: [{tool:
  Tool.PcbTrack, label: "Track"}, {tool: Tool.PcbVia, label: "Via"}]}`.
- `page-workspace.ts`: `pcb: "pcb"` in `DEDICATED_WORKSPACES`;
  `pcb: "PCB"` in `DEDICATED_PAGE_NAMES`.
- `pcb-interaction.ts` (pure helpers used by `interaction.ts`):
  - `pcbSnapTarget(document, pageId, pointMm, hidden)`: the pad anchor
    `footprintToBoard(fp, pad.at)` (design 3.2, 6.4), via centre or track
    end under the point, with its net and layer, or `undefined`. "Under
    the point" for a pad means containment in `padCopperOutline` or one of
    `padPrimitiveOutlines`. The returned point is always the anchor, never
    the `padCopperOutline` centre, which is the shape centre `S` for a pad
    with `drill.offset` (plan 07)
  - `pcbTrackDraft` (start, vertices, finish, cancel) producing a
    `PcbTrackInput`; the net comes from the start snap target, otherwise
    the tool options
  - `pcbViaInput(pointMm, snap, options)`
  - Both read `pcbToolOptions()` for the layer, the width and the via
    sizes. `options.net` is used only when the start snap target has no
    net, so a snap net always wins (design 5.4).
- Views (`pcb-view.ts`, pure, page units = mm * 10):
  - SVG path data for pads (from `padCopperOutline`), tracks (round caps,
    stroke width = width * 10, arcs with SVG `A`), vias (ring plus a hole
    disc), zones (outline stroke plus translucent fills), graphics
    (strokes and fills; text via `strokeText` polylines)
  - pad drill holes: every `thru_hole` and `np_thru_hole` pad with a
    `drill` draws a hole in the holes colour on top of its copper, at the
    anchor `A = footprintToBoard(fp, pad.at)`, never at the copper centre.
    It is a disc of `drill.diameter`, or, with `drill.slot`, a capsule of
    diameter `min(slot)` whose end centres are `max(slot) - min(slot)`
    apart along the long axis rotated by `fp.rotation + pad.rotation`
    (`pcbRotate` from `@nodetto/ir`). This is the plan 07 DRL rule, so the
    canvas and the Excellon file agree
  - Text orientation: `strokeText(text, 0, 0, size[1])` returns
    polylines centred on the origin with y pointing UP
    (packages/core/src/pcb/font.ts:467-476). The page frame is y down.
    Apply these steps in this order:
    1. convert each point to (x, -y)
    2. justify (left: +width/2, right: -width/2, with `strokeTextWidth`)
    3. mirror (negate x) when `justify.mirror`
    4. rotate with `pcbRotate` by the text rotation, plus the footprint
       rotation for footprint text
    5. place: `footprintToBoard` for footprint text, or add the board
       `at` for board text
    6. multiply by `PCB_PAGE_SCALE`

    This is the same pipeline as plan 07, without its Gerber frame map.
    Skipping step 1 draws every text upside down.
  - fixed colour constants: F.Cu `#c83434`, B.Cu `#3466c8`, inner
    `#c8a034`, F.SilkS and B.SilkS `#f2eecb`, F.Fab and B.Fab `#9a9a9a`,
    Edge.Cuts `#d0d0d0`, holes `#202020`, zone fill opacity 0.35
  - layers in `hidden` are skipped
  - footprints draw B-side layers before F-side layers
- Overlay (`pcb-overlay.ts` plus `PcbOverlay.tsx`):
  - ratsnest lines (dashed, stroke 1.5 page units, colour `#e0e0e0`)
  - highlight: a glow on pad outlines, track strokes, via rings and zone
    outlines of the highlighted net
  - connectivity and ratsnest are memoised per editor document revision
- `interaction.ts`:
  - In `placeShape`, intercept `Tool.PcbTrack` and `Tool.PcbVia` right
    after the `creation` null check and before the generic creation
    path, as the `Tool.BreadboardWire` branch does (interaction.ts:1447).
    Both start with `if (!isPcbPage()) return;`, so on other page kinds
    the PCB tools do nothing. They never fall through to generic
    placement, which would create a default-semantic element.
  - On a pcb page with Tool.PcbTrack: click adds a vertex; double click
    or Enter calls `editor.addPcbTrack(page, input)`; Esc cancels.
  - Tool.PcbVia: click calls `editor.addPcbVia`.
  - Hover over a pad, track or via sets the highlighted net, which the
    overlay shows.
  - `R` with pcb footprints selected calls
    `editor.rotatePcbFootprints(ids, 90)`.
  - The selection hit-test skips elements where `isPcbElementShown` is
    false.
  - All existing behaviour for other page kinds is unchanged.
- `PcbLayersPanel.tsx`: mounted in the Canvas pcb overlay area, shown only
  on pcb pages. It holds two blocks:
  - "Layers": the page's layers (from `pcb.board.layers`, otherwise the
    layers in use), each with a checkbox bound to `setPcbLayerHidden`.
  - "Tool options": the only UI for the tool options. The repo has no
    generic tool-options host, so do not look for one.
    - copper layer select: `pageCopperLayers(board)`
    - net select: `pcbNetNames` plus "No net" (`""`)
    - track width number input (must be > 0)
    - via diameter and drill number inputs (`diameter > drill > 0`)
    - every control calls `setPcbToolOptions`; an invalid value is
      rejected and the previous value kept
    - nothing is written to the document (user QA Q1)

## Pitfalls

- Moves already work through `movableSelection` and `moveElements`. Do
  not add a PCB-specific drag.
- Page units are mm times 10 everywhere in views. Never read
  `visual.x`/`visual.y` for pcb elements.
- Memoise connectivity per document revision. Do not recompute it per
  view.
- Keep the breadboard and other workspaces unchanged. The tests of
  `breadboard-interaction.test.ts` must still pass.
- `page-workspace.test.ts` keeps its existing cases and adds pcb cases.
- `drill.offset` moves only the copper (and mask and paste) shape. The
  pad hole and the snap point stay at the anchor (design 3.2). Do not
  derive either from the `padCopperOutline` result, and do not change any
  core file to get the anchor: use `footprintToBoard` from the plan 09
  barrel.

## Tests (input -> expected)

- `pcb-view.test.ts`:
  - a rect pad at 90 degrees gives path corners at the expected page
    coordinates
  - a track gives a path with stroke width = width * 10
  - a hidden layer omits its paths
  - an arc track uses an `A` command with the right sweep flag
  - text "T" at rotation 0, not mirrored: the page y of its horizontal
    bar is smaller than the page y of the stem bottom (upright); with
    `justify.mirror` the x order of the glyph points is reversed
  - offset pad: footprint at (10, 10) rotation 90, one `thru_hole` pad at
    (0, 0) rotation 0, oval size (2, 1), `drill: {diameter: 0.6, offset:
    [0.5, 0]}` -> the copper path's bounds centre is page (100, 95)
    within 1e-6, and the hole disc is centred at page (100, 100) with
    radius 3
  - the same pad with `drill: {diameter: 0.6, slot: [1.2, 0.6], offset:
    [0.5, 0]}` -> the hole capsule's centre is page (100, 100)
- `pcb-interaction.test.ts` (editor on `buildPcbDocument`-like data built
  with core exports, or a small document literal):
  - the Track tool starting on a GND pad and finished by Enter creates one
    `pcb.track` with net GND, layer F.Cu and 2+ points
  - Esc creates nothing
  - offset pad (the `pcb-view.test.ts` offset pad, on F.Cu with net
    GND): `pcbSnapTarget` at (10, 9.0) mm (inside the offset copper,
    outside the un-offset copper) returns the point (10, 10) and net GND
  - the Via tool creates one via with default sizes
  - `R` rotates a selected footprint to 90
  - a footprint on a hidden layer is not hit
  - dragging a footprint moves it once per drag delta (regression for
    absolute targets)
  - after `setPcbToolOptions({layer: "B.Cu", net: "SIG", width: 0.4})`,
    a Track started on empty board space creates a `pcb.track` with layer
    B.Cu, net SIG and width 0.4; a Track started on a GND pad with the
    same options gets net GND
  - a single Track click on a pcb page creates no element until Enter or
    double click
  - Tool.PcbTrack and Tool.PcbVia on a breadboard page create nothing
- palette (add to `pcb-interaction.test.ts`; do not edit existing tests):
  - `workspaceShapes("pcb").map(i => i.tool)` equals `[Tool.PcbTrack,
    Tool.PcbVia]`
  - `creationFor(Tool.PcbTrack)` and `creationFor(Tool.PcbVia)` are
    non-null
  - `shapePaletteGroups` for `pcb` has a `"PCB"` group
- The existing `workspaces.test.ts` and `breadboard-palette.test.ts` must
  pass unchanged. Do not edit them, and do not relax their assertions.
- `page-workspace.test.ts`: `dedicatedWorkspaceFor("pcb")` is `"pcb"`;
  `dedicatedPageKindFor("pcb")` is `"pcb"`.

## Verification

1. `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid apps/desktop/src/page-workspace.test.ts`
   exits 0.
2. `bun run typecheck` exits 0.
3. `bunx biome check packages/ui-solid/src/shapes/PcbShapeView.tsx packages/ui-solid/src/shapes/pcb-view.ts packages/ui-solid/src/shapes/pcb-view.test.ts packages/ui-solid/src/shapes/ShapeView.tsx packages/ui-solid/src/PcbOverlay.tsx packages/ui-solid/src/pcb-overlay.ts packages/ui-solid/src/pcb-state.ts packages/ui-solid/src/PcbLayersPanel.tsx packages/ui-solid/src/pcb-interaction.ts packages/ui-solid/src/pcb-interaction.test.ts packages/ui-solid/src/interaction.ts packages/ui-solid/src/Canvas.tsx packages/ui-solid/src/tools.ts packages/ui-solid/src/workspaces.ts packages/ui-solid/src/shape-palette.ts apps/desktop/src/page-workspace.ts apps/desktop/src/page-workspace.test.ts --diagnostic-level=warn`
   exits 0.

## Done criteria

- `grep -c '"pcb"' packages/ui-solid/src/workspaces.ts` is at least 1.
- `grep -c "PcbOverlay" packages/ui-solid/src/Canvas.tsx` is at least 1.
- `grep -c "PCB_SHAPES" packages/ui-solid/src/shape-palette.ts` is at
  least 2 (definition and `PALETTE_SHAPES`).
- `grep -c "PCB_CREATIONS" packages/ui-solid/src/tools.ts` is at least 2.
- `git diff --quiet -- packages/ui-solid/src/workspaces.test.ts packages/ui-solid/src/breadboard-palette.test.ts`
  exits 0.
- All verification steps are recorded with exit code 0.
