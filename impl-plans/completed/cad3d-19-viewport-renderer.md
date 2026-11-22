# M19 cad3d-19-viewport-renderer

- dependsOn: M6 (mode, workspace, page kind in the UI), M8 (camera, pick,
  theme)
- Design: sections 5 (viewport, selection), 6.7, 13, 14 (browser check)
- writePaths: `packages/ui-solid/src/cad/renderer.ts` (new),
  `packages/ui-solid/src/cad/CadViewport.tsx` (new),
  `packages/ui-solid/src/cad/CadViewport.css` (new),
  `packages/ui-solid/src/cad/viewport.test.tsx` (new),
  `packages/ui-solid/src/Canvas.tsx`, `packages/ui-solid/src/index.ts`,
  `apps/desktop/src/App.tsx`, `apps/desktop/src/styles/theme-tokens.test.ts`
  (append `cad/CadViewport.css` to `UI_SOLID_CHROME_FILES` only),
  `apps/desktop/scripts/cad-viewport-check.mjs` (new),
  `apps/desktop/scripts/fixtures/cad-viewport.html` (new),
  `apps/desktop/scripts/fixtures/cad-viewport.tsx` (new),
  `apps/desktop/package.json` (script `check:cad-viewport`)

## Contract

```ts
// renderer.ts
export interface CadRenderer { setBodies(bodies: readonly CadDisplayBody[]): void;
  setTheme(theme: CadTheme): void;
  setHighlight(pick: { bodyId: ElementId; faceName?: string } | null): void;
  setOverlay(lines: Float32Array | null, mesh: { positions: Float32Array; indices: Uint32Array } | null): void;
  draw(camera: Camera3d, widthPx: number, heightPx: number): void;
  readonly diagnostics: { readonly programsLinked: boolean; readonly renderer: string };
  dispose(): void }
export function createWebgl2Renderer(canvas: HTMLCanvasElement): CadRenderer | null; // null without WebGL2
```

`CadViewport` props: `editor`, `engine: CadEngine | undefined`,
`createRenderer?` (test seam, default `createWebgl2Renderer`).

## Behavior

- Renderer: one program for faces (flat normal from `dFdx`/`dFdy` of the
  view position, head light, polygon offset), one for line segments (edges,
  grid, overlays). Body colour, line colour and highlight come from the
  theme; reference bodies are drawn at reduced opacity; the highlighted
  face is tinted with the highlight colour. GPU buffers are rebuilt only in
  `setBodies` and `setOverlay`. A shader compile or link failure sets
  `programsLinked` false and makes `createWebgl2Renderer` return null.
- `CadViewport` subscribes to the store revision, calls `collectCadInput`
  and `engine.evaluate` when a CAD element (or a collected foreign element)
  changed, ignores `CadSupersededError`, keeps the last good bodies on
  failure and shows the failure text in a status strip built from existing
  chrome classes. Pointer: left drag on empty space orbits, middle or shift
  drag pans, wheel zooms, click picks (`pickBodies`) and selects the body's
  feature through the editor selection API, storing the picked face name in
  a signal for later milestones. Double click fits the view.
- Theme: `readCadTheme` on mount and whenever the canvas mode memo changes
  (`canvasModeFor`), reading `getComputedStyle` of the viewport root, which
  carries the same `nodetto-canvas` classes as the 2D canvas.
- `Canvas.tsx`: when the current page kind is `cad3d`, render `CadViewport`
  inside the existing root instead of the viewport layers; no 2D pointer
  handler or 2D creation module is active on a CAD page. `NodettoCanvas`
  gains the optional prop `cadEngine`; `App.tsx` passes `getCadEngine()`
  lazily.
- Without WebGL2 or without an engine: message in the status strip, no
  throw, layers and inspector unaffected.
- `CadViewport.css`: only `var(--token)` references to existing tokens, no
  colour literals, no fallbacks. The status strip uses chrome tokens on a
  chrome surface.
- Browser check (`cad-viewport-check.mjs`), following
  `apps/desktop/scripts/erd-scale-check.mjs` for Chrome discovery
  (`CHROME_BIN`), the CDP port and cleanup:
  1. Builds `scripts/fixtures/cad-viewport.html` with the Vite JS API
     (same plugins and aliases as `apps/desktop/vite.config.ts`) into
     `tmp/cad3d/viewport-check/dist`. The fixture mounts `NodettoCanvas`
     with the Plate document on a CAD page and the real `getCadEngine()`,
     and exposes `window.__cadCheck` (engine result summary, renderer
     diagnostics, a `readPixels(x, y)` helper, a `setCanvasMode(mode)`
     helper, an `editRadius(mm)` helper, timings).
  2. Serves that directory from a `Bun.serve` static server on a free port,
     sending the production `csp` string from
     `apps/desktop/src-tauri/tauri.conf.json` as the
     `Content-Security-Policy` header and `application/wasm` for `.wasm`.
  3. Launches headless Chrome with software GL allowed and asserts: no CSP
     violation and no page error was reported; the engine returned one
     body (worker and WASM loaded under the production CSP);
     `programsLinked` is true; at the canvas centre the pixel differs from
     the background token colour in the light canvas mode and in the dark
     canvas mode, and the two centre pixels differ from each other; after
     `editRadius` a pixel inside the first hole changes; edit to display is
     under 2,000 ms (budget 250 ms is recorded).
  4. Writes `tmp/cad3d/<label>/viewport-check.json` (`--label`, default
     `m19`) and exits non-zero on any failed assertion. `--budget`
     additionally enforces 250 ms edit-to-display and, when
     `diagnostics.renderer` is not a software renderer, 16 ms per camera
     frame on a generated 200,000 triangle page.

## Tests

- `viewport.test.tsx` (happy-dom, fake renderer and engine): mounting on a
  CAD page calls `evaluate` once and `setBodies` with the result; a store
  edit triggers one more; an engine failure shows the message and keeps
  bodies; a click with a stubbed pick selects the feature id; switching to
  a freeform page unmounts the viewport and disposes the renderer; on a CAD
  page the 2D shape layer and its creation handlers are not in the DOM; a
  missing renderer shows the message and the layers panel still renders.
- `theme-tokens.test.ts` passes with the new CSS file listed.
- The browser check passes (verification 3).

## Acceptance criteria

- No new CSS custom property is declared anywhere.
- `tmp/cad3d/m19/viewport-check.json` exists with all assertions true.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/ui-solid/src/cad apps/desktop/src/styles/theme-tokens.test.ts'`
2. `sh -c 'bunx biome check packages/ui-solid/src/cad packages/ui-solid/src/Canvas.tsx apps/desktop/scripts/cad-viewport-check.mjs && bun test packages/ui-solid/src/cad/viewport.test.tsx packages/ui-solid/src/canvas-paint-order.test.ts'`
3. `sh -c 'bun apps/desktop/scripts/cad-viewport-check.mjs --label m19 && bun test packages/ui-solid/src/cad/viewport.test.tsx'`
