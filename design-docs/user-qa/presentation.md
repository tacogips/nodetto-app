# Presentation mode: owner decisions

Design: `design-docs/specs/design-presentation.md`. Nothing here blocks the
work. The design implements each default below. A different answer changes
only the section named in the question.

## Q1. Empty page slide (section 5) - OPEN, default applied

- Default: an empty page that is not hidden is still a slide. It shows a
  blank white slide and counts in `n / total`. Only flagged pages are
  skipped.
- Alternative: skip empty pages automatically.

## Q2. Flag name (section 2) - OPEN, default applied

- Default: `hiddenInPresentation` (boolean) in the IR and the JSONL page
  record. It is canonically ordered after `connectorRouting`.
- Alternative: `skip`. This is shorter, but it is ambiguous next to other
  page features.

## Q3. Artboard rule (section 4.4) - OPEN, default applied

- Default: a page with exactly one effectively visible frame is fitted to
  that frame. "Effectively visible" means neither the frame nor any group or
  frame ancestor is hidden.
  Any other page is fitted to its content bounding box.
- Alternative: always use the content bounding box, or use the first frame
  in z-order.

## Q4. End of deck (section 4.2) - OPEN, default applied

- Default: Next on the last slide does nothing. There is no
  "end of slide show" screen and no wrap.
- Alternative: show a black "End of slide show" screen, where the next Next
  exits.

## Q5. Slide backing color (section 5) - OPEN, default applied

- Default: a white slide on a black letterbox. Artboards draw their own
  frame fill over the white.
- Alternative: use the editor canvas color (`#f6f4ee`) as the slide backing.

## Q6. Undo for the flag (section 3) - OPEN, default applied

- Default: toggling the flag is a normal undoable `updatePage` edit and
  marks the document dirty.
- Alternative: make it a view-only preference, which means it is not saved.
  That would contradict the request to store it in JSONL.
