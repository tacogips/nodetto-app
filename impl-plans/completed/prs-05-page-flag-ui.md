# prs-05-page-flag-ui

- planId: prs-05-page-flag-ui
- planPath: impl-plans/active/prs-05-page-flag-ui.md
- progressPath: impl-plans/progress/prs-05-page-flag-ui.md
- wave: 2
- dependsOn: prs-01-page-flag (`setPageHiddenInPresentation`,
  `Page.hiddenInPresentation`)
- Design: `design-docs/specs/design-presentation.md` section 8 (page flag
  UI). Rules: `impl-plans/active/prs-00-overview.md`.
- writePaths:
  - `packages/ui-solid/src/PageTabs.tsx`
  - `packages/ui-solid/src/inspector/PageSection.tsx`
  - `packages/ui-solid/src/page-presentation-toggle.ts` (new)
  - `packages/ui-solid/src/page-presentation-toggle.test.ts` (new)
  - `impl-plans/progress/prs-05-page-flag-ui.md`
  - `tmp/prs-s793/prs-05-page-flag-ui`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Let users hide a page from the slideshow from the page tab options menu and
from the page inspector. Both call `editor.setPageHiddenInPresentation`, so
each toggle is one undoable `updatePage`. The labels and title text come
from a small pure helper so they can be tested without a DOM.

## Non-goals

- No CSS file changes. The muted style rule for the tab class is in prs-06
  (`apps/desktop/src/pane.css`).
- No barrel export, no presentation view, no new Command.

## File-level changes

1. `page-presentation-toggle.ts`:
   - `presentationToggleLabel(hidden: boolean): string`: `"Show in presentation"`
     when hidden, else `"Hide in presentation"`
   - `PRESENTATION_HIDDEN_TITLE_SUFFIX = " (hidden in presentation)"`
   - `PRESENTATION_HIDDEN_TAB_CLASS = "nodetto-page-tab-presentation-hidden"`
2. `PageTabs.tsx` options menu (`role="menu"`, about line 575):
   - Add one `role="menuitem"` button after Duplicate, imitating the Rename
     and Duplicate buttons: `tabindex="-1"`, class `nodetto-menu-item`.
   - Label from the helper. `onClick` calls
     `props.editor.setPageHiddenInPresentation(id, !(page().hiddenInPresentation === true))`
     then closes the menu (`setMenuFor(null)`).
   - Disabled when the strip is `readOnly()`, like the other mutating
     items.
   - A tab whose page has `hiddenInPresentation === true` gets the class
     constant and the title suffix appended to its existing `title`
     (about line 462).
3. `PageSection.tsx`:
   - After the Kind field, add a `Field label="Show in presentation"` with
     the `Switch` from `../Switch.tsx`. Imitate its use in
     `inspector/controls.tsx` or `inspector/AssetExportSection.tsx:234`.
   - Checked when `props.page.hiddenInPresentation !== true`. On change it
     calls `props.editor.setPageHiddenInPresentation(props.page.id, !checked)`.

## Pitfalls

- Keyboard navigation in the menu queries `[role=menuitem]:not(:disabled)`,
  so the new item must follow that markup to stay reachable with Up and
  Down.
- Read the flag as `=== true`. A page with `false` stored is shown.
- Do not restructure the existing menu items or the tab markup.

## Tests (input -> expected)

- `page-presentation-toggle.test.ts`:
  - `presentationToggleLabel(false)` -> `"Hide in presentation"`
  - `presentationToggleLabel(true)` -> `"Show in presentation"`
  - the suffix and class constants have the exact values above
  - with an editor (imitate `packages/core/src/editor.test.ts:makeEditor`):
    - toggling via `setPageHiddenInPresentation` twice -> the key is absent
      again
    - `undo` reverts a single toggle

## Verification (exits 0 with at least 1 pass and 0 fail; log in `tmp/prs-s793/prs-05-page-flag-ui/final/`)

1. `bun test ./packages/ui-solid/src/page-presentation-toggle.test.ts ./packages/ui-solid/src/page-rename.test.ts ./packages/ui-solid/src/page-tab-drag.test.ts` -> `ui.log`

Static: Biome on the owned files, then `bun run typecheck`.

## Done criteria

- Verification 1 exited 0.
- `grep -c 'setPageHiddenInPresentation' packages/ui-solid/src/PageTabs.tsx packages/ui-solid/src/inspector/PageSection.tsx`
  is at least 1 per file.
- The progress log has the intent hash, per-edit hashes and command results.

## Implementation status

Implemented; focused tests and scoped Biome passed. Typecheck result and edit evidence are recorded in the plan-local progress log and handoff. Formal review remains downstream.
