# Schematic (Circuit Diagram) Pages

Status: design baseline for branch `feat/schematic-mode`, revision 12.
Revision 12 answers the third continuation-run Step 3 review (comm-000004):
SCH-DESIGN-WIRE-CANONICAL-CONTACT, SCH-DESIGN-WIRE-REJECTED-DOUBLE-CLICK,
SCH-PLAN-WIRE-REJECTED-DEGENERATE-DROP and SCH-PLAN-WIRE-ENDPOINT-KEY.
Wire-tool and point-edit classification now count contacts at the
target's stored-field electrical key (core `schematicContactsAt`, plan 47),
not at raw positions. Interactive writes store points so that their key
sum equals the classified key (section 3.3, key-preserving writes). A
double-click finishes only when its triggering click was accepted. A
labelled-crossing sample in a point edit takes precedence over a degenerate
reroute and aborts the whole gesture (section 7.3, section 13 item 20).
Proximity ranking, Shift handling and pending-junction rules are unchanged.
Revision 12 also answers the fourth continuation-run review (comm-000006,
SCH-DESIGN-WIRE-STORED-RANGE). A new wire's origin is clamped to the
coordinate limit. Every derived stored field is range-checked before any
command is applied. A failing wire-tool finish is declined with the draft
intact, and a failing point-edit sample is treated like a null reroute
(section 3.3, section 7.3).

Revision 11 answers SCH-DESIGN-WIRE-PENDING-T (comm-000052). A T or
interior-label candidate from a click that leaves the draft open stays
pending until the next accepted click replaces it. It is committed only if
its point becomes the final endpoint (section 7.3, wire tool).

Revision 10 answers the second continuation-run Step 3 review
(comm-000050), SCH-DESIGN-DRAG-LABEL and SCH-DESIGN-HANDLE-KEYBOARD.
The edited wire is now excluded before the nearest snap target is chosen
(core `schematicPinAt` and `schematicWireInteriorAt` gain an optional
excluded element id). A point is classified once, and that classification is
what gets committed; a stored point is never snapped again. A point edit
reports the moved point's index in the resulting polyline, and keyboard
focus follows that index (section 7.3).

Revision 9 answers the continuation-run Step 3 review (comm-000048):
SCH-DESIGN-WIRE-SHIFT, SCH-DESIGN-WIRE-TWO-JUNCTIONS, SCH-DESIGN-DRAG-LABEL,
SCH-DESIGN-DRAG-ANCHORS and SCH-DESIGN-HANDLE-KEYBOARD. Only the wire tool
and wire point editing of section 7.3 change (Shift is read from the pointer
event, start and finish junctions are kept apart, wire point edits classify
their drop like a click, keep the untouched endpoints fixed and are keyboard
operable), plus decision 20 in section 13. Every other decision is unchanged.

Revision 8 answers the seventh Step 3 review (comm-022745), SCH-DESIGN-008.
The CLI now opts in with the policy flag `diagonalBudget: "schematic"`.
The importer computes `diagonalBudgetLimit(S, P)` itself, after its single
parse and before diagonal lookup. The io plan tests check the policy's
activation, and the cli plan tests that the real `schematic import`
command exits 1 and writes nothing (sections 8.3, 9, 11).

Revision 7 answers the sixth Step 3 review (comm-022743), SCH-DESIGN-008.
The schematic import now runs all diagonal lookup branches, including
box-only mode, under a global `diagonalBudget` and stops with
`schematic.importTooComplex` before writing anything when the budget would
be exceeded. Legacy callers run unbudgeted with unchanged results. A
long-lattice mixed-direction fixture is added (section 8.3, 11, 14).

Revision 6 answers the fifth Step 3 review (comm-022741):
- SCH-DESIGN-008: an exact-arithmetic gate, with box reporting only outside
  it; a per-segment choice between box reporting and lattice walk; a
  per-direction line hash; and an overlapping mixed-direction test plus a
  large-coordinate midpoint in the oracle (section 8.3);
- SCH-DESIGN-010: the wave 2 move plan has its own test,
  `schematic-move.test.ts`; `connectivity-roundtrip.test.ts` stays in
  wave 3 (sections 11.1, 12).

Revision 5 answers the fourth Step 3 review (comm-022739):
- SCH-DESIGN-003: headers map to connectors only up to 40 pins; larger
  headers become IC boxes (section 8.3);
- SCH-DESIGN-008: each diagonal direction chooses box reporting or a line
  hash from counting queries, which bounds overlapping parallel wires
  (section 8.3);
- SCH-DESIGN-010: the move contract is set at the absolute-target callers,
  with `shiftedTarget` for drag and nudge and `canonicalTarget` for CLI
  absolute moves (sections 3.3, 4.2, 12).

Revision 4 answers the third Step 3 review (comm-022737):
- SCH-DESIGN-001: a snap to an interior label adds a junction on the
  label's only wire, and is rejected on a labelled crossing (section 7.3);
- SCH-DESIGN-003: import fails on a pin in two nets or more than 256 pins
  (section 8.3);
- SCH-DESIGN-008: diagonals use a per-segment 2D range query with work
  counted before confirmation (section 8.3);
- SCH-DESIGN-010: canonical translation of moved groups, and the
  `+-1e9` coordinate range (sections 3.2, 3.3, 4.2).

Revision 3 answered the second Step 3 review (comm-022735):
- SCH-DESIGN-001: per-key label groups, and a junction only for a
  deliberate T (sections 5.1, 7.3);
- SCH-DESIGN-003: import pins from the actual source pin numbers, and names
  deduplicated after trimming (section 8.3);
- SCH-DESIGN-008: label lookup by final root, and diagonal line buckets
  (section 8.3);
- SCH-DESIGN-009: duplicate and unannotated references fail the projection
  (section 8.1);
- SCH-DESIGN-010: per-field coordinate keys (sections 3.3, 4.2, 5.1).

Revision 2 answers the Step 3 adversarial review (comm-022733,
SCH-DESIGN-001 to 008):
- joinable points and single-wire label attachment (section 5.1);
- the explicit breadboard projection check (section 8.1);
- switch terminals and named singletons on import (section 8.3);
- missing pads and empty boards in PCB parity (section 8.2);
- the bounded row/column sweep and orthogonal wires (sections 3.2, 5.1);
- collision-checked net names (section 5.2);
- exact anchor rotation (section 4.2);
- linear KiCad importers (section 8.3).
Issue: "Add a schematic (circuit diagram) page kind to nodetto, end to end"
(workflow input `opus-terra-design-and-implement-review-loop-session-933`,
intake comm-022731; no GitHub issue number).

This design follows the page-kind precedent of
`design-docs/specs/design-bpmn.md` and `design-docs/specs/design-breadboard.md`
(page kind, registry entries, notation primitives, workspace and tools,
inspector section, problems panel, CLI `lint`, SVG export, test ownership
contract (BPMN section 11.1) and wave gate). Where this document is silent,
the breadboard rules apply unchanged.

There is no user-QA document. Every open question was decided here with a
default, and section 13 lists each decision with its reason.

## 1. Context and baseline

No schematic design existed before this document. Repository facts at base
`c6cebb6` that shape the design:

- `PAGE_KINDS` (`packages/ir/src/types.ts:27`) ends with `breadboard`, `pcb`,
  `CAD_PAGE_KIND`. `PAGE_MODES` (`types.ts:48`) and `DEDICATED_PAGE_MODES`
  (`types.ts:68`) map the dedicated kinds `bpmn`, `breadboard`, `pcb`,
  `cad3d` to their own mode. `SCHEMA_VERSION` is 1. Additive kinds and types
  have never bumped it.
- Breadboard IR is split into `packages/ir/src/semantics/breadboard.ts`
  (type lists, prefixes, payload types) and
  `packages/ir/src/registry/breadboard.ts` (registry definitions, key order,
  validation). `packages/ir/src/breadboard.ts` holds `parseComponentValue`,
  `compareReferences` and the io-facing `BreadboardNetlist` model.
- `Visual.flipX` (`types.ts:436`) already exists: "mirror a geometric
  shape's outline left-right about its own centre, before rotation. Labels
  stay readable and are never mirrored." It is reused as the schematic
  mirror flag, so no new mirror field is needed.
- `packages/core/src/breadboard/` exports, among others:
  `snapBreadboardPoint` (rounds to `BREADBOARD_PITCH = 10`),
  `planBreadboardRotation` (rotate and keep pin 1), `annotateBreadboardParts`
  and `planBreadboardAnnotation`, `breadboardTargetNetlist`,
  `breadboardParityFindings`, `computeBreadboardRatsnest`,
  `breadboardNotation` (returns `{body, labels}` of `NotationPrimitive`,
  the type from `packages/core/src/bpmn/notation.ts`).
- Breadboard parity (`parity.ts`) and the ratsnest (`ratsnest.ts`) read the
  target exclusively through `breadboardTargetNetlist(document, pageId)`,
  which returns the first visible `breadboard.netlist` element of the page.
  Its payload is `BreadboardNetlistSemantic` with
  `format: "kicad_sch" | "kicad_net"` (`BREADBOARD_NETLIST_FORMATS`).
- io KiCad files (`packages/io/src/kicad/`):
  - `index.ts` `importKicad(text, {fileName})` dispatches on the root head
    (`kicad_sch` to `schematic.ts`, `export` to `netlist.ts`) and returns a
    `BreadboardImportResult` (breadboard part types, target nets in
    breadboard pin numbering).
  - `netlist.ts` is the KiCad netlist **importer**. The KiCad netlist
    **writer** is `packages/io/src/breadboard/kicad-netlist.ts`
    (`exportBreadboardKicadNetlist(netlist: BreadboardNetlist)`). It reads
    only `documentTitle`, `components[].{reference, value, footprint,
    partName, description}` and `nets[].{code, name, nodes}`.
    `referenceWarnings` (`bom.ts:55`) reads only `components[].reference`.
    The intake's pointer to `kicad/netlist.ts` as the writer is corrected
    here.
  - `symbol-map.ts` row 1 maps `lib "nodetto"` plus a breadboard catalogue
    part name with identity pins; row 9 maps `SW_Push*` 2-pin symbols to the
    4-pin button (1 to 1, 2 to 3); row 13 maps by reference prefix; row 14
    falls back to an IC or header.
- PCB pages (`pcb` kind, `pcb.*` types, `packages/core/src/pcb-board/`)
  carry their own nets: each `PcbPad.net` is a net name from the imported
  KiCad board. The PCB ratsnest groups pads by that name. There is no PCB
  lint and no PCB problems panel.
- CLI (`apps/cli/src/`):
  - Pages are created and elements added through `edit` operations
    (`add-page` with `kind`, `add` with `type` or `shape`), listed by
    `pages --kind`, `types --kind` (`types-command.ts:96` per-kind lists),
    `shapes --category` (from `packages/core/src/shape-catalogue.ts`).
  - `lint` (`commands.ts:370-560`) selects `bpmn`, `breadboard`, text-layout
    and diagram pages; a breadboard finding adds the JSON `pin` key. The
    no-page message lives in `lint-diagram.ts:24`.
  - `export` and `capture` render 2D pages through core `svg-export`; PNG
    and JPG reuse it.
  - `arrange` uses the allowlists `LAYERED_PAGE_KINDS` and
    `ROUTE_PAGE_KINDS`, so a new kind is excluded without code changes;
    only the help table (`help.ts` "Page kind" table) gains a row.
  - Native parity tests live in `apps/cli/src/native-parity/*.test.ts`,
    share `harness.ts` (`nativeTest` skips unless `NODETTO_CLI_TEST_BINARY`
    is set) and `documents.test.ts` loops over every
    `packages/io/src/__fixtures__/*.jsonl`.
- ui-solid and desktop: breadboard wiring sits in `workspaces.ts`,
  `shape-palette.ts`, `tools.ts` (core), `Inspector.tsx`,
  `inspector/BreadboardSection.tsx`, `shapes/ShapeView.tsx`,
  `interaction/{context,creation,circuit,keyboard}.ts`,
  `BreadboardProblemsPanel.tsx`, `breadboard-problems.ts`
  (`focusBreadboardProbe`, generic over page and element ids),
  `ExportDialog.tsx`, `apps/desktop/src/page-workspace.ts`
  (`DEDICATED_WORKSPACES`, `DEDICATED_PAGE_NAMES`), `App.tsx` (panel mount)
  and `shell/export-handlers.ts`. `packages/ui-solid` depends on core and
  io. `packages/io` depends only on ir.
- Theme: SVG export receives `SvgTheme` (`ink`, `muted`, `line`,
  `surface`, `accent`, ...). Canvas views use the CSS tokens
  `--nodetto-ink`, `--nodetto-muted`, `--nodetto-surface`,
  `--nodetto-accent`.
- The `r` key rotates breadboard parts only on breadboard pages
  (`interaction/circuit.ts:340`). `TOOL_KEYS` (`interaction/keyboard.ts:34`)
  binds `v h r o d n t l`; `x` and `m` are unbound.

Licensing boundary: every symbol outline, pin table, rule id, rule message,
fixture and value in this design is nodetto's own. Symbols are drawn from
first principles in IEC/IEEE style (zigzag-free IEC resistor rectangle,
plate capacitor, triangle-and-bar diode and so on). Nothing is copied from
KiCad, Fritzing or any other library. The KiCad part name `SW_Push` that
appears in output is the same prefix token the breadboard symbol map
already reads (design-breadboard.md section 8.6.4); the other names
(`MOSFET_N`, `IC_Generic`, `Inductor`, ...) are nodetto's own.

## 2. Goals and non-goals

Goals (intake acceptance signals):
- The `schematic` page kind and typed `schematic.*` elements: 13 symbol
  types, power symbols, orthogonal wires, junctions, net labels and
  no-connect marks.
- Symbol pin geometry with 90-degree rotation and mirroring, grid and pin
  snapping.
- A connectivity engine with explicit crossing and junction rules and
  same-named labels, a netlist model and reference annotation.
- Five ERC rules in core, shown in a problems panel and in `nodetto-cli lint`.
- Theme-aware notation in the canvas and in SVG export (and so PNG/JPG
  capture).
- Workspace, palette, wire tool, inspector section, rotate and mirror
  commands, shape-search entries.
- CLI: page creation, `add`, `edit`, `lint`, `export`, `capture`, plus
  `schematic netlist` (documented text format and KiCad format) and
  `schematic import`.
- Interop: a schematic page as the target netlist of a breadboard page
  (existing parity and ratsnest, unchanged), schematic-to-PCB parity, and
  KiCad schematic or netlist import onto a new schematic page.
- Native CLI parity for lint and export, docs, README.

Non-goals:
- Multi-sheet or hierarchical schematics, buses, global versus local label
  scopes (one page is one sheet with one label namespace).
- Rubber-banding wires when a symbol moves. Moving a symbol leaves wires in
  place and ERC reports what was disconnected.
- Net highlight overlay and canvas-to-panel cross-probing. The inspector
  shows each pin's net name instead.
- Simulation, SPICE export, BOM export and footprint assignment for
  schematic pages.
- User-defined symbol libraries. The IC box with an editable pin table is
  the escape hatch.
- Writing `.kicad_sch`, back-annotation, and changing the desktop KiCad
  open flow (KiCad files keep opening as breadboard imports).
- Native (Rust) awareness of schematic types. None is needed: the native
  CLI runs the TypeScript core.
- PCB problems panel features beyond listing the parity findings.

## 3. Data model (packages/ir)

### 3.1 Page kind, mode and units

- Append `"schematic"` to `PAGE_KINDS` and to `PAGE_MODES`, and map it in
  `DEDICATED_PAGE_MODES` (`schematic: "schematic"`). The kind selects the
  palette and never restricts which element types a page holds.
- `SCHEMATIC_PITCH = 10` page units (0.1 in), equal to `BREADBOARD_PITCH`,
  so `snapBreadboardPoint` is reused as the schematic lattice snap. Every
  pin, wire point, junction, label anchor and no-connect mark created by the
  editor sits on `(i * 10, j * 10)`.

### 3.2 Element types

New file `packages/ir/src/semantics/schematic.ts` (types and constants) and
`packages/ir/src/registry/schematic.ts` (definitions), wired into
`semantics.ts`, `registry.ts` and `index.ts` like the breadboard files.
All 18 types use the `schematic.` prefix and `category: "node"`. None is an
`edge` and none references another element id (`references` returns `[]`,
`onReferenceDeleted: "detach"`).

**Part types** (`SCHEMATIC_PART_TYPES`, 13) share `reference: string`
(non-empty; trailing `?` means unannotated) and `value: string` (may be
empty).

| type | ref prefix | extra semantic fields | default value |
|---|---|---|---|
| `schematic.resistor` | `R` | none | `10k` |
| `schematic.capacitor` | `C` | `polarized: boolean` (default false) | `100n` |
| `schematic.inductor` | `L` | none | `10u` |
| `schematic.diode` | `D` | none | `1N4148` |
| `schematic.led` | `D` | none | `LED` |
| `schematic.bjt` | `Q` | `polarity: npn\|pnp` (default npn) | `NPN` |
| `schematic.mosfet` | `Q` | `channel: n\|p` (default n) | `NMOS` |
| `schematic.switch` | `SW` | `style: toggle\|push` (default toggle) | `SW` |
| `schematic.potentiometer` | `RV` | none | `10k` |
| `schematic.battery` | `BT` | none | `9V` |
| `schematic.voltageSource` | `V` | none | `5V` |
| `schematic.connector` | `J` | `pinCount: 1..40` integer (default 2; the breadboard header range, so the KiCad round trip of section 8.1 stays valid) | `CONN` |
| `schematic.ic` | `U` | `pins: {number, name, side}[]`, 1..256 entries; `number` positive integer, unique; `name` string (may be empty); `side: left\|right\|top\|bottom` | `IC`; default pins 1-4 `left`, 5-8 `right`, names empty |

The potentiometer is included beyond the intake list because the
breadboard catalogue has one and parity (section 8.1) must be able to
express it.

**Non-part types** (5):

| type | semantic | meaning |
|---|---|---|
| `schematic.power` | `style: ground\|rail` (default ground), `net: string` non-empty (default `GND` for ground, `VCC` for rail) | one-pin symbol that names its net |
| `schematic.wire` | `points: {x, y}[]`, at least 2 | polyline; points are offsets from `visual.x/y` (breadboard wire storage) |
| `schematic.junction` | `{}` | explicit connection dot at `visual.x/y` |
| `schematic.label` | `net: string` non-empty | net label; anchor at `visual.x/y` |
| `schematic.noConnect` | `{}` | no-connect cross at `visual.x/y` |

Validation (`validateSemantic`) is structural only: required strings,
enums, integer ranges, finite numbers; `schematic.wirePoints` (error) for
fewer than 2 points; `schematic.wireDiagonal` (error) when two consecutive
points share neither x nor y (wires are orthogonal by definition, the
editor and the import layout never create diagonals, and the constraint
bounds the connectivity work, section 5.1); `schematic.icPins` (error) for
an empty pin list, a non-positive or non-integer number, or a duplicate
number; `schematic.coordinateRange` (error) when a schematic element's
`visual.x`, `visual.y` or any wire point `x`/`y` is beyond
`SCHEMATIC_COORDINATE_LIMIT = 1e9` page units in magnitude. The points are
checked in `validateSemantic`; the visual fields are checked by a
schematic-only branch in `packages/ir/src/validate.ts`, guarded by
`isSchematicElementType`, so no other type is affected. The limit keeps
every electrical key an exact integer (section 3.3). Electrical correctness
is reported only by ERC, so imperfect documents still load.

Key order: parts `reference`, `value`, then the extra fields in table
order; `ic.pins` children `number`, `name`, `side`; power `style`, `net`;
label `net`; wire `points` (children `x`, `y`).

`semantics/schematic.ts` exports `SCHEMATIC_ELEMENT_TYPES`,
`isSchematicElementType`, `SCHEMATIC_PART_TYPES`, `isSchematicPartType`,
`SCHEMATIC_REFERENCE_PREFIX`, the enum arrays, `SCHEMATIC_PITCH`, and the
payload types (added to `SemanticByType`).

### 3.3 Geometry storage

- **Parts and power symbols**: `visual.x/y` is the top-left of the
  unrotated, unmirrored local box. `visual.width/height` are written at
  creation and on parameter changes, but readers always use the symbol box
  (section 4.1), so a stale size is harmless. `visual.rotation` is
  `0|90|180|270`. `visual.flipX` is the mirror (parts only; section 4.2).
- **Wires**: breadboard storage. The first and last points are the wire's
  **ends**, the only points of a wire that join other elements by
  coincidence. Interior points are **bends**: they belong to the wire's own
  path and never join anything by coincidence (section 5.1).
- **Junction, label, no-connect**: `visual.x/y` is the connection point
  itself; width and height are omitted and bounds are derived. Labels use
  `visual.rotation` (`0|90|180|270`) for the text direction; the text stays
  upright.
- **Serialization-stable electrical geometry.** The JSONL writer rounds
  each declared coordinate field on its own with `roundCoordinate`
  (`packages/io/src/jsonl/canonical.ts:46`, precision
  `COORDINATE_PRECISION = 0.01` from `packages/ir/src/keyOrder.ts:25`,
  ties away from zero, so `-0.125` becomes `-0.13`). Electrical identity
  must survive that, so it is defined on the **stored fields**, never on a
  summed float:
  - `roundCoordinate` moves unchanged into `packages/ir/src/keyOrder.ts`,
    next to its precision constant. `canonical.ts` imports and re-exports it,
    so `@nodetto/io` exports, JSONL output and the 21 existing
    `packages/io/src/jsonl/canonical.test.ts` tests are unchanged.
  - `coordinateKey(v) = Math.round(roundCoordinate(v) / 0.01)` gives
    integer hundredths. `roundCoordinate` is idempotent, so the key of a
    live field equals the key of the same field after save and reload.
    With every field within `SCHEMATIC_COORDINATE_LIMIT` (section 3.2), a
    key is at most 1e11 in magnitude and a position key (a sum of two
    fields plus a symbol constant) at most about 2e11. Both are far below
    2^53, so keys are exact integers. Distinct canonical values never share
    a key: at that magnitude doubles are spaced much finer than 0.01. An
    out-of-range value can never reach `coordinateKey`, because the
    document does not validate.
  - Each electrical position key is the **sum of the keys of the stored
    fields** that define it, plus an exact symbol constant:
    - a wire point: `coordinateKey(visual.x) + coordinateKey(points[i].x)`
      (same for y);
    - a junction, label or no-connect: `coordinateKey(visual.x)`;
    - a part or power pin: `coordinateKey(visual.x)` plus the pin's offset
      from the box top-left after flip and rotation, in hundredths. Offsets
      and box centres are multiples of 5 page units (section 4.1), so this
      constant is an exact integer.
  - The schematic wire `points` children declare
    `coordinates: ["x", "y"]` in the schematic key order, so stored files
    are canonical too.
  - **Moves.** `Editor.moveElements` takes **absolute destinations**:
    the drag gesture (`packages/ui-solid/src/interaction/transform.ts:243-249`),
    keyboard nudge (`packages/core/src/editor/facade/selection-editing.ts:192-200`)
    and CLI `edit` moves (`apps/cli/src/edit/operations/elements.ts:197-209`)
    all build absolute x/y before calling it. Reconstructing a delta per
    element from a destination and a raw origin can land on opposite sides of
    a rounding tie, so the contract is set at the callers.
    `packages/core/src/schematic/coordinates.ts` provides two helpers:
    - `shiftedTarget(origin, sharedDelta) =
      roundCoordinate(roundCoordinate(origin) + roundCoordinate(sharedDelta))`.
      Both addends are canonical, so its key is exactly
      `coordinateKey(origin) + coordinateKey(sharedDelta)`.
    - `canonicalTarget(value) = roundCoordinate(value)`.
    The callers use them as follows:
    1. **Relative moves (drag and nudge).** The caller rounds the gesture's
       one shared delta once per step, then builds every schematic element's
       absolute destination with `shiftedTarget(origin, sharedDelta)` before
       calling `Editor.moveElements`. Every element of a moved group shifts
       by the same key delta, so coincident points stay coincident even at a
       tie. Example: origins `-1` and `-0.999` (both key `-100`) with a shared
       delta of `-0.005` (canonical `-0.01`) both go to `-1.01`.
    2. **Absolute targets (CLI `edit` move with x/y).** The target is stored
       as `canonicalTarget(target)`, which keeps absolute semantics: a move
       from `-0.125` to `0.875` stores `0.88`. A CLI operation that supplies a
       relative offset uses rule 1 with that offset as the shared delta.
    3. **Guard.** `Editor.moveElements` applies `canonicalTarget` to each
       schematic element's destination. It is idempotent on targets built by
       rules 1 and 2 and keeps any other caller canonical.
    Non-schematic elements, including those in the same move, keep the
    existing behaviour.
  - Other authoring paths also write canonical values: create, wire tool,
    rotate, mirror, parameter edits and import layout. Raw apply and CLI
    `set` edits may store any in-range float; the per-field key rule still
    makes live and reloaded connectivity identical.
  - **Key-preserving interactive writes.** The wire tool and wire point
    editing (section 7.3) decide connections on an electrical key `K`
    (integer hundredths per axis). They write geometry so that the stored
    fields reproduce `K` exactly, never by subtracting raw floats.
    `packages/core/src/schematic/coordinates.ts` provides
    `keyCoordinate(k) = roundCoordinate(k * 0.01)` and
    `localCoordinateForKey(k, originField) = keyCoordinate(k -
    coordinateKey(originField))`. Both results are canonical, so
    `coordinateKey(originField) + coordinateKey(local) = k`. The rules:
    - a moved or new wire point at key `K` stores
      `localCoordinateForKey(K, visual)` per axis. The origin stays as stored;
    - a new wire stores, per axis, `visual = keyCoordinate(clamp(K0,
      -LK, LK))` for its first point's key `K0`, where `LK =
      SCHEMATIC_COORDINATE_LIMIT * 100` (`1e11` hundredths). Its local points
      are then derived by the first rule. Inside the limit the clamp changes
      nothing, so the first local point is `(0, 0)`;
    - a junction at `K` stores `visual = keyCoordinate(K)`;
    - points that are not moved keep their stored local fields byte for
      byte. An elbow copies the exact stored local field of the neighbour
      or moved point whose axis it shares, so orthogonality is checked on
      exact stored values.
    - **Range check before mutation.** Electrical keys may lie up to about
      `2e9` page units away, because a position is the sum of two valid
      fields. A derived stored field can therefore exceed the limit of
      section 3.2. Every derived field (new-wire `visual`, each written
      local point and each junction `visual`) is checked with
      `Math.abs(v) <= SCHEMATIC_COORDINATE_LIMIT` (imported from
      `@nodetto/ir`) **before** any command is applied. A write that fails
      the check is not attempted: no command runs, nothing throws and no
      partial geometry or junction remains. Section 7.3 says how each
      gesture reacts. A field exactly at the limit is valid and is written.
    Example: a wire stored at `visual.x = -0.125` (key `-13`) whose end is
    moved to a T at key `-1000` stores local `x = -9.87` (key `-987`), so the
    end key is `-1000`. Raw subtraction would give `-9.875`, which rounds to
    key `-988` (end key `-1001`), and the end would dangle.
    Range example: wire S at `visual.x = 1e9` with local points
    (0,0),(10,0) has its far end at page x `1000000010`. A new wire started
    there gets `visual.x = 1e9` (clamped) and local x `10`, so it is valid,
    saves and reloads. Moving S's other end to x = -10 would need local
    x `-1000000010` with S's origin unchanged. That move is out of range and
    is handled before mutation.

### 3.4 Netlist model (`packages/ir/src/schematic.ts`)

io cannot import core, so the netlist crosses the boundary as data, the
same way `BreadboardNetlist` does:

```text
SchematicNetlist {
  pageId, pageName, documentTitle
  components: { elementId, type: SchematicPartType, reference, value,
                partName, description, footprint: "",
                pins: { number, name }[] }[]   // natural reference order
  nets: BreadboardNetlistNet[]                 // { code, name, nodes: { reference, pin, pinName }[] }
}
```

`partName` is the fixed KiCad export part name of section 7.2.

### 3.5 Schema version and pinned lists

`SCHEMA_VERSION` stays 1; no migration. Builds older than this one reject a
`schematic` page with `value.enum`, exactly as for `breadboard` (accepted).
Owned by the ir wave (section 12):
- `packages/ir/src/registry.test.ts` "registers the design table plus assets
  and token resources" gains the 18 types.
- `packages/io/src/jsonl/golden.test.ts` `GOLDEN` gains `"schematic"`;
  new `packages/io/src/__fixtures__/schematic.jsonl` holds one `schematic`
  page with at least one element of each of the 18 types, written in key
  order with canonical rounding, reserializing byte for byte. Native
  `documents.test.ts` picks it up automatically.
- All pre-existing fixtures and their validation results are unchanged.

## 4. Symbols, snapping, rotation and mirror (packages/core/src/schematic)

### 4.1 Symbol table (`symbols.ts`)

Pin offsets are in pitches, x right and y down, rotation 0, unmirrored,
relative to the **anchor pin** at `(0, 0)`. The anchor pin is pin 1, except
for the IC (its first `pins` entry). Each pin also has an outward direction
(`left|right|up|down`), used for pin-end stubs in import layout and for the
pin-snap preview.

| type | pins (number name: offset, direction) | body extent beyond the pin box (pitches) |
|---|---|---|
| resistor, inductor, diode, led, battery, voltageSource, switch, capacitor | 1: (0,0) left; 2: (4,0) right. Names: diode/led `A`,`K`; capacitor `+`,`-` when polarized, else `1`,`2`; battery/voltageSource `+`,`-`; others `1`,`2` | y -1..1 (switch push: y -2..1; led: y -2..1 for the emission arrows) |
| potentiometer | 1 `1`: (0,0) left; 2 `W`: (2,-2) up; 3 `3`: (4,0) right | y -2..1 |
| bjt | 1 `E`: (0,0) down; 2 `B`: (-3,-2) left; 3 `C`: (0,-4) up | x -2..1 |
| mosfet | 1 `G`: (0,0) left; 2 `D`: (3,-2) up; 3 `S`: (3,2) down | x 0..4 |
| connector | pin k `k`: (0, k-1) left | x 0..3 (body right of the pins) |
| power ground | 1: (0,0) up | y 0..2, x -1..1 |
| power rail | 1: (0,0) down | y -2..0, x -1..1 (net name above) |
| ic | see below | body rectangle |

IC layout: let `L, R, T, B` be the pin counts per side, `rows = max(L, R,
1)`, `cols = max(T, B, 1)`, body `W = max(6, cols + 1)` by `H = rows + 1`
pitches with its top-left at `(0, 0)`. Pins are numbered around the body
counter-clockwise in array order per side, like a DIP: left pin i (0-based,
in array order among left pins) at `(-2, i + 1)`; bottom pin i at
`(i + 1, H + 2)`; right pin i at `(W + 2, H - 1 - i)`; top pin i at
`(W - 1 - i, -2)`. Pin stubs are 2 pitches long. Offsets are then
translated so the first `pins` entry is at `(0, 0)`.

The local box is the pin bounding box unioned with the body extent, grown
by 0.5 pitch. Functions:
- `schematicPinDefs(element)`: number, name, local offset, direction.
- `schematicLocalBox(element)`, `schematicBox(element)`.
- `schematicPins(element)`: page positions. Transform order: local box
  coordinates; if `flipX`, `x -> boxWidth - x`; rotate clockwise about the
  box centre by `visual.rotation`; translate by `visual.x/y`. This is the
  transform both renderers use (section 6.1), so pins and artwork agree.
- `schematicDefaultSemantic(type, patch?)`, `schematicPartName(element)`,
  `schematicDescription(element)` (for example "Resistor", "Capacitor
  polarized", "BJT NPN", "Connector 1x4", "IC 8 pins").

### 4.2 Snapping, rotation and mirror (`snap.ts`, `rotate.ts`)

- **Anchor**: the anchor pin for parts and power; the point itself for
  junctions, labels and no-connects; the first point for a wire.
- `snapSchematicDelta(store, pageId, movingIds, delta)` mirrors
  `snapBreadboardDelta`: it puts the anchor of the first schematic element
  of the moving set (element order) on the lattice with `snapBreadboardPoint`.
  The move gesture calls it when the moving set holds a schematic element
  and snapping is on; box-grid and object snapping are skipped for that
  gesture. The delta is measured from the anchor's canonical position.
  That single shared delta then builds every schematic element's absolute
  destination with `shiftedTarget` (section 3.3, rule 1), with snapping on
  or off. With snapping off, positions are otherwise kept as dropped.
- **Rotation**: `Editor.rotateSchematicElements(ids, 1 | -1)` applies to
  parts, power symbols and labels. Rotation becomes `(r + 90 q) mod 360` and
  `visual.x/y` is translated so the anchor keeps **exactly** its current
  position key, on or off the lattice: the new `visual.x` is
  `roundCoordinate(old visual.x)` plus the exact change of the anchor's
  in-box offset, so `coordinateKey` of the anchor is unchanged (section
  3.3). Schematic rotation never rounds the pivot to the lattice, so an
  anchor dropped off-grid (snapping off) and wired there stays attached,
  before and after save and reload. Because every pin offset from the anchor is a whole or half
  pitch, an on-lattice anchor still leaves every pin on the lattice. One
  undo step. Implemented by extracting the body of `planBreadboardRotation`
  into an exported
  `planAnchoredRotation(store, ids, quarterTurns, {accepts, pinsOf, pivot})`
  in `packages/core/src/breadboard/rotate.ts`. `pivot(point)` maps the old
  anchor to the fixed point: `planBreadboardRotation` passes
  `snapBreadboardPoint` (its current snapping policy, unchanged results,
  existing tests unchanged), and the schematic passes the identity.
- **Mirror**: `Editor.mirrorSchematicParts(ids)` toggles `visual.flipX` on
  part types only and translates `visual.x/y` so the anchor pin keeps
  exactly its position key (same rule as rotation, no lattice rounding). One undo step. Labels and power
  symbols are not mirrored.
- `canRotateElement` stays false and `ShapeUtil.canResize` is false for all
  schematic types, so the generic rotate handle and resize never apply.
- **Parameter edits**: `Editor.updateSchematicSemantic(id, patch)` rewrites
  `visual.x/y/width/height` so the anchor pin keeps its page position when
  `pinCount`, `pins` or `polarized`/`style` (box extent) change.

### 4.3 Shape utils (`packages/core/src/shapes/schematic.ts`)

Registered in `createDefaultRegistry`. `getBounds` returns the symbol box
for parts and power, the point bounds grown by 0.3 pitch for wires, a
0.6-pitch square for junctions and no-connects, and the estimated text box
for labels. `hitTest`: box for parts, power and labels; within 0.4 pitch
of a segment for wires; within 0.4 pitch of the point for junctions and
no-connects. `schematicPinAt(store, pageId, point)` returns the nearest
**joinable** target within 0.4 pitch: a part pin, power pin, wire end,
junction or label anchor (never a bend), for the wire tool's snap.
`schematicWireInteriorAt(store, pageId, point)` returns the wires whose
path contains the point away from their ends, using raw positions. It is
kept unchanged and is not used for classification. Plan 47 adds an
optional `excludeId` to `schematicPinAt`, a `key: KeyPoint` field on each
returned target, and `schematicContactsAt(store, pageId, key, excludeId?)`,
the stored-field-key contact count that the wire tool and point editing
use (section 7.3).

## 5. Connectivity, netlist and annotation

### 5.1 Engine (`connectivity.ts`)

`computeSchematicConnectivity(document, pageId)` is pure and deterministic
and ignores `visual.hidden` elements. Every position is the integer
hundredths key pair of section 3.3 (per-field `coordinateKey`), so live and
reloaded positions compare equal, including at negative rounding ties.
Coincidence, the sweep and every contact test work on these integer keys
only.

**Joinable points**: part pins, power pins, wire **ends** (first and last
point), junctions and label anchors. Wire **bends** (interior points) are
not joinable. No-connect points are markers only.

Union-find (index-based, path halving, union by size; a new small module
`packages/core/src/union-find.ts`) over these rules:
1. **Coincident joinable points join**: pin to pin, pin to wire end, wire
   end to wire end, a junction or label anchor on any of them. A bend that
   coincides with anything joins nothing, so two wires that share an
   interior vertex stay separate.
2. **A wire conducts.** A wire's two ends join each other (its bends are
   on its own path).
3. **A junction joins every wire whose path contains it**, ends, bends and
   segment interiors included. This is the only way a T, a four-way
   crossing or a shared bend connects.
4. **A label group attaches to exactly one wire.** All label anchors at one
   key form a **label group** (rule 1 joins them to each other).
   - If the key also holds a non-label joinable point (pin, power pin, wire
     end, junction), rule 1 is the group's attachment and nothing else
     applies.
   - Otherwise, if one or more wire paths contain the key, the whole group
     attaches once to the **first such wire in element order**.
   So two labels stacked on one wire both name that wire, and a label on a
   plain crossing names one wire and never shorts the two. The group is
   resolved once per key, not per label.
5. **Nothing else joins**: crossing segments, a wire end or pin on another
   wire's interior or bend without a junction, and a pin on a bend stay
   unconnected. ERC rule `dangling-wire-end` reports such a wire end with a
   "missing junction" hint.
6. **Same-named nets join.** Labels and power symbols share one namespace
   per page: all label anchors and power pins whose trimmed `net` text is
   equal (case-sensitive) join.
7. A no-connect mark joins nothing; it marks the pin at its point.

**Path lookup (rules 3, 4 and the hints)** uses one shared helper,
`sweepAxisContacts` (section 12, `packages/ir/src/segment-sweep.ts`,
because io's KiCad importer reuses it and io cannot import core). Wires are
orthogonal (section 3.2), so every segment is horizontal or vertical.
Horizontal segments are grouped by row y, vertical ones by column x. Each
query point (junction, unattached label anchor, unattached wire end) goes
to its row and its column. In each row, segments sorted by start and
queries sorted by x are swept together: a segment enters a min-heap keyed
by its end when the sweep reaches its start, and it leaves when the sweep
passes its end. Every segment still in the heap at a query contains that
query, so it is a real contact. Work per page is
O((S + Q) log S + K) for S segments, Q queries and K reported contacts.
Distant segments on the same row are never examined. The helper counts
`heapPushes + heapPops + contacts` in a `stats.sweepWork` counter, and the
connectivity result exposes it for work-count tests (section 11). No
quadratic fallback exists, and the same path serves sparse and crowded
pages.

Output `SchematicConnectivity`: `nets` (each with its pin refs, power ids,
label ids, wire ids, junction ids, names), `netOfPin(ref)`,
`netOfElement(id)`, `noConnectAt(ref)`, and per wire end whether it
touches anything (`wireEndAttached(id, 0 | 1)`, plus the id of a wire
whose path it lies on, for the hint).

### 5.2 Netlist (`toSchematicNetlist`)

`toSchematicNetlist(document, pageId, connectivity): SchematicNetlist`,
following breadboard section 5.1 ordering:
- **Components**: visible part elements sorted by `compareReferences`
  (ir), then element id.
- **Nets**: every net with at least one part pin; an unconnected pin forms
  a one-node net. Nodes sorted by component order then pin number; nets
  sorted by first node; codes `1..n`.
- **Names** (`net-names.ts`, `assignNetNames`):
  1. **Explicit names first.** The net's explicit name is the
     alphabetically first power name on it, else its alphabetically first
     label text. Rule 6 of section 5.1 joins equal names, so explicit names
     are already unique across nets. They are all reserved before any
     generated name is chosen, and they are never changed.
  2. **Generated names**, for nets without an explicit name in code order:
     the base `N_<reference>_<pin>` of the first node, else `<base>_<code>`,
     else `<base>_<code>_2`, `_3`, ... The first candidate that is neither
     reserved nor already assigned wins and is then reserved.
  Example: J1.1 is labelled `N_J3_1_3` and J2.1 `N_J3_1`, and J3.1 has no
  label. The J3 net tries `N_J3_1`, then `N_J3_1_3`, both taken, and gets
  `N_J3_1_3_2`. Names are unique, so breadboard parity, which keys target
  nets by name (`parity.ts:146-150, 193-197`), never merges two nets.
  The first-unused candidate search is exported from `net-names.ts` as
  `firstUnusedName(base, suffixes, taken)`. `layoutSchematicImport`
  (section 8.3) uses it for duplicate source names.

### 5.3 Annotation (`annotate.ts`)

`annotateBreadboardParts` is refactored to delegate to a new exported
`annotateReferences(existing, incoming: {prefix, reference}[])` in
`packages/core/src/breadboard/annotate.ts` (same lowest-free-number rule,
same results; existing tests unchanged). Schematic code uses it with
`SCHEMATIC_REFERENCE_PREFIX`:
- `Editor.createSchematicPart` annotates the new part.
- `Editor.paste` and duplicate annotate planned schematic parts when the
  target page kind is `schematic` (`packages/core/src/editor/paste.ts`,
  next to the breadboard branch).
- `Editor.annotateSchematic(pageId)` renumbers duplicates and unannotated
  parts only; first holder keeps its reference. One undo step.
- Undo, redo, raw apply, imports and collab never annotate.

## 6. ERC (`packages/core/src/schematic/erc.ts`)

`lintSchematicPage(document, pageId): SchematicErcFinding[]`. A finding has
the breadboard shape `{ruleId, severity, elementId, pin?, elementIds,
message}`. `SCHEMATIC_ERC_RULE_IDS` lists five rules; no config; fixed
severities. Sorted by element order, rule id, pin, message. Messages are
nodetto's own and name the reference and pin.

| # | rule id | severity | reports on | semantics |
|---|---|---|---|---|
| 1 | `unconnected-pin` | warning | part, pin | The pin's net holds no connection point other than the pin itself (and an optional no-connect mark). Pins with a no-connect mark are skipped. |
| 2 | `single-pin-net` | warning | part, pin | The pin's net holds wires, labels or junctions but no other part pin and no power pin. Pins with a no-connect mark are skipped. `elementIds` adds the net's wires and labels. |
| 3 | `dangling-wire-end` | warning | wire | A wire end (first or last point) that coincides with no pin, power pin, other wire end, junction or label anchor (section 5.1 rule 1; bends do not count). When it lies on another wire's path (interior or bend), the message says a junction is missing and `elementIds` adds that wire. |
| 4 | `duplicate-reference` | error | part | Exact string match with an earlier visible part (element order) on the page. |
| 5 | `shorted-power-nets` | error | the first power symbol (element order) of the second distinct name on the net | One net carries power symbols with two or more distinct `net` names (for example `VCC` and `GND`). One finding per net; `elementIds` holds every power symbol on it. |

Each rule has a positive and a negative test. Rule 3 and the connectivity
tests together pin the crossing and junction rules of section 5.1.

## 7. Rendering, UI and exports

### 7.1 Notation (`packages/core/src/schematic/notation.ts`)

`schematicNotation(element, box, ink): {body, labels}` reuses
`NotationPrimitive`. `ink: {ink, muted, surface, accent}`; the canvas
passes `var(--nodetto-ink)`, `var(--nodetto-muted)`,
`var(--nodetto-surface)`, `var(--nodetto-accent)`, and SVG export passes
the `SvgTheme` fields of the same names, so both themes work with existing
tokens only. Symbols are line art in `ink` with stroke width 0.15 pitch;
filled parts (diode triangle, arrows, junction dot) use `ink`; body fills
(IC box) use `surface`.
- `body` is in box-local coordinates with `flipX` already applied
  (`x -> width - x`), drawn inside the element's existing rotation
  transform. Renderers add no scale transform for schematic types.
- `labels` (reference and value beside parts, net text of power and
  labels, IC pin names and numbers) are text primitives with pre-rotated
  anchors, drawn outside the rotation transform so text stays upright.
- Roles (`class="schematic-<role>"`): `resistor`, `capacitor-plate`,
  `capacitor-plus`, `inductor`, `diode`, `led-arrow`, `bjt-arrow`,
  `mosfet-gate`, `switch`, `switch-push`, `pot-wiper`, `battery-cell`,
  `source-circle`, `connector-pin`, `ic-body`, `ic-pin`, `power-ground`,
  `power-rail`, `pin-stub`, `wire`, `junction`, `label`, `no-connect`,
  `ref`, `value`, `net-name`, `pin-name`.

SVG export (`svg-export/shapes.ts` `renderShape`, `svg-export/document.ts`
label pass and label bounds) gains an `isSchematicElementType` branch next
to the breadboard branch, through `renderNotationPrimitive` in
`svg-export/notation.ts` (new `renderSchematicShape`). The canvas gains
`shapes/SchematicShapeView.tsx` drawing the same primitives, matched in
`ShapeView.tsx`. PNG and JPG capture use the SVG path unchanged.

### 7.2 Netlist formatters (packages/io/src/schematic)

- **Text** (`netlist-text.ts`, `exportSchematicNetlistText(netlist)`),
  documented in `docs/schematic.md`:

  ```text
  # nodetto schematic netlist 1
  # document <title>
  # page <page name>
  component <reference> <value> <partName>
  ...
  net <code> <name> <reference>.<pin> <reference>.<pin> ...
  ...
  ```
  A token that is empty or contains whitespace, `"`, `#` or `\` is written
  double-quoted with `\` and `"` escaped. Components then nets, in section
  5.2 order. LF, trailing newline, deterministic. Warnings: unannotated and
  duplicate references (`referenceWarnings`).
- **KiCad** (`exportSchematicKicadNetlist`): the existing
  `exportBreadboardKicadNetlist` is reused unchanged in output. Its
  parameter type and `referenceWarnings` are widened to a structural
  `KicadNetlistInput` (the fields listed in section 1), which both
  `BreadboardNetlist` and `SchematicNetlist` satisfy; breadboard output and
  tests are unchanged. `exportSchematicKicadNetlist` is that writer.
  `libsource` is `(lib "nodetto")` with this `partName` per type, chosen so
  that the existing KiCad importer maps it back to the breadboard part a
  builder would use:

  | type | partName | breadboard mapping by `symbol-map.ts` |
  |---|---|---|
  | resistor | `Resistor` | row 1, resistor |
  | capacitor | `Capacitor` / `CapacitorPolarized` | row 1, ceramic / electrolytic |
  | diode / led | `Diode` / `LED` | row 1 |
  | bjt | `TransistorNPN` / `TransistorPNP` | row 1, pinout `EBC` (pin 1 E, 2 B, 3 C) |
  | potentiometer | `Potentiometer` | row 1 |
  | battery | `Battery` | row 1 |
  | connector | `Header` | row 1, `pinCount` (pins are always `1..pinCount`) |
  | ic, pin numbers exactly `1..n`, n even 4..40 | `DIP` | row 1, `pinCount` n |
  | ic, pin numbers exactly `1..n`, other n in 1..40 | `Header` | row 1, header n |
  | ic, sparse numbers or n above 40 | `IC_Generic` | not projectable to a breadboard part: the breadboard projection fails explicitly (section 8.1). The KiCad file export itself still writes it |
  | switch (both styles) | `SW_Push` | row 9: button, 1 to 1, 2 to 3. A toggle also uses `SW_Push`, because the `SW` prefix row maps pins by identity, which would put both pins on one bonded side of the 4-pin button |
  | mosfet | `MOSFET_N` / `MOSFET_P` | row 13 (`Q`): transistor, with `kicad.pinNamesMissing` |
  | inductor, voltageSource | `Inductor` / `VoltageSource` | row 14: 2-pin header, `kicad.unsupportedSymbol` |

  `footprint` is written as `""`.

### 7.3 Workspace, palette, wire tool, keys, inspector, panel (packages/ui-solid)

- **Tools** (`packages/core/src/tools.ts`): `Tool.Schematic*` ids
  `schematic:<kind>` (`resistor`, `capacitor`, `capacitor-polarized`,
  `inductor`, `diode`, `led`, `npn`, `pnp`, `nmos`, `pmos`, `switch`,
  `push-button`, `potentiometer`, `battery`, `voltage-source`,
  `connector`, `ic`, `ground`, `power-rail`, `wire`, `junction`, `label`,
  `no-connect`), `SCHEMATIC_TOOLS` and `creationFor` entries.
- **Shape search**: `shape-catalogue.ts` category
  `{id: "schematic", label: "Schematic"}` lists every tool except `wire`;
  `shape-palette.ts` `SCHEMATIC_SHAPES` with icons. CLI `shapes` and
  `edit add {"shape": "schematic:resistor"}` work through the catalogue.
- **Workspace** `schematic` (`workspaces.ts`, `design: false`,
  `shapes: false`), primary tools Resistor, Capacitor, Ground, Wire, Label.
- **Creation**: `Editor.createSchematicPart` (parts and power: snapped
  anchor, annotated) and plain creation for junction, label and no-connect
  (snapped point). Label creation asks for nothing: it creates `net: "NET"`
  selected, and the inspector focuses the net field.
- **Wire tool** (in `interaction/circuit.ts`, beside the breadboard wire
  draft). The tool follows the joinable-point rules of section 5.1:
  - Each click snaps to the nearest joinable target within 0.4 pitch
    (`schematicPinAt`: pin, power pin, wire end, junction or label anchor),
    else to the lattice. Bends are never snap targets.
  - **Electrical classification at the key.** Ranking uses raw page
    positions (unchanged). Every contact count, however, uses the stored-field
    keys of section 3.3, so a click classifies the same way live and after
    save and reload. The click's key `K` is the winning target's key, carried
    on the returned `SchematicSnapTarget.key` (`pinKey`, the wire end of
    `wirePointKeys`, or `pointElementKey`), or else the lattice point's
    `(coordinateKey(x), coordinateKey(y))`. Core
    `schematicContactsAt(store, pageId, K, excludeId?)` (plan 47, linear in
    page elements) returns, at exactly `K`:
    - `wires`: the wires whose key path contains `K` on an axis segment,
      with `K` not equal to that wire's first or last key. This is the
      engine's interior rule of section 5.1, bends included;
    - `labels`: labels with key `K`;
    - `joinables`: the number of pins, power pins, wire ends and junctions
      with key `K`.
    The excluded element is skipped before counting, just as
    `schematicPinAt(..., excludeId)` skips it before ranking. The classified
    point is `snapped = (keyCoordinate(K.kx), keyCoordinate(K.ky))`, and the
    result carries `K`, so every write follows the key-preserving rule.
    Example: wire A runs from (-20,0) to (20,0). Wire B is stored at
    `visual.x = 0.004` with local points (0,-20),(0,20), and label CLK sits
    at (0,0). `schematicContactsAt` at key (0,0) returns `wires` [A, B], so
    the click is a labelled crossing and is rejected. A raw-position lookup
    would see only A.
  - Between the previous point and the pointer the tool inserts one corner,
    so each stretch is two orthogonal segments (horizontal first; Shift
    makes vertical first). Shift is read from the pointer event itself, both
    for the hover preview and for each click: the canvas `onPointerDown`
    path (`interaction/pointer.ts`) sends `Tool.SchematicWire` clicks
    straight to the wire tool with `event.shiftKey`, before the generic
    `creationFor` branch. The committed corner therefore always equals the
    previewed one. A palette drop through `placeTool` with the wire tool
    keeps doing nothing, as it does today.
  - A click that snaps to a joinable target other than the draft's own
    start **finishes** the wire there, so a connection point never becomes
    a non-joining bend.
  - **Deliberate T.** A start or finish click creates a
    `schematic.junction` in the same undo step only when **all** of these
    hold:
    1. the snap resolved **no** joinable target, so the user aimed at a wire
       body and not at an end, pin, junction or label;
    2. `schematicContactsAt` returns **exactly one** wire at the lattice
       point's key, no label and `joinables = 0` there. A lattice key with
       `joinables > 0` is classified as a joinable target: it finishes and
       joins by coincidence, with no junction;
    3. that point is not a bend of the draft itself.
    When the snap resolves a joinable target (for example the end of wire B
    lying on wire A's interior), the new wire joins that target only and no
    junction is added, so B and A stay separate. A point on two or more
    wire interiors (a plain crossing) gets no automatic junction; the user
    places one with the junction tool. A click on a plain crossing in the
    middle of the draft adds an ordinary bend and connects nothing.
  - **Start and finish are separate.** The start point (first click) and
    the finish point (the last point when a target click, a double-click or
    Enter finishes the draft) are classified independently. Each may need
    its own junction, either a deliberate T or an interior-label snap (next
    bullet). Every accepted click is classified once, from the raw pointer
    point, and its result (snapped point, kind, optional junction) is kept
    with the draft point. A deliberate-T or interior-label junction from
    such a click is a *pending* candidate. It is kept while the draft stays
    open, replaced (or cleared) by the next accepted click, and committed
    only if its point becomes the final endpoint. A candidate whose point
    becomes an interior bend creates no junction. Finishing never snaps a
    stored point again: Enter and double-click reuse the kept result of the
    last point. A second
    proximity snap of an already snapped point can resolve a different
    target (for example a pin 3 units away from a lattice point) and must
    not happen. The start's pending junction is kept with the draft. On finish,
    the tool commits the wire and every distinct required endpoint junction
    in one apply batch, so one undo removes all of them. Before that batch,
    the wire's derived fields and every junction `visual` are range-checked
    (section 3.3). If any field fails, the finish is declined: nothing is
    applied, and the draft, its kept results and pending junctions, and the
    undo history stay as they were before the finishing action. A finishing
    target click is then not appended and counts as a rejected click for the
    double-click rule. The status line says "Wire is outside the coordinate
    range" (`SCHEMATIC_COORDINATE_RANGE_MESSAGE`, cleared like the crossing
    notice). Esc, a draft with
    fewer than two distinct points, or a rejected click on an empty draft
    commits nothing and drops any pending junction with the draft.
  - **Snapping to an interior-attached label.** A label group whose key
    holds no non-label joinable point is attached to a wire W through rule
    4 of section 5.1. A new wire end at that key would become a non-label
    joinable point, and rule 4 would then drop W, so the tool must commit
    such a snap explicitly. The electrical target of the snap is W:
    The label case applies whenever `schematicContactsAt(K)` reports at
    least one label and `joinables = 0`, whether the label won the ranking
    or only shares the lattice key.
    - When W is the **only** wire whose path contains the key, the tool
      commits the end together with a `schematic.junction` at the key in
      the same undo step. The junction joins W (rule 3), and rule 1 joins
      the labels and the new wire to it, so W, the labels and the new wire
      end up on one net.
    - When two or more wires contain the key (a labelled crossing), the
      click is **rejected**: no point is added, nothing is committed, and
      the status line says "Label is on a crossing; add a junction or move
      the label". The other crossing wire can never be joined by a snap.
    Labels that share their key with a pin, power pin, wire end or junction
    are ordinary joinable targets (the case above).
  - Double-click or Enter finishes, Esc cancels, and at least two distinct
    points are required.
  - **Double-click disposition.** The canvas sends both pointer-downs
    before `dblclick`. The tool records whether the latest pointer-down was
    accepted or rejected. A double-click whose latest pointer-down was
    rejected does nothing: the draft, its pending junctions, the document,
    the undo history and the crossing notice stay as they are. A
    double-click whose latest pointer-down was accepted finishes from the
    stored last point and its kept result, exactly like Enter. A
    double-click on an empty draft does nothing.
  - **Wire point editing.** A selected schematic wire shows one handle per
    point. Handles reuse the breadboard `breadboard-wire-point` gesture
    (batch on start, commit on release, abort on cancel). The edit follows
    these rules:
    1. *Fixed anchors.* Only the dragged point moves. Every other stored
       point keeps its page position, in particular the unselected
       endpoint(s), so pin attachments survive. Moving the first point
       never moves the last one, even on a two-point wire.
    2. *Local elbows.* The reroute works on stored local fields, with the
       wire origin unchanged. The moved point's local fields come from its
       classified key (section 3.3, key-preserving writes). If the segment
       between the moved point and a fixed neighbour is no longer
       orthogonal, one elbow is inserted. The elbow keeps the axis that the
       original segment had at the fixed neighbour, and copies its two local
       fields exactly from that neighbour and from the moved point.
       Consecutive duplicate points are dropped. The whole resulting
       polyline is checked orthogonal on the exact stored values before it
       is written. A result that is not orthogonal or has fewer than two
       distinct points is not written, and the previous position stays
       (subject to the rejection precedence of rule 4).
    3. *Bends.* A bend snaps to the lattice only and never connects. No
       junction is created for a bend.
    4. *Ends.* Each pointer move classifies the raw pointer point with the
       wire-tool click classification. The edited wire is excluded
       *before* the nearest target is chosen and before contacts are
       counted, through the optional excluded id of core `schematicPinAt`
       and `schematicContactsAt`, so the wire's own ends and body can neither
       win, mask the snap nor be counted. Coincident labels at the classified
       key count as well as the nearest snap target. The move writes the end
       at the classified key `K` (key-preserving), so the end, its target
       and any junction share `K` live and after reload. The end is always
       the first or the last point of the rerouted polyline. The move keeps
       the classification result for the release. Nothing else is written
       during the move.
       *Rejection precedence.* Classification happens before the reroute.
       A `label-crossing` sample is recorded as the release disposition even
       when its reroute is null (for example when the end collapses onto
       the fixed end), and it replaces any earlier accepted sample. Only a
       non-rejected sample with a null reroute keeps the previous
       disposition and geometry. *Range.* A non-rejected sample whose
       written local fields or junction `visual` fail the range check of
       section 3.3 is treated exactly like a null reroute. It writes
       nothing, keeps the previous disposition and geometry, and shows
       "Wire is outside the coordinate range". The range check runs at
       move time, so release never applies an unchecked junction and the
       gesture never throws. Releasing after a rejected last sample
       aborts the whole gesture batch, which rolls back every earlier
       in-gesture write, and shows the notice. On release, the kept
       result of the last move is committed exactly; the stored end is
       never classified or snapped again. A deliberate T or an interior
       label on exactly one other wire adds its junction at that same key
       `K`, inside the gesture batch, so it is part of the
       same undo step. A labelled crossing rejects the drop: the batch
       is aborted (geometry, topology and history unchanged) and the notice
       "Label is on a crossing; add a junction or move the label" is shown.
       The notice clears when the next wire point edit starts or an
       accepted edit or wire-tool click happens.
    5. *Cancel.* Esc or pointer cancel aborts the batch. No junction exists
       before release, so nothing remains.
    6. *Keyboard.* Each handle is a focusable SVG control (`tabindex="0"`,
       `role="button"`, `aria-label` "Wire start", "Wire end" or "Wire bend
       N of M", visible focus ring in `var(--nodetto-accent)`). Arrow keys
       move the focused point by one lattice pitch. Each key press
       classifies the target once (the current point's key plus one pitch in
       hundredths, classified like a pointer move with the wire excluded,
       with rejection checked before the reroute) and applies rules 1-4 as
       one complete edit (one undo step). A rejected move, a null reroute
       or an out-of-range result (range checked before the batch opens)
       changes nothing and leaves focus where it was. A rejected move shows
       the crossing notice, and an out-of-range result shows the range
       notice. The handle calls
       `preventDefault` so the canvas nudge does not also run. The edit
       returns the moved point's index in the resulting polyline, after
       elbow insertion and duplicate removal. If the moved point lands on
       an adjacent point, the two merge and the merged point's index is
       returned. Focus moves to the handle at the returned index, so
       repeated presses keep moving the same point. Example: focus the bend
       of [(0,0),(30,0),(30,20)] and press ArrowDown. The result is
       [(0,0),(30,0),(30,10),(30,20)] with index 2. A second ArrowDown
       merges the point into the end and gives [(0,0),(30,0),(30,20)] with
       index 2. Two undos restore the original. Breadboard handles are
       unchanged.
- **Keys** on a `schematic` page with schematic parts, power or labels
  selected and no modifier: `r` rotates clockwise, `Shift+R`
  counter-clockwise, `x` mirrors parts. Elsewhere `r` keeps its rectangle
  meaning; `TOOL_KEYS` is unchanged.
- **Inspector** `inspector/SchematicSection.tsx`, matched on `schematic.*`
  in `Inspector.tsx`: reference, value and the type fields; the IC pin
  table (add, remove, reorder, number, name, side); net name of power and
  label; "Rotate left", "Rotate right" and "Mirror" buttons; a read-only pin
  list with each pin's net name. All edits go through
  `updateSchematicSemantic`. Every control is a native focusable element.
- **Problems panel** `SchematicProblemsPanel.tsx` (follows
  `BreadboardProblemsPanel`, 300 ms debounce, existing CSS tokens): rows
  show severity, reference and pin, message, rule id. A row click calls
  `focusBreadboardProbe(editor, {pageId, elementIds}, viewport)` (reused,
  no pin). A "Fix references" button runs `annotateSchematic`. A "Send to
  breadboard" button (section 8.1) is enabled when the document has a
  breadboard page; with several breadboard pages a select chooses one.
  Mounted by the desktop on `schematic` pages, and on `pcb` pages when the
  document has a schematic page (it then lists PCB parity findings,
  section 8.2, focuses `finding.pageId` when present, and hides both
  buttons). A failed "Send to breadboard" lists its error diagnostics in
  the panel and leaves the breadboard card unchanged.
- **Export dialog**: a `schematic` format enabled on `schematic` pages with
  "Netlist (text)" (`.txt`) and "KiCad netlist (.net)" buttons, written by
  `exportSchematic(kind)` in `apps/desktop/src/shell/export-handlers.ts`
  like `exportBreadboard`.

### 7.4 Desktop page following

`apps/desktop/src/page-workspace.ts`: `DEDICATED_WORKSPACES.schematic =
"schematic"`, `DEDICATED_PAGE_NAMES.schematic = "Schematic"`. Choosing
Schematic in Mode opens or creates a `schematic` page.

### 7.5 JSONL, Mermaid, D2, collab

JSONL is generic (golden fixture, section 3.5). Mermaid skips unknown types
already (test pins it). `d2/export.ts` skips `isSchematicElementType`
elements with one warning per page, "Schematic elements are not exported
to D2.", next to the breadboard skip. `packages/collab/src/test-fixtures.ts`
`allFixtures()` gains a schematic fixture.

## 8. Interop

### 8.1 Schematic as the breadboard netlist source

The existing breadboard parity rules 9-13 and the ratsnest read only the
`breadboard.netlist` card. The schematic feeds that card; parity, ratsnest,
card rendering and the card inspector are reused unchanged.

Pipeline (it runs where core and io meet: the CLI and ui-solid):
1. core: `computeSchematicConnectivity` then `toSchematicNetlist` of the
   schematic page.
2. io: `breadboardTargetFromSchematic(netlist, {pageName})` in
   `packages/io/src/schematic/breadboard-target.ts` returns
   `{target?: BreadboardNetlistSemantic, diagnostics}`. It does **not**
   write and re-parse text. It calls the shared mapping function
   `mapKicadSymbol` (`packages/io/src/kicad/symbol-map.ts`, unchanged) once
   per component with exactly the input the netlist importer would build
   from the schematic's own KiCad export: `lib "nodetto"`, the section 7.2
   `partName`, reference, value, the component's pins (number as string,
   name) and footprint `""`. Steps:
   a. **Projectability check, before any mapping.** One linear pass over
      the components with a `Map` of references. Every failure adds an
      error diagnostic naming the reference, and any error returns no
      target:
      - **Unique references**: a reference held by two or more components
        (exact string, as ERC `duplicate-reference`) gives
        `schematic.duplicateReference`, listing every holder's element id.
        This matches the text importer, which would keep only the first
        holder (`kicad.duplicateReference`, `netlist.ts:64-71`). The direct
        mapping never shares one pin map between two components.
      - **Annotated references**: a reference ending in `?` gives
        `schematic.unannotatedReference` ("run Fix references"), because
        breadboard parity matches parts by reference.
      - **Dense pins**: every component's pin numbers must be exactly
        `1..n` with n at most 40. Only an IC can fail this (sparse numbers
        such as 1, 3, 7, 9, or more than 40 pins); connectors are
        `1..pinCount` and every other symbol has a fixed `1..k` table.
        Failure gives `schematic.unprojectablePart` with the reason ("pin
        numbers 1, 3, 7, 9 are not 1..4", "48 pins, at most 40").
      A schematic that passes step a is **projectable**.
   b. **Map** each component through `mapKicadSymbol` and collect its type
      and `pinMap` in a `Map` keyed by reference. Mapping warnings
      (`kicad.unsupportedSymbol`, `kicad.pinNamesMissing`) are passed
      through. A `skip` result (not reachable after step a) is an error.
   c. **Translate nodes** with a `Map` lookup per node. Nodes are sorted
      by component natural order, then mapped pin. Nets are sorted by
      their first node. Names are kept verbatim; they are unique by section
      5.2.
   d. Return `{source: "<page name>.net", format: "kicad_net", parts,
      nets}`. Parts are `{reference, value, type}` in natural reference
      order.
   Because step a guarantees `1..n` pins and every pin is in exactly one
   net (section 5.2), the target holds exactly the schematic's pins: no
   phantom pins, and the partition is preserved. The work is linear in
   pins plus nodes, plus sorting. An equivalence test pins that, for
   **projectable** schematics (unique, annotated references and dense
   pins), the target equals
   `importKicad(exportSchematicKicadNetlist(netlist).text,
   {fileName: "<page name>.net"}).plan.target` for every symbol type.
   Non-projectable schematics are outside the equivalence and always fail. That keeps `format: "kicad_net"` truthful: the card is
   exactly the import of the schematic's own KiCad netlist. No breadboard
   type or enum changes.
3. core: `Editor.setBreadboardTarget(breadboardPageId, target)` replaces
   the semantic of the page's first visible `breadboard.netlist` card, or
   creates one (16 x 4 pitch card) at the right of the page's existing
   bounds plus 2 pitches, top aligned. One undo step. It never annotates or
   moves parts. It is called **only** when step 2 returned a target. On
   failure the existing card, if any, is left untouched. The CLI exits 1
   and writes nothing (section 9), and the panel lists the error
   diagnostics.

Mapping consequences (section 7.2 table): power and ground symbols are net
names, not parts. Inductors and voltage sources become 2-pin headers,
MOSFETs become transistors, switches become buttons (1 to 1, 2 to 3), and an
IC with `1..n` pins becomes a DIP-n (even n, 4..40) or a header. Mapping
warnings are shown (CLI stderr, desktop notice) and not stored.

### 8.2 Schematic-to-PCB parity (`packages/core/src/schematic/pcb-parity.ts`)

PCB pads carry net names from the board file, so parity compares
partitions, matched by reference and pin/pad number string:
`schematicPcbParityFindings(document, pcbPageId, schematicPageId)`. The
source is the first `schematic` page in document page order. It imports
only ir and `schematic/` (not `packages/core/src/pcb`).
- Resolve each schematic component to the first visible `pcb.footprint`
  with the same `reference` (one `Map` built in element order). Each
  footprint gets a `Map` from `pad.number` to pad. A schematic pin matches
  the pad whose number is `String(pin)`. An empty `pad.net` makes that pad
  its own singleton net.
- Findings use the schematic finding shape plus an optional `pageId`: the
  page that holds `elementId` when it is not the linted PCB page. The
  missing-part rule needs it because a missing part has no PCB element.

| rule id | severity | reports on | semantics |
|---|---|---|---|
| `pcb-parity-missing-connection` | warning | the footprint, with `pin` | For a schematic net with two or more nodes: (a) each node whose component has a footprint but the footprint has no pad with that number ("R2 has no pad 1 for net N1"), and (b) when the present pads lie in two or more PCB nets, one finding per extra PCB net group, on the first pad (node order) of that group. |
| `pcb-parity-extra-connection` | error | the footprint holding the first pad of the second schematic net | A PCB net whose matched pads belong to two or more schematic nets. One finding per PCB net. |
| `pcb-parity-missing-part` | warning | the **schematic part element**, with `pageId` = the schematic page | A schematic component with no footprint of that reference. Works on an empty PCB page: every component is reported. |
| `pcb-parity-extra-part` | warning | footprint | A footprint whose reference is in no schematic component. |
| `pcb-parity-value-mismatch` | warning | footprint | Values differ (`parseComponentValue` numeric comparison with relative tolerance 1e-9, else trimmed case-insensitive). |

- `pin` holds the pad number when it is a positive integer.
- Clicking a row calls `focusBreadboardProbe(editor, {pageId:
  finding.pageId ?? pcbPageId, elementIds}, viewport)`. For a missing part
  it switches to the schematic page and selects the part. Every finding
  therefore has a real element to focus, even on an empty PCB.
- CLI text rows show the element id. JSON rows add `"pageId"` only when it
  is present.
- All lookups are `Map`s keyed by reference and pad, so the work is linear
  in pads plus nodes.

### 8.3 KiCad import onto a schematic page

The shared parser and mapping layer is reused as is: `importKicad` reads
`.kicad_sch` and `.net` files through `sexpr.ts`, `schematic.ts`,
`netlist.ts` and `symbol-map.ts` into a `BreadboardImportPlan` (parts with
breadboard types, and a target partition in breadboard pin numbering in
which every mapped pin of a part is in exactly one net). KiCad symbol
geometry differs from nodetto's symbols, so KiCad wires cannot be reused.
The import reproduces the partition with net labels:
`layoutSchematicImport(plan): {document, diagnostics}` in
`packages/core/src/schematic/import-layout.ts`, deterministic and linear in
parts plus nodes (one `Map` from reference to the part's pins and nets):
- **Input validation, before any element is created.** One linear pass
  over the plan nets with a `Map` from `reference\0pin` to net index, plus a
  per-part pin-set size. Any error returns `{diagnostics}` with **no
  document**. The CLI `schematic import` then exits 1 and writes nothing.
  - **A pin in two nets.** The shared importer can return the same pin in
    two nets (`netlist.ts:138-158` keeps repeated assignments, for example
    R1.1 in both LEFT and RIGHT). Laying that out would put both nets' stubs
    on one pin and merge them, so it gives the error
    `schematic.importPinInTwoNets`, naming the reference, the pin and both
    source net names. A pin repeated inside one net is deduplicated
    silently.
  - **Pin capacity.** A part whose pin set P (below) has more than 256 pins
    gives the error `schematic.importTooManyPins`. The importer does not
    cap pin counts for catalogue names (`symbol-map.ts:121-123` accepts a
    `nodetto:DIP` with 257 pins), while the schematic IC table allows 256.
- Title `plan.title`, one page `{id: "page-1", kind: "schematic",
  name: "Schematic"}`.
- **Part mapping from the actual source pins.** Let P be the set of the
  part's pin numbers that appear in plan nodes. These are the source
  numbers after the importer's pin map. After validation each pin is in
  exactly one net, and P may be sparse, for example {1, 3, 7, 9} for a `.net` IC whose
  `libparts` lists those pins (the importer then reports `pinCount` 4).
  `parameters.pinCount` is never used to build pins: the schematic part
  always has exactly the pins in P, so every node has a pin and no pin is
  invented.
  - resistor, led, diode, potentiometer and battery map to the schematic
    type of the same name with identity pins, when P is a subset of that
    symbol's pin numbers.
  - capacitor maps to capacitor (`polarized` for electrolytic) when P is a
    subset of {1, 2}.
  - transistor maps to bjt with `polarity` when P is a subset of {1, 2, 3}.
    Breadboard pin i is pinout letter i, and E, B, C map to schematic pins
    1, 2, 3.
  - header maps to connector with `pinCount = max(P)` when P is exactly
    `1..max(P)` **and** `max(P) <= 40`, the connector's range (section
    3.2). A dense header with 41 to 256 pins is not a connector. It takes the
    fallback below (an IC box with exactly its pins), so a 41-pin header
    keeps net `LAST` on pin 41.
  - ic maps to `schematic.ic` whose `pins` are P in ascending order, with
    their **source numbers kept** (sparse numbers are valid in the IC pin
    table, section 3.2). The first `ceil(|P| / 2)` go `left`, the rest
    `right`, names empty.
  - button maps to switch (style push):
    - When P has exactly two pins, they map in ascending order to schematic
      pins 1 and 2. This covers `SW_Push` (P = {1, 3}) and identity-mapped
      `SW`-prefix switches such as `SW_SPST` (P = {1, 2}), so their two
      terminals stay distinct.
    - Otherwise (a 4-pin `nodetto` PushButton), the bond groups map as
      {1, 2} to pin 1 and {3, 4} to pin 2, but only when each group's pins
      lie in one plan net.
  - **Fallback.** Any part whose P fails its row's condition (for example a
    button whose bond group is split across nets, a header with more than 40
    pins, or a header with sparse
    pins) becomes a `schematic.ic` box with exactly P as its pins (source
    numbers, ascending), with the warning `schematic.importPartAsBox`. The
    partition is never merged and no pin is invented. Validation has already
    capped P at 256, the IC table's limit, so the box always fits. A part
    with an empty P (all its pins unmapped) has nothing
    to connect: it is skipped with the warning `schematic.importSkippedPart`.
  - References and values are kept verbatim.
- **Net names in the connectivity namespace.** Labels join by trimmed,
  case-sensitive text (section 5.1 rule 6), so names are normalised with
  `trim()` before reservation:
  1. In plan order, the first net with each non-empty normalised name
     keeps it, and that name is reserved.
  2. Then, in plan order, a net whose normalised name is a duplicate (for
     example `A` and `" A "`) or empty gets the first unused candidate from
     `firstUnusedName` (section 5.2). The base is the normalised name, or
     `N_<reference>_<pin>` of its first node when empty, followed by `_2`,
     `_3` and so on, checked against every reserved and assigned name. This
     adds the warning `schematic.importRenamedNet` (duplicate) or
     `schematic.importEmptyNetName` (empty), naming the source net.
  Label text is the final name. Distinct plan nets therefore never share a
  label and never merge.
- **Placement.** Parts go left to right in plan order at rotation 0 with a
  4-pitch gap between boxes, wrapping at 120 pitches. Rows are separated by
  the tallest box plus 6 pitches. Pins of different parts are therefore at
  least 5 pitches apart, and stub ends at least 1 pitch apart, so no stub
  end ever coincides with another part's point.
- **Stubs and labels.** A node gets a 2-pitch orthogonal wire stub outward
  from its pin (section 4.1 direction), ending in a `schematic.label` with
  the net name:
  - for every node of a net with two or more nodes;
  - for the single node of a one-node net whose final name differs from
    the importer default `N_<reference>_<pin>`, so a named singleton such as
    `SENSE` keeps its name. ERC then reports it as `single-pin-net`, which
    reflects the source.
  Other one-node nets get no stub.
- Element ids: `part-<n>`, `wire-<n>`, `label-<n>` in creation order.
- The diagnostics are those of `importKicad` followed by the layout
  warnings.

The page's netlist (section 5.2) has exactly the plan's partition and the
(deduplicated) plan names for every labelled net (tested). KiCad wire
geometry, power-symbol artwork and sheet positions are not preserved
(section 13).

**Existing importer work bounds (shared code, behaviour unchanged).** The
schematic page import is a new native-CLI path into existing importer code.
That code is made linear without changing any result:
- `packages/io/src/kicad/netlist.ts`:
  - The node rows are grouped once into a `Map` from reference to rows. This
    replaces the per-component rescan of every net node at lines 79-85.
  - The singleton check at lines 160-176 uses a `Set` of `reference\0pin`
    keys built while the nets are read.
- `packages/io/src/kicad/schematic.ts`, contacts:
  - The per-segment scan of every point (lines 383-387) is replaced by
    candidate selection, and every candidate is still confirmed by the
    unchanged `onSegment` (integer 1e-4 mm units). The candidate set is
    always a superset of the true contacts, so the contact set is
    identical.
  - **Axis-parallel segments** use `sweepAxisContacts` (section 5.1) on
    rows `y-1..y+1` (columns `x-1..x+1` for vertical), with the `+-1` range
    tolerance of `onSegment`.
  - **Diagonal segments** are driven per segment through a 2D range query,
    so no query ever enumerates directions:
    - The structure is built only when the file has at least one diagonal
      segment. Files without diagonals take exactly the axis-parallel path
      above, which keeps the ordinary path unchanged.
    - It is a static merge-sort range tree over all contact points: points
      sorted by x, with each tree node holding its points' indices sorted by
      y. Build cost is O(P log P).
    - Each diagonal segment queries its bounding box grown by the `+-1`
      tolerance. `onSegment` rejects every point outside that box, so the
      reported points are a superset of the true contacts.
    - **Exact-arithmetic gate.** Line-based filtering must never drop a
      point that the existing Number predicate `onSegment`
      (`schematic.ts:98-106`) accepts. Let W be the largest coordinate
      magnitude over all contact points and segment ends (integer 1e-4 mm
      units). When `8 * W * W < 2^53`, every product and difference in
      `onSegment` and in the intercept `c = dyn * x - dxn * y` is an exact
      integer in Number. The file is then in **exact mode**, where
      `onSegment`'s cross product equals `g * (c_p - c_a)` exactly
      (`g = gcd(|dx|, |dy|)`, reduced direction `(dxn, dyn)`). It accepts a
      point only when `c_p = c_a`, or when `g = 1` and `|c_p - c_a| = 1`,
      and the point lies in the box grown by `+-1`. A KiCad A0 sheet is
      about 1.2e7 units, far inside the gate. When the gate fails (for
      example coordinates near 1e9), **no line-based filtering is used**:
      every diagonal segment uses box reporting only, and every reported
      point goes straight to `onSegment`. The candidate set is then a
      superset decided by exact comparisons alone, so a midpoint such as
      (1050000003, 1050000004) on the segment (1000000000, 1000000003) to
      (1100000006, 1100000005) is always kept.
    - The counter `stats.diagonalWork` counts, **before** confirmation,
      every tree node visited, every binary-search step, every reported
      point, every lattice lookup and every line-hash entry. Empty and
      rejected probes are therefore included.
    - **Per-segment source, exact mode.** For each diagonal segment, a
      counting query on the range tree (`O(log^2 P)`, no points reported)
      gives its box count `B_s`. The segment then uses the cheaper of:
      - **box reporting**: `B_s` points, each line-filtered, then confirmed;
      - **lattice walk**: the only integer points that `onSegment` can
        accept. For `g >= 2` these are `a + t * (dxn, dyn)` for the integer
        t range inside the `+-1` box, about `g + 3` of them. For `g = 1` they
        are those points plus the solutions of `dyn * x - dxn * y = c_a +- 1`
        inside the box, found with the extended Euclidean algorithm; there
        are at most 2 per offset line because their spacing is the whole
        segment vector. Each lattice point is looked up in the existing
        `pointIndex` hash.
      So a segment costs `O(log^2 P) + min(B_s, g_s + 7)`. This is the
      cross-direction bound: a segment with an unrelated wide box never
      reports that box when its lattice is short, whatever the other
      directions. The mixed-direction overlapping case (segments
      (0, 10i) to (100N, 100N + 11i + 1)) has small g, so it costs
      `O(N log^2 N)`, not the 4M reports of box reporting.
    - **Per-direction line hash, exact mode.** Within one reduced direction
      d, if the sum of the chosen per-segment costs exceeds `P`, the
      direction switches to a line hash. One pass computes c for every point
      (P work), buckets points by c with each bucket sorted by x, and each
      segment binary-searches buckets `c_a` (and `c_a +- 1` when `g = 1`)
      within its x range `+-1`. This bounds the overlapping-parallel case
      ((0, 10i) to (100N, 100N + 10i), with g = 100N): one direction, cost
      `O(P + S log P)` plus real contacts.
    - **Bound.** In exact mode the total is
      `sum_s O(log^2 P) + sum_d min(sum_{s in d} min(B_s, g_s + 7),
      P + S_d log P + reported_d)`, all counted in `stats.diagonalWork`.
      It is near-linear for disjoint mixed directions, overlapping mixed
      directions with short lattices, and overlapping parallel wires.
    - **Global budget on the new schematic import path.** The strategy above
      is near-linear for the cases listed, but some inputs remain expensive:
      many directions with long lattices and wide boxes, or any wide boxes
      outside exact mode. For example, with N = 2000 and G = N + 1, segments
      from (0, 10i) to (G * N, 10i + G * (N + i)) cost about 4M reported
      points for 4,000 contacts. The schematic import therefore runs
      diagonal lookup under a hard budget:
      - **Opt-in policy, limit computed inside the importer.** The caller
        cannot know S and P before parsing. The schematic import
        (`schematic import` CLI) therefore passes only the policy flag
        `importKicad(text, {fileName, stats, diagonalBudget: "schematic"})`.
        The file is parsed once (`packages/io/src/kicad/index.ts:29-36`
        dispatches to `importSchematic`). After `importSchematic` has
        collected its contact points and wire segments
        (`packages/io/src/kicad/schematic.ts:296-307, 348-357`) and before
        any diagonal lookup, it computes the numeric limit as
        `diagonalBudgetLimit(S, P) = 2 * S * (2L + 2) * (L + 1) +
        16 * (P + S)`, where S is the number of diagonal segments, P the
        number of contact points and `L = ceil(log2(P + 1))`. That is twice
        the counting-query cost plus a linear term: about 1.45M for P = 4000
        and S = 2000. `diagonalBudgetLimit` is an exported pure function in
        `packages/io/src/kicad/schematic.ts`, so tests can compute the
        expected limit. The computed limit is reported in
        `stats.diagonalBudgetLimit`. A `.net` input has no geometry, so the
        policy has no effect on it.
      - Every unit of diagonal work is counted as it happens, in every
        branch: counting queries, box reporting (in and outside exact mode),
        lattice lookups, line-hash build and bucket reports. When the
        counter would pass the budget, the importer stops at once and
        returns no plan, with the error diagnostic
        `schematic.importTooComplex` ("Diagonal wires need more than <budget>
        lookup steps; straighten diagonal wires or import as a breadboard").
        Total diagonal work is therefore at most `diagonalBudgetLimit + 1`
        on this path. Nothing is laid out and no schematic is written; the
        CLI exits 1.
      - Files without diagonal segments never touch the budget, so the
        ordinary orthogonal path is unchanged.
      - **Existing callers** (breadboard import, the desktop KiCad open
        flow, `breadboard import`) pass no `diagonalBudget` policy. They run
        the same lookup unbudgeted and return exactly the current results.
      Every import that completes is covered by the oracle equality below.
  - Both axis-parallel and diagonal lookups count the KiCad schematic
    importer's lookup work before confirmation, in
    `stats.segmentCandidates` and `stats.diagonalWork`.
  - **Degenerate segments** (a equal to b) look up the `pointIndex` keys
    within `+-1`.
- `packages/io/src/kicad/schematic.ts`, net naming (lines 445-457): after
  the last union, one pass over the label anchors builds a `Map` from final
  root to label texts. The anchor index is known, so there is no
  `indexOf`. Each list is sorted once, and the name pass reads the map
  instead of filtering every anchor for every root. Precedence is
  unchanged: power value, then the alphabetically first label, then
  `N_<ref>_<pin>`, then the existing `usedNames` suffix loop. Map
  accumulations push instead of copying arrays.
- `importKicad(text, {fileName, stats?, diagonalBudget?: "schematic"})`
  gains an optional `stats: {nodeVisits, segmentCandidates, diagonalWork,
  diagonalBudgetLimit, labelVisits}` counter and the optional
  `diagonalBudget` policy flag. The flag is not a number: the importer
  computes the limit itself. Both options are absent for existing callers,
  whose behaviour is unchanged.
- **Exact preservation evidence**: `packages/io/src/kicad/schematic.test.ts`
  keeps a test-only brute-force oracle, a verbatim copy of the current
  all-pairs contact scan and label filter written inside the test. It
  asserts that the new importer's plans (parts, nets, node order, net names
  and diagnostics) equal the oracle's on every `test-fixtures/kicad/`
  fixture and on deterministic generated inputs: an orthogonal grid,
  parallel diagonals, a 45-degree fan, points at the `+-1` tolerance edge,
  stacked labels and duplicate label texts. All existing KiCad tests must
  also pass unchanged. The baseline is 31 passing tests in the five KiCad
  and breadboard parity/ratsnest test files listed in section 11.

## 9. CLI (apps/cli)

- **Page and elements**: `edit` `add-page` accepts `kind: "schematic"` and
  `set-page-mode` accepts `schematic` (from `PAGE_KINDS`/`PAGE_MODES`).
  `edit add` works with `type: "schematic.*"` (registry defaults) or a
  `schematic:*` shape id. `types --kind schematic` lists the 18 types
  (`types-command.ts`). `pages --kind schematic` works generically. Help
  text lists `schematic` wherever the kind and mode lists are spelled out.
- **`lint`**: selects `schematic` pages and runs `lintSchematicPage` plus
  image-missing, like breadboard; JSON adds `pin` when present. A `pcb`
  page is selected only when the document has a schematic page, and then
  runs `schematicPcbParityFindings`; its JSON rows add `pageId` when the
  subject is on the schematic page (section 8.2). Documents without a
  schematic page lint exactly as before. The no-page message in `lint-diagram.ts:24` is
  left unchanged: it is shown only when no lintable page exists, which
  implies no schematic page, and it is pinned by
  `apps/cli/src/breadboard-commands.test.ts:147,155`, a test of another
  mode. Exit codes unchanged.
- **`export`** (SVG/PNG/JPG/PDF) and **`capture`** need no change beyond
  the core svg-export branch.
- **`schematic`** command group (`apps/cli/src/schematic-command.ts`,
  dispatched in `commands.ts`, help in `help.ts`):
  - `schematic netlist <doc.jsonl> --format text|kicad [--page <id|name>]
    [--output <file> | --check <file>] [--strict]` (breadboard netlist
    rules: auto page when single, `--page` required with several, exit 2
    for usage, `--check` drift exit 1, `--strict` with warnings exit 3).
  - `schematic import <file.kicad_sch|file.net> [--output <file.jsonl>]
    [--strict]` (breadboard import rules: diagnostics on stderr, exit 1 on
    error, exit 3 with `--strict` and warnings). It opts in with
    `diagonalBudget: "schematic"` (section 8.3); the importer computes the
    numeric limit after its single parse. So `schematic.importTooComplex` is an
    error: exit 1 with nothing written.
  - `schematic to-breadboard <doc.jsonl> [--page <schematic>]
    [--breadboard <page>] [--output <file.jsonl>]`: section 8.1, writes the
    updated document to stdout or `--output`, mapping warnings on stderr,
    exit 2 when the document lacks either page kind, exit 1 and nothing
    written when the projection fails (`schematic.unprojectablePart` lines
    on stderr).
- `README.md` CLI table and the `OVERVIEW` text list `schematic`; the
  arrange help table gains `schematic  excluded: electrical wiring geometry`.

## 10. Docs and example

- `docs/schematic.md`: the mode; element types with one sample record
  each; symbol pin tables; the connectivity rules (crossing, junction,
  labels); the five ERC rules (table rows start ``| `<rule-id>` |``) and
  the five PCB parity rules; the text netlist format; the KiCad mapping
  table; CLI usage for `edit`, `lint`, `export`, `capture` and the
  `schematic` group. ASCII only.
- `README.md`: a short "Schematic pages" section.
- `examples/schematic/led-switch.jsonl` plus `README.md`: BT1 `9V` with a
  `VCC` rail symbol on `+` and a ground on `-`; SW1 toggle from `VCC` to a
  `SW_OUT` label; R1 `470` from `SW_OUT` to D1; D1 cathode to ground; C1
  `100n` from `SW_OUT` to ground through a junction T. Expected: `lint`
  exits 0 with no findings; nets `GND`, `SW_OUT`, `VCC`, `N_R1_2`. Golden
  files `led-switch.netlist.txt` and `led-switch.net`.

## 11. Tests

Colocated `*.test.ts`:
- **ir**: per-type `validateSemantic` (wire points, `wireDiagonal`, IC
  pins), defaults, key order, pinned lists and the golden fixture
  (section 3.5). `segment-sweep.test.ts`: contacts on rows and columns,
  touching ends, overlapping collinear segments, and two work-count cases
  on `stats.sweepWork`:
  - N = 1000 disjoint segments on one row, each with one query inside it:
    at most 3N + N units (push, pop and one contact per query). This rules
    out N squared.
  - A sparse 50 x 50 grid of orthogonal wires with 100 queries: at most
    2S + Q + K units.
  `keyOrder.test.ts` (or the existing ir key-order test file) covers
  `roundCoordinate` and `coordinateKey` after the move: idempotence,
  `-0.125` to `-0.13` (key `-13`), and `0.004` and `10.004` against
  `10.008`. `packages/io/src/jsonl/canonical.test.ts` (21 tests) passes
  unchanged.
- **core `schematic/`**:
  - `symbols.test.ts`: pin tables per type; IC layout per side; box;
    pins at 0/90/180/270 with and without `flipX` stay on the lattice for
    an on-lattice anchor; the anchor pin keeps its exact position under
    rotate and mirror, including an **off-grid wired anchor** at (3, 0)
    whose wire end stays coincident and connected after a 90-degree
    rotation. Breadboard rotation tests pass unchanged with the extracted
    `planAnchoredRotation`.
  - `connectivity.test.ts`, the crossing and junction matrix:
    - an endpoint-to-endpoint join and a wire end on a pin connect;
    - two wires sharing an **interior vertex** at (0, 0)
      (`[(-10,0),(0,0),(10,0)]` and `[(0,-10),(0,0),(0,10)]`) stay
      separate;
    - a **label at a plain crossing** with no vertices there attaches to
      the first wire in element order only, and the other wire stays
      separate;
    - a **coincident label group**: labels A and B together at (0, 0) on a
      single wire from (-10, 0) to (10, 0) both attach to that wire, so A,
      B and the wire are one net. The same pair on a plain crossing attaches
      only to the first wire;
    - an **explicit junction** at the crossing (and at the shared vertex)
      joins both wires;
    - a T end on another wire's interior or bend without a junction does
      not connect, and with a junction it does;
    - two same-named labels join separate islands;
    - a label and a power symbol with the same name join;
    - hidden elements are ignored;
    - `stats.sweepWork` on the 1000-segment row case stays within the bound
      above;
    - **save and reload stability** (`connectivity-roundtrip.test.ts`,
      core with io in tests): nets, membership and `lintSchematicPage`
      findings are equal for the live document and for
      `parseDocument(serializeDocument(doc))`. Cases:
      - wire origin `x = 0.004` with end offset `10.004`, and a junction at
        `10.008` (keys 1000 and 1001, separate both live and reloaded);
      - a junction and a wire end both at `x = -0.125` (key `-13`, joined
        both ways);
      - an off-grid part anchor at (3.37, 0) wired, rotated, saved and
        reloaded, which stays connected;
      - **negative-tie group move through the real move path**: joined
        origins `-1` (a wire with end offset 0) and `-0.999` (a junction),
        both key `-100`, with snapping off and a shared delta of `-0.005`.
        The move goes through the nudge or drag path, which builds
        destinations with `shiftedTarget` and then calls
        `Editor.moveElements`. Both stored origins are `-1.01` (key `-101`),
        and the net stays joined live and after save and reload. A second
        case starts from `-0.125` and `-0.13` (key `-13`) with delta +1: both
        go to key 87 and stay joined;
      - **range**: a schematic wire point at `1e307` (and a visual x at
        `2e307`) fails validation with `schematic.coordinateRange`. Values
        at the limit `1e9` and `-1e9` validate and get distinct exact keys.
  - `netlist.test.ts`: ordering, explicit-name priority, one-node nets, and
    the second-order collision (labels `N_J3_1_3` on J1.1 and `N_J3_1` on
    J2.1, and J3.1 unnamed, gives `N_J3_1_3`, `N_J3_1` and `N_J3_1_3_2`,
    with membership unchanged).
  - `erc.test.ts`: positive and negative test per rule, the no-connect
    exemption, the missing-junction hint for an end on a bend.
  - `annotate.test.ts`, `snap.test.ts`, `notation.test.ts` (roles per
    type, `flipX` applied in body, labels outside the rotation group, ink
    from the passed palette).
  - `pcb-parity.test.ts`:
    - one positive and one negative test per rule;
    - **missing pad**: R1.1 and R2.1 joined in the schematic, while the PCB
      has R1 pad 1 and R2 only pad 2, gives `pcb-parity-missing-connection`
      on R2 pin 1;
    - **empty PCB page**: one `pcb-parity-missing-part` per component, each
      with the schematic element id and `pageId`;
    - a fully matched board gives no findings;
    - a PCB-only document gets no parity run.
  - `import-layout.test.ts`:
    - mapping per part type;
    - an **identity-mapped `SW_SPST`** with nets LEFT (SW1.1, R1.1) and
      RIGHT (SW1.2, R1.2) keeps LEFT and RIGHT distinct on switch pins 1 and
      2;
    - `SW_Push` (P = {1, 3}) maps to 1 and 2;
    - **header capacity** (via `importKicad` in the test): a `.net` with
      `nodetto:Header` J1, pins 1..41 and net `LAST` on pin 41 becomes a
      valid `schematic.ic` box with 41 pins, and `LAST` is still on pin 41.
      The same file with 40 pins becomes a 40-pin connector. The document
      validates in both cases;
    - a 4-pin `nodetto` PushButton with a split bond group falls back to an
      IC box with exactly its pins and the warning;
    - a **sparse IC** from a `.net` with `libparts` pins 1, 3, 7 and 9
      (through `importKicad` in the test) becomes an IC with pins
      1, 3, 7, 9, and pins 7 and 9 keep their nets;
    - the **named singleton** `SENSE` keeps a label, and default-named
      singletons get none;
    - a duplicate source net name is renamed with the warning;
    - **whitespace collision**: singleton nets named `A` and `" A "` stay
      separate (`A`, then `A_2`, with the warning), and an empty name gets
      `N_<ref>_<pin>`;
    - **a pin in two nets**: a `.net` with R1.1 in both LEFT and RIGHT (via
      `importKicad` in the test) returns `schematic.importPinInTwoNets` and
      no document;
    - **257 pins**: a `nodetto:DIP` with 257 listed pins returns
      `schematic.importTooManyPins` and no document. 256 pins succeed;
    - the page netlist equals the plan partition;
    - the output is byte-stable.
  - `export-golden.test.ts`: the example through core and io equals both
    golden files; `svg-export` of the example has the expected role counts
    in a light and a dark `SvgTheme`.
  - `interop.test.ts` (core, needs io):
    - the example's target is set on a matching breadboard page and gives
      zero parity findings, and removing one breadboard wire gives
      `parity-missing-connection`;
    - a **sparse IC** (pins 1, 3, 7, 9) and a 48-pin IC fail with
      `schematic.unprojectablePart`, return no target, and leave an
      existing card byte-identical;
    - a **dense** 8-pin IC gives DIP-8 with exactly pins 1..8, and a
      contiguous 5-pin IC gives a 5-pin header (no phantom pins);
    - a **duplicate reference** (a resistor and a switch both `R1`, on
      different nets) fails with `schematic.duplicateReference` and leaves
      an existing card byte-identical. An unannotated `R?` fails with
      `schematic.unannotatedReference`;
    - the equivalence of the direct mapping with the
      `importKicad(exportSchematicKicadNetlist(...))` round trip holds for
      every symbol type on projectable schematics.
  - Existing `breadboard/annotate.test.ts` and rotation tests pass
    unchanged after the extractions.
- **io**:
  - text formatter quoting and order; the KiCad writer on a
    `SchematicNetlist`; `breadboardTargetFromSchematic` per mapping-table
    row; the D2 skip warning; the Mermaid skip;
  - `kicad/netlist.test.ts`: N resistors with two nodes each give
    `stats.nodeVisits` of at most 2 x nodes + nets;
  - `kicad/schematic.test.ts`:
    - N disjoint wire segments on one row, each with a label, give
      `stats.segmentCandidates` of at most 3N;
    - **mixed-direction disjoint diagonals**: for i = 0..N-1 with N = 2000,
      a segment from (0, 10Ni) to (N, 10Ni + i + 1) (N distinct directions,
      disjoint y bands). `stats.diagonalWork`, which includes empty and
      rejected probes, is at most `S * (2L + 2) * (L + 1) + 2N` with
      `L = ceil(log2 P)`, about 0.7M. That is far below the N squared
      (4M) of per-point direction probing;
    - **overlapping parallel diagonals**: for i = 0..N-1 with N = 2000, a
      segment from (0, 10i) to (100N, 100N + 10i) in 1e-4 mm units. The
      segments are parallel and disjoint, and their boxes all overlap. With
      only 2N real contacts, the per-segment costs sum (box counts of about
      2N each, or lattices of g + 7 = 200007 each) far above P = 4000, so the
      direction switches to the line hash. `stats.diagonalWork`, including
      the counting queries, empty probes and rejected points, is at most
      `P + S * (2L + 2) * (L + 1) + S * (L + 1) + 2N` (about 0.73M).
      Plain box reporting would be about 4M;
    - **overlapping mixed-direction diagonals**: for i = 0..N-1 with
      N = 2000, a segment from (0, 10i) to (100N, 100N + 11i + 1) (N distinct
      directions, overlapping boxes, 2N real contacts). Each segment takes
      its lattice walk (small g), and `stats.diagonalWork` is at most
      `S * (2L + 2) * (L + 1) + sum_s (g_s + 7) + 2N`. The test computes the
      sum of g from the fixture and asserts the total stays below 1M, against
      about 4M for box reporting;
    - **large-coordinate midpoint** (outside exact mode): segment
      (1000000000, 1000000003) to (1100000006, 1100000005) with a point at
      (1050000003, 1050000004). The file fails the exact-arithmetic gate, so
      box reporting is used; the midpoint is reported, accepted by
      `onSegment`, and the contact matches the oracle;
    - **long-lattice mixed directions over budget**: N = 2000, G = N + 1,
      segments from (0, 10i) to (G * N, 10i + G * (N + i)), with the segment
      endpoints as contact points (exact mode; each direction has one
      segment, a box of N + 1 points and a lattice of at least G points).
      The test calls `importKicad(text, {fileName, stats, diagonalBudget:
      "schematic"})`, exactly as the CLI does. It returns
      `schematic.importTooComplex`, no plan and no document;
      `stats.diagonalBudgetLimit` equals `diagonalBudgetLimit(S, P)` for the
      fixture's counts, which shows the policy activated inside the
      importer after one parse; and `stats.diagonalWork` is at most
      `stats.diagonalBudgetLimit + 1` (about 1.45M, against about 4M
      unbudgeted);
    - **budget in box-only mode**: a large-coordinate variant of the same
      fixture (outside exact mode) with the same policy flag also stops with
      `schematic.importTooComplex` within `stats.diagonalBudgetLimit + 1`;
    - **legacy callers unchanged**: the same long-lattice file imported
      without the policy flag (the breadboard path) completes, reports no
      `diagonalBudgetLimit`, and equals the oracle;
    - `diagonalBudgetLimit` unit cases: a small and a large (S, P) pair
      compared with the formula;
    - these io importer tests belong to the io importer-bounds plan (the
      `kicad/schematic.ts` contact-candidate plan), gated by
      `bun test packages/io/src/kicad/schematic.test.ts`;
    - **every completed fixture stays within budget**: the disjoint
      mixed-direction, overlapping-parallel, short-lattice overlapping and
      large-coordinate midpoint fixtures complete under the schematic
      import budget, and their contacts equal the oracle's;
    - all diagonal cases, including the large-coordinate one, are in the
      oracle-equality matrix, so their contacts match the unchanged
      `onSegment` predicate;
    - N disjoint labelled resistor nets give `stats.labelVisits` of at most
      anchors + nets;
    - the brute-force oracle equality of section 8.3 (contacts, names, node
      order and diagnostics) holds on every fixture and generated input;
  - all existing KiCad test results are unchanged (baseline:
    `bun test packages/io/src/kicad/netlist.test.ts
    packages/io/src/kicad/schematic.test.ts
    packages/io/src/kicad/symbol-map.test.ts
    packages/core/src/breadboard/parity.test.ts
    packages/core/src/breadboard/ratsnest.test.ts`, 31 passed, from the
    Step 3 review).
- **collab**: Y.Doc round trip of the schematic fixture.
- **ui-solid**:
  - palette and workspace lists;
  - wire tool: orthogonal corner and pin snap;
  - deliberate T: finishing on one wire's body adds a junction and
    connects;
  - **endpoint snap preserves an unjoined T**: wire B ends at (0, 0) on wire
    A's interior without a junction, and finishing a new wire on B's end
    joins B only, so A stays a separate net with no junction created;
  - finishing on a plain crossing adds no junction;
  - **snap to an interior label** (the real label snap through the tool):
    with label A at (0, 0) on a wire from (-10, 0) to (10, 0), finishing a
    new wire on A commits the end plus a junction, so the original wire, A
    and the new wire are one net after commit;
  - **snap to a labelled crossing**: with label A at a plain crossing, the
    click is rejected and nothing is committed. The second crossing wire
    stays isolated and A stays on the first wire;
  - `r`/`Shift+R`/`x` only on schematic selections;
  - inspector edits;
  - problems panel rows and both buttons.
- **desktop**: `page-workspace` mapping; export dialog enablement.
- **cli**:
  - `lint` on schematic, mixed and PCB-plus-schematic documents (JSON `pin`
    and `pageId`);
  - `schematic netlist` in both formats with `--output`, `--check`,
    `--strict` and usage errors;
  - `schematic import` of `test-fixtures/kicad/led-button.kicad_sch` and
    `.net`;
  - **budget activation through the real command** (cli plan, in
    `apps/cli/src/schematic-commands.test.ts`): `schematic import` on the
    long-lattice fixture with `--output <tmp file>` exits 1, prints a
    `schematic.importTooComplex` line on stderr, writes nothing to stdout
    and leaves the output file absent. The same file through
    `breadboard import` still succeeds. The fixture is generated inside the
    test from the section 11 formula and written to a temporary directory
    that the test removes, so no file stays under `target/` or `tmp/`;
  - `schematic to-breadboard` success, and exit 1 with nothing written for
    a sparse IC;
  - `types --kind schematic`;
  - `edit add-page` plus `add` of each type, then `validate`;
  - **absolute move** (`apps/cli/src/edit/apply-batch.test.ts`, extended): a
    schematic junction at `x = -0.125` moved to the absolute target `0.875`
    stores `0.88` (`canonicalTarget`, not a relative shift). The existing
    move assertions for other element types pass unchanged.
- **native parity** `apps/cli/src/native-parity/schematic.test.ts`
  (`nativeTest`): `lint` text and JSON, `schematic netlist` both formats
  and `export --format svg` of the example match between the Bun CLI and
  the native binary. Run only after
  `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli` with
  `NODETTO_CLI_TEST_BINARY` set.

### 11.1 Test ownership

BPMN section 11.1 applies: each plan owns its tests, pinned lists have one
owner, a plan's gate holds only tests it makes pass.

| existing test / fixture | change | owner |
|---|---|---|
| `packages/ir/src/registry.test.ts` | +18 types | ir wave |
| `packages/io/src/jsonl/golden.test.ts`, new `__fixtures__/schematic.jsonl` | `GOLDEN` gains `schematic` | ir wave |
| `packages/collab/src/test-fixtures.ts` | gains a fixture | io wave |
| `apps/cli/src/breadboard-commands.test.ts` no-page message | unchanged (message not edited, section 9) | none |
| `apps/cli/src/native-parity/documents.test.ts` | picks up the fixture automatically | none |
| `apps/cli/src/mcp*.test.ts` | derived from `COMMAND_HELP` | none |
| breadboard `annotate`/rotation tests | unchanged, must pass after extraction | core wave |
| `packages/io/src/kicad/{netlist,schematic,symbol-map}.test.ts`, breadboard `parity`/`ratsnest` tests | unchanged results; new work-count and oracle cases added | io importer-bounds plans |
| `packages/io/src/jsonl/canonical.test.ts` (21 tests) | unchanged after `roundCoordinate` moves to ir | ir coordinate plan |
| new `packages/core/src/editor/schematic-move.test.ts` | nudge tie (`-1.01`) and absolute target (`0.88`) | wave 2 core move plan |
| new `packages/core/src/schematic/connectivity-roundtrip.test.ts` | connectivity and save/reload after moves | wave 3 core analysis |
| `apps/cli/src/edit/apply-batch.test.ts` | extended with the schematic absolute move | cli move plan |

## 12. Implementation slicing

Waves; plans inside a wave run in parallel only when their files are
disjoint. Shared registry files are chained with `dependsOn`: ir
`types.ts`/`semantics.ts`/`registry.ts`/`index.ts`; core `index.ts`,
`tools.ts`, `shape-catalogue.ts`, `svg-export/*`, `editor/facade/*`,
`editor/paste.ts`; io `index.ts`; ui-solid `Inspector.tsx`,
`ShapeView.tsx`, `workspaces.ts`, `shape-palette.ts`,
`interaction/circuit.ts`, `ExportDialog.tsx`; desktop `App.tsx`,
`shell/export-handlers.ts`; cli `commands.ts`, `help.ts`.

1. **ir**: semantics and registry files (including `wireDiagonal`), page
   kind and mode, netlist model, golden fixture and pinned lists. In
   parallel (disjoint files): `packages/ir/src/segment-sweep.ts` with its
   test and its export from `packages/ir/src/index.ts` (chained after the
   registry plan for `index.ts`). **ir coordinate plan** (chained after
   the sweep plan for `index.ts`): move `roundCoordinate` into
   `packages/ir/src/keyOrder.ts`, add `coordinateKey`, and make
   `packages/io/src/jsonl/canonical.ts` import and re-export it. Gate:
   `bun test packages/io/src/jsonl/canonical.test.ts` plus the new ir key
   test. **ir range plan** (chained after the registry plan): the
   `schematic.coordinateRange` check in the schematic `validateSemantic`
   and in `packages/ir/src/validate.ts`, with its ir test.
2. **core model**: `union-find.ts`; `schematic/symbols.ts`;
   `schematic/coordinates.ts` (`shiftedTarget`, `canonicalTarget`); shape
   utils (`schematicPinAt`, `schematicWireInteriorAt`); `snap.ts`;
   extraction in `breadboard/rotate.ts` (`pivot` option) and
   `breadboard/annotate.ts`; Editor intents (create, rotate, mirror,
   update, annotate, paste hook). The move contract (section 3.3) is split
   into three chained plans, one per caller file group:
   - core (wave 2): the `canonicalTarget` guard in `Editor.moveElements`
     (`editor/facade/element-editing.ts`) and nudge destinations built with
     `shiftedTarget` (`editor/facade/selection-editing.ts`). Its gate is its
     own new test `packages/core/src/editor/schematic-move.test.ts`, run with
     `bun test packages/core/src/editor/schematic-move.test.ts`. The test
     builds an Editor with a schematic page (ir types from wave 1 only)
     holding a wire at origin `-1` and a junction at `-0.999`, selects both,
     calls the real `editor.nudgeSelection` with a `-0.005` x delta and
     asserts both stored origins are `-1.01`. A direct `moveElements` call
     with an absolute target of `0.875` asserts `0.88`. It needs no
     connectivity code. `connectivity-roundtrip.test.ts` stays in wave 3
     (connectivity and save/reload);
   - ui-solid wave: drag destinations built with `shiftedTarget`
     (`packages/ui-solid/src/interaction/transform.ts`), with an
     interaction test of the tie case;
   - cli wave: absolute targets stored as `canonicalTarget` in
     `apps/cli/src/edit/operations/elements.ts`, gated by
     `bun test apps/cli/src/edit/apply-batch.test.ts`.
3. **core analysis** (needs 1 and 2): `connectivity.ts` (joinable points,
   per-key label groups, per-field coordinate keys, sweep), `net-names.ts`,
   `toSchematicNetlist`, `erc.ts`, `connectivity-roundtrip.test.ts`. **core notation** (needs 2, parallel):
   `notation.ts` and the svg-export branch.
4. **io** (needs 1; parallel with 2-3): text formatter, KiCad writer
   widening, D2 skip, collab fixture; then `breadboard-target.ts` (direct
   `mapKicadSymbol`, preflight for unique and annotated references and
   dense pins). **io importer bounds** (needs the `segment-sweep.ts`
   plan), in three chained plans:
   - `kicad/netlist.ts` node indexing, with `kicad/index.ts` `stats`
     option passing;
   - `kicad/schematic.ts` contact candidates (axis sweep, diagonal range
     tree, degenerate lookup) with the oracle test and the
     `diagonalWork` test;
   - `kicad/schematic.ts` label map by root, with the `labelVisits` test.
5. **interop core** (needs 3, 4): `pcb-parity.ts`, `import-layout.ts`,
   `Editor.setBreadboardTarget`, `interop.test.ts`.
6. **ui-solid** (needs 3): view, tools and palette, workspace, wire tool,
   keys, inspector, problems panel, export dialog format.
7. **cli** (needs 3, 4, 5): `lint`, `types`, help, `schematic` group.
8. **desktop** (needs 6): page following, panel mounts, export handlers.
9. **docs, example, golden and native parity** (needs all): example and
   goldens, `export-golden.test.ts`, `docs/schematic.md`, README, native
   parity test.

Per-plan gate: `bun test <the plan's test files>` only; `cargo test` with a
plan-local `CARGO_TARGET_DIR` under `target/` if a crate is touched (none is
planned). Final gate (integration step, foreground, exit status and log
path recorded): `bun run typecheck`, `bun run lint`, `mise run verify`,
`mise run test-cli`, then `CARGO_TERM_QUIET=true cargo build --release -p
nodetto-cli` and the native parity tests with `NODETTO_CLI_TEST_BINARY`
set.

## 13. Decisions and intentional divergences

1. One type per symbol (breadboard precedent) rather than one generic
   symbol type: per-type registry defaults keep `types`, `edit add` and
   validation simple. Polarity variants are fields (`polarized`,
   `polarity`, `channel`, `style`).
2. Mirror reuses `Visual.flipX`, whose documented meaning is exactly this.
3. Pitch 10 equals breadboard so `snapBreadboardPoint` is reused.
4. Rotation and mirror keep the anchor pin exactly fixed, on or off the
   lattice (breadboard precedent without its pivot rounding; KiCad rotates
   about the cursor). Breadboard keeps its rounding through the `pivot`
   option, so its results do not change.
5. Only pins, power pins, wire ends, junctions and label anchors join by
   coincidence; bends never do. A junction joins every wire through it.
   The labels at one key form a group. When the group shares the key with
   no non-label joinable point, it attaches once to exactly one wire (first
   in element order). A wire end on another wire's interior or bend needs a
   junction (intake default). The wire tool finishes on joinable targets
   and adds a junction only for a deliberate T: no joinable target was
   resolved and exactly one wire body is under the point. An endpoint snap
   therefore never shorts a wire the user did not target. A snap to an
   interior-attached label targets that label's wire: the tool adds a
   junction when that wire is the only one at the point, and rejects the
   click on a labelled crossing. The label therefore never drops its wire,
   and the other crossing wire is never joined. This prevents a polyline
   edit, a label or a snap from shorting crossing wires.
6. One label namespace per page; labels join power nets of the same name.
   KiCad separates local and global scopes.
7. ERC severities: unconnected and single-pin nets are warnings (breadboard
   precedent, drafts must lint), duplicates and power shorts are errors.
8. No rubber-banding and no net-highlight overlay in this delivery
   (not required by the intake; ERC and the inspector net names cover
   feedback).
9. The breadboard target is fed through the existing card. It is built by
   calling the shared `mapKicadSymbol` per component, which is linear and
   avoids re-parsing text. An equivalence test pins it to the real KiCad
   netlist round trip, so `format: kicad_net` stays truthful and no
   breadboard type, enum or rule changes. A schematic that has no valid
   breadboard projection (duplicate or unannotated references, a sparse or
   over-40-pin IC) fails explicitly and leaves any existing card untouched,
   instead of producing phantom pins or an ambiguous target.
10. PCB parity is live against the first schematic page, because PCB pages
    have no card and adding a type to `pcb.*` is not additive-only. PCB
    pages are linted only when a schematic page exists, so PCB-only
    documents are unchanged. A missing pad is a missing connection. A
    missing part is reported on the schematic part with its `pageId`, so an
    empty board still reports and every row can be focused.
11. KiCad import onto a schematic page connects through net labels on pin
    stubs, not KiCad wire geometry, because nodetto symbols have their own
    pin geometry. Pins come from the actual source pin numbers (a sparse IC
    keeps 1, 3, 7, 9). Two-terminal switches keep their two source
    terminals. Named singleton nets keep a label. Names are deduplicated in
    the connectivity namespace (trimmed). Parts or names that cannot be
    represented become IC boxes with exactly their pins or renamed nets,
    each with a warning, and are never merged. Inputs that cannot be laid
    out without merging or exceeding limits (a pin in two nets, more than
    256 pins) fail the import with an error and write nothing. KiCad files
    still open as breadboard imports on the desktop; the schematic import
    is the CLI `schematic import`.
12. Inductors, voltage sources and MOSFETs have no breadboard part; they map
    to the existing fallbacks with importer warnings.
13. The netlist text format is nodetto's own, versioned by its first line.
14. The breadboard connectivity engine is not reused for computation: it is
    hole and strip based. Its ordering, naming and finding conventions are
    reused; union-find moves into a shared helper used by the schematic
    engine only, so breadboard behaviour is untouched.
15. Wires must be orthogonal at validation (`schematic.wireDiagonal`). The
    editor and import never create diagonals. The constraint lets one
    row/column sweep bound all path lookups with no diagonal fallback.
16. The sweep lives in `packages/ir/src/segment-sweep.ts` because both
    core (schematic connectivity) and io (KiCad importer) need it and io
    cannot import core. It is one implementation, not a duplicate.
17. Generated net names are checked against every reserved and assigned
    name, with explicit names first, so no two nets share a name.
18. Electrical identity is the sum of per-field `coordinateKey` values,
    using the writer's own `roundCoordinate`, moved unchanged to
    `packages/ir/src/keyOrder.ts`. Authoring paths write canonical values.
    Because `Editor.moveElements` takes absolute destinations, the contract
    is set at the callers. Drag and nudge build destinations from one shared
    canonical delta with `shiftedTarget`, so a moved group keeps its
    coincidences. CLI absolute targets are stored as `canonicalTarget`,
    which keeps absolute semantics. `Editor.moveElements` applies
    `canonicalTarget` as an idempotent guard.
    Schematic coordinates are limited to `+-1e9` (`schematic.coordinateRange`),
    so keys are exact integers and never alias. Live and reloaded
    connectivity are therefore identical, including at negative ties,
    without changing JSONL output for any mode.
19. The existing KiCad importers are made linear without changing results:
    - node rows are indexed by reference;
    - axis segment candidates come from the sweep;
    - diagonal candidates come, per direction, from box reporting on a
      merge-sort range tree or from a line hash, whichever the counting
      queries show is cheaper. The structures are built only when diagonals
      exist, and all lookup work is counted before confirmation;
    - label texts are grouped by final root;
    - every candidate is confirmed by the unchanged `onSegment`;
    - a brute-force oracle test pins equality.
    The new native paths therefore do not inherit all-pairs scans.
20. Wire drawing and wire point editing use one electrical target
    classification (exported by plan 39's `interaction/schematic-wire.ts`
    with an optional excluded wire id), so a click, a drag drop and a
    keyboard move join or reject the same way. The edited wire is excluded
    inside core `schematicPinAt` and `schematicContactsAt` (an optional
    parameter, so existing callers are unchanged), because only exclusion
    before ranking stops the wire's own end from masking a nearby target.
    Ranking uses raw positions, but contacts are counted at the stored-field
    key and points are written key-preserving, because connectivity and
    reload use those keys. A raw-position count can miss a crossing wire
    whose origin rounds onto the key, and a junction added there would merge
    two nets (revision 12). `schematicWireInteriorAt` is unchanged and is not
    used for classification. A double-click finishes only if its triggering
    pointer-down was accepted, and a rejected point-edit sample takes
    precedence over a degenerate reroute. Otherwise a rejected gesture could
    commit an earlier position. Derived stored fields are range-checked
    before mutation, and a new wire's origin is clamped. The schema limit of
    section 3.2 stays, and an edited document must always save and reload,
    so an unrepresentable write is declined rather than applied.
    A point is classified once and committed from that result, never
    snapped twice. Junctions are created only
    when a draft finishes or a point edit is released, never from hover
    samples. Point edits keep untouched endpoints fixed and add local
    orthogonal elbows rather than moving neighbours, because moving a
    neighbour can unplug a pin or leave a diagonal segment that the IR
    rejects. Handles are keyboard operable because the workflow requires all
    new UI to be keyboard reachable. The breadboard handles, which are
    pointer-only, keep their current behaviour (additive only).

## 14. Risks

- **Shared-file regressions** (rotate and annotate extraction, KiCad writer
  type widening, lint page selection, paste hook): guarded by unchanged
  existing tests and by page-kind and type guards.
- **noUncheckedIndexedAccess**: IC pin tables, segment maps and union-find
  arrays are indexed reads; every read handles `undefined`.
- **Native interpreter cost**: connectivity, ERC, parity, the breadboard
  projection and the KiCad importers are linear with maps plus sorting and
  the row/column sweep. The work-count tests (sweep, connectivity,
  `nodeVisits`, `segmentCandidates`) pin both the ordinary and the crowded
  same-row case without wall-clock time. No regex or per-character loop in
  hot paths.
- **Importer rewrite regressions**: the linear rewrites of
  `kicad/netlist.ts` and `kicad/schematic.ts` must keep every existing
  result. The existing KiCad and breadboard tests stay unchanged,
  candidates are confirmed by the unchanged `onSegment`, and the
  brute-force oracle test compares whole plans.
- **Diagonal KiCad wires**: in exact mode the cost is
  `sum_s O(log^2 P) + sum_d min(sum_s min(B_s, g_s + 7), P + S_d log P +
  reported_d)`. Disjoint mixed directions, overlapping mixed directions
  with short lattices, and overlapping parallel wires are near-linear and
  pinned by work-count tests. On the new schematic import path every
  branch, including box-only mode outside the exact-arithmetic gate, runs
  under the opt-in `diagonalBudget: "schematic"` policy. The importer
  computes `diagonalBudgetLimit(S, P)` after its single parse, so total
  diagonal work is at most that limit + 1. Inputs that need more (many long-lattice
  directions with wide boxes) fail with `schematic.importTooComplex`
  before any schematic is written. A user then sees an import refusal for
  such adversarial diagonal-heavy files instead of a slow import. The
  existing breadboard import callers pass no budget and keep their current
  behaviour and cost. Files without diagonals never touch this path.
- **`roundCoordinate` move**: the helper moves from io to ir. The 21
  `canonical.test.ts` tests and byte-identical JSONL output guard it.
- **Crossing semantics**: pinned by the connectivity matrix (shared bend,
  label on a crossing, junction, endpoint join) and by the wire tool's
  finish-on-target and automatic junction. Documented in
  `docs/schematic.md`. Users who expect KiCad's T auto-connect see the
  dangling-wire-end hint.
- **KiCad mapping** depends on `symbol-map.ts` rows; `interop.test.ts` and
  the equivalence test pin the direct mapping to the round trip.
- **Older builds** cannot open documents with schematic pages (accepted,
  same as breadboard).
