# Slide links and animated transitions: owner decisions

Design: `design-docs/specs/design-slide-link-animation.md`. Nothing here
blocks the work. The design implements each default below. A different
answer changes only the section named in the question.

## Q1. Clipboard paste onto another page (section 3.1) - OPEN, default applied

- Default: no clipboard paste carries a `linkId`, on the same page or on
  another page. Only Duplicate page and Copy shapes from page create links.
- Alternative: a clipboard paste onto a different page than the copy's
  source links the pasted shapes too.

## Q2. Slides of different sizes (section 4.2 rule 1) - OPEN, default applied

- Default: when the two slide rects differ in size (only possible without
  an explicit document slide size), the switch is an instant cut.
- Alternative: scale the outgoing slide into the incoming slide's box and
  animate anyway.

## Q3. Transition timing (section 4.1) - OPEN, default applied

- Default: fixed constants (700 ms moves and entrances, 300 ms fade-out,
  60 ms stagger capped at 480 ms). No document setting, because storing one
  would need a new `Command` kind or a change to `updateDocument`.
- Alternative: a document-level duration once the private sync Worker can
  take a Command change.

## Q4. Jumps (section 6.1) - OPEN, default applied

- Default: only adjacent next/prev animate. Goto, Home and End cut.
- Alternative: animate any slide change between two slides.

## Q5. Going backwards (section 4.2) - OPEN, default applied

- Default: going back plans the previous slide as the target (reverse
  pairing): shapes only on the later slide fade out and shapes only on the
  earlier slide draw on.
- Alternative: play the forward animation in reverse (new shapes "undraw").

## Q6. Linked connectors (section 4.2 rule 4) - OPEN, default applied

- Default: linked connectors crossfade (old fades out, new fades in) and are
  never scaled.
- Alternative: re-grow every connector whose route changed.
