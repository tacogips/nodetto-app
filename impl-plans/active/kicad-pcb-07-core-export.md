# kicad-pcb-07-core-export

- planId: kicad-pcb-07-core-export
- planPath: impl-plans/active/kicad-pcb-07-core-export.md
- wave: 2; dependsOn: kicad-pcb-01-ir-core-contracts,
  kicad-pcb-02-fabrication-writers
- design: design-docs/specs/design-kicad-pcb.md sections 7.1, 7.3 (all
  bullets, including the 0.001 mm drill resolution), 13, 15; baseline
  design-docs/specs/design-breadboard-pcb.md section 5 (names, X2
  attributes)
- progress log: impl-plans/progress/kicad-pcb-07-core-export.md
- scratch: tmp/kicad-pcb-s534/kicad-pcb-07-core-export/
- protocol: impl-plans/active/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Turn a `pcb` page into the board-house Gerber and Excellon file set, and a
stored ZIP, using only the `packages/core/src/pcb` writers (with the plan
02 additions). The output is deterministic and byte-identical between Bun
and the Boa native CLI.

## Repository context (imitate)

- `packages/core/src/breadboard/pcb.ts`: `exportBreadboardPcb` (result
  shape `{files, warnings, notes, width, height}`, error string return),
  `fileBaseName` (name sanitising: copy the rule with the fallback
  `"pcb"`), `encodeBreadboardPcbZip` (stored ZIP with `encodeStoredZip`
  from `../zip.ts`, label `"PCB archive"`).
- `packages/core/src/pcb/fabrication.ts`: layer construction, X2
  `FileFunction` strings, extension naming.
- Plan 02 API: `GerberLayer.flashAperture`, `.region`, `.arc`, `.flash`,
  `.stroke`; `excellonDrill(hits, generator, 2, {plating, slots})`.
- Plan 01 helpers: `padCopperOutline` (with `grow` for mask),
  `padPrimitiveOutlines`, `footprintToBoard`, `expandCopperLayers`,
  `pageCopperLayers`, `arcCenter`, `arcIsClockwise`, `shapeBounds`;
  `strokeText` and `strokeTextWidth` from `../pcb/font.ts`;
  `buildPcbDocument`.
- The generator string: use the one the breadboard export passes
  (`Nodetto,...`; read it in `breadboard/pcb.ts`). `drillTitle` is
  `"Nodetto PCB"`.

## Non-goals

- No change to files under `packages/core/src/pcb/` (plan 02 owns them)
  or to the breadboard export.
- No paste, fab or inner copper layers. No DRC. No refill. No silkscreen
  clipping.
- No public index (plan 09).

## writePaths

- packages/core/src/pcb-board/export.ts (new)
- packages/core/src/pcb-board/export.test.ts (new)
- impl-plans/progress/kicad-pcb-07-core-export.md (new)
- packages/core/src/pcb-board/geometry.ts
- packages/core/src/pcb-board/geometry.test.ts

## sharedPaths

none

## Pinned interfaces

- `PcbBoardExport = {width: number, height: number, files: readonly
  PcbFile[], warnings: readonly string[], notes: readonly string[]}`
- `exportPcbBoard(document: Document, pageId: PageId, options: {name?:
  string} = {}): PcbBoardExport | string`
  - errors (returned strings, exact text): `The page is not a PCB page.`
    and `The board has no Edge.Cuts outline.`
- `encodePcbBoardZip(result: PcbBoardExport): Uint8Array`

## Mapping (design 7.3)

- Frame:
  - `minX` and `maxY` come from the Edge.Cuts centreline extent:
    `shapeBounds(shape, 0)` over every Edge.Cuts graphic, board-level and
    footprint-level (transform footprint graphics with
    `footprintToBoard`)
  - each point maps as `gx = x - minX`, `gy = maxY - y`
  - `width = maxX - minX`, `height = maxY - minY`, each rounded with
    `roundNm`
  - map points with this one function; never mix frames
- Copper F.Cu (GTL `Copper,L1,Top`) and B.Cu (GBL `Copper,L2,Bot`), in
  this order inside each layer:
  1. zone fills of that layer as dark regions
  2. graphics on that copper layer
  3. tracks (`stroke` for straight tracks; `arc` for arc tracks, with
     `arcCenter` and `arcIsClockwise`)
  4. vias (circle flash of the diameter on every copper layer of the
     via)
  5. pads
- Pads:
  - total rotation `r = fp.rotation + pad.rotation`, normalised
  - circle -> `flashAperture` circle
  - rect or oval with `r` a multiple of 90 -> `flashAperture` rectangle or
    obround (sizes swapped at 90 and 270)
  - everything else (rotated rect or oval, roundrect, trapezoid, custom)
    -> `region` of `padCopperOutline`, plus `region`s of
    `padPrimitiveOutlines` for custom pads
  - a pad is drawn on a layer only when `padHasCopperLayer`
- Solder mask (GTS `Soldermask,Top` and GBS `Soldermask,Bot`, both
  Negative): pads whose `layers` include `*.Mask` or that side's
  `F.Mask`/`B.Mask`, drawn as in the copper rules with `grow =
  pad.maskMargin ?? board.maskExpansion ?? 0`. Graphics on F.Mask/B.Mask
  are added too. No via openings.
- Silkscreen: F.SilkS -> GTO `Legend,Top`; B.SilkS -> GBO `Legend,Bot`,
  written only when at least one stroke exists. Each graphic becomes:
  - line: `stroke`
  - arc: `arc`
  - circle: two half arcs
  - rect: closed `stroke`
  - polygon: closed `stroke`, or a `region` when `fill` is set
  - text (skip `hidden`):
    - `role` reference or value uses the footprint's current `reference`
      or `value`
    - strokes come from `strokeText(text, 0, 0, size[1])`. Its output is
      centred on the origin with y pointing UP
      (packages/core/src/pcb/font.ts:467-476), while the board frame is y
      down. Apply these steps in this order:
      1. convert each point to the board frame as (x, -y)
      2. justify (left: +width/2, right: -width/2, with
         `strokeTextWidth`)
      3. mirror (negate x) when `justify.mirror`
      4. rotate with `pcbRotate` by the text rotation, plus the footprint
         rotation for text inside a footprint
      5. translate to the text position in board coordinates
         (`footprintToBoard` for footprint text, or the board `at`)
      6. map to the Gerber frame (`gy = maxY - y`)

      Skipping step 1 exports every text upside down. Do not change
      `font.ts`.
    - stroke width = `thickness`
  - Characters the font lacks: the warning
    `<label> has characters the silkscreen font cannot draw; they are omitted.`
    (the breadboard wording), once per text; use `strokeFontSupports`.
- Outline (GKO `Profile,NP`): every Edge.Cuts graphic stroked at its width
  (0.1 when width is 0 or less); a circle is two half arcs.
- Drill:
  - `<name>.DRL` (plated): one hit per via drill and per `thru_hole` pad
    drill at the pad's `at` (the hole position). The drill `offset` is
    KiCad's shape offset: it moves the copper, mask and paste shapes, never
    the hole (design sections 4, 6.3, 7.3). Correct `padCopperOutline` and
    `padPrimitiveOutlines` in `geometry.ts` to centre the shape at `at` plus
    `offset` rotated by `fp.rotation + pad.rotation`, and add tests in
    `geometry.test.ts` and `export.test.ts` for a rotated footprint with an
    offset oval pad: the DRL hit is at the pad's `at`, the copper region is
    centred at the offset position, and track follow and connectivity use the
    offset shape. A pad with
    `drill.slot` becomes a slot along the rotated long axis: the length
    is `max(slot) - min(slot)` between the two end centres, and the
    diameter is `min(slot)`.
  - `<name>-NPTH.DRL`: `np_thru_hole` drills, with
    `{plating: "nonPlated"}`, written only when present.
  - Coordinates and diameters are written by the unchanged writer at
    0.001 mm.
- Archive order: GTL, GBL, GTS, GBS, GTO, GBO (if any), GKO, DRL,
  `-NPTH.DRL` (if any).
- Warnings:
  - inner copper: `The board has inner copper layers (<names>); only F.Cu and B.Cu are exported.`,
    once, names comma-separated in copper order, emitted when any item
    uses an inner layer
  - a copper zone with no fill on a layer: `Zone on <net> has no fill; refill it in KiCad.`
    (`<net>` is `no net` when empty)
  - font characters (above)
- Notes:
  - `Board <w> x <h> mm, 2 layers, <n> plated holes, <k> footprints.`,
    with `w` and `h` from `toFixed(2)`; `n` counts plated round hits plus
    slots
  - plus, when the page has a zone:
    `Zone fills are exported as read from the KiCad file; they are not refilled after edits.`

## Pitfalls

- Determinism: use arithmetic, `Math.sqrt`, and `pcbRotate` only. No
  `Math.hypot`, no `atan2`, no `Date`. Iterate in element order.
- Gerber arc direction: `arcIsClockwise` is evaluated in the board frame
  (y down) as seen from the top. The picture is the same after the y-flip
  frame mapping, so the visual direction is unchanged: write it as is,
  clockwise -> G02. Test it with a read-back.
- Hidden elements are not exported.
- Do not modify the writer to get more drill precision (design 7.3,
  review DR-1).

## Tests (`export.test.ts`, documents from `buildPcbDocument`; input -> expected)

- A minimal board (rect outline, 1 THT circle pad, 1 track, 1 via) ->
  the file list is exactly GTL, GBL, GTS, GBS, GTO, GKO, DRL with the
  sanitised name.
- `readGerber(GTL)`:
  - the pad flash is at the expected Gerber position within 1e-6
  - the track draw endpoints are within 1e-6
  - the via flash has the via diameter
- `readExcellon(DRL)`: the holes are at the expected positions within
  0.0005, and the tool diameters are within 0.0005.
- A footprint rotated 45 with a rect pad -> one region in GTL whose
  contour corners match `pcbRotate` within 1e-6.
- A rect pad at rotation 90 -> a rectangle aperture with swapped sizes.
- A roundrect pad -> a region with 4 arc segments.
- An oval drill slot -> `readExcellon` gives one slot, with ends and
  diameter within 0.0005.
- An `np_thru_hole` pad -> a `-NPTH.DRL` file whose `plating` is
  `nonPlated`; the plated DRL lacks that hole.
- B.SilkS graphics -> GBO exists; without them, no GBO.
- Text orientation: a `gr_text` "T" on F.SilkS at rotation 0, not
  mirrored. In `readGerber(GTO)`, the horizontal bar's Gerber y is
  greater than the Gerber y of the stem bottom (upright). The same text
  with `justify.mirror` -> the x order of the bar's end points is
  reversed compared with the unmirrored case.
- An arc track -> one GTL `draw` with `arc` whose `clockwise` matches the
  board picture: build a known counter-clockwise-on-screen arc and assert
  the value.
- An Edge.Cuts circle -> GKO has two arc draws; `width` and `height`
  equal the extent.
- A zone fill -> a dark region on GBL; a zone without fill -> the
  warning.
- An inner-layer track -> the warning, and no GTL/GBL draw for it.
- No Edge.Cuts -> the error string. A non-pcb page -> the error string.
- Two exports of the same document -> byte-equal files and ZIP.
- The oracle (`oracle.test-support.ts`) accepts every file with only the
  known warnings.

## Verification

1. `bun test packages/core/src/pcb-board/export.test.ts packages/core/src/pcb` exits 0.
2. `bun run typecheck` exits 0.
3. `bunx biome check packages/core/src/pcb-board/export.ts packages/core/src/pcb-board/export.test.ts --diagnostic-level=warn`
   exits 0.
4. `grep -nE "Math\.(hypot|atan2|sin|cos)" packages/core/src/pcb-board/export.ts`
   prints nothing.
5. For every file under `packages/core/src/pcb/`, the sha256 recorded at
   the start of this plan equals the sha256 at the end, so this plan
   changed none of them. Record both lists in the progress log.

## Done criteria

- `exportPcbBoard` and `encodePcbBoardZip` are exported from `export.ts`.
- All verification steps are recorded with the expected results.
