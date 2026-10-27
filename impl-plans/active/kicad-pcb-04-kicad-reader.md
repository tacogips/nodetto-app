# kicad-pcb-04-kicad-reader

- planId: kicad-pcb-04-kicad-reader
- planPath: impl-plans/active/kicad-pcb-04-kicad-reader.md
- wave: 2; dependsOn: kicad-pcb-01-ir-core-contracts
- design: design-docs/specs/design-kicad-pcb.md sections 3.2, 3.4, 4
  (all), 11 (fixtures)
- progress log: impl-plans/progress/kicad-pcb-04-kicad-reader.md
- scratch: tmp/kicad-pcb-s530/kicad-pcb-04-kicad-reader/
- protocol: impl-plans/active/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Read KiCad 5 to 9 `.kicad_pcb` text into a `PcbImportPlan` (pinned in
`packages/ir/src/pcb.ts` by plan 01) with diagnostics, and add the
self-authored fixtures that later plans and tests use. This is an original
implementation, written from public knowledge of the format. Never copy
KiCad code or boards.

## Repository context (imitate)

- `packages/io/src/kicad/sexpr.ts`: `readSexpr`, `atomAt`, `numberAt`,
  `SEXPR_SLOT`, `SexprList`, `SexprAtom` (with `line` and `column`).
- `packages/io/src/kicad/schematic.ts` and `netlist.ts`: how a root is
  walked and how diagnostics are pushed (code, message, line, column).
- `packages/io/src/kicad/index.ts:importKicad`: dispatch on the root
  keyword.
- `packages/io/src/index.ts` (around line 96): the re-exports from
  `./kicad/index.ts`.
- `test-fixtures/kicad/README.md`: the fixture list and provenance
  statement.
- `packages/io/src/kicad/schematic.test.ts`: the `fixture(name)` helper
  that reads `test-fixtures/kicad/<name>`.

## Non-goals

- No page building; `pcbPageFromPlan` is plan 01. No geometry transforms
  except the KiCad 5 arc conversion and the angle normalisation.
- No `.kicad_pcb` writing. No `.kicad_pro` reading.
- No change to schematic or netlist import results.

## writePaths

- packages/io/src/kicad/pcb.ts (new)
- packages/io/src/kicad/pcb.test.ts (new)
- packages/io/src/kicad/index.ts
- packages/io/src/index.ts
- test-fixtures/kicad/two-layer.kicad_pcb (new)
- test-fixtures/kicad/kicad5.kicad_pcb (new)
- test-fixtures/kicad/README.md
- impl-plans/progress/kicad-pcb-04-kicad-reader.md (new)

## sharedPaths

none

## Pinned interface

- `importKicadPcb(text: string, options: {fileName: string}): PcbImportResult`,
  exported from `packages/io/src/kicad/index.ts` and re-exported from
  `packages/io/src/index.ts`.
- `plan.title` is the file name without `.kicad_pcb`. `board.source` is the
  file name; `board.format` is `"kicad_pcb"`.
- `importKicad` gains one branch: for root `kicad_pcb` it returns
  `{diagnostics: [...parsed, {severity: "error", code: "kicad.pcbRoot",
  message: "KiCad board files open as PCB pages; use pcb import."}]}`. Its
  other behaviour is unchanged.

## Parsing rules (design 4.2, 4.3)

- Single pass:
  - Iterate `root.items` once. For each list item, switch on its keyword:
    `version`, `generator`, `general` (thickness), `layers`, `setup`
    (`pad_to_mask_clearance`), `net`, `footprint`/`module`, `gr_*`,
    `segment`, `arc`, `via`, `zone`, plus the skipped kinds.
  - Inside an item, build a `Map<string, SexprList[]>` of its child lists
    in one pass, then read fields from the map.
  - Do not call `child()` or `children()` on the root, and do not call
    them repeatedly on a big list.
- No regex split. Simple character checks are fine. Recursion only to
  descend into the bounded KiCad nesting (depth is capped at 256 by
  `readSexpr`).
- Numbers: use `Number(atom.text)`. If the result is not finite, drop the
  item and emit warning `kicad.badNumber` with its line and column.
- Nets:
  - Build `code -> name` from root `net` items.
  - Item nets: `(net N)` gives the table name; `(net N "name")` gives
    `name`; `(net "name")` gives `name`.
  - Zones: `net_name` wins over `net`.
  - Net 0 or an empty name is `""`.
  - `board.nets` holds the non-empty names in file order, unique.
- Layers: `board.layers` comes from the `(layers (id "name" type
  ["user name"]) ...)` table. A layer atom on an item that matches a
  user name maps to the canonical name.
- Footprint (`footprint` or `module`):
  - `library`: the first atom after the keyword, `""` if absent
  - `at`: `[x, y]`; `rotation` is the third value of `at`, default 0
  - `side`: `bottom` when the footprint `layer` is `B.Cu`
  - `reference` and `value`:
    - KiCad 8 and 9: `property "Reference" "R1"` and `property "Value"`
      lists
    - older versions: `fp_text reference R1` and `fp_text value ...`
    - each becomes a text graphic with `role`
    - `fp_text user` and other `property` texts are not added, except
      `user` texts, which become `role: "user"`
    - a `hide` atom, or `(hide yes)`, sets `hidden: true`
  - Text and pad `at` angles are board-absolute in the file. Store
    `rotation = normalise(fileAngle - footprintRotation)` in `[0, 360)`.
    Graphic coordinates stay local, as read; no mirroring.
  - Pads:
    - `(pad "<number>" <type> <shape> (at ...) (size w h) [(drill ...)]
      (layers ...) [(net ...)] [(roundrect_rratio r)] [(rect_delta dx dy)]
      [(solder_mask_margin m)] [(primitives (gr_poly ...))])`
    - `(drill d)`, `(drill oval w h)` (slot `[w, h]`, diameter `min(w, h)`),
      and an optional `(offset x y)`
    - unknown pad shape -> `custom` with no primitives, warning
      `kicad.padShape`
    - primitives other than `gr_poly` -> skipped with `kicad.unsupported`
  - Footprint graphics: `fp_line`, `fp_arc`, `fp_circle`, `fp_rect`,
    `fp_poly`, `fp_text`. Stroke width comes from `(width w)` or
    `(stroke (width w) ...)`. Fill: `(fill solid|yes)` is true, anything
    else false.
- KiCad 5 arcs: `gr_arc` or `fp_arc` with `(start cx cy) (end x y)
  (angle a)` and no `mid`. Convert in one helper,
  `kicad5ArcToThreePoint(center, start, angleDegrees)`, using
  `pcbRotate`. KiCad 5 positive angles are clockwise on screen, so
  `pcbRotate` gets `-a` for the end point and `-a/2` for the mid point.
  Round the results with `roundNm`. Document the sign assumption in a
  comment.
- Circles: `(center) (end)` gives `radius` as the distance (`Math.sqrt`),
  rounded with `roundNm`.
- Tracks:
  - `segment` -> 2 points
  - `arc` -> 2 points plus `mid`
  - width, layer and net
  - `tracks` sorted stably: B.Cu first, then inner layers, then F.Cu,
    then other layers; file order inside each group
- Vias: `at`, `size` (diameter), `drill`, `layers` (2 atoms; default
  `["F.Cu", "B.Cu"]`), net. Via types (`blind`, `micro`) are read, but the
  type is not stored.
- Zones:
  - `layers` from `layer` or `layers`
  - `outline` from `polygon (pts (xy ...))`
  - each `filled_polygon` gives `{layer: its layer or the zone's single
    layer, polygons: [points]}`, merged per layer in file order
  - `keepout` or `rule_area` zones are skipped with `kicad.ruleArea`
  - an `(arc ...)` inside `pts` gives start, mid and end as plain points,
    warning `kicad.polygonArc`
- Skipped kinds (`dimension`, `target`, `image`, `gr_text_box`,
  `gr_bbox`, `model`): one `kicad.unsupported` warning per kind, with a
  count, for example `Skipped 2 dimension items.`. `group` gets the same
  warning (design 4.3: `Skipped 1 group items.`), and its members, which
  are separate root items, are still read.
- Root not `kicad_pcb` -> `kicad.unknownRoot` error, no plan. A
  `version` below 20171130 -> `kicad.oldVersion` warning. Text starting
  with `PCBNEW-BOARD` (legacy format) -> error `kicad.legacyFormat`.

## Fixtures (self-authored, typed by hand; design 11)

- `test-fixtures/kicad/two-layer.kicad_pcb`: KiCad 8 syntax, `(version
  20240108) (generator "nodetto-fixture")`.
  - Layer table: F.Cu 0, B.Cu 31 (type signal), F.SilkS with user name
    "F.Silkscreen", B.SilkS, F.Mask, B.Mask, F.Fab, B.Fab, Edge.Cuts.
  - Nets: 0 "", 1 GND, 2 VCC, 3 SIG, 4 SPARE (no items).
  - Footprints:
    - J1: THT header at rotation 0, pad 1 rect, pads 2 and 3 circle,
      drill 1.0
    - R1: SMD with two roundrect pads, footprint rotation 90 (pad `at`
      angles 90)
    - C1: bottom-side SMD (layer B.Cu, B.* pad layers, mirrored local x)
    - U1: THT at rotation 45 with one oval pad with `(drill oval 0.8 1.6)`
      and a circle pad
    - H1: mounting hole, `np_thru_hole` circle 3.2 drill
    - each footprint has Reference and Value properties, one F.SilkS
      line and one F.Fab rect
  - Tracks: F.Cu and B.Cu segments and one F.Cu `arc`.
    - Every net with two or more pads is fully joined by copper (tracks,
      vias or the GND zone fill), so the ratsnest of the fixture as read is
      empty.
    - At least two tracks end at J1 pad centres. Plan 09 moves J1.
    - Net SIG has exactly one segment that is the only copper between two
      of its pads. Plan 09 deletes it and expects one ratsnest line.
  - Vias: 2 (0.6/0.3), on SIG and GND.
  - Zone: GND on B.Cu, a 4-point outline, one `filled_polygon`.
  - Edge.Cuts: 3 `gr_line`, one `gr_arc` rounded corner (start/mid/end),
    one `gr_circle` cutout.
  - Board graphics: one `gr_text` on F.SilkS and one `gr_line` on B.SilkS.
  - Rotations are multiples of 45 only (native parity, design 15).
- `test-fixtures/kicad/kicad5.kicad_pcb`: `(kicad_pcb (version 20171130)
  (host pcbnew 5.1.9))`, with:
  - one `module` with `fp_text reference` and `fp_text value`
  - one `fp_arc` with `(angle 90)`
  - one `gr_arc` with `(angle -90)` on Edge.Cuts
  - coded nets `(net 1 GND)`
  - one `segment`, one `via`, one zone with `filled_polygon`
- `test-fixtures/kicad/README.md`: add both files with one line each,
  stating that they are self-authored for Nodetto tests and are not
  derived from any third-party board.

## Pitfalls

- Pad angles: subtract the footprint rotation (design 4.3). A careless
  implementation stores the file angle and rotates pads twice.
- `(at x y)` without an angle means 0.
- KiCad 6+ quotes most atoms and KiCad 5 does not. Do not branch on
  `quoted` for layers, names or numbers in general.
- `hide` can be a bare atom (KiCad 5-7) or `(hide yes)` (KiCad 8+).
- The one exception is the item `net` list:
  - with two atoms, the first is the code and the second the name
  - with one unquoted atom that parses as an integer, it is a code
  - with one quoted atom, it is a name (`(net "GND")`)
  - `quoted` distinguishes a name like `"5"` from a code `5`, and is
    used nowhere else
- Determinism: no `Math.random`, no dates, no Map iteration over unsorted
  keys for output order.
- Performance: a board with 20,000 segments must parse in linear time.
  Add a test that builds such a string and asserts that it parses (no
  timing assert).

## Tests (`pcb.test.ts`, input -> expected)

- `two-layer.kicad_pcb`:
  - counts: footprints 5, pads (sum per footprint), tracks, vias 2,
    zones 1, Edge.Cuts graphics 5
  - `board.nets` equals `["GND", "VCC", "SIG", "SPARE"]`
  - R1 pad rotation is 0 (file 90 minus footprint 90)
  - C1 has `side` `bottom`
  - the U1 oval pad has `drill.slot` `[0.8, 1.6]` and diameter 0.8
  - the arc track has `mid`
  - the zone has 1 filled polygon on B.Cu
  - J1 reference text has `role` `reference`
  - item layer "F.Silkscreen" maps to "F.SilkS"
  - tracks are ordered B.Cu first
  - no error diagnostics
- `kicad5.kicad_pcb`:
  - the module becomes a footprint with its reference
  - the `fp_arc` start/mid/end match the expected values within 1e-6
    (compute them by hand in the test from the documented sign)
  - nets are mapped from codes
- Inline strings:
  - `(net "GND")` on a segment -> net GND
  - `(stroke (width 0.12) (type solid))` -> width 0.12
  - a `pts` arc -> `kicad.polygonArc`
  - a keepout zone -> `kicad.ruleArea` and no zone
  - a `dimension` -> `kicad.unsupported` with the count
  - a bad number -> `kicad.badNumber` with line and column
  - root `kicad_sch` -> `kicad.unknownRoot`
  - `importKicad` on board text -> `kicad.pcbRoot`
  - version 20150101 -> `kicad.oldVersion`
- Each fixture parsed twice -> `toEqual`.
- 20,000 generated segments -> plan has 20,000 tracks.

## Verification

1. `bun test packages/io/src/kicad` exits 0; the existing schematic and
   netlist tests also pass.
2. `bun run typecheck` exits 0.
3. `bunx biome check packages/io/src/kicad packages/io/src/index.ts --diagnostic-level=warn`
   exits 0.
4. `grep -n "\.split(/" packages/io/src/kicad/pcb.ts` prints nothing.
5. `LC_ALL=C grep -cP '[^\x00-\x7F]' test-fixtures/kicad/two-layer.kicad_pcb test-fixtures/kicad/kicad5.kicad_pcb`
   prints 0 for both files.

## Done criteria

- Both fixtures exist, and the README lists both.
- All verification steps are recorded with exit code 0 (step 4: no
  output; step 5: zeros).
