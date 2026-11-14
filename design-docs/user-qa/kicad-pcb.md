# User QA: PCB pages from KiCad boards

These questions concern design-docs/specs/design-kicad-pcb.md. Each has a
default. Implementation goes ahead with the default unless the user overrides
it.

## Q1. Is layer visibility saved in the document?

- Default: no. Layer visibility is transient UI state per page, like the net
  highlight. Toggling a layer never changes the document or the undo
  history, and every layer is shown when the document is opened again.
- Alternative: store `hiddenLayers: string[]` on the `pcb.board` element, so
  the choice is saved and undoable.

## Q2. Inner copper layers in the Gerber export

- Default: boards with inner copper layers import fully (the data is kept),
  but `pcb gerber` writes only F.Cu and B.Cu and warns that the inner layers
  are left out. `--strict` then exits 3.
- Alternative: refuse to export boards with inner copper (exit 2), until a
  multi-layer writer exists.

## Q3. Extra files beyond the breadboard file set

- Default: the archive uses the breadboard names (GTL, GBL, GTS, GBS, GTO,
  GKO, DRL) and adds `GBO` only when the board has bottom silkscreen and
  `<name>-NPTH.DRL` only when it has non-plated holes.
- Alternative: never write GBO (drop bottom silkscreen) and put non-plated
  holes in the plated DRL file.

## Q4. Zone fills after editing

- Default: zone fills are exported exactly as read from the KiCad file, with
  a note saying they are not refilled. Moving copper through a pour can
  therefore leave stale fills; the user refills in KiCad.
- Alternative: leave zone fills out of the Gerber export once any copper item
  on the page has been edited (this needs an "edited since import" marker).

## Q5. Track drawing angles

- Default: the Track tool places vertices freely (snapped only to the pad,
  via or track end under the pointer).
- Alternative: constrain segments to 45-degree directions, as KiCad does by
  default.
