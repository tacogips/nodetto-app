# appearance-01-preferences

- planId: appearance-01-preferences
- planPath: impl-plans/active/appearance-01-preferences.md
- wave: 1
- dependsOn: none
- design: `design-docs/specs/design-appearance.md` sections 1, 3.1, 3.2
- progress log: `impl-plans/progress/appearance-01-preferences.md`
- scratch: `tmp/canvas-theme-s539/appearance-01-preferences/`

## Intent and context

Add the persisted appearance preferences and the pure resolution module that
plan 06 wires into the app. Read `appearance-00-overview.md` (protocol and
pinned contracts) first. No UI, no CSS.

## Non-goals

- No change to `App.tsx`, `main.tsx`, `SettingsDialog.tsx` (plan 06).
- No Tauri calls in `appearance.ts`. It must stay DOM-light: it touches only
  the `root` and `MediaQueryList` objects passed in.
- Do not change the storage key or the parsing of existing keys.

## writePaths

- apps/desktop/src/settings/appearance.ts (new)
- apps/desktop/src/settings/appearance.test.ts (new)
- apps/desktop/src/settings/preferences.ts
- apps/desktop/src/settings/preferences.test.ts
- impl-plans/progress/appearance-01-preferences.md (new)

## File-level changes

### `appearance.ts` (new)

Export exactly these (names are a contract with plan 06):

- Types `ThemePreference = "system" | "light" | "dark"`,
  `CanvasBackgroundPreference = "light" | "dark" | "match"`,
  `ResolvedTheme = "light" | "dark"`.
- `SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)"`.
- `THEME_OPTIONS`: `[{value:"system",label:"System"}, {value:"light",
  label:"Light"}, {value:"dark",label:"Dark"}]`.
  `CANVAS_BACKGROUND_OPTIONS`: Light, Dark, then `match` labelled
  `Match theme`. `PCB_CANVAS_BACKGROUND_OPTIONS`: Dark, Light, Match theme
  (same values, PCB order). Declare them `as const` and readonly.
- `isThemePreference(value: unknown): value is ThemePreference` and
  `isCanvasBackgroundPreference(value: unknown)`. Build them from the
  option tuples with `.some(...)` and do not index into arrays, so they
  stay safe under `noUncheckedIndexedAccess`.
- `resolveTheme(theme: ThemePreference, systemPrefersDark: boolean):
  ResolvedTheme`.
- `resolveCanvasMode(pref: CanvasBackgroundPreference, resolved:
  ResolvedTheme): ResolvedTheme`. `match` returns `resolved`.
- `applyTheme(root: { dataset: DOMStringMap; style: { colorScheme: string } },
  resolved: ResolvedTheme): void` sets `root.dataset.nodettoTheme` and
  `root.style.colorScheme` to `resolved`. Use a structural parameter type
  so tests pass a plain object.
- `watchSystemTheme(media: Pick<MediaQueryList, "matches" |
  "addEventListener" | "removeEventListener">, onChange: (dark: boolean)
  => void): () => void`. Subscribe to `"change"`, call `onChange(event.matches)`
  on each change, and return a disposer that removes the same listener
  reference. Do not call `onChange` immediately; the caller reads
  `media.matches` itself.

Imitate the small pure-module style of
`apps/desktop/src/settings/cli-install.ts` (top-level exported functions
with a short doc comment each).

### `preferences.ts`

- Add `theme`, `canvasBackground`, `pcbCanvasBackground` to
  `EditorPreferences` (types imported from `./appearance.ts`).
- Defaults: `theme: "system"`, `canvasBackground: "light"`,
  `pcbCanvasBackground: "dark"`.
- In the object branch, read each key with the guards. Any invalid value
  gives that key's default only.
- The no-payload branch (`!raw`, including the legacy
  `nodetto.view.show-rulers` path) already spreads `defaults`, so the new
  keys arrive with their defaults. Keep that.
- The `catch` branch returns `defaults` (already includes the new keys).
- `storeEditorPreferences` is unchanged (it serializes the whole object).

Pitfall: do not reuse `isCanvasBackgroundPreference` defaults for the PCB
key. The PCB default is `dark`, not `light`.

## Tests to add

`preferences.test.ts` (keep both existing tests passing unchanged in
behaviour; existing `toEqual` round trip now includes the new keys through
`loadEditorPreferences(store)`):

- Empty storage -> `theme: "system"`, `canvasBackground: "light"`,
  `pcbCanvasBackground: "dark"`.
- Stored v1 payload without the new keys (for example only `showGrid:false`)
  -> the three defaults, and `showGrid` stays false.
- Legacy `nodetto.view.show-rulers = "false"` only -> `showRulers` false
  plus the three defaults.
- `{theme:"dark", canvasBackground:"match", pcbCanvasBackground:"light"}` ->
  loaded as stored; store, then load again gives `toEqual` of the full
  object.
- Invalid values per key (`theme:"blue"`, `canvasBackground: 1`,
  `pcbCanvasBackground: null`) -> each key falls back to its own default,
  and other valid keys still load.
- Malformed JSON -> the three defaults.

`appearance.test.ts`:

- `resolveTheme("system", true)` -> `dark`; `("system", false)` -> `light`;
  `("light", true)` -> `light`; `("dark", false)` -> `dark`.
- `resolveCanvasMode`: all nine combinations of `light|dark|match` and
  `light|dark`, as a table.
- `applyTheme` on `{dataset:{}, style:{colorScheme:""}}` with `dark` sets
  `dataset.nodettoTheme === "dark"` and `style.colorScheme === "dark"`;
  calling it again with `light` switches both.
- `watchSystemTheme` with a fake media object that stores listeners:
  dispatching `{matches:true}` calls `onChange(true)`; after the disposer
  runs, the listener set is empty and further dispatches call nothing.
- Option tuples: values and labels in the dialog order listed above;
  `isThemePreference("system")` true, `isThemePreference("match")` false;
  `isCanvasBackgroundPreference("match")` true.

## Invariants

- The storage key stays `nodetto.editor.preferences.v1`.
- Existing keys parse exactly as before.
- Load never throws, even with blocked storage.

## Verification (run from the repo root; logs under the scratch root)

- `bun test apps/desktop/src/settings > tmp/canvas-theme-s539/appearance-01-preferences/test.log 2>&1; echo "exit=$?"`
  -> exit 0; the log shows the new tests passing and 0 fail.
- `bun run typecheck > tmp/canvas-theme-s539/appearance-01-preferences/typecheck.log 2>&1; echo "exit=$?"`
  -> exit 0 (apply protocol rule 8 for errors in sibling files).
- `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/canvas-theme-s539/appearance-01-preferences/unchecked.log 2>&1; echo "exit=$?"`.
  The repo does not enable this flag, so pre-existing errors elsewhere are
  expected. Baseline at HEAD 28c9ded: exit 2 with 91 errors, 0 in
  `apps/desktop/src/settings/` (`tmp/canvas-theme-s539/step4/unchecked-baseline.log`). Then run `grep -c "apps/desktop/src/settings/appearance\|apps/desktop/src/settings/preferences" tmp/canvas-theme-s539/appearance-01-preferences/unchecked.log`.
  The count must be 0.
- `bunx biome check apps/desktop/src/settings/appearance.ts apps/desktop/src/settings/appearance.test.ts apps/desktop/src/settings/preferences.ts apps/desktop/src/settings/preferences.test.ts --diagnostic-level=warn`
  -> exit 0.

## Done criteria

- `grep -n "export function resolveTheme\|export function resolveCanvasMode\|export function applyTheme\|export function watchSystemTheme" apps/desktop/src/settings/appearance.ts`
  prints 4 lines.
- `grep -n "pcbCanvasBackground: \"dark\"" apps/desktop/src/settings/preferences.ts`
  prints 1 line.
- All verification commands meet their expected result, and the progress
  log records hashes, the intent snapshot, commands, exit codes and log
  paths. Its last line is `STATUS: done` (overview rules 8-9; typecheck
  failures in sibling files follow rule 8).

## Session 540 continuation (verify-only)

The code is in the tree at `58c8171`. Follow the overview "Verify-only
rules". Rerun every Verification command with logs in
`tmp/canvas-theme-s539/appearance-01-preferences/s540/`. Expected: settings
tests exit 0, typecheck exit 0, zero `noUncheckedIndexedAccess` hits in
`settings/appearance*` and `settings/preferences*`, biome exit 0, and the
two grep counts (4 and 1). Do not edit source files unless one of these
fails in an owned file.
