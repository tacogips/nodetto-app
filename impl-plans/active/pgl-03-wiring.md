# pgl-03-wiring

- planId: pgl-03-wiring
- planPath: impl-plans/active/pgl-03-wiring.md
- progressPath: impl-plans/progress/pgl-03-wiring.md
- wave: 3 (wiring)
- dependsOn: pgl-02-page-list (and pgl-01-page-actions transitively)
- Design: `design-docs/specs/design-page-list.md` sections 5, 6 and 8.3
  (design plan ids pl-02 and pl-04, merged here; see "Deviation")
- writePaths:
  - `apps/desktop/src/settings/preferences.ts`
  - `apps/desktop/src/settings/preferences.test.ts`
  - `apps/desktop/src/App.tsx`
  - `packages/ui-solid/src/index.ts`
  - `docs/editing.md`
  - `README.md`
  - `impl-plans/README.md`
  - `impl-plans/progress/pgl-03-wiring.md`
  - `tmp/pgl-s835/pgl-03-wiring`
  - `target`
  - `apps/desktop/dist`
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Deviation from design section 7

The design puts the preference in its own wave-1 plan, pl-02. Adding the
required `EditorPreferences.pagesListOpen` field breaks the object literal
passed to `storeEditorPreferences` in `App.tsx` (line ~272) until `App.tsx`
writes the field. `App.tsx` belongs to the wiring plan, so the preference
moves here and every plan typechecks on its own. The behavior is unchanged
from design section 5.

## Intent and context

- Persist the Pages section's fold state as a local UI preference.
- Mount `PageList` in the left SidePane between `ShapePalette` and `Layers`.
- Export `PageList` from the ui-solid barrel.
- Document the Pages list.

## Non-goals

- No change to `PageTabs` props or placement, `CopyShapesDialog`,
  `main.tsx`, or the document format.
- Do not move files between `impl-plans/` directories; the plan-archive
  node does that.

## File-level changes

`preferences.ts`:

- Add `readonly pagesListOpen: boolean` to `EditorPreferences`, with
  default `true` in `defaults`.
- Add `"pagesListOpen"` to the `bool()` key union and return
  `pagesListOpen: bool("pagesListOpen")`. Imitate `leftPaneOpen`.
- The no-stored-value path already spreads `defaults`, so it yields `true`.
- `KEY` stays `nodetto.editor.preferences.v1`.

`preferences.test.ts` (imitate the existing `storage()` helper tests):

- empty storage -> `pagesListOpen` true
- stored `{pagesListOpen:false}` -> false, and a store/load round trip is
  equal
- stored `"no"` -> true
- a legacy stored object without the key -> true

`index.ts`: add `export { PageList, type PageListProps } from
"./PageList.tsx";` next to the `PageTabs` export.

`App.tsx`:

- Add `const [pagesListOpen, setPagesListOpen] =
  createSignal(preferences.pagesListOpen);`.
- Add `pagesListOpen: pagesListOpen()` to the existing
  `storeEditorPreferences` effect.
- Inside `<SidePane side="left" ...>`, after `<ShapePalette .../>` and
  before `<Layers .../>`, mount:

  ```tsx
  <PageList editor={props.editor} open={pagesListOpen()}
    onOpenChange={setPagesListOpen} onCopyShapesFrom={openCopyShapes} />
  ```

  `openCopyShapes` is the same function the `PageTabs` mount at
  `App.tsx:953` receives. Do not create a second dialog host.
- Import `PageList` from `@nodetto/ui-solid`.

`docs/editing.md`, under "## Page navigation", add a "Pages list"
paragraph covering:

- the Shapes and layers pane section, with its page count
- fold/expand, remembered locally and never saved in the document
- the number and name in each row, and the hidden-in-presentation marker
- the current page highlighted and kept in view
- click, Enter or Space to open a page; Up/Down/Home/End to move
- F2 or double-click to rename
- the "..." button or right-click for page options, with Move up/Move down
- "+" to add a page
- read-only shows the list only

`README.md`: extend the existing pages/presentation feature bullet by one
clause mentioning the Pages list. Do not add a new section.

`impl-plans/README.md`: list `pgl-01..pgl-03` and `pgl-s835-dispatch.json`
under Active, in the existing prose style.

## Pitfalls

- Mount `PageList` once, only in the left pane.
- Do not add `pagesListOpen` handling to `main.tsx`.
- Keep the `showSlideArea` conditional spread in the effect unchanged.

## Verification (each command must exit 0)

1. `bun test apps/desktop/src/settings/preferences.test.ts packages/ui-solid/src/page-list.test.ts packages/ui-solid/src/PageList.test.tsx packages/ui-solid/src/page-actions.test.ts`
   must report 0 failures and all 8 DOM scenarios.
2. `bun run typecheck`
3. `mise run lint`
4. `mise run verify` (check + lint + `bun test` + cargo test; the cargo
   steps use `CARGO_TERM_QUIET=true`, as in `mise.toml`) must run the full
   suite with 0 failures.
5. `bun run build`. This is compilation and bundling evidence only, not
   interaction verification.
6. `mkdir -p tmp/pgl-s835/pgl-03-wiring/final && bunx tsc --noEmit --noUncheckedIndexedAccess -p tsconfig.json > tmp/pgl-s835/pgl-03-wiring/final/strict-index.log 2>&1; ! grep 'error TS' tmp/pgl-s835/pgl-03-wiring/final/strict-index.log | grep -v -e '\.test\.ts' -e '^apps/desktop/scripts/'`
   must show no production strict-index errors.

## Done criteria

- `git grep -n "<PageList" apps/desktop/src/App.tsx` returns exactly 1 line.
- `git grep -n pagesListOpen apps/desktop/src/settings/preferences.ts`
  returns 3 or more lines.
- `docs/editing.md` contains "Pages list".
- All commands exit 0, with logs under `tmp/pgl-s835/pgl-03-wiring/`. The
  progress log records each command, its exit code and its log path, plus
  per-edit pre and post hashes.
