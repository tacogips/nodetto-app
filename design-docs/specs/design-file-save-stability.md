# File save stability: external image references and unchanged records

Scope: the desktop document session (`apps/desktop/src/file/`), one additive
serializer in `packages/io`, and the docs. No Tauri command, no IR change, no
CLI behavior change.

This refines `design-web-app-roundtrip.md` (attachments) and
`design-document-change-source.md` (outside changes).

## Rules

**Rule 1: an outside change does not cause a save.** Reloading or merging a
file changed outside the app writes nothing unless the user has unsaved in-app
changes. When a save does happen, every record the app did not change is
written byte-identically, in its existing order.

**Rule 2: saving does not move image references.** Save, autosave and reconcile
never rewrite a non-data-URL `semantic.src`. `artifacts/` receives only:

- embedded data-URL images, which have no file reference;
- images of a detached document (an import with no file yet), whose bytes exist
  only in the editor's asset cache;
- images a Save As to another folder could not otherwise keep, which are reported.

## Findings the design rests on

From reading the code (see Verification gaps):

- `prepareDocumentAttachments` reads, stores and rewrites every image on every
  save. Any save therefore moves all relative references to `artifacts/`.
- A clean session does not write on an outside change: `applyOutsideChange`
  only calls `markDirty` when `dirty` is already true.
- No UI code writes persisted content without a user gesture. Asset hydration
  notifies through `HISTORY_DIFF` on the editor, not the store the session
  subscribes to. `followPageWorkspace` only sets a signal, and `setPageMode` is
  reached only from the user-driven `changeWorkspace`. That rules out the
  `workspace.ts` candidate as an automatic trigger.
- So the save needs an earlier dirty state. Any unsaved edit, including a mode
  change, then makes the next outside change merge and autosave.
- **Stale-snapshot race, which depends on document size.** `performWrite` takes
  its snapshot before preparing attachments, and `status` only becomes `saving`
  afterwards. While 160 images are read and stored one by one, an outside change
  merges into the editor and updates `lastSavedText`. The stale snapshot is then
  written over the other writer's bytes, the post-write check finds a difference,
  and autosave writes again.
- `applyOutsideChange` runs `reconcileDerivedState` even on a clean take, so the
  editor can silently differ from disk with `dirty` false. Opening the same file
  does not reconcile.

The exact first dirty source in the reported case is not established. This
design does not depend on it: every path below holds for any dirty source.

## Behavior

### Automatic writes compare before writing

In `performWrite`, an automatic write to the open file first compares the
current document with `lastSavedText` using the serializer below. If the output
equals `lastSavedText`, then:

- nothing is written and no attachment is touched;
- `dirty` is cleared;
- the call returns `true`, because disk already holds the document, so quit does
  not ask about discarding.

Explicit Save and Save As are not gated. They are user requests, and the
serializer already makes an unchanged explicit save byte-identical.

The comparison requires `lastSavedText` to mean what the session header says:
the bytes last seen on disk. `resolveConflict("keep")` currently leaves the older
text in place, so the gate would wrongly skip the overwrite the user just chose.
It must set `lastSavedText` to `conflict.diskText`.

### A clean outside change leaves the editor equal to disk

`reconcileDerivedState` runs only when merging into unsaved edits. A clean take
then matches what reopening the file shows, which keeps the comparison above
exact. Derived repairs made during a merge are app changes and are saved with
the user's edits.

### Saves use a snapshot that is current when serialized

`performWrite` repeats attachment preparation from a fresh snapshot while
`editor.store.revision` changed during preparation, and serializes only the
result of the last pass. Content-addressed storage makes a repeat cheap, and
documents without data URLs do no attachment I/O at all. The existing generation
checks still run after each pass. A change arriving during the backend write
itself keeps its current handling: the conflict banner.

### Attachment handling on save

`prepareDocumentAttachments` decides per distinct `src`:

| `src` | Situation | Result |
| --- | --- | --- |
| data URL | backend can store | store in `artifacts/`, rewrite (unchanged) |
| data URL | backend cannot store | keep inline (unchanged) |
| relative | same directory as the open file | keep; no read, no store, no failure |
| relative | detached document (`sourcePath` null) | bytes from cache: store, rewrite (unchanged); no bytes: fail (unchanged) |
| relative | Save As, destination has equal bytes | keep |
| relative | Save As, destination has the file, source unreadable | keep |
| relative | Save As, source readable, destination absent or different | store in `artifacts/`, rewrite, report |
| relative | Save As, neither side has the bytes | fail before writing JSONL (unchanged) |
| relative | Save As, backend cannot store, a copy is needed | fail before writing JSONL (unchanged) |

- "Same directory" compares the directory part of the two path strings. A false
  negative, such as a symlinked path, falls into the Save As rows and still keeps
  the reference because the bytes match.
- Source bytes come from the asset cache, then `readAttachment(sourcePath, src)`.
  Any read failure at the destination counts as absent.
- A same-folder save with a missing file now succeeds and leaves the reference
  alone. Hydration keeps reporting the missing file. Refusing would block all
  saving of an otherwise valid document, and the reference is not made any worse.
- Copies use the existing `storeAttachment`, so `store_attachment` and its Rust
  tests do not change.
- `attachmentSourcePatches` stays as the way to apply rewrites to the editor.

### Reporting Save As copies

`PreparedAttachments` gains `copied: readonly { from: string; to: string }[]`,
one entry per distinct source, for the Save As copy row only. `SessionState`
gains `copiedAttachments` with the same shape, empty by default, set after a
successful write and cleared wherever `outsideChange` is cleared.
`DocumentStatus.tsx` shows a status note with the count and lists the paths in
its title, next to the existing "updated from disk" note.

### Byte-preserving serialization

Add `serializeDocumentPreservingText(document, baseText): string` to
`packages/io`, exported from its index. `serializeDocument` and its output are
unchanged, and the CLI does not call the new function. It uses canonical
comparison rather than the existing `sourceLines`, which are keyed by object
identity and cannot survive editor snapshots.

1. Validate `document` as `serializeDocument` does, then compute its canonical
   lines by record key: `document`, `page:<id>`, `element:<id>`,
   `unknown:<canonical text>`.
2. Parse `baseText` and compute the same lines. Return the plain canonical text
   when the base fails to parse or validate, has a different document id, or was
   migrated (its raw `schemaVersion` differs from the parsed one, since old-schema
   lines must not be reused under a new document line).
3. A record is unchanged when its canonical line is equal on both sides. It keeps
   its raw base line, including any non-canonical key order, spacing or `\r`.
4. If no record changed, was added or was removed, return `baseText` verbatim.
5. If the surviving base records are already in canonical relative order, emit
   canonical order, substituting raw lines for unchanged records. A canonical base
   therefore always yields exactly `serializeDocument(document)`.
6. Otherwise keep the base order. Changed records are replaced in place, removed
   ones dropped, and new ones inserted after their canonical predecessor, or after
   the document record when they have none.
7. Keep a leading BOM, and end with a newline exactly when the base did.

Split on the string `"\n"` and keep lookups safe under `noUncheckedIndexedAccess`.

`performWrite` serializes with this function using `lastSavedText` as the base,
or `serializeDocument` when that is null. The post-write dirty check becomes
`serializeDocumentPreservingText(snapshot, text) !== text`, since `text` may now
be non-canonical.

## Compatibility

- No document format, IR or validation change. Existing `artifacts/` references
  stay as they are and keep resolving.
- Embedded images still externalize on the next real save. Opening or reloading
  such a file writes nothing.
- The private consumer of `packages/io` sees one new export.
- `changeWorkspace` keeps recording a page mode as an unsaved edit, because the
  user chose it and dropping it would lose that choice.

## Tests

Session tests use the mock backend with `readAttachment` and `storeAttachment`
counters, and neutral fixtures such as `thumbs/widget-<n>.png`.

- 160 relative images on 4 pages, clean, external edit on a 5th page, timers
  fired: no writes, no attachment reads for saving, no stores, not dirty.
- Same fixture with an unsaved edit: one write, every `src` unchanged, no stores,
  and only the edited and externally changed records differ from their prior lines.
- An outside change during attachment preparation of a data-URL document: the
  written file contains the outside change on the first write.
- A no-op dirty state (edit then undo, automatic mode): no write, not dirty.
- Conflict "keep" followed by autosave still overwrites the file.
- A non-canonical external line survives a later save of another element byte for
  byte, and foreign record order is kept.
- `attachments.test.ts`: save keeps relative `src` and stores only data URLs; a
  same-folder save with a missing file succeeds; every Save As row in the table;
  a detached import still stores. The existing Save As and missing-assets tests
  stay valid unchanged.
- `packages/io`: identity, canonical base equals `serializeDocument`, add, remove,
  move across pages, unknown records, BOM, CRLF, migrated base, different id.

Verification: targeted `bun test` plus `bun run typecheck` per plan, then
`mise run verify`. `mise run test-cli` is needed only if CLI code changes, and
this design changes none. No Rust test changes, because no Tauri command changes.

## Docs

- `docs/editing.md` (File saving): state both rules and the Save As table in
  plain words.
- `docs/design.md` (image importer): only embedded images externalize.
- `docs/cli.md` (outside changes): a clean reload never writes, and a merge save
  keeps untouched lines.
- `design-web-app-roundtrip.md`: already points here.

## Verification gaps

`bun test` could not be run during design, so the findings above come from code
reading. The first implementation plan must add the race and the rule 1 tests and
see them fail against the current code before fixing it. If the clean-session test
unexpectedly fails, that is the missing dirty source and must be fixed at its origin.
