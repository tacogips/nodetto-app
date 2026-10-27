# breadboard-pcb-03-core-export

- planId: breadboard-pcb-03-core-export
- planPath: impl-plans/active/breadboard-pcb-03-core-export.md
- wave: 2; dependsOn: breadboard-pcb-01-validator, breadboard-pcb-02-legend-clip
- design: design-docs/specs/design-breadboard-pcb.md. Sections: 4 (rules),
  5 (Excellon), 6 (warnings), 7.1, 7.2, 7.6, and 8.1 findings R1-R6
  (core part).
- progress log: impl-plans/progress/breadboard-pcb-03-core-export.md
- session: opus-luna-design-and-implement-review-loop-session-501; issue
  local-input:feat/breadboard-gerber@431bfdb
- Wave map: see impl-plans/active/breadboard-pcb-01-validator.md.

## Intent

Harden `exportBreadboardPcb`, building on commit 431bfdb (do not rewrite
it):

- silkscreen kept `legendPadClearance` from every mask opening and
  `legendEdgeClearance` from the edge (R1, R2)
- polarity marks placed clear of the pads or omitted with a warning (R5)
- Excellon coordinates always with three decimals (R3)
- self-authored drill header comment (R4)
- engine-independent arithmetic for new emitted geometry (R6)
- `outline: "board" | "used"` (design 7.2)

Default and `board` output keep the GTL, GBL, GTS, GBS and GKO bytes
unchanged.

## Repository context

- `packages/core/src/breadboard/pcb.ts`. Main flow: `exportBreadboardPcb`;
  helpers: `markBeside`, `textBounds`, `around`, `overlaps`, `contains`;
  `BREADBOARD_PCB_RULES`.
- `packages/core/src/breadboard/gerber.ts`: `GerberLayer`, `excellonDrill`.
- New helpers from wave 1:
  - `packages/core/src/breadboard/pcb-legend.ts`: `clipLegendStroke`,
    `boxClearOfKeepouts`, `LegendKeepout`, `LegendRect`
  - `packages/core/src/breadboard/fabrication-validate.ts`:
    `validateGerber`, `validateExcellon`, `legendClearanceErrors`
- Tests: `packages/core/src/breadboard/pcb.test.ts`. Imitate its `fixture`,
  `holesOf`, `mm`, `exported` and `file` helpers and its
  `test-builder.ts:buildBreadboardDocument` usage.

## Non-goals

- Do not change copper, mask or outline geometry, routing rules, strip
  logic, board selection, or existing warning and note wording.
- Do not edit `pcb-font.ts`, `geometry.ts` (its `rotatePoint`
  trigonometry is an accepted exception, design 7.1 item 5), `zip.ts`,
  `html-bundle.ts`, `index.ts`, the CLI, the desktop or `ui-solid`.
- Do not check mark positions against label text (F3, accepted residual).
- No desktop outline setting.

## writePaths

- packages/core/src/breadboard/pcb.ts
- packages/core/src/breadboard/gerber.ts
- packages/core/src/breadboard/pcb.test.ts
- impl-plans/progress/breadboard-pcb-03-core-export.md (new)

## sharedPaths

none

## Step 0: baseline evidence (before any edit)

1. Confirm the files still match 431bfdb:
   `git diff --quiet 431bfdb -- packages/core/src/breadboard/pcb.ts packages/core/src/breadboard/gerber.ts`
   must exit 0.
2. Generate the baseline example files. Run
   `mkdir -p tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/baseline`
   first, because the CLI's `writeFileAtomic` does not create parent
   directories. Then run
   `bun apps/cli/src/main.ts breadboard gerber examples/breadboard/led-button.jsonl --output tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/baseline/led-button.zip`
   and
   `unzip -o tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/baseline/led-button.zip -d tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/baseline`.
   Record the stderr and the sha256 of all 7 files.
3. Generate the baseline fixture files. The fixture has the square pad
   (U1, a `breadboard.ic` at f10), several apertures per layer, and the
   jumper `c1-c5`. The example has none of these.
   - Write the scratch script
     `tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/fixture-export.ts`.
     It must be a plain `.ts` file, never `*.test.ts`.
   - The script rebuilds the `pcb.test.ts` `fixture` spec. Copy the
     `BreadboardTestSpec` literal from `pcb.test.ts` (the `fixture` const)
     and the `holesOf` helper. It uses `buildBreadboardDocument` from
     `packages/core/src/breadboard/test-builder.ts` and `boardHoles` from
     `packages/core/src/breadboard/board.ts`, imported by relative path
     from `tmp/`.
   - It calls
     `exportBreadboardPcb(document, "breadboard-page", { name: "fixture" })`,
     imported by relative path from `packages/core/src/breadboard/pcb.ts`.
     It writes each `file.text` to `<argv[2]>/<file.path>`, and fails
     loudly if the result is a string.
   - Run
     `mkdir -p tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/baseline-fixture`,
     then
     `bun tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/fixture-export.ts tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/baseline-fixture`.
     Record the sha256 of the 7 `fixture.*` files.
   - Pitfall: the script is scratch evidence only. No test or source file
     may import it. Do not edit it between the baseline and after runs.
     Record its sha256 in the progress log both times.

## Pinned contract changes

- `BREADBOARD_PCB_RULES` gains three keys, appended after `edgeKeepout` in
  this order: `legendPadClearance: 0.15`, `legendEdgeClearance: 0.2` and
  `usedMargin: 1.0`, each with a one-line doc comment. Existing keys and
  values are unchanged.
- `BreadboardPcbOptions` gains `readonly outline?: "board" | "used";`, with
  the default `"board"`. Plan 04 passes this field.
- New warning, exact text:
  ``The ${mark} mark at ${reference(part)} pin ${pin.name} has no room clear of the pads and is left off the silkscreen.``
- Drill header, exact lines up to `%`:
  - `M48`
  - `; Nodetto breadboard PCB drill file: plated holes, millimetres, absolute, decimal point coordinates`
  - `; #@! TF.FileFunction,Plated,1,2,PTH`
  - `FMAT,2`
  - `METRIC`
  - `T1C1.000`
  - `%`

  Build the comment from the existing `generator` argument:
  `` `; ${generator} drill file: plated holes, millimetres, absolute, decimal point coordinates` ``.
  It replaces the two old lines `; DRILL file ...` and `; FORMAT=...`.
- Drill hits are written as `` `X${x.toFixed(3)}Y${y.toFixed(3)}` ``.
  Replace `Number(...toFixed(4))`.

## File-level changes

### gerber.ts

- `excellonDrill`: only the header comment and the coordinate format
  change. Keep the tool table, `G90` and `G05`, the hit order and `M30`.
- `GerberLayer`: no change is required. If the outline mode needs it, emit
  translated points from `pcb.ts`. Do not add an offset to `GerberLayer`.

### pcb.ts

1. Keepouts. After `usedHoles` is known (after the wire loop), build one
   `LegendKeepout` per used pad. The radius is
   `maskRadius + rules.legendPadClearance + rules.legendLine / 2`.
   `maskRadius` is `rules.maskOpening / 2` for `circle`, and
   `rules.maskOpening / 2 * Math.SQRT2` for `square`. A hole whose shape
   becomes square later must use the final shape, so build keepouts only
   after all `use()` calls.
2. Legend rectangle. For stroke centrelines it is the board inset by
   `rules.legendEdgeClearance + rules.legendLine / 2`. The existing text
   `edge` bounds (ink extents, inset 0.2) must use
   `rules.legendEdgeClearance` instead of the literal `0.2`.
3. Collect legend strokes; do not call `legend.stroke` directly. Collect
   them in emission order as records `{ points, kind: "label" | "other",
   group }`, where `group` ties all strokes of one board label together.
   Keep the 431bfdb order: board labels, polarity marks, then for each part
   its outline followed by its reference, then the jumpers. After
   collection, apply `clipLegendStroke(points, legendRect, keepouts,
   rules.legendLine)` to every record. Each clipped piece keeps its record's
   kind and group.
4. Reference placement. A candidate is free when all three hold:
   - `contains(edge, bounds)`
   - it does not overlap any `taken` text box
   - `boxClearOfKeepouts(bounds, keepouts)` is true

   Remove the `pad + 0.2` boxes from `taken`. Taken then holds only placed
   text: labels, marks and references. Candidate order and the fallback to
   `candidates[0]` stay the same. The fallback is clipped (step 3) and
   raises no warning.
5. Polarity marks (R5, replaces `markBeside`).
   - In the part loop, record `{ text, pinAt, othersAt, ref, pinName }`
     only. Placement happens in the legend phase, when all keepouts are
     known.
   - Direction: from the centroid of `othersAt` to `pinAt`, normalised
     with `Math.sqrt`. With no other pins, use (-1, 0), as 431bfdb did by
     placing the centre at `pin.x + 1`. For a zero-length vector use (1, 0).
   - Candidates are the direction rotated by 0, +45, -45, +90 and -90
     degrees, counter-clockwise positive with y up. Use `Math.SQRT1_2` for
     the 45 degree terms, for example `(dx - dy) * S, (dx + dy) * S`. No
     trigonometry.
   - Distance: `keepoutRadius(pin pad) + halfDiagonal`, where
     `halfDiagonal = Math.sqrt(w * w + h * h) / 2` of
     `textBounds(text, origin)`.
   - Take the first candidate whose `textBounds` is inside `edge` and clear
     of all keepouts, draw it, and add it to `taken`.
   - If no candidate is clear, push the new warning when the mark is
     considered in the legend phase. That is after the two-leads warnings,
     in mark order.
   - Do not check marks against label text.
6. Outline mode.
   - `board`, or the option omitted: emit exactly as before. Skip any
     translation code path, so copper bytes cannot change.
   - `used`:
     - Compute the box over:
       - each pad's mask extent: a circle of radius `maskOpening/2`, or a
         square of half side `maskOpening/2`
       - each routed and strip trace point +/- half its trace width
       - each clipped non-label legend point +/- `legendLine/2`

       Expand the box by `rules.usedMargin` and intersect it with
       `[0, width] x [0, height]`.
     - Round outward to 0.01 mm with `Math.floor(v * 100) / 100` for the
       minimums and `Math.ceil` for the maximums, then clamp to the board
       again.
     - The offset is `(minX, minY)`, the new `width` is
       `roundMm(maxX - minX)`, and likewise for the height.
     - Translate every emitted point (pads, traces, legend and drill
       hits) as `roundMm(p - offset)`. The outline rectangle is
       `(0,0)-(width,height)`.
     - Keep a board-label group only if every translated point of every
       stroke in the group lies inside the trimmed legend rectangle (the
       inset rule from step 2 applied to the new size). Otherwise drop the
       whole group.
     - The returned `width` and `height`, and the `Board <w> x <h> mm`
       note, use the trimmed size.
   - Routing, strip traces, reference placement, mark placement and
     clipping must not depend on the mode. Compute them once, in the full
     frame, before emission.
7. Remove `markBeside` and any other now-unused helpers.
   `noUnusedLocals` is on.

Pitfalls:

- The board-mode byte contract. GTL, GBL, GTS, GBS and GKO must be
  byte-identical to the Step 0 baselines (example and fixture). Keep the
  aperture first-use order
  in every layer: the legend aperture is still the only one in GTO, and pad
  and trace apertures keep their order.
- GTO is expected to change. Do not try to preserve it.
- The `taken` change can move references, which is acceptable. Any change
  to pad or trace geometry is not.
- `noUncheckedIndexedAccess`: no `candidates[0]` style without a fallback.
  The existing `candidates[0] ?? {...}` pattern is fine. Use destructuring
  for tuples.
- Do not import `fabrication-validate.ts` from `pcb.ts`; it is test-only.
- Determinism: new code that produces coordinates uses only `+ - * /`,
  `Math.sqrt`, `Math.SQRT1_2`, `Math.SQRT2`, `Math.floor`, `Math.ceil` and
  `Math.round`.

### pcb.test.ts

Update the existing assertions only where the design changes output:

- The jumper `c1-c5` GTO assertion becomes the clipped pieces. Assert that
  no GTO stroke point lies within the keepout of c1, c3 or c5, and that
  pieces exist between them.
- The DRL `X${mm("f10").x}Y...` assertion uses the 3-decimal form.

Keep every other existing assertion (GTL, GBL, GKO and the file list)
unchanged. That is the board-mode guard.

New tests (input -> expected). Each regression test must be shown to fail
on the 431bfdb code before the fix: write it first, run it, and record the
failing output in the progress log.

- R1 clearance: for `fixture`, the "own net" and "two leads" documents,
  the rotated board, and the example (read
  `examples/breadboard/led-button.jsonl` with `readFileSync` and
  `parseDocument` from `@nodetto/io`, as `export-golden.test.ts` does), in
  both outline modes -> `legendClearanceErrors({gto, gts, outline: pcb,
  padClearance: 0.15, edgeClearance: 0.2})` is `[]`.
- Validator: every file of every pcb produced in this test file, in both
  modes -> `validateGerber`/`validateExcellon` returns `[]`. Add this to the
  `exported` helper or a loop, so no test skips it.
- R2: a half board with a part seated on the top rail and neighbours
  blocking all four reference candidates (comment why each one is blocked)
  -> the reference strokes are clipped, and every GTO coordinate is inside
  the legend rectangle. On 431bfdb this fails with a coordinate outside
  the edge.
- R3: a full board with a resistor whose pin sits at hole `a49` (x = 127
  mm) -> the DRL contains `X127.000Y`. The 431bfdb code writes `X127Y`.
- R4: the DRL lines up to `%` equal the pinned header list exactly.
- R5 blocked: an LED whose anode hole has used neighbours in all five
  candidate directions (use resistor pins to occupy them) -> the warnings
  contain the new mark text with `+`, and the GTO has no `+` glyph near the
  anode.
- R5 clear: a plain LED -> no mark warning, and the `+` is present (covered
  by the clearance test).
- Unclipped label (F1): for a half-board export, the strokes of the column
  labels `25` and `5` in the GTO equal `strokeText("25", x, y,
  legendText)` and `strokeText("5", ...)` at the label positions,
  coordinate-wise after nm rounding. No segment is missing and no stroke
  is split.
- Outline default: `exported(doc)` files equal `outline: "board"` files
  byte for byte, for the fixture and the example.
- Outline used, example and fixture:
  - `width < 83.82` or `height < 55.88`, with both at most the board size
  - the GKO rectangle is `(0,0)` to `(width,height)`
  - every GTL, GBL and GTS flash and stroke point, and every GTO point,
    satisfies the containment rule
    `distanceToOutlineEdge >= min(usedMargin, distanceToFullBoardEdge) - 1e-5`.
    The test derives the offset by comparing the first GTL flash in used
    and board mode. For a used-mode point `p`, `distanceToFullBoardEdge` is
    measured at `p + offset` against the full board size. Do not pair GTO
    points by index, because dropped labels shift the indexes.
  - the copper of used mode equals the copper of board mode translated by
    one constant offset
  - no row or column label lies outside the legend rectangle
  - the drill hit count is unchanged
- Rotated board: the existing test still passes in board mode. Add the same
  equality for `outline: "used"`.

## Invariants

- The public API stays compatible. `exportBreadboardPcb`,
  `encodeBreadboardPcbZip` and the existing `BREADBOARD_PCB_RULES` keys are
  unchanged; options and keys are only added.
- Existing warning and note strings are unchanged.
- For the example and the `pcb.test.ts` main fixture in board mode, GTL,
  GBL, GTS, GBS and GKO are byte-identical to the Step 0 baselines.
- No file outside writePaths is changed.

## Verification (record exit codes and outputs in the progress log)

1. `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/breadboard`
   must exit 0. Record the pass count. This run includes
   `export-golden.test.ts`; its existing tests must still pass.
2. Byte contract, example. Run
   `mkdir -p tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after`,
   then
   `bun apps/cli/src/main.ts breadboard gerber examples/breadboard/led-button.jsonl --output tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after/led-button.zip`,
   then
   `unzip -o tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after/led-button.zip -d tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after`.
   Then for each of GTL, GBL, GTS, GBS and GKO run
   `cmp tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/baseline/led-button.<EXT> tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after/led-button.<EXT>`.
   Each must exit 0. Record `diff` summaries for GTO and DRL; they are
   expected to differ.
3. Byte contract, fixture. Run
   `mkdir -p tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after-fixture`,
   then
   `bun tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/fixture-export.ts tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after-fixture`.
   Use the unchanged Step 0 script, and confirm its sha256 equals the Step 0
   value. Then for each of GTL, GBL, GTS, GBS and GKO run
   `cmp tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/baseline-fixture/fixture.<EXT> tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after-fixture/fixture.<EXT>`.
   Each must exit 0. This covers the square-pad R aperture, the aperture
   first-use order in copper and mask, and the shape upgrade in `use()`.
   Record `diff` summaries for fixture GTO and DRL; they are expected to
   differ.
4. `bunx biome check packages/core/src/breadboard/pcb.ts packages/core/src/breadboard/gerber.ts packages/core/src/breadboard/pcb.test.ts --diagnostic-level=warn`
   must exit 0.
5. `bun run typecheck` must exit 0.
6. Create the `noUncheckedIndexedAccess` tsconfig at
   `tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/tsconfig.nuia.json`,
   as in plan 01. Run `bunx tsc -p` on it and filter the output for
   `breadboard/pcb.ts`, `breadboard/gerber.ts` and `breadboard/pcb-legend.ts`.
   The filtered output must be empty.
7. Run `grep -nE "Math\.(hypot|sin|cos|atan2)" packages/core/src/breadboard/pcb.ts`.
   The only allowed match is the existing `distanceToSegment` use of
   `Math.hypot`, a comparison that never feeds an emitted coordinate. Record
   it. Any new match fails.

## Per-worker protocol

Same as plan 01:

- read each file fresh before you edit it, and record its sha256 before and
  after
- write an intent snapshot first
- on drift, stop and record it
- run no state-changing git commands (the read-only `git diff --quiet` in
  Step 0 is allowed)
- keep scratch only under `tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/`,
  and never put `*.test.ts` files under `tmp/`
- edit only your own progress log

## Done criteria (mechanical)

- All 10 `cmp` checks exit 0: the 5 unchanged layers for the example
  (Verification step 2) and for the fixture (Verification step 3).
- `grep -c "legendPadClearance\|legendEdgeClearance\|usedMargin" packages/core/src/breadboard/pcb.ts`
  is at least 3.
- `grep -c "markBeside" packages/core/src/breadboard/pcb.ts` prints 0.
- The R1-R5 and F1 tests exist, and each has a recorded pre-fix failure in
  the progress log (R4 and F1 may pass pre-fix only where the old output
  already met them; record that).
- Verification steps 1-7 are recorded with the expected results.
