# PCB Pages from KiCad Boards

Status: design record, revision 3, for branch `feat/kicad-pcb`.
Revision 2 (session 535) pins the pad drill offset: the anchor and shape
centre of section 3.2, and their use in sections 6.3 and 7.3. No other
decision changed.
Revision 3 (session 536) syncs the text with the committed plans 01-08
(`6865464`, `cf0c4d7`, `8181d51`) before plans 09-13: the page builder
signature (section 4.1), the CLI summary stream (section 8), the location
of the lossless JSONL test (section 11) and the pointer to the plans
(section 12). No behaviour changed.
Issue: "Add a PCB page kind: KiCad .kicad_pcb import, desktop editing,
lossless JSONL, Gerber and drill export" (workflow input only, no GitHub
issue number; execution `opus-luna-design-and-implement-review-loop-session-530`).

Baseline: commit `565419f`. No earlier design covers a PCB page kind.
Related records, which this one extends and does not replace:

- `design-docs/specs/design-breadboard.md`: page-kind pattern (section 3),
  editor planners (section 4.4), net highlight and ratsnest as transient
  overlays (sections 5.2, 5.3), KiCad s-expression reader (section 8.6.1).
- `design-docs/specs/design-breadboard-pcb.md`: the `packages/core/src/pcb/`
  fabrication folder, its boundary test, file names, X2 attributes, the
  Excellon coordinate format, and the TS/native determinism rules
  (sections 5, 7.1 item 5, 7.5, 11.1).

Open user decisions, each with a default, are in
`design-docs/user-qa/kicad-pcb.md`.

## 1. Context (facts at `565419f`)

- `PAGE_KINDS` (`packages/ir/src/types.ts`) ends with `"breadboard"`. A page
  kind selects the palette and never restricts element types. Validation
  checks `page.kind` against `PAGE_KINDS`. `SCHEMA_VERSION` is 1; the
  breadboard kind was added without a version bump.
- Element types live in `packages/ir/src/registry.ts` with a `keyOrder` and a
  structural `validateSemantic`. The JSONL writer
  (`packages/io/src/jsonl/canonical.ts`) rounds to 0.01 only keys listed in a
  key order's `coordinates`; every other number is written with
  `JSON.stringify`, so a double round-trips exactly.
- `packages/io/src/kicad/sexpr.ts`: iterative tokenizer and reader
  (`readSexpr`, `atomAt`, `child`, `children`, `numberAt`, `SEXPR_SLOT`),
  depth cap 256, no regex split. `child`/`children` scan a list, so calling
  them per item on the board root would be quadratic.
- `importKicad` (`packages/io/src/kicad/index.ts`) dispatches `kicad_sch` and
  `export` roots to breadboard import plans and rejects other roots.
- `packages/core/src/pcb/`: `GerberLayer` (circle/square flashes, round
  strokes), `excellonDrill` (plated holes, three-decimal coordinates),
  `pcbFabricationFiles` (breadboard `PcbDesign` to GTL, GBL, GTS, GBS, GTO,
  GKO, DRL), `readGerber`, `readExcellon` (arcs, regions, macros, G85 slots),
  `layers.ts`, `font.ts`. `boundary.test.ts` forbids imports from outside
  the folder. The breadboard goldens in `examples/breadboard/` pin the
  writer output byte for byte.
- `packages/core/src/pcb-import.ts` is the existing Gerber import (to a
  freeform page). It is not changed.
- `Editor.apply` (`packages/core/src/editor.ts`) runs derived planners such
  as `planBreadboardTranslations`. `Editor.moveElements` takes absolute
  targets (`origin + delta`) on every pointer move, and has a semantic
  branch for free `edge.generic` points. `movableSelection` supplies the
  drag origins.
- Desktop: `apps/desktop/src/file/session.ts` routes `.kicad_sch`/`.net`
  to breadboard import and Gerber extensions to `importPcbPath` (a detached,
  unsaved document). `apps/desktop/src-tauri/src/dialogs.rs` holds
  `OPEN_FILTER_EXTENSIONS`. `page-workspace.ts` maps page kinds to
  workspaces. `apps/cli/src/types-command.ts` has an exhaustive
  `Record<PageKind, ...>`.
- CLI: `commands.ts` dispatches by command name; `gerber-command.ts` and
  `breadboard-command.ts` are the models. The native CLI (`apps/cli/native`,
  Boa 0.22) runs the same bundle, so new subcommands need no Rust
  registration. `native-parity.test.ts` runs only under `mise run test-cli`.
  Boa limits: 512 recursive calls, 100 million iterations per loop.
- No `.reference/kicad` tree exists. The reader is written from public
  knowledge of the format.

## 2. Scope

In scope:

1. Page kind `pcb` and six `pcb.*` element types (section 3).
2. A `.kicad_pcb` reader for KiCad 5 to 9 board files (section 4).
3. Editing: move and rotate footprints with attached track ends following;
   add, edit and delete tracks and vias on a chosen layer and net; net
   highlight and net selection; ratsnest; layer visibility (sections 5, 6).
4. Lossless JSONL save and reload (section 3.4).
5. Gerber X2 and Excellon export through the `packages/core/src/pcb`
   writers (section 7).
6. CLI `pcb import` and `pcb gerber`, TS and native (section 8).
7. Desktop Open dialog and Export dialog entries (section 9).
8. Docs and tests (sections 10, 11).

Out of scope: writing `.kicad_pcb`, autorouting, zone refill, DRC, flipping
a footprint to the other side, creating nets, paste and fabrication-layer
Gerbers, inner-layer Gerbers, pick-and-place, SVG/PNG export of PCB pages
(existing fallback rendering applies), MCP tools, changes to the Gerber
import, changes to breadboard export bytes, `SCHEMA_VERSION` changes.

## 3. Data model (`packages/ir`)

### 3.1 Page kind, frame and units

- Append `"pcb"` to `PAGE_KINDS`. No migration and no `SCHEMA_VERSION` bump,
  as with `breadboard`.
- All PCB geometry lives in `semantic`, in millimetres, in the KiCad board
  frame: x right, y down. Angles are degrees, counter-clockwise as seen from
  the top on screen (KiCad's convention).
- Page position is `mm * PCB_PAGE_SCALE` with `PCB_PAGE_SCALE = 10`, the
  same scale the Gerber import uses. There is no offset and no y flip on the
  page.
- `visual` of every `pcb.*` element carries only `hidden` and `locked`.
  `x`, `y`, `width`, `height` and `rotation` are never written (section 5.1
  explains how generic moves are redirected). Bounds come from the shape
  utils (section 6.1).
- Points are `PcbXY = readonly [number, number]` tuples, which keeps zone
  fills compact.
- Rotation of a footprint-local point `p` by angle `a` about anchor `at`:
  `x = at.x + p.x*cos(a) + p.y*sin(a)`, `y = at.y - p.x*sin(a) + p.y*cos(a)`.
  `pcbRotate` (in `packages/ir/src/pcb.ts`) uses exact values for multiples
  of 90 degrees and `Math.SQRT1_2` for odd multiples of 45, and
  `Math.cos`/`Math.sin` otherwise. Values that become stored or exported
  coordinates are rounded to 1 nm (`roundNm`, 6 decimals) by the operation
  that computes them. `Math.hypot` is not used.

### 3.2 Element types

`packages/ir/src/pcb.ts` (new, modelled on `breadboard.ts`) exports the
semantic interfaces, `PCB_ELEMENT_TYPES`, `isPcbElementType`,
`PCB_PAGE_SCALE`, `pcbRotate`, `roundNm` and the enums. All types are
`category: "node"`, reference no other element (`references` returns `[]`,
`onReferenceDeleted: "detach"`). Nets are referenced by name; `""` means no
net.

| Type | Semantic payload |
| --- | --- |
| `pcb.board` | `format: "kicad_pcb"`, `source` (file name), `version` (the file's `version` atom), `generator` (may be empty), `thickness` (mm, optional), `maskExpansion` (setup `pad_to_mask_clearance`, default 0), `layers: {id, name, type}[]` (the file's layer table, in file order), `nets: string[]` (every named net in file order, net 0 excluded) |
| `pcb.footprint` | `reference`, `value`, `library` (footprint lib id, may be empty), `at: PcbXY`, `rotation`, `side: top\|bottom`, `pads: PcbPad[]`, `graphics: PcbGraphic[]` (local coordinates) |
| `pcb.track` | `layer`, `width`, `net`, `points: PcbXY[]` (at least 2), `mid?: PcbXY` (arc track through `mid`; only with exactly 2 points) |
| `pcb.via` | `at`, `diameter`, `drill`, `layers: [string, string]`, `net` |
| `pcb.zone` | `layers: string[]` (at least 1), `net`, `outline: PcbXY[]` (at least 3), `filled: {layer, polygons: PcbXY[][]}[]` (as read; may be empty) |
| `pcb.graphic` | `layer`, `width`, `fill: boolean`, `shape: PcbShape` (board coordinates) |

`PcbPad`: `number` (string, may be empty), `type: thru_hole|smd|np_thru_hole|connect`,
`shape: circle|rect|oval|roundrect|trapezoid|custom`, `at: PcbXY` (local),
`rotation` (relative to the footprint), `size: PcbXY`, `layers: string[]`
(as read, including `*.Cu`, `*.Mask`, `F&B.Cu`), `net`, optional
`drill: {diameter, slot?: PcbXY, offset?: PcbXY}`, `roundrectRatio`,
`trapezoidDelta: PcbXY`, `maskMargin`, `primitives: PcbShape[]` (custom
pads: polygons, with `width`).
`drill.offset` is KiCad's pad shape offset. A pad has two reference
points in board millimetres:

- the pad anchor `A = footprintToBoard(fp, at)`: the hole position (DRL
  hit or slot centre, and the hole drawn in the view), the ratsnest end
  point, the pad point tested against zone fills (section 5.5) and the
  Track/Via tool snap point (section 6.4). For a KiCad-valid pad the anchor
  lies inside the pad copper, so these contacts are unchanged by the offset;
- the shape centre `S = A + pcbRotate(offset, fp.rotation + pad.rotation)`
  (`S = A` without an offset): the centre of the copper, mask and paste
  shapes and the origin of custom primitives (section 6.3), and the
  position of a Gerber pad flash (section 7.3).

The offset never moves the hole. A bottom-side offset is used as read, like
the rest of the pre-mirrored local geometry (section 4.3).

`PcbShape` (shared by footprint graphics, pad primitives and board
graphics):

- `{kind: "line", start, end}`
- `{kind: "arc", start, mid, end}`
- `{kind: "circle", center, radius}`
- `{kind: "rect", start, end}`
- `{kind: "polygon", points}`
- `{kind: "text", text, at, rotation, size: PcbXY, thickness, role?: reference|value|user, justify?: {horizontal?: left|right, mirror?: boolean}, hidden?: boolean}`

Footprint graphics carry their own `layer`, `width` and `fill` like
`pcb.graphic`. A `role: reference|value` text draws the footprint's current
`reference`/`value`, so renaming a footprint updates its silkscreen.

### 3.3 Validation (`registry.ts`, structural only)

- Strings: `layer` must be non-empty; `reference`, `value`, `library`,
  `net` and pad `number` may be empty. Enums above, finite numbers,
  `width > 0` for tracks,
  `diameter > drill > 0` for vias, `size` components `> 0`, tuples of two
  finite numbers, minimum lengths (track 2 points, zone outline 3, filled
  polygon 3), `mid` only on a 2-point track.
- Issue codes: `pcb.trackPoints`, `pcb.trackArc`, `pcb.viaDrill`,
  `pcb.zoneOutline`, `pcb.polygonPoints`.
- Electrical or geometric correctness (dangling tracks, unknown nets,
  overlapping copper) is never a document error.
- Key orders: board `format, source, version, generator, thickness,
  maskExpansion, layers, nets`; footprint `reference, value, library, at,
  rotation, side, pads, graphics` (pad children in the `PcbPad` order
  above); track `layer, width, net, points, mid`; via `at, diameter, drill,
  layers, net`; zone `layers, net, outline, filled`; graphic `layer, width,
  fill, shape`. No PCB key is declared in `coordinates`, so nothing is
  rounded by the writer.

### 3.4 Lossless JSONL

- The writer emits semantic numbers with `JSON.stringify`, which
  round-trips doubles. Importer values come from `Number(atom)`; edit
  results are rounded to 1 nm by the operation. Save and reload therefore
  give a deep-equal document and byte-identical re-serialisation.
- Element order from import (fractional index, ascending): `pcb.board`,
  graphics, zones, tracks (bottom copper first, then inner, then top), vias,
  footprints, each group in file order. This order is also the draw and
  hit-test order (section 6.2).
- No collab-specific work: elements sync as any other element.

## 4. KiCad board reader (`packages/io/src/kicad/pcb.ts`)

### 4.1 Interface

- `importKicadPcb(text, {fileName}): {plan?: PcbImportPlan, diagnostics}`,
  exported from `@nodetto/io/kicad` and the package index. `PcbImportPlan`
  (typed in `packages/ir/src/pcb.ts`) holds `board`, `footprints`, `tracks`,
  `vias`, `zones`, `graphics` semantics in section 3.4 order. Diagnostics
  reuse `BreadboardImportDiagnostic` (`severity`, `code`, `message`, `line`,
  `column`, `reference`).
- `importKicad` gains one branch: root `kicad_pcb` returns the error
  `kicad.pcbRoot` ("KiCad board files open as PCB pages; use pcb import.")
  so `breadboard import board.kicad_pcb` fails clearly. Its result type is
  unchanged.
- `packages/core/src/pcb-board/page.ts`: `pcbPageFromPlan(plan,
  {pageName, pageId?, reservedIds?})` returns a page of kind `pcb` and its
  elements, with fractional indexes in plan order.
  `pcbDocumentFromPlan(plan, {pageName, title?, documentId?})` wraps it in
  a new single-page document with deterministic default ids. The CLI and
  desktop call `importKicadPcb` then `pcbDocumentFromPlan(plan, {pageName:
  plan.title})`. Both are published from `@nodetto/core` through the
  `pcb-board/index.ts` barrel (plan 09).

### 4.2 Parsing rules

- One pass over the root list's items, dispatching on each item's keyword.
  Within an item, fields are read in one pass into a keyword map; no
  repeated `child` scans over the root. No recursion except over KiCad
  nesting, which `readSexpr` already caps at depth 256. No regex split.
- Root `kicad_pcb` required; otherwise `kicad.unknownRoot` (error). A
  `version` below `20171130` gives the warning `kicad.oldVersion` and is
  read on a best-effort basis.
- Numbers are parsed with `Number`; a non-finite value drops the item with
  `kicad.badNumber` (warning, with line and column).

### 4.3 Version differences handled

| Topic | KiCad 5 | KiCad 6 to 9 |
| --- | --- | --- |
| Footprint keyword | `module` | `footprint` |
| Reference, value | `fp_text reference R1`, `fp_text value 10k` | same in 6 and 7; `property "Reference" "R1"` and `property "Value" "10k"` in 8 and 9 |
| Quoting | mostly bare atoms | quoted strings and layers; the reader ignores the `quoted` flag |
| Net on items | `(net 3)` code, or `(net 3 "GND")` on pads | `(net 3)` / `(net 3 "GND")`; a name-only `(net "GND")` is also accepted |
| Net table | root `(net N name)` | same; net 0 (empty name) is "no net" |
| Arcs | `(start center) (end arcStart) (angle deg)` on `gr_arc`/`fp_arc` | `(start) (mid) (end)` |
| Circle | `(center) (end pointOnCircle)` | same |
| Stroke width | `(width w)` | `(width w)` or `(stroke (width w) (type ...))` |
| Fill | absent | `(fill solid\|yes\|none)` |
| Track arcs | none | `(arc (start) (mid) (end) (width) (layer) (net))` |
| Silkscreen name | `F.SilkS` | `F.SilkS`; a user name such as `F.Silkscreen` in item `layer` atoms is mapped to the canonical name through the layer table |
| Identity | `tstamp` | `tstamp` or `uuid`; both ignored |

- KiCad 5 arcs are converted to start/mid/end with `pcbRotate` about the
  centre (end at `+angle`, mid at `+angle/2`; KiCad 5 angles are clockwise
  on screen, so the sign is applied once in one helper) and rounded to 1 nm.
- Pad and footprint text `at` angles in the file are board-absolute. The
  reader subtracts the footprint rotation and normalises to `[0, 360)`.
  Local positions are stored as read; a bottom-side footprint's local
  geometry is already mirrored in the file, so no mirroring is applied and
  `side` comes from the footprint `layer` (`B.Cu` gives `bottom`).
- Zones: `net` from `net_name` (or `net` code), `layers` from `layer` or
  `layers`, `outline` from `polygon (pts ...)`, fills from each
  `filled_polygon` (its `layer`, or the zone's single layer). Rule areas
  (`keepout` or `rule_area` zones) are skipped with `kicad.ruleArea`.
- `pts` with an `(arc ...)` entry (KiCad 7+) keeps the arc's start, mid and
  end as plain points, with `kicad.polygonArc` (warning).
- Skipped with one warning per kind and a count: `dimension`, `target`,
  `group` (members are still read), `image`, `gr_bbox`, `gr_text_box`,
  pad primitives other than `gr_poly`, `model`. Code
  `kicad.unsupported`.
- Pads with an unknown shape become `custom` with no primitives and
  `kicad.padShape` (warning).

## 5. Editing (`packages/core/src/pcb-board/`)

### 5.1 Moving

- `Editor.movableSelection` reports each `pcb.*` element with its anchor in
  page units: footprint and via `at`, track first point, zone first outline
  point, graphic `start` (line, arc, rect), `center` (circle), first point
  (polygon) or `at` (text), times `PCB_PAGE_SCALE`. `pcb.board`
  is not movable.
- `Editor.moveElements` gains a `pcb.*` branch: `dx = (move.x -
  anchor.x) / PCB_PAGE_SCALE` (same for y), computed against the current
  anchor, then one `updateSemantic` that translates every coordinate of the
  element (zone fills too) and rounds to 1 nm. No visual field is written,
  so absolute drag targets never accumulate. The no-op check compares
  against the anchor for these elements.
- Locked elements are not moved, as elsewhere.

### 5.2 Rotating

- `Editor.rotatePcbFootprints(ids, degrees)` adds `degrees` to each
  footprint's `rotation` about its `at` and normalises to `[0, 360)`. The R
  key in the PCB workspace calls it with 90. Pad and text rotations are
  relative, so they do not change.
- The generic rotate and resize handles are not offered for `pcb.*`
  (`canResize: false`; the selection overlay hides rotation for `pcb.*`).
  The inspector's rotation field calls `rotatePcbFootprints` with the
  difference.

### 5.3 Track ends follow footprints

`planPcbTrackFollow(before, draft)` runs in `Editor.apply` after
`planBreadboardTranslations`, guarded the same way (a `pcb` page or a
`pcb.*` element in either store).

1. A footprint is changed when its `at` or `rotation` differs between the
   stores.
2. For each changed footprint and each pad with a copper layer, the old pad
   copper shape is computed (section 6.3). For each `pcb.track` on the same
   page that is unchanged in the batch, each end point (first and last
   point) that lies inside the old shape of a pad on the track's layer is
   attached to that pad (first pad in pad order wins).
3. An attached end is mapped through the old footprint transform inverse
   and the new transform, so its offset inside the pad is kept. Interior
   points do not move.
4. An arc track (`mid`) with one end moved gets `mid` = new chord midpoint
   plus the old sagitta vector rotated to the new chord direction and
   scaled by the chord length ratio (arithmetic only). With both ends moved
   by the same footprint, `mid` gets the same rigid transform.
5. Vias, zones and graphics never follow. Tracks attached only to other
   tracks do not move.
6. Candidate tracks come from the spatial index (section 6.3) over the old
   footprint bounds, so the cost scales with the moved footprints' local
   copper, not with the board.

### 5.4 Tracks and vias

- `Editor.addPcbTrack(pageId, {layer, width, net, points})` and
  `Editor.addPcbVia(pageId, {at, diameter, drill, net, layers})` create one
  element. A new track's index sits just above the last existing track (or
  above the last zone, graphic or board when there is none); a new via's
  just above the last via (or the last track), so the section 3.4 order is
  kept. Points are rounded to 1 nm.
- Edits of width, layer, net, diameter, drill and end points are ordinary
  `updateSemantic` commands from the inspector or handles; deletion is the
  generic delete. All are undoable.
- Defaults: track width 0.25 mm, via 0.6 mm diameter and 0.3 mm drill,
  via layers `F.Cu`/`B.Cu`. The PCB tool options remember the last values
  for the session.
- The net of a new track or via is the net of the copper item under its
  first point (pad, track end or via), otherwise the net chosen in the tool
  options (default no net). The net list is `pcb.board.nets` plus any net
  name used on the page, sorted by code unit; new nets are not created.

### 5.5 Connectivity, ratsnest, highlight

`computePcbConnectivity(document, pageId)` (pure, memoised per store
revision in the UI):

- Nodes: pads (footprint id, pad index), tracks, vias, zone fill polygons.
  Visible-only rule: hidden elements are ignored.
- Contacts on a shared copper layer (a pad's layers expand `*.Cu` and
  `F&B.Cu` to every copper layer in the board's layer table, or
  `F.Cu`/`B.Cu` when there is no board element; a via spans every copper
  layer between its two layers):
  - a track end inside a pad's copper shape, or within `width/2 + 1e-3`
    of another track's centreline on the same layer;
  - a via centre inside a pad's copper shape, or a track end within the
    via radius;
  - a pad anchor (section 3.2), via centre or track end inside a zone fill polygon of the
    same layer (point in polygon, even-odd).
- Spatial index: per copper layer, a uniform grid of 2.54 mm cells; each
  item is inserted in the cells its bounds cover, and contacts are tested
  only within shared cells. Union-find joins contacts.
- `computePcbRatsnest(document, pageId, connectivity)`: for each net other
  than `""` with two or more pads, group its pads by connectivity
  component. With g > 1 groups, Prim's tree over the groups by squared
  Euclidean pad-anchor distance gives g - 1 lines
  `{net, from: {footprintId, pad, x, y}, to: {...}}`. Ties: footprint
  element order, then pad index. Copper of a different net never joins
  groups of this net, so a short does not hide a missing connection. The
  breadboard ratsnest is not reused: it is bound to the breadboard lattice
  and target netlist.
- `pcbNetHighlight(document, pageId, net)` returns pad refs, track, via and
  zone ids on the net. `pcbNetMembers(document, pageId, net)` returns the
  element ids to select: tracks, vias and zones on the net and footprints
  with at least one pad on it, in element order.

## 6. Rendering and UI (`packages/ui-solid`)

### 6.1 Shape utils (`packages/core/src/shapes/pcb.ts`)

Registered in `createDefaultRegistry`. Bounds from semantic times
`PCB_PAGE_SCALE`: footprint = rotated local bounds of pads and graphics;
track = points grown by `width/2`; via = circle; zone = outline;
graphic = shape grown by `width/2`; `pcb.board` = `null` (not drawn, not
selectable on the canvas). Hit tests: footprint box; track within
`max(width/2, 0.1 mm)` of its centreline; via disc; zone within 0.25 mm of
its outline edge only (so clicks inside a pour reach the items on it);
graphic near its stroke or inside a filled shape.

### 6.2 Views

- `packages/ui-solid/src/shapes/PcbShapeView.tsx` with a pure view model
  `pcb-view.ts`, following `BreadboardShapeView.tsx`/`breadboard-view.ts`.
  Each element draws its own geometry in page units; layer stacking within
  the page follows the import order (section 3.4). Colours are our own
  constants: top copper red, bottom copper blue, inner copper amber, zones
  translucent, silkscreen pale yellow, fabrication grey, Edge.Cuts light
  grey, holes dark. Text uses `strokeText` from `packages/core/src/pcb`.
- Layer visibility is transient UI state per page (user QA Q1): a set of
  hidden layer names. A footprint draws only its visible layers; an element
  whose layers are all hidden is not drawn and not hit-tested.
- `PcbOverlay.tsx` (like `BreadboardOverlay.tsx`): ratsnest as thin dashed
  lines, net highlight as a glow on pads, tracks, vias and zone outlines.
  Both are transient and never written to the document.

### 6.3 Pad copper shapes

`padCopperOutline` gives one outline per pad on a layer, in board
millimetres: circle (centre, radius) or a contour of lines
and arcs (rect, oval as a capsule, roundrect with corner radius
`roundrectRatio * min(size)`, trapezoid from `trapezoidDelta`, custom as the
anchor shape plus its polygons). The outline (and every custom primitive)
is centred on the shape centre `S` of section 3.2, rotated by
`fp.rotation + pad.rotation`; the hole stays at the anchor `A`.
`padCopperOutline` and `padPrimitiveOutlines` in
`packages/core/src/pcb-board/geometry.ts` implement this, so footprint
bounds and hit tests (section 6.1), track-end and via contacts (section
5.5), track follow (section 5.3), the view and the Gerber regions and
flashes (section 7.3) all use the same offset shape, and the editor and the
export agree.

### 6.4 Workspace, tools and inspector

- Workspace `pcb` (label "PCB") with tools Select, Track and Via. The tool
  options show the active copper layer (copper layers of the board, default
  `F.Cu`), the net, track width and via sizes.
- Track tool: click a start point (snapped to the pad anchor, via centre or
  track end under the pointer, else free), click to add vertices, double
  click or Enter to finish with one `pcb.track`, Esc to cancel. Via tool:
  click to place one `pcb.via` (snapped the same way).
- Hovering a pad, track or via highlights its net. The inspector of a
  selected item shows a "Select net" action (`pcbNetMembers`).
- A Layers section lists the board's layers present on the page with a
  visibility checkbox each.
- Inspector `PcbSection.tsx`: footprint reference, value, x, y (mm),
  rotation, side (read only), pad count; track layer, width, net; via
  diameter, drill, net; zone layers, net, fill count (read only).
- `R` rotates selected footprints by 90 degrees; Delete deletes.

## 7. Gerber and drill export

### 7.1 Interface

`exportPcbBoard(document, pageId, {name}): PcbBoardExport | string`
(`packages/core/src/pcb-board/export.ts`, error string when the page has no
Edge.Cuts geometry or no pcb page) returns `{width, height, files,
warnings, notes}`. `encodePcbBoardZip` writes the stored ZIP with
`encodeStoredZip`, as the breadboard export does. The adapter lives outside
`packages/core/src/pcb/`; the folder keeps its boundary.

### 7.2 Writer additions in `packages/core/src/pcb/` (additive)

- `GerberLayer.flashAperture(aperture, at)` with
  `{kind: "circle", diameter}`, `{kind: "rectangle", width, height}` and
  `{kind: "obround", width, height}` (templates `C`, `R`, `O`).
- `GerberLayer.region(contours)`: `G36*`, contour moves and draws, `G37*`,
  with arc segments. `GerberLayer.arc(width, start, end, center, clockwise)`
  for arc strokes. `G75*` is written once in the body before the first arc,
  and `G01*` after each arc block, so files without arcs are unchanged.
- `excellonDrill(hits, generator, layers, options?)` gains
  `options.plating: "plated" | "nonPlated"` (default plated, same bytes) and
  slot hits `{diameter, from, to}` written as `X..Y..G85X..Y..`.
- Existing `flash`, `stroke`, `text`, `pcbFabricationFiles` and the
  breadboard path stay byte-identical; the breadboard goldens prove it.

### 7.3 Mapping

- Frame: Gerber `gx = x - minX`, `gy = maxY - y`, where `minX`/`maxY` is the
  extent of the Edge.Cuts centrelines (lines, rect corners, polygon points,
  circle extremes, and arc start, end and the axis extremes inside the
  sweep, found with cross products and `Math.sqrt` only). Origin bottom-left,
  as in the breadboard export. `width`/`height` are that extent.
- Copper (F.Cu to GTL, B.Cu to GBL): pads on that layer (circle as `C`;
  rect and oval at a multiple of 90 degrees total rotation as `R`/`O` with
  swapped sizes at 90/270, each flashed at the shape centre `S`; every
  other pad as a region of its section 6.3 outline), tracks (strokes; arc tracks as arc strokes with the centre from
  the three points), vias (circle flash on both layers), zone fills on that
  layer (dark regions), and graphics on that copper layer.
- Solder mask (GTS, GBS, Negative): openings for pads whose layers include
  that side's mask (`*.Mask`, `F.Mask`, `B.Mask`), the pad shape grown by
  `maskMargin` or else `pcb.board.maskExpansion`; graphics on the mask
  layer. Vias are tented (no opening).
- Silkscreen: F.SilkS to GTO; B.SilkS to GBO, which is written only when
  bottom silkscreen exists. Footprint and board graphics and visible texts;
  text strokes from `strokeText` with the KiCad height, justification,
  mirror and rotation applied, width = text thickness.
- Outline (GKO, `Profile,NP`): every Edge.Cuts graphic, board or footprint,
  stroked at its width (0.1 mm when the width is 0); circles as two
  half-circle arcs.
- Drill (DRL, `Plated,1,2,PTH`): via drills and `thru_hole` pad drills;
  round drills as one hit at the anchor `A`; oval drills as slots along
  the pad's rotated long axis (`fp.rotation + pad.rotation`), centred on
  `A`, with diameter `min(slot)` and end centres `max(slot) - min(slot)`
  apart; `drill.offset` moves the copper, mask and paste shapes, not the
  hole (section 3.2). `np_thru_hole` drills go to `<name>-NPTH.DRL`
  (`NonPlated,1,2,NPTH`), written only when present. Drill coordinates and
  tool diameters are written at the existing Excellon resolution of
  0.001 mm (three decimals, as in the breadboard export); finer hole
  positions, for example on rotated footprints, are rounded by the writer.
- Archive order: GTL, GBL, GTS, GBS, GTO, GBO (if any), GKO, DRL,
  `-NPTH.DRL` (if any). `<name>` is the sanitised output stem (CLI) or page
  name (desktop), as in the breadboard export.
- Inner copper items (`In*.Cu`) are left out, with the warning
  `The board has inner copper layers (<names>); only F.Cu and B.Cu are exported.`
  Other warnings: characters the font lacks (as the breadboard wording), a
  copper zone with no fill (`Zone on <net> has no fill; refill it in KiCad.`).
  Note: `Board <w> x <h> mm, 2 layers, <n> plated holes, <k> footprints.`
  plus, when zones exist, `Zone fills are exported as read from the KiCad file; they are not refilled after edits.`
- Determinism: arithmetic only, except `pcbRotate` for rotations that are
  not multiples of 45 degrees. Equal input gives equal bytes.

## 8. CLI (`apps/cli/src/pcb-command.ts`)

- `nodetto-cli pcb import <file.kicad_pcb> [--output <doc.jsonl>]
  [--strict]`: reads the board, builds a new document with one `pcb` page
  named after the file stem, validates it, and writes it (or prints it on
  stdout without `--output`). The summary goes to stderr, as for `gerber
  import`: `Board <w> x <h> mm: <f> footprints, <p> pads, <t> tracks, <v>
  vias, <z> zones, <n> nets.` (size from the Edge.Cuts extent with
  `toFixed(2)`; `Board with no outline: ...` with the same counts when
  there is no Edge.Cuts geometry). Diagnostics as `warning:` lines; errors
  exit 2; `--strict` exits 3 on warnings and writes nothing.
- `nodetto-cli pcb gerber <doc.jsonl> --output <file.zip> [--page <page>]
  [--strict]`: exports the page's board. `--page` takes a page number, id or
  unique id prefix, as other commands do; without it the document's only
  `pcb` page is used, and zero or several give exit 2 with a message.
  Notes on stdout, warnings as `warning:` lines, `--strict` exits 3.
- Wiring: `case "pcb"` in `commands.ts`; `OVERVIEW` line `nodetto-cli pcb
  import|gerber   KiCad board to a PCB page, Gerber and drill export`;
  `COMMAND_HELP.pcb` with usage, options, exit codes and examples;
  `types-command.ts` `TYPICAL.pcb` lists the six types.
- Native: no Rust change. A `native-parity.test.ts` case runs both commands
  on the fixture in separate temporary directories and compares exit codes,
  stdout, stderr, the JSONL bytes and the ZIP bytes.

## 9. Desktop (`apps/desktop`)

- `session.ts`: `.kicad_pcb` paths go to `importKicadPcbPath`, which reads
  the text, builds the document and opens it as a detached unsaved document
  named after the file (as `importPcbPath` does, so autosave never writes
  the KiCad file). Diagnostics appear under Import notes. An error
  diagnostic fails the open with its message.
- `dialogs.rs`: add `kicad_pcb` to `OPEN_FILTER_EXTENSIONS` and to its test.
  Run `CARGO_TERM_QUIET=true cargo fmt` and the cargo tests.
- `page-workspace.ts`: `pcb: "pcb"` workspace and page name `PCB`.
- Export dialog: a PCB tab on `pcb` pages with "Gerber and drill (.zip)",
  which saves `encodePcbBoardZip(exportPcbBoard(...))` named after the
  page; warnings and notes are shown as for the breadboard export.

## 10. Docs

- `docs/pcb/kicad-pcb.md` (new): supported KiCad versions and items, what
  is skipped, the page and its editing, layer visibility, ratsnest, the
  JSONL element format (section 3), the Gerber file set and frame, the
  warnings, and the CLI commands.
- `docs/cli.md`: the two commands. `README.md`: one feature-list line.

## 11. Tests

Fixtures are self-authored, in `test-fixtures/kicad/`, listed in its
`README.md`:

- `two-layer.kicad_pcb` (KiCad 8 syntax, version 20240108): layer table with
  F.Cu and B.Cu; nets GND, VCC, SIG and one net with no items; footprints:
  a THT header with a rect pin 1 and circle pins, an SMD resistor with
  roundrect pads rotated 90 degrees, a bottom-side SMD part, a THT part
  rotated 45 degrees with an oval slot drill, and a mounting hole
  (`np_thru_hole`); tracks on both layers including one `arc`; two vias; a
  GND zone on B.Cu with one filled polygon; Edge.Cuts lines, one arc corner
  and one circle cutout; silkscreen text and lines on both sides; Fab
  graphics; one `gr_text`. Rotations are multiples of 45 degrees only.
- `kicad5.kicad_pcb` (version 20171130): `module`, `fp_text`, angle arcs,
  coded nets, one track, one via, a zone.
- Inline strings in tests for KiCad 6/7 variants (`stroke`, name-only nets,
  `property` text, `pts` arcs, rule areas, unknown items, bad numbers, wrong
  root).

| Acceptance criterion | Test |
| --- | --- |
| Import preserves every item and net | `packages/io/src/kicad/pcb.test.ts`: counts and selected values per item kind, net table, angle conversion, KiCad 5 conversion, diagnostics |
| Validation | `packages/ir/src/pcb.test.ts`: each issue code, valid fixture page passes `assertValidDocument` |
| Lossless JSONL | `packages/core/src/pcb-board/fixture.test.ts` (not `packages/io`, which cannot import `@nodetto/core`'s page builder or Editor; core has `@nodetto/io` as a devDependency): import, serialise, parse, serialise; byte-equal and deep-equal; again after a move, a rotation, an added track and via |
| Move/rotate follow | `packages/core/src/pcb-board/follow.test.ts`: attached ends stay on pads (offset kept) after `moveElements` with repeated absolute targets and after `rotatePcbFootprints`; unattached and interior points stay; arc `mid` rule; undo restores |
| Ratsnest and highlight | `packages/core/src/pcb-board/connectivity.test.ts`: fixture has no ratsnest lines for routed nets; deleting a track yields one line on its net between the two pads; adding it back removes it; zone-connected pads are joined; `pcbNetMembers` returns every item of GND |
| Gerber read-back | `packages/core/src/pcb-board/export.test.ts`: `readGerber` on GTL/GBL/GTS/GBS/GTO/GBO/GKO and `readExcellon` on DRL and NPTH: flash and region count and positions per pad, draws per track, arc draw for the arc track, regions for the zone fill, holes and the slot per drill, outline extent equals `width`/`height`; Gerber layers (GTL, GBL, GTS, GBS, GTO, GBO, GKO) within 1e-6 mm; Excellon holes, slot end points and tool diameters (DRL and NPTH) within 0.0005 mm of the expected board-frame values, or exactly equal to those values rounded with `toFixed(3)`; the `oracle.test-support.ts` reader accepts every file with only its known warnings; two exports are byte-equal |
| Writers unchanged for breadboard | existing `packages/core/src/breadboard/export-golden.test.ts` passes unchanged; new writer methods have unit tests in `packages/core/src/pcb/` |
| CLI | `apps/cli/src/pcb-commands.test.ts`: import to file and stdout, gerber ZIP equals `encodePcbBoardZip(exportPcbBoard(...))`, `--page` errors, `--strict` exit 3, help |
| Native parity | `apps/cli/src/native-parity.test.ts` pcb case under `mise run test-cli` |
| UI | `packages/ui-solid/src/pcb-interaction.test.ts`: track tool creates one track with the start item's net, via tool, R rotates, layer visibility hides drawing and hit tests; `apps/desktop/src/page-workspace.test.ts`; desktop session test opens `.kicad_pcb` as a detached document |
| Boundary | `packages/core/src/pcb/boundary.test.ts` passes unchanged |

## 12. Implementation slicing (for the plan)

The binding split is `impl-plans/active/kicad-pcb-00-overview.md` and
plans 01-13. Plans 01-08 are committed. Plan 09 publishes the
`pcb-board` barrel and runs the fixture acceptance tests; plans 10 (CLI),
11 (canvas, tools, layers, workspace), 12 (inspector, Export dialog,
`App.tsx`) and 13 (Open dialog, `session.ts`, `dialogs.rs`) then run in
parallel with disjoint write paths. The original slices were:

1. IR: page kind, `pcb.ts`, registry entries, validation tests,
   `types-command.ts` entry, PageKind-exhaustive spots.
2. Reader: `packages/io/src/kicad/pcb.ts`, fixtures, `importKicad` branch,
   `pcbPageFromPlan`, round-trip test. Depends on 1.
3. Core editing: pad shapes, connectivity, ratsnest, highlight,
   `moveElements`/`movableSelection` branches, rotation, follow planner,
   add track/via. Depends on 1.
4. Export: writer additions in `packages/core/src/pcb/` with unit tests,
   `exportPcbBoard`, read-back tests. Depends on 1 and the pad shapes of 3.
5. CLI and native parity, help, docs. Depends on 2 and 4.
6. UI and desktop: shape utils, views, overlay, workspace, tools,
   inspector, Open and Export dialogs, `dialogs.rs`. Depends on 2, 3, 4.

## 13. Intentional divergences

- The breadboard ratsnest and connectivity modules are not shared; they
  are lattice and target-netlist based. The PCB page has its own copper
  connectivity, with the same Prim tie-break style.
- PCB geometry is semantic, not `visual`, unlike breadboard parts: the
  0.01 visual rounding would lose KiCad's 1 nm resolution.
- Silkscreen is not clipped against mask openings (the breadboard export
  does this); the board designer owns the silkscreen layout.
- Text uses Nodetto's stroke font, so silkscreen text differs in shape from
  KiCad's.
- Vias are always tented; pad mask openings use a grown pad shape.

## 14. Verification

- `bun test packages/io/src/kicad packages/core/src/pcb packages/core/src/pcb-board packages/ir/src packages/io/src/jsonl apps/cli/src/pcb-commands.test.ts`
- `bun run typecheck`
- `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `CARGO_TERM_QUIET=true BUN_OPTIONS=--jsx-runtime=classic mise run verify`
- `CARGO_TERM_QUIET=true mise run test-cli`

## 15. Risks

- Angle convention: the reader assumes board-absolute pad and text angles
  in the file and pre-mirrored bottom-side local geometry. Self-authored
  fixtures cannot prove this against KiCad; a wrong assumption would rotate
  pads on rotated footprints. The convention is isolated in one reader
  helper and documented in `docs/pcb/kicad-pcb.md`. The KiCad 5 arc angle
  sign carries the same risk and is likewise confined to one helper.
- Adding a page kind and six element types touches exhaustive maps and
  registry-listing tests or goldens (`types` output, inspector page-kind
  options); typecheck finds the maps, the test run finds the goldens.
- Large boards: zone fills make long JSONL lines; connectivity and
  follow rely on the grid index to stay linear; the native CLI is an
  interpreter and will be slow on large boards (as the Gerber import is).
- A parallel worktree (`feat/gerber-export`) may change
  `packages/core/src/pcb` at the same base; the writer changes are additive
  to limit conflicts.
- TS/native parity depends on `Math.cos`/`Math.sin` only for rotations that
  are not multiples of 45 degrees; the parity fixture avoids them.
- Drill offset on bottom-side pads: the offset is used as read, like the
  other pre-mirrored local geometry. Self-authored fixtures cannot prove
  this against KiCad; the rule is confined to the two geometry functions of
  section 6.3 (low).
- Drill positions are quantised to 0.001 mm by the unchanged Excellon
  writer (low); this is within board-house drill tolerances, and no writer
  option is added.
