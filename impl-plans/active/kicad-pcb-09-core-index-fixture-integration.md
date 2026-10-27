# kicad-pcb-09-core-index-fixture-integration

- planId: kicad-pcb-09-core-index-fixture-integration
- planPath: impl-plans/active/kicad-pcb-09-core-index-fixture-integration.md
- wave: 3; dependsOn: kicad-pcb-04-kicad-reader,
  kicad-pcb-05-core-editing, kicad-pcb-06-core-connectivity,
  kicad-pcb-07-core-export, kicad-pcb-08-core-shapes
- dependency status: plans 04, 05, 06 and 08 are accepted and committed in
  cf0c4d7; they are listed in the dispatch manifest's `acceptedDependencies`
  and are not repeated in a fanout item's `acceptedPlanIds`, which only
  covers plans of the current manifest. Treat them as accepted. Plan 07 is
  accepted when its ID is in `acceptedPlanIds`.
- design: design-docs/specs/design-kicad-pcb.md sections 3.4, 4.1, 5, 7,
  11 (test matrix rows "Import preserves every item and net", "Lossless
  JSONL", "Move/rotate follow", "Ratsnest and highlight", "Gerber
  read-back")
- progress log: impl-plans/progress/kicad-pcb-09-core-index-fixture-integration.md
- scratch: tmp/kicad-pcb-s534/kicad-pcb-09-core-index-fixture-integration/
- protocol: impl-plans/active/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Publish the PCB board API from `@nodetto/core` in one barrel, written
once, and prove the acceptance criteria end to end on the self-authored
fixture `test-fixtures/kicad/two-layer.kicad_pcb`:

- import preserves every item and net
- save and reload is identical
- moving a footprint keeps its track ends on its pads
- deleting a track shows a ratsnest line
- net selection covers every item of a net
- the Gerber and drill export reads back with matching copper, holes and
  outline

## Repository context

- `packages/core/src/index.ts` line 363 (`export * from
  "./breadboard/index.ts"`) and line 700 (`export * from
  "./pcb-import.ts"`).
- `packages/core/src/breadboard/index.ts`: barrel style.
- `packages/core/src/breadboard/export-golden.test.ts`: how core tests
  read files and use `@nodetto/io` (`parseDocument`, `serializeDocument`;
  `@nodetto/io` is a core devDependency).
- Wave-2 modules: `packages/core/src/pcb-board/{geometry,page,edit,follow,connectivity,ratsnest,export}.ts`;
  `importKicadPcb` from `@nodetto/io`.

## Non-goals

- Do not change any wave-2 module. If a fixture test exposes a defect,
  record it in the progress log with the failing assertion and the module
  owner, and leave the test failing. Reconciliation routes the repair to
  the owning plan.
- No CLI, UI or desktop code.

## writePaths

- packages/core/src/pcb-board/index.ts (new)
- packages/core/src/index.ts
- packages/core/src/pcb-board/fixture.test.ts (new)
- impl-plans/progress/kicad-pcb-09-core-index-fixture-integration.md (new)

## sharedPaths

none

## Barrel (`pcb-board/index.ts`), explicit named exports (no `export *`)

- from `page.ts`: `pcbPageFromPlan`, `pcbDocumentFromPlan`
- from `geometry.ts`: `footprintToBoard`, `boardToFootprint`,
  `padCopperOutline`, `padPrimitiveOutlines`, `padShapeCenter`,
  `outlineContains`,
  `shapeBounds`, `footprintBounds`, `expandCopperLayers`,
  `pageCopperLayers`, `viaCopperLayers`, `arcCenter`, `arcIsClockwise`,
  `pcbAnchor`, and the types `PcbOutline`, `PcbOutlineSegment`,
  `PcbBounds`. Export geometry's `outlineBounds` as `pcbOutlineBounds`,
  because `packages/core/src/pcb/gerber-outline.ts` has an
  `outlineBounds`. Check the core index for other duplicates with
  `bun run typecheck`.
- from `edit.ts`: `PCB_TRACK_DEFAULT_WIDTH`, `PCB_VIA_DEFAULT`, and the
  types `PcbTrackInput`, `PcbViaInput`
- from `connectivity.ts`: `computePcbConnectivity`, `pcbNetHighlight`,
  `pcbNetMembers`, `pcbNetNames`, and the types `PcbConnectivity`,
  `PcbPadRef`
- from `ratsnest.ts`: `computePcbRatsnest`, the type `PcbRatsnestLine`
- from `export.ts`: `exportPcbBoard`, `encodePcbBoardZip`, the type
  `PcbBoardExport`
- from `../pcb/font.ts` (the plan 11 views need them; nothing else in
  `@nodetto/core` exports them today): `strokeText`, `strokeTextWidth`,
  `strokeFontSupports`. Re-exporting from the pcb folder does not break
  `boundary.test.ts`, which only restricts imports made by files inside
  `packages/core/src/pcb/`.
- not exported: `test-builder.ts`, `follow.ts` (internal to the editor)

`packages/core/src/index.ts`: add one line,
`export * from "./pcb-board/index.ts";`, next to the breadboard line.

## Fixture tests (`fixture.test.ts`; load the fixture with `readFileSync`; input -> expected)

- Import:
  - `importKicadPcb` gives no error diagnostics
  - `pcbDocumentFromPlan` gives a document that passes
    `assertValidDocument`
  - the element counts per type equal the plan's counts (board 1,
    footprints 5, tracks, vias 2, zones 1, graphics)
  - every plan net appears in `pcb.board.nets`
  - every item's net is in `pcbNetNames`
- Lossless JSONL. This test is placed here, not in
  `packages/io/src/jsonl/roundtrip.test.ts` as design 11 suggests:
  `@nodetto/io` cannot import `@nodetto/core` (`pcbDocumentFromPlan`, the
  Editor), while core has io as a devDependency. The behaviour verified is
  the same.
  - `serializeDocument(doc)` -> `parseDocument` -> `serializeDocument`
    gives byte-equal text, and the parsed document deep-equals the
    original
  - after `editor.moveElements` on a footprint,
    `editor.rotatePcbFootprints`, `addPcbTrack` and `addPcbVia` (all on an
    `Editor` opened on the document), the same byte-equal and deep-equal
    round trip holds for the editor's snapshot
- Follow: for every track end that lies inside one of J1's pads before
  the move, moving J1 by (1.27, 0) mm keeps the end inside the same pad
  (checked with `padCopperOutline` + `outlineContains` on the new
  footprint) at the same pad-local offset (within 1e-6).
- Ratsnest:
  - record the fixture's initial `computePcbRatsnest` line count `L0`
    (the fixture is fully routed by design, so expect 0 and assert it)
  - deleting one track that is the only copper between two pads of net
    SIG gives `L0 + 1` lines, and the new line joins exactly those two
    pads
  - undo gives `L0` again
- Net selection: `pcbNetMembers(doc, page, "GND")` contains the GND zone,
  every GND track and via, and every footprint with a GND pad. Compute the
  expected set independently by filtering the elements in the test.
- Gerber read-back (design 11, split tolerance from review DR-1):
  - `exportPcbBoard` on the fixture gives no error
  - `readGerber` on GTL, GBL, GTS, GBS, GTO, GBO and GKO:
    - pad flashes or regions per copper pad
    - draws per track, including the arc draw for the arc track
    - a region for the zone fill
    - the outline extent equals `width` and `height`
    - all positions within 1e-6 mm
  - `readExcellon` on DRL and `-NPTH.DRL`:
    - holes for both vias and every `thru_hole` pad, and a slot for the
      U1 oval pad
    - the H1 mounting hole in NPTH
    - positions, slot ends and tool diameters within 0.0005 mm of the
      expected board-frame values
  - U1 pad 1 has `drill.offset` (0.1, 0) (design 3.2): its slot centre
    (midpoint of the slot ends) is at the anchor
    `footprintToBoard(fp, pad.at)` = board (40, 10), with diameter 0.8
    and end centres 0.8 apart, while its GTL and GTS copper is centred at
    `padShapeCenter(fp, pad)` = board (40 + 0.1 * SQRT1_2,
    10 - 0.1 * SQRT1_2), within the tolerances above
  - two exports are byte-equal

## Pitfalls

- Do not use `export *` in the barrel: it hides name clashes until
  typecheck and pulls in test support.
- Expected values in the read-back test must come from the document
  (holes at `footprintToBoard(fp, pad.at)`, pad copper at
  `padShapeCenter(fp, pad)`), not from the export's own output.
- Excellon tolerance is 0.0005 mm. Do not tighten it to 1e-6, because the
  writer uses three decimals (DR-1).

## Verification

1. `bun test packages/core/src/pcb-board packages/core/src/pcb packages/io/src/kicad packages/ir/src`
   exits 0.
2. `bun run typecheck` exits 0.
3. `bunx biome check packages/core/src/pcb-board/index.ts packages/core/src/index.ts packages/core/src/pcb-board/fixture.test.ts --diagnostic-level=warn`
   exits 0.
4. `bun test packages/core/src/breadboard/export-golden.test.ts` exits 0.

## Done criteria

- `grep -c "pcb-board/index.ts" packages/core/src/index.ts` is 1.
- All fixture tests pass, or every failure is recorded with the owning
  plan id (in that case, mark this plan blocked, not done).
- All verification steps are recorded.
