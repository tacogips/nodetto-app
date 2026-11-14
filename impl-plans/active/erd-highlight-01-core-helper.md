# erd-highlight-01-core-helper

- planId: erd-highlight-01-core-helper
- planPath: impl-plans/active/erd-highlight-01-core-helper.md
- wave: 1
- dependsOn: none
- design: `design-docs/specs/design-erd-relation-field-highlight.md`
  sections 2, 3, 4.1, 5

## Intent and context

When `erd.relation` edges are selected, the canvas must highlight the
column rows they connect. This plan adds the pure core function that turns
a selection set into "which column ids to highlight in which table". It is
the contract that plan 03 (Canvas wiring) consumes.

Repository facts:
- `ErdEndpoint` is `{ table: ElementId; column?: string; columns?: readonly string[] }`
  (`packages/ir/src/semantics.ts:291`). `endpoint.table` is the
  `erd.table` element id.
- `erdEndpointColumnIds(endpoint)` (`packages/ir/src/semantics.ts:300`)
  returns `columns` when non-empty, else `[column]`, else `[]`. Reuse it.
  Do not re-implement the precedence.
- `ErdTableSemantic.columns[].id` holds the current column ids.

## Non-goals

- No change to `packages/ir`, to `erdForeignKeyWarning`, or to any other
  core module.
- No UI, CSS or Canvas work (plans 02 and 03).
- No group expansion: a selected group id contributes nothing.
- Do not edit `impl-plans/README.md` or other plans.

## writePaths

- packages/core/src/erd-foreign-key.ts
- packages/core/src/erd-foreign-key.test.ts
- packages/core/src/index.ts
- impl-plans/progress/erd-highlight-01-core-helper.md

## sharedPaths

- none (`packages/core/src/index.ts` is owned only by this plan; one-line
  export change)

## File-level changes

1. `packages/core/src/erd-foreign-key.ts`: add and export

   ```ts
   export function erdRelationHighlightedColumns(
     selection: Iterable<ElementId>,
     resolve: (id: ElementId) => Element | undefined,
   ): ReadonlyMap<ElementId, ReadonlySet<string>>
   ```

   Behaviour:
   - For each id in `selection`, `resolve(id)`. Skip when undefined or
     `type !== "erd.relation"`.
   - Read `semantic` defensively. Skip the whole element when `semantic` is
     not a non-null object. For each end key `"from"` and `"to"`, skip the
     end when it is not a non-null object or its `table` is not a string.
   - Resolve `end.table`. Skip the end unless it resolves to an element with
     `type === "erd.table"`.
   - Read that table's `semantic.columns` defensively (non-array means no
     columns). Keep only the ids from `erdEndpointColumnIds(end)` that exist
     among the table's column ids.
   - Add the kept ids to the set for that table id, creating the entry
     lazily. Never create an entry with an empty set.
   - Union across ends and relations. A self-relation (both ends on one
     table) adds both column lists to the same entry.
   - `semantic.logical` is ignored (logical relations highlight).
   - Must never throw for malformed data.
   - Imitate the defensive style of `packages/core/src/shapes/connector.ts:readTableEndpoints`
     and the import style of `erdForeignKeyWarning` in the same file.
   - Add a one-line doc comment saying the result is transient view state
     and is never written to the document.
2. `packages/core/src/index.ts`: change line 665 to
   `export { erdForeignKeyWarning, erdRelationHighlightedColumns } from "./erd-foreign-key.ts";`.
   Touch nothing else in that file.
3. `packages/core/src/erd-foreign-key.test.ts`: append tests (keep the
   existing tests and the `fixture()` helper unchanged). Build data with
   `new Editor()` and `editor.createElement(...)` like the existing
   `fixture()`, and set table columns explicitly through `semantic` so the
   ids are self-authored. Pass `(id) => editor.store.get(id)` as `resolve`.

## Key pitfalls

- Do not cast `element.semantic as ErdRelationSemantic` and then
  dereference `semantic.from.table` blindly. Malformed semantics must not
  throw.
- Do not return raw endpoint ids. Stale ids (columns that were renamed or
  deleted) must be filtered out against the table's current columns.
- Do not mutate the input or any element. Do not call `editor.apply` or any
  command from the helper.
- Return type is `ReadonlyMap<ElementId, ReadonlySet<string>>`. Plan 03
  relies on `map.get(tableId)` returning `undefined` when there is nothing
  to highlight.
- Strict TypeScript: no `any`, no non-null assertions on lookups.

## Test cases (input -> expected)

- Relation with `from: {table: A, column: "a_id"}` and
  `to: {table: B, column: "id"}` selected ->
  map `{A: {"a_id"}, B: {"id"}}`; other columns of A and B are absent.
- Composite `columns: ["x","y"]` on both ends -> both ids per table.
- Both `columns: ["x"]` and `column: "y"` on an end -> only `"x"`.
- Two relations selected that touch A on different columns -> A's set is
  the union.
- Self-relation (A to A on `"parent_id"` and `"id"`) -> A: `{"parent_id","id"}`.
- Empty selection -> `size === 0`.
- Selection containing only a table id and an unknown id -> `size === 0`.
- Table-level ends (`{table: A}`) -> `size === 0`, no throw.
- End whose `table` id does not exist, or points to a non-`erd.table`
  element -> no entry for that end; the other end still highlights.
- Stale column id (not in the table's columns) -> filtered out; an end with
  only stale ids gives no entry.
- `logical: true` relation with column ends -> highlights.
- Element of type `erd.relation` whose semantic lacks `from`/`to` (built by
  passing a hand-made `Element` object through a custom `resolve`) -> no
  throw, `size === 0`.

## Invariants

- The existing `erdForeignKeyWarning` tests and behaviour are unchanged.
- No document or undo-history mutation in the helper.

## Verification (run from repo root, foreground)

- `bun test packages/core/src/erd-foreign-key.test.ts` -> exit 0, all
  tests pass, including the new ones.
- `bun run typecheck` -> exit 0. Plan 02 may be editing ui-solid files at
  the same time. If an error appears only in files outside this plan's
  writePaths, record it in the progress log and do not fix it.
- `bunx biome check packages/core/src/erd-foreign-key.ts packages/core/src/erd-foreign-key.test.ts packages/core/src/index.ts --diagnostic-level=warn` -> exit 0.

Record each command, its exit status and a log path (for example
`/tmp/nodetto-erd-highlight/erd-highlight-01-core-helper/<command>.log`,
outside the repository) in the progress log.

## Edit discipline

- Before each edit, re-read the target file fresh. Record a pre-edit
  SHA-256 and a one-line intent in the progress log, and record the
  post-edit SHA-256 after. If the pre-edit hash differs from the last
  recorded value (drift), stop and note it instead of overwriting.
- No git commands that change state (no commit, stash, checkout or
  branch). The workflow commits after joining.

## Acceptance / done criteria

- `grep -n "export function erdRelationHighlightedColumns" packages/core/src/erd-foreign-key.ts` matches once.
- `grep -n "erdRelationHighlightedColumns" packages/core/src/index.ts` matches once.
- All the test cases above exist and pass.
- `git diff --name-only` for this plan touches only its writePaths.
- `impl-plans/progress/erd-highlight-01-core-helper.md` lists start time,
  edits with hashes, command results and the final status.
