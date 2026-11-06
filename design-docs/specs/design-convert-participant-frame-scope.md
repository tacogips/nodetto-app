# Element conversion, sequence participant shapes, ERD frame scope

Status: DESIGNED, 2026-11-06

## Overview

Three independent improvements. All three run in the Bun CLI and in the native CLI,
because the native CLI hosts the same bundled TypeScript engine in Boa. No Rust source
change is expected, so the native work is parity tests.

- **E1**: edit op `convert`, and `delete` with `reconnectTo`.
- **E2**: `sequence.participant` kinds `actor` and `db` draw as their own shapes in
  export and on the canvas. `service` stays the existing box.
- **E3**: a scope rule for `ddl --frame`, plus a lint rule for tables that straddle a
  frame edge.

Baselines kept unchanged:

- `design-cli-ai-drawing.md`, "ddl --frame resolution": how `--frame` picks a frame.
  This document only changes what that frame contains for DDL.
- `design-z-order.md` and `design-cli-layout-merge-lint.md`: `frameParents`
  ownership. E3 does not change it, so canvas selection, carrying, clipping,
  `where.parent` and paint order behave as before.

No new user decision is open. Every choice the request left open is recorded under
"Decisions".

## E1: `convert`

### Input

```json
{"op":"convert","id":"<ref>","type":"<element type>","shape":"<shape id>",
 "semantic":{},"label":"<text>"}
```

- Targets: `id`, or `where` with optional `expect`, through `selectedWhere`, the same
  way as `update`. Each match is converted. The batch stays all-or-nothing.
- At least one of `type` and `shape` is required. If both are given,
  `shapeCreation(shape).type` must equal `type`. `Batch.shape()` rejects that pair, so
  `convert` calls `findShape` and `shapeCreation` directly.
- `shape.geo` with a chosen geometry works through `semantic`, for example
  `{"type":"shape.geo","semantic":{"geo":"..."}}`.
- `visual` is not accepted. A later `update` changes it. Unknown fields are rejected
  by `OPERATION_FIELDS`, as for every other op.

### What can be converted

These fail with an `OperationError`, and nothing is written:

| Case | Error says |
| --- | --- |
| Source or target is an edge category type, or a connector shape | Connectors are not convertible |
| Source or target is `frame` or `group` | Containers are not convertible, because membership would change |
| Element is locked | Unlock it first (`updateVisual` with `locked:false`) |
| Connected connector is invalid for the target type | Names the connector, its type and the allowed endpoints |
| A non-edge element depends on the source and the type changes | Names the dependent element (for example `sequence.activation.participant` or `uml.port.owner`) |
| Result fails `validateSemantic` for the target | The existing `invalid element` message |
| Target cannot keep the source's resolved bounds | Names the id, target type and both sizes (see "Preserved state") |

Frame and group `memberIds` stay valid for any target type, so they never block a
conversion.

Connector checking uses `references()` over the page, indexed once per operation:

- `connectorEndpointIssues` is called with a resolver that reports the converted type
  for this id.
- BPMN flows are checked with `resolveBpmnConnection`
  (`packages/core/src/bpmn/connection.ts`) on a document holding the converted type, passing
  the flow's current type as `requested`. A rejection fails the conversion, and so does an
  accepted result whose `type` differs from the flow's type (`corrected: true`), because
  connectors are never retyped. `planBpmnReconnect` is not used, since it retypes the flow.
  The check is reached through a new method on the editor facade
  (`packages/core/src/editor/facade/notation-editing.ts`), so E1 needs no index change.

A failure aborts the batch. This is the design's choice over adapting the connector:
it never silently changes a connector's type.

### Semantic mapping

The result is built in this order, with later steps winning:

1. Target defaults: `registry.getOrFallback(type).defaultSemantic()`.
2. Same-name source fields that the target knows (`keyOrder.keys`) and whose value
   passes the target's validation. For a same-type conversion, all source fields
   carry.
3. `shapeCreation(shape).semantic`, because the shape defines these fields (for
   example `geo` or `kind`).
4. Text: the source text field, read through `labelField`, goes to the target's text
   field through `applyLabel`. This is the mapping `update` already uses, for example
   `label` to `name` or `tableName`.
5. `operation.semantic`, resolved by `resolveReferences`.
6. `operation.label`.

Step 4 runs only when the source text is a non-empty string and neither step 5 nor
step 6 set the target text field. It runs after the type change, because
`editableFieldOf` reads the store.

**Field rule**: a source field that does not carry is dropped and reported. It is never
kept as an unknown field. A source text the target has no field for is also dropped and
reported.

Converting to `sequence.participant` from another type takes `order` from a new facade
method that wraps `nextParticipantOrder`, unless `operation.semantic.order` is given.

### Preserved state

- `id`, `page`, `index`, `accessibility`, and the whole `visual` object are kept. So
  explicit memberships stay valid, and z-order and positional membership do not move.
- When the type changes, missing `visual.x/y/width/height` are first filled from the
  source's resolved bounds. A same-type conversion leaves `visual` untouched, so a
  semantic-only participant keeps its automatic layout.
- **Bounds contract**: every successful conversion leaves the element's resolved bounds
  (`x`, `y`, `width`, `height` from `boundsOf`) exactly equal to the source's. The check
  runs at the end of each element's conversion, after the semantic and text steps.
  A difference, or a source or result with no resolved bounds, fails the operation and aborts
  the batch, so nothing is written. Existing shape sizing is not changed to make a conversion
  fit.
  - This is what rejects targets that derive their size from content. `erdTableBounds`
    and the `uml.class` bounds derive height from the payload and ignore `visual.height`,
    and a 180x120 node converted to a one-column `erd.table` would resolve to height 56.
  - The error names the id, the target type, and both the source and resulting sizes. The
    caller can resize the element in an earlier `update` in the same batch and retry.
- **Membership**: `frameParents` depends only on id, index, resolved bounds and frame
  `memberIds`. Convert keeps all of them and does not accept a frame or group as source or
  target, so explicit and positional membership are both unchanged after success.
- Connectors are not rewritten at all. Endpoints, `fromPort`/`toPort`, label and routing
  stay byte-identical. A target without connection ports (`sequence.participant`) falls
  back to automatic attachment through the existing `pinnedPort` behavior, and the kept
  port is reported with the connector.

### Core command

Element type has no mutation today, and delete plus create cascades connectors. Add one
command to `packages/core/src/commands.ts`:

```ts
{ type: "convertElement", id, elementType, semantic, visual }
```

- It validates the semantic and visual against `elementType`.
- It keeps the id and index, and its inverse is another `convertElement`.
- It re-checks `connectorEndpointIssues` for every edge that references the id. The
  existing post-apply check covers only `updateSemantic` and `createElement`.
- `editor/transaction.ts` adds it to the commands that trigger derived planning.
- `editor/dirty-pages.ts` adds it to the changed elements.

No app UI exposes conversion in this scope.

### Desktop reconciliation

The desktop can receive a converted file while it holds unsaved edits. `mergeDocuments`
merges `type` and `semantic` independently. Confirmed case: base `sequence.participant`
with kind `service`, local sets kind `actor`, and the file converts the same id to
`state.node`. The merge gives `state.node` with kind `actor`, which fails target
validation, and `session.ts` commits the merge to the store before it raises the conflict.

Policy, in `planOutsideChange` (`apps/desktop/src/file/session-reconcile.ts`), dirty branch
only. When any element has a different `type` in base, local or remote, the function returns
`null` if any of these holds:

1. **Concurrent edit of a converted element**: for an element present in all three
   documents whose type differs, local and remote differ in `type` or `semantic`, and each
   side differs from base in `type` or `semantic`.
2. **Invalid merge**: `validateDocument` on the merged document reports an error.
3. **Dependent broken by conversion**: an element in the merged document depends on a
   converted element and the new type does not suit it. A converted element is one whose
   merged type differs from its base type.

Check 2 alone does not catch incompatible connectors: `validateDocument` reports
`connector.endpointType` as a warning (`packages/ir/src/validate.ts`). Confirmed case: base
has participants widget and orders, local adds a `sequence.message` from widget to orders,
and the file converts widget to `state.node`. `mergeDocuments` reports no conflict, validation
reports zero errors and one warning, and check 1 does not match because local did not edit
widget.

Check 3 applies the rules `convert` enforces, to the merged document:

- **Connectors**: call `connectorEndpointIssues` with a resolver that returns only converted
  elements and `undefined` for every other id, and treat a `connector.endpointType` issue as
  a match. An endpoint on an unconverted element is never looked at, so existing endpoint
  warnings elsewhere stay warnings, and warnings are not promoted to errors in general.
- **BPMN flows**: a `bpmn.` edge with an endpoint on a converted element matches if it is
  absent from base or differs from base. `connectorEndpointIssues` has no BPMN policy and
  `validateDocument` reports nothing here. Confirmed case: base has `bpmn.task` elements
  widget and orders, local adds a `bpmn.sequenceFlow` from widget to orders, and the file
  converts widget to `bpmn.textAnnotation`. A BPMN flow unchanged from base does not match,
  because `convert` already applied the connection rules to it on the converting side. No
  connector type is corrected here: the case goes to the banner.
- **Other dependents**: an element that is not an edge, frame or group and references a
  converted element (through `referencesOf`) matches, for example a new
  `sequence.activation` on a converted participant.

The check lives in `session-reconcile.ts` and uses only existing exports
(`connectorEndpointIssues` and `getElementTypeDefinition` from `@nodetto/ir`, `referencesOf`
from `@nodetto/core`), so it needs no change to `packages/core/src/index.ts`. It runs only
when a type changed, and it does not change `validateDocument` or `mergeDocuments`.

`null` is the existing boundary: `handleFileChanged` cancels autosave and raises the banner
with `diskText`, without touching the store. The person then chooses reload or keep mine,
so no local edit is lost silently and no invalid element reaches the store. The conflict is
reported as the whole-file banner, not per element.

Unchanged:

- A clean session takes the converted file as it is.
- A dirty session merges a conversion with disjoint edits, for example a local move of the
  converted element or an edit of another element.
- Documents with no type change skip all three checks, so their merging and cost are the same.
- `mergeDocuments` and CLI `merge` are not changed. CLI `merge` already validates its result
  and exits 2 on an invalid merge (`docs/cli.md`).

E1 owns this change: `apps/desktop/src/file/session-reconcile.ts`, and tests in
`apps/desktop/src/file/session-external.test.ts`, with `session.ts` authorized only if the
tests show it needs a change.

### Required regression tests

Conversion (Bun, with parity for the CLI-visible cases):

- Ordinary shape conversion succeeds with resolved bounds, `index` and `visual` geometry
  equal to the source's.
- A 180x120 node converted to a one-column `erd.table` fails, names both sizes and leaves
  the document bytes unchanged. `--dry-run` fails the same way.
- A batch with a valid earlier op and an incompatible convert writes nothing.
- A resize in an earlier `update` that matches the target's derived size lets the same
  conversion succeed.
- Converting a `bpmn.task` with a `bpmn.sequenceFlow` to `bpmn.textAnnotation` fails, names the
  flow and leaves the document bytes unchanged. `delete` with `reconnectTo` onto a
  `bpmn.textAnnotation` fails the same way. The flow is never retyped.
- `frameParents` output is equal before and after conversion for an explicit member and for
  a positional member (below and above the frame in z-order).

Reconciliation (`session-external.test.ts`):

- Local semantic edit with a remote conversion raises the banner. The store still holds the
  local element, and it stays valid.
- Remote semantic edit with a local conversion does the same. The local conversion is
  applied to the editor with a `convertElement` command.
- A clean session takes an external conversion in place.
- A local move of the element with a remote conversion merges, without a banner, into the
  new type at the moved position.
- A local new `sequence.message` whose endpoint the file converts to `state.node`: the test
  first asserts that the merged document has zero validation errors and a
  `connector.endpointType` warning, then that `planOutsideChange` returns `null`, the store
  is unchanged and still holds the message and the participant, and the banner is up. The
  reverse direction (remote new message, local conversion) gets the same assertions.
- A local new `sequence.activation` on a participant the file converts raises the banner.
- A local new `bpmn.sequenceFlow` from widget to orders, where the file converts widget from
  `bpmn.task` to `bpmn.textAnnotation`: the merged document has no conflicts and no validation
  errors, `planOutsideChange` returns `null`, the store is unchanged and the flow keeps its
  type, and the banner is up. The reverse direction (remote new flow, local conversion) gets
  the same assertions.
- A BPMN conversion with an existing flow unchanged from base, and with a local move of the
  converted element, merges without a banner.
- A conversion merged with an existing `connector.endpointType` warning on an unconverted
  element still merges without a banner, and that warning is unchanged.
- Existing disjoint-field merges still pass, for example the existing move-and-rename test.

Targeted commands: `bun test packages/core/src/document-merge.test.ts
apps/desktop/src/file/session-external.test.ts` and `bun run typecheck`.

### Report

`BatchResult` gains two optional lists. Each is printed in text and appears in JSON only
when non-empty, so existing reports stay byte-identical.

```text
converted: [{operation, id, fromType, toType, shape?,
             mapped:[{from,to}], dropped:[path],
             connectors:[{id, type, keptPorts?}]}]
reconnected: [{operation, deleted, to, connectors:[id]}]
```

Each dropped field is also an `EditWarning` with code `convert.fieldDropped`. Text lines:

```text
  converted <id> <fromType> -> <toType>
    mapped <from> -> <to>
    cannot carry <path>
    connector <id> (<type>)
```

These lines print on `--dry-run` and on a real write, and `--quiet` does not hide them,
as with match lines. Warning lines follow the existing `--quiet` behavior.

## E1: `delete` with `reconnectTo`

`{"op":"delete","id"|"where":...,"expect":n,"reconnectTo":"<ref>"}`

Before the delete, every edge with an endpoint on a deleted element is repointed to the
target, through `updateSemantic`. Only `from`/`to` (or `from.table`/`to.table`) change.
Label, ports, port positions and routing stay as they are.

Failure cases, all atomic:

- The target is missing, is on another page, is an edge, or is one of the deleted
  elements.
- A connector is invalid for the target, by the same checks as `convert`.
- A connector would become a self-loop on a type that does not allow one. Only
  `state.node` and `erd.table` allow it, the same rule as `connectByType`. The error
  names the connector so the caller can delete it first.
- An `erd.relation` column id has no same-name column on the target table. Otherwise
  column ids are remapped by column name.

Non-edge references (activations, frame `memberIds`) are not moved. They follow the
type's existing cascade or detach rule.

## E2: participant shapes

Geometry is unchanged: bounds, hit testing, lifeline x (box centre), lifeline start,
message y and activation x stay the same. All new paint stays inside the head band, which
is 56 px in export and 54 px on the canvas (existing values).

| Kind | Head band |
| --- | --- |
| `service` or missing | Existing rounded box. Export output stays byte-identical. |
| `actor` | Stick figure (head circle, torso, arms, legs) centred on the box centre, in the top of the band, with no box. Name on one line in the bottom 20 px. |
| `db` | Cylinder path filling the band (top ellipse, sides, bottom arc). Name centred below the top ellipse. |

- New module `packages/core/src/shapes/sequence-participant-notation.ts`:
  `sequenceParticipantNotation(kind, headBox)` returns
  `{ primitives: NotationPrimitive[], labelBox }`, or `null` for `service`. It follows
  the `stateNodeNotation` pattern, so export and canvas share the geometry.
- Export: `renderSequenceParticipant` paints the lifeline first, then the primitives,
  then `centredLabel(labelBox)`. Fill and stroke overrides keep working through `styled`.
  PNG and PDF follow automatically, because they rasterize this SVG.
- Canvas: `SequenceParticipantView` receives `box` from `ShapeView` and renders the
  primitives through `BpmnNotationPrimitiveView`, as `StateNodeView` does. Actor and db
  drop the uppercase kind caption, because the shape now states the kind. Service keeps
  it. CSS goes in `apps/desktop/src/styles/canvas.css`. Smart paint attributes follow
  `GeoShapeView` and `FreehandView`.
- The canvas render path is in `packages/ui-solid`, so that package is in scope.
- `nodetto-cli types sequence.participant` adds a rendering line stating how each kind
  renders. JSON adds a `rendering` key for this type only.

Tests:

- SVG structure and geometry per kind, and service byte equality.
- Lifeline start and message endpoints equal across kinds.
- PNG pixel difference inside the head band with an empty name, so no platform font is
  needed. PDF export succeeds for each kind.
- Canvas view test in the `text-note-view.test.ts` pattern: an exported pure view-model
  helper from the `.tsx`, because the repo has no DOM test environment.

## E3: frame membership for DDL

### Rule

The rule applies only to `erd.table` and only inside `generateDatabaseDdl` with
`frameId`. The CLI and the desktop Database DDL panel get it from there. Page-wide DDL is
unchanged. Views and other database objects keep today's `expandContainers` scope.

Definitions for selected frame F:

- `base` = `expandContainers(F)`. Everything in `base` stays included, so output only
  ever grows.
- Containers = F and every frame in `base`.
- A container is **open** if it has no `memberIds`, or if `memberIds` is non-empty and
  lists only frames. Otherwise it is **closed**: its list states its direct content
  exactly. That covers `memberIds: []` and any list naming a non-frame element.
- "Fully inside" uses the inclusive, unrotated test from `frameParents`.

Each page table T outside `base` is classified in this order:

1. **Claimed elsewhere**: a frame outside `base` lists T in `memberIds`. Excluded, no
   warning. Explicit membership is unambiguous.
2. **Competing frame**: `frameParents` gives T a positional owner Q outside `base`, Q is
   not fully inside the open container that holds T, and Q does not enclose that
   container. Excluded, with a warning that names T and Q.
3. **Adopted**: T is fully inside an open container. Included. This holds regardless of
   nested positional frame edges and of z-order relative to positional frames.
4. **Closed**: T is fully inside a closed container that does not list it. Excluded, with
   a warning that names T and the container.
5. **Straddling**: T's box overlaps a container with positive area but is not fully
   inside it. Excluded, with a warning that names T and the frame.
6. Otherwise T is unrelated and silently out of scope.

Warnings are ordered by table name, then id, with one per table, and come before other DDL
warnings. Text form: `<tableName>: table excluded from frame <frame name>: <reason>.`
The existing `--strict` handling then exits 3.

`frameParents`, `expandContainers` and `frame-membership.ts` are not changed. The logic
goes in a new module, `packages/core/src/erd-frame-scope.ts`. `generateDatabaseDdl` uses
its included set wherever it uses `included` today, so relations follow automatically.

### Request scenarios

| Scenario | Result |
| --- | --- |
| `catalog` memberIds `[zone]`, gadgets straddles `zone`, inside `catalog`: `--frame catalog` | Included (adopted, `catalog` is open) |
| Same document: `--frame zone --strict` | gadgets excluded with a warning, exit 3 |
| Positional frame above a table that lies inside it | Included (adopted) |
| Existing test `db-a` `[nested]`, `db-b` `[users]` | Same SQL and no new warnings (claimed elsewhere) |
| `memberIds: []` over claimed tables | Same result as today |

### Lint

New warning rule `frame-straddle` on ERD pages only, in
`packages/core/src/diagram-lint/frame-straddle.ts`, sharing the box predicates from
`erd-frame-scope.ts`.

- One finding per table and frame pair where the boxes overlap with positive area and the
  table is not fully inside. The finding names both.
- Hidden tables and frames are skipped, as in `lintNodeOverlaps`.
- It reports explicit members too, since the rule is about the visible edge.
- Severity is warning, so lint exit codes do not change.
- `DiagramLintRow.ruleId` gains the value in `apps/cli/src/lint-diagram.ts`.

### Documentation

`help ddl`, `help lint`, `docs/cli.md` and `README.md` state the rule: `memberIds` lists
are authoritative and position applies only to open frames; a table straddling the
selected frame's edge is excluded with a warning; canvas ownership is unchanged and may
differ from DDL scope for these cases.

## Rollout and verification constraints

- Additive only. Documents and existing reports do not change unless they use the new ops,
  have an `actor` or `db` participant, or match an E3 case.
- Feature code stays in its own modules. Shared registration (`apps/cli/src/commands.ts`,
  `help.ts`, `docs/cli.md`, `README.md`, `packages/core/src/index.ts`) belongs to the
  final wiring plan. Anything that needs a new `@nodetto/core` export is planned around
  that ownership. The E1 order helper is an editor facade method, so E1 needs no index
  change.
- Shared core stays `noUncheckedIndexedAccess`-safe.
- No regex `split` on whole documents, and no per-point destructuring in hot loops. New
  code runs only for new ops, `--frame` and ERD pages that have frames. Lint is a box scan
  of tables times frames, and returns at once when a page has no frames.
- Native parity tests: `apps/cli/src/native-parity/` covers convert, reconnect, ddl scope,
  lint and participant SVG. `keyAfter` is random, so a parity test that compares files for
  conversion to a participant passes an explicit `semantic.order`.
- Raster tests must pass on Linux with only DejaVu fonts.
- Final checks: `mise run verify` and `mise run test-cli`, with a 3-attempt retry on native
  deadline timeouts and CPU time compared against the pre-change binary. Existing deadlines
  are not relaxed.

## Decisions

1. Unmappable fields are dropped and reported, not kept.
2. An invalid connector endpoint fails atomically. Connectors are never adapted.
3. Edges, frames and groups are not convertible.
4. DDL scope is a separate resolver. `frameParents` stays unchanged.
5. A `memberIds` list naming only frames does not restrict direct table content. Any other
   list does.
6. Participant geometry and bounds stay unchanged, so messages and lifelines need no change.
7. A successful conversion always keeps resolved bounds. A target that cannot keep them fails
   atomically, with no warning-only success.
8. A dirty desktop session asks through the existing banner when a conversion conflicts with
   a concurrent edit, the merge has validation errors, or a dependent no longer suits the new
   type. None of these merges reaches the store.

## Risks

- Decision 5 changes DDL for an existing document that has a frames-only `memberIds` list
  and an unlisted, unclaimed table fully inside. The request requires this, and it is the
  repro's own structure. Tests pin it.
- A table moved out of a frames-only frame on the canvas but left geometrically inside it
  is adopted in DDL. The docs state this, and lint or `inspect` shows where it sits.
- `--frame --strict` can newly exit 3 on existing documents with a straddling or closed
  case. The SQL is unchanged, and the request asks for this.
- Converting to a type that derives its size from content usually fails until the element is
  resized to match. This is the cost of the bounds contract, and the error tells the caller
  the size to use.
- A dirty desktop session that gets a concurrent conversion now raises the whole-file banner
  rather than merging. See "Desktop reconciliation".
