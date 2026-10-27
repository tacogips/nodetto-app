# kicad-pcb-01-ir-core-contracts

- planId: kicad-pcb-01-ir-core-contracts
- planPath: impl-plans/active/kicad-pcb-01-ir-core-contracts.md
- wave: 1; dependsOn: none
- design: design-docs/specs/design-kicad-pcb.md sections 3.1-3.4, 4.1
  (`PcbImportPlan`, `pcbPageFromPlan`), 5.1 (anchors), 6.3 (pad shapes),
  5.5 (grid index)
- progress log: impl-plans/progress/kicad-pcb-01-ir-core-contracts.md
- scratch: tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/
- protocol: impl-plans/active/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Pin every shared data shape and geometry helper that the wave-2 plans
build on: the `pcb` page kind, six `pcb.*` element types with structural
validation and key orders, the import plan type, and the core geometry
helpers (footprint transforms, pad copper outlines, containment, bounds,
grid index, anchors, translation). Also add a page builder and a test
document builder. Later plans must not change these signatures. If a
wave-2 plan needs a change, it records the request in its progress log
for reconciliation.

## Repository context (imitate)

- `packages/ir/src/types.ts:PAGE_KINDS`: append `"pcb"` after
  `"breadboard"`.
- `packages/ir/src/semantics.ts:BREADBOARD_ELEMENT_TYPES`,
  `isBreadboardElementType`, `SemanticByType` (the breadboard entries at
  the end): add the six pcb entries to `SemanticByType`, typed from
  `./pcb.ts`.
- `packages/ir/src/registry.ts:breadboardDefinition`,
  `BREADBOARD_DEFINITIONS`, `DEFINITIONS`: add `pcbDefinition` and
  `PCB_DEFINITIONS`, appended to `DEFINITIONS` after the breadboard ones.
  Reuse the local helpers `checkObject`, `checkString`, `checkNumber`,
  `checkEnum`, `checkArray`, `error` and `noReferences`.
- `packages/ir/src/breadboard.ts` and `packages/ir/src/index.ts`
  (the breadboard export block): put the pure types and constants in a new
  `packages/ir/src/pcb.ts` and export them from the index.
- `packages/ir/src/registry.test.ts` line 49: the sorted `ELEMENT_TYPES`
  list must gain the six types.
- `apps/cli/src/types-command.ts:TYPICAL` (`Record<PageKind, ...>`): add a
  `pcb` entry, or typecheck fails.
- `packages/core/src/pcb-import.ts:importPcbPage` (the `id` and `add`
  closures, indexes `a000001`...): imitate this for deterministic ids and
  indexes in `pcbPageFromPlan`. Ids must be deterministic, because the
  native parity test compares JSONL bytes.
- `packages/core/src/pcb-import.ts:importPcbFiles`: imitate this for
  `pcbDocumentFromPlan` (`SCHEMA_VERSION`, `assertValidDocument`).
- `packages/core/src/breadboard/test-builder.ts:buildBreadboardDocument`:
  imitate this for `buildPcbDocument`.

## Non-goals

- No `SCHEMA_VERSION` bump and no migration (`migrations.ts` untouched).
- No editor, connectivity, export, reader, UI or CLI command code.
- Do not edit `packages/core/src/index.ts` or create
  `packages/core/src/pcb-board/index.ts`; plan 09 owns both.
- No electrical validation (unknown nets and dangling tracks are not
  errors).

## writePaths

- packages/ir/src/pcb.ts (new)
- packages/ir/src/pcb.test.ts (new)
- packages/ir/src/types.ts
- packages/ir/src/semantics.ts
- packages/ir/src/registry.ts
- packages/ir/src/registry.test.ts
- packages/ir/src/index.ts
- apps/cli/src/types-command.ts
- packages/core/src/pcb-board/geometry.ts (new)
- packages/core/src/pcb-board/geometry.test.ts (new)
- packages/core/src/pcb-board/page.ts (new)
- packages/core/src/pcb-board/page.test.ts (new)
- packages/core/src/pcb-board/test-builder.ts (new)
- impl-plans/progress/kicad-pcb-01-ir-core-contracts.md (new)
- packages/io/src/jsonl/golden.test.ts (golden coverage for the new pcb.* types; assigned during reconciliation)
- packages/io/src/__fixtures__/pcb.jsonl (new; self-authored PCB golden fixture)

## sharedPaths

none

## Pinned contract: `packages/ir/src/pcb.ts`

All fields are `readonly`. Arrays are `readonly`.

- `type PcbXY = readonly [number, number]` (mm, board frame, y down)
- `PcbShape` (discriminated by `kind`):
  - `{kind: "line", start, end}`
  - `{kind: "arc", start, mid, end}`
  - `{kind: "circle", center, radius}`
  - `{kind: "rect", start, end}`
  - `{kind: "polygon", points}`
  - `{kind: "text", text, at, rotation, size: PcbXY, thickness,
    role?: "reference" | "value" | "user", justify?: {horizontal?: "left" |
    "right", mirror?: boolean}, hidden?: boolean}`
- `PcbGraphicItem = {layer: string, width: number, fill: boolean, shape: PcbShape}`
- `PcbPadPrimitive = {width: number, fill: boolean, shape: PcbShape}`
- `PCB_PAD_TYPES = ["thru_hole", "smd", "np_thru_hole", "connect"]`;
  `PCB_PAD_SHAPES = ["circle", "rect", "oval", "roundrect", "trapezoid", "custom"]`
- `PcbPad = {number, type, shape, at: PcbXY, rotation, size: PcbXY,
  layers: string[], net: string, drill?: {diameter, slot?: PcbXY,
  offset?: PcbXY}, roundrectRatio?, trapezoidDelta?: PcbXY, maskMargin?,
  primitives?: PcbPadPrimitive[]}`. `drill.slot` is the oval drill size
  (width, height) in pad-local axes.
- `PcbBoardSemantic = {format: "kicad_pcb", source, version, generator,
  thickness?, maskExpansion, layers: {id: number, name: string, type:
  string}[], nets: string[]}`
- `PcbFootprintSemantic = {reference, value, library, at: PcbXY, rotation,
  side: "top" | "bottom", pads: PcbPad[], graphics: PcbGraphicItem[]}`
- `PcbTrackSemantic = {layer, width, net, points: PcbXY[], mid?: PcbXY}`
- `PcbViaSemantic = {at, diameter, drill, layers: readonly [string, string], net}`
- `PcbZoneSemantic = {layers: string[], net, outline: PcbXY[], filled:
  {layer: string, polygons: PcbXY[][]}[]}`
- `PcbGraphicSemantic = PcbGraphicItem`
- `PcbImportPlan = {title: string, board: PcbBoardSemantic, graphics:
  PcbGraphicSemantic[], zones: PcbZoneSemantic[], tracks:
  PcbTrackSemantic[], vias: PcbViaSemantic[], footprints:
  PcbFootprintSemantic[]}`. The reader already sorts `tracks` with bottom
  copper first, then inner, then top.
- `PcbImportResult = {plan?: PcbImportPlan, diagnostics: readonly
  BreadboardImportDiagnostic[]}`
- `PCB_ELEMENT_TYPES = ["pcb.board", "pcb.footprint", "pcb.track",
  "pcb.via", "pcb.zone", "pcb.graphic"] as const`; `PcbElementType`;
  `isPcbElementType(type: string): type is PcbElementType`
- `PCB_PAGE_SCALE = 10` (page units per mm)
- `roundNm(value: number): number`: round to 6 decimals, half away from
  zero, `-0` becomes `0` (imitate
  `packages/io/src/jsonl/canonical.ts:roundCoordinate`).
- `pcbRotate(point: PcbXY, degrees: number): PcbXY` rotates about the
  origin, counter-clockwise as seen on screen with y down:
  `x' = x*cos + y*sin`, `y' = -x*sin + y*cos`. Normalise the angle to
  `[0, 360)` first. For exact multiples of 90 use exact 0/1/-1 values. For
  odd multiples of 45 use `Math.SQRT1_2`. Otherwise use `Math.cos`/`Math.sin`
  of `degrees * Math.PI / 180`. No `Math.hypot`. Do not round inside
  (callers round).

`pcb.ts` imports only `BreadboardImportDiagnostic` (type-only) from
`./breadboard.ts`. It must not import `semantics.ts` (that would be a
cycle).

## Registry (`registry.ts`)

- `category: "node"`, `references: noReferences`,
  `onReferenceDeleted: "detach"`.
- Key orders (`keys`, with `children` for nested objects; declare no
  `coordinates`):
  - board: `format, source, version, generator, thickness, maskExpansion,
    layers, nets`; children `layers: {keys: ["id", "name", "type"]}`
  - footprint: `reference, value, library, at, rotation, side, pads,
    graphics`; children `pads: {keys: ["number", "type", "shape", "at",
    "rotation", "size", "layers", "net", "drill", "roundrectRatio",
    "trapezoidDelta", "maskMargin", "primitives"], children: {drill: {keys:
    ["diameter", "slot", "offset"]}, primitives: {keys: ["width", "fill",
    "shape"]}}}` and `graphics: {keys: ["layer", "width", "fill", "shape"]}`.
    Shape objects: `{keys: ["kind", "start", "mid", "end", "center",
    "radius", "points", "text", "at", "rotation", "size", "thickness",
    "role", "justify", "hidden"]}` wherever a `shape` child appears.
  - track: `layer, width, net, points, mid`
  - via: `at, diameter, drill, layers, net`
  - zone: `layers, net, outline, filled`; children `filled: {keys:
    ["layer", "polygons"]}`
  - graphic: `layer, width, fill, shape` (shape children as above)
- `validateSemantic` (structural only). Emit an issue at the exact path
  for each of:
  - non-finite numbers
  - tuples that are not two finite numbers
  - empty `layer` (empty `reference`, `value`, `library`, `net` and pad
    `number` are allowed)
  - enums: `side`, pad `type` and `shape`, shape `kind`, text `role`,
    justify `horizontal`
  - `pcb.trackPoints`: fewer than 2 points
  - `pcb.trackArc`: `mid` with a point count other than 2
  - `pcb.viaDrill`: not `diameter > drill > 0`
  - `pcb.zoneOutline`: outline with fewer than 3 points
  - `pcb.polygonPoints`: filled polygon, or polygon shape, with fewer than
    3 points
  - track `width <= 0`, pad `size` component `<= 0`, or circle
    `radius <= 0`: `value.min`
  - board `format` other than `"kicad_pcb"`

## Core geometry (`packages/core/src/pcb-board/geometry.ts`)

Pinned exports (mm, board frame):

- `type PcbBounds = {minX, minY, maxX, maxY}`
- `type PcbOutlineSegment = {to: PcbXY, arc?: {center: PcbXY, clockwise:
  boolean}}`. `clockwise` means clockwise as seen from the top. Plan 07
  writes it to Gerber unchanged: clockwise becomes G02.
- `type PcbOutline = {kind: "circle", center: PcbXY, radius: number} |
  {kind: "contour", start: PcbXY, segments: readonly PcbOutlineSegment[]}`
- `footprintToBoard(fp: {at: PcbXY, rotation: number}, local: PcbXY): PcbXY`
  and `boardToFootprint(...)`, the exact inverse. Both use `pcbRotate` and
  do not round.
- `padCopperOutline(fp, pad, grow = 0): PcbOutline`. Total rotation is
  `fp.rotation + pad.rotation`; the centre is `footprintToBoard(fp,
  pad.at)`; every size grows by `2*grow`.
  - circle: radius `size[0]/2 + grow`
  - rect: 4 lines
  - oval: a capsule (2 lines + 2 half arcs); a circle when width equals
    height
  - roundrect: corner radius `roundrectRatio * min(size)` (default ratio
    0.25), plus `grow`
  - trapezoid: the 4 corners with `trapezoidDelta` applied as KiCad does
    (delta x narrows the top edge and widens the bottom edge)
  - custom: the anchor shape (`size`, as a rect when `size` is not square,
    otherwise a circle). Primitives are handled by callers through
    `padPrimitiveOutlines`.
- `padPrimitiveOutlines(fp, pad): PcbOutline[]`: polygon primitives
  transformed to board coordinates
- `outlineContains(outline, point, tolerance = 1e-6): boolean`: even-odd
  test on the contour with arcs (arc segments may be flattened to
  0.001 mm chords for this test only)
- `outlineBounds(outline): PcbBounds`, exact for arcs (axis extremes inside
  the sweep)
- `arcCenter(start, mid, end): PcbXY | undefined` from the three points,
  with arithmetic only; `undefined` when they are collinear
- `arcIsClockwise(start, mid, end): boolean` (cross-product sign, y down)
- `shapeBounds(shape: PcbShape, width: number): PcbBounds`. Arcs use exact
  axis extremes (cross products and `Math.sqrt` only). Text uses
  `strokeTextWidth` from `../pcb/font.ts`, with height `size[1]`,
  justification and rotation.
- `footprintBounds(fp): PcbBounds`: the union of the pad outlines and the
  transformed graphics
- `expandCopperLayers(layers, copper: readonly string[]): string[]`.
  `*.Cu` gives all of `copper`; `F&B.Cu` gives `F.Cu` and `B.Cu`; other
  names ending in `.Cu` are kept as is. The result follows the order of
  `copper`, followed by unknown copper names.
- `padHasCopperLayer(pad, layer, copper): boolean`
- `pageCopperLayers(board: PcbBoardSemantic | undefined): string[]`: the
  names ending in `.Cu` in table order, or `["F.Cu", "B.Cu"]` when there is
  no board element
- `viaCopperLayers(via, copper): string[]`: every copper layer from
  `layers[0]` to `layers[1]` in `copper` order
- `class PcbGrid<T>`:
  - `constructor(cell = 2.54)`
  - `insert(item: T, bounds: PcbBounds): void`
  - `query(bounds: PcbBounds): T[]`: unique items, in insertion order.
    Cells are keyed as `${ix},${iy}`. Deduplicate with a `Set`; do not use
    array `includes` (that would be quadratic).
- `pcbAnchor(type: PcbElementType, semantic): PcbXY | undefined`:
  - footprint and via: `at`
  - track: `points[0]`
  - zone: `outline[0]`
  - graphic: `start` (line, arc, rect), `center` (circle), `points[0]`
    (polygon) or `at` (text)
  - board: `undefined`
- `translatePcbSemantic(type, semantic, dx, dy)`: returns a new semantic
  with every coordinate moved and rounded with `roundNm`:
  - footprint: `at` only (pads and graphics are local)
  - via: `at`
  - track: `points` and `mid`
  - zone: `outline` and every filled polygon
  - graphic: every point of its shape
  - board: unchanged

## Page builder (`page.ts`) and test builder

- `pcbPageFromPlan(plan, {pageId?: string, pageName: string, reservedIds?:
  Iterable<string>}): {page: Page, elements: Element[]}`
  - Page: `{id: pageId ?? "pcb-page-1", name: pageName, kind: "pcb"}`.
  - Element order (and indexes `a000001`, `a000002`, ...): board, then
    graphics, zones, tracks, vias, footprints, each in plan order.
  - Ids: `pcb-board`, `graphic-<n>`, `zone-<n>`, `track-<n>`, `via-<n>`
    (1-based within the kind), and `fp-<reference>` for footprints, where
    the reference keeps `[A-Za-z0-9_-]` and every other character becomes
    `_`. An empty reference gives `fp-<n>`. Ids are made unique with the
    `-2`, `-3` suffix rule of `pcb-import.ts`.
  - `visual: {}` on every element.
- `pcbDocumentFromPlan(plan, {pageName, title?, documentId?}): Document`:
  `schemaVersion: SCHEMA_VERSION`, `id` `documentId ?? "pcb-document"`,
  `title` `title ?? plan.title`; it calls `assertValidDocument`.
- `test-builder.ts`: `buildPcbDocument(spec: {board?:
  Partial<PcbBoardSemantic>, footprints?, tracks?, vias?, zones?,
  graphics?}): Document`. It fills a default board (layers F.Cu id 0 and
  B.Cu id 31 with type `signal`, F.SilkS, B.SilkS, F.Mask, B.Mask,
  Edge.Cuts; nets from the items) and goes through `pcbDocumentFromPlan`.
  It is used by plans 05-08. It is test support, not a public export.

## Pitfalls

- `noUncheckedIndexedAccess`-style safety: destructure tuples
  (`const [x, y] = point`); never index without a fallback.
- Do not add PCB keys to any `coordinates` list. The writer would then
  round them to 0.01 and break losslessness (design 3.4).
- `pcbRotate(p, 90)` must give exactly `[y, -x]` for `p = [x, y]`, with no
  `6.1e-17` residue. Test it.
- Do not use `Math.hypot`, `Math.atan2` or trigonometry in `geometry.ts`,
  except through `pcbRotate`.
- `PCB_ELEMENT_TYPES` lives in `pcb.ts`; `semantics.ts` only imports the
  types for `SemanticByType`.

## Tests (input -> expected)

- `packages/ir/src/pcb.test.ts`:
  - `pcbRotate([1, 0], 90)` -> `[0, -1]`; 180 -> `[-1, 0]`; 45 -> exactly
    `[Math.SQRT1_2, -Math.SQRT1_2]`; -90 equals 270; 30 is close to the
    cos/sin result.
  - `roundNm(1.0000004)` -> `1`; `roundNm(-0.0000001)` -> `0` (not `-0`).
  - A document from a minimal valid semantic of each type passes
    `validateDocument` with no issues.
  - Each issue code is produced by its broken input: track with 1 point
    -> `pcb.trackPoints`; `mid` on a 3-point track -> `pcb.trackArc`; via
    with drill >= diameter -> `pcb.viaDrill`; zone with 2 outline points
    -> `pcb.zoneOutline`; filled polygon with 2 points ->
    `pcb.polygonPoints`; empty track `layer` -> an issue; bad `side` ->
    an enum issue.
  - Page kind `pcb` validates; `isPcbElementType("pcb.via")` is true.
- `packages/ir/src/registry.test.ts`: the sorted list includes the six
  types.
- `packages/core/src/pcb-board/geometry.test.ts`:
  - `boardToFootprint(fp, footprintToBoard(fp, p))` equals `p` within
    1e-9 for rotations 0, 45, 90, 30.
  - A rect pad 2x1 on a footprint at 90: `outlineBounds` is 1 wide and
    2 tall.
  - `outlineContains`: inside, outside and edge points for circle, rect
    (rotated 45), oval and roundrect.
  - `arcCenter` for a known quarter circle; collinear points ->
    `undefined`.
  - `shapeBounds` of a quarter arc includes its axis extreme.
  - `expandCopperLayers(["*.Cu"], ["F.Cu", "In1.Cu", "B.Cu"])` -> all
    three; `["F&B.Cu"]` -> F.Cu and B.Cu.
  - `PcbGrid` with 1000 items: `query` returns each matching item once.
  - `translatePcbSemantic` of a zone moves the outline and all fills,
    rounded to nm.
  - `pcbAnchor` for each type.
- `packages/core/src/pcb-board/page.test.ts`:
  - A plan with 2 footprints `R1`, `R1` -> ids `fp-R1`, `fp-R1-2`.
  - Element order and indexes are as pinned.
  - Two runs give deep-equal output (deterministic).
  - `pcbDocumentFromPlan` output passes `assertValidDocument`.
  - `buildPcbDocument({})` is valid.

## Verification (record exit code and summary lines)

1. `bun test packages/ir/src packages/core/src/pcb-board` exits 0; record
   the pass count.
2. `bun run typecheck` exits 0. If another exhaustive `Record<PageKind>`
   outside writePaths fails, stop and record it; do not edit that file.
3. `bunx biome check packages/ir/src/pcb.ts packages/ir/src/pcb.test.ts packages/ir/src/types.ts packages/ir/src/semantics.ts packages/ir/src/registry.ts packages/ir/src/registry.test.ts packages/ir/src/index.ts apps/cli/src/types-command.ts packages/core/src/pcb-board --diagnostic-level=warn`
   exits 0.
4. `grep -nE "Math\.(hypot|atan2|sin|cos)" packages/core/src/pcb-board/geometry.ts`
   prints nothing.
5. `bun test packages/io/src/jsonl apps/cli/src/commands.test.ts` exits 0
   (existing round trips and the types output still pass).

## Done criteria (mechanical)

- `grep -c '"pcb"' packages/ir/src/types.ts` is at least 1.
- `grep -c "pcb\\." packages/ir/src/registry.test.ts` is at least 6.
- All verification steps are recorded with exit code 0.
- `git status --short` lists only files in writePaths.
