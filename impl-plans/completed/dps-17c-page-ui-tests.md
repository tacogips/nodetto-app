# dps-17c-page-ui-tests

- planId: dps-17c-page-ui-tests (session 864, wave 1, dependsOn: none)
- Design: `design-docs/specs/design-document-pages-snippets.md` sections
  5.4 and 10.2.
- Parent: `impl-plans/active/dps-17-wiring.md` "Tests" (`document-wiring.test.ts` (ui)).
- writePaths:
  - `packages/ui-solid/src/document-wiring.test.ts` (new)
  - extension only, touched only if they fail because of the new
    actions or tiles:
    - `packages/ui-solid/src/app-palette.test.ts`
    - `packages/ui-solid/src/shortcuts.test.ts`
    - `packages/ui-solid/src/page-actions.test.ts`
    - `packages/ui-solid/src/viewer-actions.test.ts`
    - `packages/ui-solid/src/interaction-keyboard-menus.test.ts`
  - `impl-plans/progress/dps-17c-page-ui-tests.md`
  - `tmp/dps-s864/dps-17c-page-ui-tests`
  - `target` (artifact root only)
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

The palette tiles and page-frame actions are committed, but nothing tests
them:

- palette tiles: `shape-palette.ts:136-143`;
- actions `addPageFrame`, `nextPageFrame` and `previousPageFrame`, with
  `PageDown` for next and `PageUp` for previous: `shortcuts.ts:466-495`;
- viewer whitelist: `shortcuts.ts:695-711`;
- PageUp/PageDown canvas key handler guarded by `isEditableTarget` and
  presentation: `Canvas.tsx:343-365`.

Add DOM-free tests. Imitate the `makeContext` pattern in
`packages/ui-solid/src/shortcuts.test.ts:19-`.

## Non-goals

- No product-code edits (`shortcuts.ts`, `Canvas.tsx`, `shape-palette.ts`
  and `ShapePalette.tsx` are not in writePaths). If a test shows a product
  defect, record it in the progress log as a repair finding for
  dps-17-wiring and stop. Do not weaken the test.
- No DOM tests. The Canvas key guard is covered by citation, not by a
  DOM test.

## Test cases (`document-wiring.test.ts`, real `Editor`) (situation -> expected)

- Palette: `COMMON_SHAPES` has, in this order, Code snippet
  (`Tool.CodeSnippet`), Markdown snippet (`Tool.MarkdownSnippet`) and
  Page (`action: "add-page-frame"`).
- `getAction("addPageFrame")`:
  - on an editable document it is enabled, and `runAction` adds one frame
    with `semantic.page` defined;
  - one `editor.undo()` removes it (store size is back to the previous
    value);
  - with `editor.setReadOnly(true)`, `enabled` is false and `runAction`
    returns false with the store unchanged.
- `getAction("nextPageFrame")` and `getAction("previousPageFrame")`:
  - `shortcut` is exactly `"PageDown"` and `"PageUp"`;
  - both are disabled on a page without page frames;
  - both are enabled after `addPageFrame` runs twice;
  - both stay enabled in read-only mode (viewer action).
- Navigation: with frames A and B (two `addPageFrame` runs) and the
  camera on A:
  - `runAction(next)` changes the camera centre into B;
  - `runAction(previous)` returns it into A;
  - the history length is unchanged (no command applied).
  - Use `viewport: { width: 800, height: 600 }`.
- Labels: `getAction(id).label` equals "Add page", "Next page frame" and
  "Previous page frame".

## Extension-only rule for the other files

Run each listed file. Edit one only if it fails because of the three new
actions, the PageUp/PageDown bindings or the two snippet and Page tiles.
The only allowed edit is adding the new entries to an exact expected list
or table. Record each edit with the failing assertion in the progress
log. Never delete, skip or loosen an assertion.

## Pitfalls

- `addPageFrame` positions frames relative to the selection or last frame
  (design 5.3). Do not assert absolute coordinates; assert count, `page`
  and undo.
- Read the camera centre with the existing camera API (`editor.camera`).
  Compare against frame bounds from `editor.store.get(id).visual`.

## Verification (exit 0; logs in `tmp/dps-s864/dps-17c-page-ui-tests/`)

1. `bun test packages/ui-solid/src/document-wiring.test.ts packages/ui-solid/src/app-palette.test.ts packages/ui-solid/src/shortcuts.test.ts packages/ui-solid/src/page-actions.test.ts packages/ui-solid/src/viewer-actions.test.ts packages/ui-solid/src/interaction-keyboard-menus.test.ts`
   -> 0 fail.
2. `bun run typecheck` -> exit 0.
3. `bunx biome check --diagnostic-level=warn packages/ui-solid/src/document-wiring.test.ts`,
   plus any edited listed test -> exit 0.

## Acceptance criteria

- `packages/ui-solid/src/document-wiring.test.ts` exists and covers every
  case above.
- `rg -n "PageDown|PageUp" packages/ui-solid/src/document-wiring.test.ts`
  matches.

## Progress

`impl-plans/progress/dps-17c-page-ui-tests.md`: sha256 before and after
any edited file, commands with exit codes and log paths, and repair
findings if any. No git state changes.
