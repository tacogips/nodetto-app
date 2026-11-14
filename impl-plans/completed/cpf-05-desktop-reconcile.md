# cpf-05-desktop-reconcile

- planId: cpf-05-desktop-reconcile
- planPath: impl-plans/active/cpf-05-desktop-reconcile.md
- progressPath: impl-plans/progress/cpf-05-desktop-reconcile.md
- wave: 2
- dependsOn: cpf-01-convert-command
- Design: `design-docs/specs/design-convert-participant-frame-scope.md`, "Desktop reconciliation"
  and its regression list.
- Worker rules: `impl-plans/active/cpf-00-overview.md`.
- writePaths:
  - `apps/desktop/src/file/session-reconcile.ts`
  - `apps/desktop/src/file/session-external.test.ts`
  - `apps/desktop/src/file/session.ts`
  - `impl-plans/progress/cpf-05-desktop-reconcile.md`
  - `tmp/cpf-s748/cpf-05-desktop-reconcile`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

A CLI conversion can reach a desktop session holding unsaved edits. `mergeDocuments` merges `type`
and `semantic` independently, and `session.ts` commits the merged document to the store before it
raises any conflict. So a merged element can be invalid, or a new connector can end on a type it
cannot use. `planOutsideChange` must return `null` for those merges. `null` is the existing path:
`handleFileChanged` cancels autosave and raises the banner with `diskText`, without touching the store.

## Non-goals

- Do not change `mergeDocuments`, `validateDocument`, `document-merge.ts`, CLI `merge`, or
  `packages/core/src/index.ts`.
- `session.ts` is authorized only if a test proves it needs a change. The expected diff is empty.
- No clean-session change: the disk version is taken as it is.
- Never promote warnings to errors in general, and never correct a connector's type.

## File-level changes

`apps/desktop/src/file/session-reconcile.ts`:

- In the `dirty` branch, after `mergeDocuments` and before `diffDocuments`, call a new private
  `conversionMergeBlocked(base, local, remote, merged): boolean`, and return `null` when it is true.
- `conversionMergeBlocked`:
  - Index the elements of `base`, `local`, `remote` and `merged` by id.
  - Early return false when no id has a different `type` across `base`, `local` and `remote`. This
    is what keeps documents with no type change at today's cost and behavior.
  - Check 1: for an id in all three whose type differs, true when local and remote differ in
    `type` or `semantic`, and each differs from base in `type` or `semantic`. Compare with
    `JSON.stringify`, as `document-merge.ts` `same` does.
  - Check 2: `validateDocument(merged)` has an issue with severity `error`.
  - Check 3: `converted` = ids in `merged` whose type differs from their base type. For each element
    in `merged`, skipping `frame` and `group`:
    - Edge category with `connectorEndpointIssues(type, semantic, page, resolve)` where `resolve`
      returns `{ type, page }` for converted ids and `undefined` for others: true on any issue
      with code `connector.endpointType`.
    - `bpmn.` edge (type starts with `bpmn.`, category edge) with `from` or `to` in `converted`:
      true when it is absent from base or differs from base.
    - Not an edge: true when `referencesOf(element)` includes a converted id.

Imports: `connectorEndpointIssues`, `getElementTypeDefinition` and `validateDocument` from
`@nodetto/ir`, `referencesOf` from `@nodetto/core`.

## What a careless implementation gets wrong

- `validateDocument` reports `connector.endpointType` as a **warning**, so check 2 cannot catch a
  connector. Check 3 exists for that.
- The `resolve` must return `undefined` for unconverted ids. `connector-policy.ts` skips those, so
  an existing warning on an unconverted element never blocks a merge.
- A BPMN flow unchanged from base must not match: `convert` validated it on the converting side.
- `connector.endpointPage` is not a match. Filter by code.
- A local move of a converted element must merge: `visual` is not part of check 1.
- Do not raise the banner for elements deleted on one side. Check 1 needs all three.
- The new check runs before the commit. Do not add it after `this.editor.store.commit`.

## Tests (`apps/desktop/src/file/session-external.test.ts`, add to "live outside changes")

Use the existing `opened` and `writeElsewhere` helpers. Conversions use the `convertElement`
command from `cpf-01`. Every banner case asserts: `session.state().conflict` is set with `diskText`,
`mergedConflicts` is undefined, the store deep-equals the pre-event snapshot, and no autosave is pending.

- Base participant Widget kind `service`; local sets kind `actor`; file converts it to `state.node`
  with kind `state` -> banner.
- Reverse: file sets kind `actor`; local converts -> banner, local conversion stays.
- Clean session, file converts -> applied in place, no banner.
- Local move of the element; file converts -> merged, no banner, new type at the moved position.
- Base participants widget and orders; local adds a `sequence.message`; file converts widget to
  `state.node`. First assert directly on `mergeDocuments` plus `validateDocument`: no conflicts, zero
  error issues and one `connector.endpointType` warning. Then -> `planOutsideChange` returns `null`
  and banner.
- Reverse: file adds the message; local converts -> same assertions.
- Local adds `sequence.activation` on widget; file converts it -> banner.
- Base `bpmn.task` widget and orders; local adds `bpmn.sequenceFlow`; file converts widget to
  `bpmn.textAnnotation` -> no conflicts, no validation errors, `planOutsideChange` returns `null`, the
  flow keeps its type, banner.
- Reverse: file adds the flow; local converts -> same assertions.
- BPMN conversion with an existing flow unchanged, plus a local move of the element -> merged, no banner.
- Existing `connector.endpointType` warning on an unconverted element, plus a conversion of another
  element -> merged, no banner, the warning unchanged.
- Existing tests, including "a move and a rename of the same element both survive" -> unchanged and pass.

## Verification

1. `bun test apps/desktop/src/file/session-external.test.ts packages/core/src/document-merge.test.ts` exits 0, with the new cases passing.
2. `bun test apps/desktop/src/file` exits 0.
3. `bun run typecheck` exits 0 (overview rule 11).
4. `bunx biome check` on the files you edited exits 0.

## Done criteria

- `git diff --quiet 1e8f43d -- packages/core/src/document-merge.ts packages/ir/src/validate.ts` exits 0.
- `git diff 1e8f43d -- apps/desktop/src/file/session.ts` is empty, or the progress log names the failing test that required the change.
- The progress log lists evidence for each verification command.
