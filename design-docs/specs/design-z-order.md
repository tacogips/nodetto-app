# Z-order: the `order` edit operation and container paint order

Two related changes:

- **H1**: `nodetto-cli edit` gains an `order` operation that changes stacking.
- **H2**: containers paint beneath the elements they enclose, whatever their
  stored index says, in SVG, PNG and PDF export and on the app canvas.

## 1. Current behavior

Stored order and paint order today:

- `Store.getPageElements` sorts by fractional `index`, then id
  (`packages/core/src/store.ts`). Every consumer starts from that list.
- SVG export (`renderElementsSvg`, `packages/core/src/svg-export/document.ts`)
  takes the ungrouped roots and splits them into three layers, in this order:
  `backdrops`, `connectors`, `shapes`. The canvas (`packages/ui-solid/src/Canvas.tsx`)
  makes the same split. These two are the only page-paint paths.
- PNG rasterizes the exported SVG and PDF embeds that PNG
  (`apps/cli/src/export-command.ts`, `apps/cli/src/raster-backend.ts`). Fixing
  the SVG fixes all three formats.
- A group paints nothing itself. Its members paint inside the group's unit, in
  `memberIds` order rather than index order (`renderUnit` in
  `svg-export/document.ts`, `children` in `packages/ui-solid/src/canvas/visual-units.tsx`).
  So the renderer orders per container only for groups. Frames and BPMN surfaces
  are flat page siblings.

Why a filled frame hides its contents:

- A surface (`isConnectorBackdrop`, `packages/core/src/backdrops.ts`) is lowered
  beneath shapes only on a page with a connector. On a page without connectors
  it stays in the `shapes` layer at its index, so a frame added after a node is
  painted over it. On a page with connectors the same pair already paints
  correctly, but two surfaces in the backdrop layer can still invert (a pool
  added after its lane).
- `frameParents` (`packages/core/src/frame-tree.ts`) gives a frame ownership
  only of content above it (`compareFractional(frame.index, element.index) >= 0`
  is skipped). A frame added after a node therefore does **not** own the node. A
  rule built on `frameParents` would never fire for this bug, so H2 needs its
  own enclosure test.

Container kinds that exist in the IR:

| Kind | Paints a body? | H2 treatment |
| --- | --- | --- |
| `frame` | yes | surface |
| `bpmn.participant`, `bpmn.lane`, `bpmn.group`, expanded `bpmn.subProcess` | yes | surface |
| `group` | no | cannot hide anything; treated as one enclosed unit |
| UML package | no such element type | nothing to do |

Surfaces reuse the existing `isConnectorBackdrop` predicate, so the set of
surfaces stays defined in one place.

## 2. H2: paint-order rule

### 2.1 Decision: derive it at paint time

Paint order becomes a pure function of the page. No document data changes.

| Alternative | Why not |
| --- | --- |
| Insert below at `add` time | Existing documents stay broken, and other routes (frame tool, paste, imports, collaboration) are not covered. It also changes ownership, because the frame would start capturing the nodes, so moves and deletes change as a side effect of drawing. |
| Rewrite indexes on load | Writes to documents on open, creates collaboration traffic and needs a migration. |
| Paint all containers first, by nesting depth | Moves a container past elements it merely overlaps, so correctly ordered documents would change bytes. |
| Drop the index test in `frameParents` | Changes ownership everywhere, and that test is what stops overlapping copies capturing each other's content. |

A paint-time rule fixes existing documents and new edits through one code path.
`add` keeps its current index behavior.

### 2.2 The rule

New module `packages/core/src/paint-order.ts`, exported from `index.ts`:

```text
containerPaintOrder(elements, context, backdropIds) -> elements in paint order
```

`elements` is in z-order and may include group members. `backdropIds` is the
caller's existing backdrop partition for those elements (`connectorBackdropIds`),
so the correction always matches the layers that caller really paints. Filtering
the result preserves paint order, so callers can keep their existing layer
filters.

All ungrouped surfaces share one layer on any page: all in `backdrops` when the
page has a connector, all in `shapes` when it does not. Only a surface and an
element in the same layer can be in the wrong order, because an earlier layer
always paints beneath a later one. The correction therefore has two modes:

| Mode | When | Surfaces | Candidates |
| --- | --- | --- | --- |
| Backdrop | `backdropIds` is non-empty | the elements in `backdropIds` | those surfaces only |
| Single-layer | `backdropIds` is empty | ungrouped `isConnectorBackdrop` elements, using `groupedIds(elements)` | as defined below |

Definitions:

- **Surface**: as in the table, not hidden, not a mask source, and with a positive
  box. Surfaces inside a group keep the group's `memberIds` order.
- **Candidate**: in single-layer mode, an ungrouped element, including surfaces
  and `group` elements, that is not hidden, not a mask source, and not of category
  `edge` or `resource`. Connectors are excluded because a page in this mode either
  has no painted connector or has no surface. This also avoids computing routed
  connector bounds. In backdrop mode, shapes and connectors are not candidates
  because their layers already paint above every surface.
- **Owner of candidate E**. Owners are assigned in two passes, each in z-order. A
  link that would make E an ancestor of its own owner is rejected, as in
  `frameParents`, so owner links never form a cycle.
  1. Explicit: a frame with `memberIds` listing E. The first such frame in z-order
     wins. Area plays no part, so a smaller frame can own a larger one.
  2. Geometric, for E without an explicit owner: the smallest-area surface whose
     box encloses E's box, using `frameParents`' inclusive containment test and
     unrotated `boundsOf`. Explicit frames are skipped because they own only what
     they list. When E is itself a surface, the enclosing surface must have
     strictly larger area, so equal-box surfaces never own each other. An area tie
     goes to the highest tied surface already below E, otherwise to the lowest
     tied surface. A rejected link moves on to the next-smallest surface.
- **Depth of a surface**: the number of owner links above it.

Paint roots: a group paints all its members, nested groups included, at the
group's own position, and page-level filters leave its members out. So every
comparison and insertion below uses the positions of ungrouped elements only.
A grouped element's own position in `elements` never triggers a move and is never
an insertion point. A group counts as one candidate at its own position, enclosed
by its `boundsOf` union. Its `memberIds` order and stored indexes are not touched.

Algorithm: process surfaces by depth descending, breaking ties by z position
ascending. Every surface is then processed after all surfaces it owns. For each
surface S, find the lowest position in the current list of any candidate owned by
S. If that is below S, move S directly beneath that candidate.

Depth order is what keeps nesting correct whatever the areas are:

- A surface only ever moves down, and only once, so it stays beneath everything
  it was already beneath.
- When S is processed its owned surfaces are final, so S ends beneath all of them.
- Later moves are of ancestors or unrelated surfaces, and neither can swap S with
  anything it owns.

| Stored order | Ownership | Paint order |
| --- | --- | --- |
| `[node, outer, inner]` | `outer` encloses `inner` encloses `node` | `[outer, inner, node]` |
| `[node, parent, child]` | `parent` is smaller and lists `child`; `child` lists `node` | `[parent, child, node]` |
| `[node, group, frame]` | `group` lists `node`; `frame` encloses `group` | `[node, frame, group]`, so paint roots are `[frame, group]` |

Properties this guarantees:

- **Byte-identical output for correct documents.** A document is correct when, in
  the layers it already paints, no surface is above anything it owns. In backdrop
  mode, the only comparisons are between surfaces in the backdrop layer, so a
  surface already beneath shapes by layer never moves on their account and cannot
  disturb another backdrop. In single-layer mode, the list compared is the layer.
  Either way no move happens and the function returns the same array instance, so
  the input to the existing code is literally unchanged. In
  `[node, panel, frame, connector]` with `frame` enclosing `node` and partly
  overlapping `panel`, the stack stays `[panel, frame]`, then the connector, then
  `node`. In `[node, panel, frame, group, other]` with no connector and `group`
  listing `node`, `frame` is already beneath `group`, so the paint roots stay
  `[panel, frame, group, other]` even though `node` is stored lower than `frame`.
- **Total and deterministic.** Everything derives from the input order, which is
  itself total, and from depth and area with explicit tie-breaks.
- **Always terminates.** Owner links are acyclic by construction, and each surface
  is processed once. A document with cyclic explicit membership keeps the first
  link in z-order, as `frameParents` does.
- **Minimal.** Only a surface above something it owns in the same layer moves, and
  non-surfaces never move.

Cases that keep their authored order:

| Case | Result |
| --- | --- |
| Identical copies `[A, a, A', a']` with equal boxes | `a` is owned by `A` and `a'` by `A'`; no move |
| Surface partly overlapping a non-enclosed element | no move on that element's account |
| Larger frame overlapping a smaller frame that owns `a`, enclosing `a` but not that frame | `a` belongs to the smaller frame; the larger one stays above |
| Explicit frame above an enclosed element it does not list | no move |
| Surface above an enclosed shape, on a page with a connector | no move; the layers already paint it beneath |
| Surface above a grouped element's stored position but beneath the group | no move; the member paints at the group's position |
| Explicit frame above a group, listing only a member of that group | no move; a grouped element is not a candidate, and `planReparent` refuses to create this listing |
| Surface inside a group | keeps `memberIds` order |

### 2.3 Accepted behavior changes

Only documents with an inverted container change:

- A frame deliberately placed over an element it encloses now paints beneath it,
  as requested ("regardless of index"). To keep a covering panel, use a
  `shape.geo` rectangle, or group the frame with the element so `memberIds`
  decides. No flag is added.
- When `[E, X, S]` has S owning E in the same layer, S moves below X as well. X
  then paints over any part of S it overlaps. This matches how `planFrameSelection`
  inserts a new frame at the position of its lowest content. It happens only where
  an inversion is being corrected.
- Paint-time lowering does not grant ownership. A node drawn above a later frame
  still does not move with that frame. `order` the frame to `back` or `before`
  the node to make it an owner.

### 2.4 Consumers

| Consumer | Change |
| --- | --- |
| `renderElementsSvg` | Computes `backdropIds` as today, then `roots` filters `containerPaintOrder(elements, context, backdropIds)` instead of `elements`. The first loop over `elements`, which numbers clips, effects and gradients, stays as is. |
| `Canvas.tsx` | A new memo applies the function to `elements()` with the existing `backdropIds()`. `connectors`, `backdropRoots` and `visualRoots` read that memo. |
| `hitTestPoint` (`hit-test.ts`) | Scans `pagePaintOrder(store, pageId, context)` from the top. |
| `targetUnder` (`ui-solid/src/interaction/hit-testing.ts`) | Same, so a connector end lands on what is visible. |

`pagePaintOrder` is a small helper in `paint-order.ts`. It computes `backdropIds`
from the page's visible elements as the canvas does, using `groupOf`, and returns
`containerPaintOrder` over the whole page list. Its result is cached per context
and page array with the `WeakMap` pattern `frameParents` uses, because hit testing
can run repeatedly on one context.

SVG export and the canvas each pass their own partition, so they apply the same
rule to the layers they paint. The two can already differ in one way, which is
whether an unrenderable connector counts as a connector. Passing the partition in
keeps the correction consistent with each one's layers.

Hit testing matters mainly for BPMN surfaces, whose whole box is hit-testable; a
frame's interior is already click-through (`shapes/frame.ts`). On a page without
connectors, hit order now matches paint order for a surface and what it owns. On a
page with connectors, hit order changes only for surface-to-surface inversions. A
BPMN surface stored above an enclosed shape there still receives the click before
that shape, even though it paints beneath it. Likewise, on any page, grouped
members are still hit-tested at their own stored positions rather than at their
group's position, so a surface stored above a member is tested before it. Both
divergences exist today, and fixing them is outside this change.

Left on stored order:

- `edgeLabelAt` (edges only) and `elementsIn` (order-independent).
- The PCB branch of `canvasHitTest`, which has its own layer logic.
- The Layers panel, which shows and edits stored order and ownership.
- HTML and prototype export, which do not use the SVG page path. They walk
  owned descendants, and implicitly owned content is already above its frame.

### 2.5 Cost

The function makes no document writes. It returns early when a page has no
surface, and only candidates below the topmost surface need a geometric owner
lookup, apart from surfaces, whose depth requires one. The remaining work is
`candidates x surfaces` numeric box comparisons on cached bounds, the same shape
as `frameParents`. It must avoid per-point destructuring and regex splitting, and
must stay safe under `noUncheckedIndexedAccess`.

## 3. H1: the `order` edit operation

```json
{"op":"order","id":"<ref>","to":"back"}
{"op":"order","id":"<ref>","before":"<ref>"}
{"op":"order","where":{"type":"frame"},"expect":2,"after":"<ref>"}
```

Fields: `op`, `id`, `where`, `expect`, `to`, `before`, `after`.

- Targets resolve through `selectedWhere`, the same path `delete` uses, so id
  prefixes, `@ref`, `name:` and `where`/`expect` all work. Anchors resolve through
  `batch.element` scoped to the target page.
- Exactly one of `to`, `before`, `after` is required. `to` is one of `back`,
  `front`, `backward`, `forward`. `before` means directly beneath the anchor and
  `after` means directly above it, reading bottom to top.
- A multi-element `where` moves as one block and keeps its relative order. All
  targets must be on one page.

Scope, which follows how the renderer orders:

| Targets | Scope | Effect |
| --- | --- | --- |
| Not in a group | The page | Same as the app's z-order commands: `reorder` commands through `reorderCommands`, moving the targets plus frame contents and group members (`expandContainers`). |
| All in one group | That group's `memberIds` | `updateSemantic` on the group, permuting `memberIds`. Indexes do not change, because paint inside a group ignores them. |
| Some in a group, or in different groups | none | Error. |

Anchors:

- With page scope, an anchor counts as its whole `expandContainers` block minus
  the targets. `before` lands below the lowest element of that block and `after`
  above the highest, so a target never lands between a frame and its contents by
  accident.
- With group scope, an anchor must be a sibling in the same group.
- These are errors: an anchor on another page, an anchor inside a group when
  scope is the page, and an anchor that is one of the moving elements.

A move that changes nothing is a successful no-op with no commands, as in the
app.

Interaction with H2, to be stated in the docs:

- `order` always updates stored order; the paint rule then applies on top.
- `to: front` on a surface does not lift it above elements it owns.
- `to: back` on an element enclosed by a surface does not put it behind that
  surface. If the surface owned it implicitly, the element also stops being owned
  (it no longer moves with the frame), the same as the app's Send to Back.

Core additions, in `packages/core/src/z-order.ts`:

- `relativeOrder(ordered, moved, anchorBlock, side)`, a pure permutation
  alongside `targetOrder`.
- A planner on top of it and `reorderCommands`, with an editor facade method
  beside `reorderSelection` in `selection-editing.ts`, which owns the editor RNG.
  No new app UI: the app already has its z-order commands.

CLI, in a new module `apps/cli/src/edit/operations/order.ts`, with these small
hunks in shared files:

- `batch.ts`: one `case "order"`, `order` in the unknown-op list, and a hint for
  the aliases below.
- `operation-fields.ts`: the field list.
- `help.ts` and `docs/cli.md`: one example and one rule paragraph each.

`README.md` and `commands.ts` list no edit operations and need no change.

Unknown-op messages:

| Op given | Message includes |
| --- | --- |
| `send-to-back` | `{"op":"order","id":...,"to":"back"}` |
| `bring-to-front` | `{"op":"order","id":...,"to":"front"}` |
| `reorder` | `order` with `to`, `before` or `after` |

## 4. Documentation

- `docs/design.md`, near the artboard ownership sentence: frames paint beneath
  enclosed content regardless of stored order, and ownership still requires the
  frame to be below.
- `docs/cli.md` and `apps/cli/src/help.ts`: section 3, including the H2
  interaction.
- `design-docs/specs/design-bpmn.md` section 6.4 points here.

## 5. Verification

Fixtures use neutral self-authored names (widgets, orders, Idle, Running).

`packages/core/src/paint-order.test.ts`:

- A page with no surface, and a correctly ordered page, return the same array
  instance (`toBe`).
- A filled frame added after a node, with no connector, moves directly beneath it.
- Geometric nesting in all six stored orders of `node`, `outer`, `inner` gives
  `[outer, inner, node]`.
- Explicit nesting where area disagrees with ownership: stored
  `[node, parent, child]`, with `parent` (0,0,100,100) listing `child` and `child`
  (0,0,200,200) listing `node` (10,10,20,20), gives `[parent, child, node]`. The
  correct stored order of the same page returns the same array instance.
- Backdrop mode, already correct: stored `[node, panel, frame, connector]` with
  `frame` (0,0,200,200), `node` (10,10,20,20), `panel` (150,150,100,100) and
  `backdropIds` holding `panel` and `frame` returns the same array instance.
- Backdrop mode, inverted: a pool added after its lane on a page with a connector
  moves beneath the lane.
- Equal-box copies, partial overlap, and the larger-overlapping-frame case do not
  move.
- An explicit frame moves for a listed non-enclosed member, and not for an
  unlisted enclosed element.
- A grouped surface does not move.
- Group already correct: stored `[node, panel, frame, group, other]`, no connector,
  with `group` listing `node`, `node` (10,10,20,20), `frame` (0,0,200,200), `panel`
  (150,150,100,100) and `other` (500,500,100,100), returns the same array instance.
- Nested groups already correct: stored `[node, inner, panel, frame, outer, other]`,
  with `outer` listing `inner` and `inner` listing `node`, returns the same array
  instance.
- Genuine group inversion: `[node, group, frame]` gives paint roots
  `[frame, group]`, and `[node, inner, outer, frame]` gives `[frame, outer]`. With
  `panel` as in the first group case, `[node, panel, group, frame]` gives roots
  `[panel, frame, group]`, so `frame` stops at the group's position. `memberIds` and
  stored indexes are unchanged.
- Hidden elements and mask sources do not trigger a move.
- Cyclic explicit membership keeps the first link in z-order, so
  `[A, B]` with each listing the other returns the same array instance, as does
  `[B, A]`. A mixed cycle, where `A` lists `T` and implicit `T` encloses `A`,
  terminates with `T` owned by `A` only.

Other Bun tests:

- `hit-test` test, no connector: a point inside a pool and a task resolves to the
  task when the pool has the higher index.
- `hit-test` test, with a connector: a lane resolves before the pool stored above
  it, and a pool stored above an enclosed task keeps today's result.
- `svg-export` test: the node's markup comes after the frame's in the `shapes`
  layer. Existing goldens stay unchanged (`breadboard/export-golden.test.ts`,
  `bpmn/svg-export-layers.test.ts`, `apps/cli/src/export-determinism.test.ts`).
- `packages/ui-solid` test in the style of `bpmn-backdrop.test.ts`: the canvas
  partition reads paint order and produces the same backdrop and shape id order as
  SVG export for the no-connector, already-correct backdrop, already-correct group,
  group inversion and pool/lane cases.
  ui-solid has no rendered-canvas test to follow.
- `z-order.test.ts`: `relativeOrder` cases.
- CLI test `apps/cli/src/edit-order.test.ts`: all `to` values, `before`/`after`,
  prefix, `@ref`, `name:` and `where`; group-member scope; every error case;
  unknown-op hints.
- CLI export test: the document with the frame added after the node and the same
  document with the frame before the node produce identical SVG and PNG bytes,
  and the PNG differs from a document without the node. That shows the node is
  visible. PDF is covered by exporting successfully, since it embeds that PNG.
- `apps/cli/src/export-determinism.test.ts`: the already-correct backdrop page
  stored as `[node, panel, frame, connector]` keeps its layer order in the SVG:
  `panel` then `frame` in `backdrops`, then the connector, then `node`. Its SVG and
  PNG bytes equal those of the same page stored as
  `[panel, frame, node, connector]`, which has the same pre-change paint order and
  cannot be affected by the rule. This case does not rely on existing goldens.
- The same test file: the already-correct group page stored as
  `[node, panel, frame, group, other]` and the nested-group page keep their SVG root
  order, and their SVG and PNG bytes equal those of the same page with the grouped
  elements stored just below their outermost group, for example
  `[panel, frame, node, group, other]`. That page has the same pre-change paint
  order and no grouped element below a surface.

Native parity, in `apps/cli/src/native-parity/` (runs when
`NODETTO_CLI_TEST_BINARY` is set, through `mise run test-cli`):

- `order` batches compare stdout and stderr, then compare stored order and SVG.
  Index keys are not compared.
- The inverted-frame SVG export.

Performance: time export and an `order` edit on a realistic document with the
release native binary, comparing CPU time (`/usr/bin/time -p`) with the pre-change
binary. Existing deadlines are not relaxed. Retry native deadline tests up to 3
attempts under load before treating a timeout as a failure.

Per plan: targeted `bun test` and `bun run typecheck`. Final: `mise run verify`
and `mise run test-cli`.

## 6. Rollout and boundaries

- No schema change, migration, flag or document rewrite. Older documents get the
  new paint order on open, and `order` writes ordinary `index` and `memberIds`
  values that older readers understand.
- Sibling branches share the base commit, so new logic lives in
  `paint-order.ts` and `operations/order.ts`, with small hunks in shared files.
