# KiCad PCB boards

Nodetto opens `.kicad_pcb` boards as editable PCB pages. In the desktop app,
choose a board in the Open dialog; it opens as a new unsaved document and the
source board is not changed. The command line can also import a board and
export Gerber and drill files:

```sh
nodetto-cli pcb import board.kicad_pcb --output board.jsonl
nodetto-cli pcb gerber board.jsonl --output board.zip
```

## Supported content

Boards from versions 5 to 9 are supported. Files with version numbers before
20171130 are read with a warning. Legacy board files that are not
s-expressions are refused.

Nodetto reads footprints (including version 5 `module` entries), pads, nets,
tracks and arc tracks, vias, zones with their stored outlines and fills,
Edge.Cuts lines, arcs, circles, rectangles and polygons, plus silkscreen and
fabrication text and graphics. Pad support includes circle, rectangle, oval,
round rectangle, trapezoid and custom polygon shapes. Drill holes include oval
slots. A pad's drill offset moves the pad's copper, mask and paste shapes; the
hole stays at the pad position, as in KiCad.

Dimensions, targets, images, text boxes, rule areas, non-polygon pad
primitives and 3D models are skipped with a warning. Group membership is
dropped with a warning, while the group's supported members are still read.

## The page

PCB geometry is stored in millimetres and shown in the same orientation as on
the board: 10 page units equal 1 mm.

| Content | Colour |
| --- | --- |
| Top copper | red |
| Bottom copper | blue |
| Inner copper | amber |
| Silkscreen | pale yellow |
| Edge.Cuts | light grey |

## Editing

Select and drag or nudge footprints, tracks, vias, zones and graphics. Press
`R` to rotate selected footprints by 90 degrees. Track ends inside a moved
footprint's pads follow the pads. Use the Track tool to click a start point and
each corner, then double-click or press Enter to finish; press Esc to cancel.
The track's net comes from the pad, track or via at its start point. The Via
tool adds vias. Set track width, layer and net in the inspector, and use
Delete to remove selected items.

Hover over an item to highlight its net, or choose **Select net** in the
inspector. Dashed ratsnest lines show same-net pads that are not joined by
copper. Layer checkboxes control visibility for the current session and are
not saved with the document.

PCB pages do not support autorouting, zone refill, design rule checks,
footprint flipping, creating nets or writing changes back to a `.kicad_pcb`
file.

## Saving

The page is saved as Nodetto JSONL and reloads with the same PCB data. The six
PCB element types store:

| Type | Main fields |
| --- | --- |
| `pcb.board` | Source file, version, board thickness, layer table and net names |
| `pcb.footprint` | Reference, value, library, position, rotation, side, pads and graphics |
| `pcb.track` | Layer, width, net, points and optional arc midpoint |
| `pcb.via` | Position, diameter, drill, layer pair and net |
| `pcb.zone` | Layers, net, outline and stored filled polygons |
| `pcb.graphic` | Layer, width, fill and shape |

## Gerber and drill export

The desktop Export dialog has a PCB tab with **Gerber and drill (.zip)**.
Export uses the Edge.Cuts outline and places the origin at its bottom-left
corner. It writes Gerber X2 in millimetres; drill coordinates use 0.001 mm
precision.

| File | Contents |
| --- | --- |
| `<name>.GTL`, `<name>.GBL` | Top and bottom copper |
| `<name>.GTS`, `<name>.GBS` | Top and bottom solder mask |
| `<name>.GTO`, `<name>.GBO` | Top silkscreen; bottom silkscreen only when present |
| `<name>.GKO` | Board outline |
| `<name>.DRL` | Plated drills |
| `<name>-NPTH.DRL` | Non-plated drills, only when present |

Only F.Cu and B.Cu are exported. Vias are tented. Zone fills are exported as
stored, and text uses Nodetto's stroke font.

The exporter reports these warnings when applicable:

```text
The board has inner copper layers (<names>); only F.Cu and B.Cu are exported.
Zone on <net> has no fill; refill it in KiCad.
```

Zone fills are exported as read from the KiCad file; they are not refilled
after edits.

## Command reference

```text
nodetto-cli pcb import <file.kicad_pcb> [--output <doc.jsonl>] [--strict]
nodetto-cli pcb gerber <doc.jsonl> --output <file.zip> [--page <page>] [--strict]
```

`pcb import` creates a new JSONL document, or prints it when `--output` is
omitted. Its summary has this form:

```text
Board <w> x <h> mm: <f> footprints, <p> pads, <t> tracks, <v> vias, <z> zones, <n> nets.
```

`pcb gerber` writes a ZIP for the selected PCB page. If the document has more
than one PCB page, use `--page` to choose one. `--strict` exits with code 3
when warnings are reported. Exit codes are 0 for success, 2 for usage or
input errors, and 3 for strict-mode warnings.

## Limits

Pad and text angles in the board file are absolute to the board. Bottom-side
footprint geometry is stored as mirrored by the board format. These angle
conventions are assumed by the importer and have not been verified against
boards from the original application. The native command line can take longer
on large boards.
