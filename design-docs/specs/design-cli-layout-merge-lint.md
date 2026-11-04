# nodetto-cli: layered and route arranging, three-way merge, edit usability, lint additions

Status: DESIGNED, 2026-11-04

Owner decisions: `design-docs/user-qa/cli-layout-merge-lint.md`. Each open
question has a default that this design implements. A different answer
changes only the section named in that question.

Baseline: `design-docs/specs/design-cli-ai-drawing.md` (commands, edit
batches, live co-editing merge), `design-docs/specs/design-text-layout-lint.md`
(lint rules and wide-aware widths), `design-docs/specs/export.md` (export
pipeline) and `design-docs/specs/native-hosts.md` (shared engine in Boa). Those
decisions stay as they are. This document adds only the behavior below.

## Overview

Four groups of additive CLI behavior. They all run in the shared TypeScript
engine, so the Bun CLI and the native CLI (Boa) behave the same.

| Group | Adds |
| --- | --- |
| A arrange/routing | `arrange --mode layered`, `arrange --mode route`, edge label placement, port spreading, self-loop sides, `carryMembers:false` on frame `update`, edit performance with obstacle routing |
| B merge | `nodetto-cli merge <base> <ours> <theirs> [--output]`, git merge driver setup, documented SVG export determinism |
| C edit usability | `label` on `update`, unknown operation fields rejected with suggestions, collapsed repeated warnings, global `--quiet` |
| D lint | `node-overlap` (ERD and other node pages), `image-missing`, `lint --fix` text wrapping, `lint --metrics` (crossings and label overlaps) |

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

`--mode layered` and `--mode route` accept pages of kind `state`, `flowchart`,
`freeform`, `architecture` and `uml`. On any other kind (erd, sequence, bpmn,
breadboard, pcb) they exit 2 with a message that names the supported kinds.
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
- `--direction TB` transposes this: frames become rows top to bottom, members
  run left to right and are centred on the row axis.

After placement, layered runs the route stage (A2 to A5) on every connector of
the page, with the same `--reset-manual` value.

### A2. `--mode route`

- Moves no element. It only changes connector semantics.
- Targets: every connector on the page whose two ends are attached to
  elements, or only `--ids`. Each `--ids` value is a unique id prefix of a
  connector on the selected page; anything else exits 2. `erd.relation`,
  `sequence.message` and `bpmn.*` are never targets, because their pages are
  not eligible.
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
  of non-edge, non-frame, non-group elements (endpoints included), and the
  route segments of other connectors. The first candidate that scores 0 wins.
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
- `carryMembers` must be a boolean. On an element that is not a frame it exits
  2 ("carryMembers applies only to frames"). `move` does not take it.
- Help (`edit`) documents the default and the opt-out.

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
  `nodetto_merge`), the OVERVIEW under "Convert and check", and the docs.

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
- It lives in the CLI lint layer (it needs `CommandIo`). It counts as an error,
  so lint exits 1, because export fails on a missing attachment.

### A3 metrics: `lint --metrics`

- Adds per-page counts for every linted page that has connectors:
  - `edgeCrossings`: for each unordered pair of distinct connectors, the
    number of proper intersection points between their resolved polylines.
    Points within 1 unit of an endpoint of either connector do not count, and
    collinear overlapping segment pairs count once.
  - `labelOverlaps`: the number of pairs of a label box against another label
    box, a non-edge element box, or another connector's segment, using the
    same boxes as A3.
- Text output: `metrics <page name>: <n> edge crossing(s), <m> edge-label overlap(s)`
  on stdout after the findings. JSON output: `metrics` on each page and as
  totals in `summary`.
- Without `--metrics`, the text and JSON output are unchanged. Metrics never
  change the exit code.
- The code is in `packages/core/src/diagram-lint/metrics.ts` and is shared with
  the A3 scoring, so the two measures agree.

## Help and documentation

| Where | Content |
| --- | --- |
| `apps/cli/src/help.ts` | OVERVIEW (`merge`, `--quiet`), `arrange` (modes, `--frames`, `--ids`, `--reset-manual`, manual-setting rule), `edit` (`label` on update with the mapping table, `carryMembers` and the default frame-move behavior, unknown-field rejection), `lint` (new rules, page table, `--fix`, `--metrics`), `merge` (usage, conflict policy, exit codes, git driver setup), `export` (determinism guarantee) |
| `docs/cli.md`, `README.md` | the same user-facing content, the git driver recipe, the SVG regeneration recipe |
| `design-docs/specs/design-cli-ai-drawing.md` | a pointer to this document under edit and arrange |
| `design-docs/specs/export.md` | the determinism guarantee in Goals and Rollout |
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
| Native parity | new topic files in `apps/cli/src/native-parity/`: `layout.test.ts` (arrange modes, A7 deadline), `merge.test.ts` (merge, git driver with the binary), `edit-usability.test.ts` (C1 to C3, A6), `lint-rules.test.ts` (D1 to D3, `--fix`, `--metrics`) |

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
  The existing tests and fixtures that pass extra operation fields are audited
  and fixed in the C plan.
- Suggested plan partition, to avoid write-path conflicts in `commands.ts`,
  `help.ts`, `docs/cli.md` and the parity files:
  - Wave 1 in parallel: (a) IR fields and resolver (`packages/ir`,
    `packages/core/src/shapes/connector`); (b) A7 profiling and fix (core
    editor or derived planning, a perf fixture, the native deadline test);
    (c) the B merge engine and command (it owns `commands.ts`, `help.ts` and
    the docs in this wave).
  - Wave 2: C1 to C3 and A6 (edit, warnings, `--quiet`).
  - Wave 3: A1 to A5 (arrange modes, using wave 1a).
  - Wave 4: D1 to D3 and `--metrics` (lint, using the wave 3 metrics module).
  - Each plan sets `artifactRoots ["target"]` and lists every edited file,
    docs included, in `writePaths`.
- The work is local only, with no push.
