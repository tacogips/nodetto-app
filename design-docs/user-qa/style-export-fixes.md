# Style clearing, glyph fallback and vertical alignment: owner decisions

Design: `design-docs/specs/design-style-export-fixes.md`. All questions are open.
The design implements each default, and none of the defaults waives an acceptance
criterion. A different answer changes only the section named.

## Q1. `verticalAlign` values with no `boxLabelAlign` marker (G3, "Compatibility contract") - open, default kept

Byte identity for existing documents requires separating old stored values from new
requests, and the stored value alone cannot do that. The design adds the marker
`visual.style.boxLabelAlign: true`, which `edit add` and `update` write. Without it,
box labels stay centered.

- Default: no marker means middle. This keeps every existing document byte-identical.
  It also means that:
  - New draw.io imports keep today's centering, while still storing and re-exporting
    their alignment.
  - Hand-written JSONL must include the marker.
- Alternative (a): draw.io import also writes the marker. New imports then show their
  source alignment, and already imported documents stay unchanged. Changes the draw.io
  import behavior and its tests.
- Alternative (b): honor stored values with no marker, and drop the marker from the
  design. This is simpler and needs no marker for hand-written files, but existing
  labels move, so it requires an explicit owner amendment to the byte-identity
  criterion.
- Alternative (c): add a migration that removes the key from existing box nodes. This
  rewrites documents and discards imported alignment, so it also requires explicit owner
  authorization.

## Q2. Unknown `visual.style` keys in `connect` (G3, "Unknown `visual.style` keys") - open, default kept

- Default: reject only in `add` and `update`, as requested. `connect` keeps
  accepting them silently.
- Alternative: also reject in `connect`. This is one more entry in the check, and
  it would turn currently accepted batches into errors.
