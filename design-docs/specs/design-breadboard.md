# Breadboard Circuit Pages

Status: design baseline for branch `feat/breadboard-mode`, revision 2.
Issue: "Circuit breadboard drawing mode (KiCad/Fritzing-inspired)"
(workflow-input only; intake comm-008852, resumed by intake comm-008865; no
GitHub issue number).

Revision 2 keeps every revision-1 decision and adds the scope of the
resumed run: KiCad schematic and netlist import (section 8.6), the target
netlist element (section 3.2), the ratsnest (section 5.3), schematic parity
rules (section 6.1) and cross-probing (section 7.5).

This design follows the BPMN page-kind precedent
(`design-docs/specs/design-bpmn.md`, `impl-plans/completed/bpmn-*.md`). It
reuses that document's conventions for the page kind, registry entries,
notation primitives, the problems panel, the CLI `lint` command, the test
ownership contract (BPMN section 11.1) and the wave gate. Where this
document is silent, the BPMN rules apply unchanged.

Open user decisions, each with a default, are in
`design-docs/user-qa/breadboard-mode.md`.

## 1. Context and baseline

No breadboard or circuit design existed before this document. Observed
repository facts that shape the design (base `907897f`):

- `PAGE_KINDS` (`packages/ir/src/types.ts:25-34`) is
  `freeform|erd|uml|sequence|state|flowchart|architecture|bpmn`. No test
  enumerates it. The inspector page-kind select is built from it
  (`packages/ui-solid/src/inspector/SimpleSections.tsx:142`).
- `SCHEMA_VERSION = 1` with no migrations. Additive page kinds and types
  have never bumped it (BPMN section 3.5).
- Element types are registered in `packages/ir/src/registry.ts`
  (`bpmnDefinition` helper at 1955) and typed in
  `packages/ir/src/semantics.ts` (`SemanticByType` at 845).
- Connectors (`category: "edge"`) reference element ids. Ports are only the
  four box sides (`CONNECTOR_PORTS`, `semantics.ts:184`). There are no
  per-element point anchors. Free endpoints exist only on `edge.generic`.
- `Visual.rotation` is clockwise degrees about the element centre
  (`types.ts:308-314`). SVG export wraps any non-edge element with a
  `rotate()` transform about its box centre (`svg-export.ts:1765-1770`).
  The canvas does the same.
- Generic rotation is opt-in by type (`canRotateElement`,
  `packages/core/src/rotation.ts:28`). There is no rotate keyboard command.
  The letter `r` selects the rectangle tool (`TOOL_KEYS`,
  `packages/ui-solid/src/interaction.ts:191`).
- Generic snapping is box-based (`packages/core/src/snap.ts`,
  `snapTranslate`). The UI grid is `SNAP_GRID = 24`
  (`interaction.ts:173`). Snapping can be toggled
  (`ZoomControls.tsx:229`).
- `ShapeUtil.canResize` exists (`packages/core/src/shape-util.ts:55`).
- `@nodetto/io` depends only on `@nodetto/ir`. `@nodetto/core` depends on
  `@nodetto/ir` and only dev-depends on `@nodetto/io`. The io package
  therefore cannot import core, and core can import io only in tests.
- BPMN UI wiring: workspace `bpmn` (`packages/ui-solid/src/workspaces.ts:87`)
  and `BPMN_TOOLS` (`tools.ts:154`). The desktop forces the workspace to
  follow the page kind (`apps/desktop/src/App.tsx:365-375`,
  `changeWorkspace` at 153-171). The problems panel is mounted at
  `App.tsx:1480`. The inspector matches `bpmn.*` at `Inspector.tsx:288`, and
  the canvas matches BPMN shapes at `ShapeView.tsx:173`.
- Desktop export goes through one `ExportDialog`
  (`packages/ui-solid/src/ExportDialog.tsx`). Its format list is at 79-107,
  and BPMN is enabled only on `bpmn` pages. `App.tsx` `exportBpmn` (619-652)
  writes text through `ExportBackend.pickExportPath` and `writeText`.
  `pick_export_path` accepts any plain extension, so new export extensions
  need no Rust change.
- `impl-plans/active/export-07-ui-export-menu.md` and
  `export-09-desktop-export-flow.md` are stale. `impl-plans/README.md:10`
  says no plans are active, and the single `ExportDialog` replaced the menu
  they describe. This design does not edit or depend on them.
- CLI `lint` (`apps/cli/src/commands.ts:210-359`) lints only `bpmn` pages.
  It reads `.bpmnlintrc`/`--config` before linting and fails with "The
  document contains no BPMN pages." when there are none. No test pins that
  message. The MCP tool list and MCP tests are derived from `COMMAND_HELP`
  keys (`apps/cli/src/help.ts:44`), so a new help key needs no test edit.
- Mermaid export filters by known types, so unknown types are skipped
  silently (`packages/io/src/mermaid/export.ts:464-468`). D2 export turns
  every unknown non-edge element into a generic labelled node
  (`packages/io/src/d2/export.ts:558-570`).
- `crates/native` and `apps/cli/native` do not enumerate page kinds or
  element types. `apps/cli/src/native-parity.test.ts` loops over every
  `packages/io/src/__fixtures__/*.jsonl` and is skipped unless
  `NODETTO_CLI_TEST_BINARY` is set. A new fixture is covered automatically.
- `examples/` holds `design/`, `flowchart/` and `state-transition/`.
  `test-fixtures/` holds only `attachment-paths.json`.
- `mise run verify` = `check && lint && test` (`mise.toml:105-107`). These
  include typecheck, biome, `bun test`, cargo check, fmt-check, clippy and
  `cargo test --workspace`.
- Import precedent (draw.io, commit `907897f`):
  - `@nodetto/io` exposes importers as subpath exports
    (`packages/io/package.json`: `./bpmn`, `./drawio`).
  - The desktop opens interchange files as detached imports with notes:
    `isDrawioPath` and the `importDocument(...)` call in
    `apps/desktop/src/file/session.ts` (around 417-440). Autosave never
    rewrites the source file.
  - The open dialog filter is `OPEN_FILTER_EXTENSIONS` in
    `apps/desktop/src-tauri/src/dialogs.rs:16`, pinned by Rust unit tests
    (`open_filter_includes_drawio`). A new open extension is a Rust change.
  - The CLI has `drawio import <file> [--output] [--strict]`
    (`drawioCommand` in `apps/cli/src/commands.ts`). Warnings go to stderr
    and `--strict` with warnings exits 3 (`EXIT_WARNINGS`).
- `Page` (`types.ts:332-343`) has no typed field for diagram-specific data,
  only the untyped `extensions` pass-through. Elements are typed,
  validated, undoable and synced by collab generically.
- A move gesture writes to the store on every pointer move
  (`editor.moveElements` in the `translating` case,
  `packages/ui-solid/src/interaction.ts:1713`). Anything derived from the
  store revision therefore updates live during a drag.

Licensing boundary: every part definition, pin table, board layout,
artwork, rule id, rule message, fixture and value in this design is
original. Nothing is taken from KiCad, Fritzing or any GPL or CC-BY-SA
library. The resistor colour code (IEC 60062) and the common board sizes
(830, 400 and 170 tie points) are public engineering facts. The KiCad
netlist writer follows the published S-expression structure and is
implemented from scratch (section 8.3).

The KiCad reader and importers (section 8.6) are written from scratch
against the file structure only. They use only the format tokens needed
to read the files (`kicad_sch`, `lib_symbols`, `symbol`, `pin`, `wire`,
`export`, `comp`, `net`, `node` and the like) and the symbol-name prefixes
the issue lists (`R`, `C_Polarized`, `LED`, `SW_Push`, `Conn_01xNN`, ...).
`.reference/kicad` is read for behaviour only. No code, comments, keyword
tables, library symbols, demos or QA files are copied, translated or
committed. KiCad fixtures are small, hand-written files (section 11).

## 2. Goals and non-goals

Goals: everything in the intake acceptance signals.
- The `breadboard` page kind and typed `breadboard.*` elements.
- Hole-grid snapping and 90-degree part rotation.
- A connectivity engine with net highlighting.
- Reference annotation and duplicate fixing.
- Eight ERC rules plus five schematic parity rules in core, the desktop
  problems panel and `nodetto-cli lint`.
- Original artwork in the canvas and in SVG export, including resistor bands.
- Palette, inspector and problems panel.
- BOM CSV, KiCad-style netlist and SPICE netlist from the CLI and the
  desktop export dialog.
- JSONL round trip, graceful skipping in Mermaid and D2, an example, docs
  and tests.
- Import of KiCad 6+ schematics (`.kicad_sch`) and KiCad S-expression
  netlists (`.net`) into a new breadboard page with staged parts and a
  stored target netlist, from the CLI and the desktop open flow.
- A live ratsnest for unrouted target connections.
- Cross-probing from the problems panel and inspector to the canvas.

Non-goals:
- Schematic or PCB views, and import of Fritzing files.
- KiCad: legacy (KiCad 5 and older) `.sch` files, hierarchical sheets,
  buses, `.kicad_pcb`, writing `.kicad_sch`, and back-annotation to KiCad.
- Updating an existing page from a schematic (re-import merge). An import
  always creates a new document. Editing the stored target netlist in the
  editor.
- Operating-system file associations for `.kicad_sch` or `.net`. The files
  open through the open dialog only.
- Simulation. The SPICE file is an export only.
- User-defined parts or a part library editor. Pin tables are a fixed,
  built-in catalogue (section 3.4).
- Split power rails, and board rotation (section 4.4, user-QA Q2).
- An ERC config file, or per-rule severity overrides.
- PNG/PDF-specific changes. They reuse the SVG renderer unchanged.
- Native (Rust) awareness of breadboard types. None is needed (section 1).

## 3. Data model (packages/ir)

### 3.1 Page kind and units

- Append `"breadboard"` to `PAGE_KINDS`. As with BPMN, the kind selects the
  palette and never restricts which element types a page may hold.
- One grid pitch (0.1 in = 2.54 mm) is `BREADBOARD_PITCH = 10` page units.
  All hole, pin and wire-end positions sit on the page lattice
  `(i * 10, j * 10)` for integer `i` and `j`, measured from the page origin.
  The lattice is breadboard-specific and independent of the UI
  `SNAP_GRID = 24`.

### 3.2 Element types

All thirteen types use the `breadboard.` namespace and `category: "node"`.
No type is an `edge`, so the connector code (routing, ports, backdrops,
`connectSmart`) never sees them. No type references another element id, so
`references` returns `[]` and `onReferenceDeleted` is irrelevant. It is
declared `"detach"`.

Part types share three fields:
- `reference: string`: non-empty, for example `R1`. A trailing `?` (`R?`)
  marks it as unannotated.
- `value: string`: may be empty, for example `220`, `4.7k`, `10u` or `5V`.
- the type-specific parameters below

| type | ref prefix | semantic payload (beyond `reference`, `value`) | defaults |
|---|---|---|---|
| `breadboard.board` | none | `size: full\|half\|mini` (no reference or value) | `half` |
| `breadboard.wire` | none | `color: red\|black\|blue\|green\|yellow\|orange\|white\|gray`, `points: {x, y}[]` (at least 2) (no reference or value) | `red` |
| `breadboard.resistor` | `R` | `span: 2..10` (integer, pitches between leads), `bands: 4\|5`, `tolerance?: 0.05\|0.1\|0.25\|0.5\|1\|2\|5\|10\|20` (percent) | span 4, bands 4, value `220`; tolerance absent means 5 (4-band) or 1 (5-band) |
| `breadboard.led` | `D` | `color: red\|green\|yellow\|blue\|white\|orange` | red, value `red` |
| `breadboard.capacitor` | `C` | `style: ceramic\|electrolytic`, `span: 1..5` (integer) | ceramic, span 1, value `100n` |
| `breadboard.diode` | `D` | `span: 2..10` (integer) | span 4, value `1N4148` |
| `breadboard.transistor` | `Q` | `polarity: npn\|pnp`, `pinout: EBC\|ECB\|BEC\|BCE\|CEB\|CBE` | npn, EBC, value `NPN` |
| `breadboard.button` | `SW` | none (4-pin tactile push button) | value `PUSH` |
| `breadboard.potentiometer` | `RV` | none (3 pins, pin 2 is the wiper) | value `10k` |
| `breadboard.ic` | `U` | `pinCount: 4..40` (even integer, DIP 0.3 in row spacing) | 8, value `IC` |
| `breadboard.header` | `J` | `pinCount: 1..40` (integer, single row) | 4, value `HEADER` |
| `breadboard.battery` | `BT` | none (2 pins: 1 is `+`, 2 is `-`) | value `5V` |
| `breadboard.netlist` | none | the target netlist: `source: string`, `format: kicad_sch\|kicad_net`, `parts: {reference, value, type}[]`, `nets: {name, nodes: {reference, pin}[]}[]` (no reference or value) | created only by import |

The target netlist (`breadboard.netlist`) holds the connections a
schematic asks for (section 8.6). It is an element, not a page field,
because `Page` has no typed extension point (section 1). As an element it
is typed, validated, undoable, synced by collab and round-tripped by JSONL
with no new mechanism, and `SCHEMA_VERSION` stays 1.
- `parts[].type` is a breadboard part type. `nodes[].pin` is a pin number
  in nodetto's numbering for that type (section 3.4), already mapped by
  the importer. Parts are in natural reference order. Nets are in section
  5.1 order and their nodes are sorted the same way.
- It is drawn as a small card (section 7.1) so it can be seen, selected and
  deleted. Deleting it turns the ratsnest and parity rules off.
- When a page holds several, only the first in element order is the
  page's target. The others are inert, and the inspector says so.
- Connectivity, ERC rules 1-8, annotation, BOM and netlist export ignore
  it.

Validation (`validateSemantic`) is structural only:
- required strings, enums, integer ranges and finite numbers
- `breadboard.ic` with an odd `pinCount` is an error,
  `breadboard.pinCountOdd`
- a wire with fewer than 2 points is an error, `breadboard.wirePoints`
- netlist: non-empty `reference` strings, positive integer `pin`, and
  `type` in `BREADBOARD_PART_TYPES`

Electrical correctness is never a document error. It is reported by ERC
(section 6), so imperfect documents still load.

Key order:
- parts: `reference`, `value`, then the parameters in table order
- board: `size`
- wire: `color`, `points` (children `{keys: ["x", "y"]}`)
- netlist: `source`, `format`, `parts` (children `reference`, `value`,
  `type`), `nets` (children `name`, `nodes`; grandchildren `reference`,
  `pin`)

`packages/ir/src/semantics.ts` exports:
- `BREADBOARD_ELEMENT_TYPES` and `isBreadboardElementType` (the BPMN
  pattern)
- `BREADBOARD_PART_TYPES` (every type except board, wire and netlist)
- `BREADBOARD_REFERENCE_PREFIX`
- the enum constant arrays

### 3.3 Geometry storage

- **Parts and boards**
  - `visual.x`/`visual.y` is the top-left corner of the unrotated box.
  - `visual.width`/`visual.height` are written at creation and on any
    parameter change. They equal the catalogue box, but readers always use
    the catalogue box (section 3.4), so a stale stored size is harmless.
  - The netlist card is stored like a board: top-left corner and a fixed
    16 x 4 pitch box.
  - `visual.rotation` holds parts only, as `0|90|180|270` (section 4.2).
    Boards, wires and netlist cards are never rotated by the editor. A rotation that
    arrives through import or raw apply is still rendered and is honoured
    by the geometry functions. Off-lattice results are reported by ERC.
- **Wires**
  - `points` are offsets in page units from `(visual.x ?? 0, visual.y ?? 0)`.
    The page position of point `i` is `visual + points[i]`.
  - Generic moves change only `visual.x`/`visual.y`. Endpoint and bend
    edits change `points`.
  - The first and last points are the electrical ends. Interior points are
    bend points and have no electrical meaning.
  - The box is derived from the points, so `visual.width`/`height` are
    omitted.

### 3.4 Part catalogue (`packages/core/src/breadboard/catalogue.ts`)

The catalogue is pure data plus functions. It is the single source for pin
tables, boxes, BOM descriptions and footprint names, and the canvas, SVG
export, connectivity and the netlist all use it.

Pin offsets are in pitches, relative to pin 1 at `(0, 0)` with rotation 0.
x grows to the right and y grows down.

| type | pins (number name: offset) | internal bonds | body extent beyond the pin box (pitches) |
|---|---|---|---|
| resistor | 1 `1`: (0,0); 2 `2`: (span,0) | none | none |
| led | 1 `A`: (0,0); 2 `K`: (1,0) | none | y -1..1 (5 mm dome) |
| capacitor | 1 `1` (`+` if electrolytic): (0,0); 2 `2` (`-` if electrolytic): (span,0) | none | electrolytic: a circle of radius 1 around the pin midpoint |
| diode | 1 `A`: (0,0); 2 `K`: (span,0) | none | none |
| transistor | 1, 2, 3: (0,0), (1,0), (2,0), named by the `pinout` letters in order | none | y -1..0.5 (TO-92 flat face toward -y) |
| button | 1 `1`: (0,0); 2 `2`: (0,3); 3 `3`: (2,0); 4 `4`: (2,3) | {1,2}, {3,4} | none |
| potentiometer | 1 `1`: (0,0); 2 `W`: (1,0); 3 `3`: (2,0) | none | y -2..0.5 |
| ic | pins 1..n/2: (k-1, 0); pin n/2+j: (n/2-j, -3) for j = 1..n/2 | none | none (body between the rows) |
| header | pin k: (k-1, 0) | none | none |
| battery | 1 `+`: (0,0); 2 `-`: (0,-1) | none | x -3..0 (cell body to the left) |

- The box is the pin bounding box grown by 0.5 pitch on every side, unioned
  with the body extent.
- For the button, pins 1 and 2 sit in the same column across the centre
  channel (rows e and f), so the bond joins the top and bottom strip of
  that column.
- The netlist and SPICE treat the button as open. Pressing it is not
  modelled.

BOM part descriptions are built from the type and its identity parameters,
for example "Resistor 5%", "LED red", "Capacitor electrolytic",
"Transistor NPN EBC", "DIP-8 IC" or "Pin header 1x4". Footprint names are
`nodetto:<Kind>` (for example `nodetto:Resistor_P4`, `nodetto:DIP-8`).
These names are our own.

Each type also has a fixed catalogue part name, written as the netlist
`libsource` part (section 8.3) and read back by the importer (section
8.6.4): `Resistor`, `LED`, `Capacitor`, `CapacitorPolarized`, `Diode`,
`TransistorNPN`, `TransistorPNP`, `PushButton`, `Potentiometer`, `DIP`,
`Header`, `Battery`.

### 3.5 Shared value parsing (`packages/ir/src/breadboard.ts`)

`parseComponentValue(text): number | undefined` lives in ir. Core (resistor
bands, ERC) and io (SPICE) both use it, and io cannot import core.

Accepted forms (ASCII; `u` and the micro sign are equal):
- an optional decimal number with an optional SI prefix:
  `p n u m k K M G`. `M` is mega, and `m` is milli.
- RKM codes: `4k7`, `2R2`, `1R`, `0R`
- an optional trailing unit: `R`, `ohm`, `F`, `V`, `H`
- surrounding whitespace

Anything else returns `undefined`.

`packages/ir/src/breadboard.ts` also declares the netlist model consumed by
io (section 8):

```text
BreadboardNetlist {
  pageId, pageName, documentTitle
  components: { elementId, type, reference, value, description, footprint,
                pins: { number, name }[] }[]      // natural reference order
  nets: { code, name, nodes: { reference, pin, pinName }[] }[]
}
```

It also declares the import plan, which is the boundary between the io
importers and the core layout (section 8.6.5):

```text
BreadboardImportDiagnostic {
  severity: "error" | "warning", code, message,
  line?, column?, reference?          // 1-based source position
}
BreadboardImportPlan {
  title, format: "kicad_sch" | "kicad_net", source   // source = file base name
  parts: { reference, value, type, parameters }[]    // natural reference order;
                                                     // parameters = the type's
                                                     // semantic fields beyond
                                                     // reference/value
  target: BreadboardNetlistSemantic                  // the breadboard.netlist payload
}
BreadboardImportResult {
  plan?: BreadboardImportPlan         // absent only when an error diagnostic exists
  diagnostics: BreadboardImportDiagnostic[]
}
```

### 3.6 Schema version and pinned lists

The change is additive: one page-kind value and thirteen element types.
`SCHEMA_VERSION` stays 1 and no migration is registered. Builds older than
this one reject a `breadboard` page with `value.enum` (user-QA Q6, which
mirrors BPMN Q3).

Required evidence, owned by the ir slice (section 12):
- `packages/ir/src/registry.test.ts` "registers the design table plus
  assets and token resources" gains the 13 `breadboard.*` types.
- `packages/io/src/jsonl/golden.test.ts` `GOLDEN` gains `"breadboard"`, and
  `packages/io/src/__fixtures__/breadboard.jsonl` holds one `breadboard`
  page with at least one element of each of the 13 types. It is written in
  `keyOrder.ts` order with canonical rounding and reserializes byte for
  byte.
- All pre-existing golden fixtures and their validation results are
  unchanged.

## 4. Board geometry, snapping and rotation (packages/core/src/breadboard)

### 4.1 Board layout (`board.ts`)

`boardLayout(size)` returns the holes, strips and label positions in board
coordinates (pitches from the box top-left). `boardHoles(element)` maps the
holes to page space through the same rotation transform the renderers use.

| size | columns N | holes per rail R | box W x H (pitches) |
|---|---|---|---|
| full | 63 | 50 | 66 x 22 |
| half | 30 | 25 | 33 x 22 |
| mini | 17 | 0 (no rails) | 20 x 16 |

- Columns `c = 1..N` are at `x = c + 1`.
- Rows with rails:
  - rails `T-` y 1 and `T+` y 2
  - column numbers y 4
  - rows a-e y 5..9, then the centre channel (y 10-11)
  - rows f-j y 12..16
  - column numbers y 17
  - rails `B+` y 19 and `B-` y 20
- Mini board: column numbers y 1, rows a-e y 2..6, rows f-j y 9..13 and
  column numbers y 14.
- Row e to row f is 3 pitches (0.3 in), so DIP ICs and the button straddle
  the channel.
- Rail hole `k = 1..R` is at
  `x = s + (k - 1) + floor((k - 1) / 5)`, with
  `s = 2 + floor((N - (R + R/5 - 1)) / 2)`. Rails are groups of five with a
  one-pitch gap.
- Hole ids: terminal holes are `<row><column>` (`a1`, `j30`), and rail
  holes are `<rail><k>` (`T+1`, `B-25`).
- Strips, which are the board's internal conductors:
  - `col:<c>:top` (rows a-e of column c)
  - `col:<c>:bot` (rows f-j)
  - `rail:T+`, `rail:T-`, `rail:B+`, `rail:B-`, each continuous along the
    whole board (no split rails; user-QA Q2)

### 4.2 Anchors, snapping and rotation (`snap.ts`, `rotate.ts`)

- The anchor is pin 1 for a part, hole `a1` for a board, the top-left
  corner for a netlist card and the dragged point for a wire end.
- **Lattice snap**: `snapBreadboardDelta(store, pageId, movingIds, delta)`
  returns the corrected delta. It puts the anchor of the first breadboard
  element of the moving set (in element index order) on the nearest lattice
  point. Every pin then lands on the lattice, because pins are integer
  offsets from pin 1 and rotations are multiples of 90.
  - The ui-solid move gesture calls it when the moving set contains a
    breadboard element and snapping is enabled for the gesture (`snapFor`
    is not null). Object and box-grid snapping are skipped for that
    gesture.
  - With snapping disabled, positions are kept as dropped, and ERC reports
    pins that land off a hole.
  - `snapBreadboardPoint(p)` rounds a point to the lattice. Wire endpoint
    and bend-point drags and the wire tool use it.
  - Palette creation puts the anchor on the snapped pointer point.
- **Rotation**: `Editor.rotateBreadboardParts(ids, quarterTurns: 1 | -1)`
  works on breadboard part types only. Boards and wires are ignored.
  - Each part's `visual.rotation` becomes `(rotation + 90 * quarterTurns)`
    mod 360. Then `visual.x/y` are translated so that pin 1 keeps its page
    position. That position is re-rounded to the lattice.
  - Several parts in one call each rotate in place. They are not rotated as
    a group about a common centre. This matches KiCad's per-item rotation.
  - It is one undo step.
  - `canRotateElement` stays false for breadboard types, so the generic
    rotate handle and the generic Rotation field never offer free angles.
- **Parameter edits**: `Editor.updateBreadboardSemantic(id, patch)` applies
  semantic patches. When `span` or `pinCount` change, it rewrites
  `visual.x/y/width/height` so pin 1 keeps its page position. The inspector
  writes through it.
- `ShapeUtil.canResize` is false for all breadboard types.

### 4.3 Shape utils (`packages/core/src/shapes/breadboard.ts`)

These are registered in `createDefaultRegistry`.
- `getBounds` returns the catalogue box for parts and boards, and the
  point bounds grown by half the stroke width for wires.
- `hitTest`:
  - parts: the box
  - boards and netlist cards: the box
  - wires: within 0.4 pitch of a segment
- Pin hit-testing for hover is a separate helper,
  `breadboardPinAt(store, pageId, point)`: within 0.4 pitch of a pin or wire
  end. Section 5.2 uses it.

### 4.4 Moving a board carries its contents

`planBreadboardTranslations(before, after)` runs in `Editor.apply`, next to
`planBpmnTranslations`. When the batch translates a board, the planner also
moves:
- every part whose pins are all in holes of that board
- every wire whose two ends are both in holes of that board

Elements the batch already moved are skipped, and so are elements whose
pins span several boards. Translation only: boards are not rotated by the
editor (section 3.3). A new board is created at the bottom of the page
z-order, so it never covers parts or wires.

## 5. Connectivity and net highlight

### 5.1 Engine (`connectivity.ts`)

`computeBreadboardConnectivity(document, pageId)` is pure and
deterministic. It ignores elements with `visual.hidden`.

1. **Lattice index.** For each board in z-order (the topmost wins on
   overlap), each hole's page position is keyed by its lattice point
   `(round(x/10), round(y/10))`. A point matches a lattice point when it is
   within 0.5 page units of it on both axes. A point that matches no
   lattice point connects to nothing.
2. **Connection points.** These are every part pin (catalogue offsets
   through the part transform) and both ends of every wire.
3. **Union-find over the following.**
   - A point on a hole joins that hole's strip.
   - All connection points on the same lattice point join each other. This
     covers a wire end on an off-board pin and two parts in one hole.
   - The two ends of a wire join (a wire conducts).
   - The internal bonds of a part (button) join.
4. **Output** `BreadboardConnectivity`:
   - `nets`: each with its points, its strips (board id and strip id) and
     its wire ids
   - lookups from pin (element id and pin number) to net, and from wire to
     net
   - the hole occupancy used by ERC
   Net identity is internal to one computation.

`toBreadboardNetlist(document, pageId, connectivity)` projects the result
into the `BreadboardNetlist` model of section 3.5:
- **Components**: all visible part elements, sorted in natural reference
  order. The prefix is compared alphabetically, then the number
  numerically. Unannotated references sort after numbered ones with the
  same prefix. Element id breaks ties.
- **Nets**: every net that has at least one part pin. A pin that is not
  connected forms a one-node net.
  - Nodes are sorted by component order, then pin number.
  - Nets are sorted by their first node, and codes run `1..n` in that
    order.
- **Net names**:
  - The net with pin 2 (`-`) of the first battery in component order is
    `GND`.
  - The net with that battery's pin 1 (`+`) is `VCC`, unless it is the same
    net, which keeps `GND`.
  - Every other net is `N_<reference>_<pin>` of its first node.
  - Names are made unique by appending `_<code>` on a collision.

### 5.2 Net highlight (core state, ui-solid overlay)

`breadboardNetHighlight(connectivity, target)` returns the highlighted set:
pins (element and pin number), hole positions, wire ids and strips. The
target is a pin or a wire.

The ui-solid canvas chooses the target in this order:
1. the pin or wire end under the pointer (`breadboardPinAt`)
2. otherwise the wire under the pointer
3. otherwise the probe target, the pin set by cross-probing from the
   problems panel or inspector (section 7.5)
4. otherwise the single selected wire

The probe target is cleared by a canvas click, Esc, or a page change.

The overlay draws a ring on each highlighted hole and pin and an outline
glow on the wires. It is transient UI state. It is never written to the
document or to SVG export. Connectivity is recomputed on document change
and memoised per store revision. Because a drag writes to the store on
every pointer move (section 1), the highlight, the ratsnest and the
problems panel all follow a drag without extra wiring.

`breadboardNetMembers(connectivity, target)` returns the element ids of
every part with a pin on the target's net and every wire of that net, in
element order. Cross-probing uses it to select a net (section 7.5).

### 5.3 Ratsnest (`ratsnest.ts`)

`computeBreadboardRatsnest(document, pageId, connectivity)` returns
`RatsnestLine[]`, each
`{targetNet, from: {elementId, pin, x, y}, to: {elementId, pin, x, y}}`.
It returns `[]` when the page has no target netlist (section 3.2).

1. **Resolve parts.** A target reference resolves to the first visible
   part in element order with that exact `reference`. Unresolved
   references and pin numbers the part does not have are ignored here.
   Parity reports them (section 6.1).
2. **Group.** For each target net, in target order, group its resolved
   pins by their breadboard net (section 5.1).
3. **Span.** With two or more groups, join them with a minimum spanning
   tree (Prim). Start from the group that holds the net's first resolved
   node. Then repeatedly add the shortest pin-to-pin link, by Euclidean
   page distance, from the joined set to an unjoined group. Ties are
   broken by the node order of the `from` pin, then of the `to` pin. Each
   added link is one line, and `to` is the pin in the newly joined group.
4. One target net with g groups gives g - 1 lines. Fully routed nets give
   none, so the lines disappear as the breadboard connects them.

Staged parts (section 8.6.5) have no pin in a hole, so each of their pins
is its own group, and lines run from the staging area to the board, as
KiCad airwires do from unplaced footprints.

The ui-solid canvas draws each line as a thin dashed overlay (0.15 pitch,
our own colour constant), above parts and below the net highlight. Like
the highlight, it is transient: it is never written to the document or to
SVG export. It is memoised per store revision with the connectivity.
Cost per revision is linear in holes plus pins, plus the square of the
node count per target net, which is small for breadboard circuits.

## 6. ERC (`packages/core/src/breadboard/erc.ts`)

`lintBreadboardPage(document, pageId)` returns `BreadboardErcFinding[]`.
A finding is
`{ruleId, severity: "error"|"warning", elementId, pin?: number,
elementIds: string[], message}`. `elementIds` is the cross-probe set
(section 7.5). It starts with `elementId` and, for rules that involve
several elements, adds the others in element order.
`BREADBOARD_ERC_RULE_IDS` lists the thirteen rules (eight here, five in
section 6.1). There is no config: every rule always runs at the severity
below.

Findings are sorted by element index order, then rule id, then pin, then
message (several rule 11 findings share the netlist card). Rule
ids and messages are nodetto's own wording, and messages name the
reference and the pin.

Supply classification, used by rules 4 and 5:
- A net is *positive* if it contains a battery `+` pin or a `T+`/`B+` rail
  strip.
- A net is *negative* if it contains a battery `-` pin or a `T-`/`B-` rail
  strip.
- A net that is both is *shorted*. It is reported by rules 2 or 3 and
  takes no part in rules 4 and 5.

| # | rule id | severity | reports on | semantics |
|---|---|---|---|---|
| 1 | `pin-not-in-hole` | error | part, pin | A pin that is neither on a board hole nor touched by a wire end. |
| 2 | `shorted-part` | error | part | A two-pin part (resistor, led, capacitor, diode, battery) whose two pins are on the same net. This includes both legs in one strip. |
| 3 | `rail-short` | error | the first wire or part, in element order, on the offending net (the board if the net has neither) | A net that contains both a `+` rail strip and a `-` rail strip, on any boards. |
| 4 | `reversed-polarity` | error | led/diode | Polarity is determinable and reversed. It is determinable when the anode net reaches only negative nets and the cathode net reaches only positive nets. "Reach" means a walk over conductive links: resistor pins 1-2, all potentiometer pins, and button pair {1,2} to pair {3,4} (a closed switch). The walk does not pass through another supply net. LEDs, diodes and capacitors are never traversed. |
| 5 | `led-no-series-resistor` | warning | led | The LED is forward-placed between supply nets with no resistance. The anode net reaches a positive net and the cathode net reaches a negative net using only zero-ohm links: button pairs, and other LEDs and diodes in either direction. The LED itself is excluded. A resistor or potentiometer anywhere in the series path suppresses the finding. A resistor in parallel does not suppress it (accepted heuristic). |
| 6 | `unconnected-pin` | warning | part, pin | A pin whose net contains no pin of another part. Pins already reported by rule 1 are skipped. |
| 7 | `duplicate-reference` | error | part | A part whose `reference` equals (exact string match) that of an earlier part, in element order, on the same page. |
| 8 | `wire-end-off-hole` | error | wire | A wire end that is on neither a board hole nor a part pin. |

Each rule has a positive and a negative test on small documents built in
the test (section 11).

### 6.1 Schematic parity rules (`parity.ts`)

These rules run only when the page has a target netlist (section 3.2).
They compare the breadboard with it, the way KiCad's "Update PCB from
Schematic" and DRC schematic parity do, and use the part resolution of
section 5.3.

Target-net assignment of a resolved pin:
- the target net that lists it
- otherwise, the target net of a pin in the same catalogue bond group
  (button `{1,2}`/`{3,4}`), so a 4-pin button imported from a 2-pin
  symbol is not reported for its bonded twin pins
- otherwise a singleton pseudo net, named "unconnected <ref> pin <n>" in
  messages, which means the schematic leaves that pin unconnected

| # | rule id | severity | reports on | semantics |
|---|---|---|---|---|
| 9 | `parity-missing-connection` | warning | the `to` part and pin of each ratsnest line | One finding per ratsnest line (section 5.3): the target joins two pins that the breadboard does not. The message names the target net and the `from` reference and pin. `elementIds` holds both parts. |
| 10 | `parity-extra-connection` | error | the first pin (component order) of the second target net on the offending breadboard net | A breadboard net that holds resolved pins of two or more different target nets or pseudo nets. One finding per breadboard net. The message lists the merged target nets. `elementIds` holds every part with a resolved pin on that net. |
| 11 | `parity-missing-part` | warning | the netlist card | A target part whose reference resolves to no part on the page. The message names the reference and value. |
| 12 | `parity-extra-part` | warning | part | A visible part whose reference is not in the target. Later holders of a duplicated reference are left to rule 7 and are not reported here. |
| 13 | `parity-value-mismatch` | warning | part | A resolved part whose value differs from the target value. When both values parse with `parseComponentValue`, they are compared numerically with a relative tolerance of 1e-9, so `4k7` equals `4.7k`. Otherwise they are compared as trimmed, case-insensitive strings. |

- Missing work (rules 9, 11, 12, 13) is a warning, because an imported
  page starts with every part staged. A connection that merges target nets
  (rule 10) is an error, because it is wrong whatever the build progress.
- Parts are matched by reference only. A type change behind the same
  reference is not a parity rule.
- Rules 1 and 6 still report staged pins. The problems panel lists them,
  and that list is the work queue (user-QA Q9).

## 7. Rendering and UI

### 7.1 Notation (`packages/core/src/breadboard/notation.ts`)

`breadboardNotation(element)` returns
`{body: NotationPrimitive[], labels: NotationPrimitive[]}`. It reuses the
`NotationPrimitive` type from `packages/core/src/bpmn/notation.ts` (rect,
circle, path, polygon and text).
- `body` is in unrotated box-local coordinates. Both renderers draw it
  inside the element's existing rotation transform.
- `labels` are text primitives whose anchor is pre-rotated, so the text
  stays upright at every rotation. Both renderers draw them outside the
  rotation transform.

SVG export (`svg-export.ts` `renderShape`) gains an
`isBreadboardElementType` branch before the type switch. It writes one SVG
node per primitive with `class="breadboard-<role>"`. The canvas
`ShapeView.tsx` gains a `BreadboardShapeView` that renders the same
primitives. The canvas and the export therefore cannot diverge. Tests
assert roles and counts.

Original artwork rules (colours are our own constants, shapes are flat):
- **Board**
  - an off-white body rect with rounded corners
  - a darker centre-channel groove between rows e and f
  - square dark holes 0.36 pitch wide
  - a red line on each `+` rail and a blue line on each `-` rail
  - `+`/`-` glyphs at both rail ends
  - row letters at both ends of every row
  - column numbers at 1 and every multiple of 5
  - roles: `board`, `board-hole`, `board-channel`, `rail-plus`,
    `rail-minus`, `board-label`
- **Resistor**
  - grey leads and a beige body (light blue for 5-band)
  - bands from section 7.3, roles `resistor-band-<i>`
  - no bands when the value is not representable
- **LED**
  - a dome circle in the LED colour
  - a flat chord on the cathode side, role `led-flat`
- **Capacitor**
  - ceramic: a small orange disc body
  - electrolytic: a dark circle with a light stripe sector on the `-` side,
    role `cap-minus-stripe`
- **Diode**: a black body with a grey cathode band, role `diode-band`.
- **Transistor**: a black TO-92 D-shape with the flat face toward -y.
- **Button**: a square dark body with a round actuator.
- **Potentiometer**: a square blue body with a slotted knob.
- **IC**
  - a black body between the rows
  - a semicircle notch at the pin-1 end, role `ic-notch`
  - a pin-1 dot, role `ic-pin1`
  - silver legs
- **Header**: a black block per pin with a gold square pin.
- **Battery**: a dark cell body with `+`/`-` marks beside its pins.
- **Wire**
  - an outline stroke under a colour stroke 0.45 pitch wide, with round
    caps and joins
  - a small metal square at each end, role `wire-end`
- **Netlist card**: a light rounded rect with the title "Target netlist",
  the source file name and "<parts> parts, <nets> nets". Roles
  `netlist-card` and `netlist-label`. An inert card (section 3.2) is drawn
  at half opacity.
- **Labels**: the reference above each part. An IC also shows its
  reference and value on the body.

### 7.2 Palette, inspector, keys and problems panel (packages/ui-solid)

- **Workspace**
  - A `breadboard` workspace in `workspaces.ts` (`design: false`,
    `shapes: false`). Its primary tools are Half board, Resistor, LED,
    Push button and Wire.
  - `workspaceShapes("breadboard")` lists the full catalogue: full, half and
    mini boards, resistor, LED, ceramic capacitor, electrolytic capacitor,
    diode, NPN, PNP, push button, potentiometer, DIP-8 IC, 1x4 header,
    battery and wire.
  - `BREADBOARD_TOOLS` in `tools.ts` give each creation tool a
    `creationFor` entry.
  - Creating a part goes through `Editor.createBreadboardPart`. It snaps
    the part and annotates it (section 7.4).
- **Wire tool**: a gesture tool.
  - Each click adds a snapped point.
  - Double-click or Enter finishes, and Esc cancels.
  - At least two distinct points are needed.
  - On a selected wire, each point has a handle. Double-click on a segment
    inserts a bend point, and double-click on a bend point removes it.
  - All of these go through `Editor.updateBreadboardSemantic`.
- **Desktop page following**
  - `App.tsx` generalises its two BPMN special cases
    (`changeWorkspace` and the follow-page effect) into a lookup from page
    kind to dedicated workspace: `bpmn` to `bpmn`, `breadboard` to
    `breadboard`.
  - BPMN behaviour is unchanged.
  - Choosing Breadboard in Mode opens or creates a `breadboard` page named
    "Breadboard".
- **Inspector**: a `BreadboardSection`, matched on `breadboard.*`.
  - It edits reference, value and the type parameters (section 3.2), wire
    colour and board size.
  - For resistors, the value field offers E24 suggestions.
  - "Rotate left" and "Rotate right" buttons call
    `rotateBreadboardParts`.
  - A pin list shows each pin with its net name. Clicking a row and the
    row's "Select net" action cross-probe (section 7.5).
  - For a netlist card it shows the read-only target, with cross-probe
    rows (section 7.5): the source, then the parts with a status (placed,
    missing, value mismatch), then the nets with their nodes.
- **Keys**
  - On a `breadboard` page with at least one breadboard part selected,
    `r` rotates the selection 90 degrees clockwise and `Shift+R`
    counter-clockwise.
  - Otherwise `r` keeps its existing rectangle-tool meaning. `TOOL_KEYS` is
    unchanged (user-QA Q3).
- **Problems panel**
  - `BreadboardProblemsPanel.tsx`, mounted by the desktop on `breadboard`
    pages, follows `BpmnProblemsPanel`.
  - It re-runs ERC debounced at 300 ms.
  - It lists the ERC and parity findings of the page together. Like
    `BpmnProblemsPanel`, it takes `importWarnings`, so the KiCad import
    diagnostics of a freshly opened file (section 10) are listed too.
  - Each row shows severity, reference and pin, the message and the rule
    id, plus one reference chip per part in `elementIds`.
  - Clicking a row or a chip cross-probes (section 7.5).
  - A "Fix references" button runs `Editor.annotateBreadboard(pageId)`. It
    is enabled when a duplicate or unannotated reference exists.

### 7.3 Resistor colour bands (`packages/core/src/breadboard/resistor-bands.ts`)

`resistorBands(value, bands, tolerance?)` returns colour names or `null`.
The code follows IEC 60062 public facts:
- digits: black 0, brown 1, red 2, orange 3, yellow 4, green 5, blue 6,
  violet 7, grey 8, white 9
- multipliers: silver 10^-2, gold 10^-1, black..white 10^0..10^9
- tolerance: grey 0.05, violet 0.1, blue 0.25, green 0.5, brown 1, red 2,
  gold 5, silver 10, and 20 percent as no band

Steps:
1. Parse the value with `parseComponentValue` (ohms).
2. Use 2 significant digits for 4-band and 3 for 5-band, plus the
   multiplier.
3. If the value is not exactly representable with that many digits within
   the multiplier range, return `null`.
4. Add the tolerance band. When `tolerance` is absent, use 5 percent
   (4-band) or 1 percent (5-band).
5. A value of 0 ohms returns `["black"]`.

The result is the bands in reading order, from the pin-1 end.

### 7.4 Annotation (`packages/core/src/breadboard/annotate.ts`)

- `annotateBreadboardParts(existing, incoming)` returns a reference for
  each incoming part.
  - An incoming reference that is unannotated, or that collides with a
    reference already on the target page or earlier in the batch, gets the
    lowest free number for its prefix.
  - Other references are kept.
- It is applied:
  - in `Editor.createBreadboardPart`
  - in `Editor.paste` and duplicate, which runs it on the planned elements
    of breadboard part types before committing when the target page kind is
    `breadboard`. This is the only change to the paste path.
- `Editor.annotateBreadboard(pageId)` renumbers only duplicates and
  unannotated parts. The first holder of each reference (element order)
  keeps it, and later holders get the lowest free numbers. It is one undo
  step.
- Undo, redo, raw apply, imports and collab updates never annotate. ERC
  reports any duplicates that arrive through them. Imported references
  must stay equal to the target netlist's, so parity can match them.

### 7.5 Cross-probing (packages/ui-solid)

Cross-probing moves from a problem, net or reference to the canvas, using
the calls that `focusBpmnProblem` (`packages/ui-solid/src/bpmn-problems.ts:55`)
already makes: `editor.setCurrentPage`, `editor.selection.set` and
`editor.zoomToSelection`. A new `focusBreadboardProbe(editor, probe,
viewport)` in `packages/ui-solid/src/breadboard-problems.ts` does the
following:
1. replaces the canvas selection with a set of element ids, skipping ids
   that no longer exist,
2. frames their union bounds, and
3. optionally sets the probe target pin (section 5.2), which highlights
   that pin's net.

| source | selection | probe target |
|---|---|---|
| problems panel row | `finding.elementIds` | `finding.pin` of `finding.elementId`, when present |
| problems panel reference chip | that part | none |
| inspector pin row (part) | unchanged | that pin |
| inspector pin row "Select net" | `breadboardNetMembers` of that pin | that pin |
| netlist card: part row | the resolved part (no-op for a missing part) | none |
| netlist card: net row | every resolved part with a node in that target net | the net's first resolved pin |

Probing never edits the document. The direction from the canvas to the
panel is not in scope.

## 8. Exports and IO

### 8.1 Pipeline

The io package cannot import core, so the exporters are pure formatters
over the `BreadboardNetlist` model (section 3.5) in
`packages/io/src/breadboard/`. The CLI and desktop build the model with
core (`computeBreadboardConnectivity`, then `toBreadboardNetlist`) and pass
it in. Each formatter returns `{text, warnings}`.

Common warnings:
- unannotated reference
- duplicate reference
- value not parseable (SPICE only)

Output is ASCII-safe as given, LF line endings with a trailing newline, and
byte-deterministic for a given model.

### 8.2 BOM CSV (`bom.ts`, `exportBreadboardBomCsv`)

- Header `Item,Qty,References,Value,Part,Footprint`.
- One row per group. The group key is (type, value, description,
  footprint).
- Groups are ordered by their first reference in natural order. References
  inside a group are in natural order and joined by `", "`.
- Fields follow RFC 4180: quoted when they contain a comma, quote or
  newline, with quotes doubled.
- Boards and wires are not listed (user-QA Q4).

### 8.3 KiCad-style netlist (`kicad-netlist.ts`, `exportBreadboardKicadNetlist`)

The writer is our own. It emits the published S-expression structure:

```text
(export (version "E")
  (design (source "<document title>") (tool "nodetto"))
  (components
    (comp (ref "R1") (value "220") (footprint "nodetto:Resistor_P4")
      (libsource (lib "nodetto") (part "Resistor") (description "Resistor 5%"))))
  (nets
    (net (code "1") (name "GND")
      (node (ref "BT1") (pin "2") (pinfunction "-")))))
```

- Two-space indentation, one `comp` and one `net` per line group.
- Strings are quoted, with `\` and `"` escaped.
- No date or timestamp, so the output is deterministic.
- Component and net order follow section 5.1.
- `libsource` is always `(lib "nodetto")` with the catalogue part name
  (section 3.4). Pins are written in nodetto numbering, and `pinfunction`
  is the catalogue pin name. Importing the file back (sections 8.6.3
  and 8.6.4) therefore reproduces the page's parts, values and nets exactly.

### 8.4 SPICE netlist (`spice-netlist.ts`, `exportBreadboardSpiceNetlist`)

- **Title line**: `* <document title> / <page name> (nodetto breadboard)`.
- **Node names**: the net names, with `GND` written as `0`.
- **Values**: written through `parseComponentValue` and SPICE suffixes
  (`p n u m k Meg G`). The formatter picks the largest suffix with a
  mantissa of at least 1, with at most 6 significant digits.
- **An unparseable value** writes the line as a `*` comment and adds a
  warning.
- **Element names**: the SPICE element name is the reference when it
  already starts with the element's SPICE letter (`R1`, `C1`, `D1`, `Q1`).
  Otherwise the letter is prefixed (`VBT1`, `XU1`, `RRV1A`).
- **Element lines** (components in section 5.1 order):
  - resistor: `R1 n1 n2 220`
  - potentiometer: `RRV1A n1 nW <v/2>` and `RRV1B nW n3 <v/2>` (wiper at
    the centre)
  - capacitor: `C1 n1 n2 100n`
  - led: `D1 nA nK D_LED`
  - diode: `D2 nA nK D_GENERIC`
  - transistor: `Q1 nC nB nE QNPN|QPNP`, with the C/B/E nodes taken from
    `pinout`
  - battery: `VBT1 n+ n- DC <volts>`
  - ic: `XU1 n1 .. nN <sanitised value>`, plus the comment
    `* subcircuit <name> not defined`
  - button: `* SW1 push button (open): 1-2 <net>, 3-4 <net>`
  - header: `* J1 header: <nets>`
- **Models**: `.model` lines for the used models only, with no parameters
  (`D_LED D`, `D_GENERIC D`, `QNPN NPN`, `QPNP PNP`). Then `.end`.

### 8.5 JSONL, Mermaid, D2 and collab

- **JSONL**: generic through the registry key order. Round-trip coverage is
  the `breadboard.jsonl` golden file (section 3.6) plus one record test per
  type.
- **Mermaid**: already skips unknown types (section 1). A test pins that a
  breadboard page exports nothing, and the CLI reports no
  Mermaid-compatible content.
- **D2**: `d2/export.ts` skips `isBreadboardElementType` elements and adds
  one warning per page: "Breadboard elements are not exported to D2."
- **Collab**: generic. `packages/collab/src/test-fixtures.ts` `allFixtures()`
  gains a breadboard fixture that includes a netlist card. A new
  `packages/collab/src/breadboard.test.ts` covers a Y.Doc round trip, plus
  a concurrent part move and wire-colour edit converging.

### 8.6 KiCad import (`packages/io/src/kicad/`, exported as `@nodetto/io/kicad`)

The importers turn a file into a `BreadboardImportResult` (section 3.5).
Core lays the plan out as a document (section 8.6.5), because the
catalogue boxes live in core and io cannot import core (section 1).
Neither step throws on bad input. Every problem becomes a diagnostic.

`importKicad(text, {fileName})` picks the importer by the root list head,
never by extension:
- `kicad_sch` goes to the schematic importer
- `export` goes to the netlist importer
- `EESchema` text (KiCad 5) gives the error `kicad.legacyFormat`
- anything else gives the error `kicad.unknownRoot`

Only these and `sexpr.empty` are errors. An error leaves `plan` absent.
Every other diagnostic is a warning, and a plan is still produced.

#### 8.6.1 S-expression reader (`sexpr.ts`)

`readSexpr(text)` returns `{root?: SexprList, diagnostics}`.
- Nodes are lists (`{kind: "list", items, line, column}`) and atoms
  (`{kind: "atom", text, quoted, line, column}`), with 1-based positions.
- Tokens:
  - `(` and `)`
  - double-quoted strings with the escapes `\"`, `\\`, `\n`, `\r` and
    `\t`, where any other escaped character stands for itself
  - bare atoms, ended by whitespace, a parenthesis or a quote
- The reader is iterative (an explicit stack), so no input can overflow the
  call stack. Lists deeper than 256 levels are dropped with
  `sexpr.tooDeep`, so the recursive tree walkers in the importers stay
  bounded.
- Recovery, each with a positioned warning:
  - an unterminated string ends at end of input (`sexpr.unterminatedString`)
  - unclosed lists are closed at end of input (`sexpr.unclosedList`)
  - a stray `)` at top level is skipped (`sexpr.unexpectedClose`)
  - content after the first top-level list is ignored
    (`sexpr.trailingContent`)
- Input with no list at all is the error `sexpr.empty`.
- Helpers: `child(list, head)`, `children(list, head)`, `atomAt(list, i)`
  and `numberAt(list, i)`. A non-finite number gives `kicad.invalidNumber`,
  and the item that holds it is skipped.

Unknown list heads are ignored silently anywhere, because KiCad files carry
many tokens that do not affect parts or connectivity (title block, paper,
graphics, text, fields, UUIDs). Only tokens whose loss changes the result
are reported (section 8.6.2).

#### 8.6.2 Schematic importer (`schematic.ts`)

The importer reads the root sheet of a KiCad 6+ `.kicad_sch` file.

- **Library symbols**: `lib_symbols` entries are keyed by name. Each
  sub-symbol `<name>_<unit>_<style>` contributes its `pin` items. A pin
  gives `(at x y angle)` (its connection point), `name` and `number`.
  Pins of unit 0 belong to every unit. Only style 0 and 1 (or the
  instance's alternate body style when it sets one) are read. A symbol
  marked `(power)` is a power symbol.
- **Symbol instances**: each top-level `symbol` with `lib_id` (or
  `lib_name` when present, which selects the `lib_symbols` key), `(at x y
  angle)`, optional `(mirror x|y)` and `(unit n)`.
  - The reference comes from the first nested `instances` path reference.
    Otherwise it comes from a top-level `symbol_instances` entry whose path
    ends with the symbol uuid. Otherwise it is the `Reference` property.
  - The value is the `Value` property.
  - A missing library symbol gives `kicad.missingLibSymbol`, and the
    instance is skipped.
  - Instances that share a reference (the units of one part) merge into
    one part. Their pin sets are united.
- **Pin positions**: a library pin point (x, y), y-up, becomes a schematic
  point, y-down, through these steps in order:
  1. negate y
  2. rotate by the instance angle in 90-degree steps, counter-clockwise as
     seen on screen
  3. mirror: `x` negates y, and `y` negates x
  4. translate by the instance position
  Non-multiple-of-90 angles are rounded to the nearest quarter turn with
  `kicad.unsupportedAngle`.
- **Point identity**: every coordinate is rounded to an integer number of
  1e-4 mm before comparison.
- **Connectivity** (nodetto's own rules, union-find over points):
  - The two ends of a `wire` join each other.
  - A point (wire end, pin point, junction, label anchor) joins a wire
    when it equals one of the wire's ends or lies on the wire's interior.
  - Two wire interiors that only cross do not join.
  - Coincident pin points join.
  - `label`, `global_label` and `hierarchical_label` all attach their
    text to the net at their anchor. Nets with equal label text join. With
    a single sheet the three label kinds behave the same.
  - A power symbol's pin attaches its `Value` as a label of the highest
    priority. Power symbols are never parts. A power symbol whose value is
    `PWR_FLAG` is ignored entirely, because it only marks a driven net and
    must not join flagged nets together.
  - Symbols whose reference starts with `#` are never parts.
  - `no_connect` markers have no effect, since an unconnected pin is
    already its own net.
  - Reported and ignored: `bus` and `bus_entry` give `kicad.bus` (once
    per file). `sheet` gives `kicad.hierarchicalSheet` (once per file),
    and only the root sheet is imported.
- **Net names**: the power-symbol value, otherwise the alphabetically first
  label text, otherwise `N_<ref>_<pin>` of the first node (section 5.1
  order). Names are made unique with `_<n>`.
- **Nets kept**: only nodes of imported parts are kept, and nets with no
  node are dropped. Every mapped pin of an imported part appears in exactly
  one net. Unconnected pins form one-node nets.

#### 8.6.3 Netlist importer (`netlist.ts`)

The importer reads a KiCad S-expression netlist (`(export (version ...)
...)`), including nodetto's own export (section 8.3).
- `components`: each `comp` gives `ref`, `value` and
  `libsource (lib) (part)`. A second `comp` with a reference already seen
  is skipped with `kicad.duplicateReference`. A `comp` without `ref` is
  skipped with `kicad.missingReference`.
- `libparts`, when present, gives the pin numbers and names per
  (lib, part).
- `nets`: each `net` gives `name` (kept verbatim) and `node (ref) (pin)
  (pinfunction?)`. Nodes whose `ref` is not an imported part (power
  symbols are not components) are dropped.
- Pin names for mapping come from `pinfunction`, then from `libparts`.
- Pins of an imported part that appear in no net get one-node nets.
- Net order and node order are normalised to section 5.1. The `code`
  values in the file are not kept.

#### 8.6.4 Symbol mapping (`symbol-map.ts`)

`mapKicadSymbol({lib, name, reference, pins})` returns a part type,
parameters and a pin map (source pin number to nodetto pin number), or a
skip. `name` is the part of `lib_id` after `:` (or the `libsource` part),
and `pins` are the symbol's pins with numbers and optional names. The
first matching row wins. Prefix tests are case-sensitive.

| # | match | type and parameters | pins required | pin map |
|---|---|---|---|---|
| 1 | lib `nodetto` and a catalogue part name (section 3.4) | that type; `span` from the `Resistor_P<n>` footprint when present, `pinCount` from the pin count, LED colour from the value when it is a colour name, other parameters default | per type | identity |
| 2 | name starts with `R_Potentiometer` | potentiometer | 3 | identity |
| 3 | name is `R` or starts with `R_` | resistor, span 4 | 2 | identity |
| 4 | name starts with `C_Polarized`, or is `CP` or starts with `CP_` | capacitor electrolytic, span 1 | 2 | by name `+`/`-` when both are named, else identity |
| 5 | name is `C` or starts with `C_` | capacitor ceramic, span 1 | 2 | identity |
| 6 | name starts with `LED` | led red (colour from the value when it is a colour name) | 2 | by name `A`/`K`, else identity with `kicad.pinNamesMissing` |
| 7 | name is `D` or starts with `D_` | diode, span 4 | 2 | as row 6 |
| 8 | name contains `NPN` or `PNP` | transistor npn or pnp | 3 | identity; `pinout` from the names of pins 1-3 when they are a permutation of `E`, `B`, `C`, else `EBC` with `kicad.pinNamesMissing` |
| 9 | name starts with `SW_Push` | button | 2 | 1 to 1, 2 to 3 (opposite sides of the switch; pins 2 and 4 are their bonded twins) |
| 10 | name starts with `Conn_` | header, `pinCount` = pin count | 1..40 | identity |
| 11 | name starts with `Battery` | battery | 2 | by name `+`/`-` when both are named, else identity |
| 12 | name contains `DIP`, or the reference prefix is `U` | ic, `pinCount` = pin count | even, 4..40 | identity |
| 13 | reference prefix fallback: `R`, `RV`, `C`, `D`, `Q` (npn, `kicad.pinNamesMissing`), `SW`, `J`/`P`, `BT` | as rows 2-11 for that prefix | as that row | as that row |
| 14 | anything else | ic when the pin count is even and 4..40, otherwise header when it is 1..40, with `kicad.unsupportedSymbol` | 1..40 | identity |
| 15 | pin count 0 or above 40, or no row applies | skipped with `kicad.skippedSymbol`; its nodes are dropped | | |

- A row that matches by name but fails its pin requirement falls through
  to row 14, with `kicad.unsupportedSymbol`.
- The reference prefix is the leading letters of the reference.
- A pin whose number is not a positive integer, or is not in the pin map,
  gives `kicad.unmappedPin`, and its nodes are dropped.
- The pin count is the number of distinct pin numbers: from the library
  symbol (`.kicad_sch`), from `libparts` (`.net`), or else from the
  largest pin number among the part's net nodes.
- References and values are kept verbatim. The importer never annotates.
- Rows 2-13 use only the symbol-name prefixes and reference letters the
  issue names. They are not a copy of any KiCad table.

#### 8.6.5 Layout (`packages/core/src/breadboard/import-layout.ts`)

`layoutBreadboardImport(plan): Document` builds a new document. It is
deterministic, so CLI output is byte-stable:
- Title `plan.title`, one page
  `{id: "page-1", kind: "breadboard", name: "Breadboard"}`.
- A half board (`breadboard.board`, id `board-1`) at page origin
  `(0, 0)`.
- The netlist card (id `target-netlist`), with `plan.target` as its
  semantic, at `(BW + 2, 0)` pitches, where BW is the half-board width.
- The staging area starts at `y = BH + 4` pitches (BH is the board height),
  below the board, so a later resize to a full board never covers it.
- Parts (ids `part-<n>`, n in plan order from 1) are placed in plan order,
  at rotation 0, left to right from `x = 0`.
  - Each part's pin 1 sits on the lattice point that puts the left edge of
    its box at or right of the cursor.
  - The cursor then advances by the box width plus 2 pitches.
  - A row wraps when the next box would pass 66 pitches (the full-board
    width). The next row starts at the previous row's tallest box plus 2
    pitches.
- No wires are created.
- Boards come first in element order, then the card, then the parts.

The staged parts have no pin in a hole. ERC rule 1 and parity rule 9
therefore list them, and the ratsnest draws their lines until they are
placed (sections 5.3 and 6.1).

## 9. CLI (apps/cli)

- **`lint`** (`commands.ts:210`):
  - Pages: every `bpmn` and every `breadboard` page, in page order, or the
    one chosen with `--page`.
  - With neither kind present, it fails with "The document contains no BPMN
    or breadboard pages."
  - `--config`/`.bpmnlintrc` is read only when the selected pages include a
    `bpmn` page. BPMN output is unchanged.
  - Breadboard pages use `lintBreadboardPage`, which includes the parity
    rules when the page has a target netlist.
  - Text rows and JSON follow the BPMN format. A breadboard finding with a
    pin adds `"pin": <n>` to its JSON object, and the key is omitted
    otherwise. `elementIds` is UI-only and is not written. The text element column shows `<elementId>`, and the message
    names the reference and pin.
  - Exit codes are unchanged: 0, 1 when any error finding exists, and 2.
- **`breadboard`**: a new command group dispatched in `commands.ts` (sync),
  with `help.ts` entries following `bpmn`:
  - `breadboard bom <document.jsonl> [--page <id|name>] [--output <file.csv> | --check <file.csv>] [--strict]`
  - `breadboard netlist <document.jsonl> --format kicad|spice [--page <id|name>] [--output <file> | --check <file>] [--strict]`
  - The single `breadboard` page is chosen automatically. With several,
    `--page` is required (exit 2).
  - `--output` and `--check` are mutually exclusive (exit 2).
  - `--check` drift exits 1 (`normalizeNewlines`).
  - Warnings go to stderr. `--strict` with warnings exits 3.
  - A missing or unknown subcommand or format prints usage and exits 2.
- **`breadboard import`**:
  `breadboard import <file.kicad_sch|file.net> [--output <file.jsonl>] [--strict]`.
  It follows `drawio import`.
  - It runs `importKicad`, then `layoutBreadboardImport`, and writes JSONL
    to stdout or `--output`. The title is the file base name without its
    extension.
  - Each diagnostic is one stderr line:
    `<severity>: <file>[:<line>:<column>]: <code>: <message>`.
  - An error diagnostic (no plan) exits 1 and writes nothing.
  - `--strict` with any warning exits 3 and writes nothing.
  - A wrong argument count prints usage and exits 2.
- `README.md` CLI tables and the `OVERVIEW` text list `breadboard`
  (including `import`) and the extended `lint`.

## 10. Desktop (apps/desktop)

- Page creation and following: section 7.2.
- `ExportDialog`:
  - A `breadboard` format in the "Diagram source" group, enabled only when
    the active page kind is `breadboard`.
  - Its panel has three buttons: "BOM (CSV)", "KiCad netlist (.net)" and
    "SPICE netlist (.cir)".
  - The new prop `exportBreadboard(kind: "bom"|"kicad"|"spice")` is
    implemented in `App.tsx` like `exportBpmn`: `pickExportPath(name, ext)`
    and `writeText`, with the Blob download fallback.
  - Formatter warnings are shown in the dialog's existing error/notice
    area.
- The problems panel is mounted on `breadboard` pages (section 7.2), next to
  `BpmnProblemsPanel` (`App.tsx:1481`), with
  `importWarnings={file().importWarnings}`.
- **Open/import flow** (`apps/desktop/src/file/session.ts`, following the
  draw.io branch):
  - `isKicadPath` matches `.kicad_sch` and `.net`, case-insensitively.
  - It lazily imports `importKicad` from `@nodetto/io/kicad` and
    `layoutBreadboardImport` from `@nodetto/core`.
  - With a plan, it calls `importDocument(document, baseName(path),
    warnings)`. Each diagnostic becomes
    `{element, message: "<code>: <message>"}`, where `element` is the
    diagnostic's reference, else `<line>:<column>`, else the file name.
    The import is detached, so autosave never rewrites the KiCad file.
  - Without a plan, it calls `fail("could not import <name>: <first error
    message>")`.
  - The opened document's page is a `breadboard` page, so the existing
    page-following selects the breadboard workspace (section 7.2).
- **Rust**: `OPEN_FILTER_EXTENSIONS` in `apps/desktop/src-tauri/src/dialogs.rs`
  gains `kicad_sch` and `net`, with a unit test `open_filter_includes_kicad`
  next to `open_filter_includes_drawio`. This is the only Rust change. Run
  `cargo fmt` and `CARGO_TERM_QUIET=true cargo test` for it. No
  `tauri.*.conf.json` file association is added (section 2). Export
  extensions stay free-form (section 1).

## 11. Example, docs and tests

**Example**: `examples/breadboard/led-button.jsonl` plus a `README.md`.
- One half board, BT1 `5V` in the top rails, SW1 across the channel, R1
  `220` and D1 red LED, with wires from `T+` to SW1 and from D1's cathode
  strip to `T-`.
- Expected results:
  - `nodetto-cli lint` exits 0 with no findings.
  - The nets are `GND`, `VCC` and two `N_*` nets.
  - The BOM has 4 rows.
- Golden outputs:
  - `examples/breadboard/led-button.bom.csv`
  - `led-button.net`
  - `led-button.cir`

**KiCad fixtures** (`test-fixtures/kicad/`), each hand-written for nodetto
and a few dozen lines long, plus a `README.md` that states this
provenance:
- `led-button.kicad_sch`: the example's circuit as a schematic.
  - It has `lib_symbols` for `R`, `LED`, `SW_Push` and `Battery` with
    named pins.
  - It has `+5V` and `GND` power symbols, one `PWR_FLAG`, one local label
    and one junction on a T.
  - One symbol is rotated 90 degrees and one is mirrored, so the pin
    transform is covered.
- `led-button.net`: the same circuit as a KiCad-style netlist, with
  `libparts`, `pinfunction` and one single-node net.
- `unknown-symbols.net`: covers the fallback and skip paths.
  - an `L1` two-pin symbol, which becomes a header
  - an 8-pin `U1`, which becomes an IC
  - a 0-pin symbol, which is skipped
  - a non-numeric pin `A1`, which is unmapped
  - a duplicate reference
- `malformed.kicad_sch`: an unterminated string and unclosed lists.
- `legacy.sch`: a single `EESchema Schematic File Version 4` header line.

No KiCad demo, QA file or library symbol is committed. The `lib_symbols`
in the fixture are minimal pin-only definitions written for the test.

**Docs**:
- `docs/breadboard/format.md`: the types, a sample record per type, the
  lattice and the hole ids.
- `docs/breadboard/erc-rules.md`: one row per rule (ERC and parity),
  starting ``| `<rule-id>` |``.
- `docs/breadboard/kicad-import.md`: the supported subset (section 8.6),
  the symbol mapping table, the staging layout, the diagnostic codes, and
  the CLI and desktop entry points.
- A `README.md` section on breadboard pages.
- ASCII only.

**Tests** (colocated `*.test.ts`, one line each):
- **ir**:
  - per-type `validateSemantic`, including odd `pinCount` and short wires
  - `parseComponentValue`
  - the pinned lists and the golden file (section 3.6)
  - pre-existing fixtures unchanged
- **core**:
  - catalogue pin tables and boxes
  - board layouts: hole counts 830, 400 and 170, strip membership, rail
    gaps
  - lattice snap
  - rotation keeps pin 1 and all pins on the lattice at 0, 90, 180 and 270
  - parameter edits keep pin 1
  - board move carries its contents
  - connectivity: strips, rails, channel split, mini board without rails,
    rotated parts, wire ends on off-board pins, button bonds, hidden
    elements ignored
  - netlist ordering and naming
  - annotation on create and paste, and duplicate fixing
  - one positive and one negative test per ERC rule
  - resistor bands: 4-band `220` red red brown gold, `4.7k` yellow violet
    red gold, `1M` brown black green gold, `0.47` yellow violet silver gold;
    5-band `10k` 1% brown black black red brown; 20% gives no tolerance
    band; `4k7` RKM; `0` gives black; unrepresentable gives `null`
  - notation roles per type
  - SVG export of the example: 400 `breadboard-board-hole`, 4
    `resistor-band-*`, 1 `led-flat`, wire count, and labels outside the
    rotation group
  - `breadboard/export-golden.test.ts`: the example document, then core
    connectivity, then the io formatters, compared byte for byte with the
    three golden files. It lives in core because only core can import both
    (as `bpmn/docs-example.test.ts` does).
  - docs: the ERC rule table ids equal `BREADBOARD_ERC_RULE_IDS`, and
    `format.md` names every type
  - ratsnest: no target gives no lines; a staged import gives
    (resolved nodes - nets) lines; routing one net removes exactly its
    lines; nearest-pin and tie-break order; a move changes the lines
  - one positive and one negative test per parity rule, including the
    button bond-twin case, `4k7` equal to `4.7k`, an inert second netlist
    card, and a duplicate reference left to rule 7
  - `layoutBreadboardImport`: ids, positions on the lattice, row wrap at 66
    pitches, staging below the board, and byte-stable output
  - `breadboard/kicad-golden.test.ts` (core, because it needs io and core):
    - importing each `led-button.*` fixture, then linting the example page
      with that target added, gives no parity findings
    - importing the example's own `led-button.net` golden gives a target
      with the example's references, values and net partition, and the
      example's own net names (round trip of section 8.3)
    - the fixtures are authored to match the example's references, values
      and pin orientation, so the comparison is exact up to net names
    - starting from `layoutBreadboardImport` of the fixture, moving the
      parts to the example positions and adding the example wires drops
      the ratsnest to zero lines and rule 9 to zero findings
  - cross-probe sets: `elementIds` for rules 3, 9 and 10, and
    `breadboardNetMembers`
- **io**:
  - each formatter on hand-built `BreadboardNetlist` values: CSV quoting,
    S-expression escaping, SPICE suffixes, potentiometer split, unparseable
    value warning
  - D2 skip warning and Mermaid skip
  - `sexpr.ts`: atoms, quoted strings and escapes, positions, every
    recovery diagnostic, the depth limit, and a random-bytes smoke test
    that must not throw
  - `schematic.ts`: the `led-button.kicad_sch` parts, values and net
    partition; the rotation and mirror pin transform; labels, power
    symbols, `PWR_FLAG` ignored, junction and T connection, crossing wires
    not joined; the multi-unit merge; `kicad.bus`, `kicad.hierarchicalSheet`
    and `kicad.missingLibSymbol`; `malformed.kicad_sch` gives warnings and a
    plan; `legacy.sch` gives `kicad.legacyFormat` and no plan
  - `netlist.ts`: `led-button.net`; `unknown-symbols.net` diagnostics; nodes
    of non-components dropped; single-node nets kept
  - `symbol-map.ts`: one test per table row, including LED and diode pin
    names, transistor `pinout`, the `SW_Push` 1 to 1 and 2 to 3 map, and the
    fall-through to row 14
- **collab**: section 8.5.
- **ui-solid**:
  - palette `creationFor` entries and the workspace tool list
  - `r`/`Shift+R` rotation only on breadboard selections
  - wire tool point capture
  - problems panel rows (ERC, parity and import warnings) and the fix
    action
  - inspector edits through `updateBreadboardSemantic`
  - net highlight target selection, including the probe target
  - `focusBreadboardProbe` for each row of the section 7.5 table
  - the ratsnest overlay draws one line per `RatsnestLine` and is absent
    from SVG export
- **cli**:
  - `lint` on breadboard, mixed and neither documents, with exit codes and
    the JSON `pin` key
  - `breadboard bom`/`netlist`: `--output`, `--check` drift and match,
    `--strict`, and usage errors
  - `breadboard import`: both fixtures to JSONL that validates, stderr
    diagnostic lines, exit 1 on `legacy.sch`, exit 3 with `--strict` on
    `unknown-symbols.net`, and `--output`
  - `lint` on a freshly imported document exits 1, with both
    `pin-not-in-hole` and `parity-missing-connection` findings present
- **desktop**: export dialog enablement per page kind, and `exportBreadboard`
  writes through the backend. `session.test.ts` opens a `.kicad_sch` and a
  `.net` fixture as detached imports with notes, and an invalid file as a
  failure.
- **Rust**: `open_filter_includes_kicad` in `dialogs.rs`.

### 11.1 Test ownership

BPMN section 11.1 applies unchanged: each slice owns at least one test
file, pinned lists have one owner, and the parallel-wave gate is in force.
Audit of the existing tests and fixtures this design touches:

| existing test / fixture | change | owner |
|---|---|---|
| `packages/ir/src/registry.test.ts` | +13 types | ir slice |
| `packages/io/src/jsonl/golden.test.ts`, new `__fixtures__/breadboard.jsonl` | `GOLDEN` gains `breadboard` | ir slice |
| `packages/collab/src/test-fixtures.ts` (`ydoc.test.ts` loops without a count) | gains a fixture | io-and-collab slice |
| `packages/ui-solid/src/workspaces.test.ts`, `interaction.test.ts` | lists pin other workspaces only; `TOOL_KEYS` is unchanged | ui slice; left unedited unless a list is found pinned, in which case extend it in the ui slice |
| `apps/cli/src/native-parity.test.ts` | picks up the new fixture automatically (skipped without a binary) | none |
| `apps/cli/src/mcp*.test.ts` | derived from `COMMAND_HELP` | none |
| `packages/io/package.json` `exports` | gains `./kicad` | io-kicad slice |
| `apps/desktop/src/file/session.test.ts` | gains KiCad open cases | desktop slice |
| `apps/desktop/src-tauri/src/dialogs.rs` tests | gains `open_filter_includes_kicad` | desktop slice |

## 12. Implementation slicing

1. **ir**: page kind, semantics, registry (13 types including
   `breadboard.netlist`), `breadboard.ts` (value parsing, netlist model,
   import plan and diagnostics), pinned lists and the golden file.
2. **core geometry**: `catalogue.ts`, `board.ts`, shape utils, `snap.ts`,
   `rotate.ts`, the Editor intents (`createBreadboardPart`,
   `rotateBreadboardParts`, `updateBreadboardSemantic`), board-carry
   translation.
3. **core connectivity, annotation and ERC**: `connectivity.ts`
   (`toBreadboardNetlist`, highlight), `annotate.ts` with the paste hook,
   `erc.ts`.
4. **core notation and SVG export**: `notation.ts`, `resistor-bands.ts` and
   the `svg-export.ts` branch.
5. **io and collab**: the three formatters (with the catalogue part names
   of section 3.4), the D2 skip, the Mermaid test, the collab fixture and
   tests.
6. **io KiCad import**: `sexpr.ts`, `schematic.ts`, `netlist.ts`,
   `symbol-map.ts`, `importKicad`, the `./kicad` export, the
   `test-fixtures/kicad/` fixtures and their io tests.
7. **core ratsnest, parity and import layout**: `ratsnest.ts`,
   `parity.ts` (wired into `lintBreadboardPage`), `breadboardNetMembers`,
   `import-layout.ts`.
8. **ui-solid**: views (including the netlist card), highlight and
   ratsnest overlays, workspace, palette, wire tool, keys, inspector,
   problems panel, cross-probing and export-dialog format.
9. **cli**: `lint` extension and the `breadboard` command, including
   `import`.
10. **desktop**: page following, `exportBreadboard`, panel mounting, the
    KiCad open flow and the `dialogs.rs` filter.
11. **example, docs and golden outputs**: the example, its golden files,
    `export-golden.test.ts`, `kicad-golden.test.ts`, docs, README and
    final verification.

Dependencies:
- 1 comes before everything else.
- 2 comes before 3 and 4. 3 and 4 run in parallel. 5 and 6 run in parallel
  with 2 to 4, since they need only the ir model.
- 7 needs 3 (connectivity and ERC) and 2 (catalogue boxes).
- 8 needs 2 to 5 and 7. 9 needs 3, 5, 6 and 7. 10 needs 6, 7 and 8.
- 11 comes last.

File ownership for parallel slices: `erc.ts` belongs to slice 3, and
slice 7 only adds `parity.ts` plus one call site in `lintBreadboardPage`
after slice 3 has landed. `packages/io/src/index.ts` and
`packages/io/package.json` belong to slice 6 for the KiCad entries and to
slice 5 for the formatter entries. The two slices touch disjoint lines, and
slice 6 lands second.

Final gate: `bun run typecheck`, `bun test packages`, `mise run lint` and
`CARGO_TERM_QUIET=true mise run verify`, each run in the foreground with
its exit status and log path recorded.

## 13. Intentional divergences

- Pins snap to a global 0.1 in page lattice, and boards are lattice-aligned
  too. KiCad's grid is configurable. A single fixed lattice makes
  connectivity a point lookup.
- Rotation keeps pin 1 in place (KiCad rotates about the cursor or anchor).
  Boards are not rotatable in the editor.
- A wire end on an off-board part pin is a valid connection, and rule 8
  reports only ends that touch neither a hole nor a pin. This lets a
  battery sit beside the board.
- Rule 2 uses "same net", which also covers "same strip".
- The netlist and SPICE model the push button as open. The SPICE file does
  not define IC subcircuits.
- Net names (`GND`, `VCC`, `N_<ref>_<pin>`) and footprint names
  (`nodetto:*`) are our own, not KiCad's conventions.
- The ERC has no config file and no severity overrides.
- The schematic importer uses its own connectivity rules (section 8.6.2):
  any point on a wire, interior included, connects to it, and crossing
  interiors never join. Hidden power pins are ordinary pins and connect
  only by geometry. Only the root sheet is read.
- Parts that do not map are approximated as a DIP IC or a single-row
  header, so their connections can still be checked. KiCad would keep the
  real symbol.
- The target netlist is a visible, deletable card element, not hidden
  project data. Parity matches by reference only, with no UUID or
  timestamp matching.
- Parity missing-work rules are warnings, so they never fail `lint` by
  themselves. Only a connection that merges target nets is a parity error.
  An import with staged parts still fails `lint` (exit 1) through rule 1
  `pin-not-in-hole` until its parts are placed (user-QA Q9).

## 14. Risks

- **Connectivity correctness** drives ERC, highlighting and the netlists.
  It is mitigated by the per-case connectivity tests and the golden
  pipeline test.
- **The polarity and series-resistor heuristics** can give false negatives,
  for example with parallel resistors. They are designed never to report
  when polarity cannot be determined.
- **KiCad compatibility** is structural only. No KiCad binary is available
  to tests, so the golden file pins our own output.
- **Shared editor paths** (paste, move gesture, `Editor.apply` planner,
  `App.tsx` workspace following) are changed behind breadboard-type and
  page-kind guards. The existing tests must pass unchanged.
- **Older builds** cannot open `breadboard` pages (Q6).
- **Untrusted KiCad input**: the reader is iterative with a depth limit
  and never throws. A random-bytes smoke test guards it. Real KiCad files
  can contain constructs outside the subset. These give diagnostics, not
  failures.
- **The pin transform and the mapping table** are checked against
  hand-written fixtures only, since no KiCad binary or real library is
  available to tests. A transform-order mistake would misplace pins in
  rotated or mirrored real-world symbols. It is mitigated by explicit
  rotation and mirror cases in the fixture.
- **Live recomputation**: connectivity, ratsnest and ERC run per store
  revision during drags. Highlight and ratsnest are memoised per revision,
  and the problems panel is debounced at 300 ms.
- **License contamination**: reviewers check that the reader, importers,
  rule texts and fixtures are original (section 1).
