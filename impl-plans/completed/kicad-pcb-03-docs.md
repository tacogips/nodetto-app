# kicad-pcb-03-docs

- planId: kicad-pcb-03-docs
- planPath: impl-plans/completed/kicad-pcb-03-docs.md
- wave: 1; dependsOn: none
- design: design-docs/specs/design-kicad-pcb.md sections 3, 4.3, 5, 6.4,
  7.3, 8, 9, 10, 13, 15; user QA defaults
  design-docs/user-qa/kicad-pcb.md
- progress log: impl-plans/progress/kicad-pcb-03-docs.md
- protocol: impl-plans/completed/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Write the user documentation for PCB pages from the accepted design, using
the exact command syntax, file names and messages it pins. The code lands
in later waves. Reconciliation checks that the docs and code agree.

## Repository context (imitate tone and layout)

- `docs/pcb/gerber-import.md`: short sections, tables, plain English.
- `docs/breadboard/kicad-import.md` and `docs/breadboard/pcb.md`.
- `docs/cli.md`: one example block per command family.
- `README.md` line 29 area: the feature list (one bullet per feature).

## Non-goals

- No screenshots or images.
- No edits to other docs, help text or code.
- Do not promise features the design leaves out of scope (KiCad write-back,
  autorouting, refill, DRC, inner-layer Gerbers, footprint flip, new nets).

## writePaths

- docs/pcb/kicad-pcb.md (new)
- docs/cli.md
- README.md
- impl-plans/progress/kicad-pcb-03-docs.md (new)

## sharedPaths

none

## Content of `docs/pcb/kicad-pcb.md`

1. What it does, with two commands:
   `nodetto-cli pcb import board.kicad_pcb --output board.jsonl` and
   `nodetto-cli pcb gerber board.jsonl --output board.zip`. The desktop
   Open dialog accepts `.kicad_pcb` and opens it as a new unsaved document
   (the KiCad file is never written).
2. Supported files: KiCad 5 to 9 board files (`version` 20171130 and
   later). Older versions are read with a warning, and legacy non
   s-expression files are refused. List what is read: footprints (KiCad 5
   `module`), pads (shapes circle, rect, oval, roundrect, trapezoid, custom
   with polygon primitives; drills, including oval slots and offsets),
   nets, tracks including arc tracks, vias, zones (outline and filled
   polygons as stored by KiCad), Edge.Cuts lines, arcs, circles,
   rectangles and polygons, silkscreen and fabrication text and graphics.
   List what is skipped with a warning: dimensions, targets, images, text
   boxes, rule areas, non-polygon pad primitives, 3D models, and groups
   (only the grouping is dropped; their members are read).
3. The page: units are millimetres; 10 page units per mm; the board is
   drawn as KiCad shows it. Colours: top copper red, bottom copper blue,
   inner copper amber, silkscreen pale yellow, Edge.Cuts light grey.
4. Editing:
   - select, drag or nudge footprints, tracks, vias, zones and graphics
   - `R` rotates selected footprints by 90 degrees
   - track ends inside a moved footprint's pads follow it
   - the Track tool: click to start, click for each corner, double click
     or Enter to finish, Esc to cancel; the net comes from the pad, track
     or via you start on
   - the Via tool
   - width, layer and net in the inspector
   - Delete
   - hover to highlight a net; "Select net" in the inspector
   - dashed ratsnest lines show pads of one net that copper does not join
   - layer checkboxes (not saved with the document)
   - not available: autorouting, zone refill, design rule checks, flipping
     a footprint, creating nets, writing back to KiCad
5. Saving: the page is saved in Nodetto JSONL with all KiCad data, and
   reloads identically. Describe the six element types and their main
   fields in a table (design 3.2).
6. Gerber export:
   - the file set: `<name>.GTL`, `.GBL`, `.GTS`, `.GBS`, `.GTO`, `.GBO`
     (only with bottom silkscreen), `.GKO`, `.DRL`, `<name>-NPTH.DRL`
     (only with non-plated holes)
   - Gerber X2 with millimetres; drill coordinates at 0.001 mm
   - origin at the bottom-left of the Edge.Cuts outline
   - vias are tented
   - only F.Cu and B.Cu are exported
   - zone fills are exported as read
   - text uses Nodetto's stroke font
   - warnings, verbatim from design 7.3:
     `The board has inner copper layers (<names>); only F.Cu and B.Cu are exported.`
     and `Zone on <net> has no fill; refill it in KiCad.`
   - the note `Zone fills are exported as read from the KiCad file; they are not refilled after edits.`
   - the desktop Export dialog has a PCB tab, "Gerber and drill (.zip)"
7. Commands: the full syntax of `pcb import <file.kicad_pcb> [--output
   <doc.jsonl>] [--strict]` and `pcb gerber <doc.jsonl> --output <file.zip>
   [--page <page>] [--strict]`; the summary line `Board <w> x <h> mm: <f>
   footprints, <p> pads, <t> tracks, <v> vias, <z> zones, <n> nets.`; exit
   codes 0, 2 and 3 (`--strict` with warnings).
8. Limits: the angle conventions (pad and text angles in the file are
   board-absolute; bottom-side footprints are stored mirrored by KiCad);
   large boards are slower in the native CLI.

## `docs/cli.md` and `README.md`

- `docs/cli.md`: add a "PCB boards (KiCad)" block with the two commands
  next to the Gerber import block, and link `pcb/kicad-pcb.md`.
- `README.md`: one feature bullet, for example `- **PCB boards**: open a
  KiCad .kicad_pcb board, move parts and edit tracks and vias, and export
  Gerber and drill files ([docs](docs/pcb/kicad-pcb.md)).` Match the
  existing bullet style exactly.

## Pitfalls

- English only, no emojis, ASCII only.
- Do not copy wording from KiCad documentation.
- Keep the README change to one bullet.

## Verification

1. `LC_ALL=C grep -cP '[^\x00-\x7F]' docs/pcb/kicad-pcb.md` prints 0.
2. `grep -c "pcb import\|pcb gerber" docs/cli.md` is at least 2.
3. `grep -c "kicad-pcb.md" README.md docs/cli.md` shows at least 1 per
   file.
4. `bunx biome check docs/pcb/kicad-pcb.md` is not applicable (biome does
   not check Markdown); record "n/a".
5. `git diff --stat -- README.md` shows at most 2 changed lines.

## Done criteria

- The three files are written; steps 1-3 and 5 are recorded with the
  expected results.
