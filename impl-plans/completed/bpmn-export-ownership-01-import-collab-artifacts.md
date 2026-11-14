# bpmn-export-ownership-01-import-collab-artifacts

- planId: bpmn-export-ownership-01-import-collab-artifacts
- planPath: impl-plans/active/bpmn-export-ownership-01-import-collab-artifacts.md
- wave: 1; dependsOn: none
- design: `design-docs/specs/design-bpmn.md` section 5.2, "Collaboration
  and processes", the bullet on `textAnnotation`, `group` and
  `association` children of the `collaboration`
- progress log: impl-plans/progress/bpmn-export-ownership-01-import-collab-artifacts.md
- scratch and logs: tmp/bpmn-export-ownership-s550/bpmn-export-ownership-01-import-collab-artifacts/
- Read `impl-plans/active/bpmn-export-ownership-00-overview.md` "Rules for
  every worker" first.

## writePaths

- packages/io/src/bpmn/import.ts
- packages/io/src/bpmn/import.test.ts
- impl-plans/progress/bpmn-export-ownership-01-import-collab-artifacts.md

sharedPaths: none.

## Intent

After plan 03, the exporter writes unowned text annotations, groups and
associations as children of `bpmn:collaboration`. Today the importer reads
only `participant` and `messageFlow` from the collaboration, so these
children are silently dropped. That breaks the round trip of the
boundary-event-plus-group page. This plan makes the importer read them.

## Repository context

- `packages/io/src/bpmn/import.ts`:
  - `add(xml, type, semantic, parent?, xmlOnly?)` (~338). It assigns the id,
    rejects duplicate ids (`duplicate BPMN id`), applies DI and records
    missing DI. Call it for every new record; never bypass it.
  - The process walk maps `textAnnotation` (~692-696) to
    `{text: textContent(firstChild(child, "text") ?? child)}`. It maps
    `group` (~697-706) to `{name}` from the `categoryValue` child, using
    `nameValue(categoryValue) ?? attr(categoryValue, "value")`.
  - `addFlows` maps `association` (~786-795) to
    `{from, to, direction: "one"|"both"|"none"}` from `sourceRef`/`targetRef`
    and `associationDirection` (`One`/`Both`).
  - The collaboration block (~804-814) currently loops
    `childElements(collaboration, "messageFlow")` only.

## Changes

1. In the `if (collaboration)` block, before the message-flow loop, add
   collaboration-level records in this order:
   - each `textAnnotation` and each `group` child of `collaboration`, in
     document order, as `bpmn.textAnnotation`/`bpmn.group`, with the same
     semantic keys as the process walk and no `parent` key
   - then each `association` child of `collaboration`, in document order,
     as `bpmn.association` with `{from, to, direction}` exactly as in
     `addFlows` (attribute `sourceRef`/`targetRef`, missing ref is `""`)
   The message-flow loop stays unchanged and comes after them.
2. To keep the mapping identical, extract the annotation and group semantic
   construction into one small module-level helper in `import.ts`. Use it
   from both the process walk and the collaboration block. Example name:
   `artifactSemantic(child: XmlElement): Record<string, unknown>`. Do the
   same for the association direction mapping only if needed to avoid
   copying the ternary; otherwise mirror it exactly. The process-walk
   output must stay byte-identical: the existing tests and
   `purchase-request.jsonl` pin it.

## Pitfalls

- Do not set `parent` on collaboration artifacts. The key must be absent,
  not `undefined`.
- Do not add a warning for collaboration artifacts. They are supported.
- Order matters for element `index`: artifacts, then associations, then
  message flows, all after process contents and process flows.
- Do not touch the unreferenced-process handling, lane mapping, the
  `boundaryEvent` branch or `laneMembership`. Boundary events keep the
  `parent` they get from `flowNodeRef` (design section 14 decision).
- Do not edit any export file. Plan 03 owns them.

## Tests (add to packages/io/src/bpmn/import.test.ts)

Use one new test with an inline XML document. The collaboration `C` has
participant `Pa` (`processRef="P"`), a `textAnnotation` `Note_A` with text
"Note", a `group` `Group_A`, and an `association` `Assoc_A` from `Note_A`
to `Task_Review` with `associationDirection="One"`. Process `P` has a task
`Task_Review` named "Review order". Give DI shapes for `Pa`,
`Task_Review`, `Note_A` and `Group_A` and an edge for `Assoc_A`. Expected:
- import does not throw, and `warnings` has length 0
- `Note_A` is `bpmn.textAnnotation` with `text: "Note"` and no `parent`
  key (`"parent" in semantic` is false)
- `Group_A` is `bpmn.group` with no `parent` key
- `Assoc_A` is `bpmn.association` with `from: "Note_A"`,
  `to: "Task_Review"`, `direction: "one"`
- element order in `document.elements`: `Task_Review` before `Note_A`,
  `Group_A` before `Assoc_A`, and `Note_A` before `Assoc_A`
- `assertValidDocument` passes (the importer already runs it, so no throw)

Existing tests must pass unchanged.

## Verification (run from nodetto-app/)

- `bun test packages/io/src/bpmn/import.test.ts > <log>/import-test.log 2>&1`:
  exit 0, 0 fail, and the pass count is the previous count + 1.
- `bun test packages/io/src/bpmn > <log>/bpmn-tests.log 2>&1`: 0 fail.
  Failures only in files owned by plans 02 and 03 are non-blocking; list
  them.
- `bunx biome format --write packages/io/src/bpmn/import.ts packages/io/src/bpmn/import.test.ts`
  then `bunx biome check packages/io/src/bpmn/import.ts packages/io/src/bpmn/import.test.ts > <log>/biome.log 2>&1`:
  exit 0.
- `bun run typecheck > <log>/typecheck.log 2>&1`: no diagnostics in owned
  files (overview rule 11).

## Done criteria

- `grep -n 'childElements(collaboration, "textAnnotation")\|"group")\|"association")' packages/io/src/bpmn/import.ts`
  or an equivalent loop is present inside the collaboration block, before
  the `messageFlow` loop.
- The new test exists and passes. All commands above are recorded in the
  progress log with exit codes and log paths.
