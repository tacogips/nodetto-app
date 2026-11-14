# zorder-05-canvas

- planId: zorder-05-canvas
- planPath: impl-plans/active/zorder-05-canvas.md
- progressPath: impl-plans/progress/zorder-05-canvas.md
- wave: 2
- dependsOn: zorder-01-paint-order
- Design: `design-docs/specs/design-z-order.md` sections 2.4 and 5.
- writePaths:
  - `packages/ui-solid/src/Canvas.tsx`
  - `packages/ui-solid/src/interaction/hit-testing.ts`
  - `packages/ui-solid/src/canvas-paint-order.test.ts` (new)
  - `impl-plans/progress/zorder-05-canvas.md`
  - `tmp/zorder-s734/zorder-05-canvas`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

Follow the worker rules in `impl-plans/active/zorder-00-overview.md`.

## Intent and context

The app canvas paints from the same stored order as SVG export and must apply the same
rule. A connector end being dropped must land on what is visible.

Existing code to imitate: `packages/ui-solid/src/bpmn-backdrop.test.ts` (partition test
through core functions; ui-solid has no rendered-canvas test) and the interaction test
setups in `packages/ui-solid/src/pcb-interaction.test.ts`.

## Changes

`packages/ui-solid/src/Canvas.tsx`:

- Import `containerPaintOrder` from `@nodetto/core`.
- Keep `elements` and `backdropIds` as they are.
- Add one memo, `paintElements`, equal to
  `containerPaintOrder(elements(), context(), backdropIds())`.
- `connectors`, `backdropRoots` and `visualRoots` filter `paintElements()` instead of
  `elements()`. Filter predicates stay unchanged.

`packages/ui-solid/src/interaction/hit-testing.ts:targetUnder`: import `pagePaintOrder`
from `@nodetto/core` and scan
`pagePaintOrder(editor.store, editor.currentPageId, context)` instead of
`editor.store.getPageElements(editor.currentPageId)`. Nothing else in the scan changes.

## Pitfalls

- `backdropIds` must stay computed from `elements()`, or the memo would depend on
  itself.
- Do not change `canvasHitTest`, including its PCB branch; the non-PCB path already goes
  through `editor.hitTest`.
- Do not change `edgeLabelAt` or `elementsIn`.
- Do not change `canvas/visual-units.tsx`; group members keep `memberIds` order.
- Do not change the Layers panel or `apps/desktop`.

## Tests (`packages/ui-solid/src/canvas-paint-order.test.ts`)

Run the partition from `Canvas.tsx` through `containerPaintOrder` and
`connectorBackdropIds` with `groupOf`, on an `Editor` page built from elements with
explicit `index` keys.

- No connector, `[node, frame]` -> visual roots `[frame, node]`, no backdrop roots.
- `[node, panel, frame, connector]` -> backdrop roots `[panel, frame]`, visual roots
  `[node]`.
- `[lane, task, pool, flow]` -> backdrop roots `[pool, lane]`.
- `[node, panel, frame, group, other]`, `group` lists `node` -> visual roots
  `[panel, frame, group, other]`.
- Page with nothing inverted -> `containerPaintOrder` returns the same array.
- `targetUnder` through `createHitTesting`, with a connector being drawn and a task
  enclosed by a pool stored above it on a page without connectors, point inside both
  and away from ports -> the task. If building the interaction context needs a minimal
  stub, type it with an explicit cast and keep it in this test file.
- A static check that `Canvas.tsx` contains `containerPaintOrder(` and that
  `backdropRoots` reads `paintElements()`, so the wiring cannot be removed unnoticed.

## Acceptance criteria

- The three canvas memos read `paintElements()`.
- `targetUnder` scans `pagePaintOrder`.
- `bpmn-backdrop.test.ts` passes unmodified.

## Verification (each must exit 0)

1. `bun test packages/ui-solid/src/canvas-paint-order.test.ts packages/ui-solid/src/bpmn-backdrop.test.ts packages/ui-solid/src/bpmn-palette.test.ts`:
   all pass.
2. `bun run typecheck`: no errors.
3. `bunx biome check packages/ui-solid/src/Canvas.tsx packages/ui-solid/src/interaction/hit-testing.ts packages/ui-solid/src/canvas-paint-order.test.ts`
4. `grep -q 'containerPaintOrder(elements(), context(), backdropIds())' packages/ui-solid/src/Canvas.tsx`
