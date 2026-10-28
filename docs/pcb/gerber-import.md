# Gerber import and export

`nodetto-cli gerber import` draws a printed circuit board's fabrication files
on a freeform page: Gerber RS-274X layers and Excellon drill files, given one
by one or as the ZIP archive sent to a board house.

```sh
nodetto-cli gerber import board-gerbers.zip --output board.jsonl
nodetto-cli gerber import gerber/*.g* gerber/board.drl --into keyboard.jsonl --page-name PCB
```

`--output` writes a new document, `--into` adds the PCB page after the pages of
an existing document, and without either the document is printed. The command
prints the board size and one line per layer. `--strict` exits 3 when a file
needed a warning; unreadable files are skipped with a warning, and the command
fails only when none can be read.

The desktop app's Open dialog does the same for a ZIP archive or a single
Gerber or drill file (`.gbr`, `.ger`, Protel extensions such as `.gtl`,
`.drl`, `.xln`). The board opens as a new unsaved document named after the
file; warnings are listed under **Import notes**, and an archive without
any Gerber or drill file is refused with a message. To draw several loose
files on one page, use the command or put them in a ZIP.

## The page

Each layer is a group named after the layer and its file, for example
`Top copper (board.gtl)`, holding filled vector paths: `Pads` (flashes on
copper, solder mask and paste, otherwise `Flashes`), `Tracks` on copper or
`Lines` elsewhere, and `Zones` on copper or `Regions` elsewhere. The board is
drawn as seen from the top, with 10 page units per millimetre and a 5 mm
margin, on a dark background rectangle that is locked. The reported size
is the outline layer's extent including its line width, or the extent of all
layers when there is no outline.

| Layer | Colour | Shown |
| --- | --- | --- |
| Top copper | red | yes |
| Bottom copper | blue | yes |
| Top silkscreen | pale yellow | yes |
| Drill holes and slots | white (holes show the page) | yes |
| Board outline | light grey | yes |
| Solder masks, solder paste, bottom silkscreen, inner copper | translucent | hidden |

Show a hidden layer from the Layers panel. Solder mask files are negative, so
their paths are the mask openings.

Layers are recognised from the Gerber X2 `.FileFunction` attribute (also in
KiCad's `G04 #@! TF.` comments), otherwise from the file name: Protel
extensions (`.gtl`, `.gbl`, `.gts`, `.gbs`, `.gto`, `.gbo`, `.gtp`, `.gbp`,
`.gko`, `.gm1`, `.g2` and so on), KiCad layer names (`-F_Cu`, `-B_Mask`,
`-F_Silkscreen`, `-Edge_Cuts`, `-In1_Cu`) and Eagle extensions. Excellon files
are recognised by their `M48` header.

## What is read

- Gerber: millimetre and inch units, leading or trailing zero omission,
  circle, rectangle, obround and polygon apertures (with holes), aperture
  macros (circle, vector and centre lines, outline, polygon and thermal
  primitives, variables and arithmetic), linear draws, single and
  multi-quadrant arcs, regions, and dark and clear polarity. A clear object
  removes what earlier objects drew on its layer, as a board house would.
- Excellon: metric and inch, `LZ`/`TZ` and decimal coordinates, the format
  comments of common CAD tools, `G85` slots, routed slots (`G00`, `M15`, `G01`,
  `M16`), and plated or non-plated file attributes.
- Not supported, reported as warnings: step and repeat (`%SR`), block
  apertures (`%AB`), aperture mirroring, rotation and scaling (`%LM`, `%LR`,
  `%LS`), negative image polarity, incremental coordinates, deprecated macro
  primitives and routed arcs (drawn as straight slots).

Curves stay exact Bezier arcs except where clear polarity cuts a shape; there
the shape becomes a polygon within 0.01 mm of the original. A path element
holds at most 1024 contours and 20000 points, so large layers are split over
several paths.

The native `nodetto-cli` runs this geometry in an interpreter, so a large
board (eight layers, 30,000 objects) takes about a minute; the TypeScript CLI
used in development takes a few seconds.

## Editing and exporting the board

An imported page can be edited and written back as Gerber and drill files:
**Export > Gerber > Gerber and drill (.zip)** in the desktop app, or

```sh
nodetto-cli gerber export board.jsonl --output board-edited.zip
```

Each layer group becomes one file again, under the name it was imported from,
drawn from the page as it is now. Moved, resized, rotated and deleted paths
reach the files, and so do paths and basic shapes (rectangles, ellipses and the
other geometric shapes) added to a layer group from the Layers panel. Text,
lines and other elements in a layer group are left out with a warning;
elements outside the layer groups, such as notes on the page, are ignored.
Colours, opacity and hidden layers do not matter: every layer group is
exported.

- Filled areas are written as Gerber regions. Arcs from the imported files stay
  exact arcs; other curves become lines within 0.001 mm. A hole in an area is
  written as a clear region after it.
- The board outline is written as cut lines. Lines and arcs from the imported
  outline go back as the lines they were, with their width. Any other shape in
  the outline group, such as an added rectangle for a cut-out, is cut along
  its edges with the outline's line width, and the export says so.
- Drill shapes are written to an Excellon file as holes and `G85` slots, sized
  from their outline, with the original plating. Draw a new hole as an
  ellipse with equal width and height in the drill group.
- Soldermask files keep their negative polarity, so their shapes stay the mask
  openings.
- The files keep the board's original coordinates. Layer groups remember
  their file and position (the group's `fabricationLayer`); ungrouping a layer
  loses that, and the layer is no longer exported.

Nothing is checked. Moving a track does not move what it connects to, and the
export does not check spacing, connections or drill sizes. Review the files in
a Gerber viewer or the board house's preview before ordering.
