# nodetto-cli: layered and route arranging, three-way merge, edit usability, lint additions

Status: DESIGNED, 2026-11-04. Plan partition revised for maximum concurrency
the same day (see "Plan partition"). Extended the same day for the
continuation run: A7 multi-page root cause, three integration fixes (A1 TB
title band, A1 frame-order ranks, D3 path normalization), new groups E
(container carry and page-kind coverage) and F (element selectors), and a
continuation plan partition that replaces the clm-s725 one. Revised
2026-11-05 for continuation 3: owner decisions D1 and D2 (E2.1 lane boxes and
depth-dependent inset), D3 (A7 attribution and ratio ceiling), and the
"Continuation 3 partition", which replaces the earlier waves. Revised again
2026-11-05 for continuation 4: owner decision D3' replaces D3 ("A7 decision
D3'"), and the "Continuation 4 partition" replaces the continuation 3 waves.
Revised again 2026-11-05 for continuation 5: the owner's Q11 direction (keep
depth-one behavior, document it, do not block), the as-built E1 geometry errors
and E2.1 refusals, and the "Continuation 5 partition" for finishing clm-09.

Revised by `design-docs/specs/design-connector-routing-arranging.md`
(2026-11-06): A2 reset fields, A3 label candidates and offsets, A4 self-loop
reservation, A5 side order and freed sides, and the `lint --metrics` fields.

Owner decisions: `design-docs/user-qa/cli-layout-merge-lint.md`. Each open
question has a default that this design implements. Q11 has no chosen option,
but the owner directed that current depth-one behavior stays and that Q11 blocks
nothing. A different answer changes only the section named in that question.

Baseline: `design-docs/specs/design-cli-ai-drawing.md` (commands, edit
batches, live co-editing merge), `design-docs/specs/design-text-layout-lint.md`
(lint rules and wide-aware widths), `design-docs/specs/export.md` (export
pipeline) and `design-docs/specs/native-hosts.md` (shared engine in Boa). Those
decisions stay as they are. This document adds only the behavior below.

## Overview

Six groups of additive CLI behavior. They all run in the shared TypeScript
engine, so the Bun CLI and the native CLI (Boa) behave the same.

| Group | Adds |
| --- | --- |
| A arrange/routing | `arrange --mode layered`, `arrange --mode route`, edge label placement, port spreading, self-loop sides, `carryMembers:false` on frame `update`, edit performance with obstacle routing (single-page and multi-page documents) |
| B merge | `nodetto-cli merge <base> <ours> <theirs> [--output]`, git merge driver setup, documented SVG export determinism |
| C edit usability | `label` on `update`, unknown operation fields rejected with suggestions, collapsed repeated warnings, global `--quiet` |
| D lint | `node-overlap` (ERD and other node pages), `image-missing`, `lint --fix` text wrapping, `lint --metrics` (crossings and label overlaps) |
| E containers and page kinds | `carryMembers:false` for every carrying container kind on move and resize (E1); layered and route arranging, label placement, port spreading, self-loops and metrics on BPMN and ERD pages, with documented exclusions (E2) |
| F element selectors | `name:<text>` references (F1), `where` with `expect` on `update` and `delete` (F2), the `select` operation (F3), and their validation, help and parity (F4) |

### Boundaries

- Shared engine (`packages/ir`, `packages/core`): new connector semantic
  fields, resolver geometry, layered placement, route planning, metrics, the
  text wrapper and the three-way merge. Everything is pure and does no I/O.
- CLI (`apps/cli/src`): argument parsing, command dispatch, help, warning
  formatting, file access through `CommandIo`, and the `merge` and `lint --fix`
  write paths.
- Native host (`apps/cli/native`, `crates/native`): **no Rust changes.** The
  native CLI runs `runCli` from the bundled engine
  (`apps/cli/src/native-engine.ts`). The host functions it needs already exist:
  `readText`, `writeBytes` (atomic), `exists` and `attachment` (confined
  read). `--quiet` is handled in TypeScript. If profiling for A7 shows a
  host-side cost, the A7 plan may change Rust, under the rules in A7.
- Public repo boundary: none of this adds server, auth or deployment code.

### Determinism rules (every new algorithm)

- Stable element order means ascending element id compared by UTF-16 code
  unit, within one page. This is the order of the canonical serializer
  (`compareElements` in `packages/io/src/jsonl/serialize.ts`). Results never
  depend on file line order, `Map` insertion order taken from parse order,
  time, locale or environment.
- Positions and sizes that arranging writes are rounded to integers. Written
  fractions (`labelPosition`, `fromPortPosition`, `toPortPosition`) are rounded
  to 4 decimals.
- Boa rules: no regex `String.prototype.split` on whole documents, and no
  per-point destructuring in hot geometry loops. New code that iterates
  geometry uses indexed loops with `noUncheckedIndexedAccess`-safe access.

## Shared IR additions (connector semantics)

These are new optional fields on `ConnectorRoutingSemantic`
(`packages/ir/src/semantics/connectors.ts`). The shared routing validator in
`packages/ir/src/registry/generic.ts` validates them, and they are added to the
`keyOrder` of every connector type whose key order lists `routingBend`
(generic, UML, ERD and BPMN registries). That way no type reports them as
`semantic.unknownField`.

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `labelPosition` | number 0..1 | 0.5 | Where the label anchor sits along the route length. Replaces the fixed 0.5 in `withRoute` (`shapes/connector/route.ts`). |
| `fromPortPosition` | number 0..1 | 0.5 | Where the attachment point sits along the side named by `fromPort`: 0 is the top or left end, 1 the bottom or right end, before rotation. Ignored without `fromPort`. |
| `toPortPosition` | number 0..1 | 0.5 | The same for `toPort`. |

Rules:

- Validation: a finite number in [0, 1]; anything else is an error naming the
  path. A position field without its port is a warning
  (`semantic.portPositionWithoutPort`) and has no effect.
- Every renderer reads the label anchor from `resolveConnector(...).labelPoint`
  (core SVG export, UI connector view, label box, text-layout lint). The new
  field therefore changes all of them the same way. Without the field, output
  stays byte-identical.
- `pinnedPort` (`shapes/connector/boundary.ts`) takes the position: the
  outward target point moves along the side by `(position - 0.5) * side
  length`, and then the existing `resolvedBoundary` projection applies. The
  four handle points from `connectionPorts` (UI) stay at the midpoints.
- Same-side self-loop (new resolver case): a connector whose `from` equals its
  `to`, with `fromPort` and `toPort` both set to the same side, is drawn as a
  loop on that side. The route leaves at the from-position, goes 40 units out
  along the side normal, runs parallel to the side and comes back in at the
  to-position (defaults 0.3 and 0.7 when the positions are absent). This case
  comes before the generic orthogonal case. It applies to every connector type
  except `erd.relation`, which keeps its own self-relation geometry, and
  `sequence.message`. Before this change, that input produced a degenerate
  zero-length orthogonal route. Self-loops without ports keep today's
  right-and-top loop.
- Forward compatibility: an older build reads the fields as unknown and keeps
  them (existing `semantic.unknownField` behavior).
- `packages/ui-solid/src/connector-routing.ts` lists the routing keys. If that
  list is used to clear or copy routing state, the new keys are added to it.
  No new inspector controls are part of this scope.

## A. arrange and routing

### Eligible pages

Revised by E2. `--mode layered` accepts pages of kind `state`, `flowchart`,
`freeform`, `architecture`, `uml` and `erd` (frames as columns, A1) and `bpmn`
(pools and lanes as rows, E2.1). `--mode route` accepts the same seven kinds.
On `sequence`, `breadboard` and `pcb` pages both modes exit 2 with a message
that names the supported kinds. The exclusions and their reasons are in E2.
`--mode tidy` and `--mode overlaps` are unchanged.

### CLI surface

```text
nodetto-cli arrange <doc.jsonl> [--mode tidy|overlaps|layered|route]
    [--direction LR|TB] [--page <short-id|id|name>]
    [--frames <id|name,...>]        # layered only
    [--ids <id,...>]                # route only
    [--reset-manual]                # layered and route
    [--write] [--check]
```

- Passing `--frames` without `layered`, `--ids` without `route`, or
  `--reset-manual` with tidy or overlaps exits 2 (usage).
- `--write`, `--check`, stdout output and exit codes are the same as today.
  `--check` exits 1 when the arrangement would change anything.
- `edit --arrange` keeps running Tidy only.

### A1. `--mode layered`

Units:

- A column frame is a `frame` element on the page that no other frame contains,
  using `frameParents` from `frame-tree.ts`, the editor's geometric membership.
- A unit is a top-level layer that is not an edge, `resource`, frame or group
  child: a node, a note, a group (moved as one) or a nested frame (moved with
  its contents). Each unit belongs to one column frame, or to none.
- A page with no column frames exits 2: "arrange --mode layered needs frames
  on the page; use --mode tidy".

Traversal rank (the order members are stacked in):

1. Edges are connectors on the page whose two endpoints map to units (an
   endpoint inside a group maps to that group). They are read in stable order.
   Self-loops are ignored for ranking.
2. The first start is the first `state.node` of kind `initial`. If there is
   none, it is the first unit in stable order with in-degree 0. If there is
   none of those either (every unit is on a cycle), it is the first unit in
   stable order.
3. Breadth-first search follows outgoing edges, with neighbors in stable edge
   order. When the search runs out, the next start is the first unvisited unit
   with in-degree 0 among the unvisited units, else the first unvisited unit.
   This repeats until every unit is ranked. Rank is the visit index.

Frame order:

- With `--frames`, the listed frames come first in the given order. Each value
  resolves like `ddl --frame` (exact id, then exact `semantic.name`, then a
  unique id prefix of at least 6 characters) among the column frames on the
  page. An unknown, ambiguous, duplicate or non-column value exits 2 and lists
  the column frames (short id, name, full id).
- The frames that are not listed follow, ordered by the smallest member rank.
  Frames without members come last, in stable order.
- Integration fix 2: the comparator never searches. Before sorting, one pass
  over the ranked units computes each unit's column frame once (`ownerOf`
  map) and records each frame's smallest member rank (`firstRank` map), and
  the `--frames` positions are a `Map` from frame id to index. The comparator
  and the per-column member lists read only these maps, so ordering is
  O(F log F) after an O(U x depth) pass. The resulting order is unchanged.
- Units in no frame form one free column without a box, placed after all
  frames.

Geometry, for `--direction LR` (default):

- Origin: the integer-rounded top-left of the current union bounds of all
  column frames and units on the page. Arranging leaves that top-left in
  place, so a second run is a no-op.
- Columns go left to right with gap `COLUMN_GAP = 120`. Inside a column the
  members are stacked top to bottom by rank with gap `MEMBER_GAP = 60`, and
  each member is centred on the column axis.
- Frame box: padding `FRAME_PADDING = 40` on every side, plus the height of
  the frame's own title band at the top when the frame renderer draws its name
  inside the box. The plan reads that height from the frame shape util and does
  not hard-code it. Frame width is the widest member plus padding, and frame
  height is the member stack plus padding. The frame's x, y, width and height
  are written with `updateVisual`.
- Members are moved with their positions in the `placed` set, so
  `planFrameTranslations` does not carry them a second time. Every member ends
  inside its frame, so geometric membership is unchanged.
- `--direction TB` transposes the stacking only: frames become rows top to
  bottom, members run left to right and are centred on the row axis.
- Integration fix 1: the title band is never transposed, because the frame
  renderer always draws the title at the top. In TB a framed row has width
  `stack + 2 * FRAME_PADDING` and height `cross + 2 * FRAME_PADDING + title`,
  the first member starts at `x + FRAME_PADDING`, and every member's y is
  `y + title + FRAME_PADDING + (cross - member height) / 2`, rounded. `title`
  is `FRAME_TITLE_BAND` (exported by `packages/core/src/shapes/frame.ts`) when
  the frame shows its title, else 0. LR is unchanged: the band is added to
  the height and the first member starts at `y + FRAME_PADDING + title`.

After placement, layered runs the route stage (A2 to A5) on every connector of
the page, with the same `--reset-manual` value.

### A2. `--mode route`

- Moves no element. It only changes connector semantics.
- Targets: every connector on the page whose two ends are attached to
  elements, or only `--ids`. Each `--ids` value is a unique id prefix of a
  connector on the selected page; anything else exits 2. `sequence.message`
  is never a target, because sequence pages are not eligible. `erd.relation`
  and the BPMN connectors (`bpmn.sequenceFlow`, `bpmn.messageFlow`,
  `bpmn.association`, `bpmn.dataAssociation`) are targets with the per-kind
  rules in E2.2.
- A manual connector is one with `routing: "manual"`, or with `fromPort` or
  `toPort` set. Values that an earlier arrange wrote count as manual too,
  because nodetto cannot tell who set them
  (user-qa Q6).
- Without `--reset-manual`, a manual connector keeps `routing`,
  `routingWaypoints`, `routingBend`, its ports and its port positions. Its ends
  still take part in spreading as fixed ends (A4), and its label is placed (A3).
- With `--reset-manual`, every target is reset before planning, whatever
  its previous `routing` value. `routing` is set to `"orthogonal"`, and
  `routingWaypoints`, `routingBend`, `fromPort`, `toPort`, `fromPortPosition`,
  `toPortPosition` and `labelPosition` are removed. Because `routing` is no
  longer `"manual"` and no port is set, the manual test above is false for
  every reset target, so each one goes through the planning below. The
  resolver then routes it through its orthogonal, obstacle-avoiding branch
  (`resolve.ts`), not the manual branch. A connector that is not a target is
  never reset.
- Every target that is not manual (after any reset) gets `routing:
  "orthogonal"`, loses a `routingAvoidObstacles: false` (the default is true),
  and gets ports:
  - If the two centres are offset at least as much horizontally as
    vertically, the ends use `right`/`left` (or `left`/`right`). Otherwise they
    use `bottom`/`top` (or `top`/`bottom`). A tie counts as horizontal.
  - Self-loops follow A5 instead.
- The existing resolver does the obstacle-avoiding route at render time
  (`avoidOrthogonalObstacles`). Route mode stores only its inputs, so every
  renderer and the export show the same route.
- Commands go through `editor.apply`, so derived state and validation are
  what the app produces.

### A3. Edge label placement

- This runs on every target connector with a non-empty label, in stable
  order. The label is the field `connectorDecoration` reads: `trigger`,
  `guard` or `effect` text for transitions, `label` for generic edges.
- The route is resolved once per connector, after the port and self-loop
  commands are applied to the planning store. Candidates for `labelPosition`
  are tried in order: 0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9. For each one the
  label box is computed at that point on the resolved route, with the same
  layout as `connectorLabelBox`.
- Score: the number of overlaps with the label boxes already placed, the boxes
  of label obstacles (endpoints included), and the route segments of other
  connectors. A label obstacle is every element that is not an edge and not a
  containing surface. Containing surfaces are `frame`, `group`, and on BPMN
  (E2.2) `bpmn.participant` unless `collapsed: true`, `bpmn.lane`,
  `bpmn.subProcess` with `expanded: true`, and `bpmn.group`. A collapsed pool,
  a collapsed sub-process, tasks, events, gateways, data objects and
  annotations stay obstacles. One predicate, `isLabelObstacle(element)` in
  `packages/core/src/diagram-lint/metrics.ts`, is used by both this score and
  `lint --metrics`. The first candidate that scores 0 wins.
  Otherwise the lowest score wins, and ties go to the earlier candidate.
- The field is written only when the result is not 0.5. A 0.5 result removes
  the field. `labelPosition` is not a manual setting: it is recomputed on every
  run. Because the computation is deterministic, the result is idempotent.

### A4. Port spreading

- Group every connector end (target or not) that has a port, by (element,
  side). Self-loop ends are excluded.
- In a group of n > 1 ends, order the ends by where the opposite endpoint's
  centre projects onto the side axis (x for top and bottom, y for left and
  right). Ties go to stable connector order, then from-end before to-end.
- Fixed ends are ends that this run does not write: ends of manual
  connectors, and ends of connectors that are not targets (outside `--ids`).
  Each fixed end reserves its actual coordinate, which is its stored position
  or the default 0.5 when no position is stored. The remaining ends are
  movable, and they keep the projection order above.
- No fixed end in the group: the k-th movable end (0-based) of m gets
  `(k + 1) / (m + 1)`, rounded to 4 decimals. When m = 1, no position field
  is written (the default 0.5 applies).
- One or more fixed ends: movable ends are placed into the gaps that the
  fixed coordinates leave on the side.
  1. Sort the fixed coordinates, then add the side ends 0 and 1 as
     boundaries. This gives the gaps between consecutive coordinates.
  2. Give each movable end, in projection order, to a gap. Each end goes to
     the first gap, in left-to-right order, whose upper boundary is above the
     end's ideal coordinate `(k + 1) / (m + 1)`. If the end would land before
     the gap already used by the previous movable end, it goes to that gap
     instead. This keeps the projection order along the side.
  3. In a gap (a, b) that holds j movable ends, the i-th of them (0-based)
     gets `a + (b - a) * (i + 1) / (j + 1)`, rounded to 4 decimals.
  4. Movable ends never take a coordinate within 0.0001 of a fixed
     coordinate or of another movable end. If rounding causes such a
     collision, the end moves 0.0001 away from the collision inside its gap.
     If the gap is too narrow for that (narrower than 0.0002 per end), the
     end goes to the widest gap, with ties going to the leftmost.
  5. Every movable end gets its position written, including 0.5, so later
     runs are stable.
- Example: a fixed end at 0.6667 and one movable end. The movable end's ideal
  coordinate is 0.5. The first gap whose upper boundary is above 0.5 is
  (0, 0.6667), so the end is placed at `Math.round(0.6667 / 2 * 10000) / 10000`
  (0.3333 or 0.3334 depending on IEEE rounding), and never on 0.6667.
- Fixed ends are never written. The same input always gives the same
  allocation, so a rerun is idempotent.

### A5. Self-loop placement

- For each self-loop target, in stable order, choose the first side in the
  order `right`, `top`, `bottom`, `left` that no end of another connector on
  that element uses, counting sides already taken by earlier self-loops. If
  every side is used, choose the side with the fewest ends, with ties broken by
  the same order.
- Write `fromPort` and `toPort` set to that side, `fromPortPosition: 0.3` and
  `toPortPosition: 0.7`. The new same-side self-loop resolver case draws it.

### A6. Frame move semantics and `carryMembers`

- The default is unchanged. An `update` that changes a frame's `visual.x` or
  `visual.y` (and `move` of a frame) also moves the elements inside it,
  including elements that an earlier operation in the same batch positioned.
- `{"op":"update","id":"<frame>","visual":{"x":..,"y":..},"carryMembers":false}`
  moves only the frame box. The update collects the frame's current
  descendants (`frameParents`) and passes them in the `placed` set, so
  `planFrameTranslations` skips them. Membership is geometric, so members that
  end up outside the moved box are no longer members. The help says so.
- `carryMembers` must be a boolean. `move` does not take it.
- Superseded by E1 for the accepted element types, the resize behavior and
  the error text: E1 generalizes this section to every carrying container
  kind. The frame default and the frame opt-out described here stay as they
  are.
- Help (`edit`) documents the default and the opt-out per kind (E1 table).

### A7. Edit performance with obstacle routing

Problem: one `edit` batch of about 50 `update` operations that set
`routingAvoidObstacles: true`, on a state page with about 20 states and 3
frames, takes more than two minutes in the native CLI.

Required approach:

1. Fixture: a self-authored generator in the test tree. It builds one state
   page with 3 frames (`Stage0` to `Stage2`), 20 `state.node` elements
   (`Idle`, `Running` and similar neutral names, one `initial`) and 50
   `state.transition` elements with `routing: "orthogonal"` and
   `routingAvoidObstacles: false`, all with fixed integer geometry. The ops
   file is 50 `update` operations that set `routingAvoidObstacles: true`.
2. Profile before fixing, with both the release native binary
   (`cargo build --release -p nodetto-cli`, `/usr/bin/time -p`) and Bun CPU
   profiling. Record which work repeats per operation. Candidates: derived
   planning rebuilding stores or shape contexts per command, route caches keyed
   by a fresh `ShapeContext` per operation, frame membership resolving every
   connector route, and full validation per operation. The plan records the
   confirmed root cause and its timing in its progress notes.
3. Fix with these invariants:
   - The written document is byte-identical to the pre-change output, for the
     fixture and for every existing edit test.
   - Operation-index error reporting, all-or-nothing semantics and the
     concurrency re-apply stay as they are.
   - Allowed techniques: per-batch memoisation keyed by unchanged inputs (page
     obstacle geometry per store version, a resolved route per connector
     object), skipping derived planners whose trigger conditions the commands
     cannot meet, and avoiding per-operation full-document copies.
4. Tests:
   - Bun: the fixture edit finishes in under 10 s.
   - Native: a deadline test in `apps/cli/src/native-parity/` runs the fixture
     with the release binary in under 10 s (spawn timeout 60 s, test timeout
     120 s) and compares output with Bun.
   - Existing deadlines are not relaxed.
   - Manual check: release binary CPU time (`/usr/bin/time -p`) of at most
     about 3 s, compared against the pre-change binary.

### A7 continuation: per-operation cost must be bounded by the edited page

Status at HEAD 4d82d91: the single-page fixture passes (native about 0.56 s,
expected-output hash `341fcd8654fc18d560c8895df1a05617a6b8ac39`), and one
duplicate full snapshot per operation was removed. The original report was not
reproduced, because the fixture has one page.

Owner evidence (native release binary, HEAD): the same 50-operation batch
takes about 3.4 s when the document also holds a second, unrelated page of
600 `node.generic` and 300 orthogonal, obstacle-avoiding `edge.generic`
(973 elements in total). A mixed batch (20 state moves, 3 frame moves, 50
connector updates) takes 5 to 6 s. Per-operation cost therefore scales with
the whole document, including pages that the batch never touches.

Page-unbounded work per operation found by reading the code (the plan
confirms which of these dominate with a profile before changing them):

- `planDerivedCommands` (`packages/core/src/editor/transaction.ts`): a full
  sorted `store.getSnapshot()` (sort by `compareSnapshotOrder`), a full
  `new Store(snapshot)` draft copy, a second full copy for `beforeLayout`,
  feature scans over every element, and BPMN, breadboard and PCB guards that
  scan `listElements()` of both stores.
- `planConstraints` (`constraints.ts`): `frameParents` for every page with a
  fresh context, and a visit of every element.
- `planFrameTranslations` (`frame-translation.ts`): `frameParents` for every
  page once any frame moves (the mixed batch).
- `planAutoLayout`, `planTextResize`, the token and style planners and
  `planManualRoutePreservation`: whole-document scans or snapshots.
- `applyBatch` (`apps/cli/src/edit/apply-batch.ts`): two full element maps per
  operation to find touched elements.
- `applyCommands` (`packages/core/src/commands.ts`), called by
  `EditorCore.apply` (`packages/core/src/editor/facade/core.ts`) on the live
  store: it copies every element and page of the document into working maps
  on every call (added 2026-11-04, continuation 2).
- `EditorCore.createShapeContext` (`facade/core.ts`): the cached context is
  keyed by `store.revision`, so every apply builds a fresh context, and its
  lazy whole-document caches (`layerStates` in `layer-state.ts`, `frameClips`
  and `layerClipPolygons` in `clipping.ts`) are rebuilt on first use. The
  profile decides whether these must become page-scoped.

`applyCommands` keeps its exported signature, its atomicity (an invalid
command leaves the store unchanged and emits no diff), its `CommandResult`
(`undo`/`redo` content and order) and its `CommandError` messages; only its
internal copying becomes bounded by the elements and pages the commands
name. `arrange-route.ts` and other callers keep working unchanged.

Required behavior:

- Dirty pages. For each `editor.apply`, the dirty pages are the pages of
  every element that a permitted command creates, updates or deletes, plus
  pages created, changed or deleted by page commands. Every derived planner
  runs only on the dirty pages and produces exactly the commands it produces
  today. Planner commands on a dirty page may make another page dirty only
  through the cross-page cases below.
- Cross-page dependencies widen the dirty set to the whole document for that
  apply, exactly as today: a changed element that elements on other pages
  depend on (`design.token`, `design.text-style`, a component master read by
  `planAutoComponentRefresh`, or any element whose id another page references
  through the registry's `references(semantic)`), and any page command. The
  plan lists every planner and states whether its trigger reads only
  same-page state, and adds a test per cross-page case.
- No per-operation work may sort, copy, validate or build shape contexts for
  elements of pages outside the dirty set. Cheap O(document) identity scans
  are allowed only if the timing target is met with them.
- Per-batch memoization keyed by unchanged inputs stays allowed (A7 step 3).
- Unchanged: byte-identical output, operation-index errors, all-or-nothing
  semantics, the concurrency re-apply, and planner command order on each
  page.
- Rust changes are still out of scope unless the profile shows a host cost.

Fixtures (self-authored, extending `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`):

- `multiPage`: the single-page fixture plus a second `freeform` page `Grid`
  with 600 `node.generic` (`Widget000` to `Widget599`, a 30 x 20 grid with
  fixed integer geometry) and 300 `edge.generic` between grid neighbours,
  each with `routing: "orthogonal"` and `routingAvoidObstacles: true`. The
  ops are the same 50 updates.
- `mixedMultiPage`: the `multiPage` document with 20 `move` of state nodes, 3
  `update` frame moves (`visual.x`/`visual.y`) and 50 connector `update`
  operations, in a fixed interleaved order.
- `mixedSinglePage`: the same mixed ops on the single-page document, as the
  timing reference.
- Expected outputs `obstacle-routing-batch.multi-page.expected.jsonl` and
  `obstacle-routing-batch.mixed-multi-page.expected.jsonl` are produced with
  the pre-change code (Bun on HEAD before any A7 source edit) and checked
  against `target/clm-baseline/nodetto-cli`. They are committed and never
  regenerated after the fix. The single-page expected hash stays
  `341fcd8654fc18d560c8895df1a05617a6b8ac39`.

Tests and targets:

- Bun (`apps/cli/src/edit-performance.test.ts`): each multi-page fixture is
  byte-identical to its expected file and finishes in under 10 s.
- Native (`apps/cli/src/native-parity/edit-performance.test.ts`): the same
  fixtures with the release binary, under 10 s each (spawn timeout 60 s, test
  timeout 120 s), byte-identical to Bun. 3-attempt retry on a deadline
  timeout under load. Existing deadlines are not relaxed.
- Target: superseded. The timing target and its measurement are defined by
  "A7 decision D3'" below. The whole-command ratios are no longer a target.

### A7 decision D3: attribute first, then remove, then decide

Superseded by "A7 decision D3'". This section is history: its probe harness,
phase table, whole-command ratios, 2.0 x ceiling, `single/baselineSingle` limit
and outcome lines do not apply. The three expected hashes in step 3 stay binding.

Status at HEAD d5b9bac: user CPU on one release build is single 0.54 s, multi
1.24 s (2.30 x), mixed single 0.72 s, mixed multi 1.33 s (1.85 x). Earlier runs
in the same log measured single 0.92 s, so timings vary by run. No native
per-phase attribution exists yet: Bun profiles do not predict Boa costs.

Order of work:

1. Attribution. Write a probe entry under `target/clm-a7-probe/` that runs the
   fixtures through the same steps as `applyBatch`, with a timer around each
   phase. Bundle it with `bun build --target browser --format iife`. Run it in a
   temporary `apps/cli/native/examples/clm-a7-probe.rs` that hosts the bundle in
   Boa, provides `TextEncoder` and `Intl` polyfills, and exposes a clock from
   Rust. Tracked source is not instrumented, and `Cargo.toml` and `Cargo.lock`
   do not change.
   - Phases: parse with validation, `Editor` construction, the first apply and
     later applies separately, and inside an apply `createShapeContext`,
     `permittedCommands`, `dirtyPages`, `getScopedSnapshot` and the scoped
     `Store`, each planner in `planDerivedCommands`, and `applyCommands`; then
     per-operation bookkeeping in `applyBatch`, and final snapshot, validation,
     warnings, change counts and serialization.
   - Run all four fixtures. Measured phases must cover at least 90% of the
     probe's total time for each fixture; otherwise split the largest phase and
     measure again.
2. Classification. For each phase, record its time on the single-page and
   multi-page fixture and one class:
   - (a) Document-wide work repeated per operation. This is forbidden by "A7
     continuation" and must be removed.
   - (b) Document-wide work done once per batch that can be skipped, shared or
     done once instead of several times with byte-identical output. Remove it.
   - (c) Document-wide work required by an accepted rule: parsing and validating
     the input, validating and serializing the whole result, and the
     first-apply whole-document pass that normalizes stale derived values.
3. Removal. Remove what classes (a) and (b) identify, for example repeated sorted
   full-document snapshots. The expected hashes stay
   `341fcd8654fc18d560c8895df1a05617a6b8ac39` (single),
   `872e266430b5a59930a4f87474869514a2c126cc` (multi) and
   `4f5c88d5b1c4bc44c3afbd743fb76089bb0d34aa` (mixed multi), and expected files
   are never regenerated.
4. Cleanup. Delete the probe harness and the `examples` directory; nothing from
   the probe stays in the tree. Evidence keeps the phase tables, not the harness.

Measurement: five `/usr/bin/time -p` runs per fixture on one release build, one
after another, using the median user CPU; all runs are logged. The single-page
median may not exceed 1.1 x the same-session median of
`target/clm-baseline/nodetto-cli`, so that a ratio cannot improve by slowing the
denominator.

Outcome rules, applied to both ratios:

- Both at most 1.5 x: met.
- Either above 1.5 x and both at most 2.0 x: accepted only if the remaining
  phase table shows no class (a) or (b) work left and the gap is class (c). The
  evidence and the reason go in the progress log and in the "A7 attribution
  record" below. This acceptance does not block the plan.
- Either above 2.0 x after all class (a) and (b) work is gone: the owner's
  decision does not cover this. The plan stops and reports a blocker finding
  with the phase table (user-QA Q12). It does not raise the ceiling, and it does
  not change a fixture to fit the ratio.
- Absolute deadlines and existing deadline tests are never relaxed.

### A7 attribution record

Not used. D3' records timings in the clm-02 progress log and requires no
attribution record, so this subsection stays empty.

### A7 decision D3': marginal per-operation cost and page-scoped writing

Owner decision, replacing D3. Owner measurement on the native release binary at
edb9ad2, user CPU:

| Document | `validate` | `edit`, 1 op | `edit`, 50 ops | Marginal cost of 49 ops |
| --- | --- | --- | --- | --- |
| single page | 0.79 s | 0.86 s | 1.37 s | 0.51 s |
| multi page (17 x larger file) | 1.17 s | 2.33 s | 2.93 s | 0.60 s (1.18 x) |

Per-operation work is already page-bounded. Loading, validating, serializing and
writing a 17 x larger file is inherently document-sized, so the whole-command
ratio was the wrong metric. Absolute values vary between sessions (the clm-02
log has lower numbers on another run), so only same-session values are compared.

#### Acceptance (a): marginal cost

- New fixture data: `oneOpOperations`, the first `update` of the 50-op list,
  exported from `apps/cli/src/__fixtures__/obstacle-routing-batch.ts` and applied
  to both the single-page and the multi-page document.
- Six inputs: single 1 op, multi 1 op, single 50 ops, multi 50 ops, mixed single,
  mixed multi. Five `/usr/bin/time -p` runs each on one release build, one after
  another, using the median user CPU. All runs are logged.
- `batch ratio = (multi 50 ops - multi 1 op) / (single 50 ops - single 1 op)`
- `mixed ratio = (mixed multi - multi 1 op) / (mixed single - single 1 op)`
- Both ratios must be at most 1.5. A ratio above 1.5 means per-operation work
  that is not page-bounded, which "A7 continuation" forbids: clm-02 profiles the
  batch and removes it. If it cannot, it reports a blocker finding with the
  measurements. It does not raise the limit or change a fixture.

#### Acceptance (b1): post-batch validation covers only changed pages

Validation calls in the `edit` path at HEAD:

| Call | When | D3' |
| --- | --- | --- |
| `parseDocumentResult` -> `validateDocument` | input, once per attempt | unchanged |
| `unknownFields`, `apply-batch.ts:89` | per changed element, on a one-element document | unchanged: already bounded by the element |
| `validateDocument(snapshot)`, `apply-batch.ts:165` | post-batch, whole document | scoped to changed pages |
| `assertValidDocument`, `serialize.ts:166` | post-batch, the same snapshot again | skipped on this path with the existing `{ validate: false }` |

The last call can never throw on this path, because line 165 throws first on the
same snapshot. `serializeDocument` keeps validating by default for every other
caller.

Changed pages:

- `applyBatch` records them for the whole batch from `store.subscribe` diffs. For
  an added or updated id: the page of the current element, and the pre-batch page
  from `before`. For a removed id: the pre-batch page.
- A diff with `pagesChanged` makes the batch whole-document, which also covers
  `loadDocument`.
- Tracking must include the `--arrange` applies, which run after today's
  `unsubscribe()`.
- `dirtyPages()` is deliberately not the source. It is a per-apply planning
  estimate that returns `undefined` for the first apply of every batch (no prior
  `lastApplyStoreRevision`), so it would keep every batch whole-document. The
  diffs also include derived changes that planning produced on other pages.

Scoped validator: `ValidateOptions.elementPages?: ReadonlySet<string>` in
`packages/ir/src/validate.ts`. Without it, behavior is unchanged. With it:

- The document fields and every page record are still checked.
- The id set, `elementById` and the `id.duplicate` check still scan all elements.
- `validateElement` and the reference checks run only for elements whose `page`
  is in the set. An element whose `page` is not a string is always in scope.
- Issue paths keep the element's index in `document.elements`, because
  `unknownFieldKey` reads `snapshot.elements` by that index. Issues on in-scope
  elements are identical to full validation, in the same relative order.

Why this cannot miss cross-page breakage, from `validate.ts` at HEAD: errors on an
element depend only on that element and the set of page ids, and page changes are
whole-document. Every check that reads another element (`connectorEndpointIssues`,
`reference.dangling`, `bpmn.parentType`, `bpmn.attachedToType`) emits only
warnings. `applyBatch` uses only errors and `semantic.unknownField` warnings, and
drops unknown-field keys already in the parse baseline, which covers every
untouched element. So error text, warnings and written bytes do not change, and no
widening by `crossLinkedPages` is needed.

#### Acceptance (b2): serialization reuses verified source lines

The only source of an untouched element's canonical text without re-stringifying
it is its input line, and input may be hand-written or otherwise non-canonical. A
line is therefore reused only when it is proven equal to what the writer would
produce. Everything else goes through the writer, line by line, so a non-canonical
input still gives the same output as today.

Contract:

- `ParseOptions.keepSourceLines?: boolean` makes the `ok` result carry an opaque
  `sourceLines`, keyed by the parsed `Page` and `Element` objects. It is empty when
  a migration ran (`migrated !== snapshot`).
- `SerializeOptions.sourceLines` is passed to `serializeDocument`. Without it, every
  caller behaves as today. `applyBatch` is the only caller that passes it.
- Lookup is by object identity, so a changed element or page, which is always a new
  object, cannot find a line. `Store.loadDocument` keeps the parsed objects, commits
  replace objects, and a search of `packages/core/src` and `apps/cli/src/edit` found
  no in-place `semantic` or `visual` assignment. A freeze test guards this.
- The document line, unknown records and record sort order always use today's code.

A new module `packages/io/src/jsonl/source-lines.ts`, next to the writer and using
the same `KeyOrder` values, accepts a source line only if all of these hold,
otherwise the writer is used:

1. `JSON.stringify(parsedRecord) === line`. This rejects whitespace, a CR, number
   and escape spellings, duplicate keys and promoted integer-like keys.
2. For elements: `semantic` is a plain object, and `visual` is absent or a non-empty
   plain object whose `style` is absent or a non-empty plain object. The writer adds
   a missing `semantic` and drops an empty `visual` or `style`, so such lines differ.
3. At every depth, keys follow the writer's order for the same `KeyOrder`
   (`elementRecordOrder(keyOrder)`, `PAGE_RECORD_ORDER`, and nested `children`):
   declared keys in declared order, then the rest ascending by code unit.
4. Each declared coordinate equals `roundCoordinate(value)`.

The check may reject a canonical line, which only costs time. It must never accept
a line the writer would write differently. Rejected alternative: reusing input lines
unverified, which would stop normalizing non-canonical input and break byte identity.

Test seam: `applyBatch` gains an optional last parameter
`{ fullWrite?: boolean }`, for tests only and not exposed as a CLI flag. It selects
full validation and full serialization.

#### Tests and timings

- Differential (`apply-batch.test.ts`): `fullWrite` on and off give identical `text`,
  `warnings`, `counts` and thrown error text, for the single, multi-page and mixed
  fixtures, `--arrange`, element delete, page delete, page create, a token update, a
  delete of an element referenced from another page, and an error on a changed page.
- Serializer (`packages/io/src/jsonl/source-lines.test.ts`): reuse output equals
  `serializeDocument(snapshot)` for every expected fixture, and with these input
  variants: padded whitespace, CRLF, BOM, reordered keys, unrounded coordinate, `-0`,
  `1.0`, escaped string spelling, duplicate key, integer-like key, `__proto__` key,
  a field named `extensions`, unknown fields, unknown record, absent `semantic`, empty
  `visual`, empty `style`, unknown element type, and a migrated older document (empty
  `sourceLines`, via an injected migration). Each non-canonical variant asserts the
  writer's normalized output, not the raw line. One test asserts that a canonical line
  is accepted, so that reuse cannot silently turn into a no-op.
- Staleness: an edited element and page get new text, and neighbours on the same
  page keep theirs.
- Freeze: the three fixture batches run through `Batch` on a deep-frozen parsed
  document, proving no in-place mutation on these paths.
- Validator (`packages/ir/src/validate.test.ts`): `elementPages` gives the full issue
  list filtered to in-scope elements, with original indices. Without the option the
  list is unchanged.
- Expected hashes stay `341fcd8654fc18d560c8895df1a05617a6b8ac39`,
  `872e266430b5a59930a4f87474869514a2c126cc` and
  `4f5c88d5b1c4bc44c3afbd743fb76089bb0d34aa`. Expected files are never regenerated.
- Deadlines in `edit-performance.test.ts` (Bun and native) stay as they are.
- Timings: before any clm-02 source edit, build the release binary from c548457 and
  copy it to `target/clm-s737-before/nodetto-cli`, which gives known provenance.
  `target/clm-baseline/nodetto-cli` stays in place and is not the reference. Run the
  six inputs on both binaries in one session, and append to the progress log:
  - the six medians for each binary, labelled `before` and `after`
  - `A7 marginal ratio batch: <x>` and `A7 marginal ratio mixed: <x>` for each binary
  - `A7 fixed cost multi 1-op: before <x> after <y>`

  The gate is both `after` ratios at most 1.5 and `y` lower than `x`. D3' sets no
  other absolute target. A `y` that is not lower is a finding against b1 or b2.

Not in D3': the Boa probe harness, the attribution record, other document-wide
costs such as the `JSON.stringify` comparison in `countPageChanges`, and Rust changes.

## B. Three-way merge

### B1. `nodetto-cli merge <base> <ours> <theirs> [--output <file>]`

Inputs:

- All three files are read and parsed with `parseDocumentResult` before
  anything is written. A read or parse error, or documents whose `id` differs,
  exits 2 and writes nothing.

Merge model (new `mergeDocumentVersions` in `packages/core/src/document-merge.ts`):

- It shares the recursive value merge with the existing `mergeDocuments`. That
  shared code is extended to collect field paths, and `mergeDocuments` keeps
  its exact current results, so the app's live merge does not change.
- Records are keyed by record kind and id: the document header, pages by id,
  elements by id. Unknown records are merged as a set of canonical lines: a
  line deleted on one side is dropped, and lines added on either side are kept.
- Inside a record, plain objects merge key by key, recursively. Arrays and
  scalars are atomic. A change on one side only is taken. The same change on
  both sides is taken. Different changes on both sides are a conflict: ours is
  kept, and the conflict records the dotted path (`visual.x`,
  `semantic.columns`, `title`) with the base, ours and theirs values.
- When both sides add the same id with different content, the record merges
  against an empty base, and its differing fields are conflicts
  (`both-added`).
- Delete against modify:
  - If ours deleted a record that theirs changed, it stays deleted
    (`deleted-in-ours`).
  - If theirs deleted a record that ours changed, ours is kept
    (`deleted-in-theirs`).
  - A one-sided deletion of an unchanged record is taken without a conflict.

Integrity pass, repeated until nothing changes (bounded by the record count):

- An element whose page is missing from the result:
  - If the element is present in ours, ours' page record is restored, with a
    `deleted-in-theirs` conflict on the page.
  - Otherwise the element is dropped, and it gets a `deleted-in-ours` conflict
    if theirs added or changed it.
- A referenced id (from the registry `references(semantic)` of the element's
  type) that is missing from the result:
  - If the referenced element is present in ours, it is restored with a
    `deleted-in-theirs` conflict.
  - Otherwise the referencing element is dropped, with a `deleted-in-ours`
    conflict.
- After the pass the result is validated with `validateDocument`. Any
  remaining error exits 2, lists the errors and writes nothing. A git merge
  then keeps `%A` (ours) unchanged and marks the conflict.

Output:

- The canonical `serializeDocument` text goes to `--output` (atomic
  `writeText`) or to stdout. It is written on conflict too. Reading everything
  first makes `--output` equal to the ours path safe.
- stderr gets one line per conflict, sorted by kind (document, page, element),
  then id, then path:
  - `conflict: element <id> (<type>) <path>: base <v> | ours <v> | theirs <v> (kept ours)`
  - `conflict: element <id> (<type>): deleted in theirs, changed in ours (kept ours)`
  - Values are compact JSON, truncated to 80 characters with `...`.
  - A summary line follows: `merged with <n> conflict(s); conflicting fields keep ours.`
- Exit codes: 0 for a clean merge, 1 when there are conflicts (the result is
  written), 2 for a usage, read, parse, identity or validation error. Git
  treats any non-zero exit as a conflict.
- `--quiet` does not hide conflict lines, because they are not warnings.
- Registered in `runCli`, `COMMAND_HELP` (which makes the MCP tool
  `nodetto_merge`), the OVERVIEW under "Convert and check", and the docs, by
  the final wiring plan. The command logic lives in `apps/cli/src/merge-command.ts`.

### B2. Git merge driver

Documented setup (help `merge`, `docs/cli.md`):

```text
# .gitattributes
*.jsonl merge=nodetto
# once per clone
git config merge.nodetto.name "nodetto three-way merge"
git config merge.nodetto.driver "nodetto-cli merge %O %A %B --output %A"
```

End-to-end test (`apps/cli/src/merge-git.test.ts`, Bun), in a temporary
directory:

- Setup: `git init`, a local `user.name` and `user.email`, `.gitattributes`,
  and the driver configured to the CLI under test (`<bun> <main.ts>`, or the
  native binary in the native-parity variant). It commits a base document,
  then makes two branches.
- Disjoint field edits on the two branches: `git merge` exits 0 and the file
  has both changes in canonical form.
- The same field edited differently: `git merge` exits non-zero, the file
  keeps ours' value in canonical form, and the driver's stderr names the
  conflict.
- The test needs `git` on PATH and fails, rather than skips, when it is
  missing.

### B3. Export determinism

Guarantee (documented in help `export`, `docs/cli.md` and `export.md`): the
text exports (SVG, Mermaid, D2, draw.io) are a pure function of the
document's canonical content and the bytes of the image attachments it
references. They do not depend on branch, time, time zone, locale, working
directory, the document's absolute path, or Bun against native. PNG and PDF
depend on fonts and stay excluded, as `export.md` already says.

Tests (`apps/cli/src/export-determinism.test.ts`, plus a native-parity case):

- An SVG of a fixture with a raster attachment is exported twice with
  different `TZ` and `LANG`, from two directory copies with different absolute
  paths and working directories. The outputs are byte-identical.
- `export(doc)` equals `export(format(doc))`.
- Bun output equals native output.
- If the audit finds something nondeterministic, the plan fixes it in the core
  exporter.

Recipe (docs only, no new driver): mark generated SVGs as build output and
regenerate them after a merge with
`nodetto-cli export <doc> --page <name> --format svg --output <file>`. A
post-merge hook example is shown.

## C. Edit usability

### C1. `label` on `update`

- `update` accepts `"label": "<text>"`. It also counts as an update on its own:
  "update needs semantic, visual or label".
- The label resolves to a field through one shared helper, used by `add`
  (shape and type), `connect` and `update`:
  1. Connectors use the field `connect` writes today: `trigger` for
     `state.transition`, `name` for BPMN flows, `label` otherwise.
  2. Otherwise, if `editor.editableField(id)` is defined, `editor.setText`.
  3. Otherwise the first string field among `name`, `label`, `text`.
  4. Otherwise exit 2: `<type> has no text label; set its fields with
     "semantic".`
- Expected mappings, which a test confirms over every known element type:
  `text.note` to `text`, `frame` to `name`, `node.generic` to `label`,
  `state.node` to `name`, `erd.table` to `tableName`, `edge.generic` to
  `label`.
- Order inside one `update`: `semantic` merges first, then `label`, so `label`
  wins on the same field.
- `add` with `type` now applies `label` too. It was silently ignored before
  (user-qa Q5).
- Help and docs include the mapping table that the test asserts.

### C2. Unknown operation fields

- One table in `apps/cli/src/edit/` lists the allowed top-level fields of each
  op. It is checked before the handler runs. A test checks that each handler
  reads only fields in its row.

| op | fields |
| --- | --- |
| add | op, page, type, shape, id, ref, semantic, visual, place, label |
| connect | op, from, to, shape, type, id, ref, semantic, visual, label, fromColumn, toColumn, cardinality |
| update | op, id, semantic, visual, label, carryMembers |
| append | op, id, field, items |
| remove-item | op, id, field, item |
| move | op, id, x, y |
| delete | op, id |
| scale | op, ids, page, factor, origin |
| replace-text | op, find, replace, regex, ignoreCase, ids, page |
| group | op, ids, ref, name |
| ungroup | op, id |
| add-page | op, name, kind, id, ref, before, after, order, mode |
| move-page | op, id, before, after, order |
| rename-page | op, id, name |
| set-page-mode | op, id, mode |
| delete-page | op, id |

- The plan checks this table against the handlers in
  `apps/cli/src/edit/operations/*.ts` and corrects it before enforcing it.
  `draw` (which builds operations) must produce only valid fields.
- Error format (exit 2, nothing written):
  `operation <i> (<op>): unknown field "<f>". Did you mean "<s>"? Valid fields: <row in table order>.`
  The suggestion is the closest valid field when its case-insensitive
  Levenshtein distance is at most 2, or when one name is a prefix of the other.
  Several unknown fields are each named.
- `regex` and `ignoreCase` must be booleans:
  `"regex" must be true or false (true reads "find" as a regular expression)`.
  For example, `{"op":"replace-text","find":"a","regex":"a.","replacement":"b"}`
  reports the unknown `replacement` with the suggestion `replace`, and the valid
  fields include `regex`.
- Only top-level operation fields are checked. Unknown fields inside
  `semantic` keep today's `semantic.unknownField` warnings.

### C3. Repeated warnings and `--quiet`

- A new `apps/cli/src/warnings.ts` collapses text warning lines. The grouping
  key is (code, element type, field path relative to the element) when the
  warning has a code, and otherwise the exact message text.
- A group of n >= 2 prints its first line followed by
  ` (and <n-1> more like this)`. Groups keep the order of their first line.
- It applies to the text warnings of every command that loads documents:
  `loadDocument` validation warnings, `validate` output, the warning lines in
  the `edit` and `draw` text reports, `export` text-layout warnings, and
  import, `ddl` and `bpmn` warnings.
- JSON outputs and lint findings are not collapsed: findings are the lint
  result, and every finding stays listed.
- `--quiet` is a global flag. It is accepted anywhere before `--` and removed
  before the command parses its arguments, by one helper used by `runCli` and
  by the export paths in `main.ts` and `native-engine.ts`.
- `--quiet` drops warning lines from stderr and from text reports. It never
  hides errors, conflicts, lint findings or JSON, and it does not change exit
  codes: `--strict` still exits 3 and prints its summary line.
- Help: the OVERVIEW and every command page that prints warnings mention
  `--quiet`.

## D. lint additions

### Page selection

`lint` now also lints pages of kind `erd`, `state` and `uml`, and any page that
contains `image.raster`. Rules by page kind:

| Page kind | Rules |
| --- | --- |
| bpmn | existing BPMN rules, `image-missing` |
| breadboard | existing breadboard rules, `image-missing` |
| architecture, freeform | existing text-layout rules, `image-missing` |
| flowchart | existing text-layout rules, `node-overlap`, `image-missing` |
| erd, state, uml | `node-overlap`, `image-missing` |
| any other kind with images | `image-missing` |

`LINT_NO_PAGES` names the new kinds. Text-layout rules stay limited to
`TEXT_LAYOUT_LINT_PAGE_KINDS` (user-qa Q1), so export warnings do not change.

### D1. `node-overlap` (warning)

- Lives in a new `packages/core/src/diagram-lint/`.
- Candidates:
  - ERD pages: `erd.table` and database object types.
  - State pages: `state.node`.
  - Flowchart and UML pages: elements of category `node`, excluding frame,
    group, `text.note` and `image.raster`.
- A pair is reported when the rendered bounds (`getBounds` with the shape
  context) intersect with an area of more than 1 square unit. That includes
  partial overlap, one box fully inside the other, and identical boxes.
  Boxes that only touch along an edge or at a corner have zero intersection
  area and are not reported.
- Geometric containment alone is never an exemption. A pair is exempt only
  when it has an explicit, supported container relationship in the document:
  one element is the other's group or frame parent (the frame and group
  layers are already excluded as candidates), or the page is a UML page and
  one element is a `usecase.node` with `kind: "system"` (the use-case system
  boundary) containing the other. On ERD and state pages, nothing is exempt,
  so coincident or nested tables and states are always reported.
- One finding per pair, on the element that comes first in stable order. The
  message names both elements and the page:
  `table "orders" overlaps table "order_items" on page "Shop schema" (40x20)`.
  The noun is the type's short name, and the name is its label field (C1). It
  falls back to the short id.

### D2. `lint --fix` (text wrapping)

- Fixes `label-overflow` and `note-overflow` findings caused by width on
  text-layout pages. It respects `--page`. On `.bpmn` input it exits 2.
- Wrapper: a new `packages/core/src/text-wrap.ts`, `wrapTextToWidth(text,
  width, fontSize)`. It uses the wide-aware measure from `wide-text-width.ts`
  (the same function the rules use) and the available width the rule
  computes. Each existing line is wrapped on its own, and existing newlines are
  kept.
- Break opportunities, in order of preference:
  - After a run of spaces. The spaces at the break are dropped.
  - After CJK closing or separating punctuation: `、 。 ， ． ・ ： ； ！ ？ 」 』 ） 】 〉 》 ］ ｝ 〕 / ／`.
  - Before CJK opening brackets: `「 『 （ 【 〈 《 ［ ｛ 〔`.
  - Between two wide characters.
  - As a last resort, a grapheme boundary inside any word that is too long on
    its own.
- A line never starts with closing punctuation, `ー` or small kana. The break
  moves one grapheme earlier when that is possible.
- Graphemes are iterated the way `wide-text-width.ts` already does, so Boa
  support is unchanged.
- Write path: fixes become `update` operations on the element's text field
  (C1 helper). They run through the same batch apply and optimistic re-read
  write that `edit` uses, so the output is canonical, derived text resizing
  applies, and concurrent app saves are not lost. Nothing is written when
  there are no fixes.
- Report:
  - Text: one `fixed <element id> <rule-id>: <n> line break(s)` line per fix,
    then the normal findings table of the re-linted document.
  - JSON: the fields above plus `fixes: [{pageId, elementId, ruleId, field,
    before, after}]`.
- Findings that remain (for example a note that wrapping makes too tall for
  its box) are reported, and exit codes follow the remaining findings (user-qa
  Q4).
- Idempotent: a second `--fix` changes nothing. Text that does not overflow is
  never touched.

### D3. `image-missing` (error)

- For each `image.raster` whose `semantic.src` is a relative attachment path
  (`isRelativeAttachmentPath`): if `io.exists(<document dir>/<src>)` is false,
  the reason is `file not found`. Otherwise `io.readAttachment(documentPath,
  src)` is called (the confined reader in both runtimes), and on failure the
  reason is `cannot be read (outside the document folder, too large, or unreadable)`.
- Message: `image src "<src>" <reason>`. The reasons are fixed strings, so
  Bun and native print the same bytes.
- Embedded data URLs are skipped. The document directory is joined with `/`
  in TypeScript, without `node:path`.
- Integration fix 3: the `exists` probe path comes from one pure helper,
  `documentRelativePath(documentPath, src)` in `apps/cli/src/lint-diagram.ts`.
  It splits the document directory on `/` (a plain string split of a short
  path, not a document), drops empty and `.` segments, folds `name/..` pairs,
  keeps leading `..` segments and a leading `/`, and appends `src`. `src` is
  already free of `.`, `..`, `\` and a leading `/`, because
  `isRelativeAttachmentPath` rejects those (and the IR rejects such an image
  with `image.source` before lint runs). Containment stays where it is:
  `io.readAttachment` (the confined reader) decides what may be read, and its
  failure gives the fixed `cannot be read (...)` reason.
- Traversal tests: a document opened as `../<dir>/doc.jsonl` and as
  `<dir>/./doc.jsonl` reports a present image as clean and a missing one as
  `file not found`; an attachment that is a symlink to a file outside the
  document folder reports `cannot be read (outside the document folder, too
  large, or unreadable)`; the helper has table tests for `a/b/../doc.jsonl`,
  `./doc.jsonl`, `doc.jsonl`, `../x/doc.jsonl` and `/abs/doc.jsonl`.
- It lives in the CLI lint layer (it needs `CommandIo`). It counts as an error,
  so lint exits 1, because export fails on a missing attachment.

### A3 metrics: `lint --metrics`

- Adds per-page counts for every linted page that has connectors:
  - `edgeCrossings`: for each unordered pair of distinct connectors, the
    number of proper intersection points between their resolved polylines.
    Points within 1 unit of an endpoint of either connector do not count, and
    collinear overlapping segment pairs count once.
  - `labelOverlaps`: the number of pairs of a label box against another label
    box, a label obstacle box (`isLabelObstacle`, A3), or another
    connector's segment, using the same label boxes as A3 (for BPMN flows,
    `bpmnFlowLabelBox`, E2.2). A label that only lies inside its pool, lane
    or expanded sub-process counts 0.
- Text output: `metrics <page name>: <n> edge crossing(s), <m> edge-label overlap(s)`
  on stdout after the findings. JSON output: `metrics` on each page and as
  totals in `summary`.
- Without `--metrics`, the text and JSON output are unchanged. Metrics never
  change the exit code.
- The code is in `packages/core/src/diagram-lint/metrics.ts` and is shared with
  the A3 scoring, so the two measures agree.

## E. Containers and page kinds

### E1. `carryMembers:false` for every carrying container

Container kinds in the IR (registry category `container`) and the other
parent-child relations that move elements today:

| Kind | Members | Default on move (`visual.x`/`y`, or `move`) | Default on resize (`width`/`height`) | `carryMembers:false` |
| --- | --- | --- | --- | --- |
| `frame` | geometric (`frameParents`), or explicit `semantic.memberIds` | descendants move by the same delta (`planFrameTranslations`) | members with `visual.constraints` follow (`planConstraints`); a frame with `semantic.layout` re-lays out its members (`planAutoLayout`) | box only; members keep absolute positions; geometric membership is re-evaluated (members outside the new box leave), explicit `memberIds` stay. On a frame with `semantic.layout` it exits 2: `carryMembers:false cannot be used on frame "<name>": it lays out its members ("layout"); remove "layout" first.` |
| `bpmn.participant` (pool) | descendants by `semantic.parent` (`buildBpmnModel`) | descendants move (`planBpmnTranslations`); child lanes are re-laid out to the pool box (`planBpmnLaneLayout`) | child lanes are re-laid out | lanes still follow the pool (they are its bands, not free members); every non-lane descendant keeps its absolute position and is re-parented by the existing `planBpmnMembership` geometry rule |
| `bpmn.lane` | descendants by `semantic.parent` | descendants move | a height change resizes the pool and restacks sibling lanes, whose own members move with them | non-lane descendants keep absolute positions and are re-parented. Only `height` may change: if the update changes the lane's `x`, `y` or `width`, it exits 2: `carryMembers:false on lane "<name>": a lane's x, y and width follow its pool; change the pool, or change only "height".` Sibling lanes moved by restacking still carry their own members |
| `bpmn.subProcess` | descendants by `semantic.parent` | descendants move | none | descendants keep absolute positions and are re-parented |
| `breadboard.board` | parts plugged into its holes | plugged parts move (`planBreadboardTranslations`) | none | parts keep absolute positions (they stay plugged only where a hole still lies under them) |
| `group` | `semantic.memberIds` | a group has no box of its own; moving it moves its members | none | exits 2: `carryMembers does not apply to a group: a group has no box of its own; move its members, or ungroup it.` |

Elements that are not containers never carry, and `carryMembers` on them
exits 2: `carryMembers applies only to frame, bpmn.participant, bpmn.lane,
bpmn.subProcess and breadboard.board; <type> does not move other elements.`
This replaces the A6 text "carryMembers applies only to frames". It covers:

- UML packages and architecture groups or zones. This IR has no package or
  zone type: they are drawn either as a `frame` (which carries, row 1) or as
  a `shape.geo` such as the `package` shape (which never carries).
- `usecase.node` with `kind: "system"` and `bpmn.group`: boundaries without
  members that never carry.
- Attachments that always follow their host and are not members:
  `uml.port` (`planUmlPorts`), `bpmn.boundaryEvent` (snapped to its host by
  `planBpmnMembership`) and PCB tracks (`planPcbTrackFollow`).

Mechanics:

- Shared engine: `ApplyOptions` gains `keepMembers?: ReadonlySet<ElementId>`,
  passed through `DerivedPlanInput`. `planFrameTranslations` treats it like
  `placed`, `planConstraints`, `planBpmnTranslations` and
  `planBreadboardTranslations` never move an element in it, and
  `planBpmnMembership` re-evaluates the parent of every element in it even
  though it did not move. Without the option every planner behaves exactly as
  today (byte-identical).
- CLI: a new `apps/cli/src/edit/carry-members.ts` validates the option and
  collects the held set from the state before the update: frame
  descendants (`frameParents`, transitively, as A6 does today), BPMN
  descendants from `buildBpmnModel(...).descendantsOf` without `bpmn.lane`,
  and for a board every other element on its page (a superset is safe: the
  board planner moves only plugged parts). The `update` handler passes it as
  `editor.apply(commands, { keepMembers })`. The A6 frame branch moves to this
  module, so frames also hold members against `planConstraints` on resize.
- With `where` (F2), the set is collected per matched element.
- In one batch, held members keep positions set by earlier operations.
- A `bpmn.boundaryEvent` attached to the updated container is not held: it is an
  attachment and follows its host.

As-built geometry errors (clm-11, exit 2, nothing written), in addition to the
table above. With `carryMembers:false` on a pool or lane that has child lanes:

- A changed height below what the lanes need:
  `carryMembers:false on "<name>": its lanes need a height of at least <n>; shrink the lanes first.`
- A changed pool width at or below 30 per lane depth:
  `carryMembers:false on "<name>": its lanes need a width greater than <n>.`
- A changed pool width that nested lanes do not fit:
  `carryMembers:false on "<name>": its nested lanes need a width of at least <n>.`

A non-boolean value exits 2: `"carryMembers" must be true or false`.

### E2. Arrange and routing on every applicable page kind

| Page kind | layered | route, labels, ports, self-loops | `lint --metrics` |
| --- | --- | --- | --- |
| state, flowchart, freeform, architecture, uml | A1 (frames as columns) | A2 to A5 | yes |
| erd | A1 (frames as columns; units are `erd.table` and the database object types) | A2 to A5 with the ERD rules below | yes |
| bpmn | E2.1 (pools and lanes as rows) | A2 to A5 with the BPMN rules below | yes |
| sequence | excluded: participant order and message order are the diagram's meaning, and message geometry is derived from that order | excluded, same reason | no (not linted) |
| breadboard | excluded: positions are physical holes and wires are electrical connections | excluded, same reason | no: wire crossings are physical, not a readability measure |
| pcb | excluded: footprints and tracks are physical | excluded | no (not linted) |

#### E2.1 Layered on BPMN pages

- Rows: each `bpmn.participant` that is not collapsed is a row group, in its
  current top-to-bottom order (by `visual.y`, ties by stable order). Its leaf
  lanes, in model order, are its rows; a pool without lanes is one row.
  Collapsed pools keep their height. Flow nodes in no pool form one free row
  after all pools. Lane order is never changed. `--frames` and `--direction
  TB` exit 2 on BPMN pages (pools are horizontal).
- Units: flow nodes (tasks, events except boundary events, gateways, call
  activities), sub-processes (moved as one with their contents), data objects,
  data stores and text annotations. Elements inside a sub-process are not
  units; a connector end inside one maps to the outermost sub-process, as an
  end inside a group does in A1. A unit's row is its nearest lane (or pool)
  ancestor. Boundary events follow their host. `bpmn.group` is left in place.
- Traversal: the A1 traversal with `bpmn.startEvent` instead of the initial
  state as the first start, over every BPMN connector whose ends map to
  units. The layer of a unit is its BFS depth from the start of its search
  (0 for each start); the visit index orders units inside a cell.
- Geometry: layers are global columns shared by every pool, so message flows
  stay vertical. Column `L` has the width of its widest unit, columns are
  separated by `COLUMN_GAP = 120`, and units are centred in their column. A
  cell (row, layer) stacks its units top to bottom by visit index with
  `MEMBER_GAP = 60`. A row's height is its tallest cell plus `2 *
  FRAME_PADDING`, at least 120. Every pool has the same width: the column inset
  (D2 below), all columns and gaps, and `FRAME_PADDING`.
  Pools are stacked with gap 120. The origin is the integer top-left of the
  current union of pools and units, so a rerun is a no-op.
- Depth-dependent inset (owner decision D2). A lane directly under a pool has
  depth 1, and each nesting level adds 1. `D` is the deepest leaf lane of any
  non-collapsed pool on the page, or 0 without lanes. Columns are global, so one
  `D` applies to the whole page, including a shallower pool beside a deeper one.
  - Column inset `I = POOL_LABEL * max(1, D) + FRAME_PADDING`, which is 70 for
    `D` up to 1, 100 for `D = 2` and 130 for `D = 3`.
  - Column 0's left edge is `origin.x + I`. Pool width is
    `I + sum(column widths) + (L - 1) * COLUMN_GAP + FRAME_PADDING`.
  - Every column therefore starts at least `FRAME_PADDING` inside every leaf
    lane, so a narrow unit's centre lies in its own leaf and
    `planBpmnMembership` never re-parents it.
  - Worked example, one column 100 wide, pool at x = 0: `D = 1` gives pool width
    210, lane x 30 and width 180, unit x 70. `D = 2` gives pool width 240, lanes
    x 30 and 60 with widths 210 and 180, unit x 100. `D = 3` gives pool width
    270, lanes x 30, 60 and 90 with widths 240, 210 and 180, unit x 130. With a
    single unit of width 20 at `D = 3`: pool width 190, lane widths 160, 130 and
    100, unit x 130, centre 140 inside the leaf (x 90 to 190).
- Free row (clarified 2026-11-04, amendment round 1): it has no box, so it
  gets no pool label band and no padding. With pools, its units use the shared
  column x positions and its top is `POOL_GAP` below the last pool. Without
  pools, column 0 starts at `origin.x` and the row top is `origin.y`, so a
  page of only free units is laid out from its own top-left and a rerun moves
  nothing.
- Lane boxes (owner decision D1), on pages with `D` of at least 2; pages with `D`
  up to 1 follow "Depth-one byte identity" below. The container step writes a
  full top-down box (`x`, `y`, `width`, `height`) through `updateVisual` for every
  lane of a non-collapsed pool whose planned box differs from its current one. Each box
  uses the same formula as `planBpmnLaneLayout`, so that planner reproduces the
  same values: `x = parent.x + 30`, `width = parent.width - 30`, children stack
  without gaps from `parent.y`, and a parent's height is the sum of its
  children's. Lanes stay inside their pool, keep their order and keep
  containment at depths 1 to 3. The planner still never writes
  `semantic.parent`, and `bpmn/containment.ts` does not change. Lanes of a
  collapsed pool are not written. D1 applies to this planner only: the E1 rule
  that `carryMembers:false` on a lane allows only `height` changes is unchanged.
- Settling, on pages with `D` of at least 2; `settleCommands` is empty otherwise.
  Three existing planner behaviors can still move a lane away from its
  plan in the container apply. `planBpmnLaneLayout` adds a height delta to a
  parent whose box did not change, when the input's child heights do not sum to
  that parent's height. `planBpmnTranslations` carries a descendant whose box
  happens to equal its old box while an ancestor moves (for example, a second
  pool moves down and one of its lanes ends at its old absolute position). And a
  last child takes the remaining height. So the planner applies
  `containerCommands` to its draft and compares every pool and lane box with the
  plan. Each differing box gets a full-box `updateVisual` in `settleCommands`,
  top-down, and that list is applied once to the draft. Any box that still
  differs returns `{ error: 'arrange --mode layered cannot restack the lanes of
  pool "<name>": set its lane heights so that they fill the pool, then rerun.' }`
  and nothing is written. Unit positions are computed after this step.
- Depth-one byte identity (owner decision D2, strict). For a page with `D` up to
  1, the written document stays byte-identical to the output of the HEAD d5b9bac
  planner, on every input. These pages keep HEAD's container commands (pool boxes
  and lane heights), with no lane `x`, `y` or `width` writes and no settling.
  Identity applies to the document, not to the command lists. No exception to
  this is approved.
- Open conflict between D2 and the depth-one containment requirement (user-QA Q11,
  not blocking since continuation 5). The acceptance criteria also require containment tests at depth 1,
  and some valid depth-one inputs cannot satisfy both. Reproduced in design review
  on HEAD d5b9bac: a pool (x, y, width, height) = (0, 0, 210, 240), lanes
  (30, 0, 180, 140) and (30, 140, 180, 100) parented to it, and tasks
  (70, 40, 100, 40) and (70, 170, 100, 40), one per lane. The input validates
  cleanly. Both rows plan to height 120, so the pool box does not change,
  `bpmn/containment.ts` skips the restack, and the second lane ends at
  (30, 140, 180, 120), 20 past the pool's bottom. Containment needs its `y` to be
  120, which changes the output bytes.
  - Owner direction for continuation 5: keep current depth-one behavior, document
    it, and do not block on Q11. Until Q11 gets a final answer, no change to
    depth-one output may be dispatched or accepted, and the criterion "containment at depth 1" stays open and
    reported for inputs of this kind. No test pins these inputs either way: not
    as an expected file, and not as an accepted overflow.
  - Proposal, not approved: let D1 take priority by applying lane boxes and
    settling at every depth. Its exact boundary is in Q11. If the owner approves
    it, an owner-approved scope amendment records that boundary here and its
    matching gates before clm-12 implements it.
  - While strict D2 stands, the incompatible containment requirement is documented
    for users ("Help and documentation") and reported as a limitation for those
    inputs, using the exact line in "Continuation 5 verification".
- As-built refusals at `D` of at least 2 (clm-12). Each returns `{ error }`, exits 2
  and writes nothing. These are in addition to the restack refusal above:
  - A sub-process whose contents would change parent or relative offset (boundary
    events excepted), for example by landing on a sub-process in another lane:
    `arrange --mode layered cannot keep the contents of sub-process "<name>" while
    restacking lanes: move it clear of the sub-processes in other lanes, then rerun.`
  - A collapsed pool whose descendants would change parent or relative offset (lanes
    and boundary events excepted), because a member falls outside the narrower
    planned width or lands transiently on a live sub-process:
    `arrange --mode layered cannot keep the contents of collapsed pool "<name>" at
    the planned pool width <width>: move them so that their centres fit inside that
    width and clear of the sub-processes in other pools, then rerun.`
  - These guards do not run at `D` up to 1, because D2 keeps that output unchanged.
    The contents of a sub-process or collapsed pool can therefore change parent or
    offset there, alongside the Q11 lane limitation.
- Commands, in up to three applies, because `planBpmnTranslations` carries every
  descendant whose position a command did not change: first the container
  step (pool boxes and lane boxes through `updateVisual` as stated above, and units are
  carried), then `settleCommands` when non-empty, then the unit
  step (absolute `updateVisual` positions for every unit; a sub-process's
  contents are carried by the sub-process through the existing planner). A rerun
  returns three empty lists. Units end inside their own
  row, so `planBpmnMembership` keeps their parents, with two exceptions: a
  unit directly under a non-leaf lane, and a unit directly under a pool with
  lanes, land in a first leaf row, and that planner's existing geometry rule
  makes that leaf lane their parent. The layered planner never writes
  `semantic.parent`. This needs no `keepMembers`, so the planner has no
  dependency on the E1 engine change.
- Then the route stage runs on every BPMN connector of the page, as in A1.

#### E2.2 Route rules per kind

- BPMN: all four BPMN connector types are targets. The same-side self-loop
  case (A5) applies to them. Ports follow the A2 offset rule for every type.
- BPMN labels use their own rendering path, not the generic one:
  `connectorDecoration` returns an empty label for BPMN flows and
  `connectorLabelBox` returns null. The visible label comes from
  `bpmnFlowDecoration` (`packages/core/src/bpmn/notation.ts`), which both the
  canvas (`packages/ui-solid/src/shapes/ConnectorView.tsx`) and SVG export
  (`packages/core/src/svg-export/connectors.ts`, `document.ts`) call. It
  draws `semantic.name` wrapped by `wrapTextLines(name, 90, 11)` (font 11,
  line height 13, `text-anchor: middle`), with the anchor at the centre of
  `visual.labelBounds` when set, else at `polylineMidpoint(points)`. The
  anchor is the horizontal centre and the first line's baseline: SVG export
  (`packages/core/src/svg-export/notation.ts`) writes line i at
  `y = anchor.y + i * 13`, and the canvas
  (`packages/ui-solid/src/shapes/BpmnShapeView.tsx`) advances each later
  line by `dy = 13`. Today it ignores `labelPosition`.
  Required changes, all in `notation.ts`:
  - Anchor precedence: `visual.labelBounds` centre (unchanged, the user's
    placement); else, when `semantic.labelPosition` is a finite number,
    `pointAlongRoute(points, labelPosition)` (clamped to [0, 1]); else
    `polylineMidpoint(points)` (unchanged). A flow without `labelPosition`
    renders byte-identically.
  - New export `bpmnFlowLabelBox(element, points, anchor): Box | null`: null
    when `name` is empty. Otherwise, with `n` wrapped lines and `w` the widest
    line by `estimatedTextWidth` at font 11, the box is baseline-relative,
    not centred vertically: `x = anchor.x - w / 2`, `width = w`,
    `y = anchor.y - ASCENT`, and
    `height = ASCENT + (n - 1) * 13 + DESCENT`, with the explicit estimates
    `ASCENT = 11 * 0.8` and `DESCENT = 11 * 0.2` (font 11). The box covers the
    first line's ascent through the last line's descent. The helper and
    `bpmnFlowDecoration` share the wrapping, the font size and the line
    height constants, so the box follows the rendered lines. The renderer's
    baselines and coordinates do not change.
  - A3 on BPMN flows scores candidates with `bpmnFlowLabelBox` on the
    resolved route. A flow with `visual.labelBounds` counts as manually
    placed: route mode never writes its `labelPosition`, and its label box
    (at `labelBounds`) still counts as a placed label for other flows and in
    metrics.
  - Containing surfaces (A3) are never label obstacles on BPMN pages, so a
    label that only lies inside its pool and lane scores 0; tasks, events,
    gateways, collapsed sub-processes, collapsed pools, data objects,
    annotations, other labels and other routes still count.
- ERD: `erd.relation` is a target. An end anchored to columns
  (`erdEndpointColumnIds` non-empty) ignores ports in the resolver, so route
  mode never writes `fromPort`/`toPort` or a position for it, and such an end
  takes no part in port spreading. A table-level end gets ports and spreading
  as in A2 and A4. A self relation keeps its own ERD geometry: A5 does not
  apply to it and no ports are written. Labels (A3) use the text
  `connectorDecoration` returns; a relation without label text is skipped.
- Every rule in A2 to A5 (manual detection, `--reset-manual`, idempotency,
  determinism) applies unchanged.

## F. Element selectors in `edit`

### F1. `name:<text>` references

- Accepted wherever an operation takes an element reference: `id`, `from`,
  `to`, each item of `ids`, the `where` values `from`, `to` and `parent`, and
  every reference field inside `semantic` that the type's registry
  `references(semantic)` reports (for example `parent`, `attachedTo`,
  `memberIds[i]`, edge `from`/`to`, ERD relation `table`). Other strings in
  `semantic` are never resolved, so text that starts with `name:` stays text.
- Resolution order for a reference string: an exact element id; then `@ref`;
  then `name:<text>`; then a unique id prefix (today's rules). An exact id
  always wins, so existing documents and op files behave as before.
- Text of an element: the string value of its C1 label field (`labelField`).
  An element without a label field has no text. Matching is exact after
  trimming leading and trailing whitespace on both sides; it is
  case-sensitive and does not normalize Unicode.
- Scope: the op's `page` when the op has one; for `to` of `connect`, the page
  of the resolved `from`; for references inside `semantic`, the page of the
  element being updated or created; otherwise the whole document (one page
  documents behave as "the page").
- Exactly one match resolves. Zero or several matches fail the operation
  (exit 2, nothing written):

  ```text
  operation 3 (update): "name:Approve" matches 2 elements:
    a1b2c3 bpmn.task "Approve" on page "Orders"
    d4e5f6 bpmn.task "Approve" on page "Returns"
  Use an id, or "where" with "page".
  ```

  For zero matches the list holds the elements whose text contains `<text>`
  case-insensitively (`no element named "Approve"; similar: ...`), or says
  `no similar names`. Lists are in stable order, capped at 10 lines plus
  `... and <n> more`.

### F2. `where` and `expect` on `update` and `delete`

- `where` is an object with optional keys `type`, `from`, `to`, `parent`,
  `name` and `page`. All given keys must match (AND). It needs at least one
  key; an unknown key exits 2 with the C2 suggestion format.
  - `type`: exact element type.
  - `from`, `to`: references (F1 rules); an element matches when its
    endpoint reader (`endpointReaderFor`) gives that endpoint id. Only
    connectors can match.
  - `parent`: a reference; matches when the referenced element is the
    element's direct container: its `semantic.parent` (BPMN), else its frame
    parent (`frameParents`), else the group whose `memberIds` lists it.
  - `name`: exact text, with the F1 matching rule.
  - `page`: a page query as in `add`; limits the search to that page.
    Without it the search covers the whole document.
- `id` and `where` are mutually exclusive (`use either "id" or "where"`).
- `expect` is an integer >= 0, allowed only with `where`. If the match count
  differs, the operation fails with `operation <i> (<op>): where matched <n>
  element(s), expected <e>:` and the candidate list (F1 format), and the whole
  batch is aborted without writing. Without `expect`, zero matches is an error
  and any positive count is accepted. `expect: 0` with zero matches is a
  no-op.
- `update` with `where` applies the same `semantic`, `visual`, `label` and
  `carryMembers` to every match, one element after another in stable order.
  `delete` with `where` deletes all matches in one command.
- Matches are evaluated against the state after the earlier operations of
  the batch, and again on the concurrency re-apply.
- Reporting: every `where` or `select` operation adds
  `operation <i> (<op>): matched <n> element(s)` to the text report and
  `matches: [{operation, op, count, ids}]` to the JSON report. `--quiet` does
  not hide these lines (they are results, not warnings).

### F3. `select`

- `{"op":"select","ref":"ok","id":"name:Approve"}` or
  `{"op":"select","ref":"ok","where":{...},"expect":1}` binds one existing
  element to `@ok` for later operations in the batch.
- `ref` is required and must be unused (`ref "<r>" is already used.`).
  Exactly one of `id` and `where`. With `where`, `expect` defaults to 1 and
  any other value exits 2 (`select binds exactly one element; "expect" must
  be 1`).
- `select` changes nothing, so it does not mark its page as touched for
  `edit --arrange`.

### F4. Validation, help and parity

- C2 table rows change to: `update`: op, id, where, expect, semantic, visual,
  label, carryMembers; `delete`: op, id, where, expect; new `select`: op,
  ref, id, where, expect. The `where` keys are checked the same way.
- The unknown-op message lists `select`.
- `edit` help documents `name:`, `where`, `expect`, `select`, the matching
  rules, the report line and the E1 table. The MCP tool `nodetto_edit` takes
  free-form `args` and `stdin` and uses `COMMAND_HELP.edit` as its
  description, so it needs no schema change; the updated help reaches it.
- Bun and native parity cover F1 to F3 in the CLI-level tests.

## Help and documentation

| Where | Content |
| --- | --- |
| `apps/cli/src/help.ts` | OVERVIEW (`merge`, `--quiet`), `arrange` (modes, `--frames`, `--ids`, `--reset-manual`, manual-setting rule, the E2 page-kind table with exclusion reasons, BPMN rows), `edit` (`label` on update with the mapping table, the E1 per-kind carry table, unknown-field rejection, `name:`, `where`, `expect`, `select`, match report lines), `lint` (new rules, page table, `--fix`, `--metrics` and its page kinds), `merge` (usage, conflict policy, exit codes, git driver setup), `export` (determinism guarantee) |
| `docs/cli.md`, `README.md` | the same user-facing content, the git driver recipe, the SVG regeneration recipe |
| `apps/cli/src/help.ts`, `docs/cli.md` (BPMN layered limits) | under `arrange`: nested lanes may get full boxes rewritten and keep their order; the three E2.1 refusals in plain words; and this limitation, in substance: "On a BPMN page whose lanes are nested at most one level, layered arrange moves units and changes pool boxes and lane heights, but keeps lane positions. A lane can end outside its pool when the pool box does not change, and the contents of a sub-process or collapsed pool can change parent or offset." Under `edit`: the E1 geometry errors. No user-facing text names Q11 |
| `design-docs/specs/design-cli-ai-drawing.md` | a pointer to this document under edit and arrange |
| `design-docs/specs/export.md` | the determinism guarantee in Goals and Rollout |
| `apps/cli/src/mcp.ts` | no change. Its schema is the generic `args` and `stdin` passthrough, so new `edit` fields and ops need no schema edit, and each `COMMAND_HELP` entry becomes a `nodetto_<command>` tool with that help as its description. `mcp.test.ts` gains a check that `nodetto_merge` is listed and that the `nodetto_edit` description names `where`, `select` and `carryMembers` |
| `impl-plans/` | the plans for this design |

## Verification

Per plan: targeted `bun test <files>` and `bun run typecheck`.
Final: `mise run verify`, then `mise run test-cli`, which builds the release
binary and runs the native parity and deadline tests. A native deadline
timeout is retried up to 3 times before it counts as a failure, and CPU time
is compared with `/usr/bin/time -p` against the pre-change binary. No
deadline is relaxed.

| Requirement | Tests (Bun unless noted) |
| --- | --- |
| IR fields | ir validation (range, warning without a port), `keyOrder` per connector type, resolver: `labelPosition` moves `labelPoint`, port position moves the attachment point, same-side self-loop geometry, unchanged output without the fields (golden) |
| A1 | traversal (initial, in-degree 0, cycle-only, disconnected), `--frames` resolution and errors, LR and TB geometry, members inside frames, determinism under shuffled input lines, idempotency (`--check` exit 0 after `--write`), unsupported page kinds and no frames exit 2 |
| A2 | no element moves, `--ids` scope, manual kept without and cleared with `--reset-manual`, route inputs set, idempotency. Regression, run in Bun and in native parity (`layout.test.ts`): a connector with `routing: "manual"` and non-empty `routingWaypoints`, whose straight path is blocked by an element. Without `--reset-manual` its routing, waypoints and resolved points are unchanged. With `--reset-manual` it becomes `routing: "orthogonal"` with no waypoints, its resolved route crosses no obstacle clearance box, and no element moves |
| A3 | candidate selection avoids a blocking element and label, metrics decrease on a crafted fixture, `--metrics` text and JSON, output unchanged without the flag |
| A4/A5 | spreading positions and order with no fixed ends (equal spacing). Collision regression: a manual end at 0.6667 and one movable end on the same side; the movable end gets `Math.round(0.6667 / 2 * 10000) / 10000`, asserted to lie in (0, 0.6667) and at least 0.0001 from 0.6667, and the manual end keeps 0.6667. Fixed end at the default midpoint (no stored position): movable ends avoid 0.5. Subset case: with `--ids` naming one of three connectors on a side, the other two keep their stored values and reserve their coordinates, and only the named connector's end is written. A rounding-collision case and a rerun idempotency check. Self-loop takes a free side, with fallback when every side is used |
| A6 | default carries members placed earlier in the batch, `carryMembers:false` does not, non-frame and non-boolean errors |
| A7 | fixture edit under 10 s in Bun, native deadline under 10 s, byte-identical output against a committed expected file produced by the pre-change code |
| B1 | one-sided, both-same, field conflict (ours kept, path reported), both-added, delete against modify both ways, page and reference integrity, identity mismatch, validation failure writes nothing, `--output` equal to the ours path, canonical output, exit codes |
| B2 | `merge-git.test.ts` real git repository, clean and conflicting merges |
| B3 | determinism across TZ, LANG and cwd, canonical invariance, Bun equals native |
| C1 | update label for every known type (mapping table), label after semantic, add with type plus label |
| C2 | unknown field per op (table-driven), suggestion, valid list, regex type message, handlers read only listed fields |
| C3 | collapse grouping and order, JSON uncollapsed, `--quiet` across commands, exit codes unchanged with `--quiet --strict` |
| D1 | ERD rectangle cases: coincident tables (identical bounds) give one finding naming both tables and the page; a table fully inside another gives one finding; a partial overlap gives one finding; touching tables (shared edge, zero area) give none. Each pair is reported once. A UML use-case system boundary containing a use case gives no finding, and two overlapping use cases inside it give one. Native parity in `lint-rules.test.ts` |
| D2 | Latin word wrap, CJK punctuation breaks, line-start prohibition, hard split, idempotency, untouched non-overflow text, remaining height finding, JSON `fixes`, `.bpmn` rejected |
| D3 | missing file, file outside the document folder, data URL skipped, error exit 1 |
| A7 continuation | `multiPage` and `mixedMultiPage` byte-identical to committed pre-change expected files and under 10 s in Bun and native; dirty-page tests: an edit on page 1 leaves every planner's output for page 2 empty, and each cross-page case (token, text style, component master, cross-page reference, page command) still updates the other page |
| A7 D3' | "Tests and timings" under "A7 decision D3'": differential `fullWrite`, serializer variants, staleness, freeze and validator tests; both native marginal ratios at most 1.5; multi-page 1-op median lower than before; timings in the progress log |
| D1, D2 | Depths 1, 2 and 3, each also with a narrow unit (width 20): the worked-example boxes; every lane inside its parent and pool, siblings stacked without gaps in model order, parent height equal to the sum of its children; every unit's parent is its own leaf lane with its centre inside it; a rerun returns three empty lists; `validateDocument` clean. A shallow pool beside a deep pool uses the page-wide inset. Regressions at `D` of at least 2: lane heights change with an unchanged pool box; a lane whose box coincides with its old box while its pool moves; child heights that do not sum to the parent. Depth-one identity and containment: committed expected files captured from HEAD d5b9bac code before the first planner edit (two pools with lanes and a message flow; pool without lanes plus a free row; collapsed pool; sub-process with a boundary event), never regenerated. Containment is asserted on every one of them; a candidate fixture whose HEAD output breaks containment is not captured and is reported under Q11. Depth-one conflict inputs stay untested and open until Q11 is answered, and the answer adds their gate |
| Fix 1 and 2 | TB: exact frame box and member y with and without `showTitle`, band at the top; LR unchanged; frame order unchanged on the existing tests with ranks precomputed |
| Fix 3 | `documentRelativePath` table, `../` and `./` document paths, symlink escape reported by `readAttachment` |
| E1 | per kind (frame, frame with explicit `memberIds`, frame with `layout` error, pool, lane height-only and the x/y/width error, sub-process, board, group error, non-container error): move and resize with `carryMembers:false` keep members (including members placed earlier in the batch), default still carries, BPMN members re-parented and lanes inside their pool, `validateDocument` clean |
| E2 | ERD layered with frames; BPMN layered (rows, global columns, collapsed pool, free row, `--frames`/TB exit 2, idempotent rerun, lane invariants); route on BPMN (self-loop; label: a crafted collision moves the anchor rendered by `bpmnFlowDecoration` and in exported SVG to the chosen candidate, `bpmnFlowLabelBox` equals the box metrics use and spans the rendered baselines (four lines `First row` to `Fourth row` anchored at y=100 render baselines 100, 113, 126, 139 and give a box y from 91.2 to 141.2), a task at (80, 130, 40, 12) under only the last line counts as an overlap in both scoring and metrics, `labelBounds` still wins and blocks `labelPosition` writes, a flow without `labelPosition` gives byte-identical SVG; containment: a label inside only its pool and lane scores 0 and counts 0 in metrics, while overlap with a task, a collapsed sub-process, another label or another route counts) and ERD (column ends get no ports and are not spread, self relation unchanged); metrics on BPMN and ERD pages; sequence, breadboard and pcb exit 2 |
| F1 | id first, `@ref`, `name:` unique, ambiguous (candidate list), zero (similar list), scope by page and by `from`, `semantic` reference fields resolved and plain text untouched |
| F2 | `where` per key and AND, `expect` equal, `expect` mismatch aborts with nothing written, zero without `expect` errors, `expect: 0` no-op, update and delete over several matches, `id` with `where` error, report lines in text and JSON |
| F3 | select by id and by where, then use of `@ref`; duplicate ref, `expect` other than 1, missing ref errors |
| F4 | C2 rows and `where` keys, unknown-op list |
| Native parity | new topic files in `apps/cli/src/native-parity/`: `layout.test.ts` (arrange modes incl. BPMN and ERD, A7 deadline), `merge.test.ts` (merge, git driver with the binary), `edit-usability.test.ts` (C1 to C3, A6, E1, F1 to F3), `lint-rules.test.ts` (D1 to D3, `--fix`, `--metrics`) |

All fixtures are self-authored and neutral: widgets, orders, `Idle` and
`Running`, `Stage0` to `Stage2`.

## Rollout constraints

- Additive only. Existing documents render byte-identically. `tidy` and
  `overlaps`, `edit --arrange`, `move`, the frame-move default, the app's live
  `mergeDocuments` and text-layout export warnings are unchanged.
- Intentional behavior changes, each requested:
  - Unknown top-level operation fields now fail (C2).
  - `add` with `type` applies `label` (C1, Q5).
  - Lint reports the new rules on pages it previously skipped (D1, D3).
  - Text warnings are collapsed (C3).
  - `arrange --mode layered|route` accepts erd and bpmn pages (E2).
  - `carryMembers` is accepted on BPMN containers and boards, and its error
    text for other types changes (E1).
  - Strings starting with `name:` in reference positions resolve by name
    unless they are an exact id (F1).
  The existing tests and fixtures that pass extra operation fields are audited
  and fixed in the C plan.
- Each plan sets `artifactRoots ["target"]` and lists every edited file,
  docs included, in `writePaths`.
- The work is local only, with no push.

## Plan partition (maximum concurrency)

Revised 2026-11-04. It replaces the earlier four-wave partition, which
serialized plans only to hand over the shared registration files.

History: the subsections below ("Ownership rules" through "Verification per
wave") are the clm-s725 partition. Its ownership rules and its contracts stay
binding. Its waves are replaced by "Continuation partition" at the end of this
document, and `impl-plans/active/clm-s725-dispatch.json` must not be
dispatched again.

### Ownership rules

- Shared files, edited only by the final wiring plan: `apps/cli/src/commands.ts`,
  `apps/cli/src/help.ts`, `apps/cli/src/main.ts`, `apps/cli/src/native-engine.ts`,
  `apps/cli/src/mcp.ts` (only if `COMMAND_HELP` is not enough),
  `packages/core/src/index.ts`, `docs/cli.md`, `README.md`,
  `design-docs/specs/export.md`, and the CLI-level native parity topic files
  `apps/cli/src/native-parity/{layout,merge,edit-usability,lint-rules}.test.ts`
  plus `apps/cli/src/merge-git.test.ts`.
- Feature plans write their logic in their own new modules and test them by
  importing those modules directly (not through `runCli`). An existing
  command (`edit`, `export`, `arrange --mode tidy`) may be driven through
  `runCli` because that needs no registration change.
- A feature-plan CLI module that needs a new core export imports it by
  relative path (`../../../packages/core/src/<module>.ts`) until the wiring
  plan adds the export to `packages/core/src/index.ts` and switches the
  import to `@nodetto/core`. Type-only imports from `commands.ts`
  (`CommandIo`, `CommandResult`) are allowed and do not edit it.
- No two plans in the same wave share a write path. A dependency exists only
  where a plan calls code another plan creates.

### Plans and waves

| Wave | Plan | Scope | Owned files (summary) | dependsOn |
| --- | --- | --- | --- | --- |
| 1 | clm-01-merge | B1 engine and command module, B3 determinism test and any core exporter fix | `packages/core/src/document-merge.ts`, new `apps/cli/src/merge-command.ts` and its test, new `apps/cli/src/export-determinism.test.ts`, core exporter files only if the audit finds nondeterminism | - |
| 1 | clm-02-connector-edit-perf (merges the drafts clm-02 and clm-05, which both edit `shapes/connector/resolve.ts`) | IR connector fields, resolver (label position, port position, same-side self-loop), A7 profile and fix, A7 Bun and native deadline tests | `packages/ir/src/semantics/connectors.ts`, `packages/ir/src/registry/{generic,uml,erd,bpmn}.ts`, `packages/core/src/shapes/connector/{resolve,boundary,route,label-box}.ts`, `packages/core/src/{orthogonal-routing,frame-translation,frame-tree,manual-route-preservation}.ts`, `packages/core/src/editor/transaction.ts`, `apps/cli/src/edit/apply-batch.ts`, the A7 fixture, `apps/cli/src/edit-performance.test.ts`, `apps/cli/src/native-parity/edit-performance.test.ts` | - |
| 1 | clm-03-lint-core | D1 rule, D2 wrapper and fix planner | new `packages/core/src/diagram-lint/node-overlap.ts`, new `packages/core/src/text-wrap.ts`, new `packages/core/src/text-layout-lint/fix.ts`, their tests | - |
| 1 | clm-04-edit-usability | C1, C2, C3 module and its call sites outside shared files, A6 | new `apps/cli/src/edit/label-field.ts`, new `apps/cli/src/edit/operation-fields.ts`, new `apps/cli/src/warnings.ts`, `apps/cli/src/edit/batch.ts`, `apps/cli/src/edit/operations/*.ts`, `apps/cli/src/edit/report.ts`, `apps/cli/src/edit-command.ts`, `apps/cli/src/draw-command.ts`, `apps/cli/src/export-command.ts`, existing tests that pass now-unknown op fields | - |
| 1 | clm-07-layered-core | A1 placement (pure core) | new `packages/core/src/arrange-layered.ts` and its test | - |
| 2 | clm-06-route-arrange | A2 to A5 route planner, A3 scoring, metrics, the arrange-mode CLI module and the `lint --metrics` module | new `packages/core/src/arrange-route.ts`, new `packages/core/src/diagram-lint/metrics.ts`, new `apps/cli/src/arrange-modes.ts`, new `apps/cli/src/lint-metrics.ts`, their tests | clm-02 (connector fields and `connectorLabelBoxAt`, `pointAlongRoute`), clm-07 (`planLayered`) |
| 2 | clm-08-lint-cli | Page selection, D1 wiring, D2 `--fix` write path, D3 `image-missing` | new `apps/cli/src/lint-diagram.ts` and its test | clm-03 (rule, wrapper, fix planner), clm-04 (`labelField`) |
| 3 | clm-09-wiring | Registration, `--quiet` extraction in shared entry points, collapsed warnings in `loadDocument` and `validate`, help, docs, core re-exports, CLI-level and native parity tests, B2 git end-to-end test | the shared files listed above | every other plan |

- Wave 2 exists only for real call dependencies. clm-04's A6 needs no core
  change: the `update` handler collects descendants with the exported
  `frameParents` and passes them as `editor.apply(commands, { placed })`, so it
  does not touch clm-02's `transaction.ts` or `frame-translation.ts`.
- C2 validation runs in `edit/batch.ts` before the per-op dispatch, not in
  `apply-batch.ts` (owned by clm-02).
- `lint-diagram.ts` (D2) applies its fixes through the existing exported
  `applyBatch` API, whose signature clm-02 does not change.

### Contracts (fixed before wave 1)

```ts
// clm-02, packages/ir/src/semantics/connectors.ts
interface ConnectorRoutingSemantic {
  labelPosition?: number; fromPortPosition?: number; toPortPosition?: number;
}
// clm-02, packages/core/src/shapes/connector/label-box.ts and route.ts
export function connectorLabelBoxAt(element: Element, anchor: Vec): Box;
export function pointAlongRoute(points: readonly Vec[], ratio: number): Vec;

// clm-07, packages/core/src/arrange-layered.ts
export interface LayeredOptions {
  readonly direction: "LR" | "TB";
  readonly frameOrder?: readonly ElementId[]; // already resolved column frame ids
}
export function planLayered(
  store: Store, pageId: PageId, registry: ShapeUtilRegistry, options: LayeredOptions,
): { commands: Command[]; placed: ReadonlySet<ElementId> } | { error: string };

// clm-06, packages/core/src/arrange-route.ts and diagram-lint/metrics.ts
export interface RouteOptions {
  readonly targetIds?: readonly ElementId[]; readonly resetManual: boolean;
}
export function planRoute(
  store: Store, pageId: PageId, registry: ShapeUtilRegistry, options: RouteOptions,
): Command[];
export interface PageMetrics { readonly edgeCrossings: number; readonly labelOverlaps: number; }
export function pageMetrics(store: Store, pageId: PageId, registry: ShapeUtilRegistry): PageMetrics;

// clm-03
export interface NodeOverlapFinding {
  readonly pageId: PageId; readonly elementId: ElementId; readonly otherId: ElementId;
  readonly message: string; readonly width: number; readonly height: number;
}
export function lintNodeOverlaps(document: Document, pageId: PageId): NodeOverlapFinding[];
export function wrapTextToWidth(text: string, width: number, fontSize: number): string;
export interface TextWrapFix {
  readonly pageId: PageId; readonly elementId: ElementId; readonly ruleId: string;
  readonly field: string; readonly before: string; readonly after: string;
}
export function planTextWrapFixes(document: Document, pageId: PageId): TextWrapFix[];

// clm-01, packages/core/src/document-merge.ts and apps/cli/src/merge-command.ts
export interface VersionConflict {
  readonly kind: "document" | "page" | "element"; readonly id: string;
  readonly type?: string; readonly path?: string;
  readonly reason: "field" | "both-added" | "deleted-in-ours" | "deleted-in-theirs";
  readonly base?: unknown; readonly ours?: unknown; readonly theirs?: unknown;
}
export function mergeDocumentVersions(
  base: Document, ours: Document, theirs: Document,
): { document: Document; conflicts: VersionConflict[] };
export function mergeCommand(io: CommandIo, args: readonly string[]): CommandResult;

// clm-04, apps/cli/src/edit/label-field.ts and warnings.ts
export function labelField(editor: Editor, element: Element): { field: string } | { error: string };
export function collapseWarnings(lines: readonly string[]): string[];
export function extractQuiet(args: readonly string[]): { args: string[]; quiet: boolean };

// clm-06 and clm-08 CLI modules, called by commands.ts in clm-09
export function arrangeLayeredOrRoute(io: CommandIo, args: readonly string[]): CommandResult;
export function lintMetrics(document: Document, pageIds: readonly PageId[]): Map<PageId, PageMetrics>;
export function lintDiagramPages(io: CommandIo, documentPath: string, document: Document,
  options: { pageId?: PageId; fix: boolean }): DiagramLintResult;
```

The names above are binding. Exact parameter types follow the existing
`Store`, `Document`, `Command`, `ShapeUtilRegistry`, `CommandIo` and
`CommandResult` types. A plan that must add a parameter adds an optional one
and records it in its progress log; it never renames a contract.

### Verification per wave

- Each feature plan: `bun test <its own test files>` and `bun run typecheck`.
  clm-02 also runs the native A7 deadline test with
  `NODETTO_CLI_TEST_BINARY` set to the release binary it builds.
- clm-09: the CLI-level tests, the four native parity topic files and
  `merge-git.test.ts` with `NODETTO_CLI_TEST_BINARY` set, then the final gates
  (`mise run verify`, `mise run test-cli` with the 3-attempt deadline retry,
  and the `/usr/bin/time -p` comparison against the pre-change binary).

## Continuation partition

History: this is the clm-s731 partition. Its waves are replaced by
"Continuation 2 partition" below; its contracts and single-owner notes stay
binding, and `impl-plans/active/clm-s731-dispatch.json` must not be
dispatched again.

Landed at HEAD 4d82d91: clm-01, clm-03, clm-04, clm-07, clm-08 (accepted) and
the clm-02 IR, resolver and single-page A7 work. The remaining work is split
below. The ownership rules above still apply: feature plans write new modules
with direct-import tests and never edit the shared registration files, which
only clm-09 edits. The fresh manifest is
`impl-plans/active/clm-s731-dispatch.json`.

| Wave | Plan | Scope | Owned files (summary) | dependsOn |
| --- | --- | --- | --- | --- |
| 1 | clm-02-connector-edit-perf (continuation) | A7 continuation (profile, dirty-page planning, multi-page fixtures, Bun and native deadline tests) and the E1 engine option `keepMembers` in every carry planner (merged because both edit the same planner files) | `packages/core/src/editor/{transaction,types}.ts`, `packages/core/src/editor.ts` if `apply` forwards options, `packages/core/src/{store,constraints,frame-translation,frame-tree,auto-layout,text-layout,text-styles,color-tokens,number-tokens,aspect-ratio,auto-component-refresh,uml-ports,manual-route-preservation}.ts` as the profile requires, `packages/core/src/bpmn/containment.ts`, `packages/core/src/breadboard/board-carry.ts`, `packages/core/src/pcb-board/follow.ts` (guard only), new `packages/core/src/keep-members.test.ts`, `apps/cli/src/edit/apply-batch.ts`, `apps/cli/src/__fixtures__/obstacle-routing-batch*.{ts,jsonl}`, `apps/cli/src/edit-performance.test.ts`, `apps/cli/src/native-parity/edit-performance.test.ts` | - |
| 1 | clm-06-route-arrange (now with E2 routing) | A2 to A5 route planner with the E2.2 BPMN and ERD rules, A3 scoring, metrics for every E2 page kind, the arrange-mode CLI module (A1 kinds plus erd; BPMN dispatch is added by clm-09) and the `lint --metrics` module | new `packages/core/src/arrange-route.ts`, new `packages/core/src/diagram-lint/metrics.ts`, new `apps/cli/src/arrange-modes.ts`, new `apps/cli/src/lint-metrics.ts`, their tests, `packages/core/src/bpmn/notation.ts` (label anchor and `bpmnFlowLabelBox` only), `packages/core/src/bpmn/notation.test.ts`, `packages/core/src/bpmn/svg-export-bpmn.test.ts` | - (clm-02 fields and clm-07 `planLayered` are landed) |
| 1 | clm-10-layered-fixes | Fix 1 (TB title band), fix 2 (precomputed ranks), `erd` in `LAYERED_PAGE_KINDS` with ERD unit tests | `packages/core/src/arrange-layered.ts`, `packages/core/src/arrange-layered.test.ts` | - |
| 1 | clm-12-bpmn-layered | E2.1 BPMN layered planner | new `packages/core/src/arrange-layered-bpmn.ts` and its test | - |
| 1 | clm-13-edit-selectors | F1 to F3, F4 validation rows, match report formatting | new `apps/cli/src/edit/selectors.ts`, new `apps/cli/src/edit/operations/select.ts`, `apps/cli/src/edit/batch.ts`, `apps/cli/src/edit/operations/{elements,connect,add,groups}.ts`, `apps/cli/src/edit/operation-fields.ts`, `apps/cli/src/edit/report.ts`, `apps/cli/src/edit/types.ts`, their tests | - |
| 1 | clm-14-lint-image-path | Fix 3 | `apps/cli/src/lint-diagram.ts`, `apps/cli/src/lint-diagram.test.ts` | - |
| 2 | clm-11-container-carry | E1 CLI module, per-kind validation and tests, replacing the A6 branch in the `update` handler | new `apps/cli/src/edit/carry-members.ts` and its test, `apps/cli/src/edit/operations/elements.ts` (the carry block only), `apps/cli/src/edit-frame-carry.test.ts` | clm-02 (`keepMembers`) |
| 3 | clm-09-wiring | Registration, `--quiet` extraction, collapsed warnings in `loadDocument` and `validate`, `arrange` registration including the BPMN dispatch in `arrange-modes.ts`, `lint --metrics` registration, `matches` passthrough in `apply-batch.ts`, help (E1 table, E2 table, F), docs, README, core re-exports, CLI-level and native parity tests, B2 git end-to-end test | the shared files, `apps/cli/src/arrange-modes.ts` (BPMN dispatch only), `apps/cli/src/edit/apply-batch.ts` (`matches` line only), `design-docs/specs/{design-cli-ai-drawing,export}.md` | every other plan |

- clm-11 is in wave 2 only because it calls `keepMembers`. It edits
  `elements.ts` after clm-13 has landed in wave 1; that file is not shared
  within a wave.
- clm-13 keeps match records on `Batch` (`batch.matches`) and makes
  `BatchResult.matches` optional, so `apply-batch.ts` (clm-02) compiles before
  clm-09 adds the one passthrough line. clm-13 tests the records and the
  formatted lines by driving `Batch` directly.
- `packages/core/src/bpmn/notation.ts` and its two tests are owned only by
  clm-06 in the continuation; clm-12 reads the BPMN model, not the notation.
- clm-06 rejects `bpmn` for `layered` until clm-09 adds the dispatch to
  `planLayeredBpmn`; it routes BPMN and ERD pages itself.
- If profiling shows that the A7 fix needs a file another wave-1 plan owns,
  clm-02 stops and records an amendment rather than editing it.

### Continuation contracts (fixed before wave 1)

```ts
// clm-02, packages/core/src/editor/types.ts and transaction.ts
interface ApplyOptions { readonly keepMembers?: ReadonlySet<ElementId>; }
interface DerivedPlanInput { readonly keepMembers: ReadonlySet<ElementId> | undefined; }
export function planBpmnTranslations(before: Store, after: Store, keep?: ReadonlySet<ElementId>): Command[];
export function planBpmnMembership(before: Store, after: Store, reparent?: ReadonlySet<ElementId>): Command[];
export function planBreadboardTranslations(before: Store, draft: Store, keep?: ReadonlySet<ElementId>): Command[];
// planConstraints gains an optional trailing `keep?: ReadonlySet<ElementId>`.

// clm-12, packages/core/src/arrange-layered-bpmn.ts
export function planLayeredBpmn(
  store: Store, pageId: PageId, registry: ShapeUtilRegistry,
): {
  containerCommands: Command[]; // applied first
  settleCommands: Command[];    // applied second when non-empty (continuation 3, E2.1)
  unitCommands: Command[];      // computed from the planned layout, applied last
  placed: ReadonlySet<ElementId>;
} | { error: string };

// clm-06, packages/core/src/arrange-route.ts
export const ROUTE_PAGE_KINDS: readonly PageKind[]; // A1 kinds, erd, bpmn

// clm-06, packages/core/src/bpmn/notation.ts and diagram-lint/metrics.ts
export function bpmnFlowLabelBox(element: Element, points: readonly Vec[], anchor: Vec): Box | null;
export function isLabelObstacle(element: Element): boolean; // false for edges and containing surfaces (A3)

// clm-11, apps/cli/src/edit/carry-members.ts
export const CARRY_CONTAINER_TYPES: readonly string[]; // frame, bpmn.participant, bpmn.lane, bpmn.subProcess, breadboard.board
export function heldMembers(
  editor: Editor, element: Element, visual: unknown, index: number,
): ReadonlySet<ElementId>; // throws OperationError with the E1 messages

// clm-13, apps/cli/src/edit/selectors.ts and types.ts
export interface MatchReport {
  readonly operation: number; readonly op: string;
  readonly count: number; readonly ids: readonly string[];
}
export function resolveElementReference(
  batch: Batch, value: string, index: number, scopePage?: string,
): Element; // exact id, @ref, name:, prefix
export function matchWhere(batch: Batch, where: unknown, index: number): Element[];
export function formatMatchLines(matches: readonly MatchReport[]): string[];
// BatchResult gains `readonly matches?: readonly MatchReport[]`.

// clm-14, apps/cli/src/lint-diagram.ts
export function documentRelativePath(documentPath: string, src: string): string;
```

The names are binding, with the same rule as the earlier contracts: a plan
may add an optional parameter and record it, never rename.

### Continuation verification

- Each wave-1 and wave-2 plan: `bun test <its own test files>` and
  `bun run typecheck`; Rust untouched unless A7 records a host cost.
- clm-02 also runs the native A7 tests with `NODETTO_CLI_TEST_BINARY` set to
  the release binary it builds (3-attempt retry on a deadline timeout), the
  existing frame, routing, golden and edit tests for byte identity, and the
  manual `/usr/bin/time -p` ratios against the same build and against
  `target/clm-baseline/nodetto-cli` (kept; never cleaned).
- clm-09: all CLI-level and native parity tests with the binary set, then
  `mise run verify` and `mise run test-cli` (3-attempt retry on native
  deadline timeouts), and the manual timing of the obstacle-routing batches.
- No plan lists a binary-less native command or an expected-to-fail command.
  Every plan sets `artifactRoots ["target"]` and lists every edited file,
  docs included, in `writePaths`.

## Continuation 2 partition

History: its waves are replaced by "Continuation 3 partition" below, and
`impl-plans/active/clm-s732-dispatch.json` must not be dispatched again.

Added 2026-11-04 for HEAD 29f8691. It replaces the waves of "Continuation
partition". The ownership rules, all contracts and the single-owner notes
above stay binding. The fresh manifest is
`impl-plans/active/clm-s732-dispatch.json` with evidence root
`tmp/clm-s732/`; the clm-s725 and clm-s731 manifests must not be dispatched
again.

State at HEAD 29f8691:

- Landed and accepted: clm-01, clm-03, clm-04, clm-07, clm-08 (s725) and
  clm-10, clm-13, clm-14 (s731). Fixes 1 to 3 and F1 to F3 are therefore in
  the tree; F4 (help, docs, parity) remains with clm-09.
- clm-02: only the s725 work (IR connector fields, resolver, single-page
  fixture, one snapshot reuse) has landed. None of the A7 continuation and
  none of the E1 engine option (`keepMembers`) exists yet.
- clm-06: `arrange-route.ts`, `diagram-lint/metrics.ts`, the
  `bpmn/notation.ts` label changes, `arrange-modes.ts` and `lint-metrics.ts`
  with their tests are committed and their plan gates passed, but the plan
  has not been reviewed or accepted.
- clm-12: `arrange-layered-bpmn.ts` and 10 tests are committed. The free-row
  rule clarified in E2.1 (amendment round 1) is not implemented, and the
  regressions for nested lanes, collapsed pools, message flows, a free row
  beside pools, sub-processes, boundary events and `validateDocument` are
  missing.

| Wave | Plan | Remaining scope | Owned files (summary) | dependsOn |
| --- | --- | --- | --- | --- |
| 1 | clm-02-connector-edit-perf | A7 continuation in full (pre-change expected files, profile, dirty-page planning, page-bounded `applyCommands`, Bun and native deadline tests, manual ratios) and the E1 engine option `keepMembers` with its planner parameters | the clm-s731 list, plus `packages/core/src/commands.ts`, `packages/core/src/editor/facade/core.ts`, `packages/core/src/store-commands.test.ts` (checkpoint cb03f7e), and pre-authorized for the profile: `packages/core/src/hit-test.ts`, `packages/core/src/layer-state.ts`, `packages/core/src/clipping.ts`, `packages/core/src/editor/facade/element-editing.ts`, the tests next to each touched module | - |
| 1 | clm-06-route-arrange | Close every gap against Verification rows A2 to A5, "A3 metrics" and E2 (route part) found by review; no new scope | the clm-s731 list unchanged | - |
| 1 | clm-12-bpmn-layered | Free-row rule (with and without pools) and the missing regressions listed above, with any planner fixes they need | `packages/core/src/arrange-layered-bpmn.ts` and its test | - |
| 2 | clm-11-container-carry | E1 CLI module and per-kind tests, unchanged scope | the clm-s731 list unchanged | clm-02 |
| 3 | clm-09-wiring | Unchanged scope, plus the production-core strict check and the native timing of the new arrange modes (below) | the shared files, `packages/core/src/diagram-lint/node-overlap.ts` (annotation only), `apps/cli/src/arrange-modes.ts` (BPMN dispatch only), `apps/cli/src/edit/apply-batch.ts` (`matches` line only), `design-docs/specs/{design-cli-ai-drawing,export}.md` | every other plan |

- clm-11's dependency is a real call dependency: `heldMembers` results are
  passed as `editor.apply(commands, { keepMembers })`, which does not
  type-check, and whose per-kind tests cannot pass, before clm-02 adds
  `ApplyOptions.keepMembers` and the planner `keep`/`reparent` parameters.
  No wave-1 plan edits `apps/cli/src/edit/operations/elements.ts`.
- clm-02, clm-06 and clm-12 share no write path. clm-06 only calls
  `applyCommands`, whose signature and results clm-02 keeps (A7
  continuation), so clm-06 does not wait for clm-02.
- If the A7 profile needs a file outside clm-02's list that another wave-1
  plan owns, clm-02 records an amendment instead of editing it. A file that
  no other plan owns and that sits next to a listed module is covered by the
  pre-authorization above only when it is named in the manifest.

### Continuation 2 verification

The continuation verification above applies, with evidence under
`tmp/clm-s732/<planId>/`, and these additions:

- clm-02 produces the two multi-page expected files with HEAD 29f8691 code
  before its first A7 source edit and checks them against
  `target/clm-baseline/nodetto-cli` (output must be byte-identical; the
  baseline binary is older than clm-13, so this check also confirms that the
  landed selector work did not change edit output). A difference is a
  blocker to record, not a reason to regenerate.
- clm-09 runs the production-core strict check: `bun run typecheck
  --noUncheckedIndexedAccess` with its full log kept, and the gate passes
  when no diagnostic names a non-test file under `packages/core/src/`.
  Existing test-file diagnostics are the recorded baseline.
- `arrange --mode layered|route` is reachable from the native binary only
  after clm-09 registers it, so clm-09 also times, with `/usr/bin/time -p`
  on the release binary, `arrange --mode route` on the `multiPage` grid page
  and `arrange --mode layered` on a BPMN page of 3 pools, 6 lanes and 60
  units, and records the times and exit statuses (Boa rules). There is no
  fixed threshold; a quadratic slowdown found here is a clm-09 blocker.

## Continuation 3 partition

History: its waves are replaced by "Continuation 4 partition" below, and
`impl-plans/active/clm-s736-dispatch.json` must not be dispatched again.

Added 2026-11-05 for HEAD d5b9bac. It replaces the waves above. The ownership
rules, contracts and single-owner notes above stay binding, as amended by D1 to
D3. The fresh manifest is `impl-plans/active/clm-s736-dispatch.json` with evidence
root `tmp/clm-s736/`; the clm-s725, clm-s731 and clm-s732 manifests must not be
dispatched again.

State at HEAD d5b9bac:

- Landed: clm-01, 03, 04, 06, 07, 08, 10, 13, 14, 15. In the tree: fix 1
  (`FRAME_TITLE_BAND` in `arrange-layered.ts`), fix 2 (`firstRank`), fix 3
  (`documentRelativePath` in `lint-diagram.ts`), F1 to F3 (`edit/selectors.ts`,
  `operations/select.ts`) and the E2 route part (`ROUTE_PAGE_KINDS`).
- clm-02: dirty pages, scoped planning and fixtures are committed, and
  `ApplyOptions.keepMembers` reaches the planners. Open: IR-S732-CLM02-A7-RATIO,
  resolved by D3.
- clm-12: free row, first-leaf routing and leaf order are committed. Open:
  IR-S732-CLM12-LANE-RESTACK (D1) and IR-S732-CLM12-DEEP-INSET (D2), which are
  implemented and verified together.
- clm-11: only the core `keep-members.test.ts` exists. `edit/carry-members.ts` is
  absent, and the A6 frame-only branch is still in `operations/elements.ts`.
- clm-09: not started. `arrange-modes.ts` has no BPMN dispatch.

| Wave | Plan | Remaining scope | Added write paths | dependsOn |
| --- | --- | --- | --- | --- |
| 1 | clm-02-connector-edit-perf | D3 in full | this design file (only the "A7 attribution record"), `apps/cli/native/examples/clm-a7-probe.rs` (temporary), `apps/cli/src/edit/report.ts`, `packages/core/src/hit-test.ts`, `packages/core/src/layer-state.ts`, `packages/core/src/clipping.ts`, `packages/core/src/frame-translation.ts`, `packages/core/src/frame-tree.ts`, `packages/io/src/jsonl/`, `packages/ir/src/validate.ts`, and the tests next to each | - |
| 1 | clm-12-bpmn-layered | D1 and settling on pages with `D` of at least 2, the D2 inset, strict depth-one identity, and the D1, D2 verification row. No depth-one output change without the Q11 amendment. The plan's rules 6 and 7 are revised to match before dispatch | the depth-one expected files, next to the planner test | - |
| 2 | clm-11-container-carry | E1 CLI module and per-kind tests, unchanged scope | `packages/core/src/keep-members.test.ts`, plus the core planner files already pre-authorized for `keepMembers` defects | clm-02 |
| 3 | clm-09-wiring | Unchanged scope, plus applying `settleCommands` in the BPMN dispatch, counting all three lists for `--check`, and expecting the D2 inset in wiring tests | none beyond its existing list | clm-02, clm-11, clm-12 |

- clm-11's dependency is a contract need, not a file handover. The option exists
  at HEAD, but D3 may still change `Editor.apply` and the scoped planning that
  `keepMembers` passes through, and E1's per-kind tests must verify the accepted
  behavior. This also matches the owner's stated order and the limit of two waves
  before wiring.
- clm-02 and clm-12 share no write path. clm-12 reads `bpmn/containment.ts`, and
  clm-02's fixtures have no BPMN page, so D3 has no reason to edit it. If
  attribution says otherwise, clm-02 records an amendment.
- Each plan lists its own plan file in `writePaths` for ownership tracking only,
  as clm-12 did in clm-s732, and must leave it unchanged. Plan revisions for D1 to
  D3 land before dispatch.

### Continuation 3 verification

The continuation verifications above apply, with evidence under
`tmp/clm-s736/<planId>/`, and these additions:

- clm-12 captures the depth-one expected files from HEAD d5b9bac code before its
  first planner edit, and records their hashes. A difference found after that is
  a defect to fix, never a reason to regenerate.
- Q11 is blocking. Until the owner answers it, the run may not report the
  depth-one containment criterion as met for the conflict inputs in E2.1. clm-12
  and clm-09 report it as open with a reference to Q11, and no gate treats a
  proposed exception as accepted.
- clm-02's ratio gate command exits 0 only under the D3 outcome rules: both ratios
  at most 2.0 x, and, when either is above 1.5 x, a filled-in "A7 attribution
  record". Another gate confirms that `apps/cli/native/examples` does not exist.
- clm-09 runs the final gates. `mise run test-cli` keeps the 3-attempt retry, and
  the manual native timing of the obstacle-routing fixtures is compared with
  `target/clm-baseline/nodetto-cli`.

## Continuation 4 partition

History: its waves are replaced by "Continuation 5 partition" below, and
`impl-plans/active/clm-s737-dispatch.json` must not be dispatched again.

Added 2026-11-05 for HEAD c548457. It replaces the waves above. The ownership rules,
contracts and single-owner notes above stay binding, as amended by D1, D2 and D3'.
The fresh manifest is `impl-plans/active/clm-s737-dispatch.json` with evidence root
`tmp/clm-s737/`. The clm-s725, clm-s731, clm-s732 and clm-s736 manifests must not be
dispatched again.

State at HEAD c548457:

- Landed: clm-01, 03, 04, 06, 07, 08, 10, 12, 13, 14, 15.
- The three integration fixes are in the tree, each with test cases: fix 1 in
  `arrange-layered.ts` with "TB reserves the title band at the top" in
  `arrange-layered.test.ts`, fix 2 (`firstRank`), and fix 3 (`documentRelativePath`
  with cases in `lint-diagram.test.ts`). This was confirmed by reading the code. They
  need no new work and are confirmed by clm-09's final gates.
- clm-02: dirty pages, scoped planning, fixtures and `keepMembers` are committed.
  Open: all of D3'.
- clm-11: only the core `keep-members.test.ts` exists. `edit/carry-members.ts` is
  absent, and the A6 frame-only branch is still in `operations/elements.ts`.
- clm-09: not started. `merge`, `--quiet` and `--metrics` are absent from
  `commands.ts`, `main.ts`, `native-engine.ts` and `help.ts`, and no git driver test
  or doc exists.

| Wave | Plan | Remaining scope | Write paths (additions and limits) | dependsOn |
| --- | --- | --- | --- | --- |
| 1 | clm-02-connector-edit-perf | D3' in full: (a), (b1), (b2), timings | `apps/cli/src/edit/apply-batch.ts` and test, `packages/ir/src/validate.ts` and `validate.test.ts`, `packages/io/src/jsonl/parse.ts`, `serialize.ts`, new `source-lines.ts` and test, `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`, `apps/cli/src/edit-performance.test.ts`, `apps/cli/src/native-parity/edit-performance.test.ts`. Only if a marginal ratio is above 1.5: the core files already listed for clm-02, under the shared note below | - |
| 1 | clm-11-container-carry | E1 CLI module and per-kind tests, unchanged scope | As in the clm-11 plan: `apps/cli/src/edit/carry-members.ts` and test, `operations/elements.ts` (carry block), `operation-fields.ts`, `edit-frame-carry.test.ts`, `selectors.test.ts`, `operation-input.ts`, `keep-members.test.ts`, and the core planner files for `keepMembers` defects. Not `apply-batch.ts` | - |
| 2 | clm-09-wiring | Unchanged scope, including the BPMN dispatch with `settleCommands` | Its existing list plus `apps/cli/src/mcp.test.ts` | clm-02, clm-11 |

- clm-11 no longer depends on clm-02. The contract it uses is at HEAD
  (`ApplyOptions.keepMembers` in `editor/types.ts`, forwarded in `facade/core.ts`, used
  by `transaction.ts`). The old reason for waiting was that D3 might change
  `Editor.apply`. D3' changes only `applyBatch`, the validator, the parser and the
  serializer.
- `apply-batch.ts` is not shared in wave 1. clm-11 reaches `keepMembers` through
  `editor.apply` in `operations/elements.ts`, and held members are not an `applyBatch`
  concern. clm-09 adds its `matches` line in wave 2.
- Shared note: `packages/core/src/frame-translation.ts` and
  `packages/core/src/editor/transaction.ts` are in both wave-1 `writePaths`, because
  clm-02 may need them if the mixed ratio is above 1.5 and clm-11 may need them for a
  `keepMembers` defect. clm-11 edits only `keepMembers` branches and clm-02 only
  page-bounding logic. Neither is expected to edit them, and neither changes behavior
  without `keepMembers`.
- clm-09's dependencies are real: its parity tests and help assert E1 messages and D3'
  behavior, and its final gates need both plans in the tree.
- Plan files stay unchanged by workers, as in continuation 3. Plan revisions for D3'
  land before dispatch.

### Continuation 4 verification

The continuation verifications above apply, with evidence under
`tmp/clm-s737/<planId>/`, and these changes:

- clm-02's gate is the D3' gate. The continuation 3 ratio gate, the `single/baselineSingle`
  limit and the `apps/cli/native/examples` gate no longer apply.
- Q11 stays blocking with the rules above. clm-09 still reports the exact line
  `Q11 open: depth-one containment not accepted for conflict inputs` while it is
  unanswered. Q11 blocks no plan in this partition, and the E2 criterion is not
  reported as fully met for those inputs.
- clm-09 runs the final gates: `mise run verify`, `mise run test-cli` with the 3-attempt
  retry and `/usr/bin/time -p` CPU comparison against
  `target/clm-s737-before/nodetto-cli`, and manual native timing of the obstacle-routing
  fixtures. No deadline is relaxed.

## Continuation 5 partition

Added 2026-11-05 for HEAD 235b8c8. It replaces the waves above and finishes clm-09
only. There is no redesign: the ownership rules, contracts and decisions D1, D2 and
D3' stay binding. The fresh manifest is `impl-plans/active/clm-s740-dispatch.json`
with evidence root `tmp/clm-s740/`. All earlier clm manifests must not be dispatched
again.

State at HEAD 235b8c8:

- Landed and accepted: every clm plan except clm-09.
- clm-09 is in the tree: registration, BPMN dispatch with `settleCommands`, diagram
  lint and metrics, sync and async `--quiet`, warning collapse, `matches`, core
  exports and MCP assertions.
- Help and docs are initial only. For example, the `arrange` and `lint` usage lines
  omit the new flags, `edit` has no E1 per-kind table or label mapping, and
  `export.md` has no determinism bullets.
- These planned files are absent: `cli-wiring.test.ts`, `merge-git.test.ts`,
  `__fixtures__/bpmn-layered.ts` and the four `native-parity` topic files.

Every feature is reachable through the registered commands at this HEAD, so the three
wave 1 tracks need no handover from each other.

| Wave | Plan | Scope | Owned write paths | dependsOn |
| --- | --- | --- | --- | --- |
| 1 | clm-09a-help-docs | "Help and documentation" in full, except `mcp.ts` (no change) and `impl-plans/` | `apps/cli/src/help.ts`, `docs/cli.md`, `README.md`, `design-docs/specs/export.md`, `design-docs/specs/design-cli-ai-drawing.md`, `apps/cli/src/ai-commands.test.ts`, `apps/cli/src/mcp.test.ts` | - |
| 1 | clm-09b-cli-tests | CLI-level tests and the git driver end-to-end test, plus wiring gaps they expose | `apps/cli/src/cli-wiring.test.ts`, `apps/cli/src/merge-git.test.ts`, `apps/cli/src/commands.ts`, `cli.ts`, `main.ts`, `warnings.ts`, `merge-command.ts`, `arrange-modes.ts`, `lint-metrics.ts`, `lint-diagram.ts`, `edit-command.ts`, `draw-command.ts`, `export-command.ts`, `packages/core/src/index.ts` (missing exports only), and their existing tests for intentional assertion updates, plus `commands.test.ts`, `mcp-stdio.test.ts`, `text-layout-lint.test.ts` and `breadboard-commands.test.ts` | - |
| 1 | clm-09c-native-parity | The four native parity topic files and their fixture, plus native-only wiring gaps | `apps/cli/src/__fixtures__/bpmn-layered.ts`, `apps/cli/src/native-parity/layout.test.ts`, `merge.test.ts`, `edit-usability.test.ts`, `lint-rules.test.ts`, `apps/cli/src/native-engine.ts`, and, only if an asserted output changed, `native-parity/harness.ts`, `documents.test.ts`, `drawing.test.ts`, `text-layout.test.ts`, `edit-performance.test.ts` | - |
| 2 | clm-09-wiring | Final gates, native timing, stable-tree verification, self-review and the progress log | `impl-plans/progress/clm-09-wiring.md`, plus the union of the wave 1 paths, used only to fix a gate failure within wiring scope | clm-09a, clm-09b, clm-09c |

- clm-09-wiring's dependency is real: final gates and timing must run on the complete,
  stable tree.
- Fixture: only clm-09c and the timing use `bpmn-layered.ts`. `cli-wiring.test.ts`
  writes its documents inline. No wave 1 track imports another track's new file.
- Help assertions: clm-09a owns them in `ai-commands.test.ts` and `mcp.test.ts`. A help
  assertion elsewhere that its text breaks is fixed in wave 2.
- Native builds: in wave 1 only clm-09c builds the release binary and runs native tests,
  so wave 1 has one cargo build and no deadline test competing with another track.
  clm-09b runs `merge-git.test.ts` on the Bun path in wave 1, and wave 2 runs it with the
  binary after a fresh rebuild. `target/clm-baseline` and `target/clm-s737-before` stay in
  place.
- A defect in a feature module stays a finding for its owning plan. Only listed wiring
  changes are allowed.
- The manifest is the concrete write list for each plan. It can add wiring paths for the
  same purpose, such as `apps/cli/src/edit/report.ts`.
- `apps/desktop/src-tauri/gen/schemas/*.json` may be rewritten by `mise run verify` and
  is never staged.

### Continuation 5 verification

Rows "E1", "E2", "F1" to "F4", "B2", "B3", "C3", "D1" to "D3" and "Native parity" in
"Verification" define the test content, as specified in `impl-plans/completed/clm-09-wiring.md`.
Evidence is under `tmp/clm-s740/<planId>/`. These additions and changes apply:

- clm-09b adds one CLI-level refusal test: a BPMN page that gets an E2.1 `{ error }` exits
  2 and leaves the file unchanged.
- Q11: no test pins the reproduction either way, and no depth-one output changes. The D1,
  D2 row is otherwise unchanged. The clm-09-wiring progress log and final report contain
  this exact line, and the E2 criterion is not reported as fully met for those inputs. The
  line blocks nothing:
  `Q11 open: depth-one containment not accepted for conflict inputs`
- Final gates in clm-09-wiring, in this order, on the stable tree: rebuild the release
  binary; native parity with `NODETTO_CLI_TEST_BINARY` set and more than 0 tests run; the
  git driver test with the binary; `bun run typecheck`; the production-core
  `--noUncheckedIndexedAccess` gate; the desktop production build; `mise run verify`; and
  `mise run test-cli`. Native deadline tests and `mise run test-cli` get up to 3 attempts,
  with every attempt's log kept. No deadline is relaxed.
- Timing in `tmp/clm-s740/clm-09-wiring/timing.log`, using `/usr/bin/time -p`: the six D3'
  inputs from `tmp/clm-s737/clm-02-connector-edit-perf/inputs/`, each from a fresh copy,
  on the release binary and `target/clm-s737-before/nodetto-cli`; and the two arrange
  timings. A marginal ratio above 1.5, or a quadratic arrange slowdown, is a finding for
  the owning plan.
