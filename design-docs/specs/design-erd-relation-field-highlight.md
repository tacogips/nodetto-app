# ERD relation field highlight

Status: accepted for implementation.
Scope: `packages/core`, `packages/ui-solid`, `apps/desktop/src/style.css`.
No IR, io, collab, Rust or server change.

## 1. Problem

In the ERD editor a selected `erd.relation` edge does not show which
columns it connects. When one or more relations are selected, the column
rows they connect in the source and target `erd.table` shapes get a
distinct background. The highlight follows the selection: clearing the
selection or selecting something else removes it.

## 2. Behaviour

- The highlight is derived from the current editor selection
  (`editor.selection`, surfaced in ui-solid as `signals.selection()`).
- For every selected element whose type is `erd.relation`, both ends
  (`semantic.from`, `semantic.to`) contribute column ids:
  - the end's table is `endpoint.table`, the `erd.table` element id;
  - its columns come from `erdEndpointColumnIds(endpoint)`
    (`packages/ir/src/semantics.ts`): `columns` when non-empty, otherwise
    `column`, otherwise none.
- The result is the union over all selected relations, keyed by table
  element id, holding the set of column ids to highlight in that table.
- Selected elements of any other type contribute nothing. A mixed
  selection (for example a relation plus a table) still highlights the
  relation's columns.
- Logical relations (`semantic.logical === true`) highlight like enforced
  ones; only resolvability matters.
- Nothing is highlighted, and nothing throws, when:
  - the end is table-level (no `column`/`columns`);
  - `endpoint.table` does not resolve, or resolves to a non-`erd.table`;
  - a column id is not among the table's current `semantic.columns`
    (stale id after a rename or delete);
  - the semantic is malformed (missing `from`/`to` or non-object ends).
- A self-relation (both ends on one table) highlights both column sets in
  that table.
- A relation selected through a group selection does not highlight: only
  ids present in the selection set are inspected (no group expansion).

Out of scope (section 7): the reverse highlight from a field to its
relation lines.

## 3. State boundary

The highlight is transient view state, like the breadboard net highlight
(design-breadboard.md section 5.2):

- It is computed from the selection and the store; it is never written to
  the document, the IR, saved JSONL, the collab doc or SVG/PNG/PDF export.
- It issues no editor command, so it creates no undo history entry.
  Selection changes already create none.
- Export renderers do not use `ShapeView`, so they are unaffected.

## 4. Data flow

```text
editor.selection --(signals.selection)--+
store (signals.rev) --------------------+--> core helper --> Map<tableId, Set<columnId>>
                                                      |
Canvas.renderShape: ShapeView erdHighlightedColumnIds={map.get(element.id)}
                                                      |
ShapeView -> ErdTableView highlightedColumnIds -> row class nodetto-erd-row-related
```

### 4.1 Core helper (`packages/core/src/erd-foreign-key.ts`)

Add one exported pure function next to `erdForeignKeyWarning`, re-exported
from `packages/core/src/index.ts`:

```ts
erdRelationHighlightedColumns(
  selection: Iterable<ElementId>,
  resolve: (id: ElementId) => Element | undefined,
): ReadonlyMap<ElementId, ReadonlySet<string>>
```

Rules: as section 2. Entries are only created for resolved `erd.table`
elements with at least one existing column id; an empty selection, or one
with no resolvable column, returns an empty map. The function reads
`semantic` defensively (non-object ends are skipped) and never throws.

### 4.2 Canvas (`packages/ui-solid/src/Canvas.tsx`)

- One `createMemo` that reads `signals.rev()` and `signals.selection()`
  and calls the helper with `(id) => props.editor.store.get(id)`. It is
  recomputed only when the selection or the document revision changes and
  costs O(selected elements + their endpoint columns).
- `renderShape` (the single `ShapeView` call site that renders
  `erd.table`, near line 879) passes
  `erdHighlightedColumnIds={highlights().get(element().id)}`.
- Connector call sites (`InlineConnector`, `ConnectorView`) are unchanged.

### 4.3 ShapeView and ErdTableView

- `ShapeViewProps` gains optional
  `erdHighlightedColumnIds?: ReadonlySet<string>`, forwarded only to
  `ErdTableView`. Other callers (`ShapePalette.tsx`, `PrototypePreview.tsx`)
  compile unchanged and never highlight.
- `ErdTableViewProps` gains optional
  `highlightedColumnIds?: ReadonlySet<string>`.
- Each row keeps class `nodetto-erd-row` and adds
  `nodetto-erd-row-related` via `classList` when
  `highlightedColumnIds?.has(column.id)`. Rows stay mounted (the `For`
  over columns is unchanged), so selection changes only toggle a class.
- The membership check is exported from `ErdTableView.tsx` as a small pure
  helper (for example `erdRowHighlighted(highlightedColumnIds, column)`)
  so it is unit-testable; ui-solid tests do not mount Solid components and
  test pure helpers exported from views (see `text-note-view.test.ts`).
  The view must use this helper for its class decision.

### 4.4 Styling (`apps/desktop/src/style.css`)

Add after `.nodetto-erd-row`:

```css
.nodetto-erd-row-related {
  background: color-mix(in srgb, var(--nodetto-accent) 18%, transparent);
  box-shadow: inset 3px 0 0 var(--nodetto-accent);
}
```

- Derived only from `--nodetto-accent`; no new hard-coded colour. The
  translucent mix stays readable over the default `--nodetto-surface` and
  over a custom table fill, and follows any future override of the
  `--nodetto-*` tokens.
- Distinct from selection: `.nodetto-selected` is the shape outline and
  the connector stroke; the header uses solid `--nodetto-accent-soft`. The
  row treatment is a translucent accent background with an inset left bar,
  so it differs from both and from `.nodetto-hover-target`.
- Theme note: `apps/desktop/src` defines only the light `:root` tokens
  today (no `prefers-color-scheme` or `data-theme` override was found).
  "Readable in dark theme" is met by deriving from the token, so a dark
  override of `--nodetto-accent` carries over; no dark block is added.
- Text colours of `.nodetto-erd-key`, `.nodetto-erd-name` and
  `.nodetto-erd-type` are unchanged.

## 5. Validation and tests

- `packages/core/src/erd-foreign-key.test.ts`, cases for
  `erdRelationHighlightedColumns`, all with self-authored data:
  - single relation with `column` ends: exactly the two column ids;
  - composite `columns` ends, and `columns` taking precedence over `column`;
  - two selected relations: union, keyed per table;
  - self-relation on one table;
  - empty selection and non-relation selection: empty map;
  - table-level ends, missing table, non-`erd.table` target, stale column
    id: no entry for that end, no throw;
  - logical relation highlights.
- `packages/ui-solid/src/erd-table-view.test.ts`: the exported row helper
  returns true only for ids in the set and false for an undefined set.
- No `packages/ir` change; `erdEndpointColumnIds` is reused.
- `apps/desktop/scripts/canvas-checklist.mjs` and
  `apps/desktop/scripts/fixtures/responsiveness.tsx` query
  `.nodetto-erd-row`; that class is kept on every row, so they need no
  change.

Verification commands:

```bash
bun run typecheck
bun test packages/core packages/ui-solid
mise run lint-ts
```

## 6. Rollout constraints

- Single local commit on `feature/erd-relation-field-highlight`; no push.
- New props are optional; no migration, no schema or file format change.

## 7. Out of scope

- Reverse highlight (hover or select a field to highlight its relation
  lines): `erd.table` has no field-level hover or selection hook today
  (no column hit-testing in core or ui-solid), so adding it would need a
  new interaction model. Not done.
- Highlighting through group selection, in the palette, in prototype
  preview, or in exports.
