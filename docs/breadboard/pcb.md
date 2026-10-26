# Breadboard PCB export

`nodetto-cli breadboard gerber` and **Export > Breadboard > PCB Gerber and
drill (.zip)** turn one board of a breadboard page into PCB fabrication files.
The ZIP holds Gerber RS-274X files with X2 file attributes and an Excellon
drill file, using the file names board houses such as JLCPCB, PCBWay and
Elecrow recognise. Upload the ZIP as it is.

```sh
nodetto-cli breadboard gerber prototype.jsonl --output prototype-pcb.zip
```

## What the PCB contains

The PCB keeps the breadboard layout, so parts go into the same rows and
columns as on the breadboard and the nets are the breadboard's nets.

- **Outline**: the breadboard's size. A half board is 83.82 x 55.88 mm, a full
  board 167.64 x 55.88 mm and a mini board 50.8 x 40.64 mm.
- **Holes**: every hole a part lead or jumper wire end uses becomes a 1.0 mm
  plated hole with a 1.8 mm pad on both layers. Unused holes are left out.
  Pin 1 of ICs and pin headers has a square pad.
- **Bottom copper**: each breadboard strip (a five-hole column half or a
  power rail) becomes a 0.8 mm trace joining the holes used in it.
- **Top copper**: a wire becomes a 0.5 mm trace when its path, including bend
  points, keeps 0.3 mm from every pad and trace on another net and from the
  board edge. Wires are tried in layer order.
- **Silkscreen**: the breadboard's row letters, column numbers and rail
  polarity, an outline and reference for each part (transistors also show
  their pinout, for example `Q1 EBC`), `+` beside LED anodes and the positive
  lead of electrolytic capacitors and batteries, `K` beside diode cathodes,
  and the path of every wire left as a jumper.

| File | Layer |
| --- | --- |
| `<name>.GTL` | Top copper |
| `<name>.GBL` | Bottom copper |
| `<name>.GTS` / `<name>.GBS` | Top and bottom solder mask (negative) |
| `<name>.GTO` | Top silkscreen |
| `<name>.GKO` | Board outline |
| `<name>.DRL` | Plated through holes (Excellon, millimetres) |

`<name>` is the output file name without `.zip` in the CLI and the page name in
the desktop app. Coordinates are millimetres with the origin at the board's
bottom-left corner, as seen from the top. Board rotation on the page does not
change the files.

## Ordering

Choose 2 layers, 1.6 mm thickness and the board size above; the other defaults
of a standard order fit these files. Line widths and text are within common
minimums (0.18 mm silkscreen lines, 1.0 mm text, 0.3 mm copper clearance).

The export makes a bare board. Solder the parts into the holes shown by their
outlines, then solder a wire along each silkscreen jumper line. The CLI and the
export notes report how many wires became traces and how many are jumpers.

## Warnings

The CLI prints these as `warning:` lines and exits 3 with `--strict`; the
desktop app lists them in the export notes.

- A part with no lead in this board's holes, or with some leads outside them,
  is left off the PCB.
- A wire with an end outside this board is left off the PCB.
- Two leads in one hole: a plated hole takes one lead, so move one of them to
  another hole in the same strip. A wire that becomes a trace needs no hole of
  its own.
- Reference characters other than letters, digits, `+`, `-` and spaces are not
  drawn on the silkscreen.

## Choosing a board

With several boards on a page, pass `--board` with the board's element id or a
unique prefix of it; the CLI lists the boards when it is missing. In the
desktop app, select the board before exporting.
