# zorder-04-paint-consumers

- planId: zorder-04-paint-consumers
- planPath: impl-plans/active/zorder-04-paint-consumers.md
- progressPath: impl-plans/progress/zorder-04-paint-consumers.md
- wave: 2
- dependsOn: zorder-01-paint-order
- Design: `design-docs/specs/design-z-order.md` sections 2.2, 2.4 and 5.
- writePaths:
  - `packages/core/src/svg-export/document.ts`
  - `packages/core/src/hit-test.ts`
  - `packages/core/src/hit-test.test.ts`
  - `packages/core/src/svg-paint-order.test.ts` (new)
  - `impl-plans/progress/zorder-04-paint-consumers.md`
  - `tmp/zorder-s734/zorder-04-paint-consumers`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

Follow the worker rules in `impl-plans/active/zorder-00-overview.md`.

## Intent and context

SVG export is the source of PNG and PDF output, so this fixes all three formats.
`hitTestPoint` must agree with the corrected order.

Use `containerPaintOrder` and `pagePaintOrder` from `./paint-order.ts` (or
`../paint-order.ts`) as pinned in `zorder-01`.

## Changes

`packages/core/src/svg-export/document.ts:renderElementsSvg`:

- Compute `backdropIds` first, exactly as today (lines 445-448).
- Compute `roots` by filtering `containerPaintOrder(elements, context, backdropIds)`
  with the existing predicate (lines 436-440). The order of statements changes;
  `backdrops`, `connectors` and `shapes` keep filtering `roots`.

`packages/core/src/hit-test.ts:hitTestPoint`: the scanned list becomes
`pagePaintOrder(store, pageId, context)` in place of `store.getPageElements(pageId)`
at line 144. Nothing else in the scan changes.

## Pitfalls

- Leave the first loop over `elements` (line 133) in stored order. It numbers clips,
  effects and gradients; reordering it changes bytes for correct documents.
- Leave the `activeNetlists` loop and `renderUnit`'s `memberIdsOf` order alone.
- Do not change `connectorBackdropIds` or `isConnectorBackdrop`.
- Do not change `elementsOnPage` in `createShapeContext`.
- Do not change `store.getPageElements` or `compareElementOrder`.
- Import `pagePaintOrder` in `hit-test.ts` without a cycle: `paint-order.ts` must only
  type-import `ShapeContext` and `Store`.
- Do not touch `html-bundle.ts` or `prototype.ts`.

## Tests

`packages/core/src/svg-paint-order.test.ts`, using `renderPageSvg`, explicit `index`
keys and `data-id` positions in the output:

- No connector, `[node, frame]`, filled frame enclosing the node -> the frame's
  `data-id` comes before the node's in the `shapes` layer.
- `[frame, node]` and `[node, frame]` -> byte-identical SVG.
- `[node, panel, frame, connector]` as in the design -> `backdrops` lists `panel` then
  `frame`, then the connector layer, then `node` in `shapes`.
- Same page stored `[panel, frame, node, connector]` -> byte-identical SVG to the
  previous case.
- `[lane, task, pool, flow]` -> `backdrops` lists `pool` then `lane`.
- `[node, panel, frame, group, other]`, `group` lists `node` -> root order `panel`,
  `frame`, `group`, `other`, and byte-identical to `[panel, frame, node, group, other]`.
- `[node, group, frame]` -> `frame` before `group`; the group's member order is
  unchanged.
- `renderSelectionSvg` selecting frame and node from `[node, frame]` -> frame first.

`packages/core/src/hit-test.test.ts` (append):

- No connector, pool stored above an enclosed task, point inside both -> task.
- With a connector, lane stored below the pool that encloses it, point inside both ->
  lane.
- With a connector, pool stored above an enclosed task, point inside both -> pool, as
  today.
- Page with nothing inverted -> existing behavior; all existing tests pass unmodified.

## Acceptance criteria

- `document.ts` calls `containerPaintOrder` with the existing `backdropIds`.
- `hitTestPoint` scans `pagePaintOrder`.
- Existing golden and layer tests pass unmodified.

## Verification (each must exit 0)

1. `bun test packages/core/src/svg-paint-order.test.ts packages/core/src/hit-test.test.ts`:
   all pass, including the new tests.
2. `bun test packages/core/src/svg-export.test.ts packages/core/src/backdrops.test.ts packages/core/src/bpmn/svg-export-layers.test.ts packages/core/src/bpmn/svg-export-bpmn.test.ts packages/core/src/breadboard/export-golden.test.ts packages/core/src/breadboard/svg-export-breadboard.test.ts packages/core/src/editor.test.ts`:
   all pass unmodified.
3. `bun run typecheck`: no errors.
4. `bunx biome check packages/core/src/svg-export/document.ts packages/core/src/hit-test.ts packages/core/src/hit-test.test.ts packages/core/src/svg-paint-order.test.ts`
5. `sh -c 'mkdir -p tmp/zorder-s734/zorder-04-paint-consumers; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/zorder-s734/zorder-04-paint-consumers/strict.log 2>&1; ! grep -E "^packages/core/src/(svg-export/document\.ts|hit-test\.ts)" tmp/zorder-s734/zorder-04-paint-consumers/strict.log'`:
   the strict check reports nothing in the owned production files.
