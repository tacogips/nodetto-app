# appearance-05-ui-solid-chrome-css

- planId: appearance-05-ui-solid-chrome-css
- planPath: impl-plans/active/appearance-05-ui-solid-chrome-css.md
- wave: 2
- dependsOn: appearance-03-chrome-tokens
- design: `design-docs/specs/design-appearance.md` sections 2 (invariant
  3), 4.1, 4.3
- progress log: `impl-plans/progress/appearance-05-ui-solid-chrome-css.md`
- scratch: `tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/`

## Intent and context

The toolbar, layers, inspector, palette, problem panels, export dialog and
zoom controls come from `packages/ui-solid` CSS. Move their colours onto
the desktop tokens so the dark theme restyles them. The private
nodetto-cloud web app also loads these files and defines only the original
light tokens, so every reference carries today's literal as a `var()`
fallback. Read `appearance-00-overview.md` and plan 03's token registry in
`impl-plans/progress/appearance-03-chrome-tokens.md` first.

## Non-goals

- Do not edit `packages/ui-solid/src/shapes/*.css` (`UiControlView.css`,
  `DatabaseObjectView.css`). They are document element paint.
- No TSX changes and no selector or layout changes.
- In `base.css`, do not modify or reorder tokens added by plan 03 and do
  not change any light value.

## writePaths

- packages/ui-solid/src/Toolbar.css
- packages/ui-solid/src/Layers.css
- packages/ui-solid/src/BpmnProblemsPanel.css
- packages/ui-solid/src/BreadboardProblemsPanel.css
- packages/ui-solid/src/HelpHint.css
- packages/ui-solid/src/ShapePalette.css
- packages/ui-solid/src/ShapeWarnings.css
- packages/ui-solid/src/Switch.css
- packages/ui-solid/src/PcbLayersPanel.css
- packages/ui-solid/src/ExportDialog.css
- packages/ui-solid/src/ImageImport.css
- packages/ui-solid/src/Inspector.css
- packages/ui-solid/src/ZoomControls.css
- packages/ui-solid/src/SelectionToolbar.css
- packages/ui-solid/src/inspector/AssetExportSection.css
- impl-plans/progress/appearance-05-ui-solid-chrome-css.md (new)

## sharedPaths

- apps/desktop/src/styles/base.css. Append-only: add new tokens at the end
  of the light `:root` block and the dark `:root[data-nodetto-theme="dark"]`
  block. Do not touch any other line.

## File-level changes

For each colour literal (hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, `white`,
`black`) in the 15 files:

1. If a desktop light token (from `base.css` after plan 03) has the same
   normalized colour, write `var(--that-token, <literal exactly as
   today>)`. For example, `Toolbar.css` `border-bottom: 1px solid #dfe3e6`
   becomes `var(--app-chrome-line, #dfe3e6)`, and `background: #fff`
   becomes `var(--app-chrome-surface, #fff)`.
2. Otherwise, add a role-named token to both `base.css` blocks. The light
   value is the exact literal; pick a dark value that meets contrast. Then
   write `var(--new-token, <literal>)`. Reuse one new token for every
   identical literal with the same role.
3. Semantic status colours (errors, warnings in the problem panels and
   `ShapeWarnings.css`) also get tokens. Dark variants must keep the text
   readable (at least 4.5:1) on their dark backgrounds.
4. The fallback text must be the literal currently in the file, character
   for character, so nodetto-cloud renders the same bytes.
5. `ZoomControls.css`, `SelectionToolbar.css` and
   `inspector/AssetExportSection.css` have no literal today. Leave them
   unchanged unless a literal appears. Record the result.

Pitfalls:

- Do not reference a dark-only token. Every name must exist in the light
  block.
- Do not write a `var()` without a fallback in ui-solid CSS. nodetto-cloud
  may not define new tokens.
- `ShapeWarnings.css` badges render inside the pinned shape layer, so
  pinned tokens (`--nodetto-ink`, `--nodetto-surface` and the others) stay
  light there. That is acceptable. Prefer dedicated warning tokens for the
  badge colours.

## Progress log: token registry

Append rows in plan 03's format
(`name | light | dark | role | pairs with`) for every token this plan adds,
and list every pair (text token, background token) introduced by the 15
files, including pairs that only reuse existing tokens.

## Checks

- No bare literal:
  `grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(white|black)\b" <the 15 files> > tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/literals.log; echo "exit=$?"`.
  Every match line must have the literal as the second argument of a
  `var(--...)`. Record a per-file count of matches and of
  `var(--[a-z0-9-]*, ` occurrences.
- Fallback equality: write a scratch script at
  `tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/fallbacks.ts`.
  It parses each `var(--name, fallback)` and checks that the light value in
  `base.css` equals the fallback after normalization. Run it with `bun`;
  0 mismatches.
- Parity: the light and dark `base.css` blocks still declare identical name
  sets (same diff method as plan 03, exit 0).
- Contrast scratch script, using the same method as plan 03: every pair you
  recorded is at 4.5 or more in both themes.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid > tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/ui-solid.log 2>&1; echo "exit=$?"`
  -> exit 0.
- Shared-path discipline: `git diff -U0 -- apps/desktop/src/styles/base.css`
  after your edit differs from the pre-edit diff only by added lines inside
  the two blocks. Record both diff hashes.

## Done criteria

- The checks above pass and are recorded, the registry is appended, and
  the hashes and intent snapshot are logged. The last line of the progress
  log is `STATUS: done` (overview rules 8-9).

## Session 540 continuation (implement)

Not started in session 539. Implement as written once plan 03's progress
log ends with `STATUS: done`. Before the first `base.css` append, fresh-read
the file and record its sha256: it must already contain
`--app-muted-label: #6d7679;` (plan 03). Do not touch that line. No
ui-solid chrome CSS uses `#727b7e` today (`grep -rn 727b7e packages/*/src`
prints nothing), so no fallback depends on the old value.
