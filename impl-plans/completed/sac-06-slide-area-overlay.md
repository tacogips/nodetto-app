# sac-06-slide-area-overlay

- planId: sac-06-slide-area-overlay
- planPath: impl-plans/active/sac-06-slide-area-overlay.md
- progressPath: impl-plans/progress/sac-06-slide-area-overlay.md
- wave: 2
- dependsOn: sac-01-slide-data, sac-03-slide-rect-core
- Design: `design-docs/specs/design-slide-area-copy-shapes.md` sections 5.1, 5.2 and 9 (SAC-DES-001 and SAC-DES-002 resolutions).
- writePaths:
  - `packages/ui-solid/src/canvas/slide-area.ts` (new)
  - `packages/ui-solid/src/canvas/slide-area.test.ts` (new)
  - `packages/ui-solid/src/canvas/SlideAreaOverlay.tsx` (new)
  - `packages/ui-solid/src/Canvas.tsx`: the optional prop and one mount only
  - `packages/ui-solid/src/presentation/controller.ts`
  - `packages/ui-solid/src/presentation/controller.test.ts`
  - `packages/ui-solid/src/presentation/slide-clip.test.ts` (new)
  - `impl-plans/progress/sac-06-slide-area-overlay.md`
  - `tmp/sac-s826/sac-06-slide-area-overlay`
  - `target`
  - `apps/desktop/dist`
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Intent and context

Authors must see what the slideshow will show, so the canvas gets a dashed
slide-area outline and a label. It is DOM-only, never exported and never
hit-tested.

When the document has a `slideSize`, the presentation must show exactly that
rect, clipped. The controller owns rendering and fitting
(`controller.ts:69-98`). `PresentationView.tsx` only delegates to it and
must NOT be edited.

## Non-goals

- Do not edit `PresentationView.tsx`, `App.tsx`, `ZoomControls.tsx` or any
  `packages/core` file.
- Add no CSS file: use inline SVG attributes.
- No preference storage (sac-08).

## File-level changes

1. `slide-area.ts` (pure):
   - `effectiveShowSlideArea(pref: boolean | undefined, slideSize: SlideSize | undefined): boolean`
     is `pref ?? (slideSize !== undefined)`.
   - `slideAreaModel(input: { rect: SlideRect | null; label: string | null; show: boolean }): { rect: SlideRect; label: string | null; dim: boolean } | null`
     returns `null` when `!show` or `!rect`. Otherwise `dim` is
     `rect.kind === "explicit"`.
   - Import `SlideSize` and `SlideRect` from `@nodetto/core`.
2. `SlideAreaOverlay.tsx`: props `{ editor: Editor; revision: Accessor<number>; zoom: Accessor<number>; show: Accessor<boolean | undefined> }`.
   - A memo reads `revision()` and `editor.currentPageId`.
   - It resolves the rect with
     `resolveSlideRect(editor.store, editor.registry, pageId, { slideSize: meta.slideSize, slideOrigin: page?.slideOrigin })`,
     and the label with `slideLabel(editor.store.listPages(), pageId)`.
   - `show` is `effectiveShowSlideArea(show(), meta.slideSize)`.
   - Render a `<g class="nodetto-slide-area" pointer-events="none">`
     containing:
     - When `dim`: a `<path fill-rule="evenodd" fill="rgba(0,0,0,0.06)">`
       made of a large outer rect (rect ± 100000) plus the slide rect.
     - A `<rect>` with `fill="none"`, `stroke-dasharray="6 4"`,
       `vector-effect="non-scaling-stroke"`.
     - A `<text>` at `(rect.x, rect.y - 6 / zoom())` with
       `font-size={12 / zoom()}`.
3. `Canvas.tsx`:
   - Add `readonly showSlideArea?: boolean;` to `NodettoCanvasProps` (doc
     comment: omitted means automatic).
   - Mount `<SlideAreaOverlay ... show={() => props.showSlideArea} />` as
     the first child of the `nodetto-overlay-layer` svg (`Canvas.tsx:384`),
     before the breadboard and pcb overlays and `SelectionOutlines`. The
     layer uses the same page space as `SelectionOutlines`.
   - Pass `zoom={cameraZoom}` and `revision={signals.rev}`.
4. `controller.ts` `slide()`, when `editor.store.getMeta().slideSize` is
   set:
   - `rect = resolveSlideRect(...)` (explicit kind).
   - `svg = editor.exportPageSvgOf(page, { viewport: { x, y, width, height } })`.
   - `result = { src: svg ? dataUrl : null, size: { width: rect.width, height: rect.height } }`.
   - Keep the existing cache object and the `encodeURIComponent` data-URL
     code. The else-branch is the current code, untouched. `layout()` stays
     unchanged; it already uses `slide().size`.

## Pitfalls

- Required props break wave 2: `showSlideArea` MUST be optional, because
  `App.tsx:687/855/926` are not edited until sac-08.
- The overlay must never be inside the shape layer or any exported tree.
  The core renderers never see it.
- An empty explicit slide must still return `size` equal to the rect
  (`src` null). Do not fall back to `svgSize`.
- Check the `SvgExportOptions.viewport` type: it is `Box` from core. Build
  it from the rect fields; do not pass `kind`.
- `getPage(pageId)` can be `undefined`. Use optional chaining.

## Tests (input -> expected)

- `slide-area.test.ts`:
  - `effectiveShowSlideArea(undefined, {1920,1080})` -> true
  - `effectiveShowSlideArea(undefined, undefined)` -> false
  - `effectiveShowSlideArea(false, size)` -> false
  - `effectiveShowSlideArea(true, undefined)` -> true
  - model: an explicit rect plus a label -> `dim` true, and the label is
    kept
  - model: a content rect -> `dim` false
  - `show` false -> `null`; `rect` null -> `null`
  - `renderPageSvg` of a document with `slideSize` contains no
    `nodetto-slide-area`
- `slide-clip.test.ts` (imitate `controller.test.ts` with `makeEditor`,
  `document` and `element` from `packages/core/src/test-helpers.ts`; spread
  `slideSize` into the document):
  - `slideSize {1920,1080}` with page `slideOrigin {100,-50}`, and a rect
    at (10,10) and another at (5000,5000):
    - `slide().size` is `{1920,1080}`
    - the decoded src `<svg>` has `viewBox="100 -50 1920 1080"` and width
      1920 / height 1080
    - `layout({1000,1000})` equals `fitSlide({1920,1080},{1000,1000})`
  - An empty page with `slideSize` -> `src` null, `size` `{1920,1080}`, and
    the `layout` aspect ratio is 16:9.
  - No `slideSize` -> `slide()` equals the result of the current
    artboard/page code (compare with
    `svgSize(editor.exportPageSvgOf(page, { padding: 0 }))`).
- `controller.test.ts`: the existing tests pass unchanged. Add one case:
  editing `updateDocument` while presenting invalidates the cache, so the
  `size` changes.

## Verification (each exits 0 with at least 1 pass and 0 fail; logs in `tmp/sac-s826/sac-06-slide-area-overlay/final/`)

1. `bun test ./packages/ui-solid/src/canvas/slide-area.test.ts ./packages/ui-solid/src/presentation/controller.test.ts ./packages/ui-solid/src/presentation/slide-clip.test.ts` -> `ui.log`
2. `bun test ./packages/ui-solid/src/canvas-paint-order.test.ts ./packages/ui-solid/src/presentation/keys.test.ts` -> `regression.log`
3. `bun run typecheck` -> `typecheck.log` (with `App.tsx` untouched)

Static: `bunx biome check` on the owned files.

## Done criteria

- Verifications 1-3 exited 0.
- `git diff --stat -- packages/ui-solid/src/presentation/PresentationView.tsx apps/desktop/src/App.tsx`
  is empty.
- The progress log has the intent hash, per-edit hashes and the exit
  statuses.
