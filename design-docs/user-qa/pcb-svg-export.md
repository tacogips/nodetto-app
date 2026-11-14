# User QA: PCB Pages in SVG, PNG and PDF Export

Design: `design-docs/specs/design-pcb-svg-export.md`. Each question has a
default that the design implements; answering differently changes only the
named section.

## Q1. What does "explicit export background" mean for a PCB page?

Every caller passes a background today (desktop: transparent for SVG/PNG,
`#ffffff` for PDF; CLI: transparent for SVG, `#ffffff` for PNG/PDF), so the
renderer cannot tell a default from a user choice.

Default: the dark board rect is always drawn over the union of the PCB
element boxes, and the page background (explicit or default) still fills
the whole view box including the padding. The explicit colour is honoured
outside the board; the board area is always dark, so the layer colours
stay readable in every export (section 5).

Alternative: an explicit background replaces the board colour as well.
This needs a way to tell explicit from default (a new option or flag in
the CLI and the desktop dialog) and leaves light silkscreen on a light
background unreadable.

## Q2. Should exports follow the canvas's hidden layers?

Default: no. The hidden-layer set is transient per-page UI state
(`packages/ui-solid/src/pcb-state.ts`, design-kicad-pcb user QA Q1), not
stored in the document, and the CLI has no such state. Exports draw all
layers; `visual.hidden` elements and hidden texts are still skipped
(section 6).

Alternative: pass the desktop's hidden set into the export through a new
`SvgExportOptions` field; the CLI would still draw all layers.

## Q3. Board colour

Default: `PCB_BOARD_COLOR = "#2f4a3a"` (dark green), darker than every
layer colour and lighter than the holes colour `#202020`, so non-plated
holes remain visible. Any other dark value can replace it in the shared
colour table without other changes.
