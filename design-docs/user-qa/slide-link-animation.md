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

## Phase 2 (design-docs/specs/design-slide-transition-settings.md)

Q3 above is superseded for per-slide timing: Phase 2 stores an optional
duration per slide in `visual.animation.slide` (Q7; no Command change).

## Q7. Where per-slide settings are stored (section 3.1) - RESOLVED by the intake fallback

- Fact (Step 3 review diagnostic, `parseAuthoringBatch` in
  `nodetto-cloud/workers/sync/src/authoring.ts:167-172,197-200`): the
  hosted authoring parser allows only `name`, `kind`, `tokenMode` and
  `order` in `updatePage.page` and rejects `transition` with HTTP 400
  `invalid_commands`. It already rejects `slideOrigin` and
  `hiddenInPresentation` the same way. `updateVisual` / `replaceVisual`
  with `visual.animation` are accepted.
- Decision (no scope change; the intake says "if Page fields cannot pass
  the Worker unchanged, store per-slide settings somewhere that does"):
  per-slide settings are stored as `visual.animation.slide` on one
  artwork-free `presentation.slide` resource element per page (the
  `design.guide` pattern). It is written with `createElement`,
  `replaceVisual` and `deleteElements`. There is no `Page` field, no
  `updatePage` change and no Worker change.
- Behaviour, with no functionality removed: settings survive deleting all
  artwork (the carrier has no bounds and no hit area, is not in the layer
  tree, and `selectAll` excludes it); empty slides are configurable; each
  edit is one undo step; Duplicate page keeps the carrier; paste and Copy
  shapes from page never transfer it.
- Hosted transport observed accepted by the unchanged Worker parser:
  `updateVisual` / `replaceVisual` with `animation.slide`, and
  `createElement` / `deleteElements` of a `presentation.slide` (Step 3
  diagnostics; spec section 10).
- Local command validation: `packages/core/src/commands.ts` gets
  validation wiring only (spec section 3.3); no Command type or
  `updateDocument` change.
- Owner may still choose later (not needed for this run): add a `Page`
  field once the Worker's `updatePage.page` whitelist accepts it, then
  migrate the carriers.

## Q8. Duration format (section 3.2) - OPEN, default applied

- Default: milliseconds. `animation.slide.durationMs` (100..5000) scales all
  Phase 1 timing by `durationMs / 700`; element `durationMs` (50..5000)
  sets one step.
- Alternative: a unitless speed scale.

## Q9. Exit effect durations (section 5.3) - OPEN, default applied

- Default: `fade-out` 300 ms (Phase 1); `undraw`, `scale-out` and
  `slide-out` 700 ms; exits are not staggered.
- Alternative: all exits 300 ms.

## Q10. Slide direction default (section 3.2) - OPEN, default applied

- Default: `slide-in` comes from the bottom and `slide-out` leaves to the
  bottom when no side is set.

## Q11. Fade mode and size mismatch (section 5.3) - OPEN, default applied

- Default: a size mismatch still cuts, even with mode `fade`.
- Alternative: whole-slide fade between different sizes.
