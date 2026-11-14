# Presentation (slideshow) mode

Status: design for implementation. Scope: the public `nodetto-app` repository
only (`packages/ir`, `packages/io`, `packages/collab`, `packages/core`,
`packages/ui-solid`, `apps/desktop`, `docs/`, `README.md`). No server, auth or
deployment code. The CLI is out of scope.

Owner decisions that have a default applied are in
`design-docs/user-qa/presentation.md`.

## 1. Goals and non-goals

Goals:

1. Present the open document full screen. Each slide is one page, in
   page-tab order (`Store.listPages()`, sorted by `comparePageOrder`).
2. Render slides read-only through the existing SVG export renderer, so
   there are no handles, selection, grid, rulers, hover affordances, comment
   pins or remote cursors (see `design-docs/specs/export.md` section 2).
3. Fit each slide to the screen, letterboxed, keeping the aspect ratio.
4. Keyboard, mouse and control-bar navigation as listed in section 6.
5. A per-page `hiddenInPresentation` flag skips pages. It is stored in the
   JSONL page record and edited from the page tab menu and the page
   inspector.

Amendment 2026-11-12: animated slide transitions and element `linkId` are
added by `design-docs/specs/design-slide-link-animation.md`. The resting
slide stays an `<img>` (section 5); only the transient transition layer
inlines SVG, with def ids scoped per SVG.

Non-goals: transitions or animations (see the amendment above), speaker notes, presenter view, a
second-monitor presenter, laser pointer, auto-advance, a CLI command, a new
core `Command` kind, PDF/PPTX slide export, and prototype-link navigation
(the existing prototype preview is unchanged).

## 2. Data model: `Page.hiddenInPresentation`

- IR (`packages/ir/src/types.ts`, `Page`): add
  `readonly hiddenInPresentation?: boolean;`. Absent means "shown".
- Validation (`packages/ir/src/validate.ts`, page loop): when present, the
  value must be a boolean. Otherwise it is an error with code `type.boolean`
  at `pages[i].hiddenInPresentation` (use the existing `checkBoolean`
  helper with `{ optional: true }`).
- JSONL (`packages/io/src/jsonl/records.ts`): append `"hiddenInPresentation"`
  to `PAGE_RECORD_KEYS` after `"connectorRouting"`. `parse.ts` copies it
  into the page when the key is present, using the same pattern as
  `sqlDialect`. `serialize.ts` needs no change because `flatten(page)` writes
  every present field in `PAGE_RECORD_ORDER`.
- Byte-identical round trip: the reader never adds or normalizes the field.
  A record without the key reads back without it and writes back
  byte-identically. A record with `false` keeps `false`. Only the setter in
  section 3 decides what is written for new edits.
- Older readers (forward compatibility): the existing `split()` puts an
  unknown page key into `page.extensions`, and the serializer writes it back
  unchanged. Older builds therefore preserve the flag. No migration and no
  schema-version bump are needed.
- Collab (`packages/collab/src/ydoc.ts`): `pageFields` emits the key only
  when it is defined. `pageFromY` accepts it only when
  `typeof value === "boolean"`. `syncPageToY` diffs through `pageFields`, so
  it needs no separate change.
- Page duplicate (`packages/core/src/editor/pages.ts`, the duplicate
  builder): copy `hiddenInPresentation` when it is `true`, the same way
  `tokenMode` is copied.

## 3. Editing the flag (no new Command kind)

- `packages/core/src/commands.ts`: the `updatePage` patch type gets
  `readonly hiddenInPresentation?: boolean | null`. In the handler, `true`
  or `false` sets the value and `null` removes the key. Any other value
  fails with `CommandError` code `type.boolean`, path
  `page.hiddenInPresentation`. When the patch omits the key, the previous
  value is preserved.
- Undo: only when the patch carries the key, the inverse `updatePage` restores
  `previous.hiddenInPresentation ?? null` (the same conditional pattern as
  `mode`). An undo after toggling a page that stored `false` restores
  `false` exactly.
- Facade (`packages/core/src/editor/facade/page-editing.ts`):
  `setPageHiddenInPresentation(id, hidden: boolean): boolean` applies
  `{ hiddenInPresentation: hidden ? true : null }`. It returns `false` and
  applies nothing when `(page.hiddenInPresentation === true) === hidden`.
  The toggle is one undo entry, the same as every other `updatePage`.
- Facade, same file: `exportPageSvgOf(pageId, options)` is
  `renderPageSvg(store, registry, pageId, { resolveAsset: requireAsset,
  ...options })`. It is needed because `exportPageSvg` is tied to the current
  page and `requireAsset` is protected. `exportArtboardSvg(id)` already
  accepts any frame.

## 4. Core presentation module (`packages/core/src/presentation/`)

All files are pure TypeScript with no DOM access, and each has a co-located
`*.test.ts`. The module exports through `packages/core/src/presentation/index.ts`.
It adds exactly one line, `export * from "./presentation/index.ts";`, to
`packages/core/src/index.ts`. This line is the module's public contract
(section 9 explains why it is not deferred to the wiring plan).

### 4.1 `slides.ts`

- `slideList(pages: readonly { id: PageId; hiddenInPresentation?: boolean }[]): PageId[]`
  takes pages already in tab order and returns those whose flag is not
  `true`. The structural input type keeps this independent of the IR change.
  An empty input gives `[]`.
- `startIndex(order: readonly PageId[], slides: readonly PageId[], from: PageId | null): number | null`:
  - Returns `null` when `slides` is empty (nothing to present).
  - `from === null` gives 0 (Present from the first slide).
  - If `from` is a slide, returns its index.
  - If `from` is hidden, returns the first slide after `from` in `order`. If
    there is none, it returns the last slide (the slide before it).
  - If `from` is not in `order`, returns 0.

### 4.2 `navigation.ts` (state machine)

State: `{ slides: readonly PageId[]; index: number; black: boolean; digits: string }`.
`index` is always in `[0, slides.length - 1]`, and `slides` is never empty.

`reduce(state, action) -> state`. Actions:

| Action | Effect |
| --- | --- |
| `next` / `prev` | index +1 / -1, clamped (no wrap and no end screen); clears `black` and `digits` |
| `first` / `last` | index 0 / `slides.length - 1`; clears `black` and `digits` |
| `goto n` (1-based) | index `clamp(n, 1, total) - 1`; clears `black` and `digits` |
| `toggleBlack` | flips `black`; clears `digits` |
| `digit d` (0-9) | appends to `digits`; keeps at most 4 characters (a 5th digit is ignored) |
| `enter` | if `digits` is non-empty, `goto Number(digits)` (so `0` goes to slide 1); otherwise `next` |
| `clearDigits` | clears `digits` |
| `reconcile slides'` | the slide list changed (a live edit or a remote peer). The current page stays current if it is in `slides'`; otherwise the old index is clamped into `slides'`. If `slides'` is empty, the result is `null` and the view exits |

`current(state): PageId` and `counter(state): { n: number; total: number }`
(1-based) are selectors.

### 4.3 `fit.ts`

`fitSlide(source: Size, viewport: Size, margin: number): { scale; x; y; width; height }`
places the slide in viewport CSS pixels:

- `m = min(margin, viewport.width / 4, viewport.height / 4)`, so a tiny
  viewport collapses the margin.
- `scale = min((vw - 2m) / sw, (vh - 2m) / sh)`. Upscaling is allowed.
- `width = sw * scale`, `height = sh * scale`, and the slide is centered:
  `x = (vw - width) / 2`, `y = (vh - height) / 2`.
- A non-finite or non-positive input returns a degenerate result:
  `scale 0` and a zero-size box centered in the viewport. It never returns
  NaN.

The default margin is `PRESENTATION_MARGIN = 24` CSS px.

### 4.4 `source.ts`

`slideSource(store, registry, pageId, isHidden?): { kind: "artboard"; frameId } | { kind: "page" }`.

Visibility input:

- `isHidden?: (id: ElementId) => boolean` is the effective (inherited)
  visibility predicate.
- When it is omitted, `slideSource` builds
  `createShapeContext(store, registry, 1)` (from `packages/core/src/hit-test.ts`)
  and uses `(id) => context.isHidden?.(id) === true`. This is the same
  predicate `renderArtboardSvg` checks
  (`packages/core/src/svg-export/document.ts`, `if (context.isHidden?.(id)) return null`).
- The predicate is backed by `layerStates`
  (`packages/core/src/layer-state.ts`). An element counts as hidden when its
  own `visual.hidden` is true or when any group or frame ancestor is hidden.
- The function stays pure TypeScript: it reads only the store and registry
  passed in, with no DOM and no editor state.

Artboard candidates are the elements of the page with `type === "frame"` and
`isHidden(id) === false`. Checking only the element's own `visual.hidden` is
not allowed: a frame inside a hidden group would qualify, but its artboard
export would be `null`.

- Exactly one candidate selects `{ kind: "artboard", frameId }`.
- Zero candidates, or two or more, select `{ kind: "page" }`, which uses the
  page content bounding box.
- The exporter and visibility semantics are unchanged.

`svgSize(svg: string): Size | null` reads the numeric `width` and `height`
attributes of the root `<svg>` tag that `renderElementsSvg` emits. It
returns `null` when they are missing or not positive.

## 5. Rendering (`packages/ui-solid/src/presentation/PresentationView.tsx`)

- Props: `{ editor: Editor; from: PageId | null; onExit(lastPageId: PageId): void }`.
  The parent mounts the view only after `startIndex` returned a number. If
  the slide list is empty at mount, the view calls `onExit` at once with
  `from ?? first page id`.
- Slide list: a memo over the editor revision signal
  (`createEditorSignals`) and `editor.store.listPages()` feeds `slideList`.
  A change dispatches `reconcile`.
- Slide SVG: `slideSource` picks the renderer:
  - artboard: `editor.exportArtboardSvg(frameId)`. If this returns `null`
    (for example the frame has no bounds), the view falls back to the page
    render below. A `null` artboard export is never shown as an empty slide.
  - page: `editor.exportPageSvgOf(pageId, { padding: 0 })`
  - The view calls `slideSource(editor.store, editor.registry, pageId)` with
    the default predicate.
  The source size comes from `svgSize`, and the box from `fitSlide` with the
  viewport size (window size, updated on `resize`).
- The SVG is shown as `<img src="data:image/svg+xml;charset=utf-8,...">`
  (`encodeURIComponent`). Injecting it as DOM is not allowed, because
  gradient, clip and marker ids in the exported `<defs>` would collide with
  the editor canvas, which stays mounted underneath.
- Surface: the overlay is `position: fixed; inset: 0`, with a z-index above
  all editor chrome and a black (`#000`) letterbox. The slide box has a white
  (`#ffffff`) backing behind the image.
  - An empty page (`render` returns `null`) shows a white box filling the
    margin box.
  - A black screen hides the slide and the control bar's counter is
    unchanged.
- Control bar: buttons for prev, next and exit (Esc), and the counter
  `n / total`. While a digit buffer is active, the counter shows
  `Go to: 12`. The bar appears on `pointermove` and hides after 2000 ms
  without movement. The cursor is hidden while the bar is hidden. Bar
  buttons stop click propagation, so they never also advance the slide.
- Mouse: a primary-button click on the stage (outside the bar) is `next`.
  Other buttons and the wheel are ignored.
- Focus: the overlay root has `tabindex="-1"`, is focused on mount and
  restores the previously focused element on unmount.

## 6. Keys and key isolation

A pure helper, `presentationKeyAction(event-like) -> Action | "exit" | null`
(`packages/ui-solid/src/presentation/keys.ts`), maps keys to actions:

| Keys | Action |
| --- | --- |
| ArrowRight, ArrowDown, PageDown, Space, N | `next` |
| Enter | `enter` (jump if digits are pending, else `next`) |
| ArrowLeft, ArrowUp, PageUp, Backspace, P | `prev` |
| Home / End | `first` / `last` |
| 0-9 (main row and numpad) | `digit` |
| B | `toggleBlack` |
| Escape | `exit` (clears pending digits first if any; a second Esc exits) |

Letter keys are case-insensitive. A key with Ctrl, Meta or Alt held maps to
`null`.

Isolation:

- While mounted, the view installs a `window` keydown listener in the
  capture phase.
  - For every key, including unmapped ones, it calls `preventDefault()` and
    `stopImmediatePropagation()`. The exceptions are F11 and the OS chords
    that a page cannot catch anyway.
  - No key reaches the canvas, page tabs, context menu or shell shortcuts,
    so Backspace cannot delete and N cannot create a shape.
- `apps/desktop/src/shell/window-input.ts` installs its capture listener
  before the view. It gets a `presenting(): boolean` option and returns at
  the top while it is `true`. This is required because same-target capture
  listeners run in registration order.
- Other `ui-solid` capture listeners (`PageTabs`, `ContextMenu`,
  `ShapePalette` and others) are inactive during a presentation. Their menus
  close when the presentation opens, because the shell closes open menus
  before mounting the view.

Start shortcuts (desktop `window-input.ts`):

- `F5` (no modifiers) presents from the first slide, and `Shift+F5`
  presents from the current page.
- Both are ignored when `isEditableTarget(event.target)` (from
  `packages/ui-solid/src/interaction/events.ts`) is true, when settings are
  open, or when a presentation is already active.
- When handled, they call `preventDefault()`, which also suppresses the
  WebView/browser reload on F5.
- A grep found no existing F5 binding in `apps/desktop/src` or
  `packages/ui-solid/src`.

## 7. Fullscreen (`apps/desktop/src/shell/presentation-fullscreen.ts`)

`enterPresentationFullscreen(): Promise<() => Promise<void>>` returns a
restore function. It runs in this order:

1. Tauri (when `isTauri()`): read `getCurrentWindow().isFullscreen()`, then
   call `setFullscreen(true)`. The restore function calls
   `setFullscreen(wasFullscreen)`.
2. Browser: call `document.documentElement.requestFullscreen()` when
   `document.fullscreenEnabled`. Restore calls `document.exitFullscreen()`
   only if `document.fullscreenElement` is set.
3. Any rejection or missing API resolves to a no-op restore. The fixed
   overlay already fills the viewport, so the presentation always works
   without real fullscreen.

Browser Esc: the browser consumes Esc to leave fullscreen and sends no
keydown. The host listens for `fullscreenchange`. When fullscreen that this
module entered ends while a presentation is active, the presentation exits
the same way Esc would. In Tauri, Esc reaches the page as a keydown.

Capability: append `"core:window:allow-set-fullscreen"` to
`apps/desktop/src-tauri/capabilities/default.json`. `core:default` already
includes `allow-is-fullscreen`; if a desktop build reports otherwise, also
add `"core:window:allow-is-fullscreen"`.
tauri-build regenerates `apps/desktop/src-tauri/gen/schemas/capabilities.json`
from the capability files, so that one file is expected to gain the new
permission. It is kept exactly as generated (amendment 2026-11-10,
PRS-INT-001). The other gen/schemas files (`acl-manifests.json`,
`desktop-schema.json`, `macOS-schema.json`) list the available permissions,
so they must stay byte-identical. Check with
`git diff --exit-code -- apps/desktop/src-tauri/gen/schemas ':(exclude)apps/desktop/src-tauri/gen/schemas/capabilities.json'`.

## 8. Desktop wiring and UI entry points

- `App.tsx`:
  - Holds `presenting: PageId | null | undefined` state (undefined means not
    presenting).
  - Both start functions close open menus, compute `startIndex`, return when
    it is `null`, enter fullscreen and mount `<PresentationView>`.
  - Exit runs the stored restore, unmounts the view and calls
    `editor.setCurrentPage(lastPageId)`. Selection is unchanged and the
    page's remembered view is used.
- Actions:
  - "Present" (F5) and "Present from current page" (Shift+F5) are added to
    the File menu (`apps/desktop/src/shell/FileActions.tsx`).
  - A "Present" button goes in the header next to the existing document
    actions.
  - Both actions are disabled when every page is hidden.
- Page flag UI:
  - Page tab menu (`packages/ui-solid/src/PageTabs.tsx`): a menuitem labelled
    "Hide in presentation" or "Show in presentation".
  - Page inspector (`packages/ui-solid/src/inspector/PageSection.tsx`): a
    "Show in presentation" switch.
  - Both call `editor.setPageHiddenInPresentation`.
  - A hidden page's tab gets a muted style and the title suffix
    "(hidden in presentation)".
- Exports: `packages/ui-solid/src/index.ts` exports `PresentationView`.
- Docs:
  - A new section, "## Presentation", in `docs/editing.md`, with the start
    actions, every key in section 6, the control bar, the hidden-page flag
    and the fullscreen fallback.
  - A README feature-list bullet linking to it.

## 9. Plan decomposition and ownership (input for implementation plans)

| Wave | Plan | Owns (writePaths) | Depends on |
| --- | --- | --- | --- |
| 1 | `prs-01-page-flag` | `packages/ir/src/types.ts`, `packages/ir/src/validate.ts`, `packages/io/src/jsonl/{records,parse}.ts`, `packages/collab/src/ydoc.ts`, `packages/core/src/commands.ts`, `packages/core/src/editor/pages.ts`, `packages/core/src/editor/facade/page-editing.ts`, plus new tests `packages/ir/src/page-presentation-flag.test.ts`, `packages/io/src/jsonl/page-presentation-flag.test.ts`, `packages/collab/src/page-presentation-flag.test.ts`, `packages/core/src/page-presentation-flag.test.ts` | none |
| 1 | `prs-02-core-presentation` | `packages/core/src/presentation/*` (including tests), plus the one added line in `packages/core/src/index.ts` | none |
| 1 | `prs-03-fullscreen` | `apps/desktop/src/shell/presentation-fullscreen.ts` and its test, `apps/desktop/src-tauri/capabilities/default.json` | none |
| 2 | `prs-04-presentation-view` | `packages/ui-solid/src/presentation/*` (view, keys, CSS, tests) | 01 (`exportPageSvgOf`), 02 |
| 2 | `prs-05-page-flag-ui` | `packages/ui-solid/src/PageTabs.tsx`, `packages/ui-solid/src/inspector/PageSection.tsx`, their CSS and tests | 01 |
| 3 | `prs-06-wiring` | `apps/desktop/src/App.tsx`, `apps/desktop/src/shell/window-input.ts`, `apps/desktop/src/shell/FileActions.tsx`, `packages/ui-solid/src/index.ts`, `docs/editing.md`, `README.md`, desktop CSS and tests | 03, 04, 05 |

The core barrel line is owned by plan 02, not the wiring plan. `@nodetto/core`
exposes only `./src/index.ts` (in `package.json` `exports` and the tsconfig
`paths`), so plan 04 in wave 2 could not otherwise import the module. The
line is append-only and no other plan edits that file. Plan 01 adds facade
methods on `Editor`, which need no barrel change.

## 10. Verification

- Per plan: `bun run typecheck`, `mise run lint-ts`, and `bun test <the plan's
  test files>`. Each plan's verification runs at least one test.
- Plan 01:
  - `bun test packages/io/src/jsonl` covers:
    - The golden and round-trip suites unchanged.
    - A new round trip with `true` and with `false`.
    - A file without the key, byte-identical.
  - The `packages/ir`, `packages/collab` and `packages/core`
    `page-presentation-flag.test.ts` files. The core test covers the setter,
    undo and duplicate.
- Plan 02: `bun test ./packages/core/src/presentation/source.test.ts` must
  assert all of the following:
  1. A page with one frame (no own `hidden`) inside a group with
     `visual.hidden = true`, plus an unrelated visible rectangle, returns
     `{ kind: "page" }`. `renderPageSvg` for that page is non-null and contains
     the rectangle's `data-id`.
  2. Exactly one effectively visible frame returns `{ kind: "artboard" }`, and
     `renderArtboardSvg` for it is non-null.
  3. Zero visible frames, or two or more, return `{ kind: "page" }`.
  4. A frame with its own `visual.hidden = true` beside one visible frame
     returns the visible frame as the artboard.
- Plan 03: also
  `git diff --exit-code -- apps/desktop/src-tauri/gen/schemas ':(exclude)apps/desktop/src-tauri/gen/schemas/capabilities.json'`.
- Final: `mise run lint`, `mise run test`, `mise run verify`, `bun run build`.

## 11. Risks

- Key leak: mitigated by capture-phase `stopImmediatePropagation` and the
  `presenting()` guard in `window-input.ts`. A wiring test dispatches
  Backspace and N during a presentation and asserts the document revision is
  unchanged.
- Mixed-version cloud clients: an older client's `pageFields` lacks the key,
  so its `syncPageToY` can remove the flag when that client edits the same
  page. This is accepted. The flag is presentation-only and is re-set from
  the UI.
- Large embedded images make long data URLs. This is acceptable, because
  the same SVG string is already produced for export, and the image is
  rebuilt only on slide or revision change.
- WKWebView fullscreen: the Tauri path does not depend on the DOM
  Fullscreen API, and the overlay fallback always works.
