# cpf-04-edit-convert-op

- planId: cpf-04-edit-convert-op
- planPath: impl-plans/active/cpf-04-edit-convert-op.md
- progressPath: impl-plans/progress/cpf-04-edit-convert-op.md
- wave: 2
- dependsOn: cpf-01-convert-command
- Design: `design-docs/specs/design-convert-participant-frame-scope.md`, "E1: convert" (all sections
  except "Desktop reconciliation") and "E1: delete with reconnectTo".
- Worker rules: `impl-plans/active/cpf-00-overview.md`.
- writePaths:
  - `apps/cli/src/edit/operations/convert.ts`
  - `apps/cli/src/edit/operations/convert.test.ts`
  - `apps/cli/src/edit/operations/elements.ts`
  - `apps/cli/src/edit/batch.ts`
  - `apps/cli/src/edit/apply-batch.ts`
  - `apps/cli/src/edit/operation-fields.ts`
  - `apps/cli/src/edit/operation-fields.test.ts`
  - `apps/cli/src/edit/types.ts`
  - `apps/cli/src/edit/report.ts`
  - `apps/cli/src/edit/report.test.ts`
  - `impl-plans/progress/cpf-04-edit-convert-op.md`
  - `tmp/cpf-s748/cpf-04-edit-convert-op`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Changing an element's shape today means delete plus add, which changes the id and drops connected
edges. `convert` changes the type in place and keeps every reference. `delete` with `reconnectTo`
moves an element's connectors to another element before deleting it. The batch is all-or-nothing,
so any thrown `OperationError` writes nothing (`apps/cli/src/edit-command.ts`).

## Non-goals

- Do not edit `help.ts`, `docs/cli.md` or `README.md` (`cpf-06`), native parity tests (`cpf-08`), or
  `packages/core`.
- No `visual` field on `convert`. No connector retyping. No app UI.
- `delete` without `reconnectTo` keeps today's behavior and output exactly.

## File-level changes

`apps/cli/src/edit/operation-fields.ts`: add
`convert: ["op", "id", "where", "expect", "type", "shape", "semantic", "label"]`, and `reconnectTo`
to `delete`.

`apps/cli/src/edit/batch.ts`: dispatch `case "convert"` to `convertElements`, and add `convert` to
the `Unknown op` message list. Add `readonly converted: ConvertReport[] = []`,
`readonly reconnected: ReconnectReport[] = []` and `readonly convertWarnings: EditWarning[] = []`,
next to `replaced`.

`apps/cli/src/edit/types.ts`:

```ts
export interface ConvertReport {
  readonly operation: number; readonly id: string; readonly fromType: string; readonly toType: string;
  readonly shape?: string;
  readonly mapped: readonly { readonly from: string; readonly to: string }[];
  readonly dropped: readonly string[];
  readonly connectors: readonly { readonly id: string; readonly type: string; readonly keptPorts?: readonly string[] }[];
}
export interface ReconnectReport {
  readonly operation: number; readonly deleted: string; readonly to: string; readonly connectors: readonly string[];
}
```

Add optional `converted?` and `reconnected?` to `BatchResult`.

`apps/cli/src/edit/apply-batch.ts`: return `converted` and `reconnected` only when non-empty, and
append `batch.convertWarnings` to `warnings` before the existing sort.

`apps/cli/src/edit/report.ts`: JSON gets `converted` and `reconnected` only when non-empty, placed
after `replaced`. Text lines, after the replaced lines:

```text
  converted <id> <fromType> -> <toType>
    mapped <from> -> <to>
    cannot carry <path>
    connector <id> (<type>)
  reconnected <deleted> -> <to>: <n> connector(s)
```

`apps/cli/src/edit/operations/convert.ts` (new) exports
`convertElements(batch, operation, index): void` and
`reconnectConnectors(batch, operation, index, deleted: readonly Element[]): void`.

`convertElements`, per target from `selectedWhere(batch, operation, index, "convert")`:

1. Resolve the target type:
   - `shape` through `findShape`: unknown, as in `Batch.shape`; `shape.connector` -> error;
     `shapeCreation` null -> error.
   - Both given and `creation.type !== type` -> error. Do not call `Batch.shape`, which rejects
     the pair. Neither given -> error.
   - An unknown `type` uses the same message as `addElement`.
2. Reject, in this order, with the design's messages: source or target edge category, `frame` or
   `group`; a locked element (`batch.editor.createShapeContext(1).isLocked?.(id)`), because the
   transaction filter would otherwise drop the command silently.
3. Collect referrers once per operation (`referencesOf` over the page's elements, indexed by id).
   If the type changes:
   - A referrer that is not an edge, frame or group -> error naming it.
   - An edge: `connectorEndpointIssues` with a resolver that overlays the new type -> error naming
     the connector, its type and the message.
   - A `bpmn.` edge: `batch.editor.bpmnFlowIssue(flow.type, from, to, { id, type })` non-null -> error.
4. Capture `box = batch.boundsOf(id)`. Null -> the bounds error. Capture the source text through
   `labelField`.
5. Build the semantic in the design's order: `registry.getOrFallback(type).defaultSemantic()`;
   same-name carried fields; `creation.semantic`; `operation.semantic` deep-merged and resolved with
   `batch.resolveReferences`; `fillIds` as `updateOne` does.
   - Carried field: for a same-type conversion, every source field. Otherwise the key is in
     `definition.keyOrder.keys` and `definition.validateSemantic` reports no error at that path.
   - Every other source field, apart from the mapped text field, goes in `dropped` as
     `semantic.<key>`.
   - `sequence.participant` from another type: `order` comes from
     `batch.editor.nextParticipantOrderOn(page)`, unless `operation.semantic.order` is given.
6. Visual: same type -> unchanged. Type changes -> the source `visual` with missing `x`, `y`,
   `width` and `height` filled from `box`.
7. `batch.editor.apply([{ type: "convertElement", id, elementType, semantic, visual }])`.
8. Text: `operation.label` through `applyLabel`. Otherwise, when the source text is a non-empty
   string and `operation.semantic` did not set the target's field, map it. `labelField` on the
   converted store element gives the target field. If that returns `{ error }`, drop the source field.
9. Bounds contract: compare `batch.boundsOf(id)` to `box` on all four numbers exactly. A difference
   or null -> error: `Cannot convert <id> to <type>: it would resize from <w>x<h> to <w>x<h>; resize
   it first with update.`
10. Record: `ConvertReport`, one `EditWarning` per dropped field with code `convert.fieldDropped`,
    `batch.touchedPages.add(page)`.
    Connector list: every edge referencing the id, sorted by id. `keptPorts` lists its
    `fromPort` or `toPort` on this end when the target is `sequence.participant`.

`reconnectConnectors`:

- Resolve the target with `batch.element(operation["reconnectTo"], index, page)`. Error when it is on
  another page, an edge, or one of the deleted elements.
- For each edge with `from`/`to`, or `from.table`/`to.table` for `erd.relation`, on a deleted element:
  compute the new semantic with only that endpoint changed.
  - `erd.relation`: remap each column id on that end by same-name column on the target table, using
    `erdEndpointColumnIds`. A missing column -> error naming it.
  - Self-loop on a type other than `state.node` and `erd.table` -> error naming the connector.
  - `connectorEndpointIssues` with the new semantic -> error. A `bpmn.` edge:
    `batch.editor.bpmnFlowIssue(edge.type, from, to)` non-null -> error.
- Apply one `updateSemantic` per edge, then record `ReconnectReport`. Sort by edge id.

`apps/cli/src/edit/operations/elements.ts`, `deleteElement`: when `reconnectTo` is present, call
`reconnectConnectors` before `deleteElements`. Keep the rest unchanged.

## What a careless implementation gets wrong

- Ports must stay: `planBpmnReconnect` deletes them and may retype, so do not use
  `reconnectBpmnFlow`. Only `from` and `to` change.
- `labelField` on a `state.node` whose kind is not `state` returns the semantic field route, not
  the editable field. Read it for the source before conversion and for the target after it.
- A bounds comparison must happen after `applyLabel`, which can resize auto-sized text.
- `where` with several matches: `reconnectTo` matching one of them is an error, not a self-loop.
- `--dry-run` runs the same code, so errors and report lines match a real run.
- The contention retry in `runOperations` re-runs `applyBatch`, so report state lives on `Batch`.
- `resolveReferences` mutates its nested input through `target[last] = id`; pass it a fresh object.
- `keyAfter` is random, so tests that compare a participant's bytes pass `semantic.order`.

## Tests (`apps/cli/src/edit/operations/convert.test.ts`, new, using `applyBatch`)

- Node `label: "Widget"` with edges -> `flowchart:database`: same id, bounds and `index`; edges deep-equal; report lists connectors.
- `node.generic` -> `state.node`, label maps to `name`; `mapped` has the pair.
- Node with an extra known field -> target lacking it: `dropped` lists it and a `convert.fieldDropped` warning appears.
- Target has no text field -> the text is reported as dropped.
- `shape` and `type` agree -> ok; disagree -> error. Neither -> error. Connector shape -> error.
- `where` matching two with `expect: 2` -> both convert; `expect: 1` -> error, no write.
- 180x120 node -> one-column `erd.table`: error names both sizes; the batch text is not produced.
- A batch with a valid earlier `update`, then that convert -> throws, nothing returned.
- A prior `update` to the table's derived size with matching width -> succeeds.
- `bpmn.task` with `bpmn.sequenceFlow` -> `bpmn.textAnnotation`: error names the flow, no retype.
- `sequence.participant` with a message -> `node.generic`: error names the message.
- Participant with an activation -> other type: error names the activation.
- Explicit frame member and positional members (below and above the frame in z-order) ->
  `frameParents` output equal before and after.
- Frame or group as source or target -> error. Locked element -> error.
- Same-type shape conversion on a semantic-only participant -> `visual` deep-equal.
- `delete` with `reconnectTo`: edge moved; label, ports, `route` and `labelPosition` deep-equal; element gone.
- `reconnectTo` onto a `bpmn.textAnnotation` -> error, no retype. Another page, itself -> error.
- Self-loop on `node.generic` -> error; on `state.node` -> allowed.
- `erd.relation` column remapped by name; missing column -> error.
- `delete` without `reconnectTo`: report JSON has no `reconnected` key.
- Node -> `sequence.participant` with a port on its edge: `order` sorts after existing participants, and `keptPorts` lists the port.
- Node -> `shape.geo` with `semantic.geo` -> the geometry is set, bounds equal.
- `runOperations` with `dryRun: true` on an incompatible convert, through a temp file -> fails, and the file bytes are unchanged.

`apps/cli/src/edit/operation-fields.test.ts`: `convert` unknown field rejected, `visual` rejected,
`delete` accepts `reconnectTo`. If that file has a table of op handlers, add a `convert` row.

`apps/cli/src/edit/report.test.ts`: text and JSON lines for `converted` and `reconnected`; absent
when empty; `--dry-run` wording unchanged.

## Verification

1. `bun test apps/cli/src/edit` exits 0.
2. `bun test apps/cli/src/edit-order.test.ts apps/cli/src/edit-scale-text-group.test.ts apps/cli/src/edit-frame-carry.test.ts apps/cli/src/edit-performance.test.ts` exits 0.
3. `bun run typecheck` exits 0 (overview rule 11).
4. `bunx biome check` on the files you edited exits 0.

## Done criteria

- `grep -n '"convert"' apps/cli/src/edit/batch.ts` shows the dispatch.
- The progress log lists evidence for each verification command.
