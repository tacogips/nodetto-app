# Large pages: an ERD of 2,000 tables on one page

What makes a very large page slow, measured, and what the editor does about
it. The reference case is one ERD page holding 2,000 tables and 3,135
relations (each table related to its right neighbour, every second one to the
table below, and 200 relations to one hub table), in two variants: relations
with the default straight routing, and all of them orthogonal with obstacle
avoidance, which is what "arrange" leaves behind.

## 1. How it is measured

Two harnesses, both under `apps/desktop/scripts`, share the fixture document
(`fixtures/erd-scale-document.ts`):

- `erd-scale-check.mjs` mounts the real application shell over the fixture
  in headless Chrome and drives it with real mouse and wheel input. For each
  gesture it reports the main-thread time of the frames the gesture produced
  (from the first input handler to the end of style, layout and paint) and
  the browser's own split into script, style and layout. Gestures run at 100%
  zoom and at the 10% overview. `--profile` saves a CPU profile of a scenario
  and `--trace` prints the browser's time per rendering stage.
- `erd-scale-bench.ts` runs the editor core alone, without a browser.

Numbers below are medians in milliseconds per frame on the development
build; the absolute values depend on the machine, the ratios much less.

## 2. Where the time went

| Operation | Straight, before | Orthogonal, before |
| --- | ---: | ---: |
| Open the page (to first paint) | 624 | 2,702 |
| Drag one table, per frame | 104 | 2,948 |
| Rename a table, add a column | 190 | 4,400 |
| Create or delete a table, undo, redo | 225-240 | 4,450 |
| Click a table to select it | 92 | 2,924 |
| Move the pointer over the canvas | 6 | 1,407 |
| Wheel pan, 100% / overview | 26 / 42 | 29 / 48 |
| Select all / drag everything | 169 / 355 | 237 / 2,371 |

The causes, in the order they were found:

1. **Every commit recomputed every drawn element.** Each element's views
   read one "document changed" signal and one shape context rebuilt per
   commit. A drag frame re-ran on the order of a hundred thousand reactive
   computations to move one table; almost all the time was the reactive
   graph's own bookkeeping.
2. **Every edit was announced twice**, once for the store and once for the
   undo stack, so the above ran twice per edit outside a drag.
3. **Obstacle-avoiding routes scanned every shape, per connector, per
   commit.** Validating a cached route built a string key for each of the
   2,000 obstacles; with 3,135 connectors that is six million keys per
   commit. This is the overlap detection that cost seconds.
4. **Everything was in the DOM.** 160,000 nodes, half of them rows of the
   Layers panel. The browser's own hit test, style, layout and paint walk
   them on every interaction: a click spent 40 ms in native hit testing
   before any script ran, and inserting one table repainted thousands of
   layer rows.
5. **A pan visited everything that depends on zoom**, because zoom was read
   through the camera signal a pan changes.
6. **Per-commit work that grows with the page**: five planners each sorting
   the whole document for a snapshot, the slide-area overlay measuring the
   whole page while hidden, the page-tab strip forcing layout, a fresh
   picking context (and so a re-route of the page) on every pointer move.
7. **Work that grows with the selection**: dropping a drag looked for an
   adopting frame once per moved element, each time over the whole page;
   the Inspector's animation fields copied every selected element per field.
8. **The route search itself** tested every obstacle at every step.

Node-overlap lint, marquee selection and snap candidates were measured too
and are not problems at this size (1-2 ms; snap candidates are already
limited to the neighbourhood of the view).

## 3. What changed

### 3.1 Follow records, not the document (`render-scope.ts`, `adapter.ts`)

`renderScope` says what an element's drawing depends on:

- `self`: its own record. Listed types only; today `erd.table`.
- `endpoints`: its own record and its endpoints' records. Today
  `erd.relation` between self-contained nodes. With `obstacles`, also the
  shapes near the paths its route search tried (`obstacleReach`).
- `page`: anything. Every type not listed, a connector attached to anything
  not self-contained (a group moves without its record changing), and a
  connector drawn with line jumps.

The contract a listed type signs is strict, because a wrong entry is a stale
drawing rather than an error: bounds, ports, outline and warnings are a
function of the listed records and never of the zoom. A new type is
page-scoped until someone lists it.

`renderImpact` turns an announcement into what it stales: nothing for a
history-only announcement, named records for a change confined to listed
types, everything otherwise (page switches, loads, read-only and asset
changes, and any change to a page-scoped element, since frames, groups and
masks clip, hide and reorder their neighbours). To classify removed and
replaced elements the store's diff now carries the records a commit replaced
(`StoreDiff.previous`).

The Solid adapter exposes this as `signals.scene`: `record(id)` and
`track(id)` subscribe a computation to one signal per followed record, plus
one "structure" signal. Canvas units and layer rows use them in place of
`rev`. For obstacle-avoiding routes the scene tests each change's before and
after boxes against the registered reaches, so a table moved far from a
route does not re-run it. `rev` is unchanged and still fires on everything.

The adapter also provides `zoom` and `readOnly` as signals that change only
when their value does.

### 3.2 One announcement per operation (`editor/facade/core.ts`)

`apply`, `undo`, `redo`, `endBatch` and `abortBatch` announce once, after
the undo stack is in its final state. History-only announcements are marked
`ephemeral: "history"`; read-only and asset changes use their own diff.
Store subscribers are not deferred.

### 3.3 Obstacles by region (`spatial-grid.ts`, `orthogonal-routing.ts`)

A page's obstacles are indexed in a uniform grid. `avoidOrthogonalObstacles`
accepts a source that answers "what is near this segment"; a route looks at
the shapes along the paths it tries and nothing else, both when searching
and when validating a cached route. The search precomputes which grid points
and grid segments the obstacles rule out instead of testing every obstacle
at every step. Routes are identical to the previous implementation: the
list and source forms are compared against each other in the tests, and
were compared against the previous code on 9,000 random cases.

### 3.4 Mount what can be seen (`canvas/culling.ts`, `layer-window.ts`)

- The canvas mounts only elements that can paint in the view plus half a
  view of margin. The window is kept while the view stays inside it, so a
  short pan mounts nothing. Only elements with a known paint extent are
  culled (listed types without effects or shadows); extents are cached and
  revalidated by record identity, and by changed area for avoiding routes.
  Nothing is mounted before the viewport is measured, and nothing is culled
  when it cannot be measured (headless renders, tests).
- Below 25% zoom a table draws its header and outline without its rows,
  whose text would be under three pixels high.
- The Layers panel mounts only the rows near its scrolled view once a list
  exceeds 200 rows; padding keeps the scrollbar's size. Keyboard navigation
  scrolls a row into the window before focusing it, and a row being renamed
  stays mounted. Search results and the all-pages list, whose rows vary in
  height, are not windowed.

Consequences for other code: an element off screen has no DOM node. The
overlay, picking, export and the text editor work from the core and are
unaffected; a test that looks up an element's node must have it in view.

### 3.5 Smaller items

- `Store.getSnapshot` is cached per revision.
- The slide-area overlay skips measuring the page when it shows nothing.
- The page-tab strip re-measures when tab names change, not on every commit.
- Layer rows each have their own signal, written when that row's content
  changes.
- The picking context is derived once per shape context.
- A dropped drag looks for an adopting frame only on pages that have one.
- `sharedAnimationValue` reads one field without copying each element.

## 4. Result

| Operation | Straight | Orthogonal |
| --- | ---: | ---: |
| Open the page (to first paint) | 624 → 81 | 2,702 → 144 |
| Drag one table, 100% | 104 → 10 | 2,948 → 13 |
| Drag one table, overview | 114 → 14 | 2,944 → 20 |
| Rename a table, add a column | 190 → 10 | 4,400 → 13 |
| Create / delete a table | 239 / 231 → 13 / 19 | 4,470 → 14 / 18 |
| Undo, redo | 224-231 → 10-12 | 4,430 → 11-13 |
| Click a table to select it | 92 → 23 | 2,924 → 20 |
| Move the pointer over the canvas | 6 → 4 | 1,407 → 4 |
| Wheel pan, 100% / overview | 26 / 42 → 7 / 8 | 29 / 48 → 5 / 10 |
| Select all | 169 → 56 | 237 → 64 |
| Drag everything | 355 → 59 | 2,371 → 104 |
| DOM nodes | 159,796 → 3,825 | 159,796 → 3,825 |

## 5. What is left

- Panning at the overview hitches for one frame (about 100 ms) each time the
  view leaves the mounted window and several hundred tables mount at once.
  Mounting them over a few frames would smooth it.
- Selecting or dragging thousands of elements at once is still proportional
  to the selection (56-104 ms per frame for all 2,000 tables).
- Each commit still makes a few passes over the page's element list (paint
  order, culling, layer rows, a planning copy of the page for derived
  commands): about 8 ms of script per commit at this size.
- Only `erd.table` and `erd.relation` are listed in `render-scope.ts`. Pages
  of other node types keep the previous behaviour until their types are
  audited and listed.
