# appearance-00-overview

- planId: appearance-00-overview (coordination only; no writePaths)
- design: `design-docs/specs/design-appearance.md` (accepted by session-539
  step3, DR-1 verified fixed); user QA defaults:
  `design-docs/user-qa/appearance.md` (Q1-Q3, implement the defaults)
- session: opus-luna-design-and-implement-review-loop-session-539; issue:
  none (workflowInput only); branch `feat/canvas-theme`; gitPush=false
- scratch root: `tmp/canvas-theme-s539/<planId>/` (git-ignored; never put
  `*.test.ts` files there)

## Intent

Add three desktop appearance preferences: app theme (System/Light/Dark),
diagram canvas background (Light/Dark/Match theme) and PCB canvas
background (Dark/Light/Match theme). They persist, apply live, and never
change document element paint or exports. Read the design before starting;
section numbers below refer to it.

## Waves and ownership

| Wave | Plan | Depends on | Owns (summary) |
| --- | --- | --- | --- |
| 1 | appearance-01-preferences | - | `settings/appearance.ts`, `settings/preferences.ts` and tests |
| 1 | appearance-02-canvas-mode | - | ui-solid `canvas/canvas-background.ts`, `Canvas.tsx` prop and class, index export |
| 1 | appearance-03-chrome-tokens | - | `styles/base.css` token blocks and every desktop chrome CSS file except canvas CSS |
| 1 | appearance-04-canvas-css | - | `styles/canvas.css`, `styles/canvas-gestures.css` (canvas tokens, paint pin, overlay rules) |
| 2 | appearance-05-ui-solid-chrome-css | 03 | 15 ui-solid chrome CSS files; appends tokens to `base.css` |
| 2 | appearance-06-desktop-wiring | 01, 02 | `main.tsx`, `App.tsx`, `SettingsDialog.tsx`, Tauri capability, README |
| 3 | appearance-07-theme-tokens-test | 03, 04, 05 | `styles/theme-tokens.test.ts`; value-only tweaks in `base.css`/`canvas.css` |

Why waves: `base.css` is written by 03, then 05, then (dark values only)
07, never by two plans at once. 06 needs the types from 01 and the prop
from 02. 07 tests the finished CSS of 03, 04 and 05.

## Pinned cross-plan contracts

- `apps/desktop/src/settings/appearance.ts` (plan 01):
  `ThemePreference = "system" | "light" | "dark"`,
  `CanvasBackgroundPreference = "light" | "dark" | "match"`,
  `ResolvedTheme = "light" | "dark"`, option tuples `THEME_OPTIONS`,
  `CANVAS_BACKGROUND_OPTIONS`, `PCB_CANVAS_BACKGROUND_OPTIONS` (each
  `readonly { value, label }[]` in dialog order), guards `isThemePreference`,
  `isCanvasBackgroundPreference`, functions `resolveTheme`,
  `resolveCanvasMode`, `applyTheme`, `watchSystemTheme`,
  `SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)"`.
- `EditorPreferences` (plan 01) gains `theme: ThemePreference`,
  `canvasBackground: CanvasBackgroundPreference`,
  `pcbCanvasBackground: CanvasBackgroundPreference`.
- ui-solid (plan 02): `CanvasMode`, `CanvasBackgroundSetting { diagram;
  pcb }`, `canvasModeFor(pageKind, setting)`, optional
  `NodettoCanvasProps.canvasBackground`, class `nodetto-canvas-dark`; all
  exported from `packages/ui-solid/src/index.ts`.
- Root attribute: `data-nodetto-theme="light" | "dark"` on `<html>`, and the
  dark chrome block selector `:root[data-nodetto-theme="dark"]` (plans 01,
  03).
- Canvas token names (plan 04, design 5.2): `--nodetto-canvas-bg`,
  `--nodetto-canvas-grid`, `--nodetto-canvas-ruler-surface`,
  `--nodetto-canvas-ruler-line`, `--nodetto-canvas-ruler-text`,
  `--nodetto-canvas-overlay`, `--nodetto-canvas-handle-fill`,
  `--nodetto-canvas-crop-line`, `--nodetto-canvas-crop-handle`,
  `--nodetto-canvas-crop-mask`, `--nodetto-canvas-gradient-line`,
  `--nodetto-canvas-shadow`.
- Token registry for plan 07: plans 03 and 05 list every token they add in
  their progress log as `name | light | dark | role (text, background,
  border, shadow, fixed) | pairs with`.

## Per-worker protocol (every plan)

1. Before editing a file, read it fresh and record its sha256
   (`shasum -a 256 <path>`) in your progress log, then again after the
   edit.
2. Before the first edit, write an intent snapshot (what you will change
   and why) to the progress log.
3. If a file you own changed since your last read, or a file you do not
   own changed in a way that breaks your work, stop, record the drift, and
   do not overwrite another plan's edits. Repair happens serially after the
   wave joins.
4. Edit only your `writePaths` (and `sharedPaths` exactly as the plan
   allows). No state-changing git commands (`add`, `commit`, `stash`,
   `checkout`, `reset`). Read-only `git diff`/`git status` are fine.
5. No workspace-wide formatters. Format only your own files with
   `bunx biome format --write <files>`.
6. Edit only your own progress log, `impl-plans/progress/<planId>.md`.
   Record each verification command, its exit code, the log path under the
   scratch root, and the important output lines.
7. Run commands in the foreground. No `&` or `nohup`. Do not pipe a
   verification command into `tee` or `head`. Redirect to a log and print
   `echo "exit=$?"`.
8. Shared-input gates. These commands read files that a same-wave sibling
   may be editing: `bun run typecheck` (repo-wide),
   `bun test apps/desktop/src/style.test.ts` (inlines the whole
   `style.css` import tree, including `base.css`, `canvas.css` and every
   `styles/*.css`), `bun test apps/desktop/src`, `bun test packages/ui-solid`
   and `bun --cwd=apps/desktop run build` (bundles the ui-solid CSS).
   - A run counts as a pass only when every same-wave sibling whose files
     it reads has `STATUS: done` as the last line of its progress log.
   - If a failure traces to a sibling's file, record the error and the
     owning plan. Do not edit that file, and do not count the run as a
     pass. Rerun after the sibling reports done.
   - If the sibling is still not done when you finish, record the result
     as `pending-join` with the owner. Serial reconciliation reruns every
     `pending-join` gate after the wave joins.
   Same-wave readers: wave 1, plans 03 and 04 (style test), plans 01, 02,
   03 and 04 (typecheck). Wave 2, plans 05 and 06 (desktop tests,
   ui-solid tests, typecheck).
9. When all of your work and checks are complete, write `STATUS: done` as
   the last line of your progress log, and nothing after it.

## Global non-goals (every plan)

- Do not edit `packages/ui-solid/src/shapes/pcb-view.ts`,
  `packages/ui-solid/src/shapes/PcbShapeView.tsx`, `PcbOverlay.tsx`,
  `BreadboardOverlay.tsx`, `TextEditor.tsx`, the PCB layer colour table,
  any export module, or `packages/ui-solid/src/shapes/*.css`.
- No light token value changes. No version bumps. No `tauri.conf.json`
  change. No server, auth or deployment code. English only, no emojis.

## Final verification (serial, after wave 3, owned by reconciliation)

- `BUN_OPTIONS=--jsx-runtime=classic mise run verify` exits 0.
- `mise run build` exits 0.
- `bun test apps/desktop/src/settings` exits 0.
- `bun test apps/desktop/src/styles/theme-tokens.test.ts apps/desktop/src/style.test.ts`
  exits 0, with theme-tokens cases 1, 1b and 2-7 plus 5 negative cases
  passing.
- Every gate recorded as `pending-join` in any progress log (protocol rule
  8) is rerun on the joined tree and passes.
- `bun test packages/ui-solid/src/canvas/canvas-background.test.ts packages/ui-solid/src/canvas-rulers.test.ts`
  exits 0.
- `bun run typecheck` exits 0.
- `git status --short` shows no change outside the union of the plans'
  writePaths and sharedPaths, plus `impl-plans/`.
- `impl-plans/README.md` gets an "Appearance settings" entry during
  finalization (reconciliation work, not a worker task).
