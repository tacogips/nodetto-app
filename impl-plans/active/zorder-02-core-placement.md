# zorder-02-core-placement

- planId: zorder-02-core-placement
- planPath: impl-plans/active/zorder-02-core-placement.md
- progressPath: impl-plans/progress/zorder-02-core-placement.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-z-order.md` section 3.
- writePaths:
  - `packages/core/src/z-order.ts`
  - `packages/core/src/z-order.test.ts`
  - `packages/core/src/editor/facade/selection-editing.ts`
  - `impl-plans/progress/zorder-02-core-placement.md`
  - `tmp/zorder-s734/zorder-02-core-placement`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

Follow the worker rules in `impl-plans/active/zorder-00-overview.md`.

## Intent and context

The CLI `order` op needs relative placement, element-targeted moves and group-member
ordering. The app's selection-based commands stay as they are.

Existing code to imitate:

- `packages/core/src/z-order.ts:targetOrder`, `planZOrder`, `reorderCommands`.
- `packages/core/src/editor/facade/selection-editing.ts:reorderSelection` for
  applying commands and returning false when nothing changes.
- `packages/core/src/frame-tree.ts:expandContainers`, `packages/core/src/group.ts:groupOf`
  and `memberIdsOf`.

## Contract (`zorder-06` depends on this)

```ts
export type ZOrderPlacement =
  | { readonly to: ZOrderAction }
  | { readonly before: ElementId }
  | { readonly after: ElementId };

export function relativeOrder(
  ordered: readonly ElementId[],
  moved: ReadonlySet<ElementId>,
  anchorBlock: ReadonlySet<ElementId>,
  side: "before" | "after",
): ElementId[];

export function planElementOrder(
  store: Store,
  ids: readonly ElementId[],
  placement: ZOrderPlacement,
  context: ShapeContext,
  rng: Rng,
): Command[];

// Editor, beside reorderSelection
orderElements(
  ids: readonly ElementId[],
  placement: ZOrderPlacement,
  applyOptions?: ApplyOptions,
): boolean;
```

`packages/core/src/index.ts` is not edited. The CLI reaches this through the `Editor`
method and passes object literals.

## Behavior

`relativeOrder`:

- Keeps `moved` in its relative order as one block and removes it from `ordered`.
- Places the block directly below the lowest `rest` element in `anchorBlock` for
  `before`, or directly above the highest for `after`.
- Returns `ordered` unchanged in content when no `rest` element is in `anchorBlock`.

`planElementOrder`:

- Returns `[]` for empty `ids`, unknown ids, ids on more than one page, a mix of
  grouped and ungrouped ids, ids in different groups, or an invalid anchor. It
  refuses rather than half-applying, as `reorderCommands` does. The CLI reports
  friendly errors first.
- Group scope, when every id has the same `groupOf`: the sequence is that group's
  `memberIdsOf`. Apply `targetOrder` or `relativeOrder` with `moved` being just the
  ids and the anchor block being just the anchor. The anchor must be a sibling and
  not a target. Emit one `updateSemantic` on the group with the new `memberIds`,
  spreading its existing semantic. Emit nothing if the order is unchanged. No
  `reorder` commands, and no index changes.
- Page scope: `moved` is `expandContainers(store, ids, context)`. For `to`, use the
  same `targetOrder` and `reorderCommands` path as `planZOrder`. For `before` and
  `after`, the anchor must be on the same page, ungrouped and not in `moved`; the
  anchor block is `expandContainers(store, [anchor], context)`. Pass the permutation
  to `reorderCommands`.

`Editor.orderElements` calls the planner with `this.createShapeContext()` and
`this.rng`, applies non-empty commands, and returns whether it applied anything. It
neither reads nor changes the selection.

## Pitfalls

- Do not change `targetOrder`, `planZOrder`, `reorderCommands`, or the existing
  commands' behavior.
- `before` means painted beneath and `after` means painted above, reading bottom to
  top. Do not swap them.
- Do not import `paint-order.ts`; the planner works on stored order.
- A group's paint order is `memberIds`, so page-index edits for group scope would
  have no visible effect.
- `reorderCommands` needs a permutation of every page element; `relativeOrder` must
  keep the whole list.
- Keep `frame-selection.ts` and other importers working. No import cycle: `group.ts`
  and `frame-tree.ts` do not import `z-order.ts`.

## Tests (append to `packages/core/src/z-order.test.ts`)

- `relativeOrder(["a","b","c","d"], {d}, {b}, "before")` -> `["a","d","b","c"]`.
- `relativeOrder(["a","b","c","d"], {a}, {c}, "after")` -> `["b","c","a","d"]`.
- Moved block `{a, c}` before `{d}` -> `["b","a","c","d"]`, relative order kept.
- Anchor block `{b, c}`: `before` lands below `b`, `after` lands above `c`.
- Anchor block entirely inside `moved` -> same sequence.
- `orderElements` with `{to}` for each action on an ungrouped element -> same order
  as `reorderSelection` on an equal document.
- Frame owning a node, `{to: "front"}` -> frame and node move together, node still
  above frame.
- Frame `F` owning `n`, plus a shape `x`: `orderElements([x], {after: F})` -> `x` is
  above `n`, not between `F` and `n`; `{before: F}` -> `x` is below `F`.
- Group member with `{to: "back"}` -> group `memberIds` changes; no element `index`
  changes.
- Group member with `{before: sibling}` and `{after: sibling}` -> `memberIds` as
  expected.
- Top element `{to: "front"}` -> returns false and the document is unchanged.
- Mixed grouped and ungrouped ids, different groups, anchor on another page, grouped
  anchor at page scope, anchor in `moved` -> returns false and the document is
  unchanged.
- `orderElements` leaves `editor.selection` unchanged.

## Acceptance criteria

- The contract exists with these signatures; the tests pass.
- Existing `z-order.test.ts` tests pass unmodified.

## Verification (each must exit 0)

1. `bun test packages/core/src/z-order.test.ts packages/core/src/frame-selection.test.ts`:
   all pass, including the new tests.
2. `bun run typecheck`: no errors.
3. `bunx biome check packages/core/src/z-order.ts packages/core/src/z-order.test.ts packages/core/src/editor/facade/selection-editing.ts`
4. `sh -c 'mkdir -p tmp/zorder-s734/zorder-02-core-placement; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/zorder-s734/zorder-02-core-placement/strict.log 2>&1; ! grep -E "^packages/core/src/(z-order\.ts|editor/facade/selection-editing\.ts)" tmp/zorder-s734/zorder-02-core-placement/strict.log'`:
   the strict check reports nothing in the owned production files.
