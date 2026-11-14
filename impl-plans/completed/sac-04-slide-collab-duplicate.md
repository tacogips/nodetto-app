# sac-04-slide-collab-duplicate

- planId: sac-04-slide-collab-duplicate
- planPath: impl-plans/active/sac-04-slide-collab-duplicate.md
- progressPath: impl-plans/progress/sac-04-slide-collab-duplicate.md
- wave: 2
- dependsOn: sac-01-slide-data, sac-02-copy-shapes-core
- Design: `design-docs/specs/design-slide-area-copy-shapes.md` sections 2.1, 8 (the sac-04 row), 9 and 10.
- writePaths:
  - `packages/collab/src/ydoc.ts`
  - `packages/collab/src/binding.ts`
  - `packages/collab/src/slide-area.test.ts` (new)
  - `packages/core/src/editor/pages.ts`: the `planDuplicatePage` page literal only
  - `packages/core/src/duplicate-slide-origin.test.ts` (new)
  - `impl-plans/progress/sac-04-slide-collab-duplicate.md`
  - `tmp/sac-s826/sac-04-slide-collab-duplicate`
  - `target`
  - `apps/desktop/dist`
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Intent and context

Cloud documents must keep and share the new fields:

- `Document.slideSize` lives in the Yjs `meta` map.
- `Page.slideOrigin` lives in the page Y.Map.

Remote meta changes already reach the store: `change-source.ts` observes
`meta` deeply, and `binding.ts:431` `applyRemoteDocument` reloads through
`ydocToIr`. So `ydocToIr` only has to read the key.

Local edits must write the key. Today `binding.ts` writes `meta` only when
seeding.

Duplicate page also copies `slideOrigin`, the same way it copies
`hiddenInPresentation` (`pages.ts:655`).

## Non-goals

- No change to Yjs schema keys other than `slideSize` (meta) and
  `slideOrigin` (page).
- No server or Worker code.
- No change to copy-shapes (sac-02).
- No other duplicate fields.

## File-level changes

1. `ydoc.ts`:
   - `pageFields`: emit `slideOrigin` only when it is defined (`ydoc.ts:97`
     pattern).
   - `pageFromY`: accept it only when it is a plain object with finite
     numeric `x` and `y` (`ydoc.ts:238` pattern), copying `{ x, y }`.
   - `applyIrToDoc`: `setOptional(meta, "slideSize", document.slideSize)`.
   - `ydocToIr`: read `fromY(meta.get("slideSize"))`. Include
     `{ width, height }` only when it is a plain object with finite positive
     numbers.
   - Export a small `slideSizeFromY(value: unknown): SlideSize | undefined`
     helper only if `binding.ts` needs it.
2. `binding.ts`, in `applyLocalDiff`:
   - When `diff.pagesChanged`, call a new private `syncMeta()` inside the
     same transaction, before `syncPages()`.
   - It compares `this.editor.store.getMeta().slideSize` with a private
     `metaSlideShadow` (a JSON string or `undefined`). When they differ, it
     calls `this.meta.set("slideSize", toY(value))` or
     `this.meta.delete("slideSize")`.
   - `resetShadow()` also resets `metaSlideShadow` from the store.
3. `pages.ts` `planDuplicatePage`: add
   `...(source.slideOrigin ? { slideOrigin: { ...source.slideOrigin } } : {})`
   after the `hiddenInPresentation` spread. Change nothing else in this
   file.

## Pitfalls

- A page switch also has `pagesChanged` false, so a simple comparison
  against the shadow is enough. Never write `meta` when nothing changed:
  writing would create needless Y transactions and undo items.
- A remote apply runs under `applyingRemote`, and `applyLocalDiff` returns
  early. Keep it that way, so there is no echo loop.
- A document without `slideSize` must leave no `slideSize` key in the meta
  map, after both seeding and editing.
- An older client never writes the meta key, so it cannot erase
  `slideSize`. An older client can drop `slideOrigin` when it edits that
  page. This is accepted (design 10); do not try to fix it.

## Tests (input -> expected)

- `packages/collab/src/slide-area.test.ts` (imitate
  `packages/collab/src/page-presentation-flag.test.ts` and
  `binding-test-helpers.ts`):
  - `applyIrToDoc` then `ydocToIr` with `slideSize` and `slideOrigin` ->
    both are equal. Without them -> no keys, and `meta.has("slideSize")`
    is false.
  - Malformed Y values (`slideSize: "x"`, `slideOrigin: {x: "a"}`) -> those
    keys are omitted.
  - A binding with two peers (helpers): peer A applies `updateDocument`
    `slideSize`, then peer B's store meta has it. A sets `null`, then B has
    no key.
  - Peer A `updatePage slideOrigin` -> B's page has it.
- `packages/core/src/duplicate-slide-origin.test.ts`:
  - Duplicating a page with `slideOrigin {10,20}` -> the copy has
    `{10,20}`.
  - Without it -> the copy has no `slideOrigin` key.
  - Undo removes the copy.

## Verification (each exits 0 with at least 1 pass and 0 fail; logs in `tmp/sac-s826/sac-04-slide-collab-duplicate/final/`)

1. `bun test ./packages/collab/src/slide-area.test.ts ./packages/collab/src/page-presentation-flag.test.ts ./packages/collab/src/binding-pages-artboards.test.ts` -> `collab.log`
2. `bun test ./packages/core/src/duplicate-slide-origin.test.ts ./packages/core/src/pages.test.ts ./packages/core/src/copy-page-elements.test.ts` -> `duplicate.log`
3. `bun run typecheck` -> `typecheck.log`

Static: `bunx biome check` on the owned files.

## Done criteria

- Verifications 1-3 exited 0.
- `git diff -- packages/core/src/editor/pages.ts` touches only the
  `planDuplicatePage` page literal.
- The progress log has the intent hash, per-edit hashes and the exit
  statuses.
