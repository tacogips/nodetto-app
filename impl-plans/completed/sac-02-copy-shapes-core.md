# sac-02-copy-shapes-core

- planId: sac-02-copy-shapes-core
- planPath: impl-plans/active/sac-02-copy-shapes-core.md
- progressPath: impl-plans/progress/sac-02-copy-shapes-core.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-slide-area-copy-shapes.md` sections 6.1-6.3 and 9.
- writePaths:
  - `packages/core/src/editor/pages.ts`
  - `packages/core/src/editor/facade/page-editing.ts`
  - `packages/core/src/copy-page-elements.test.ts` (new)
  - `impl-plans/progress/sac-02-copy-shapes-core.md`
  - `tmp/sac-s826/sac-02-copy-shapes-core`
  - `target`
  - `apps/desktop/dist`
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Intent and context

Users build the next slide from the previous one. Copy every element of a
source page onto a target page:

- at the same coordinates
- with fresh ids and remapped references
- on top of the existing content
- as one undo step

Reuse the Duplicate page code path by extracting it. Do not duplicate it.

## Non-goals

- No change to `packages/core/src/clipboard.ts` (`copyElements`/`planPaste`
  already do the remapping).
- No new Command kind.
- No copying of page-level fields.
- No UI or CLI.
- No `slideOrigin` duplicate change (sac-04).

## File-level changes

1. `pages.ts`:
   - Add the exported
     `planPageElementsCopy(editor: EditorCore, idSource: IdSource, fromPageId: PageId, toPageId: PageId): PastePlan`.
     Its body is exactly the current `copyElements(...)` + `planPaste(...)`
     block of `planDuplicatePage` (`pages.ts:662-671`), with `page.id`
     replaced by `toPageId` (`nextIndex: () => editor.nextIndex(toPageId)`,
     `offset {x:0,y:0}`).
   - Import the `PastePlan` type from `../clipboard.ts`.
   - `planDuplicatePage` calls `planPageElementsCopy(editor, idSource, id, page.id)`.
     Keep the order of `idSource()` calls identical: the page id is drawn
     first, then the element ids.
2. `page-editing.ts` (next to `duplicatePage`, `page-editing.ts:233`):
   - `adjacentPageId(id, direction)`: `const pages = this.store.listPages()`
     (already in tab order, as `planPageMove` uses it). Find the index; a
     missing id gives `null`. Read `pages[index ± 1]` with an `undefined`
     check and return its `id` or `null`. Hidden pages count.
   - `copyPageElements(fromPageId, toPageId, applyOptions = {})`:
     - Return `null` if either page is unknown or `from === to`.
     - Return `[]`, with no apply and no undo entry, if the source has no
       elements.
     - Otherwise run `planPageElementsCopy(this, this.idSource, from, to)`,
       then `this.apply(plan.commands, applyOptions)`.
     - Then, if `this.currentPageId !== to`, call `this.setCurrentPage(to)`.
     - Then `this.selection.set(plan.ids)`; check the `selection.set`
       signature in `facade/core.ts:150`.
     - Return `[...plan.ids]`.
   - Add short doc comments matching the `duplicatePage` style.

## Pitfalls

- `setCurrentPage` clears the selection (`facade/core.ts:239`). Select
  AFTER switching the page, otherwise the selection is lost.
- One `apply` call means one undo entry. Do not split the commands.
- Pasted elements must be above the target's existing elements:
  `nextIndex(toPageId)` handles this. Do not pass the source's indices
  through.
- Duplicate page output must stay byte-identical. The existing
  `packages/core/src/pages.test.ts` and `page-presentation-flag.test.ts`
  must pass without edits.
- Check every array read for `undefined` (`noUncheckedIndexedAccess`).

## Tests (`packages/core/src/copy-page-elements.test.ts`; imitate the fixtures in `packages/core/src/pages.test.ts`)

- Source page with two rectangles, a connector between them (endpoints
  bound to element ids), and a group containing one rectangle; the target
  has one existing element. Copying:
  - adds `source count` elements to the target
  - gives every new id a different id from the source ids
  - gives the connector endpoints the new rectangle ids
  - gives the group's children the new ids
  - keeps `visual.x/y` equal to the source values
  - places every new element's index above the target's existing element
  - selects the returned ids, and the current page is the target
- One `editor.undo()` -> the target's elements equal the snapshot taken
  before the copy (deep equal) and the source is unchanged.
- `copyPageElements(a, a)` -> `null`, and the revision is unchanged.
- An unknown source -> `null`.
- An empty source -> `[]`, and the undo stack length is unchanged.
- `adjacentPageId(first, "prev")` -> `null`;
  `adjacentPageId(last, "next")` -> `null`; a middle page gives its
  neighbors; an unknown id -> `null`; a hidden middle page is still a
  neighbor.
- Duplicate page: `editor.duplicatePage(id)` still yields the same element
  count and remapped connector (an existing behavior check).

## Verification (each exits 0 with at least 1 pass and 0 fail; logs in `tmp/sac-s826/sac-02-copy-shapes-core/final/`)

1. `bun test ./packages/core/src/copy-page-elements.test.ts` -> `copy.log`
2. `bun test ./packages/core/src/pages.test.ts ./packages/core/src/page-presentation-flag.test.ts ./packages/core/src/page-order.test.ts` -> `duplicate.log`
3. `bun run typecheck` -> `typecheck.log`

Static: `bunx biome check` on the owned files.

## Done criteria

- Verifications 1-3 exited 0.
- `grep -c 'copyElements(' packages/core/src/editor/pages.ts` is 1: only
  the helper calls it.
- The progress log has the intent hash, per-edit hashes and the exit
  statuses.
