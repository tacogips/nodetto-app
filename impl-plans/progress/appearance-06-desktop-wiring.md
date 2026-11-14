# appearance-06-desktop-wiring progress

## Intent snapshot

Implement the assigned wave-2 desktop wiring only. In `main.tsx`, load persisted preferences using guarded localStorage and apply the resolved theme before `render`, with matchMedia and theme application guarded so startup still renders. In `App.tsx`, add theme/canvas preference signals, system appearance tracking, live root theme application, a theme-only Tauri title-bar effect with media re-read and ignored rejection, persist all three keys, and pass resolved canvas modes and preference setters into `NodettoCanvas` and `SettingsDialog`. In `SettingsDialog.tsx`, add Appearance immediately after General and three guarded, labelled selects in the specified order. Add `core:window:allow-set-theme` after `core:default` and one README appearance feature line. No CSS, Rust, tauri.conf, dependencies, exports, document data, or unrelated behavior changes.

## Initial evidence

- Accepted dependencies per dispatch: `appearance-01-preferences`, `appearance-02-canvas-mode`.
- Before-edit hashes: main.tsx `1a29db946cef3e8b3434ceac2ffc5136ba4d674e6fe83bc64d608338637026b0`; App.tsx `40b2360f6966a7f21efc0e5b83544f180eac4bdfeffb28797c998e3899d1e620`; SettingsDialog.tsx `fb7149c2df20152726b0e4439d64df631ab09e62f8080167d17974baf80a9926`; capability `60a15f5de7590e28bf6561258fe6449543630b52197f0ee697c4a273ff5a7b76`; README `da77e2acd0b390913aa986f2186cd7bc6845152b4a78bb2343c4d9e934b61df2`.
- Repository already contains concurrent edits in appearance-01/02/03/04 paths; preserve them. Plan 03 progress is currently `STATUS: incomplete`, plan 05 has not completed, so shared wave-2 CSS-reading gates may be pending-join.

## Implementation and verification

- `apps/desktop/src/main.tsx`: loads `EditorPreferences` through guarded localStorage, resolves `SYSTEM_DARK_QUERY`, and calls `applyTheme(document.documentElement, ...)` in try/catch before `render`.
- `apps/desktop/src/App.tsx`: owns the three appearance signals, `systemDark`, `resolvedTheme` memo, live `applyTheme` effect, and theme-only Tauri `setTheme` effect. Tauri rejection is ignored; media state is reread after resolution. All three preferences are persisted and resolved diagram/PCB canvas modes are passed to `NodettoCanvas`.
- `apps/desktop/src/settings/SettingsDialog.tsx`: adds Appearance after General with Theme, Canvas and PCB canvas selects, required aria labels, option tuple order and guards; no cast was added for the new controls.
- `apps/desktop/src-tauri/capabilities/default.json`: adds `core:window:allow-set-theme` after `core:default`. `README.md`: adds the appearance feature line after Design artboards.
- Final SHA-256: main.tsx `0036079ec57a4c7e12a6ecaab83726a1845e416eca2d856f4cbd59a9d825c3a2`; App.tsx `26874f8ef100a87c3f1894be7bd0a3496192bcd2e3bd389b0e3ad38b834b3273`; SettingsDialog.tsx `c267ecd207e53b9008d5fa30b89d899547cc145d4c0afc81fd353dd2d905b093`; capability `249e49d2c4c4df4d6f11e30b4635c959d0acfaf30a087d85c553218dae7f5731`; README `1fd68bfe9322b326f7d09040cec8b31cec582b15237703c5d617a2a44b9d1705`.

| Command | Exit | Evidence |
| --- | ---: | --- |
| `bun run typecheck` | 0 | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/typecheck.log` |
| `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess` | 2 | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/unchecked.log`; 91 existing diagnostics outside this plan's three files |
| `test "$(grep -c 'apps/desktop/src/App.tsx\\|apps/desktop/src/main.tsx\\|SettingsDialog.tsx' tmp/canvas-theme-s539/appearance-06-desktop-wiring/unchecked.log)" -eq 0` | 0 | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/unchecked-scope-assertion.log`; scope count 0 |
| `bun test apps/desktop/src/settings` | 0 | 14 pass, 0 fail; `tmp/canvas-theme-s539/appearance-06-desktop-wiring/settings-tests.log` |
| `BUN_OPTIONS=--jsx-runtime=classic bun test apps/desktop/src` | 0 | 180 pass, 0 fail; **pending-join** because plan 05 has no `STATUS: done` progress log; rerun in serial reconciliation. Log: `tmp/canvas-theme-s539/appearance-06-desktop-wiring/desktop-tests-classic.log` |
| `bunx biome check apps/desktop/src/main.tsx apps/desktop/src/App.tsx apps/desktop/src/settings/SettingsDialog.tsx --diagnostic-level=warn` | 0 | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/biome.log` |
| `test "$(grep -c 'allow-set-theme' apps/desktop/src-tauri/capabilities/default.json)" -eq 1` | 0 | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/capability-count.log` |
| `git diff --quiet -- apps/desktop/src-tauri/tauri.conf.json` | 0 | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/tauri-config.log` |
| `bunx biome format --write apps/desktop/src/main.tsx apps/desktop/src/App.tsx apps/desktop/src/settings/SettingsDialog.tsx` | 0 | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/format-retry.log` |

Prior attempt: plain `bun test apps/desktop/src` exited 1 due Bun's `jsxDEV` export/runtime mismatch after 178 passing tests; complete log `tmp/canvas-theme-s539/appearance-06-desktop-wiring/desktop-tests.log`. Rerunning the same suite with the repository's classic JSX option passed 180/180 on the same source tree. The strict noUncheckedIndexedAccess command exits 2 from unrelated repository diagnostics; the plan-owned path scope assertion is zero.

## Completion criteria

Assigned source behavior and scoped checks are complete. Desktop suite result is passing but remains pending-join under overview protocol rule 8 because plan 05 is not complete. Typecheck is also recorded pending-join for the same-wave shared-input reconciliation. No implementation blocker or unaddressed plan-owned finding.

STATUS: done

## Session 540 re-verification

The stale `Status: in progress` header has been removed. The generated Tauri capability schema already matches the source capability exactly; both declare only `core:default` and `core:window:allow-set-theme`. No schema edit was needed. `tauri.conf.json` is unchanged. Source implementation remains unchanged and satisfies the accepted wave-2 wiring contract.

| Command | Exit | Outcome | Evidence |
| --- | ---: | --- | --- |
| `bun run typecheck` | 0 | pass | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/typecheck.log` |
| `bun test apps/desktop/src/settings` | 0 | 14 pass, 0 fail, 65 expect() | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/settings.log` |
| `BUN_OPTIONS=--jsx-runtime=classic bun test apps/desktop/src` | 0 | 180 pass, 0 fail, 940 expect(); pending-join because plan 05 progress is absent | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/desktop.log` |
| `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess` | 2 | 91 diagnostics, identical to the recorded baseline; not a green aggregate | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/unchecked.log`; comparison `tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/unchecked-comparison.json` |
| `test "$(grep -c 'apps/desktop/src/App.tsx\\|apps/desktop/src/main.tsx\\|SettingsDialog.tsx' tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/unchecked.log)" -eq 0` | 0 | no diagnostics in the three owned TSX files | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/scope.log` |
| `bunx biome check apps/desktop/src/main.tsx apps/desktop/src/App.tsx apps/desktop/src/settings/SettingsDialog.tsx --diagnostic-level=warn` | 0 | pass | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/biome-final.log` |
| capability JSON assertions | 0 | both files contain exactly the two expected permissions | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/capability.log`, `generated-capability.log` |
| `git diff --quiet -- apps/desktop/src-tauri/tauri.conf.json` | 0 | unchanged | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/tauri-config.log` |
| stale-header assertion | 0 | no `Status: in progress` line | `tmp/canvas-theme-s539/appearance-06-desktop-wiring/s540/status-header.log` |

Final source hashes before this progress append: main.tsx `0036079ec57a4c7e12a6ecaab83726a1845e416eca2d856f4cbd59a9d825c3a2`; App.tsx `26874f8ef100a87c3f1894be7bd0a3496192bcd2e3bd389b0e3ad38b834b3273`; SettingsDialog.tsx `c267ecd207e53b9008d5fa30b89d899547cc145d4c0afc81fd353dd2d905b093`; `default.json` `249e49d2c4c4df4d6f11e30b4635c959d0acfaf30a087d85c553218dae7f5731`; generated `capabilities.json` `4c835544d8e8466ccb481bda58137bb3667055beaadf449d1dc7de1737c8692f`; README `1fd68bfe9322b326f7d09040cec8b31cec582b15237703c5d617a2a44b9d1705`. Post-append progress hash is recorded in `s540/progress-final.sha256`.

Completion: assigned implementation and plan-owned checks are complete. Desktop tests are pending-join under overview rule 8 until the same-wave plan 05 progress log ends with `STATUS: done`; rerun in reconciliation. The repository-wide noUncheckedIndexedAccess failure is unchanged from the accepted baseline and remains visibly non-green. No implementation blocker or unaddressed plan-owned finding.

STATUS: done
