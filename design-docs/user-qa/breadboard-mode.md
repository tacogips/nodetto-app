# User QA: breadboard circuit pages

These questions concern design-docs/specs/design-breadboard.md. Each has a
default, and implementation proceeds with that default unless the user
overrides it.

Status: the user accepted the defaults of Q1-Q6 when resuming the run
(intake comm-008865). Q7-Q10 were added in design revision 2 for the
KiCad import, ratsnest and parity scope. They also proceed with their
defaults unless the user overrides them.

## Q1. Pin numbering of polarised parts

- Default: pin 1 is the anode (`A`) and pin 2 the cathode (`K`) for LEDs
  and diodes. Pin 1 is `+` for electrolytic capacitors and batteries. SPICE
  writes diodes as `D <anode> <cathode>`, so this order maps directly.
- Alternative: use pin 1 = cathode for diodes, which is common in schematic
  symbol libraries. Only the catalogue table and the golden files change.
- Revision 2 note: the KiCad importer maps LED and diode pins by their
  `A`/`K` names (design section 8.6.4), so a schematic library's numbering
  does not depend on this choice.

## Q2. Rails and board rotation

- Default: each power rail is continuous along the whole board, including
  the full-size board. Boards cannot be rotated in the editor. Parts
  rotate in 90-degree steps.
- Alternative: model full-size boards with rails split at the centre, and
  add a split-rail option or a jumper. This adds rail strips and an ERC
  case.

## Q3. Rotation shortcut

The letter `r` already selects the rectangle tool.

- Default: on a `breadboard` page with a breadboard part selected, `r`
  rotates 90 degrees clockwise (KiCad R) and `Shift+R` rotates
  counter-clockwise. Everywhere else `r` keeps its rectangle-tool meaning.
- Alternative: use a different key that is free everywhere, and leave `r`
  unchanged on all pages.

## Q4. BOM contents

- Default: the BOM lists components only, as KiCad's BOM does. Boards and
  jumper wires are not listed.
- Alternative: add board and wire rows (wires grouped by colour) for
  ordering prototyping supplies.

## Q5. Push button in netlists

- Default: the button is open (not pressed). Its two internally bonded
  pin pairs are two nets. SPICE writes it as a comment line, and IC
  subcircuits are placeholders that are not defined.
- Alternative: emit the switch as a switch-model element, or as a large
  resistor, so the SPICE file simulates without edits.

## Q6. Older builds and `breadboard` pages

- Default: as BPMN Q3. `SCHEMA_VERSION` stays 1. Builds older than this
  change reject a document with a `breadboard` page with `value.enum`.
- Alternative: bump the schema version, which makes every document
  unreadable to older builds.

## Q7. Where the target netlist lives

- Default: a `breadboard.netlist` element drawn as a small "Target
  netlist" card (design section 3.2). It is visible, undoable, synced and
  round-tripped like any element, and deleting it turns parity and the
  ratsnest off. `SCHEMA_VERSION` is unchanged.
- Alternative: a typed page field. This needs new page-record handling in
  the IR, JSONL, editor and collab, and is invisible on the canvas.

## Q8. Parity rule severities

- Default: missing connection, missing part, extra part and value
  mismatch are warnings. A connection that merges two target nets is an
  error. Parity findings alone therefore never fail `nodetto-cli lint`.
  A freshly imported page still exits 1 until every staged part is placed,
  because rule `pin-not-in-hole` is an error and reports each staged pin
  (Q9).
- Alternative: make every parity rule an error, so `lint` fails until the
  breadboard matches the schematic exactly.

## Q9. ERC findings on staged parts

- Default: imported parts start off the board, and rules
  `pin-not-in-hole` and `parity-missing-connection` list them until they
  are placed. That list is the work queue.
- Alternative: suppress `pin-not-in-hole` for parts that have never been
  placed. This needs a stored "staged" marker and is not planned.

## Q10. Desktop entry points for KiCad files

- Default: the desktop open dialog accepts `.kicad_sch` and `.net`, and
  opens them as detached imports (the draw.io precedent). No
  operating-system file association is registered, because `.net` is a
  generic extension. The CLI command is `nodetto-cli breadboard import`.
- Alternative: also register a `.kicad_sch` Open With association at
  Alternate rank, as draw.io files have.
