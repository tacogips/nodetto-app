# Slide area and Copy shapes: owner decisions

Design: `design-docs/specs/design-slide-area-copy-shapes.md`. Nothing here
blocks the work, because the design implements each default below. A
different answer changes only the section named in the question.

## Q1. New Command kind `updateDocument` (section 3.1) - OPEN, default applied

- Default: add exactly one kind, `updateDocument`, so the slide size lives
  on the JSONL document record as requested and is undoable and live-synced.
  Today no command can change document-level fields: `Store.meta` is
  load-only. The private `nodetto-cloud` sync Worker needs one new switch
  case when it bumps this submodule.
- Alternative: no new kind. Store `slideSize` on every page record and have
  the "document" setting write all pages in one `updatePage` batch, with new
  pages inheriting it. This contradicts "stored on the document record" and
  allows pages to disagree.

## Q2. A4 landscape pixel size (section 4.2) - OPEN, default applied

- Default: 1123 x 794, which is A4 at 96 dpi, the CSS pixel convention used
  by the canvas.
- Alternative: 3508 x 2480 (300 dpi). It has the same aspect ratio and only
  changes the coordinate scale.

## Q3. "Show slide area" default when no slide size is set (section 7) - OPEN, default applied

- Default: automatic. The overlay is on when the document has a slide size
  and off otherwise, until the user toggles it. After a toggle the explicit
  choice is stored as a UI preference.
- Alternative: always on by default, which also outlines the fallback
  frame or content bounds on every page of documents that are never
  presented.

## Q4. CLI `prev`/`next` versus a page named "prev" (section 6.4) - OPEN, default applied

- Default: the keywords win. To use a page named "prev", pass its id or
  short id.
- Alternative: try a page name first and use the keyword only when no page
  has that name.

## Q5. Copy shapes target selection (section 6.2) - OPEN, default applied

- Default: after copying, the editor switches to the target page when it is
  not current and selects the pasted elements.
- Alternative: keep the current page and the selection unchanged.

## Q6. "Fit to slide" action (section 1) - OPEN, deferred

- Default: not included, to keep the change small. The resolver in section
  4.1 already gives the rect a later "Zoom to slide area" would fit.
- Alternative: add a View menu action now.
