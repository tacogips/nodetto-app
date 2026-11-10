# prs-02-core-presentation

- planId: prs-02-core-presentation
- planPath: impl-plans/active/prs-02-core-presentation.md
- progressPath: impl-plans/progress/prs-02-core-presentation.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-presentation.md` sections 4.1-4.4, 9 and
  10. The pinned names are in `impl-plans/active/prs-00-overview.md`.
- writePaths:
  - `packages/core/src/presentation/index.ts` (new)
  - `packages/core/src/presentation/slides.ts` (new)
  - `packages/core/src/presentation/slides.test.ts` (new)
  - `packages/core/src/presentation/navigation.ts` (new)
  - `packages/core/src/presentation/navigation.test.ts` (new)
  - `packages/core/src/presentation/fit.ts` (new)
  - `packages/core/src/presentation/fit.test.ts` (new)
  - `packages/core/src/presentation/source.ts` (new)
  - `packages/core/src/presentation/source.test.ts` (new)
  - `packages/core/src/index.ts` (one added line only)
  - `impl-plans/progress/prs-02-core-presentation.md`
  - `tmp/prs-s793/prs-02-core-presentation`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Add pure, DOM-free presentation logic: which pages are slides, where to
start, the navigation state machine, fit math and the choice between
artboard and page source. prs-04 builds the view on these. The module does
not import the IR flag type, so it does not depend on prs-01: the slide list
uses a structural input type.

## Non-goals

- No rendering, DOM, timers or Editor facade changes.
- Do not edit `packages/core/src/svg-export/*`, `layer-state.ts` or
  `hit-test.ts`.

## File-level changes

1. `slides.ts`: `slideList` and `startIndex` per design 4.1.
   - `startIndex` with `from` hidden scans `order` after `from` for the
     first id in `slides`. If there is none, it returns
     `slides.length - 1`.
   - `from` not in `order` -> 0.
   - Empty slides -> `null`.
2. `navigation.ts`: `PresentationState`, `PresentationAction`,
   `createPresentationState`, `reducePresentation`, `currentSlide` and
   `slideCounter`, following the design 4.2 table exactly.
   - `digit` accepts only a single character `0`-`9`; anything else returns
     the state unchanged. At 4 digits a further digit is ignored.
   - `goto` and `enter` with digits: `n` is clamped to `[1, total]`. A
     non-finite `n` returns the state unchanged.
   - `reconcile`:
     - keeps the current page id if it is in the new list
     - otherwise uses `min(oldIndex, newLength - 1)`
     - an empty list returns `null`
     - it also clears digits but keeps `black`
   - Return new frozen-shape objects. Never mutate the input.
3. `fit.ts`: `PRESENTATION_MARGIN = 24` and `fitSlide` per design 4.3.
   - Any non-finite value, or a size of 0 or less, returns
     `{ scale: 0, width: 0, height: 0, x: vw / 2, y: vh / 2 }`. Use `0`
     for `x` or `y` when that viewport value is itself invalid. NaN is never
     returned.
   - Clamp a negative margin to 0.
4. `source.ts`: `slideSource` and `svgSize` per design 4.4.
   - Default predicate: `const context = createShapeContext(store, registry, 1)`
     (`packages/core/src/hit-test.ts:61`), then
     `(id) => context.isHidden?.(id) === true`. This is the same check as
     `renderArtboardSvg` (`packages/core/src/svg-export/document.ts:592`).
   - Candidates are `store.getPageElements(pageId)` elements with
     `type === "frame"` and a predicate result of `false`. Exactly one
     candidate gives an artboard; zero, or two or more, give
     `{ kind: "page" }`.
   - Do NOT test only `element.visual.hidden`. This was finding
     PRS-DESIGN-001.
   - `svgSize`:
     - parse only the first `<svg ...>` start tag
     - read the numeric `width="..."` and `height="..."` attributes
     - return `null` when a value is missing, non-finite or 0 or less
     - use no DOMParser
5. `presentation/index.ts`: `export *` from the four files.
6. `packages/core/src/index.ts`: append exactly one line,
   `export * from "./presentation/index.ts";`, as the last line.

## Pitfalls

- Clamping, not wrapping: `next` on the last slide is a no-op except that
  it clears `black` and `digits`.
- `enter` without digits is `next`, and `Number("0")` goes to slide 1.
- `toggleBlack` clears digits, and navigation clears `black`.
- Reconcile must not jump to slide 0 when the current page survives.
- Import `Store` and `ShapeUtilRegistry` as types. Import
  `createShapeContext` from `../hit-test.ts`, not from the barrel, to avoid
  a cycle.

## Tests (input -> expected)

- `slides.test.ts`:
  - `[a, b(hidden), c]` -> `[a, c]` (order kept)
  - `[]` -> `[]`
  - all hidden -> `[]`
  - `startIndex`:
    - `from=null` -> 0
    - `from=c` -> 1
    - `from=b` (hidden) -> 1 (index of c)
    - `[a, b, c(hidden)]` with `from=c` -> the last slide
    - unknown `from` -> 0
    - empty slides -> `null`
- `navigation.test.ts` (3 slides):
  - `next` from the last slide -> unchanged index
  - `prev` from 0 -> 0
  - `first` / `last`
  - `goto 0` -> 1st; `goto 99` -> 3rd
  - `toggleBlack` -> `black` true; then `next` -> `black` false and index+1
  - digits `1`, `2` then `enter` -> index 2 (12 is clamped to 3)
  - `enter` with no digits -> next
  - a 5th digit is ignored; `digit "x"` is ignored
  - `clearDigits`
  - reconcile keeps the current page when it moves
  - reconcile with the current page removed -> clamped index
  - reconcile with `[]` -> `null`
  - `slideCounter` 1-based
- `fit.test.ts`:
  - 200x100 in 1000x1000, margin 24 -> scale 4.76, width 952, height 476,
    centered `x` 24, `y` 262
  - a tall source in a wide viewport -> pillarbox, `x > margin`
  - a tiny 40x40 viewport -> the margin collapses to 10
  - upscaling: 10x10 in 500x500 -> scale > 1
  - a 0 or NaN input -> scale 0, with no NaN in any field
  - the aspect ratio is kept: width / height equals the source ratio
- `source.test.ts` (imitate `packages/core/src/svg-export.test.ts` setup:
  `new Store(...)`, `createDefaultRegistry()`; and
  `packages/core/src/layer-state.test.ts` for a hidden-group fixture):
  1. A frame with no own `hidden`, inside a group with
     `visual.hidden = true`, plus a visible rectangle -> `{ kind: "page" }`.
     `renderPageSvg` for the page is non-null and contains the rectangle's
     `data-id`.
  2. Exactly one visible frame -> `{ kind: "artboard", frameId }`, and
     `renderArtboardSvg` for it is non-null.
  3. No frames -> page; two visible frames -> page.
  4. One own-hidden frame plus one visible frame -> an artboard with the
     visible frame.
  5. An injected predicate is used instead of the default.
  6. `svgSize`:
     - `renderPageSvg` output -> positive width and height equal to its
       attributes
     - `"<svg>"` -> `null`
     - `width="0"` -> `null`

## Verification (each exits 0 with at least 1 pass and 0 fail; logs in `tmp/prs-s793/prs-02-core-presentation/final/`)

1. `bun test ./packages/core/src/presentation/slides.test.ts ./packages/core/src/presentation/navigation.test.ts` -> `nav.log`
2. `bun test ./packages/core/src/presentation/fit.test.ts ./packages/core/src/presentation/source.test.ts` -> `fit-source.log`

Static: Biome on the owned files, then `bun run typecheck`.

## Done criteria

- Verifications 1 and 2 exited 0.
- `git diff -- packages/core/src/index.ts` adds exactly one line.
- `grep -n 'visual.hidden' packages/core/src/presentation/source.ts` has no
  match: candidates use the predicate.
- The progress log has the intent hash, per-edit hashes and command results.
