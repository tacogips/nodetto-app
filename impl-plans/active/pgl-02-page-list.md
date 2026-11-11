# pgl-02-page-list

- planId: pgl-02-page-list
- progressPath: impl-plans/progress/pgl-02-page-list.md
- wave: 2
- dependsOn: pgl-01-page-actions (`pageMenuItems`, `deletePageWithConfirm`,
  `duplicatePageAction`, `togglePagePresentation`)
- Design: `design-docs/specs/design-page-list.md` sections 3, 4, 8.1 and 8.2
  (design plan id pl-03)
- writePaths:
  - in `packages/ui-solid/src/`: `page-list.ts`, `page-list.test.ts`,
    `PageList.tsx`, `PageList.css`, `PageList.test.tsx`,
    `test-dom/setup.ts`, `test-dom/page-list.dom.tsx`, and
    `test-dom/bunfig.toml` (only if needed)
  - `package.json`, `bun.lock`
  - `impl-plans/progress/pgl-02-page-list.md`
  - `tmp/pgl-s835/pgl-02-page-list`
  - `target`, `apps/desktop/dist`
  - The manifest lists each path separately.
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Intent and context

Build the Pages list component, its pure helpers, and an isolated DOM test
lane that checks every accepted UI interaction through the rendered DOM.
Mounting happens later, in pgl-03.

Context: the root `bunfig.toml` preloads `bun-test-jsx-preload.ts`
(`solid-js/h`, whose props are not reactive). Under bun, `solid-js` resolves
to its server build, and no DOM library is installed.

Non-goals:

- No drag-to-reorder.
- No edits to `index.ts`, `App.tsx`, the root `bunfig.toml`, `mise.toml`,
  `PageTabs.tsx` or `page-actions.ts`.
- No change to how existing tests run.

## File-level changes

`page-list.ts` is pure, with no Solid imports. Imitate
`layer-keyboard.ts:layerNavigation`, and use `?.`/`??` for every index
access.

- `PageListRow`: `{ id: PageId; number: number; name: string;
  hiddenInPresentation: boolean; current: boolean }`.
- `pageListRows(editor)`: built from `store.listPages()` and
  `currentPageId`.
- `pageListVisibleRows(rows, open)`: returns `[]` when the section is closed.
- `pageListKeyAction(rows, focusedId, key, mods: { alt; ctrl; meta;
  composing }, readOnly)` returns:
  - `{ kind: "focus", id }` for ArrowUp/ArrowDown (clamped) and Home/End
  - `{ kind: "activate", id }` for Enter and `" "`
  - `{ kind: "rename", id }` for F2, only when not read-only
  - `null` for anything else, or when a modifier is held or composing
- `pageListRevealTop({ top, bottom }, { scrollTop, clientHeight,
  scrollHeight })`: delegates to `pageTabRevealTarget` with the fields
  mapped. Do not edit `page-tab-scroll.ts`.

`PageList.tsx` exports `PageList` and `PageListProps`:

```ts
{ editor: Editor; open: boolean; onOpenChange: (open: boolean) => void;
  onCopyShapesFrom?: (id: PageId) => void }
```

Imitate `PageTabs.tsx`: `createEditorSignals`, the rename state and input
`onKeyDown` with `pageRenameDraft` (including the `unavailable` alert text),
the menu keyboard, and the outside-pointerdown close.

- Section: `<details class="nodetto-navigation-group nodetto-page-list"
  open={props.open}>`. `onToggle` calls `onOpenChange(el.open)` only when
  `el.open !== props.open`. The summary reads `Pages ({count})`.
- Keyed rendering (PGL-PLAN-001):
  - Render rows with `<For each={pageIds()}>`, where `pageIds` is a
    `createMemo` of `PageId` strings. This is the pattern at
    `PageTabs.tsx:325`.
  - Each row reads its data through a per-id accessor, for example a memo
    `Map` built from `pageListRows(editor)` and looked up by id.
  - Never use `<For each={pageListRows(...)}>` or For over any fresh object
    array.
  - Render menu items with For over `PageMenuItemKey` strings plus a per-key
    lookup, or with `<Index each={menuItems()}>`. Never use
    `<For each={menuItems()}>`.
- Rows render only when open, inside a `role="listbox"` container with
  `aria-label="Pages"`. Each row has:
  - `role="option"`, `data-page-list-row={id}`, and a roving `tabindex`
  - `aria-selected` and class `nodetto-page-list-active` on the current page
  - `.nodetto-page-list-number` and `.nodetto-page-list-name`
  - for hidden pages: class `nodetto-page-list-hidden` and a title ending
    in `PRESENTATION_HIDDEN_TITLE_SUFFIX`
- Row events:
  - click: `setCurrentPage`
  - keydown: for a non-null `pageListKeyAction`, call `preventDefault` and
    `stopPropagation`, then focus or activate
  - double-click and F2: rename
  - `contextmenu`: open the menu (with `preventDefault`) when editable
- Editing controls, all absent when read-only:
  - per row, a "..." button `.nodetto-page-list-menu-button`
  - a `role="menu"` built from `pageMenuItems(..., { axis: "vertical",
    copyShapes: Boolean(props.onCopyShapesFrom) })`, with the same dispatch
    as pgl-01; delete uses `(m) => window.confirm(m)`
  - a "+" button `.nodetto-page-list-add` that calls `createPage()`
- When the editor becomes read-only, close any open rename or menu.
- Reveal: a memo over `signals.rev()` and `currentPageId`, then an effect
  that in `queueMicrotask` sets only the row box's `scrollTop`. Never call
  `scrollIntoView` or `focus()` here.
- `PageList.css` holds only the row layout, `max-height` with
  `overflow-y: auto`, and the active and hidden styles, using the
  `--nodetto-*` variables.

DOM lane (design 8.2):

- `package.json` devDependencies, with exact versions:
  - `happy-dom` (current release)
  - `@babel/core` 7.29.7, `babel-preset-solid` 1.9.15 and
    `@types/babel__core` 7.20.5, matching `node_modules/.bun`
  - then run `bun install` to regenerate `bun.lock`
- `test-dom/setup.ts` does three things:
  - registers happy-dom globals before any component import
  - adds a `Bun.plugin` whose `onResolve` maps `^solid-js$`,
    `^solid-js/web$` and `^solid-js/store$` to `solid-js/dist/solid.js`,
    `solid-js/web/dist/web.js` and `solid-js/store/dist/store.js` through
    `Bun.resolveSync` (these subpaths are exported)
  - gives the same plugin an `onLoad` for
    `/packages\/ui-solid\/src\/.*\.tsx$/` that runs babel `transformAsync`
    with `presets: [["babel-preset-solid", { generate: "dom" }]]` and
    `parserOpts.plugins: ["typescript", "jsx"]`, and returns `loader: "ts"`
- `test-dom/page-list.dom.tsx` is a plain script, not a test file. It runs
  the scenarios `rows`, `highlight`, `click`, `keyboard`, `fold`,
  `read-only`, `rename` and `menu` exactly as design 8.2 specifies, using
  `render`, `node:assert/strict` and dispatched events. On top of design
  8.2, these focus-identity checks are required:
  - `keyboard`: capture the row-2 element, focus it, and press Enter. Then
    `document.activeElement` must be that same node (`===`), and its
    `data-page-list-row` must equal row 2's id. A following ArrowDown must
    focus row 3.
  - `click`: after clicking a focused row, the same node is still the active
    element.
  - `rename`: after an unrelated editor change while the input is open (for
    example `setPageHiddenInPresentation` on another page), the same input
    node is still connected and still focused.

  The script prints
  `ok <name>` after each, disposes the root, and calls `process.exit(1)` on
  the first failure.
- `PageList.test.tsx` contains no JSX. One test calls
  `Bun.spawnSync([process.execPath, "--preload", "./test-dom/setup.ts",
  "./test-dom/page-list.dom.tsx"])` with cwd `import.meta.dir`. It expects
  `exitCode` 0 and all 8 `ok <name>` lines, and puts stdout and stderr in
  the failure message.

## Pitfalls

- The child process must not load the root preload. If Bun picks up the
  root `bunfig.toml`, add `test-dom/bunfig.toml` with no preload and pass
  `--config`. Record which approach was used in the progress log.
- Every one of these bumps `signals.rev` (`adapter.ts:31`, `core.ts:241`):
  `setCurrentPage`, rename, undo, and remote edits. Row and rename-input DOM
  nodes must survive a rev change, and activating a row must not move focus.
  Object-keyed For breaks both.
- Rows must not exist while folded, so the reveal never scrolls the pane.
  The rename input stops propagation of every key, and blur commits.
- happy-dom may not toggle `<details>` when the summary is clicked, so
  `fold` sets `open` and dispatches `toggle`, as the design specifies.
- Never weaken or skip a scenario. If the harness cannot work, mark the
  plan blocked with evidence.

## Tests (`page-list.test.ts`, real Editor)

- 3 pages, page 2 hidden -> numbers 1,2,3; only row 2 is hidden; exactly
  one row is current.
- `reorderPage`, rename and `undo` -> the rows reflect each change.
- folded -> `pageListVisibleRows` returns `[]`.
- Up on the first row and Down on the last row stay put; Home/End jump to
  the ends.
- Enter and Space -> `activate`.
- F2 -> `rename`, or `null` when read-only.
- ctrl, meta, alt or composing -> `null`.
- `pageListRevealTop`: a row above, a row below, and an already visible row
  (null).

## Verification (each command must exit 0; save logs under `tmp/pgl-s835/pgl-02-page-list/`)

1. `bun test packages/ui-solid/src/page-list.test.ts packages/ui-solid/src/PageList.test.tsx`
   must report 0 failures, and the PageList test must see all 8 scenarios.
2. `bun run typecheck`
3. `bunx biome check packages/ui-solid/src/page-list.ts packages/ui-solid/src/page-list.test.ts packages/ui-solid/src/PageList.tsx packages/ui-solid/src/PageList.css packages/ui-solid/src/PageList.test.tsx packages/ui-solid/src/test-dom`
4. `bun test packages/ui-solid/src/page-actions.test.ts packages/ui-solid/src/page-rename.test.ts`
5. `mkdir -p tmp/pgl-s835/pgl-02-page-list && bunx tsc --noEmit --noUncheckedIndexedAccess -p tsconfig.json > tmp/pgl-s835/pgl-02-page-list/strict-index.log 2>&1; ! grep 'error TS' tmp/pgl-s835/pgl-02-page-list/strict-index.log | grep -e 'page-list.ts' -e 'PageList.tsx' -e 'test-dom/'`

## Done criteria

- All five commands exit 0, and the progress log records each command, its
  exit code and its log path.
- `git diff 4d11670 -- bunfig.toml mise.toml packages/ui-solid/src/PageTabs.tsx packages/ui-solid/src/page-tab-scroll.ts`
  shows no change from this plan.
- `package.json` changes only its `devDependencies`.
- For every edit: re-read the file fresh first, record pre and post
  `git hash-object` values, and stop if the file has drifted unexpectedly.

## Amendment 2026-11-11 (blocked-wave-scope-or-contract, round 1)

Blocker: wave 002 checkpoint amendment from previous checkpoint e599787. It
needs an approved install location for the DOM test dependencies:
`node_modules/happy-dom` is absent, and `bun install` writes outside the
artifact roots `target` and `apps/desktop/dist`.

Decision. This authorizes the dependency install output only. Design, plan
scope, contracts and scenarios are unchanged.

- New `writePaths` that are also `artifactRoots`. They hold generated install
  output only and are never authored or committed (gitignored):
  - `node_modules`
  - `packages/ui-solid/node_modules`
  - `packages/core/node_modules`
  - `packages/io/node_modules`
  - `packages/ir/node_modules`
  - `packages/collab/node_modules`
  - `apps/desktop/node_modules`
  - `apps/cli/node_modules`
- Install method. Run one command from the repository root:
  `bun add --dev --exact happy-dom@<latest-stable> @babel/core@7.29.7 babel-preset-solid@1.9.15 @types/babel__core@7.20.5`.
  - It may only change `package.json` `devDependencies`, `bun.lock`, and the
    `node_modules` roots listed above.
  - Do not run `bun install --force`, upgrade other packages or edit
    `overrides`.
  - If the command changes any other dependency version in `bun.lock`, revert
    with `git checkout -- package.json bun.lock`, record the evidence, and
    report blocked.
- Tracked audit manifest:
  `tmp/pgl-s835/pgl-02-page-list/toolchain.json`. It sits inside the
  existing writePath `tmp/pgl-s835/pgl-02-page-list` and records:
  - the `bun --version` output
  - the exact install command and its exit code
  - the resolved `happy-dom` version
  - `git hash-object bun.lock` and `package.json`, before and after
  - the sha256 of `node_modules/happy-dom/package.json`
- Module resolution. Root `node_modules` serves `happy-dom`, `@babel/core`
  and `babel-preset-solid` to `packages/ui-solid/src/test-dom/setup.ts` and
  to the child process started by `PageList.test.tsx`. Nothing is installed
  under `target` or `apps/desktop/dist`.
- If registry access is unavailable, record the failing command, its exit
  code and its log in `toolchain.json`, then report blocked. Do not vendor
  packages, and do not fall back to helper-only coverage.
- Added done criterion: `node_modules/happy-dom/package.json` exists,
  `toolchain.json` records a zero install exit code, and
  `git diff e599787 -- package.json` shows only `devDependencies` lines.
- Dependency admission. The landed pgl-01-page-actions is now recorded in
  the manifest's `acceptedDependencies` (commit e599787 plus the wave-001
  integration acceptance). This plan's manifest `dependsOn` is therefore
  `[]` and its wave is 1. The page-actions contract it consumes is
  unchanged.
