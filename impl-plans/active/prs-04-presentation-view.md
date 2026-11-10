# prs-04-presentation-view

- planId: prs-04-presentation-view
- planPath: impl-plans/active/prs-04-presentation-view.md
- progressPath: impl-plans/progress/prs-04-presentation-view.md
- wave: 2
- dependsOn: prs-01-page-flag (`exportPageSvgOf`), prs-02-core-presentation
- Design: `design-docs/specs/design-presentation.md` sections 5 and 6.
  Contracts: `impl-plans/active/prs-00-overview.md`.
- writePaths:
  - `packages/ui-solid/src/presentation/index.ts` (new)
  - `packages/ui-solid/src/presentation/keys.ts` (new)
  - `packages/ui-solid/src/presentation/keys.test.ts` (new)
  - `packages/ui-solid/src/presentation/controller.ts` (new)
  - `packages/ui-solid/src/presentation/controller.test.ts` (new)
  - `packages/ui-solid/src/presentation/PresentationView.tsx` (new)
  - `packages/ui-solid/src/presentation/Presentation.css` (new)
  - `impl-plans/progress/prs-04-presentation-view.md`
  - `tmp/prs-s793/prs-04-presentation-view`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

The read-only full-viewport slideshow view. ui-solid tests run without a
DOM: `bunfig.toml` preloads only the JSX transform, and existing tests such
as `Toolbar.test.ts` test exported pure data. So all behavior lives in a
DOM-free `controller.ts` with tests. `PresentationView.tsx` is a thin
binding: it holds signals, attaches listeners and renders markup.

## Non-goals

- No edits to `packages/ui-solid/src/index.ts`, `PageTabs.tsx` or desktop
  files (those are prs-05 and prs-06).
- No canvas reuse and no DOM SVG injection.

## File-level changes

1. `keys.ts`: `presentationKeyAction(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): PresentationAction | "exit" | null`
   per the design section 6 table.
   - Space is `key === " "`.
   - Letters are case-insensitive.
   - Digits `0`-`9` map to `{ type: "digit" }`.
   - Ctrl, Meta or Alt -> `null`.
2. `controller.ts`:
   - `createPresentationController({ editor, from, onExit }): PresentationController`
     exposes:
     - `state(): PresentationState | null`
     - `refresh(): void`: recomputes `slideList(editor.store.listPages())`
       and dispatches `reconcile`. An empty list calls `exit`.
     - `dispatch(action: PresentationAction | "exit"): void`. `"exit"` with
       pending digits dispatches `clearDigits` instead. A second `"exit"`
       calls `onExit(currentSlide(state))` once.
     - `slide(): { src: string | null; size: SlideSize | null }`:
       - Artboard: `editor.exportArtboardSvg(frameId)`. A `null` result
         falls back to `editor.exportPageSvgOf(pageId, { padding: 0 })`.
       - Page: `editor.exportPageSvgOf(pageId, { padding: 0 })`.
       - `src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)`.
       - `size = svgSize(svg)`.
       - Cache by `pageId` + `editor.revision`.
     - `layout(viewport: SlideSize)`: `fitSlide(size ?? viewport, viewport, PRESENTATION_MARGIN)`.
     - `counterText()`: `"n / total"`, or `"Go to: <digits>"` while digits
       are pending.
     - `handleKeyDown(event)`: runs on every key, mapped or not:
       - calls `preventDefault()` and `stopImmediatePropagation()`
       - except `F11`, which is left to the browser
       - then dispatches the mapped action
   - At creation, `startIndex(order, slides, from)` returning `null` calls
     `onExit(from ?? first page id)`.
   - The controller never mutates the document.
3. `PresentationView.tsx`:
   - props `{ editor: Editor; from: PageId | null; onExit(lastPageId: PageId): void }`
   - creates the controller
   - `createEditorSignals(editor)` (`packages/ui-solid/src/adapter.ts`);
     `rev()` triggers `refresh`
   - on mount:
     - `window.addEventListener("keydown", handler, true)`
     - `resize` updates the viewport
     - focus the root (`tabindex="-1"`)
     - remember `document.activeElement`
   - on cleanup: remove the listeners and restore focus (imitate
     `ContextMenu.tsx:353`)
   - markup:
     - root `.nodetto-presentation`
     - a stage `<img>` in the fitted box, or a white box for an empty slide
     - a black screen hides the slide
   - a control bar with prev, next, counter and exit buttons:
     - shown on `pointermove`, hidden after 2000 ms
     - the cursor is hidden while the bar is hidden
     - buttons call `stopPropagation`
   - a primary click on the stage dispatches `next`
4. `Presentation.css`:
   - `position: fixed; inset: 0`
   - a z-index above the chrome (check the highest z-index in
     `packages/ui-solid/src/*.css` and record it)
   - a `#000` background and a `#fff` slide backing
5. `index.ts`: export `PresentationView`, `createPresentationController`,
   `presentationKeyAction` and their types.

## Pitfalls

- Do not use `innerHTML` with the SVG: `<defs>` ids would collide with the
  mounted canvas.
- The capture listener must call `stopImmediatePropagation`, not just
  `stopPropagation`. Otherwise Backspace or N reach editor shortcuts.
- Clear the hide timer on cleanup.
- Esc with pending digits clears them; it does not exit.

## Tests (input -> expected)

- `keys.test.ts`:
  - `ArrowRight`, `ArrowDown`, `PageDown`, `" "`, `n` and `N` -> next
  - `Enter` -> enter
  - `ArrowLeft`, `ArrowUp`, `PageUp`, `Backspace` and `p` -> prev
  - `Home` / `End` -> first / last
  - `7` -> digit 7
  - `b` -> toggleBlack
  - `Escape` -> `"exit"`
  - `Ctrl+N` -> `null`; `x` -> `null`
- `controller.test.ts` (an editor built like
  `packages/core/src/editor.test.ts:makeEditor`, with 3 pages, the middle
  one hidden):
  - Renders the slide: `slide().src` starts with `data:image/svg+xml` and
    the decoded text contains the page's element `data-id`.
  - The counter is `"1 / 2"`. After an `ArrowRight` key it is `"2 / 2"`.
  - `2` then `Enter` -> page 3. `B` -> black true.
  - A fake event records `preventDefault` and `stopImmediatePropagation`
    calls for `Backspace` and for an unmapped `q`.
  - `editor.revision` is unchanged after all keys.
  - `Escape` with digits pending -> no exit. A second `Escape` -> `onExit`
    called once with the current page id.
  - Hiding the current page via `setPageHiddenInPresentation`, then
    `refresh()` -> a valid state.
  - A page with one frame inside a hidden group plus a visible rectangle ->
    `src` non-null.
  - `layout` returns finite numbers.

## Verification (exits 0 with at least 1 pass and 0 fail; log in `tmp/prs-s793/prs-04-presentation-view/final/`)

1. `bun test ./packages/ui-solid/src/presentation/keys.test.ts ./packages/ui-solid/src/presentation/controller.test.ts` -> `view.log`

Static: Biome on the owned files, then `bun run typecheck`.

## Done criteria

- Verification 1 exited 0.
- `grep -n 'innerHTML' packages/ui-solid/src/presentation/` has no match.
- The progress log has the intent hash, per-edit hashes and command results.
