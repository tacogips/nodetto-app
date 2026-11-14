# zorder-01-paint-order

- planId: zorder-01-paint-order
- planPath: impl-plans/active/zorder-01-paint-order.md
- progressPath: impl-plans/progress/zorder-01-paint-order.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-z-order.md` sections 2.2, 2.3, 2.5 and 5.
- writePaths:
  - `packages/core/src/paint-order.ts` (new)
  - `packages/core/src/paint-order.test.ts` (new)
  - `packages/core/src/index.ts`
  - `impl-plans/progress/zorder-01-paint-order.md`
  - `tmp/zorder-s734/zorder-01-paint-order`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

Follow the worker rules in `impl-plans/active/zorder-00-overview.md`.

## Intent and context

A surface stored above an element it encloses hides that element. This plan adds
the pure function that computes corrected paint order. It changes no render path;
`zorder-04` and `zorder-05` wire it in.

Existing code to imitate:

- `packages/core/src/frame-tree.ts:frameParents`: inclusive containment, explicit
  `memberIds` pass, ancestor-walk cycle rejection, `WeakMap` cache keyed by context
  then page array.
- `packages/core/src/backdrops.ts`: `isConnectorBackdrop`, `groupedIds`,
  `connectorBackdropIds`.
- `packages/core/src/z-order.test.ts` and `packages/core/src/test-helpers.ts`
  (`document`, `element`, `TEST_PAGE`) for fixtures with explicit `index` keys.

## Contract (other plans depend on this)

```ts
export function containerPaintOrder(
  elements: readonly Element[],
  context: ShapeContext,
  backdropIds: ReadonlySet<ElementId>,
): readonly Element[];

export function pagePaintOrder(
  store: Store,
  pageId: PageId,
  context: ShapeContext,
): readonly Element[];
```

`packages/core/src/index.ts` gains one line near the `connectorBackdropIds` export
(line 85): `export { containerPaintOrder, pagePaintOrder } from "./paint-order.ts";`

## Behavior

`containerPaintOrder` follows design section 2.2 exactly:

- Mode: backdrop when `backdropIds.size > 0`, where surfaces and candidates are the
  elements in `backdropIds`. Otherwise single-layer, where surfaces are ungrouped
  `isConnectorBackdrop` elements using `groupedIds(elements)`, and candidates are
  ungrouped elements, including surfaces and `group` elements, of category other
  than `edge` and `resource`.
- A hidden element (`element.visual.hidden` or `context.isHidden`) or a mask source
  (`context.isMaskSource`) is never a surface or a candidate. A surface also needs a
  positive box from `context.boundsOf`.
- Owners, with no link allowed to make E an ancestor of its own owner:
  1. Explicit pass, frames in z-order: a surface frame with `memberIds` owns each
     listed candidate that has no owner yet. Area plays no part.
  2. Geometric pass, candidates in z-order, for E without an owner: the
     smallest-area enclosing surface, skipping frames with `memberIds`. If E is a
     surface, the owner must have strictly larger area. An area tie goes to the
     highest tied surface already below E, otherwise the lowest tied surface. A
     rejected link moves on to the next-smallest surface.
- Depth is the count of owner links above a surface. Process surfaces by depth
  descending, then z position ascending. If the lowest current position of any
  candidate S owns is below S, move S directly before that candidate.
- If nothing moved, return the input array instance itself. Copy the array only on
  the first move.

`pagePaintOrder` computes `backdropIds` with `connectorBackdropIds(visible, id =>
groupOf(store, id) !== null)`, where `visible` is the page elements that are not
hidden and not mask sources, as in `packages/ui-solid/src/Canvas.tsx:elements`. It
returns `containerPaintOrder(store.getPageElements(pageId), context, backdropIds)`,
cached per context and page array.

## Pitfalls

- Do not call `frameParents`. It ignores frames above their content, which is the
  bug being fixed.
- A grouped element's own position must never trigger a move or be an insertion
  point. A group is one candidate at its own position, using
  `context.boundsOf(group.id)`.
- Do not compute geometric owners or bounds for edges. Connector bounds are routed
  and expensive.
- Return early when there are no surfaces. Only candidates below the topmost
  surface need a geometric owner, except surfaces, which need one for depth.
- Boxes are unrotated `boundsOf`, as in `frameParents`.
- Guard every indexed access. No destructuring in the owner loop.
- Do not mutate elements or the input array, and do not add document writes.

## Tests (`packages/core/src/paint-order.test.ts`)

Build a real `Store` and `createShapeContext(store, createDefaultRegistry(), 1)` with
explicit `index` keys. Assert ids. "Same array" means `toBe(input)`.

- Page with no surface -> same array.
- `[frame, node]` -> same array.
- No connector, `[node, frame]` with a filled frame enclosing the node ->
  `[frame, node]`.
- All six stored orders of `node`, `outer`, `inner` (geometric) ->
  `[outer, inner, node]`.
- `[node, parent, child]`, `parent` (0,0,100,100) lists `child`, `child`
  (0,0,200,200) lists `node` (10,10,20,20) -> `[parent, child, node]`.
- `[parent, child, node]` with the same ownership -> same array.
- `[node, panel, frame, connector]`, `frame` (0,0,200,200), `node` (10,10,20,20),
  `panel` (150,150,100,100), `backdropIds` = panel and frame -> same array.
- `[lane, task, pool, flow]`, `backdropIds` = pool and lane -> pool before lane;
  filtering to `backdropIds` gives `[pool, lane]`.
- `[A, a, A2, a2]`, equal-box frame copies -> same array.
- Surface partly overlapping a non-enclosed element -> same array.
- Larger frame overlapping a smaller frame that owns `a`, enclosing `a` but not that
  frame, stored above both -> same array.
- Explicit frame stored above a listed non-enclosed member -> moves beneath it.
- Explicit frame stored above an enclosed, unlisted element -> same array.
- Grouped surface stored above a sibling -> same array.
- `[node, panel, frame, group, other]`, no connector, `group` lists `node`, `other`
  (500,500,100,100) -> same array.
- `[node, inner, panel, frame, outer, other]`, `outer` lists `inner`, `inner` lists
  `node` -> same array.
- `[node, group, frame]` -> ungrouped roots `[frame, group]`; `memberIds` unchanged.
- `[node, inner, outer, frame]` -> ungrouped roots `[frame, outer]`.
- `[node, panel, group, frame]` -> ungrouped roots `[panel, frame, group]`.
- Hidden element or mask source enclosed by a surface stored above it -> same array.
- `[A, B]` listing each other, and `[B, A]` -> same array.
- `A` lists `T`, implicit `T` encloses `A`: `[T, A]` -> `[A, T]`; `[A, T]` -> same
  array.
- `pagePaintOrder` called twice with one context -> the same result instance.

## Acceptance criteria

- The contract above is exported from `@nodetto/core`.
- All listed tests exist and pass.
- `paint-order.ts` has no `store` or document writes and no regex split.

## Verification (each must exit 0)

1. `bun test packages/core/src/paint-order.test.ts`: all pass and at least 20 tests
   ran.
2. `bun run typecheck`: no errors.
3. `bunx biome check packages/core/src/paint-order.ts packages/core/src/paint-order.test.ts packages/core/src/index.ts`
4. `sh -c 'mkdir -p tmp/zorder-s734/zorder-01-paint-order; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/zorder-s734/zorder-01-paint-order/strict.log 2>&1; ! grep -E "^packages/core/src/paint-order\.ts" tmp/zorder-s734/zorder-01-paint-order/strict.log'`:
   the strict check reports nothing in the new module.
