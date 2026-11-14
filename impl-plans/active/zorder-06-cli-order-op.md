# zorder-06-cli-order-op

- planId: zorder-06-cli-order-op
- planPath: impl-plans/active/zorder-06-cli-order-op.md
- progressPath: impl-plans/progress/zorder-06-cli-order-op.md
- wave: 2
- dependsOn: zorder-02-core-placement
- Design: `design-docs/specs/design-z-order.md` section 3.
- writePaths:
  - `apps/cli/src/edit/operations/order.ts` (new)
  - `apps/cli/src/edit-order.test.ts` (new)
  - `apps/cli/src/edit/batch.ts`
  - `apps/cli/src/edit/operation-fields.ts`
  - `apps/cli/src/edit/operation-fields.test.ts`
  - `impl-plans/progress/zorder-06-cli-order-op.md`
  - `tmp/zorder-s734/zorder-06-cli-order-op`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

Follow the worker rules in `impl-plans/active/zorder-00-overview.md`.

## Intent and context

`send-to-back` and `reorder` are rejected as unknown ops, and there is no way to change
stacking from the CLI. Sibling branches edit `batch.ts` and `operation-fields.ts`, so
keep those hunks small and put logic in `operations/order.ts`.

Existing code to imitate:

- `apps/cli/src/edit/operations/elements.ts:deleteElement` (`selectedWhere`, then
  `touchedPages`).
- `apps/cli/src/edit/operations/groups.ts` for `OperationError` use and the page switch.
- `apps/cli/src/edit/selectors.ts:resolveElementReference`.
- `apps/cli/src/edit/selectors.test.ts` for driving `new Batch(new Editor(...))`, and
  `apps/cli/src/pages-command.test.ts` for running batches through commands.

## Changes

`apps/cli/src/edit/operations/order.ts` exports
`orderElements(batch: Batch, operation: JsonObject, index: number): void`, and
`orderOpHint(op: unknown): string | undefined`.

Handler, in this order:

1. Read `operation["to"]`, `operation["before"]`, `operation["after"]`. If not exactly
   one is defined, throw `order needs exactly one of "to", "before" or "after"`.
2. If `to` is not `back`, `front`, `backward` or `forward`, throw
   `"to" must be back, front, backward or forward`.
3. `selectedWhere(batch, operation, index, "order")` gets the targets. With no `id` and
   no `where`, `requireText` already reports the `id` error.
4. Targets on more than one page: throw `order targets must be on one page`.
5. `groupOf` for each target. Mixed or different groups: throw
   `order targets must all be ungrouped or all in one group`.
6. For `before` or `after`, resolve the anchor with
   `resolveElementReference(batch, requireText(value, field, index), index, page)`. Then
   throw on:
   - anchor on another page: `anchor <id> is on another page`;
   - group scope with an anchor outside that group:
     `anchor <id> must be in the same group`;
   - page scope with a grouped anchor: `anchor <id> is inside a group; order relative to
     the group`;
   - anchor among the moving elements, using `expandContainers` at page scope and the
     targets at group scope: `anchor <id> is one of the elements being moved`.
7. `batch.editor.setCurrentPage(page)`, then `batch.editor.orderElements(ids, placement)`,
   then `batch.touchedPages.add(page)`. A false return is a successful no-op.

With `where` and `expect: 0` and no match, return without error, as `delete` does.

`apps/cli/src/edit/batch.ts`:

- Import the handler and hint.
- Add `case "order":` beside `select`.
- In the default branch, add `order` to the op list and append `orderOpHint(op)` when it
  returns text.

`orderOpHint`:

| Op | Text includes |
| --- | --- |
| `send-to-back` | `{"op":"order","id":...,"to":"back"}` |
| `bring-to-front` | `{"op":"order","id":...,"to":"front"}` |
| `reorder` | `order` with `to`, `before` or `after` |

`apps/cli/src/edit/operation-fields.ts`: row
`order: ["op", "id", "where", "expect", "to", "before", "after"]`.

`apps/cli/src/edit/operation-fields.test.ts`: add to the `handlers` table
`order: ["order:orderElements", "selectors:selectedWhere"]`. The scanner resolves
`order` to `operations/order.ts`.

## Pitfalls

- Read fields only as `operation["..."]`, so the static scan in
  `operation-fields.test.ts` sees them.
- `resolveElementReference` returns an exact id from any page before scoping, so the page
  check is still required.
- Do not add selector logic or change `selectors.ts`.
- Do not sort `where` matches; the core keeps their stored relative order.
- `to` is also a `where` key. Validate only the top-level field here.
- Errors must abort the batch without writing; throw `OperationError`.
- Do not edit `help.ts`, `docs/cli.md`, `commands.ts` or `types.ts`.

## Tests (`apps/cli/src/edit-order.test.ts`)

Use `runOperations` from `apps/cli/src/edit-command.ts` or the helper
`operation-fields.test.ts` uses, on neutral documents, and read stored order back with
`parseDocument`.

- `to` each of `back`, `front`, `backward`, `forward` on `[a, b, c]` -> expected order.
- `before` and `after` by id -> expected order.
- Target by id prefix, `@ref` from `add` in the same batch, and `name:Idle` -> resolves.
- `where {"type":"frame"}` with `expect: 2` and `after` -> both move as one block in
  relative order; the match is in the report.
- `where` with an `expect` mismatch -> exit 2, nothing written.
- Group member `to: back` -> `memberIds` changes, indexes do not.
- Group member `before` a sibling -> `memberIds` as expected.
- Frame with owned content `to: front` -> both move; content is still above the frame.
- Already at the top, `to: front` -> exit 0, document content unchanged.
- `--dry-run` -> nothing written.
- Each error case in steps 1, 2, 4, 5 and 6 -> exit 2 with the exact message, nothing
  written.
- `send-to-back`, `bring-to-front`, `reorder` -> exit 2, stderr suggests `order` as in the
  table.
- Other unknown op -> message lists `order` and has no hint.
- Unknown field on `order` -> `Valid fields: op, id, where, expect, to, before, after`.

## Acceptance criteria

- `order` works through `Batch.apply`.
- Hints appear only for the three aliases.
- Existing edit tests pass; the only change to the existing test file is the new handler
  row.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit-order.test.ts apps/cli/src/edit/operation-fields.test.ts apps/cli/src/edit/selectors.test.ts apps/cli/src/edit/apply-batch.test.ts`:
   all pass.
2. `bun test apps/cli/src/commands.test.ts apps/cli/src/edit-frame-carry.test.ts apps/cli/src/ai-features.test.ts`:
   all pass.
3. `bun run typecheck`: no errors.
4. `bunx biome check apps/cli/src/edit/operations/order.ts apps/cli/src/edit-order.test.ts apps/cli/src/edit/batch.ts apps/cli/src/edit/operation-fields.ts apps/cli/src/edit/operation-fields.test.ts`
