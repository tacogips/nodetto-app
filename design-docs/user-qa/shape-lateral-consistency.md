# Shape lateral consistency: open questions

Design: `design-docs/specs/design-shape-lateral-consistency.md`. None of these
questions block implementation. Each one has a default that the design
follows until a user decides otherwise.

## Q1. Geo stick figure label placement

Default: the existing geo label rule applies (centred in the box, the same as
`person`). draw.io `umlActor` and `usecase.node` actor put the name below the
figure instead.

Question: should `shape.geo` `actor` reserve a label band under the figure?
That would need a new geo label layout in the canvas, SVG export and handoff.

## Q2. Native element types from draw.io import

Default: draw.io import keeps its freeform model (geo, text, frame, generic
connector).

- `umlActor` becomes geo `actor` exactly.
- `shape=component`, `requiredInterface` and `umlLifeline` stay
  approximated, as today.
- A `usecase.node` or `uml.component` exported to draw.io comes back as a
  freeform shape, not as the original element type.

Question: should draw.io import rebuild native `usecase.node`,
`uml.component`, `uml.interface` and `sequence.participant` elements?

## Q3. Sequence participants in draw.io export

Default: unchanged. Participants and messages have no fixed geometry and are
skipped with a warning.

Question: should export lay out lifelines (`shape=umlLifeline`, with
`participant=umlActor` for actors) from the sequence layout?

## Q4. Remaining approximate draw.io imports

Default: `ext` (double rectangle) and the 4/6/8-point stars stay
approximated, because nodetto has no native equivalent.

Question: should geo kinds be added for them?

## Q5. Arrowheads on open `draw.path` contours

Default: open contours are a plain stroke with no fill and no arrowheads.

Question: should open paths take start and end arrowheads like connectors?

## Q6. Open contours in generated code

Default: the handoff CSS mask and the Swift/Compose generators use closed
contours only, so open contours are left out of generated code.

Question: should they emit stroked paths for open contours?

## Q7. Open/closed toggle in the path inspector

Default: there is no toggle. Open contours come from documents, the CLI or
imports. The inspector and the canvas handles keep each contour's existing
`closed` flag, and "Add contour" adds a closed contour.

Question: should the Vector path inspector offer an open/closed switch for
each contour?
