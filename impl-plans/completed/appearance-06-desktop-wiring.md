# appearance-06-desktop-wiring

- planId: appearance-06-desktop-wiring
- planPath: impl-plans/completed/appearance-06-desktop-wiring.md
- wave: 2
- dependsOn: appearance-01-preferences, appearance-02-canvas-mode
- design: `design-docs/specs/design-appearance.md` sections 3.3, 3.4, 5.1,
  7; user QA Q2 default
- progress log: `impl-plans/progress/appearance-06-desktop-wiring.md`
- scratch: `tmp/canvas-theme-s539/appearance-06-desktop-wiring/`

## Intent and context

Wire the preferences (plan 01) and the canvas prop (plan 02) into the
running app. The work covers the Appearance settings category, the theme
applied before first render, live re-application on preference or macOS
appearance change, the native title bar following the theme, and the
resolved canvas modes passed to `NodettoCanvas`. Add the README line.
Read `appearance-00-overview.md` and the exports of
`apps/desktop/src/settings/appearance.ts` first.

## Non-goals

- No CSS changes (plans 03, 04, 05).
- No `tauri.conf.json` change, no Rust change, no new npm dependency.
  `@tauri-apps/api` is already a dependency of `apps/desktop`.
- Do not change other `App.tsx` behaviour or the `NodettoCanvas` props
  other than adding `canvasBackground`.

## writePaths

- apps/desktop/src/main.tsx
- apps/desktop/src/App.tsx
- apps/desktop/src/settings/SettingsDialog.tsx
- apps/desktop/src-tauri/capabilities/default.json
- apps/desktop/src-tauri/gen/schemas/capabilities.json (tracked, generated
  by the Tauri build from `default.json`; must list exactly the same
  permissions; never hand-edit beyond that)
- README.md
- impl-plans/progress/appearance-06-desktop-wiring.md (new)

## File-level changes

### `main.tsx`

Before `render(...)`, load preferences with
`loadEditorPreferences(<localStorage guarded like App.tsx:139
preferenceStorage>)`. Compute `systemDark` as
`window.matchMedia?.(SYSTEM_DARK_QUERY).matches ?? false`. Call
`applyTheme(document.documentElement, resolveTheme(prefs.theme,
systemDark))`. Wrap the call in `try/catch` so a failure never blocks the
render. No inline script in `index.html`; the CSP forbids it.

### `App.tsx`

- Signals seeded from `preferences`: `theme`, `canvasBackground`,
  `pcbCanvasBackground`.
- `systemDark` signal: get `const media = window.matchMedia?.(SYSTEM_DARK_QUERY)`.
  If it exists, seed from `media.matches` and register
  `onCleanup(watchSystemTheme(media, setSystemDark))`.
- `resolvedTheme = createMemo(() => resolveTheme(theme(), systemDark()))`.
- `createEffect(() => applyTheme(document.documentElement, resolvedTheme()))`.
- Tauri title bar, in a separate effect that tracks only `theme()`: when
  `isTauri()` (import from `@tauri-apps/api/core`, as
  `apps/desktop/src/file/backend.ts:8` does), call
  `getCurrentWindow().setTheme(theme() === "system" ? null : theme())`
  (from `@tauri-apps/api/window`). After it resolves, run
  `setSystemDark(media.matches)` if `media` exists, because the WebView's
  `prefers-color-scheme` follows the window theme. Catch and ignore
  rejection, with at most a `console.warn`. Pitfall: do not read
  `systemDark()` inside this effect, or it will loop.
- Add the three keys to the existing `storeEditorPreferences` effect
  object (`App.tsx:205-217`).
- On `<NodettoCanvas>` (`App.tsx:677`) add `canvasBackground={{ diagram:
  resolveCanvasMode(canvasBackground(), resolvedTheme()), pcb:
  resolveCanvasMode(pcbCanvasBackground(), resolvedTheme()) }}`.
- On `<SettingsDialog>` (`App.tsx:529`), pass the three values and
  setters.

### `SettingsDialog.tsx`

- Add `"appearance"` to `Category`. Insert
  `{ id: "appearance", label: "Appearance" }` directly after `general` in
  `categories()`.
- New props: `theme: ThemePreference`, `onThemeChange`,
  `canvasBackground: CanvasBackgroundPreference`,
  `onCanvasBackgroundChange`, `pcbCanvasBackground:
  CanvasBackgroundPreference`, `onPcbCanvasBackgroundChange`.
- Under `<Show when={category() === "appearance"}>`, add three
  `label.app-settings-row` entries, each with a `<select>`. Imitate the
  General "Mode" select at `SettingsDialog.tsx:158-176`: an `aria-label`,
  `value`, `onChange`, and `<For>` over the option tuples
  (`THEME_OPTIONS`, `CANVAS_BACKGROUND_OPTIONS`,
  `PCB_CANVAS_BACKGROUND_OPTIONS`). Row labels are `Theme`, `Canvas` and
  `PCB canvas`. The aria-labels are `App theme`, `Canvas background` and
  `PCB canvas background`.
- In `onChange`, validate with `isThemePreference` or
  `isCanvasBackgroundPreference` before calling the prop. Do not use a bare
  `as` cast.

### `capabilities/default.json`

Add `"core:window:allow-set-theme"` to `permissions` after
`"core:default"`. The permission name exists in
`apps/desktop/src-tauri/gen/schemas/desktop-schema.json`.

### `README.md`

Add one feature-list line in the style of the neighbouring lines: appearance
settings with an app theme (System, Light, Dark), a diagram canvas
background (Light, Dark, Match theme) and a PCB canvas background (Dark by
default). Find the feature list with `grep -n "^- " README.md` and record
where you inserted the line.

## Tests

Logic is covered by plan 01 (pure functions) and plan 02 (mode helper).
This plan adds no new test file, so no DOM harness is needed. Run the
checks below.

## Checks

- `bun run typecheck > tmp/canvas-theme-s539/appearance-06-desktop-wiring/typecheck.log 2>&1; echo "exit=$?"`
  -> exit 0.
- `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/canvas-theme-s539/appearance-06-desktop-wiring/unchecked.log 2>&1; echo "exit=$?"`.
  Then `grep -c "apps/desktop/src/App.tsx\|apps/desktop/src/main.tsx\|SettingsDialog.tsx" tmp/canvas-theme-s539/appearance-06-desktop-wiring/unchecked.log`
  prints 0 (baseline: 0 errors in these files).
- `bun test apps/desktop/src/settings > tmp/canvas-theme-s539/appearance-06-desktop-wiring/settings-tests.log 2>&1; echo "exit=$?"`
  -> exit 0. This reads only plan 01 files, which are complete before
  wave 2.
- `bun test apps/desktop/src > tmp/canvas-theme-s539/appearance-06-desktop-wiring/desktop-tests.log 2>&1; echo "exit=$?"`
  -> exit 0. This includes `style.test.ts`, which reads `base.css` while
  plan 05 appends to it. Overview rule 8 applies: the result counts only
  once plan 05's progress log ends with `STATUS: done`. Otherwise, record
  it as `pending-join`.
- `bunx biome check apps/desktop/src/main.tsx apps/desktop/src/App.tsx apps/desktop/src/settings/SettingsDialog.tsx --diagnostic-level=warn`
  -> exit 0.
- The desktop frontend bundle (`bun --cwd=apps/desktop run build`) is not
  a gate of this plan. It bundles plan 05's CSS, so it runs at the wave-2
  join, inside reconciliation's `mise run build`.
- `grep -c "allow-set-theme" apps/desktop/src-tauri/capabilities/default.json`
  prints 1.

## Invariants

- With default preferences on a light macOS: the root is
  `data-nodetto-theme="light"`, diagram pages are light, PCB pages are
  dark.
- Settings changes apply without reload, and only through signals.
- Exports and document data are untouched. No export call site receives
  appearance state.

## Done criteria

- The checks pass, with the desktop test run either passing or recorded
  as `pending-join` under rule 8.
- The progress log records each command, exit code and log path, plus
  hashes and the intent snapshot, and its last line is `STATUS: done`.

## Session 540 continuation (verify-only)

The code is in the tree at `58c8171`. Follow the overview "Verify-only
rules". Rerun every check with logs in
`tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/`. Also:

- Delete the stale `Status: in progress` line near the top of your progress
  log. `STATUS: done` as the last line is the only status marker.
- Capability scope: `default.json` permissions must equal
  `["core:default", "core:window:allow-set-theme"]`, and
  `gen/schemas/capabilities.json` must list the same two permissions and
  nothing else. Check with `grep -c 'allow-set-theme'` on both (1 each).
- The `bun test apps/desktop/src` run is a shared-input gate with plan 05
  (wave 2). It counts only once plan 05's log ends with `STATUS: done`.
Expected: typecheck exit 0, zero `noUncheckedIndexedAccess` hits in the
three TSX files, settings tests exit 0, desktop tests exit 0 (or
`pending-join` on plan 05), biome exit 0, `tauri.conf.json` unchanged.
