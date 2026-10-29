# bpmn-export-ownership-03-export-placement

- planId: bpmn-export-ownership-03-export-placement
- planPath: impl-plans/active/bpmn-export-ownership-03-export-placement.md
- wave: 1; dependsOn: none
- design: `design-docs/specs/design-bpmn.md` section 5.3 Order item 1 and
  section 5.3.1 (all subsections except "Duplicate-id safeguard") and
  section 14 "Export placement changes"
- progress log: impl-plans/progress/bpmn-export-ownership-03-export-placement.md
- scratch and logs: tmp/bpmn-export-ownership-s550/bpmn-export-ownership-03-export-placement/
- Read `impl-plans/active/bpmn-export-ownership-00-overview.md` "Rules for
  every worker" first.

## writePaths

- packages/io/src/bpmn/export-scope.ts
- packages/io/src/bpmn/export-process.ts
- packages/io/src/bpmn/export.ts
- packages/io/src/bpmn/export.test.ts
- impl-plans/progress/bpmn-export-ownership-03-export-placement.md

sharedPaths: none. Plan 04 edits `export.ts` in wave 2 to wire the
duplicate-id guard. Do not add that call here.

## Intent

This plan fixes N1 and N2 in the exporter:
- A boundary event with no `parent` inherits its host's process, lane and
  sub-process.
- Parentless groups and text annotations on a participant page go into
  `bpmn:collaboration` and never create the orphan process.
- Every sequence flow is emitted exactly once.
- Genuinely pool-less flow nodes still produce `Process_orphan_<pageId>`
  and the warning.

## Repository context (current code)

- `export-scope.ts`:
  - `parentOf` (~102) reads raw `semantic.parent`
  - `ancestor` (~106-115) walks `parentOf` with no cycle guard
  - `ownerParticipant`/`subprocessScope` (~116-119) use it
  - `belongsToProcess` (~120)
  - `processNodes` for a page without participants (~126-137) filters on
    raw `parentOf`
  - orphan detection (~150-164): `orphanContent` includes `artifacts`
- `export-process.ts`:
  - `artifactXmlElement` (~212)
  - sub-process children by raw parent (~350)
  - nested sequence flows require both endpoints in the same sub-process
    (~352-363)
  - `laneXml` members by raw `parent` (~418-431)
  - the top-level `flowXml` (~474-509) is emitted in every process holding
    either endpoint. This is the N2 duplicate.
  - artifacts (~532-535) and associations (~536-559) are placed per process
- `export.ts`: the collaboration (~78-103) holds only participants and
  message flows.
- Core reference to imitate: `packages/core/src/bpmn/model.ts` `parentOf`
  (~69-77) and `chain` (~78-91, visited-set cycle guard).

## Changes

### export-scope.ts

1. Add `effectiveParent(item: Element): string | undefined` and expose it
   on `BpmnExportScope` as `readonly effectiveParent`. It returns:
   - for `bpmn.boundaryEvent` whose `semantic.attachedTo` is a string
     naming a record in `byId` whose type is not `bpmn.boundaryEvent`: the
     host's `parentOf(host)`
   - otherwise `parentOf(item)`
   Keep `parentOf` as is. It is still used for data, artifacts and IO
   ownership.
2. `ancestor` walks `effectiveParent` and keeps a visited `Set<string>`
   seeded with the item's id. Reaching an already visited id returns
   `undefined`.
3. Pages without participants: the `processNodes.set("", ...)` filter uses
   `effectiveParent(item)` in place of `parentOf(item)`.
4. Orphan detection: drop `artifacts` from `orphanContent`. Only `data`
   keeps the existing predicate
   `ownerParticipant(item) === undefined && !parentOf(item)`. The orphan
   flow-node predicate stays textually the same; it is now attachedTo-aware
   through `ancestor`. Warning text unchanged.
5. Add `readonly collaborationArtifacts: readonly Element[]`. On a page
   with participants it holds the `artifacts` with
   `ownerParticipant(item) === undefined && subprocessScope(item) === undefined`,
   in index order. Otherwise it is `[]`.
6. Add `readonly associationOwner: (item: Element) => string | undefined`.
   It returns the owning participant of the source record, else of the
   target record, else `undefined`. This is the same expression as today's
   `owner` in export-process.ts (~541-542), moved here.

### export-process.ts

1. `laneXml` members: flow-node types whose `effectiveParent(item) === lane.id`.
   Nested lanes keep the raw parent.
2. Sub-process children (~350): `effectiveParent(child) === item.id`.
3. Nested sequence flows inside a sub-process: emit a flow when both
   endpoints exist and `subprocessScope(source) === item.id`. The target's
   scope no longer matters.
4. Top-level `flowXml` in each process: emit a flow when all of these hold:
   - both endpoints exist
   - `subprocessScope(source) === undefined`
   - `belongsToProcess(source, participantId)`
   Remove the "members has from or to" condition. Each flow then lands
   only in its source's process (orphan when the source is pool-less, the
   single process when there are no participants). Keep the element shape
   and the `default` attribute logic unchanged.
5. Artifacts in the process loop: skip them when `participantId === "orphan"`.
   Otherwise keep `belongsToProcess` and the `subprocessScope === undefined`
   filter.
6. Associations in the process loop: emit when
   `associationOwner(item) === participantId` on a page with participants
   (never into `"orphan"`). On a page without participants, emit all of
   them in the single process, as today.
7. Add and export
   `collaborationArtifactElements(scope: BpmnExportScope): XmlElement[]`.
   It returns, in this order:
   - the collaboration associations: on a page with participants, every
     `bpmn.association` in `flows` with
     `associationOwner(item) === undefined`, in index order, built exactly
     like the process association element
   - then `scope.collaborationArtifacts.map(artifactXmlElement)`
   Hoist `artifactXmlElement` and the association element builder out of
   `processElements` to module level so both functions share them. Do not
   change their output.

### export.ts

1. Append `collaborationArtifactElements(scope)` to the collaboration
   children after the message flows. This gives participants, message
   flows, associations, then text annotations and groups.
2. Nothing else. Do not add the duplicate-id guard (plan 04).

## Invariants and pitfalls

- When the host exists, a boundary event's own `parent` is ignored. When
  the host is missing or is a boundary event, its own `parent` is used.
  Never recurse through boundary events.
- `attachedToRef` output and BPMNDI (`export-diagram.ts`) do not change. Do
  not edit `export-diagram.ts`.
- A boundary event whose host is pool-less stays pool-less and goes with
  its host into the orphan process.
- Content of a collapsed participant stays unexported, with its existing
  warning. A flow whose source is in a collapsed participant is not
  emitted.
- Do not touch `incoming`/`outgoing` children, `default` handling, data or
  IO export, or `processId`.
- Output for every existing test and fixture must stay byte-identical.
  `roundtrip.test.ts` and `export.test.ts` already pin the purchase-request
  fixtures and the inline cases. Do not edit `roundtrip.test.ts` (plan 04
  owns it).
- Do not remove the unused `processFor` map, and do not do other cleanup.

## Tests (add to packages/io/src/bpmn/export.test.ts)

Build each page by importing an inline XML document with `importBpmnXml`.
Then delete `semantic.parent` on the records under test, the way an editor
creates them:
`delete (record.semantic as Record<string, unknown>)["parent"]`.
Give every shape a DI. Parse output with `parseXml` and navigate children
rather than relying only on substring checks.

1. "exports a parentless boundary event with its host's process and lane".
   - Setup: collaboration `C`, participant `Pool_Orders` (`processRef="P"`)
     and lane `Lane_Review` listing `Task_Review` ("Review order") and
     `Task_Escalate` ("Escalate order"). Boundary event `Event_Timeout`
     ("Timeout", timer) is attached to `Task_Review`. Sequence flow
     `Flow_Timeout` runs from `Event_Timeout` to `Task_Escalate`. Group
     `Group_Notes` is also present. Strip `parent` from `Event_Timeout` and
     `Group_Notes`.
   - Expected:
     - `warnings` is `[]`
     - exactly one `bpmn:process`, and no `Process_orphan_`
     - `Event_Timeout` is a child of that process, with
       `attachedToRef="Task_Review"`
     - `Lane_Review` has a `flowNodeRef` with text `Event_Timeout`
     - `id="Flow_Timeout"` occurs once in the XML
     - `Group_Notes` is a child of `bpmn:collaboration`, and
       `bpmnElement="Group_Notes"` has a `BPMNShape`
     - every `id="..."` value in the XML is unique (collect with a regex)
2. "emits a parentless boundary event inside its host's sub-process".
   - Setup: an expanded sub-process `Sub_Check` in the pool contains
     `Task_Inner` and `Task_After`. `Event_Inner_Timeout` is attached to
     `Task_Inner`, with its parent stripped. Flow `Flow_Inner` runs from
     `Event_Inner_Timeout` to `Task_After`.
   - Expected: the boundary event and `Flow_Inner` are children of the
     `subProcess` element; `id="Flow_Inner"` occurs once; no
     `Process_orphan_`.
3. "keeps the orphan process for pool-less flow nodes but not for artifacts".
   - Setup: the pool with `Task_Review`, plus `Task_Loose` and a text
     annotation `Note_Loose` ("Note"), both with their parent stripped.
   - Expected:
     - `Process_orphan_<pageId>` exists and contains `Task_Loose`
     - the warnings include "Pool-less elements were exported in an extra
       unreferenced process."
     - `Note_Loose` is a child of `bpmn:collaboration`, not of the orphan
       process
4. "places associations with their owning process or the collaboration".
   - Setup: a parentless annotation `Note_A`, an association `Assoc_Task`
     from `Note_A` to `Task_Review` (pooled), and an association
     `Assoc_Pool` from `Note_A` to `Pool_Orders`.
   - Expected: `Assoc_Task` is a child of the pool's process; `Assoc_Pool`
     is a child of `bpmn:collaboration`; each id occurs once.
5. "terminates on a parent cycle".
   - Setup: on a pool-less page (no collaboration), lane `L1` has parent
     `L2`, lane `L2` has parent `L1`, and task `T` has parent `L1` (set the
     parents after import).
   - Expected: `exportBpmnXml` returns. The test must not hang; bun's
     default timeout guards it.

## Verification (run from nodetto-app/)

- `bun test packages/io/src/bpmn/export.test.ts > <log>/export-test.log 2>&1`:
  exit 0, 0 fail, at least 8 pass (3 existing + 5 new).
- `bun test packages/io/src/bpmn/roundtrip.test.ts packages/io/src/bpmn/reference.test.ts packages/io/src/bpmn/xml.test.ts > <log>/existing-bpmn.log 2>&1`:
  exit 0, 0 fail. This proves byte-identical output for the existing cases.
- `bun test apps/cli/src/bpmn-commands.test.ts > <log>/cli-bpmn.log 2>&1`:
  exit 0, 0 fail.
- `bunx biome format --write` then `bunx biome check` on the four owned
  source and test files, logged to `<log>/biome.log`: exit 0.
- `bun run typecheck > <log>/typecheck.log 2>&1`: no diagnostics in owned
  files.

## Done criteria

- `effectiveParent`, `collaborationArtifacts` and `associationOwner` are on
  `BpmnExportScope`, and `collaborationArtifactElements` is exported from
  `export-process.ts`.
- `grep -n "members.some" packages/io/src/bpmn/export-process.ts` no longer
  matches the top-level sequence-flow filter.
- All five new tests and all existing BPMN tests pass. The progress log
  has the hashes, commands, exit codes and log paths.
