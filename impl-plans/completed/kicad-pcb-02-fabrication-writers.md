# kicad-pcb-02-fabrication-writers

- planId: kicad-pcb-02-fabrication-writers
- planPath: impl-plans/completed/kicad-pcb-02-fabrication-writers.md
- wave: 1; dependsOn: none
- design: design-docs/specs/design-kicad-pcb.md section 7.2; baseline
  design-docs/specs/design-breadboard-pcb.md sections 5 and 11.1
- progress log: impl-plans/progress/kicad-pcb-02-fabrication-writers.md
- scratch: tmp/kicad-pcb-s530/kicad-pcb-02-fabrication-writers/
- protocol: impl-plans/completed/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Extend the existing Gerber and Excellon writers so the KiCad board export
(plan 07) can write rectangle and obround flashes, regions with arcs, arc
strokes, non-plated drill files and slots. Every change is additive.
Existing call sites (the breadboard export) must produce byte-identical
files.

## Repository context

- `packages/core/src/pcb/gerber.ts:GerberLayer`: `use(template)`,
  `flash(shape, size, at)`, `stroke(width, points)`, `text(generator)`.
  Coordinates use `coordinate()` (integer nm).
- `packages/core/src/pcb/excellon.ts:excellonDrill(hits, generator, layers)`.
- `packages/core/src/pcb/index.ts`: the folder's public entry.
- `packages/core/src/pcb/boundary.test.ts`: files in this folder may
  import only each other.
- `packages/core/src/pcb/gerber-read.ts:readGerber` and
  `excellon-read.ts:readExcellon`: use them to read back in tests.
- `packages/core/src/pcb/oracle.test-support.ts`: the independent
  `gerber-parser` reader. See how `fabrication.test.ts` uses it.
- Goldens: `examples/breadboard/led-button.*` and
  `packages/core/src/breadboard/export-golden.test.ts`.

## Non-goals

- Do not change `flash`, `stroke`, `text`, the header lines,
  `pcbFabricationFiles`, `model.ts`, `trim.ts`, `legend.ts`, `font.ts`,
  the readers, or `validate.ts`.
- Do not change the Excellon default precision: coordinates and diameters
  stay `toFixed(3)`.
- No KiCad-specific logic here. That lives in plan 07.

## writePaths

- packages/core/src/pcb/gerber.ts
- packages/core/src/pcb/excellon.ts
- packages/core/src/pcb/index.ts
- packages/core/src/pcb/writer-additions.test.ts (new)
- impl-plans/progress/kicad-pcb-02-fabrication-writers.md (new)

## sharedPaths

none

## Step 0: baseline (before any edit)

Run
`mkdir -p tmp/kicad-pcb-s530/kicad-pcb-02-fabrication-writers/baseline`,
then
`bun apps/cli/src/main.ts breadboard gerber examples/breadboard/led-button.jsonl --output tmp/kicad-pcb-s530/kicad-pcb-02-fabrication-writers/baseline/led-button.zip`.
Record its sha256.

## Pinned additions

`gerber.ts` (y up, mm; points are `PcbPoint` from `model.ts`):

- `type GerberApertureShape = {kind: "circle", diameter} | {kind:
  "rectangle", width, height} | {kind: "obround", width, height}`
- `GerberLayer.flashAperture(aperture: GerberApertureShape, at: PcbPoint): void`
  - templates: `C,<d>`, `R,<w>X<h>`, `O,<w>X<h>`, with `millimetres()`
  - aperture codes are shared with `flash()`, because the template string
    is the key
- `type GerberContourSegment = {to: PcbPoint, arc?: {center: PcbPoint, clockwise: boolean}}`
- `type GerberRegionContour = {start: PcbPoint, segments: readonly GerberContourSegment[]}`
- `GerberLayer.region(contours: readonly GerberRegionContour[]): void`:
  `G36*`, then for each contour `X..Y..D02*` followed by `D01` blocks. Arc
  blocks are `G02*`/`G03*` then `X..Y..I..J..D01*`, with `I`/`J` the integer
  nm offset from the segment start to the centre. Then `G37*`.
- `GerberLayer.arc(width, from, to, center, clockwise): void`: a stroke
  with a round aperture: `D02` at `from`, then the G02/G03 block to `to`.
- Arc state:
  - The first arc in a layer emits `G75*` once, in the body, before its
    first `G02`/`G03`.
  - After each arc block, emit `G01*` so that later linear blocks stay
    linear.
  - Layers without arcs contain no `G75`, `G02` or `G03`, so existing
    output is unchanged.
- A region needs no aperture selection. Do not reset `selected` for it.

`excellon.ts`:

- `excellonDrill(hits, generator, layers, options?: {plating?: "plated" |
  "nonPlated", slots?: readonly DrillSlotHit[]})` with `DrillSlotHit =
  {diameter, from: PcbPoint, to: PcbPoint}`.
- With `options` omitted or `plating: "plated"`, the output is
  byte-identical to today.
- `nonPlated`: the comment line reads `non-plated holes` instead of
  `plated holes`, and the attribute line is
  `; #@! TF.FileFunction,NonPlated,1,<layers>,NPTH`.
- Slot diameters join the tool table with the hit diameters (sorted,
  deduplicated). For each tool, after its round hits, write its slots as
  `X<x>Y<y>G85X<x>Y<y>` with `toFixed(3)`.
- Export the new types from `index.ts`.

## Pitfalls

- The byte contract: the breadboard path calls only `flash`, `stroke`,
  `text` and the 3-argument `excellonDrill`. None of their output may
  change.
- `I`/`J` use the same `coordinate()` rounding as `X`/`Y`. Compute them as
  `coordinate(center.x - from.x)`, not as a difference of rounded values.
  Both are acceptable to the reader, but use one convention and document
  it in a comment.
- Multi-quadrant mode (`G75`) is required for arcs longer than 90 degrees.
  `readGerber` supports it.
- Do not import anything from outside `packages/core/src/pcb/`.

## Tests (`writer-additions.test.ts`, input -> expected)

- `flashAperture` rectangle 2x1 at (1, 1) -> `readGerber` gives one flash
  with a `rectangle` aperture of 2x1 at (1, 1).
- An obround flash is read back the same way, as `obround`.
- `region` with a square contour -> one `region` object whose 4 segments
  are at the expected points.
- `region` with a contour containing a semicircle arc -> the read-back
  segment has `arc.clockwise` as given and the centre within 1e-6.
- `arc(0.2, ...)` quarter arc -> one `draw` with `arc`, and the text
  contains exactly one `G75*`. Two arcs still give one `G75*`.
- A layer using only `flash` and `stroke` -> the text contains no `G75`,
  `G02` or `G03`.
- `excellonDrill(hits, gen, 2)` equals `excellonDrill(hits, gen, 2, {})`
  and `{plating: "plated"}` byte for byte.
- `nonPlated` -> `readExcellon(...).plating` is `"nonPlated"`.
- Slots -> `readExcellon` returns the slot with its `from`/`to` within
  0.0005 and its diameter; the tool table holds each diameter once.
- The `oracle.test-support.ts` reader accepts the region, arc and slot
  files with no warnings beyond the known ones listed in
  `fabrication.test.ts`.

## Verification

1. `bun test packages/core/src/pcb packages/core/src/breadboard` exits 0.
   This includes `export-golden.test.ts` and `boundary.test.ts`.
2. Run
   `bun apps/cli/src/main.ts breadboard gerber examples/breadboard/led-button.jsonl --output tmp/kicad-pcb-s530/kicad-pcb-02-fabrication-writers/after/led-button.zip`
   (after `mkdir -p` of that directory). Then
   `cmp tmp/kicad-pcb-s530/kicad-pcb-02-fabrication-writers/baseline/led-button.zip tmp/kicad-pcb-s530/kicad-pcb-02-fabrication-writers/after/led-button.zip`
   exits 0.
3. `bun run typecheck` exits 0.
4. `bunx biome check packages/core/src/pcb/gerber.ts packages/core/src/pcb/excellon.ts packages/core/src/pcb/index.ts packages/core/src/pcb/writer-additions.test.ts --diagnostic-level=warn`
   exits 0.

## Done criteria

- The `cmp` in step 2 exits 0.
- `grep -c "flashAperture\|region(\|G75" packages/core/src/pcb/gerber.ts`
  is at least 3.
- All verification steps are recorded with exit code 0.
