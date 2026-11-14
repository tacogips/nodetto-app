# sac-07-settings-and-picker-ui

- planId: sac-07-settings-and-picker-ui
- planPath: impl-plans/active/sac-07-settings-and-picker-ui.md
- progressPath: impl-plans/progress/sac-07-settings-and-picker-ui.md
- wave: 2
- dependsOn: sac-01-slide-data, sac-02-copy-shapes-core, sac-03-slide-rect-core
- Design: `design-docs/specs/design-slide-area-copy-shapes.md` sections 3.3, 5.3, 5.4 and 9; user-qa Q5.
- writePaths:
  - `packages/ui-solid/src/inspector/PresentationSection.tsx` (new)
  - `packages/ui-solid/src/inspector/presentation-settings.ts` (new; pure command builders)
  - `packages/ui-solid/src/inspector/presentation-settings.test.ts` (new)
  - `packages/ui-solid/src/copy-shapes-options.ts` (new)
  - `packages/ui-solid/src/copy-shapes-options.test.ts` (new)
  - `packages/ui-solid/src/CopyShapesDialog.tsx` (new)
  - `packages/ui-solid/src/CopyShapesDialog.css` (new)
  - `packages/ui-solid/src/PageTabs.tsx`
  - `impl-plans/progress/sac-07-settings-and-picker-ui.md`
  - `tmp/sac-s826/sac-07-settings-and-picker-ui`
  - `target`
  - `apps/desktop/dist`
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Intent and context

Users set the document slide size (a preset or a custom size) and the page
slide origin. They also copy shapes from another page through a small picker
whose default is "Previous page".

Edits go through the public `editor.apply` with the sac-01 commands, as
`Layers.tsx:436` does. There are no facade setters (design 3.3).

## Non-goals

- Do not mount `PresentationSection` in `Inspector.tsx`, host the dialog in
  `App.tsx`, or edit `index.ts`. sac-08 does all three.
- No keyboard shortcut.

## File-level changes

1. `presentation-settings.ts` (pure, DOM-free):
   - `slideSizeCommand(current: SlideSize | undefined, choice: SlideSizePresetId | "custom" | "none", custom?: SlideSize): Command | null`:
     - `"none"` gives `slideSize: null`, or `null` if already unset.
     - A preset gives its size.
     - `"custom"` gives `custom ?? current ?? DEFAULT_SLIDE_SIZE`.
     - The result is `null` when it equals `current`.
   - `slideOriginCommand(page: Page, origin: SlideOrigin | null): Command | null`:
     `updatePage`, or `null` when equal.
   - `clampSlideDimension(n)` rounds into `[1, 100000]`; a non-finite input
     gives `null`.
2. `PresentationSection.tsx`: props `{ editor: Editor; page: Page }`.
   - A "Slide size" `<select>`: None (fit content), the
     `SLIDE_SIZE_PRESETS` labels with sizes, and Custom.
   - The select's value is `slideSizePreset(meta.slideSize)`, or `"none"`.
   - Custom shows W and H inputs (`NumberInput` from `../NumberInput.tsx`).
   - When a size is set, show "Slide origin" X and Y inputs and a Reset
     button.
   - Each change calls `props.editor.apply([cmd])` only for a non-null
     command.
   - Read meta through `createEditorSignals(...).rev()` so the section
     refreshes.
   - Imitate the layout and classes of
     `packages/ui-solid/src/inspector/PageSection.tsx`.
3. `copy-shapes-options.ts`:
   - `type CopyShapesOption = { readonly key: string; readonly label: string; readonly pageId: PageId | null; readonly disabled: boolean }`.
   - `copyShapesOptions(pages /* tab order */, targetId)`:
     1. `{ key: "prev", label: "Previous page (<name>)" or "Previous page (none)", ... }`
     2. `{ key: "next", ... }`, the same way
     3. every page other than the target, as `{ key: page.id, label: page.name }`
   - An unknown target gives `[]`.
   - `defaultCopyShapesOption(options)`: the "prev" option when it is
     enabled, else the first enabled option, else `null`.
4. `CopyShapesDialog.tsx`: props `{ editor: Editor; targetId: PageId; onClose: () => void }`.
   - A `role="dialog"` with a `role="listbox"` of the options, preselected
     to the default.
   - Arrow keys move, Enter confirms and Escape closes. Copy and Cancel
     buttons.
   - Confirm calls `editor.copyPageElements(option.pageId, targetId)`, then
     `onClose()`.
   - Imitate the modal pattern in `packages/ui-solid/src/ExportDialog.tsx`.
     Keys are handled with `stopPropagation` so canvas shortcuts do not
     fire.
5. `PageTabs.tsx`:
   - Add `readonly onCopyShapesFrom?: (targetId: PageId) => void` to
     `PageTabsProps`.
   - Add the menuitem "Copy shapes from page..." after "Duplicate"
     (`PageTabs.tsx:648`).
   - It renders only when the prop is given. It is disabled when
     `readOnly()` or there is one page.
   - On click it calls `props.onCopyShapesFrom(id)` and `setMenuFor(null)`.

## Pitfalls

- The prop must be optional, so `App.tsx` keeps typechecking until sac-08.
- Check `pages[index - 1]` for undefined. The first page's "prev" is
  disabled with `pageId` null, and the last page's "next" is disabled.
- Never offer the target as a source.
- A single-page document gives two disabled options and a `null` default:
  the Copy button is disabled.
- The custom W/H inputs must not apply an invalid value. Clamp, and skip a
  non-finite input.

## Tests (input -> expected)

- `copy-shapes-options.test.ts`, pages `[A, B, C]`:
  - target B -> prev = A (enabled), next = C, then the others A and C; the
    default is "prev"
  - target A -> prev disabled with `pageId` null; the default is "next"
  - target C -> next disabled
  - a single page -> the default is `null`
  - the target never appears among the others
- `presentation-settings.test.ts`:
  - `"16:9"` from unset -> `updateDocument` 1920x1080
  - the same preset again -> `null`
  - `"none"` from set -> `slideSize: null`; `"none"` from unset -> `null`
  - `"custom"` from unset -> `DEFAULT_SLIDE_SIZE`
  - `"a4-landscape"` -> 1123x794
  - `slideOriginCommand` with an equal origin -> `null`; with `null` while
    set -> `updatePage slideOrigin: null`
  - `clampSlideDimension(0)` -> 1, `(2e5)` -> 100000, `(NaN)` -> `null`
  - applying a command to `makeEditor` and then undoing restores the meta

## Verification (each exits 0 with at least 1 pass and 0 fail; logs in `tmp/sac-s826/sac-07-settings-and-picker-ui/final/`)

1. `bun test ./packages/ui-solid/src/copy-shapes-options.test.ts ./packages/ui-solid/src/inspector/presentation-settings.test.ts` -> `ui.log`
2. `bun test ./packages/ui-solid/src/page-presentation-toggle.test.ts ./packages/ui-solid/src/page-rename.test.ts` -> `pagetabs.log`
3. `bun run typecheck` -> `typecheck.log`

Static: `bunx biome check` on the owned files.

## Done criteria

- Verifications 1-3 exited 0.
- `git diff --stat -- apps/desktop/src/App.tsx packages/ui-solid/src/Inspector.tsx packages/ui-solid/src/index.ts`
  is empty.
- The progress log has the intent hash, per-edit hashes and the exit
  statuses.
