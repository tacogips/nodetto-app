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
- packages/core/src/pcb-board/follow.test.ts (add offset-pad cases only;
  `follow.ts` is not changed)
- packages/core/src/pcb-board/connectivity.test.ts (add offset-pad cases
  only; `connectivity.ts` is not changed)
- docs/pcb/kicad-pcb.md (the one drill-offset sentence only)

## Status at session 535 start

`export.ts` and `export.test.ts` are committed in `cf0c4d7` under the
superseded model: `export.ts` moves the DRL hit by the rotated offset, the
slot test expects Gerber y 8.25/10.25, and `geometry.ts` ignores the
offset. This plan is not done. Rework it in place: keep every other
committed behaviour and test, correct the offset handling and its
assertions (never weaken them), and rewrite the progress log, including
new mutation controls.

The evidence directory `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/`
still holds logs from the superseded attempt. They are not evidence for
this rework. Before any source edit, overwrite `pcb-sha256-start.txt` with
`shasum -a 256 packages/core/src/pcb/*` and record the time. Write every new log
under a fresh name with the prefix `s535-` (for example
`s535-bun-test.log`), and cite only those logs in the progress file.

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
  - anchor `A = footprintToBoard(fp, pad.at)`; shape centre
    `S = A + pcbRotate(pad.drill?.offset ?? [0, 0], fp.rotation + pad.rotation)`
    from `padShapeCenter` (design 3.2; see "Geometry correction"). Every
    flash below is at `S`, never at `A`
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
    drill at the anchor `A` (the hole position). The drill `offset` is
    KiCad's shape offset: it moves the copper, mask and paste shapes, never
    the hole (design sections 3.2, 6.3, 7.3). Remove the offset from the
    drill code in `export.ts`. A pad with `drill.slot` becomes a slot
    centred on `A` along the long axis rotated by `r`: the end centres are
    `max(slot) - min(slot)` apart and the diameter is `min(slot)`.
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

## Geometry correction (`geometry.ts`)

- `padCopperOutline(fp, pad, grow)` and `padPrimitiveOutlines(fp, pad)`
  build the shape about the shape centre `S` (above), rotated by `r`,
  instead of about `A`. The `circle` results (circle pads, and custom or
  oval pads with equal sizes) use `S` as `center`. Add one exported helper
  `padShapeCenter(fp: {at, rotation}, pad: PcbPad): PcbXY` (no rounding,
  like `footprintToBoard`) and use it in both functions and in the
  `export.ts` pad flashes; no other signature changes.
- Without an offset the output is unchanged, so every committed plan 05,
  06 and 08 test must still pass as is.
- `footprintBounds`, `follow.ts` and `connectivity.ts` (track-end and via
  contacts) already call these functions, and `shapes/pcb.ts` gets the
  offset through `footprintBounds` (geometry.ts:502-508); none of them
  needs an edit. `connectivity.ts` `boardPadCenter` stays at `A` (the anchor, design
  3.2 and 5.5); do not change it.

## Docs

In `docs/pcb/kicad-pcb.md`, replace only the sentence "Drill holes include
oval slots and offsets." with "Drill holes include oval slots. A pad's drill
offset moves the pad's copper, mask and paste shapes; the hole stays at the
pad position, as in KiCad."

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
  diameter within 0.0005. The committed case (footprint rotation 90,
  `slot: [3, 1]`, `offset: [0.25, 0]`) expects slot ends at Gerber x 2 and
  y 8 and 10 (the hole at `A`), diameter 1, end distance 2. The old
  8.25/10.25 values are the superseded model and must be replaced, not
  loosened.
- Offset pads, footprint at (10, 10), pad at (0, 0) rotation 0, oval
  size (2, 1), `drill: {diameter: 0.6, offset: [0.5, 0]}`, on F.Cu:
  - footprint rotation 90: DRL hit at board (10, 10); GTL has one
    obround flash of 1 x 2 at board `S` = (10, 9.5); GTS has the mask
    flash at the same `S`
  - footprint rotation 45: DRL hit at board (10, 10); GTL has one region
    whose two arc centres have their midpoint at `S` = (10 +
    0.5 * SQRT1_2, 10 - 0.5 * SQRT1_2) within 1e-6
  - the same pads with `slot: [1.2, 0.6]`: the slot centre (midpoint of
    its ends) is at board (10, 10)
  - expected Gerber values come from the board values through
    `gy = maxY - y`, computed in the test, not read from the export
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

## Tests (`geometry.test.ts`, `follow.test.ts`, `connectivity.test.ts`)

Use the same offset pad (footprint at (10, 10), oval (2, 1), offset
(0.5, 0)).

- `geometry.test.ts`:
  - rotation 90: `outlineBounds(padCopperOutline(...))` is x 9.5..10.5,
    y 8.5..10.5 within 1e-9; `outlineContains` is true at `S` (10, 9.5)
    and at `A` (10, 10), and false at (10, 10.8) (inside the un-offset
    shape, outside the offset one)
  - rotation 45: the circle or contour centre equals `S` within 1e-9
  - a circle pad with an offset returns `center` = `S`
  - `grow = 0.1` keeps the centre at `S`
  - a custom pad with one polygon primitive and an offset: every
    primitive point is the no-offset point plus `pcbRotate(offset, r)`
  - `footprintBounds` of a footprint with only the offset pad equals the
    offset outline bounds
  - a pad without an offset gives the same outline as before the change
    (pin one committed rect and oval case)
- `follow.test.ts`: rotation 90 offset pad, an F.Cu track ending at
  (10, 8.7) (inside the offset shape only); moving the footprint by
  (1, 0) moves that end to (11, 8.7); a track ending at (10, 10.8)
  does not move
- `connectivity.test.ts`: two pads of one net joined by a track whose end
  is inside the offset shape only -> no ratsnest line; the same track
  ending at (10, 10.8) -> one ratsnest line

## Mutation controls (record in the progress log)

Run each mutation on an in-memory or `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/`
copy, never on the repository files:

1. Add the rotated offset back to the DRL position in `export.ts`: the
   slot and offset-pad hole assertions fail.
2. Drop the offset in `padCopperOutline`: the geometry, follow,
   connectivity and export copper assertions fail.
3. Flash at `A` instead of `S` in `export.ts`: the rotation 90 flash
   assertion fails.

Record each command, the failing assertion and the log path.

## Verification

1. `bun test packages/core/src/pcb-board packages/core/src/pcb packages/core/src/shapes/pcb.test.ts`
   exits 0 (the whole pcb-board suite, because plans 05, 06 and 08
   consume `geometry.ts`).
2. `bun run typecheck` exits 0.
3. `bunx biome check packages/core/src/pcb-board/export.ts packages/core/src/pcb-board/export.test.ts packages/core/src/pcb-board/geometry.ts packages/core/src/pcb-board/geometry.test.ts packages/core/src/pcb-board/follow.test.ts packages/core/src/pcb-board/connectivity.test.ts --diagnostic-level=warn`
   exits 0.
4. `git diff --quiet cf0c4d7 -- packages/core/src/pcb-board/follow.ts packages/core/src/pcb-board/connectivity.ts packages/core/src/pcb-board/edit.ts packages/core/src/shapes/pcb.ts`
   exits 0.
5. `grep -nE "Math\.(hypot|atan2|sin|cos)" packages/core/src/pcb-board/export.ts packages/core/src/pcb-board/geometry.ts`
   prints nothing.
6. For every file under `packages/core/src/pcb/`, the sha256 recorded at
   the start of this plan equals the sha256 at the end, so this plan
   changed none of them. Record both lists in the progress log.

## Done criteria

- `exportPcbBoard` and `encodePcbBoardZip` are exported from `export.ts`.
- All verification steps are recorded with the expected results.
