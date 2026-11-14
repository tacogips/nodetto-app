# Pages list in the left pane

Status: accepted for implementation (session 835, workflowMode
issue-resolution, no issue reference; the runtime workflowInput of
opus-terra-design-and-implement-review-loop-session-835 is authoritative).
Baseline: HEAD 4d11670 on `fix/open-page-active`. No earlier design covers a
page list; page tabs are described only in code (`PageTabs.tsx`) and in
`docs/editing.md` "Page ordering" / "Page navigation".

## 1. Goals and non-goals

Goals

- A collapsible "Pages" section in the desktop left SidePane "Shapes and
  layers" (`apps/desktop/src/App.tsx`), placed between `ShapePalette` and
  `Layers`.
- Header `Pages (N)`; click folds/expands. The fold state persists across
  restarts as a local UI preference, never in the document or Yjs.
- Expanded: one row per page in page order with the 1-based number, the name,
  and an indicator when `hiddenInPresentation === true`. The current page row
  is highlighted and revealed whenever the current page changes, whatever
  caused the change.
- Row click / Enter / Space switches the page (`editor.setCurrentPage`).
  Up/Down/Home/End move focus between rows. F2 or double-click renames in
  place through `pageRenameDraft`.
- A per-row "..." button and the row context menu offer the page tab menu
  actions: Rename, Duplicate, Copy shapes from page..., Hide/Show in
  presentation, Delete, Move up, Move down.
- A "+" button adds a page (`editor.createPage()`), like the tab strip.
- Read-only editors show the list without "+", "...", context menu or rename.
- The list follows undo/redo and collaborator changes through
  `createEditorSignals(editor).rev()`, like `PageTabs`.

Non-goals

- No core Command kind, no IR/JSONL field, no change to page tab behavior
  (including the active-tab reveal in `PageTabs.tsx` / `page-tab-scroll.ts`).
- No drag-to-reorder. `pageTabDropAt` (`page-tab-drag.ts`) hit-tests a
  horizontal row by x halves; vertical rows would need a new hit-test, which
  the intake only allowed if `PageTabDrag` could be reused as-is. Reordering
  in the list is covered by Move up / Move down (`editor.reorderPage`).
- No change to how existing tests run. Today ui-solid tests run under bun with
  no DOM: `bunfig.toml` only preloads `bun-test-jsx-preload.ts`, which compiles
  `.tsx` with `solid-js/h`, so dynamic props are not reactive. Bun also
  resolves `solid-js` to its server build. Accepted UI interactions therefore
  get their own isolated DOM test lane (section 8.2). Pure helpers keep their
  own tests (section 8.1). Neither set replaces the other.

## 2. Shared page actions (`packages/ui-solid/src/page-actions.ts`, new)

Extracted from `PageTabs.tsx` with identical behavior so tabs and list cannot
drift. Editor-only logic; focus, menu state and `window.confirm` stay with the
caller.

- `deletePagePrompt(page, count): string` - the existing `DELETE_PROMPT` text,
  moved verbatim.
- `canDeletePage(editor): boolean` - `!editor.readOnly && pages > 1`.
- `deletePageWithConfirm(editor, id, confirm: (message) => boolean):
  "deleted" | "cancelled" | "unavailable"` - `unavailable` when
  `!canDeletePage` or the page is missing; asks `confirm` only when the page
  has elements; otherwise `editor.deletePage(id)`.
- `duplicatePageAction(editor, id): boolean` - no-op `false` when read-only,
  else `editor.duplicatePage(id)`.
- `togglePagePresentation(editor, id): void` - flips
  `hiddenInPresentation` through `editor.setPageHiddenInPresentation`.
- `pageMenuItems(editor, id, { copyShapes: boolean, axis: "horizontal" |
  "vertical" }): readonly PageMenuItem[]` - ordered descriptors
  `{ key, label, title?, disabled }` with keys `rename`, `duplicate`,
  `copyShapes` (only when `copyShapes`), `presentation`, `delete`,
  `moveBack`, `moveForward`. Labels, titles and disabled rules are copied
  from the current tab menu: Copy shapes disabled when read-only or one page;
  Presentation label from `presentationToggleLabel`, disabled when read-only;
  Delete title "Delete page" / "The last page cannot be deleted", disabled
  when `!canDeletePage`; move items disabled on the first/last page. `axis`
  only changes move labels: "Move left"/"Move right" (tabs) versus
  "Move up"/"Move down" (list).

`PageTabs.tsx` change: `remove`, `duplicate`, the presentation toggle and the
menu buttons use these helpers. Caller-side effects stay exactly as today
(`setMenuFor(null)`, `focusPage(page.id)` on cancel, `focusPage(current)` on
delete/duplicate, nothing on unavailable). Menu markup, keyboard handling,
scroll, pan, drag and the active-tab reveal are untouched. Existing
`page-tab-*.test.ts` stay green; the new `page-actions.test.ts` pins the
descriptor order, labels, titles and disabled flags for the tab axis.

## 3. List model and keyboard (`packages/ui-solid/src/page-list.ts`, new)

- `pageListRows(editor): readonly PageListRow[]` with
  `{ id, number, name, hiddenInPresentation, current }`, from
  `editor.store.listPages()` (page order) and `editor.currentPageId`;
  `number` is index + 1.
- `pageListVisibleRows(rows, open): readonly PageListRow[]` - `[]` when
  folded, so folded rows are not rendered (fold acceptance is tested here).
- `pageListKeyAction(rows, focusedId, key, modifiers, readOnly):
  PageListKeyAction | null` with kinds `focus` (ArrowUp/ArrowDown clamp at the
  ends, Home/End), `activate` (Enter, " "), `rename` (F2, null when
  read-only). Returns null when Alt/Ctrl/Meta is held, while composing, or
  for any other key. All index access uses `?.`/`?? ` (noUncheckedIndexedAccess).
- `pageListRevealTop(rowSpan, viewport): number | null` - vertical reveal for
  the list's own scroll box. Implemented by calling `pageTabRevealTarget` with
  `{ start: top, end: bottom }` and `{ scrollLeft: scrollTop, width:
  clientHeight, scrollWidth: scrollHeight }`; `page-tab-scroll.ts` is not
  changed.

## 4. Component (`packages/ui-solid/src/PageList.tsx`, `PageList.css`, new)

Props: `{ editor: Editor; open: boolean; onOpenChange(open: boolean): void;
onCopyShapesFrom?: (targetId: PageId) => void }`.

- Markup matches the Comments section in `Layers.tsx`:
  `<details class="nodetto-navigation-group nodetto-page-list" open={open}
  onToggle={...}>` with `<summary>Pages (N)</summary>`. `<details>`/`<summary>`
  supply the disclosure triangle and the expanded state to assistive tech;
  `onToggle` calls `onOpenChange(event.currentTarget.open)` only when it
  differs from `props.open`.
- Rows render only when open (`pageListVisibleRows`). Container
  `role="listbox"` `aria-label="Pages"`; each row is a `role="option"` element
  with `aria-selected` for the current page, roving `tabindex` (focused row,
  else current row, is 0), number, name, and a hidden indicator with
  `PRESENTATION_HIDDEN_TITLE_SUFFIX` in its title plus the
  `nodetto-page-list-hidden` class.
- The row box has its own vertical scroll (`max-height`, `overflow-y: auto`)
  so a long list does not push Layers away. Reveal: an effect on
  `activeId` (memo over `signals.rev()` + `editor.currentPageId`, as in
  `PageTabs`) runs in `queueMicrotask`, finds the row, and sets only the row
  box's `scrollTop` from `pageListRevealTop`. No `scrollIntoView`, no focus
  change; folded means no row, so nothing scrolls.
- Row keydown: apply `pageListKeyAction`; for a non-null action call
  `preventDefault()` and `stopPropagation()` so canvas shortcuts do not see
  it. Rename input stops propagation of every key (as in `PageTabs`), Enter
  commits through `pageRenameDraft`, Escape cancels, blur commits; an
  `unavailable` result shows the same alert text as the tabs.
- "..." button and `contextmenu` on a row open an inline menu
  (`role="menu"`, reusing `.nodetto-menu-item`) built from
  `pageMenuItems(editor, id, { copyShapes: !!onCopyShapesFrom, axis:
  "vertical" })`. Up/Down/Home/End move between enabled items, Escape closes
  and refocuses the row, outside pointerdown closes (same as tabs). Actions:
  rename -> start rename; duplicate/delete/presentation -> `page-actions.ts`
  (delete passes `window.confirm`); copyShapes -> `onCopyShapesFrom(id)`;
  move -> `editor.reorderPage(id, -1 | 1)`.
- Read-only (`signals.rev()` + `editor.readOnly`): hides "+", "...", ignores
  `contextmenu`, F2 and double-click, and closes any open rename or menu.
- `PageList.css` holds only list-specific rules (row layout, number column,
  active highlight, hidden indicator, max-height). Section chrome comes from
  the existing `.nodetto-navigation-group` rules in
  `apps/desktop/src/square-chrome.css`.

## 5. Preference (`apps/desktop/src/settings/preferences.ts`)

Add `readonly pagesListOpen: boolean` to `EditorPreferences`, default `true`,
parsed with the existing `bool()` helper (add the key to its union). Stored
under the existing `nodetto.editor.preferences.v1` key. Old stored values
without the key load as `true`; a non-boolean value falls back to `true`.
Nothing is written to the document.

## 6. Desktop wiring (`apps/desktop/src/App.tsx`, `packages/ui-solid/src/index.ts`)

- `index.ts`: `export { PageList, type PageListProps } from "./PageList.tsx";`.
- `App.tsx`: `const [pagesListOpen, setPagesListOpen] =
  createSignal(preferences.pagesListOpen)`; include it in the existing
  `storeEditorPreferences` effect; mount `<PageList editor open
  onOpenChange={setPagesListOpen} onCopyShapesFrom={...}>` between
  `ShapePalette` and `Layers`. `onCopyShapesFrom` uses the same open path as
  the PageTabs prop (`setCopyShapesTarget`), so `CopyShapesDialog` hosting is
  unchanged.
- `docs/editing.md`: a "Pages list" paragraph under "Page navigation"
  (fold, numbers, hidden indicator, keyboard, menu, read-only).
  `README.md` only if it already lists page features.

## 7. Plan decomposition (guidance for step 4)

- pl-01 page-actions: `page-actions.ts`, `page-actions.test.ts`,
  `PageTabs.tsx` (extraction only). Wave 1.
- pl-02 preference: `preferences.ts`, `preferences.test.ts`. Wave 1.
- pl-03 page-list: `page-list.ts`, `page-list.test.ts`, `PageList.tsx`,
  `PageList.css`, and the DOM test lane from section 8.2:
  `packages/ui-solid/src/PageList.test.tsx`,
  `packages/ui-solid/src/test-dom/setup.ts`,
  `packages/ui-solid/src/test-dom/page-list.dom.tsx`, root `package.json`
  (devDependencies) and `bun.lock`. Wave 2, depends on pl-01
  (`pageMenuItems`, delete/duplicate helpers). pl-03 is the only plan that
  edits `package.json` or `bun.lock`.
- pl-04 wiring: `index.ts`, `App.tsx`, `docs/editing.md`, `README.md`.
  Depends on pl-02 and pl-03.

Every plan: artifactRoots `["target", "apps/desktop/dist"]`; verification
`bun run typecheck && mise run lint-ts && bun test <touched test files>`.
For pl-03 that is `bun test packages/ui-solid/src/page-list.test.ts
packages/ui-solid/src/PageList.test.tsx`, which runs the DOM lane.
pl-04 adds `mise run verify` and `bun run build`.

## 8. Verification

### 8.1 Helper tests (root `bun test`, no DOM)

- `page-actions.test.ts`: descriptor order, labels, titles and disabled flags
  for both axes, read-only, a single page, and the first/last page.
  `deletePageWithConfirm` returns `unavailable`, `cancelled` (no change) or
  `deleted` (one undo restores the page). Confirm is not asked for an empty
  page. Duplicate and the presentation toggle are one undo step each and
  no-ops when read-only.
- `page-list.test.ts`: rows come in page order with 1-based numbers, the
  hidden flag and exactly one `current`. Rows follow `reorderPage`, rename,
  undo and `setCurrentPage`. `pageListVisibleRows` is empty when folded.
  `pageListKeyAction` covers Up/Down clamping, Home/End, Enter and Space,
  F2 only when editable, and modifiers returning null. `pageListRevealTop`
  covers the above, below and already-visible cases.
- `preferences.test.ts`: `pagesListOpen` defaults to true, round-trips false,
  and ignores non-boolean values.
- Existing `page-tab-*.test.ts`, `page-rename.test.ts` and
  `page-presentation-toggle.test.ts` stay green.

### 8.2 Component interaction tests (DOM lane, owned by pl-03)

Each accepted UI assertion is checked against the rendered `PageList`, using
dispatched DOM events and a real `Editor`. The lane runs in a child process,
so the global test setup (`bunfig.toml`, `bun-test-jsx-preload.ts`) and every
existing test stay unchanged.

Infrastructure (all paths pre-authorized for pl-03):

- Root `package.json` devDependencies, at exact versions recorded in
  `bun.lock`: `happy-dom` (DOM globals), plus `@babel/core`,
  `babel-preset-solid` and `@types/babel__core`. Of these, `@babel/core`,
  `babel-preset-solid` and `@types/babel__core` are already installed
  transitively through `vite-plugin-solid`. Declaring them at the root
  guarantees they resolve from `packages/ui-solid`.
- `packages/ui-solid/src/test-dom/setup.ts`: a preload that does three things.
  It registers happy-dom globals (`window`, `document`, events, `HTMLElement`)
  before any component import. It adds a Bun runtime plugin whose `onResolve`
  maps `solid-js`, `solid-js/web` and `solid-js/store` to their browser
  builds, so effects and `render` are reactive. Its `onLoad`, for
  `packages/ui-solid/src/**/*.tsx`, compiles with `@babel/core` and
  `babel-preset-solid` (`generate: "dom"`, parser plugins `typescript` and
  `jsx`) and returns loader `ts`, which matches the Vite build.
  `window.confirm` is stubbed per scenario.
- `packages/ui-solid/src/test-dom/page-list.dom.tsx`: a plain script, not a
  `*.test.*` file, so root `bun test` never discovers it. It mounts
  `PageList` with `render` from `solid-js/web`, runs the named scenarios
  below with `node:assert/strict`, prints `ok <scenario>` for each, and exits
  non-zero on the first failure. It disposes the render root after each
  scenario.
- `packages/ui-solid/src/PageList.test.tsx`: the root-discovered entry and the
  only file named in verification commands. It contains no JSX. It runs
  `bun --preload ./test-dom/setup.ts ./test-dom/page-list.dom.tsx` through
  `Bun.spawnSync`, with cwd `packages/ui-solid/src`. It asserts exit code 0,
  asserts that stdout contains `ok <scenario>` for every scenario name below,
  and prints the child's stdout and stderr on failure. `mise run test`
  (`bun test`) therefore runs the lane with no `mise.toml` change.

Required scenarios. Each asserts through the DOM and editor state, never by
calling helpers directly:

1. `rows`: three pages with page 2 `hiddenInPresentation`. Rows appear in
   page order, the number cells read 1/2/3, the names match, and only row 2
   carries `nodetto-page-list-hidden` plus the hidden title suffix. The
   summary reads `Pages (3)`.
2. `highlight`: the current row has `aria-selected="true"` and the active
   class, and no other row does. `editor.setCurrentPage` from outside (as tabs
   or a link would) moves the highlight. A rename followed by
   `editor.undo()` and `editor.redo()` updates the row text, which proves the
   rev signal drives the list.
3. `click`: clicking row 3 makes `editor.currentPageId` row 3's id.
4. `keyboard`: on a focused row 1, `ArrowDown` moves `document.activeElement`
   to row 2 without changing the current page. `ArrowUp` moves focus back.
   `Enter` on row 2 activates it, and `Space` on row 3 activates it. Handled
   keydowns are `defaultPrevented`, and a `window` keydown listener does not
   receive them (propagation stopped).
5. `fold`: with `open` true, rows are present. Setting the `<details>` closed
   and dispatching `toggle` calls `onOpenChange(false)` exactly once.
   Re-rendering with `open` false removes every row. Switching back to true
   restores them and reports `onOpenChange(true)` on the next toggle.
6. `read-only`: after `editor.setReadOnly(true)` the "+" and "..." buttons
   are absent. `F2`, double-click and `contextmenu` create no rename input
   and no menu. Rows still render, and click still switches the page.
7. `rename`: `F2` on a row shows an input holding the current name. Typing a
   new name and pressing `Enter` writes it to the store, the row shows it, and
   one `editor.undo()` restores the old name. Double-click also opens the
   input, and `Escape` cancels without writing. Renaming the page from outside
   while the draft is open makes `Enter` show the `unavailable` alert text
   and leaves the external name in place, which proves `pageRenameDraft` is
   used.
8. `menu`: "..." opens a `role="menu"` whose item labels equal
   `pageMenuItems(..., { axis: "vertical" })`. Duplicate adds a page;
   "Copy shapes from page..." calls `onCopyShapesFrom(id)`; "+" adds a page.

Reveal scrolling depends on layout geometry, which happy-dom does not
compute. The reveal math is covered by the `pageListRevealTop` helper test.
The DOM lane only checks that a page change does not move focus away from the
active element.

### 8.3 Commands

- pl-03: `bun run typecheck && mise run lint-ts && bun test
  packages/ui-solid/src/page-list.test.ts
  packages/ui-solid/src/PageList.test.tsx`. Both files must execute tests,
  and the second must run all eight DOM scenarios.
- Final (pl-04): `bun run typecheck`, `mise run lint`, `mise run test`,
  `mise run verify`, then `bun run build`. These must all exit 0.
  `bun run build` proves compilation and bundling only. It is not interaction
  verification; interactions are verified only by section 8.2.

## 9. Risks

- Tab regression from the extraction: limited to the action bodies and menu
  item rendering. The descriptors copy the current strings and rules and are
  pinned by tests.
- Shortcut collisions: handled keys stop propagation on rows, and the rename
  input stops all keys. Scenario 4 asserts this.
- Pane scroll jumps: reveal only sets the list box's `scrollTop`.
- DOM lane fidelity: happy-dom does not compute layout, so reveal geometry is
  helper-tested only. The Solid compile path (babel-preset-solid) matches
  the Vite build, not the `solid-js/h` test preload.
- New devDependencies need `bun install` with registry access during pl-03.
  If install or the harness cannot work, pl-03 must report itself blocked. It
  must not drop scenarios or fall back to helper-only coverage.
