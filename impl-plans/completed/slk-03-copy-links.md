# slk-03-copy-links

- planId: slk-03-copy-links
- planPath: impl-plans/active/slk-03-copy-links.md
- progressPath: impl-plans/progress/slk-03-copy-links.md
- wave: 2; dependsOn: slk-00-strict-index-gate, slk-01-link-field
- Design: sections 3.1-3.3 and 9 of `design-docs/specs/design-slide-link-animation.md`.
- writePaths: `packages/core/src/clipboard.ts`, `packages/core/src/editor/pages.ts`,
  `packages/core/src/copy-page-elements.test.ts`,
  `packages/core/src/link-id-copy.test.ts` (new),
  `packages/core/src/pages.test.ts`, `packages/core/src/duplicate-slide-origin.test.ts`,
  `apps/cli/src/pages-command.test.ts`, `packages/collab/src/binding.test.ts`,
  `packages/collab/src/binding-pages-artboards.test.ts`,
  `impl-plans/progress/slk-03-copy-links.md`, `tmp/slk-s855/slk-03-copy-links`, `target`
  (the existing tests are pre-authorised for assertion updates only, when
  they observe the new `linkId`)
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

Only Duplicate page and Copy shapes from page create links. Every paste
path is built on `planPaste` (`packages/core/src/clipboard.ts:183`):
`editor/paste.ts:48` (paste and `duplicateSelection`),
`editor/components.ts` (4 calls) and `editor/pages.ts:101`. So stripping
`linkId` in `planPaste` covers same-page paste, duplicate, component
instances and cross-document paste. A grep of `createElement` producers
found no other path that clones an existing element's visual. Re-run
`grep -rn "type: \"createElement\"" packages/core/src` and record the
result. If a new cloning path appears, stop and log it as drift; do not
edit files outside writePaths.

## Non-goals

- No change to `commands.ts`, `copyElements`, `paste.ts`,
  `components.ts`, the facade, or CLI source.
- No link for clipboard paste onto another page (user-qa Q1 default).

## File-level changes

1. `clipboard.ts`:
   - `PasteOptions` gains `readonly linkIds?: ReadonlyMap<ElementId, string>`,
     keyed by payload (source) element id.
   - In `planPaste`, build the created `visual` without `linkId`
     (destructure it out of `source.visual`). Then add
     `linkId: options.linkIds.get(element.id)` only when the map has the
     key.
   - Keep the token remapping and `offsetVisual` unchanged.
2. `editor/pages.ts` `planPageElementsCopy`:
   - after `copyElements`, build `linkIds`: for each payload element,
     `link = store.get(id)?.visual.linkId ?? id`;
   - build `sourceUpdates`: for each payload source without `linkId`,
     `{ type: "updateVisual", id, visual: { linkId: id } }`;
   - return `{ ...plan, commands: [...sourceUpdates, ...plan.commands] }`;
   - `planDuplicatePage` needs no change; it already spreads
     `plan.commands`.

## Pitfalls

- `updateVisual` must come before the creates, so undo order is clean.
  Undo of `updateVisual` is `replaceVisual(previous)` (`commands.ts:~620`),
  which restores the exact visual.
- Do not consume extra ids from `idSource`: id order must stay identical.
- Payload ports added by `copyElements` get links like any other element.
- A source that already has `linkId` gets no `updateVisual`.
- `structuredClone` already happens in `planPaste`; do not mutate the
  payload.

## Tests

`packages/core/src/link-id-copy.test.ts` (use `makeEditor`, `document`,
`element` from `test-helpers.ts`; imitate `copy-page-elements.test.ts`):

- `copyPageElements(A, B)`, sources without links -> every copy has a new
  id and `linkId` = its source id, and every source now has
  `linkId` = its own id
- a source with `linkId: "L"` -> its copy has `"L"` and the source is
  unchanged
- `duplicatePage(A)` -> same linking as above
- one `editor.undo()` after copy -> both pages deep-equal their state
  before the copy (sources lose the added `linkId`, copies are gone)
- a source with `linkId` + `duplicateSelection()` on the same page -> the
  copy has no `linkId`
- a source with `linkId` + copy and paste onto another page through the
  clipboard -> the copy has no `linkId`
- a component instance from a source carrying `linkId` -> no `linkId`
  (only if there is an easy existing helper; otherwise call `planPaste`
  directly without `linkIds` -> no `linkId`)

`copy-page-elements.test.ts` lines ~76-77: change the assertions to compare
the visuals with `linkId` removed, and assert `linkId` equals the source id.
Update the other pre-authorised tests only where they now fail because of
`linkId`. Never delete an assertion.

## Verification (each must exit 0)

1. `bun test packages/core/src/copy-page-elements.test.ts packages/core/src/link-id-copy.test.ts packages/core/src/pages.test.ts packages/core/src/duplicate-slide-origin.test.ts packages/core/src/page-presentation-flag.test.ts packages/collab apps/cli/src/pages-command.test.ts`
2. `bun test packages/core`: the whole core suite, with no regression in
   paste, components or duplicate.
3. `bun run typecheck`
4. `bun .agents/scripts/strict-index-gate.ts capture-baseline --ref ccac2d3 --out target/strict-index/baseline.log`
5. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slk-03-copy-links.log -- packages/core/src/clipboard.ts packages/core/src/editor/pages.ts packages/core/src/link-id-copy.test.ts packages/core/src/copy-page-elements.test.ts`
6. `bunx biome check --diagnostic-level=warn` on every owned `.ts` file that was edited

Evidence: logs and exit codes under `tmp/slk-s855/slk-03-copy-links/`;
strict log at `target/strict-index/slk-03-copy-links.log`.

## Acceptance criteria

- The tests above pass.
- `git diff ccac2d3 -- packages/core/src/commands.ts packages/core/src/editor/paste.ts packages/core/src/editor/components.ts` is empty.
- The strict gate exits 0.
