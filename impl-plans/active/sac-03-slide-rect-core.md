# sac-03-slide-rect-core

- planId: sac-03-slide-rect-core
- planPath: impl-plans/active/sac-03-slide-rect-core.md
- progressPath: impl-plans/progress/sac-03-slide-rect-core.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-slide-area-copy-shapes.md` sections 4.1-4.3 and 9.
- writePaths:
  - `packages/core/src/presentation/slide-rect.ts` (new)
  - `packages/core/src/presentation/slide-rect.test.ts` (new)
  - `packages/core/src/presentation/slide-size.ts` (new)
  - `packages/core/src/presentation/slide-size.test.ts` (new)
  - `packages/core/src/presentation/labels.ts` (new)
  - `packages/core/src/presentation/labels.test.ts` (new)
  - `packages/core/src/presentation/index.ts`: append three `export *` lines
  - `impl-plans/progress/sac-03-slide-rect-core.md`
  - `tmp/sac-s826/sac-03-slide-rect-core`
  - `target`
  - `apps/desktop/dist`
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Intent and context

Add pure, DOM-free logic that says which rect a page's slide is. The canvas
overlay (sac-06), the presentation controller (sac-06) and the settings UI
(sac-07) use it.

Inputs are structural, so this plan does not depend on the IR change in
sac-01: callers pass `slideSize` and `slideOrigin` in. The core barrel
already re-exports `./presentation/index.ts` (`packages/core/src/index.ts:820`).

## Non-goals

- Do not modify `source.ts`, `slides.ts`, `fit.ts`, `navigation.ts` or
  `packages/core/src/index.ts`.
- No rendering and no DOM.

## File-level changes

1. `slide-rect.ts`: `SlideRect` and `resolveSlideRect` exactly as pinned in
   `sac-00-overview.md`.
   - With `input.slideSize`, return
     `{ kind: "explicit", x: origin?.x ?? 0, y: origin?.y ?? 0, width, height }`,
     even for an empty page or a page with frames.
   - Otherwise call `slideSource(store, registry, pageId, isHidden)` with
     the existing function.
   - `artboard`: `viewBounds(store, [frameId], context)`, with
     `context = createShapeContext(store, registry, 1)` (import from
     `../hit-test.ts` and `../view-bounds.ts`, not the barrel). That gives
     `{ kind: "artboard", frameId, ...box }`. A null box falls back to the
     content bounds.
   - `page`: `viewBounds(store, all page element ids, context)` gives
     `{ kind: "content", ...box }`.
   - No bounds -> `null`.
2. `slide-size.ts`:
   - `SlideSizePresetId`, `SLIDE_SIZE_PRESETS` in this order:
     - 16:9 1920x1080
     - 4:3 1024x768
     - 16:10 1920x1200
     - a4-landscape 1123x794, label "A4 landscape"
   - `DEFAULT_SLIDE_SIZE` (the 16:9 size).
   - `slideSizePreset(size)`: exact width and height match, else `"custom"`.
   - Use the `SlideSize` type from `./fit.ts`; do not declare a new one.
3. `labels.ts`: `slideLabel(pages, pageId)`.
   - Unknown page -> `null`.
   - `hiddenInPresentation === true` -> `"Hidden from presentation"`.
   - Otherwise `` `Slide ${n} / ${total}` ``, using `slideList(pages)` from
     `./slides.ts`.
4. `index.ts`: append `export * from "./slide-rect.ts";`,
   `export * from "./slide-size.ts";` and `export * from "./labels.ts";`.

## Pitfalls

- Name collisions in the `@nodetto/core` barrel: `SlideSize` already exists
  (fit.ts). Do not export another `SlideSize`, `Box` or `Rect`. Grep the
  core barrel for every new exported name before you add it.
- `viewBounds` takes element ids. Pass `getPageElements(pageId).map((e) => e.id)`.
- An explicit rect ignores frames entirely. Do not pick the artboard when a
  size is set.

## Tests (input -> expected)

- `slide-rect.test.ts` (fixtures like `packages/core/src/presentation/source.test.ts`):
  - size 1920x1080 with no origin -> explicit `{0,0,1920,1080}`
  - origin `(100,-50)` -> explicit `{100,-50,1920,1080}`
  - an empty page with a size -> explicit; an empty page without a size ->
    `null`
  - one visible frame with no size -> `artboard` with the frame bounds and
    the `frameId`
  - two frames -> `content` equal to the union bounds
  - a rectangle only -> `content` with the rectangle's bounds
  - a frame inside a hidden group plus a rectangle -> `content`
- `slide-size.test.ts`:
  - the preset order and sizes
  - `DEFAULT_SLIDE_SIZE` is 1920x1080
  - `slideSizePreset({1024,768})` -> `"4:3"`
  - `slideSizePreset({1000,700})` -> `"custom"`
- `labels.test.ts`: `[a, b(hidden), c]`:
  - a -> "Slide 1 / 2"
  - b -> "Hidden from presentation"
  - c -> "Slide 2 / 2"
  - unknown -> `null`

## Verification (each exits 0 with at least 1 pass and 0 fail; logs in `tmp/sac-s826/sac-03-slide-rect-core/final/`)

1. `bun test ./packages/core/src/presentation` -> `presentation.log`
   (the new tests plus the existing tests unchanged)
2. `bun run typecheck` -> `typecheck.log`

Static: `bunx biome check` on the owned files.

## Done criteria

- Verifications 1-2 exited 0.
- `git diff --stat -- packages/core/src/presentation/{source,slides,fit,navigation}.ts packages/core/src/index.ts`
  is empty.
- The progress log has the intent hash, per-edit hashes and the exit
  statuses.
