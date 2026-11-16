# dps-12-presentation

- planId: dps-12-presentation. Wave 2.
- dependsOn: dps-04-page-geometry.
- Design: section 6 of `design-docs/specs/design-document-pages-snippets.md`,
  plus user-qa Q6.
- writePaths:
  - core presentation: `packages/core/src/presentation/slides.ts`,
    `packages/core/src/presentation/slides.test.ts`,
    `packages/core/src/presentation/navigation.ts`,
    `packages/core/src/presentation/navigation.test.ts`,
    `packages/core/src/presentation/labels.ts`,
    `packages/core/src/presentation/labels.test.ts`.
  - ui-solid presentation: `packages/ui-solid/src/presentation/controller.ts`,
    `packages/ui-solid/src/presentation/controller.test.ts`,
    `packages/ui-solid/src/presentation/controller-navigation.test.ts`,
    `packages/ui-solid/src/presentation/controller-transition.test.ts`,
    `packages/ui-solid/src/presentation/slide-render.ts`,
    `packages/ui-solid/src/presentation/slide-render.test.ts`,
    `packages/ui-solid/src/presentation/page-frame-slides.test.ts` (new).
  - `packages/ui-solid/src/canvas/SlideAreaOverlay.tsx`.
  - Logs and artifacts: `impl-plans/progress/dps-12-presentation.md`,
    `tmp/dps-s861/dps-12-presentation`, `target`.
- sharedPaths: none.
- artifactRoots: `target`.

## Intent and context

When a nodetto page contains page frames, the slideshow shows one slide per
page frame in flow order, clipped to the frame. Documents without page
frames must behave exactly as today.

`presentation/index.ts` already re-exports `slides.ts`, `navigation.ts`
and `labels.ts`, so it needs no edit.

## Non-goals

- No change to keys, fullscreen, transitions settings or slide-link
  planning internals.
- No edit to `apps/desktop/src/App.tsx`. It keeps calling
  `startIndex(order, slideList(pages), page)`, which keeps its signature.

## Contract

```ts
export interface SlideRef { readonly page: PageId; readonly frame?: ElementId }
export function expandSlides(store: Store, registry: ShapeUtilRegistry, pageIds: readonly PageId[]): SlideRef[];
export function startSlideIndex(order: readonly PageId[], refs: readonly SlideRef[], from: PageId | null): number | null; // same rules as startIndex, by ref.page, first ref of the page
export function sameSlide(a: SlideRef, b: SlideRef): boolean;
// navigation.ts: PresentationState.slides: readonly SlideRef[]; currentSlide(state): SlideRef; createPresentationState(slides: readonly SlideRef[], index)
// labels.ts
export function slideLabel(pages, pageId, slidesPerPage?: ReadonlyMap<PageId, number>): string | null;
// slide-render.ts
export function renderSlide(editor: Editor, ref: SlideRef): { svg: string | null; rect: SlideViewBox | null };
```

## Rules

- `expandSlides`: for each page id (already filtered by `slideList`),
  `pageFramesInFlowOrder` (dps-04) gives refs `{ page, frame }`. A page
  without frames gives `{ page }`.
- `startIndex` keeps its exact signature and behaviour. `startSlideIndex`
  applies the same hidden-page and unknown-page rules to the pages of the
  refs, and returns the index of the first ref of the chosen page.
- navigation:
  - `reconcile` keeps the current ref when `sameSlide` matches. Otherwise
    it clamps, as today.
  - Every other reducer case is unchanged apart from the types.
- `slideLabel`:
  - Without `slidesPerPage` the output is unchanged.
  - With it, n is the first slide number of the page in the expanded
    order, and total is the sum.
  - k > 1 gives `Slides n-m / total`. One slide gives `Slide n / total`.
  - A hidden page gives `Hidden from presentation`.
- `SlideAreaOverlay.tsx`: build `slidesPerPage` from
  `expandSlides(store, registry, slideList(pages))` and pass it.
- `renderSlide(editor, ref)`:
  - With `ref.frame`, rect = the frame's `viewBounds`, and
    `svg = exportPageSvgOf(ref.page, { viewport: rect })`, or null for an
    empty page. This path runs before the `slideSize` path, so it takes
    precedence.
  - Without a frame, the existing code runs byte-for-byte.
- controller:
  - `slides = expandSlides(...)`.
  - The start index comes from `startSlideIndex`.
  - The cache key is `(page, frame, revision)`.
  - For a frame slide, `size` is the rect size.
  - `onExit` receives `ref.page`.
  - `refresh` reconciles with `expandSlides`.
  - Transitions:
    - When `previous.page === next.page`, set no transition. This is a
      cut.
    - Otherwise call `planSlideTransition` with `{ page, rect }` from
      `renderSlide`, as today.
  - The transition object fields `fromPage` and `toPage` keep their meaning
    (`ref.page`).

## Pitfalls

- Existing tests must pass with only type-level updates. A document without
  page frames must produce identical slides, counter text and SVG.
- Do not compare refs by identity. Use `sameSlide`.
- A hidden page hides all of its frames, because `slideList` runs before
  expansion.

## Tests (input -> expected)

- `expandSlides`:
  - page P1 with frames at y 1171 and 0, plus page P2 without frames,
    gives `[P1/f(y0), P1/f(y1171), P2]`;
  - with P1 horizontal, the order follows x.
- `startSlideIndex(order, refs, P2)` gives 2, and the hidden-page rules
  match `startIndex`.
- reconcile keeps the current ref after another slide is removed.
- labels: P1 with 2 frames and P2 give `Slides 1-2 / 3` and `Slide 3 / 3`.
- `renderSlide` for a frame ref calls the viewport export with the frame
  box. It takes precedence over the document `slideSize`. A shape
  overflowing the frame is clipped (`overflow="hidden"` in the svg).
- controller (`page-frame-slides.test.ts`):
  - the counter shows `1 / 3`;
  - next within the same page sets no transition;
  - next across pages plans as before;
  - exit reports the page id;
  - a document without frames keeps the existing counter and size results.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-12-presentation/)

1. `bun test packages/core/src/presentation packages/ui-solid/src/presentation`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn packages/core/src/presentation/slides.ts packages/core/src/presentation/navigation.ts packages/core/src/presentation/labels.ts packages/ui-solid/src/presentation packages/ui-solid/src/canvas/SlideAreaOverlay.tsx`

## Done criteria

- The contract exists and all existing presentation tests pass.
- All three commands exit 0.
- The progress log records the commands, exit codes and log paths.

## Coordination

Edit only your writePaths. Re-read before each edit and record hashes. No
git state changes.
