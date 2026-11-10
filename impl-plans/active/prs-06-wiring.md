# prs-06-wiring

- planId: prs-06-wiring
- planPath: impl-plans/active/prs-06-wiring.md
- progressPath: impl-plans/progress/prs-06-wiring.md
- wave: 3
- dependsOn: prs-03-fullscreen, prs-04-presentation-view, prs-05-page-flag-ui
  (and, through them, prs-01 and prs-02)
- Design: `design-docs/specs/design-presentation.md` sections 6, 7, 8 and 10.
  Rules: `impl-plans/active/prs-00-overview.md`.
- writePaths:
  - `apps/desktop/src/App.tsx`
  - `apps/desktop/src/shell/window-input.ts`
  - `apps/desktop/src/shell/window-input.test.ts` (new)
  - `apps/desktop/src/shell/FileActions.tsx`
  - `apps/desktop/src/pane.css`
  - `packages/ui-solid/src/index.ts`
  - `docs/editing.md`
  - `README.md`
  - `impl-plans/progress/prs-06-wiring.md`
  - `tmp/prs-s793/prs-06-wiring`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Connect everything:

- the F5 and Shift+F5 shortcuts and the menu and header actions
- mounting `PresentationView` over the editor
- fullscreen enter and restore, including the browser exit through Esc
- returning to the last shown page
- the ui-solid barrel export
- the muted tab CSS
- user docs and the README

This plan also runs the final workspace gates.

## Non-goals

- No logic changes to the prs-01..05 modules. If one is defective, record a
  blocker naming the file and do not patch it.
- No new shortcut-table entry in `packages/ui-solid/src/shortcuts.ts`:
  presenting is a shell action.

## File-level changes

1. `packages/ui-solid/src/index.ts`: append
   `export * from "./presentation/index.ts";`.
2. `window-input.ts`:
   - Add the options `presenting: () => boolean` and
     `startPresentation: (from: "first" | "current") => void`.
   - Add a pure export,
     `presentationStartShortcut(event: { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: EventTarget | null }): "first" | "current" | null`:
     - `F5` with no modifier -> `"first"`
     - `F5` with Shift only -> `"current"`
     - `null` when `isEditableTarget(target)` or any other modifier is held.
       Import `isEditableTarget` from `@nodetto/ui-solid`, as
       `apps/desktop/src/history-shortcuts.ts` already does, so the import
       loads under `bun test`.
   - In `onKeyDown`:
     - First line after the `settingsOpen` check: `if (options.presenting()) return;`.
     - Then the shortcut: when it is non-null, call `preventDefault()` and
       `stopPropagation()`, then `startPresentation`.
3. `App.tsx`:
   - State `presentFrom` as a signal holding `PageId | null`, plus a
     boolean signal `presenting`.
   - `startPresentation(from)`:
     - returns when already presenting
     - `from` is `editor.currentPageId` (`packages/core/src/editor/facade/core.ts:223`)
       for `"current"`, else `null`
     - when `startIndex(order, slideList(pages), from)` is `null`, does
       nothing
     - otherwise closes the open menus (file menu `details.open = false`
       and the cloud panel collapse already used by `watchWindowInput`)
     - sets the state, then
       `session = await enterPresentationFullscreen()`
     - when `session.mode === "dom"`, installs
       `watchFullscreenExit(document, exit)`
   - `exit(lastPageId?)`:
     - unmount
     - `await session.restore()`
     - remove the watcher
     - when `lastPageId` is given, `editor.setCurrentPage(lastPageId)`; the
       watcher-triggered exit uses the controller's last page through
       `onExit`, so keep the last reported page in a variable updated by
       `onExit` or by the view
   - Render `<Show when={presenting()}><PresentationView .../></Show>` at
     the root of the shell, after the main layout.
   - Pass `presenting` and `startPresentation` to `watchWindowInput`.
   - Add a header "Present" button next to the existing document actions
     (`title="Present (F5)"`), disabled when `slideList(pages)` is empty.
4. `FileActions.tsx`: add two menu items, imitating the existing ones:
   "Present" (hint F5) and "Present from current page" (hint Shift+F5).
   Add the props `onPresent(from: "first" | "current")` and
   `presentDisabled: boolean`.
5. `pane.css`: `.nodetto-page-tab-presentation-hidden { opacity: 0.55; }`
   (use the exact class constant from prs-05).
6. `docs/editing.md`: add a new `## Presentation` section after
   `## Page navigation`. It covers:
   - the start actions and shortcuts
   - every key in design section 6, including the number+Enter jump and B
   - the control bar and click-to-advance
   - the Hide/Show in presentation menu item and the inspector switch
   - the fullscreen fallback
7. `README.md`: one feature bullet, "Present pages as a full-screen
   slideshow (F5)", linking `docs/editing.md#presentation`.

## Pitfalls

- F5 must call `preventDefault`, or the WebView reloads. It must not fire
  in inputs, textareas or contenteditable.
- `presenting()` must short-circuit `window-input` before the cloud-undo
  and export chords.
- The browser Esc path: the DOM fullscreen exit sends no keydown. Only the
  watcher ends the presentation, and it must not call `restore` twice
  (`restore` is idempotent).
- Do not remount the editor canvas. The overlay sits on top.

## Tests (input -> expected)

`window-input.test.ts`, using `presentationStartShortcut` with fake
targets:

- F5 -> `"first"`; Shift+F5 -> `"current"`
- Ctrl+F5 or Meta+F5 -> `null`
- target `{ tagName: "INPUT" }` -> `null`
- target `{ isContentEditable: true }` -> `null`
- `"f5"` lowercase or `"F6"` -> `null`

## Verification (each exits 0 and runs at least 1 test with 0 failures; logs in `tmp/prs-s793/prs-06-wiring/final/`)

1. `bun test ./apps/desktop/src/shell/window-input.test.ts ./packages/ui-solid/src/presentation/controller.test.ts` -> `wiring.log`
2. `CARGO_TERM_QUIET=true mise run test` -> `test.log`. This runs
   typecheck, `bun test` and `cargo test`.
3. `CARGO_TERM_QUIET=true mise run verify` -> `verify.log`. This runs
   check, lint and test.

Final gates, recorded as static checks with logs in the same directory; each
must exit 0:

- `bun run typecheck` -> `typecheck.log`
- `CARGO_TERM_QUIET=true mise run lint` -> `lint.log`
- `bun run build` -> `build.log`
- `git diff --exit-code -- apps/desktop/src-tauri/gen/schemas` -> `schemas.log`

## Done criteria

- Verifications 1-3 and all four final gates exited 0.
- `grep -n '## Presentation' docs/editing.md` has 1 match, and `README.md`
  links `docs/editing.md#presentation`.
- `git diff --stat d6f9ebd -- packages/core/src/svg-export apps/cli` is
  empty.
- The progress log has the intent hash, per-edit hashes and every command's
  exit status and counts.
