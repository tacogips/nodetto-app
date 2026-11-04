# CLI layout, merge and lint additions: owner decisions

Design: `design-docs/specs/design-cli-layout-merge-lint.md`. All questions are
open. The design implements each default. A different answer changes only
the section named.

## Q1. Text-layout rules on ERD, state and UML pages (D, page selection) - open, default kept

- Default: `lint` runs `label-overflow`, `label-collision` and `note-overflow`
  only on `TEXT_LAYOUT_LINT_PAGE_KINDS` (architecture, freeform, flowchart).
  The newly linted erd, state and uml pages get only `node-overlap` and
  `image-missing`, and export warnings do not change.
- Alternative: run the text-layout rules on erd, state and uml pages in
  `lint` only (not in export), so notes on an ERD page can also be fixed with
  `--fix`.

## Q2. Page kinds for `node-overlap` (D1) - open, default kept

- Default: erd, state, flowchart and uml. Freeform and architecture pages
  often layer shapes on purpose and are not checked.
- Alternative: also check freeform and architecture pages.

## Q3. List fields in `merge` (B1) - open, default kept

- Default: arrays are atomic. Both sides changing `semantic.columns` or
  `routingWaypoints` differently is a conflict on that path, and ours is kept.
- Alternative: merge id-keyed lists (columns, indexes, attributes) item by item.

## Q4. `lint --fix` that makes a note too tall (D2) - open, default kept

- Default: apply the wrap and report the remaining `note-overflow` height
  finding. Box sizes are never changed.
- Alternative: skip the fix for an element whose wrapped text would no longer
  fit its height.

## Q5. `label` on `add` with `type` (C1) - open, default kept

- Default: `add` with `type` applies `label` through the same mapping as
  `update`. Before this change it was silently ignored.
- Alternative: keep ignoring it and reject it as an unknown field for typed
  `add`.

## Q6. Arrange-written ports count as manual (A2) - open, default kept

- Default: nodetto cannot tell who set `fromPort`, `toPort` or their
  positions, so values written by an earlier arrange count as manual. Rerun
  with `--reset-manual` to recompute them after moving elements.
- Alternative: add a marker field that records arrange-generated routing, so
  plain reruns recompute it. This needs another IR field.
