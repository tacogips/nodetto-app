# CLI layout, merge and lint additions: owner decisions

Design: `design-docs/specs/design-cli-layout-merge-lint.md`. Questions are open
unless marked otherwise. The design implements each default. A different answer
changes only the section named.

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

## Q7. `carryMembers:false` on a BPMN lane (E1) - open, default kept

- Default: lanes are bands of their pool. With `carryMembers:false` only the
  lane's `height` may change; an `x`, `y` or `width` change exits 2 with a
  message pointing to the pool. Members of the lane keep their positions and
  are re-parented by geometry.
- Alternative: let the lane move freely and restack the pool's lanes around
  it, which reorders lanes implicitly.

## Q8. BPMN `--mode layered` placement (E2.1) - open, default kept

- Default: lanes are rows in their existing order, BFS depth gives global
  columns shared by all pools, and units in one lane and column stack
  vertically. `--frames` and `--direction TB` exit 2 on BPMN pages.
- Alternative: reorder lanes by first member rank, or support vertical pools.

## Q9. `name:` matching and scope (F1) - open, default kept

- Default: exact match after trimming, case-sensitive, against the C1 label
  field. Scope is the op's page, the `from` element's page for `connect`
  `to`, the edited element's page inside `semantic`, otherwise the whole
  document. An exact id always wins over a name.
- Alternative: case-insensitive or whitespace-collapsing matching, or always
  limit to one page (needing a `page` field on every op).

## Q10. `where` without `expect` (F2) - open, default kept

- Default: zero matches is an error, any positive count is applied, and
  `expect: 0` makes an idempotent no-op possible.
- Alternative: require `expect` on every `delete` with `where`, to guard bulk
  deletion.

## Q11. Depth-one byte identity against lane containment (D1, D2) - open, not blocking, current behavior kept

Owner direction, continuation 5 (2026-11-05): keep the current depth-one behavior,
document it, and do not block on this question. Neither option below is chosen as a
final answer. D2 stays strict until the owner gives one.

- Conflict: D2 requires depth-one results to stay byte-identical to the current
  output, and the acceptance criteria also require containment tests at depth 1.
  Some valid inputs cannot satisfy both.
- Reproduction, run in design review on HEAD d5b9bac:
  - Pool (x, y, width, height) = (0, 0, 210, 240).
  - Lanes (30, 0, 180, 140) and (30, 140, 180, 100), both parented to the pool.
  - Tasks (70, 40, 100, 40) in the first lane and (70, 170, 100, 40) in the second.
  - The input validates cleanly. Applying `containerCommands` then `unitCommands`
    leaves the second lane at (30, 140, 180, 120), which ends 20 past the pool's
    bottom. Containment needs its `y` to be 120, which changes the output bytes.
- Effect until answered: depth-one output does not change, the depth-one
  containment criterion stays open for inputs of this kind, and no test pins them.
  Pages with lanes nested 2 or more levels deep are not affected.

Option A (proposal, not approved): D1 takes priority on these inputs.

- Boundary: a depth-one page's output differs from HEAD only when the HEAD output
  breaks the lane rules in E2.1: lane heights change with an unchanged pool box, a
  lane is carried out of place while an ancestor moves, or the input's lane boxes
  do not follow the formula. All other depth-one output stays byte-identical.
- Gates: the depth-one expected files stay unchanged and are not regenerated, and
  the input above gets a test expecting the second lane at (30, 120, 180, 120),
  with an empty rerun.

Option B: keep D2 strict on every depth-one page.

- Overflowing lanes stay on those inputs, and the depth-one containment criterion
  is narrowed by owner decision to inputs whose current output already satisfies
  containment. The limitation is documented and reported.

A final answer is recorded as a scope amendment in design E2.1 before any depth-one
output changes.

## Q12. A7 ratio above the 2.0 x ceiling (D3) - closed, superseded by D3'

Owner decision D3' replaces the whole-command ratio and its ceiling with the marginal
per-operation ratio ("A7 decision D3'" in the design), so this question no longer
applies. A marginal ratio above 1.5 x is a defect for clm-02 to fix, or a blocker
finding. The original text is kept as history.

- Context: D3 accepts up to 2.0 x when the gap is irreducible, and does not say
  what happens if an irreducible gap stays above 2.0 x. The current single-page
  ratio is 2.30 x.
- Default: clm-02 stops and reports a blocker finding with the native phase table.
  The ceiling is not raised and fixtures are not changed. The owner then decides.
- Alternative: accept any ratio backed by attribution evidence, relying on the
  absolute deadlines alone.
