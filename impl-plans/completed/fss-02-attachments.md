# fss-02-attachments

- planId: fss-02-attachments
- planPath: impl-plans/active/fss-02-attachments.md
- progressPath: impl-plans/progress/fss-02-attachments.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-file-save-stability.md`, sections "Rules" and "Attachment handling on save". The table there is binding.
- Worker rules and pinned contracts: `impl-plans/active/fss-00-overview.md`.
- writePaths:
  - `apps/desktop/src/file/attachments.ts`
  - `apps/desktop/src/file/attachments.test.ts`
  - `impl-plans/progress/fss-02-attachments.md`
  - `tmp/fss-s751/fss-02-attachments`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

`prepareDocumentAttachments` currently reads, stores and rewrites every `image.raster` on every save. Any save therefore moves all relative references into `artifacts/<sha256>.<ext>`. After this plan only data URLs, detached-document images and reported Save As copies reach `storeAttachment`.

## Non-goals

- `hydrateDocumentAttachments` does not change.
- No change to `backend.ts`, `session.ts`, `session-reconcile.ts`, or anything under `apps/desktop/src-tauri`. `store_attachment` stays as it is.
- `session.ts` starts reading `copied` in `fss-03`, not here.
- No new path-copy behavior. Copies always go through `storeAttachment`.

## File-level changes

`apps/desktop/src/file/attachments.ts`:

- `PreparedAttachments`: add `copied` exactly as pinned in the overview.
- `prepareDocumentAttachments`: same five parameters. Decide once per distinct `src`, cached as today in `sources`.
- Add a private `directoryOf(path)` using the last `/` or `\`, imitating `baseName` in `apps/desktop/src/file/session-paths.ts`. Same directory means both directories are equal strings and `sourcePath` is not null.

Decisions, in this order:

| `src` | Situation | Bytes used | Result |
| --- | --- | --- | --- |
| data URL | no `storeAttachment` | - | keep inline |
| data URL | `storeAttachment` present | the data URL | store, rewrite, add to `resolved` and `changes` |
| relative | `sourcePath` null | `editor.assets.resolve(src)` | store, rewrite as today. No bytes, or no `storeAttachment`: throw as today |
| relative | same directory | none | keep the element untouched. No backend call and no throw, even with no `storeAttachment` |
| relative | other directory, destination bytes equal source bytes | - | keep, add `src` to `resolved` |
| relative | other directory, destination readable, source unreadable | - | keep, add `src` to `resolved` |
| relative | other directory, source readable, destination absent or different | source | store, rewrite when the reference differs, add to `copied` and `resolved` |
| relative | other directory, neither readable | - | throw the existing `Missing attachment: ... Restore the file before saving a copy.` |
| relative | other directory, copy needed, no `storeAttachment` | - | throw the existing `This file backend cannot save document attachments.` |

For the Save As rows:

- Source bytes come from `editor.assets.resolve(src)`, then `backend.readAttachment(sourcePath, src)`.
- Destination bytes come from `backend.readAttachment(destination, src)`.
- Any failure from those reads, or from encoding the bytes, means that side is absent. `readAttachment` not being present means absent too.
- A kept `src` is added to `resolved` with the destination's bytes via `encodeRasterDataUrl`, so the editor shows what the new folder holds.
- `copied` has one `{ from: src, to: reference }` per distinct source, even when `from` equals `to`.
- `copied` is empty in every other row.

Imitate the existing loop and error style in the same function. Update the stale comment about legacy hosts to match.

## What a careless implementation gets wrong

- The same-directory check must come before any read. A read here brings back the slow, size-dependent preparation window and fails saves on a missing file.
- `sourcePath` null is not "same directory". HTML imports hold relative paths whose bytes exist only in the asset cache (`apps/desktop/src/file/session-import.ts`). They must still be stored on first save.
- Do not compare a read at `destination` when `destination` equals `sourcePath`. That path is the same-directory row.
- Do not swallow failures from `storeAttachment`. The existing test "failed attachment writes never publish JSONL" requires the throw.
- Do not check extensions or existence for same-directory references. Validation already happens in IR.
- Do not compare bytes by data URL string. Compare byte arrays, using `decodeRasterDataUrl` for the source.
- Do not edit the existing tests. All of them must pass unchanged, including lines 83 and 105.

## Tests

Add to `apps/desktop/src/file/attachments.test.ts`, keeping its `backend()` mock shape. Call `prepareDocumentAttachments` directly, plus session-level saves where stated.

- Session save of an opened document with relative `thumbs/widget-1.png` and a new data-URL image -> relative `src` unchanged in written JSONL, data URL replaced, exactly one `storeAttachment` call.
- Same directory, 3 relative images -> no `readAttachment` and no `storeAttachment` calls, no `changes`, empty `copied`.
- Same directory, backend without `storeAttachment` -> resolves with `src` unchanged.
- Same directory, file missing -> resolves with `src` unchanged.
- Detached (`sourcePath` null), relative with cached bytes -> stored and rewritten, empty `copied`.
- Detached, relative with no cached bytes -> rejects with `Missing attachment`.
- Other directory, destination has equal bytes -> no store, `src` unchanged, empty `copied`.
- Other directory, destination has the file, source unreadable -> no store, `src` unchanged.
- Other directory, destination has different bytes -> stored, `src` rewritten, one `copied` entry.
- Other directory, destination absent -> stored, `src` rewritten, one `copied` entry.
- Other directory, two elements with the same `src` -> one store, one `copied` entry, both rewritten.
- Other directory, neither side readable -> rejects with `Missing attachment`.
- Other directory, copy needed, no `storeAttachment` -> rejects.

Red check: run the first session-level test before changing `attachments.ts` and record the failure in the progress log. This is evidence only, not a listed verification command.

## Verification (each must exit 0)

1. `bun test apps/desktop/src/file/attachments.test.ts` -> 0 fail, new tests included. Log: `tmp/fss-s751/fss-02-attachments/test.log`.
2. `bun run typecheck`. Log: `typecheck.log`. See the sibling rule in the overview.
3. `bunx biome check apps/desktop/src/file/attachments.ts apps/desktop/src/file/attachments.test.ts`. Log: `biome.log`.

## Done criteria

- Verification 1-3 exit 0 with logs recorded.
- `git diff` on `attachments.test.ts` only adds lines.
- `git diff --stat -- apps/desktop/src-tauri` shows nothing from this plan.
- Progress log complete, including the red check.
