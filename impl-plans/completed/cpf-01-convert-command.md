# cpf-01-convert-command

- planId: cpf-01-convert-command
- planPath: impl-plans/active/cpf-01-convert-command.md
- progressPath: impl-plans/progress/cpf-01-convert-command.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-convert-participant-frame-scope.md`, "E1: convert", sections
  "What can be converted" and "Core command".
- Worker rules: `impl-plans/active/cpf-00-overview.md`.
- writePaths:
  - `packages/core/src/commands.ts`
  - `packages/core/src/editor/transaction.ts`
  - `packages/core/src/editor/dirty-pages.ts`
  - `packages/core/src/editor/bpmn.ts`
  - `packages/core/src/editor/facade/notation-editing.ts`
  - `packages/core/src/convert-element.test.ts`
  - `impl-plans/progress/cpf-01-convert-command.md`
  - `tmp/cpf-s748/cpf-01-convert-command`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

An element's type cannot change today, and delete plus create cascades its connectors
(`expandDeletes` in `packages/core/src/commands.ts`). The `convert` op (`cpf-04`) and the desktop
reconciliation tests (`cpf-05`) need one command that changes a type in place, plus two editor
methods `cpf-04` calls. This plan pins those contracts.

## Non-goals

- No edit op, CLI code or reporting.
- No change to `packages/core/src/index.ts`. `Command` is already exported, and `cpf-04` reaches
  the new methods through its `Editor` instance.
- No field mapping or bounds checks. Those are in `cpf-04`.
- `planBpmnReconnect` behavior stays the same.

## File-level changes

`packages/core/src/commands.ts`:

- Add to the `Command` union:
  `{ readonly type: "convertElement"; readonly id: ElementId; readonly elementType: string; readonly semantic: unknown; readonly visual: Visual }`
- Add a `case "convertElement"` next to `updateSemantic`, following its shape:
  - `mustGet` the element.
  - Validate with `validateSemanticPayload(command.elementType, command.semantic, "semantic")` and
    `validateVisualFields(command.visual)`. Fail with `CommandError` as the neighbouring cases do.
  - Reject an unknown `elementType` with an error issue, because `validateSemanticPayload` skips
    unknown definitions. Use `getElementTypeDefinition`.
  - `working.set` a copy with the new `type`, `semantic` and `visual`. `id`, `page`, `index` and
    `accessibility` stay as they are.
  - `markUpdate`, and `undo.unshift` a `convertElement` holding the previous type, semantic and
    visual.
- Extend the post-apply endpoint check (`semanticChanges`, the `connectorEndpointIssues` loop) so
  that, for each converted id, every edge in `working` that references it is checked too. Build
  the referrer list only when the batch holds a `convertElement`, so other commands pay nothing.
  Report through the same `fail` call and `connector.*` issue mapping.

`packages/core/src/editor/transaction.ts`: add `convertElement` to the `permitted.some` list that
triggers derived planning. The lock filter already covers it through `"id" in command`. Do not
change that filter.

`packages/core/src/editor/dirty-pages.ts`: in the final `else` branch, add
`{ ...element, type: command.elementType, semantic: command.semantic, visual: command.visual }` to
`changed` for `convertElement`, as the neighbouring branches do. Read the code around it for
narrowing: `command.type` comparisons are chained `if`s.

`packages/core/src/editor/bpmn.ts`: add
`bpmnFlowEndpointIssue(document, flowType, from, to): string | null`. Call `resolveBpmnConnection`
with `flowType` as `requested`. Return the rejection message when `ok` is false, a message naming
both types when the resolved `type` differs from `flowType`, and otherwise `null`.

`packages/core/src/editor/facade/notation-editing.ts`, near `reconnectBpmnFlow`, add two methods:

- `nextParticipantOrderOn(page: PageId): FractionalIndex` wraps `nextParticipantOrder(this.store, this.rng, page)`.
- `bpmnFlowIssue(flowType: string, from: ElementId, to: ElementId, overlay?: { readonly id: ElementId; readonly type: string }): string | null`.
  It takes `this.store.getSnapshot()`, replaces the overlay element's `type` when given, and calls
  `bpmnFlowEndpointIssue`.

## What a careless implementation gets wrong

- The existing endpoint check covers only `updateSemantic` and `createElement`. Without the new
  referrer pass, a converted endpoint with an incompatible typed connector applies silently.
- `connectorEndpointIssues` reads from `working`, so the check must run after the case applies.
- Do not delete and re-create inside the case: that changes the store diff and can cascade.
- `resolveBpmnConnection` returns `ok: true` with `corrected: true` for a flow on a
  `bpmn.textAnnotation`. That must count as an issue. Compare `type`, not only `ok`.
- `getSnapshot()` is O(n). The caller invokes `bpmnFlowIssue` only for BPMN flows on the element.
- `Visual` validation must use the whole replacement, not a merge.

## Tests (`packages/core/src/convert-element.test.ts`, new)

Use `makeEditor` from `packages/core/src/test-helpers.ts`.

- Node with an `edge.generic` to another node -> convert to `shape.geo`: type, semantic and visual
  change; `id`, `page`, `index` stay; the edge is untouched and still resolves.
- Undo after that convert -> the original element is deep-equal, and redo restores the conversion.
- `sequence.participant` with a `sequence.message` -> convert to `node.generic` throws `CommandError`
  with `connector.endpointType`, and the store is unchanged.
- Semantic invalid for the target -> `CommandError`, store unchanged.
- Unknown `elementType` -> `CommandError`, store unchanged.
- Locked element -> the command is filtered and the element stays unchanged.
- `bpmnFlowIssue("bpmn.sequenceFlow", a, b, { id: a, type: "bpmn.textAnnotation" })` on two
  `bpmn.task` elements -> a non-null message; without the overlay -> `null`.
- `nextParticipantOrderOn` -> sorts after every participant on that page.

## Verification

1. `bun test packages/core/src/convert-element.test.ts` exits 0 with the new tests passing.
2. `bun test packages/core/src/bpmn/connection.test.ts packages/core/src/connector-policy.test.ts`
   exits 0, showing connector rules are unchanged.
3. `bun run typecheck` exits 0 (overview rule 11).
4. `bunx biome check` on the files you edited exits 0.

## Done criteria

- `grep -n '"convertElement"' packages/core/src/commands.ts` shows the union member and the case.
- `git diff --quiet 1e8f43d -- packages/core/src/frame-tree.ts` exits 0.
- The progress log lists evidence for each verification command.
