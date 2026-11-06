# fss-03-session

- planId: fss-03-session
- planPath: impl-plans/active/fss-03-session.md
- progressPath: impl-plans/progress/fss-03-session.md
- wave: 2
- dependsOn: fss-01-preserving-serializer, fss-02-attachments
- Design: `design-docs/specs/design-file-save-stability.md`, sections "Findings", "Behavior", "Tests" and "Verification gaps".
- Worker rules and pinned contracts: `impl-plans/active/fss-00-overview.md`.
- writePaths:
  - `apps/desktop/src/file/session.ts`
  - `apps/desktop/src/file/session-types.ts`
  - `apps/desktop/src/file/session-reconcile.ts`
  - `apps/desktop/src/shell/DocumentStatus.tsx`
  - `apps/desktop/src/file/session-save-stability.test.ts` (new)
  - `apps/desktop/src/file/session-test-helpers.ts`
  - `impl-plans/progress/fss-03-session.md`
  - `tmp/fss-s751/fss-03-session`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Rule 1: an outside change must not cause a save unless the user has unsaved in-app changes, and a save keeps untouched records byte-identical. Code reading found no automatic writer, but the exact first dirty source in the reported case is not established, so these guarantees must hold for any dirty source. Code reading also found a race: `performWrite` takes its snapshot before an attachment preparation that can be slow, and a merged outside change is then overwritten by that stale snapshot.

## Non-goals

- `packages/core`, `packages/collab`, `packages/ui-solid` and `apps/desktop/src/shell/workspace.ts` do not change. `changeWorkspace` keeps recording a mode as an unsaved edit.
- `reconcileDerivedState` itself and collab reconciliation do not change.
- Explicit Save and Save As are not gated.
- A change arriving during `backend.writeDocument` keeps its current conflict handling.
- Do not edit existing session tests. If one fails, it is a finding to fix in code or report, not an assertion to relax.

## File-level changes

`apps/desktop/src/file/session-types.ts`: add `readonly copiedAttachments: PreparedAttachments["copied"];` to `SessionState`, with a one-line comment that it is cleared by the next local edit, open or new document. Use a type-only import from `./attachments.ts`.

`apps/desktop/src/file/session.ts`:

- Initial `current` state: `copiedAttachments: []`.
- Clear it wherever `outsideChange` is cleared: the store subscriber at the top of the constructor, `load`, and the `newDocument` patch. Imitate the "only patch when non-empty" check there.
- `resolveConflict`, `"keep"` branch: set `this.lastSavedText = conflict.diskText` before `markDirty`.
- `applyOutsideChange`: in the `!isEmptyCommit(commit)` branch, call `reconcileDerivedState` only when `this.current.dirty` is true. The commit itself always runs.
- `performWrite`, in the existing `try`, after computing `path`:
  1. Gate: when `automatic`, `path === this.current.filePath` and `this.lastSavedText !== null`, compute `serializeDocumentPreservingText(this.editor.getSnapshot(), this.lastSavedText)`. If it equals `lastSavedText`, patch `dirty: false` and return `true`, with no attachment call and no `writeDocument`.
  2. Preparation loop: capture `this.editor.store.revision`, await `prepareDocumentAttachments` on a fresh snapshot, run the existing generation and automatic checks, and repeat while the revision changed.
  3. Serialize the last pass with `serializeDocumentPreservingText(attachments.document, this.lastSavedText)`, or `serializeDocument` when `lastSavedText` is null. Nothing may await between the last revision check and serialization.
- Post-write check: replace with `serializeDocumentPreservingText(this.editor.getSnapshot(), text) !== text`.
- Final patch: add `copiedAttachments: attachments.copied` only when `copied` is non-empty, so a later autosave does not erase the note.
- Update the header comment's invariants to mention the gate, keeping it short.

`apps/desktop/src/file/session-reconcile.ts`: comment-only changes if a comment turns stale. No behavior change.

`apps/desktop/src/shell/DocumentStatus.tsx`: add a `Show` next to the outside-change note, gated on `!props.isCloud` and a non-empty `props.file.copiedAttachments`. Use `class="app-file-status" role="status"`, text `copied N image(s) into artifacts/`, and a `title` listing each `from -> to`. Imitate the `outsideChange` block.

`apps/desktop/src/file/session-test-helpers.ts`: only if it reduces duplication, add a helper that installs counting `readAttachment` and `storeAttachment` on a `MockBackend`. `FileBackend` declares them optional and assignable.

## What a careless implementation gets wrong

- Without the `"keep"` change, the gate treats the older text as disk and skips the overwrite the user just chose. The new test must cover this.
- The gate must not run for `lastSavedText === null` (first autosave of a new or imported document), or when `path` differs from the open file.
- The gate must clear `dirty`: `prepareDocumentClose` in `apps/desktop/src/file/close.ts` asks about discarding based on `state().dirty` after `flush`. It must also return `true`, because disk already holds the document and `flush` reports that value.
- The gate must sit inside the `try`, so a validation throw reports through the existing `could not serialize` path.
- Do not set `status: "saving"` before preparation. `applyOutsideChange` would then raise spurious conflict banners during preparation.
- Keep generation checks inside the loop. A document switch during preparation must retire the write, as the test "a document switch during asset preparation" requires.
- Do not move `reconcileDerivedState` out of the `loading` guard, and do not drop it for merges.
- The `commit === null` branch (`loadDocument`) already does not reconcile. Leave it.
- `hydrateAttachments` errors go to `error` and do not write. Do not change this.

## Tests

`apps/desktop/src/file/session-save-stability.test.ts`, using `createHarness({ seeded: false })` and imitating `apps/desktop/src/file/session-external.test.ts`.

Fixture: a document text with 160 `image.raster` elements with `src` `thumbs/widget-<n>.png` on 4 pages and a 5th page with no images, built with a separate `Editor` and `serializeDocument`, and placed in `backend.files`. External edits come from another `Editor` over the disk text, adding a `shape.geo` on the 5th page.

`harness.settle()` drains only 8 microtasks. Add a longer local drain so hydration of 160 images finishes.

- Clean session, external edit, event, drain, `timers.fire()`, drain -> `backend.writes` empty, `storeAttachment` not called, no read after hydration, `dirty` false, editor shows the new shape.
- Clean session, two external edits in turn -> still no writes and no stores.
- Unsaved local edit plus external edit, autosave fires -> exactly one write, every `thumbs/` line unchanged byte for byte, no `artifacts/` in the file, no stores.
- Clean session whose disk text has a non-canonical element line, external edit, then a local edit and autosave -> that line present byte for byte.
- Open data-URL document, local edit, autosave with `storeAttachment` held by a promise, external edit and event during the hold, release -> the first entry of `backend.writes` contains the external shape, and no conflict banner is raised.
- Same race on a document switch (`newDocument` during the hold) -> no write.
- Opened document, local edit, `editor.undo()`, `timers.fire()`, drain -> no write, `dirty` false.
- `flush()` in that no-op state -> resolves `true` with no write.
- A different document on disk raising a conflict, `resolveConflict("keep")`, `timers.fire()`, drain -> file holds the local document.
- Clean outside change on a document where `planReconciliation` would produce commands -> editor snapshot serializes equal to the disk text. If no fixture yields commands, spy on `editor.reconcileDerivedState` and assert it is not called on the clean path and is called on the merge path.
- Save As to another folder where a relative image is absent at the destination -> `state().copiedAttachments` has one entry; a following local edit clears it.
- Save As to another folder where the destination has equal bytes -> `copiedAttachments` empty, `src` unchanged.

### Red check (evidence only)

Before changing `session.ts`, run the new test file and record each test's result in the progress log. Expected:

- The race test and the no-op undo test fail.
- The clean-session tests pass, since code reading says a clean session does not write.

If a clean-session test fails, that failure is the missing dirty source. Fix it at its origin if the origin is in `writePaths`. Otherwise stop and report the path as a blocker. Do not hide it behind the gate alone.

## Verification (each must exit 0)

1. `bun test apps/desktop/src/file/session-save-stability.test.ts apps/desktop/src/file/session.test.ts apps/desktop/src/file/session-external.test.ts apps/desktop/src/file/session-open.test.ts apps/desktop/src/file/attachments.test.ts apps/desktop/src/file/close.test.ts apps/desktop/src/shell/document-commands.test.ts` -> 0 fail, new tests included. Log: `tmp/fss-s751/fss-03-session/test.log`.
2. `bun test apps/desktop/src/file/cli-live.test.ts` -> 0 fail. Log: `cli-live.log`.
3. `bun run typecheck`. Log: `typecheck.log`.
4. `bunx biome check apps/desktop/src/file/session.ts apps/desktop/src/file/session-types.ts apps/desktop/src/file/session-reconcile.ts apps/desktop/src/shell/DocumentStatus.tsx apps/desktop/src/file/session-save-stability.test.ts apps/desktop/src/file/session-test-helpers.ts`. Log: `biome.log`.

## Done criteria

- Verification 1-4 exit 0 with logs recorded.
- `grep -n "serializeDocumentPreservingText" apps/desktop/src/file/session.ts` shows the gate, the serialization and the post-write check.
- `grep -n "copiedAttachments" apps/desktop/src/shell/DocumentStatus.tsx` matches.
- Existing session test files have no diff.
- Progress log has the red check table and states the clean-session result.
