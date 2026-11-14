# fss-04-docs-final

- planId: fss-04-docs-final
- planPath: impl-plans/active/fss-04-docs-final.md
- progressPath: impl-plans/progress/fss-04-docs-final.md
- wave: 3
- dependsOn: fss-03-session
- Design: `design-docs/specs/design-file-save-stability.md`, sections "Rules", "Attachment handling on save" and "Docs".
- Worker rules and pinned contracts: `impl-plans/active/fss-00-overview.md`.
- writePaths:
  - `docs/editing.md`
  - `docs/design.md`
  - `docs/cli.md`
  - `impl-plans/progress/fss-04-docs-final.md`
  - `tmp/fss-s751/fss-04-docs-final`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

The request requires the docs to state both rules as specification. This plan runs last so the text matches the delivered behavior, and it runs the final gate on the combined tree.

## Non-goals

- No code or test edits. If the final gate fails, record the failure and report it. Repairs belong to the owning plan through reconciliation.
- No `README.md` or `impl-plans/README.md` edit. No archiving.
- No `apps/cli/src/help.ts` change, because no CLI behavior changes.

## File-level changes

Before editing, confirm the delivered behavior in `apps/desktop/src/file/attachments.ts` and `session.ts`. If it differs from the design, report it instead of documenting either version.

`docs/editing.md`, section "File saving", the sentences from "File > Save as chooses a different location" through "needed by undo or other documents": replace with plain statements of:

- Rule 1: when another program changes the open file, the app shows the change live and does not write the file unless you have unsaved changes in the app. When it does save, lines for anything the app did not change stay byte-identical and in the same order.
- Rule 2: saving never rewrites a relative image path such as `thumbs/widget.png`. Only images with no file reference (pasted or dropped) are stored in `artifacts/` beside the document. An imported document with no file yet stores its images there on first save.
- Save As to another folder: a relative path is kept when the new folder already has the same file. Otherwise the image is copied into the new folder's `artifacts/`, the path is updated, and the status bar reports the copy. If the image can be found in neither place, Save As fails and writes nothing.
- A save in the same folder succeeds even if an image file is missing. The reference stays and the missing file is reported.
- Keep the sentence that saving never deletes files. Say to move or share the JSONL file together with every image it references.

`docs/design.md`, the Image importer sentences near line 364: say desktop saving stores newly embedded image bytes in sibling `artifacts/`, legacy embedded images are externalized on the next save that actually writes, and existing relative references are never rewritten. Opening or reloading writes nothing.

`docs/cli.md`, the "desktop app applies outside changes" bullet near line 144: add that with no unsaved local edits the app does not write the file, and that a merge save keeps untouched lines byte-identical and leaves relative image references alone. Keep the rest of the bullet.

## What a careless implementation gets wrong

- Do not reword unrelated sentences or reflow paragraphs in these files.
- Do not say all copying stopped: data URLs, detached imports and Save As copies still reach `artifacts/`.
- Use neutral examples only. No emojis.

## Tests

None added. Docs are checked by the greps below.

## Verification (each must exit 0)

1. `grep -n "byte-identical" docs/editing.md docs/cli.md`, expecting a match in each file. Log: `tmp/fss-s751/fss-04-docs-final/grep-rule1.log`.
2. `grep -n "thumbs/widget.png" docs/editing.md`, expecting a match. Log: `grep-rule2.log`.
3. `CARGO_TERM_QUIET=true mise run verify` on the combined tree. Log: `verify.log`. It must show 0 test failures. Read the whole log, not only the exit status.

Do not list or run `mise run test-cli` unless CLI code changed. Confirm with `git status --short apps/cli`, recording the empty output.

## Done criteria

- Verification 1-3 exit 0 with logs recorded.
- `git diff --stat -- docs` lists only the three named docs.
- Progress log records test counts from `verify.log` and the `apps/cli` check.
