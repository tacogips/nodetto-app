# kicad-pcb-06-core-connectivity

- planId: kicad-pcb-06-core-connectivity
- planPath: impl-plans/completed/kicad-pcb-06-core-connectivity.md
- wave: 2; dependsOn: kicad-pcb-01-ir-core-contracts
- design: design-docs/specs/design-kicad-pcb.md section 5.5 (and 5.4 for
  `pcbNetNames`)
- progress log: impl-plans/progress/kicad-pcb-06-core-connectivity.md
- protocol: impl-plans/completed/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Compute copper connectivity on a PCB page, the ratsnest of unrouted
connections, the net highlight set, and the elements to select for a net.
All functions are pure and deterministic. The UI memoises them per store
revision.

## Repository context (imitate)

- `packages/core/src/breadboard/ratsnest.ts:computeBreadboardRatsnest`:
  Prim's tree, tie-breaking and output shape. Imitate the style; do not
  import or share it (design 13).
- `packages/core/src/breadboard/connectivity.ts`:
  `breadboardNetHighlight` and `breadboardNetMembers` (the result shapes,
  element order).
- Plan 01 helpers: `padCopperOutline`, `padPrimitiveOutlines`,
  `outlineContains`, `outlineBounds`, `expandCopperLayers`,
  `pageCopperLayers`, `viaCopperLayers`, `footprintToBoard`, `PcbGrid`,
  `shapeBounds`; `buildPcbDocument` for tests.

## Non-goals

- No DRC: shorts between nets are not reported.
- No zone refill, no thermal-relief analysis.
- No editor, UI or export code.

## writePaths

- packages/core/src/pcb-board/connectivity.ts (new)
- packages/core/src/pcb-board/connectivity.test.ts (new)
- packages/core/src/pcb-board/ratsnest.ts (new)
- packages/core/src/pcb-board/ratsnest.test.ts (new)
- impl-plans/progress/kicad-pcb-06-core-connectivity.md (new)

## sharedPaths

none

## Pinned interfaces

- `type PcbPadRef = {footprintId: ElementId, pad: number}` (`pad` is the
  index in `pads`)
- `computePcbConnectivity(document: Document, pageId: PageId):
  PcbConnectivity`, where `PcbConnectivity = {component(node: PcbNodeRef):
  number, pads: readonly {ref: PcbPadRef, net: string, at: PcbXY,
  elementOrder: number}[]}` and `PcbNodeRef = {kind: "pad", ref} | {kind:
  "track" | "via" | "zoneFill", id: ElementId, index?: number}`. Keep the
  type exported. The exact internal fields are free, but `component` must
  be stable within one result.
- `computePcbRatsnest(document, pageId, connectivity): PcbRatsnestLine[]`,
  where `PcbRatsnestLine = {net: string, from: {footprintId, pad, x, y},
  to: {footprintId, pad, x, y}}` (x, y in mm)
- `pcbNetHighlight(document, pageId, net): {pads: PcbPadRef[], tracks:
  ElementId[], vias: ElementId[], zones: ElementId[]}`
- `pcbNetMembers(document, pageId, net): ElementId[]`: tracks, vias and
  zones on the net and footprints with at least one pad on it, in element
  order (sorted by fractional index, then id)
- `pcbNetNames(document, pageId): string[]`: `pcb.board.nets` together
  with every net name used on the page, excluding `""`, unique, sorted by
  code unit

## Algorithm (design 5.5)

- Nodes: every pad with a copper layer, every track, every via, and every
  zone fill polygon, on visible elements only (`!visual.hidden`).
- Copper layers: `pageCopperLayers(board)`. Pad layers come from
  `expandCopperLayers`; via layers from `viaCopperLayers`.
- Grid: one `PcbGrid` per copper layer, cell 2.54. Insert pads (outline
  bounds), track segments (bounds grown by `width/2`), vias (disc bounds)
  and fill polygons (polygon bounds).
- Contacts, on a shared layer and only between nodes with the same net
  (filter by net first, so other-net copper never joins a group; this
  resolves the review residual about same-net restriction):
  - a track end inside a pad outline (or a primitive outline)
  - a track end within `width/2 + 1e-3` of another track segment's
    centreline (end-to-segment distance; arc tracks are tested as their
    two chords start-mid and mid-end)
  - a via centre inside a pad outline
  - a track end within the via radius
  - a pad centre, via centre or track end inside a fill polygon (even-odd)
- Union-find with path compression joins the contacts.
- Ratsnest:
  - for each net other than `""`, in `pcbNetNames` order, with two or
    more pads, group its pads by component
  - with g > 1 groups, run Prim over the groups, starting at the group of
    the first pad in element order; each step adds the shortest pad-centre
    link, by squared distance, from the joined set to an unjoined group
  - ties: lower `elementOrder` of `from`, then pad index, then the same
    for `to`
  - output is g - 1 lines per net, nets in `pcbNetNames` order

## Pitfalls

- Never compare every node with every node. Use the grid. A 5,000-segment
  board must complete without quadratic blowup (add the test below).
- A pad with net `""` never joins anything and never appears in the
  ratsnest.
- Hidden elements are ignored.
- Use squared distances for ordering; no `Math.hypot`.
- Keep the output order deterministic: iterate elements in element order,
  never in `Map` insertion order of unsorted sources.

## Tests (input -> expected)

`connectivity.test.ts`:

- Two pads of net A joined by one track -> the same component.
- Remove the track -> different components.
- A track end 0.1 mm inside the pad edge -> joined; 0.1 mm outside ->
  not joined.
- A T-junction (track end on the middle of another track of the same net)
  -> joined.
- A track of net B crossing net A copper -> it does not join A's pads.
- A via joins F.Cu and B.Cu tracks of its net.
- Two B.Cu SMD pads of GND inside a GND fill polygon -> joined. Pads
  outside the polygon -> not joined.
- `pcbNetMembers("GND")` returns the tracks, vias, zone and footprints
  with a GND pad, in element order.
- `pcbNetHighlight` lists the same items, with pad refs.
- `pcbNetNames` includes a board net with no items and excludes `""`.

`ratsnest.test.ts`:

- A fully routed net -> no lines.
- Three pads of one net, none routed -> 2 lines (Prim). Check the exact
  pairs and the tie-break with equal distances.
- Delete one track of a routed two-pad net -> exactly one line, between
  those two pads.
- Hidden track -> treated as absent.
- 5,000 generated tracks on 500 pads -> returns a result (correctness
  sample check; no timing assert).

## Verification

1. `bun test packages/core/src/pcb-board/connectivity.test.ts packages/core/src/pcb-board/ratsnest.test.ts`
   exits 0.
2. `bun run typecheck` exits 0.
3. `bunx biome check packages/core/src/pcb-board/connectivity.ts packages/core/src/pcb-board/connectivity.test.ts packages/core/src/pcb-board/ratsnest.ts packages/core/src/pcb-board/ratsnest.test.ts --diagnostic-level=warn`
   exits 0.
4. `grep -n "Math.hypot" packages/core/src/pcb-board/connectivity.ts packages/core/src/pcb-board/ratsnest.ts`
   prints nothing.

## Done criteria

- All five pinned functions are exported.
- All verification steps are recorded with the expected results.
