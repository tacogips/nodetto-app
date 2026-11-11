# pgl-01-page-actions

- planId: pgl-01-page-actions
- progressPath: `impl-plans/progress/pgl-01-page-actions.md`
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-page-list.md` sections 2 and 8.1
  (design plan id pl-01)
- writePaths:
  - in `packages/ui-solid/src/`: `page-actions.ts` (new),
    `page-actions.test.ts` (new) and `PageTabs.tsx` (extraction only)
  - `impl-plans/progress/pgl-01-page-actions.md`
  - `tmp/pgl-s835/pgl-01-page-actions`
  - `target`, `apps/desktop/dist`
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Intent and context

The Pages list (pgl-02) must offer the same actions as the page tab menu
without duplicating its logic. This plan moves the tab menu's editor-side
logic and item descriptors from `PageTabs.tsx` into a pure helper. The tab
strip must behave exactly as it does at HEAD 4d11670.

## Non-goals

- No change to PageTabs markup order, keyboard handling, pan/fling, drag,
  focus calls, or menu positioning.
- No change to the active-tab reveal: leave the `activeId` memo and its
  effect byte-identical.
- Do not edit `page-tab-scroll.ts`, `page-tab-drag.ts`, `page-rename.ts`,
  `page-presentation-toggle.ts` or `index.ts`.
- Add no Command kind and no IR field.

## Contract (pgl-02 imports these exact names)

```ts
export type PageMenuItemKey = "rename" | "duplicate" | "copyShapes"
  | "presentation" | "delete" | "moveBack" | "moveForward";
export interface PageMenuItem { readonly key: PageMenuItemKey;
  readonly label: string; readonly title?: string; readonly disabled: boolean }
deletePagePrompt(page: Page, count: number): string
canDeletePage(editor: Editor): boolean
deletePageWithConfirm(editor, id, confirm: (message: string) => boolean):
  "deleted" | "cancelled" | "unavailable"
duplicatePageAction(editor, id): boolean
togglePagePresentation(editor, id): void
pageMenuItems(editor, id, options: { copyShapes: boolean;
  axis: "horizontal" | "vertical" }): readonly PageMenuItem[]
```

## File-level changes

`page-actions.ts`: plain functions, no Solid imports. Imitate
`page-rename.ts:pageRenameDraft`.

- `deletePagePrompt`: the text of `DELETE_PROMPT`, moved verbatim, including
  the element/elements plural.
- `canDeletePage`: `!editor.readOnly && listPages().length > 1`.
- `deletePageWithConfirm`:
  - return `unavailable` when `!canDeletePage` or the page is missing
  - call `confirm` only when `getPageElements(id).length > 0`; if it returns
    false, return `cancelled` without mutating anything
  - otherwise call `editor.deletePage(id)` and return `deleted`
- `duplicatePageAction`: return false when read-only, else
  `editor.duplicatePage(id) !== null`.
- `togglePagePresentation`: call `setPageHiddenInPresentation(id,
  !(hiddenInPresentation === true))`. Do nothing for a missing page.
- `pageMenuItems` returns the items in this order:
  1. rename: label "Rename", title "Rename page", disabled false
  2. duplicate: label "Duplicate", title "Duplicate page and everything on
     it", disabled false
  3. copyShapes, only when `options.copyShapes`: label
     "Copy shapes from page...", disabled `readOnly || pages <= 1`
  4. presentation: label `presentationToggleLabel(hidden)`, disabled
     `readOnly`
  5. delete: label "Delete", title "Delete page" or "The last page cannot be
     deleted", disabled `!canDeletePage`
  6. moveBack: label "Move left" (horizontal) or "Move up" (vertical),
     disabled on the first page
  7. moveForward: label "Move right" or "Move down", disabled on the last
     page

  Find the first and last page with `listPages()[0]?.id` and
  `.at(-1)?.id`.

`PageTabs.tsx`:

- Remove `DELETE_PROMPT`.
- `remove(page)` keeps `setMenuFor(null)`, then calls
  `deletePageWithConfirm(props.editor, page.id, (m) => window.confirm(m))`.
  - `cancelled`: `focusPage(page.id)`
  - `deleted`: `focusPage(props.editor.currentPageId)`
  - `unavailable`: do nothing
- `duplicate` uses `duplicatePageAction`.
- `canDelete` must still read `readOnly()` and `pages()` so it stays
  reactive.
- Render the menu items so their DOM survives revision changes (finding
  PGL-PLAN-001):
  - `menuItems` is a `createMemo` that reads `signals.rev()` and calls
    `pageMenuItems(..., { copyShapes: Boolean(props.onCopyShapesFrom),
    axis: "horizontal" })`.
  - Render `<For each={menuKeys()}>`, where `menuKeys` is a memo of the
    `PageMenuItemKey` strings. Strings compare equal across revisions, so
    For reuses the nodes. Each button reads its label, title and disabled
    reactively from `menuItems().find((item) => item.key === key)`.
  - This mirrors how tabs are keyed by the `pageIds` string memo
    (`PageTabs.tsx:325`).
  - Never write `<For each={menuItems()}>`. `pageMenuItems` returns fresh
    objects on every revision, so For would rebuild every button on each
    `notify` (`adapter.ts:31`) and drop the focus of an open menu, which is a
    regression from HEAD's static buttons. `<Index each={menuItems()}>` is
    an acceptable alternative.
- Each button keeps `role="menuitem"`, `tabindex="-1"`, the
  `nodetto-menu-item` class, its title if present, and `disabled`.
- Dispatch on `key`:
  - rename: `startRename(id)`
  - duplicate: `duplicate(page())`
  - copyShapes: `onCopyShapesFrom?.(id)`, then `setMenuFor(null)`
  - presentation: `togglePagePresentation`, then `setMenuFor(null)`
  - delete: `remove(page())`
  - moveBack/moveForward: `reorderPage(id, -1 or 1)`, then
    `setMenuFor(null)` and `focusPage(id)`

## Pitfalls

- `openMenu` focuses the first enabled `[role=menuitem]` in a microtask.
  Do not wrap the items in an extra `Show`.
- Keep the item order unchanged: menu keyboard navigation uses DOM order.
- A focused menu button must survive any editor change while the menu is
  open, as it does at HEAD. The key-string render above guarantees this.
- Do not pass `window.confirm` unbound.
- Do not change the outside-pointerdown close.

## Tests (`page-actions.test.ts`, real `new Editor()` as in `page-rename.test.ts`)

- 3 pages, middle page, horizontal, copyShapes -> 7 keys in order, labels
  and titles exact, all enabled.
- vertical -> the move labels are "Move up" and "Move down".
- copyShapes false -> no copyShapes item.
- first page -> moveBack disabled; last page -> moveForward disabled.
- single page -> delete disabled with the last-page title, and copyShapes
  disabled.
- `setReadOnly(true)` -> copyShapes, presentation and delete disabled;
  `duplicatePageAction` returns false and the snapshot is unchanged.
- hidden page -> label "Show in presentation"; the toggle unhides it, and
  one `undo()` restores it.
- delete an empty page -> `deleted`, confirm is not called, and one `undo()`
  restores the snapshot.
- a page with 1 element, confirm returns false -> `cancelled`, no change,
  and the prompt equals `deletePagePrompt(page, 1)`.
- single page -> `unavailable`.

## Verification (each command must exit 0; save logs under `tmp/pgl-s835/pgl-01-page-actions/`)

1. `bun test packages/ui-solid/src/page-actions.test.ts packages/ui-solid/src/page-tab-drag.test.ts packages/ui-solid/src/page-tab-scroll.test.ts packages/ui-solid/src/page-rename.test.ts packages/ui-solid/src/page-presentation-toggle.test.ts`
   must report 0 failures.
2. `bun run typecheck`
3. `bunx biome check packages/ui-solid/src/page-actions.ts packages/ui-solid/src/page-actions.test.ts packages/ui-solid/src/PageTabs.tsx`
4. `mkdir -p tmp/pgl-s835/pgl-01-page-actions && bunx tsc --noEmit --noUncheckedIndexedAccess -p tsconfig.json > tmp/pgl-s835/pgl-01-page-actions/strict-index.log 2>&1; ! grep 'error TS' tmp/pgl-s835/pgl-01-page-actions/strict-index.log | grep -e 'page-actions.ts' -e 'PageTabs.tsx'`

## Done criteria

- All four commands exit 0.
- `git grep -n DELETE_PROMPT packages/ui-solid/src/PageTabs.tsx` returns
  nothing.
- `git diff 4d11670 -- packages/ui-solid/src/page-tab-scroll.ts` is empty.
- `git grep -n "For each={menuItems()}" packages/ui-solid/src/PageTabs.tsx`
  returns nothing.
- The `activeId` reveal effect is byte-identical.
- The progress log, the only progress file this worker edits, records each
  command, its exit code and its log path, plus per-edit pre and post
  `git hash-object` values after a fresh re-read. Stop on unexpected drift.
