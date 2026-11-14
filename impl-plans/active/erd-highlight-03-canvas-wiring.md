# erd-highlight-03-canvas-wiring

- planId: erd-highlight-03-canvas-wiring
- planPath: impl-plans/active/erd-highlight-03-canvas-wiring.md
- wave: 2
- dependsOn: erd-highlight-01-core-helper, erd-highlight-02-table-view
- design: `design-docs/specs/design-erd-relation-field-highlight.md`
  sections 3, 4.2

## Intent and context

Connect the selection to the table view. Canvas computes the highlight map
from the current selection with the plan 01 helper and passes each table's
set to `ShapeView` through the plan 02 prop.

Contracts from earlier plans (verify they exist before editing):
- `erdRelationHighlightedColumns(selection: Iterable<ElementId>, resolve: (id: ElementId) => Element | undefined): ReadonlyMap<ElementId, ReadonlySet<string>>`,
  exported from `@nodetto/core`.
- `ShapeViewProps.erdHighlightedColumnIds?: ReadonlySet<string>`.

Repository facts (`packages/ui-solid/src/Canvas.tsx`):
- `signals.selection()` is an `Accessor<ReadonlySet<ElementId>>` and
  `signals.rev()` is the document revision (`packages/ui-solid/src/adapter.ts`).
- Existing memo style: `const context = createMemo(() => { signals.rev(); ... })`
  near line 373. `isSelected` (`createSelector`) is near line 417.
- `renderShape` (near line 849) contains the only `<ShapeView>` in Canvas,
  near line 879. That is where `erd.table` shapes render, including ones
  inside groups (via `renderGroup` -> `renderStableVisualUnit` -> `renderShape`).
- The `@nodetto/core` imports are at the top of the file (lines 2-53).

## Non-goals

- Do not change `InlineConnector` or `ConnectorView` call sites (near lines
  737 and 994), connector styling or the selection logic.
- Do not expand groups, and do not handle hover.
- Do not edit `ShapeView.tsx`, `ErdTableView.tsx`, core or CSS. If a
  contract is missing, stop and record it in the progress log.
- No command, `editor.apply` or store write. The highlight must not create
  undo entries.

## writePaths

- packages/ui-solid/src/Canvas.tsx
- impl-plans/progress/erd-highlight-03-canvas-wiring.md

## sharedPaths

- none

## File-level changes

1. Add `erdRelationHighlightedColumns` to an existing `@nodetto/core` value
   import in Canvas.tsx. Do not add a duplicate import statement if one
   import block can take it.
2. Next to `isSelected`, add one memo, for example
   `const erdHighlights = createMemo(() => { signals.rev(); return erdRelationHighlightedColumns(signals.selection(), (id) => props.editor.store.get(id)); });`.
   It reads both `signals.rev()` (so column renames, deletes and endpoint
   edits recompute it) and `signals.selection()`.
3. In `renderShape`'s `<ShapeView ...>`, add
   `erdHighlightedColumnIds={erdHighlights().get(element().id)}`.

## Key pitfalls

- Read the signals inside the memo, not once outside it. Otherwise
  deselecting would not clear the highlight.
- Do not filter the selection to the current page manually. The helper only
  highlights tables that render, so `map.get` for other ids is unused.
- Do not convert the set to an array or spread it into new objects per
  shape. Pass the `ReadonlySet` from the map as is.
- Keep strict types. No `as any`.

## Test cases

There are no Canvas DOM tests in this repo (ui-solid tests do not mount
components). Behaviour is covered by the plan 01 helper tests and the plan
02 row helper tests. This plan is verified by typecheck, the existing
ui-solid suite and lint. Do not add a DOM test harness.

## Invariants

- Canvas still has exactly one `<ShapeView` occurrence.
- No change to connector rendering or selection behaviour.

## Verification (run from repo root, foreground)

- `bun run typecheck` -> exit 0.
- `bun test packages/core packages/ui-solid` -> exit 0.
- `bunx biome check packages/ui-solid/src/Canvas.tsx --diagnostic-level=warn` -> exit 0.
- `grep -c "<ShapeView" packages/ui-solid/src/Canvas.tsx` -> `1`.

Record each command, its exit status and a log path (for example
`/tmp/nodetto-erd-highlight/erd-highlight-03-canvas-wiring/<command>.log`,
outside the repository) in the progress log.

## Edit discipline

- Re-read Canvas.tsx fresh before editing. Record the pre and post SHA-256
  and the intent in the progress log. On drift, stop and record it.
- No state-changing git commands.

## Acceptance / done criteria

- `grep -n "erdRelationHighlightedColumns" packages/ui-solid/src/Canvas.tsx` matches the import and the memo.
- `grep -n "erdHighlightedColumnIds=" packages/ui-solid/src/Canvas.tsx` matches once.
- All verification commands pass. `git diff --name-only` for this plan
  touches only its writePaths.
- `impl-plans/progress/erd-highlight-03-canvas-wiring.md` is complete.

## Final integration gate (serial, after this plan)

Run by reconcile or integration review, not by parallel workers:
`bun run typecheck && bun test packages/core packages/ui-solid && mise run lint-ts`,
all exiting 0 on the combined tree.
