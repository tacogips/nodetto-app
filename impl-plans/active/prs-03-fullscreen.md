# prs-03-fullscreen

- planId: prs-03-fullscreen
- planPath: impl-plans/active/prs-03-fullscreen.md
- progressPath: impl-plans/progress/prs-03-fullscreen.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-presentation.md` section 7. Rules:
  `impl-plans/active/prs-00-overview.md`.
- writePaths:
  - `apps/desktop/src/shell/presentation-fullscreen.ts` (new)
  - `apps/desktop/src/shell/presentation-fullscreen.test.ts` (new)
  - `apps/desktop/src-tauri/capabilities/default.json`
  - `impl-plans/progress/prs-03-fullscreen.md`
  - `tmp/prs-s793/prs-03-fullscreen`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Enter real fullscreen when a presentation starts and restore the previous
state when it ends. In the Tauri desktop app, use the window API. In a plain
browser, use the DOM Fullscreen API. In all other cases do nothing, because
the overlay already fills the viewport. Also report when the browser leaves
fullscreen by itself (the user presses Esc), so the presentation can end.
`App.tsx` already imports `isTauri` (`@tauri-apps/api/core`) and
`getCurrentWindow` (`@tauri-apps/api/window`). Imitate that.

## Non-goals

- No App wiring (prs-06). No Rust changes.
- No `gen/schemas` changes: they list every available permission and must
  stay byte-identical.

## File-level changes

1. `presentation-fullscreen.ts`:
   - `interface PresentationFullscreenSession { readonly mode: "tauri" | "dom" | "none"; restore(): Promise<void> }`
   - `interface PresentationFullscreenEnv`, minimal structural types:
     - `isTauri(): boolean`
     - `tauriWindow(): { isFullscreen(): Promise<boolean>; setFullscreen(value: boolean): Promise<void> }`
     - `document`: `fullscreenEnabled?: boolean`, `fullscreenElement: unknown`,
       `documentElement: { requestFullscreen?(): Promise<void> }` and
       `exitFullscreen?(): Promise<void>`
   - `defaultFullscreenEnv()` builds the env from the real APIs.
   - `enterPresentationFullscreen(env = defaultFullscreenEnv()): Promise<PresentationFullscreenSession>`:
     - Tauri:
       - `was = await isFullscreen()`
       - `await setFullscreen(true)`
       - restore calls `setFullscreen(was)`
       - mode `"tauri"`
     - DOM, when `fullscreenEnabled` and `requestFullscreen` exists:
       - request fullscreen
       - restore calls `exitFullscreen()` only when `fullscreenElement` is
         non-null
       - mode `"dom"`
     - Any thrown or rejected step -> mode `"none"` with a no-op restore.
       It never rejects.
     - `restore()` swallows errors and is idempotent: a second call does
       nothing.
   - `watchFullscreenExit(doc: { fullscreenElement: unknown; addEventListener(type: "fullscreenchange", fn: () => void): void; removeEventListener(type: "fullscreenchange", fn: () => void): void }, onExit: () => void): () => void`:
     - calls `onExit` once, when a `fullscreenchange` leaves
       `fullscreenElement` null
     - returns the remover
2. `capabilities/default.json`: append `"core:window:allow-set-fullscreen"`
   to `permissions`, keeping the existing two entries in order and the
   2-space formatting.
   - Add `"core:window:allow-is-fullscreen"` only if a desktop build
     reports that it is missing. Record the evidence.

## Pitfalls

- Do not call `requestFullscreen` in the Tauri path. WKWebView DOM
  fullscreen is not reliable.
- The restore must return to the prior state: a window that was already
  fullscreen stays fullscreen.
- Unit tests must use a fake env. They must not import the real Tauri
  modules at test time beyond module load, and `defaultFullscreenEnv` must
  be lazy (called only inside the default parameter).

## Tests (input -> expected)

- Fake Tauri env with `was=false`:
  - enter -> `setFullscreen(true)` called, mode `"tauri"`
  - restore -> `setFullscreen(false)`
  - a second restore -> no call
- Tauri with `was=true` -> restore calls `setFullscreen(true)`.
- Tauri `setFullscreen` rejects -> mode `"none"`, no throw.
- DOM env enabled -> `requestFullscreen` called, mode `"dom"`. Restore with
  `fullscreenElement` set -> `exitFullscreen` called. Restore with it null
  -> not called.
- DOM `fullscreenEnabled` false, or `requestFullscreen` rejects -> mode
  `"none"`.
- `watchFullscreenExit`:
  - a change with the element null -> `onExit` once
  - a change with the element set -> no call
  - after the remover -> no call

## Verification (exits 0 with at least 1 pass and 0 fail; log in `tmp/prs-s793/prs-03-fullscreen/final/`)

1. `bun test ./apps/desktop/src/shell/presentation-fullscreen.test.ts` -> `fullscreen.log`

Static checks, which are not verification commands; record each exit status:

- Biome on the owned TS files, then `bun run typecheck`.
- `jq -e '.permissions | index("core:window:allow-set-fullscreen")' apps/desktop/src-tauri/capabilities/default.json`
  exits 0.
- `git diff --exit-code -- apps/desktop/src-tauri/gen/schemas` exits 0.

## Done criteria

- Verification 1 and both static checks exited 0.
- The progress log has the intent hash, per-edit hashes and command results.
