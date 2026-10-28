# Desktop appearance: app theme, canvas background, PCB canvas

Status: accepted for implementation on `feat/canvas-theme`.
Open owner decisions: `design-docs/user-qa/appearance.md`. Each has a
default that this design implements.

## 1. Scope

The desktop app gets three persisted, live-applied preferences:

| Preference | Values | Default | Affects |
| --- | --- | --- | --- |
| `theme` | `system`, `light`, `dark` | `system` | All app chrome |
| `canvasBackground` | `light`, `dark`, `match` | `light` | Non-PCB page canvas |
| `pcbCanvasBackground` | `dark`, `light`, `match` | `dark` | PCB page canvas |

`match` means "use the resolved app theme". "Canvas" covers only the canvas
background colour, the dot grid, the rulers and the editing overlays drawn
over the document (selection, handles, guides). It never covers document
element paint.

Out of scope: theming document elements, the export dialog background
default, the PCB layer colour table, `pcb-view.ts`, `PcbShapeView.tsx`,
`PcbOverlay.tsx` inline colours, `BreadboardOverlay.tsx` inline colours, the
nodetto-cloud web app's own theme, and version bumps.

## 2. Invariants

1. Document element colours, stored or default, render the same in every
   appearance combination. This includes inherited default text colour and
   the colour scheme of native controls drawn inside elements. Exports
   (SVG, PNG, PDF, JSONL) take no input from appearance state.
2. With `theme=light` and `canvasBackground=light`, every computed colour on
   a diagram page equals today's value. Light token values do not change,
   with one exception: the light `--app-muted-label` (comment timestamps,
   formerly `#727b7e`, 4.33:1 on `--app-chrome-surface`) darkens to
   `#6d7679` (4.65:1) so it meets invariant 4. No other light value moves.
3. `packages/ui-solid` renders exactly as today when only today's light
   tokens are defined (nodetto-cloud), and when `NodettoCanvas` is given no
   new prop.
4. Panel text meets WCAG AA 4.5:1 in both themes. Canvas overlays
   (selection outline, handles, snap guides) meet the WCAG 1.4.11 non-text
   ratio of 3:1 against the canvas background in both canvas modes.

## 3. Preferences and resolution

### 3.1 Storage

`EditorPreferences` in `apps/desktop/src/settings/preferences.ts` gains
`theme`, `canvasBackground` and `pcbCanvasBackground`. The key stays
`nodetto.editor.preferences.v1`. Parsing rules:

- A missing key, a non-string value or an unknown string gives the default
  for that key only. Other keys still load.
- A missing or non-object payload (including the legacy
  `nodetto.view.show-rulers` path) gives all appearance defaults.
- Unreadable or malformed storage gives full defaults, as today.

### 3.2 Pure resolution module

New `apps/desktop/src/settings/appearance.ts` holds the value types, the
option lists used by the dialog, and pure functions:

- `resolveTheme(theme, systemPrefersDark): "light" | "dark"`.
- `resolveCanvasMode(pref, resolvedTheme): "light" | "dark"` for both canvas
  preferences (`match` returns `resolvedTheme`).
- `applyTheme(root, resolved)`: sets `root.dataset.nodettoTheme` to
  `light` or `dark` and `root.style.colorScheme` to the same value so native
  scrollbars and chrome form controls follow. The document layers reset
  `color-scheme` to `light` through the paint pin (5.3), so controls drawn
  inside elements do not follow it.
- `watchSystemTheme(media, onChange): () => void`: subscribes to a
  `MediaQueryList` for `(prefers-color-scheme: dark)` with
  `addEventListener("change")` and returns the disposer.

Lookups over the option lists use `as const` tuples and type guards so they
typecheck under `noUncheckedIndexedAccess`.

### 3.3 Data flow

1. `main.tsx` loads preferences, resolves the theme with
   `matchMedia("(prefers-color-scheme: dark)").matches`, and calls
   `applyTheme(document.documentElement, ...)` before `render()`. The CSP
   (`script-src` falls back to `'self'`) rules out an inline script in
   `index.html`; `style.css` is also loaded by `main.tsx`, so this is the
   earliest point where styling exists.
2. `App.tsx` owns three signals seeded from preferences, writes them through
   the existing `storeEditorPreferences` effect, and owns one effect that
   re-applies the theme whenever the preference or the system value changes.
   The system value is a signal fed by `watchSystemTheme`, disposed with
   `onCleanup`. Changing the macOS appearance therefore restyles the app
   without a reload.
3. In the Tauri host only (`isTauri()`), the same effect calls
   `getCurrentWindow().setTheme(theme === "system" ? null : theme)` so the
   native title bar matches the chrome. After the call resolves the effect
   re-reads `matchMedia(...).matches`, because the WebView's
   `prefers-color-scheme` follows the window theme. Errors are ignored; the
   CSS theme still applies. The capability
   `apps/desktop/src-tauri/capabilities/default.json` adds
   `core:window:allow-set-theme`. `tauri.conf.json` is not changed.
4. `App.tsx` passes `canvasBackground={{ diagram, pcb }}` to `NodettoCanvas`,
   each already resolved to `light` or `dark` with `resolveCanvasMode`.

### 3.4 Settings dialog

`SettingsDialog.tsx` gets an `Appearance` category directly after `General`
with three labelled `<select>` controls, using the existing
`app-settings-row` layout:

- Theme: System, Light, Dark.
- Canvas: Light, Dark, Match theme.
- PCB canvas: Dark, Light, Match theme.

A change calls a new `on...Change` prop, which sets the App signal. It
applies immediately and persists through the effect in 3.3.

## 4. Chrome tokens (`apps/desktop`)

### 4.1 Token blocks

`apps/desktop/src/styles/base.css` is the only file that declares chrome
colour values:

- `:root { ... }`: the light set. The 13 existing tokens keep their values.
  Tokens added while removing literals (4.2) take the exact literal they
  replace, so light rendering is unchanged.
- `:root[data-nodetto-theme="dark"] { ... }`: the dark set. It declares
  every token declared in the light `:root` block, and nothing else.

Starting dark values for the existing tokens:

| Token | Light | Dark |
| --- | --- | --- |
| `--nodetto-ink` | `#1d2a2e` | `#e6e9ea` |
| `--nodetto-muted` | `#596366` | `#a3adb1` |
| `--nodetto-line` | `#d8d2c3` | `#3a4245` |
| `--nodetto-surface` | `#fffdf8` | `#1f2427` |
| `--nodetto-canvas` | `#f6f4ee` | `#15191b` |
| `--nodetto-accent` | `#335c67` | `#7fb3bf` |
| `--nodetto-accent-soft` | `#dbe6e8` | `#24393e` |
| `--nodetto-grid` | `#e3ded1` | `#343c40` |
| `--app-chrome-surface` | `#ffffff` | `#1b1f21` |
| `--app-chrome-line` | `#dfe3e6` | `#33393c` |
| `--app-chrome-muted` | `#667078` | `#a3adb1` |
| `--app-chrome-hover` | `#f1f3f4` | `#262c2f` |
| `--app-chrome-active` | `#e5e9eb` | `#2f363a` |

The implementer may adjust dark values only to pass the contrast test (6).
New semantic tokens (for example `--nodetto-on-accent`, `--nodetto-danger`,
`--nodetto-warning-surface`, `--nodetto-shadow`) are added only when a
literal has no existing token with the same light value.

### 4.2 Literal removal

Every colour literal (hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, `white`,
`black`) in these files is replaced with a token reference. `transparent`,
`currentColor`, `inherit` and `color-mix()` over tokens stay allowed.

- `apps/desktop/src/*.css`: `buttons.css`, `inspector.css`, `pane.css`,
  `square-chrome.css`, `style.css`, `TemplateDialog.css`.
- `apps/desktop/src/styles/*.css`.
- `apps/desktop/src/settings/settings.css`.

Only colour values change. Selectors, layout and cascade order stay as they
are. The token blocks of 4.1, 5.2 and 5.3 are the only places literals may
appear.

### 4.3 `packages/ui-solid` chrome CSS

Chrome CSS shipped by ui-solid (`Toolbar.css`, `Layers.css`,
`BpmnProblemsPanel.css`, `BreadboardProblemsPanel.css`, `HelpHint.css`,
`ShapePalette.css`, `ShapeWarnings.css`, `Switch.css`, `PcbLayersPanel.css`,
`ExportDialog.css`, `ImageImport.css`, `Inspector.css`, `ZoomControls.css`,
`SelectionToolbar.css`, `inspector/AssetExportSection.css`) writes each
colour as `var(--token, <today's literal>)`. The fallback is the exact
literal used today, so nodetto-cloud (no dark tokens, possibly not all new
tokens) renders unchanged. Where the desktop light block defines the token,
its value must equal the fallback (tested in 6).

Document-rendering CSS under `packages/ui-solid/src/shapes/`
(`UiControlView.css`, `DatabaseObjectView.css`) is element paint and is not
tokenized (invariant 1).

## 5. Canvas background

### 5.1 ui-solid canvas mode

New `packages/ui-solid/src/canvas/canvas-background.ts` exports:

- `type CanvasMode = "light" | "dark"`.
- `interface CanvasBackgroundSetting { readonly diagram: CanvasMode;
  readonly pcb: CanvasMode }`.
- `canvasModeFor(pageKind, setting | undefined): CanvasMode`: `pcb` pages
  use `setting.pcb`, every other kind uses `setting.diagram`; an undefined
  setting returns `light` for every kind.

`NodettoCanvasProps` gains optional `canvasBackground?:
CanvasBackgroundSetting`, exported from `packages/ui-solid/src/index.ts`.
`Canvas.tsx` computes the mode from its existing page-kind lookup (the same
`getPage(currentPageId)?.kind` used by `isPcbPage`) and adds the class
`nodetto-canvas-dark` to the `.nodetto-canvas` root when the mode is
`dark`. Nothing else in `Canvas.tsx` changes. nodetto-cloud passes no prop
and keeps today's light canvas on every page. The desktop default
(`pcbCanvasBackground=dark`) is what makes PCB pages dark by default.

### 5.2 Canvas tokens (`apps/desktop/src/styles/canvas.css`)

`.nodetto-canvas` declares the light canvas set and
`.nodetto-canvas.nodetto-canvas-dark` declares the dark set with the same
names. These do not depend on the chrome theme: a light canvas under a dark
theme keeps the light canvas set.

| Token | Light (today's value) | Dark |
| --- | --- | --- |
| `--nodetto-canvas-bg` | `#f6f4ee` | `#15191b` |
| `--nodetto-canvas-grid` | `#e3ded1` | `#343c40` |
| `--nodetto-canvas-ruler-surface` | `#fffdf8` | `#1f2427` |
| `--nodetto-canvas-ruler-line` | `#d8d2c3` | `#3a4245` |
| `--nodetto-canvas-ruler-text` | `#596366` | `#a3adb1` |
| `--nodetto-canvas-overlay` | `#335c67` | `#5fb4c7` |
| `--nodetto-canvas-handle-fill` | `#fffdf8` | `#1f2427` |

Crop and gradient edit handles keep their image-contrast colours
(`#f8fafc`, `#f97316`, `#0f172a`, `rgb(15 23 42 / 45%)`) as canvas tokens
with the same value in both sets.

These rules switch to the canvas tokens: `.nodetto-canvas` background and
dot grid; `.nodetto-ruler*`; `.nodetto-image-drop-active`;
`.nodetto-connector.nodetto-selected`; `.nodetto-pending-connection`;
`.nodetto-marquee`; `.nodetto-selection-outline`; `.nodetto-handle`;
`.nodetto-endpoint-handle`; `.nodetto-hover-target`; `.nodetto-snap-guide`;
`.nodetto-ruler-draft`; `.nodetto-persistent-guide-label`; and the other
selection, handle and edit-handle rules in `canvas.css` and
`canvas-gestures.css` that use `--nodetto-accent` or `--nodetto-surface`
for overlay state. `CanvasRulers.tsx` keeps using classes only; persistent
guide colours stored in the document are not touched.

### 5.3 Document paint pin

Default element paint reads `--nodetto-ink`, `--nodetto-muted`,
`--nodetto-line`, `--nodetto-surface`, `--nodetto-accent` and
`--nodetto-accent-soft` (`canvas.css` defaults, `UmlComponentView.tsx`,
`TextNoteView.tsx`). In `canvas.css`, one block

```css
.nodetto-backdrop-layer, .nodetto-shape-layer, .nodetto-connector-layer,
.nodetto-text-editor {
  /* the six tokens with their light values */
  color: var(--nodetto-ink);
  color-scheme: light;
}
```

re-declares those six tokens with their light values, unconditionally, and
also declares `color: var(--nodetto-ink)` and `color-scheme: light`. The
two extra declarations are required because both properties are inherited
as computed values: `:root` sets `color: var(--nodetto-ink)`
(`apps/desktop/src/styles/base.css:22`), which resolves to the dark-theme
ink at `:root`, and element text without a stored colour inherits it
(`packages/ui-solid/src/shapes/visual.ts:133` emits `color` only for a
stored colour). `applyTheme` sets `color-scheme: dark` on `:root`, which the
native `input`, `select` and `textarea` controls drawn by
`packages/ui-solid/src/shapes/UiControlView.tsx` would inherit. Re-declaring
only the custom properties lower in the tree changes neither. Element
defaults therefore render identically in every theme and canvas mode,
matching exports. The overlay layer, the slot layer (comment pins and
popovers), rulers and the PCB layers panel stay outside the pin and follow
the chrome theme or the canvas tokens.

Consequence, accepted by default (`user-qa/appearance.md` Q1): on a dark
diagram canvas, elements without stored colours keep dark default strokes.

### 5.4 Comments and presence

- Comment pins keep their white border and coloured fill, which read on
  both canvas modes. Popovers follow the chrome theme.
- The presence layer (`apps/desktop/src/cloud/PresenceOverlay.tsx`) sits
  outside `.nodetto-canvas`. Cursors and labels use the collaborator's
  colour with a `#fffdf8` outline and label ink, which read on both canvas
  modes. The CSS literal becomes a token with the same value in both chrome
  sets. The inline `stroke="#fffdf8"` in the TSX stays.

### 5.5 PCB pages

PCB pages differ only through the canvas mode. The PCB layer colours
(`pcb-view.ts`) and `PcbOverlay.tsx` already target a dark board and are not
edited.

## 6. Verification

New `apps/desktop/src/styles/theme-tokens.test.ts` reads CSS with the
`@import` inliner pattern used by `apps/desktop/src/style.test.ts`:

1. No colour literal in the desktop files of 4.2 outside the allowed token
   blocks.
2. Dark/light parity: the dark `:root` block declares exactly the light
   block's names; the dark canvas block declares exactly the light canvas
   block's names.
3. The existing 13 light tokens and the light canvas tokens equal the
   values in the tables above (invariant 2).
4. The document paint pin block (selectors as in 5.3) declares the six
   custom properties with values equal to the light `:root` values, and
   also declares `color: var(--nodetto-ink)` and `color-scheme: light`. The
   test fails if any of these declarations is missing.
5. WCAG contrast, both themes: text pairs at 4.5:1 or more —
   (`--nodetto-ink`, `--nodetto-surface`), (`--nodetto-muted`,
   `--nodetto-surface`), (`--nodetto-ink`, `--app-chrome-surface`),
   (`--app-chrome-muted`, `--app-chrome-surface`), (`--app-chrome-muted`,
   `--app-chrome-hover`), (`--nodetto-accent`, `--nodetto-surface`), each
   `--nodetto-on-*` with its background, and every other text/background
   pair the tokenization introduces. Canvas pairs, for both canvas sets:
   (`--nodetto-canvas-overlay`, `--nodetto-canvas-bg`) at 3:1 or more, and
   (`--nodetto-canvas-ruler-text`, `--nodetto-canvas-ruler-surface`) at
   4.5:1 or more. The starting values in 4.1 and 5.2 measure: light
   chrome muted on hover 4.54, dark chrome muted on hover 6.18, dark ink on
   surface 12.84, canvas overlay 6.66 (light) and 7.45 (dark).
6. ui-solid chrome CSS (4.3): every colour literal is the fallback of a
   `var()`, and when the desktop light block defines that token its value
   equals the fallback.
7. Export isolation: export sources (`packages/core/src/svg-export*`,
   `packages/core/src/pcb-export.ts`, `packages/ui-solid/src/raster-export.ts`,
   `pdf-export.ts`, `pcb-export.ts`, `breadboard-export.ts`,
   `packages/io/src/jsonl/`) contain no reference to `data-nodetto-theme`,
   `nodetto-canvas-dark`, `canvasBackground`, `matchMedia`,
   `getComputedStyle` or the appearance module. Existing export golden and
   round-trip tests pass unchanged.

Also:

- `apps/desktop/src/settings/preferences.test.ts`: defaults
  (`system`/`light`/`dark`), round trip, invalid values per key, a stored v1
  payload without the new keys, and the legacy `nodetto.view.show-rulers`
  path.
- `apps/desktop/src/settings/appearance.test.ts`: `resolveTheme`,
  `resolveCanvasMode` (all nine combinations), `applyTheme` on a stub root,
  `watchSystemTheme` with a fake `MediaQueryList` (fires, then stops after
  dispose).
- `packages/ui-solid/src/canvas/canvas-background.test.ts`: PCB versus
  other page kinds, undefined setting gives light everywhere, desktop
  defaults give dark PCB and light diagram.
- Commands: `bun test apps/desktop/src/settings`,
  `bun test apps/desktop/src/styles/theme-tokens.test.ts
  apps/desktop/src/style.test.ts`,
  `bun test packages/ui-solid/src/canvas/canvas-background.test.ts
  packages/ui-solid/src/canvas-rulers.test.ts`, `bun run typecheck`,
  `BUN_OPTIONS=--jsx-runtime=classic mise run verify`, `mise run build`.

## 7. Documentation

The README feature list gains one line on appearance settings. This file is
the design record.
