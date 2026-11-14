# slk-06-link-inspector

- planId: slk-06-link-inspector
- planPath: impl-plans/active/slk-06-link-inspector.md
- progressPath: impl-plans/progress/slk-06-link-inspector.md
- wave: 2; dependsOn: slk-00-strict-index-gate, slk-01-link-field
- Design: sections 7 and 9 of `design-docs/specs/design-slide-link-animation.md`.
- writePaths: `packages/ui-solid/src/inspector/slide-link-edits.ts` (new),
  `packages/ui-solid/src/inspector/slide-link-edits.test.ts` (new),
  `packages/ui-solid/src/inspector/SlideLinkSection.tsx` (new),
  `impl-plans/progress/slk-06-link-inspector.md`,
  `tmp/slk-s855/slk-06-link-inspector`, `target`
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

Linked shapes are edited independently per page. This plan adds explicit
actions, applied as single undo steps with existing commands only:

- Unlink;
- Apply to linked shapes (style, plus position/size relative to the slide
  origin when the option is on);
- the "Linked on N pages" count.

Patterns to follow:

- `packages/ui-solid/src/inspector/presentation-settings.ts` and
  `bpmn-edits.ts`: pure helpers returning commands;
- `ParentSection.tsx` lines ~207-223: the `replaceVisual` edit of
  `componentKey` through `props.editor.apply([...])`;
- `PresentationSection.tsx`: an editor-backed inspector section.

Mounting in `Inspector.tsx` is done by slk-07.

## Non-goals

- No facade methods and no core change. No new Command kind. No new CSS
  file; reuse the existing inspector classes and controls from
  `inspector/controls.tsx`.
- No automatic propagation of edits.

## File-level changes

1. `slide-link-edits.ts`:
   - `linkedPages(store, element)`: if `element.visual.linkId` is absent,
     return `[]`. Otherwise return the distinct `page` values of
     `store.listElements()` with an equal `linkId`, ordered by
     `store.listPages()` tab order, including the element's own page.
   - `planUnlink(element)`: `[]` when there is no `linkId`. Otherwise one
     `replaceVisual` with the visual minus `linkId`.
   - `planApplyToLinked(store, element, { geometry })`. Targets are the
     elements with the same `linkId` and the same `type` on other pages.
     For each target, build the new visual from the target's visual:
     - style: set `style`, `colorTokens` and `textStyle` from the source,
       deleting each key the source lacks;
     - geometry (only when `geometry` is true and both source and target
       have numeric x and y): `x = src.x - so.x + to.x`, `y` likewise,
       where the origins are `page.slideOrigin ?? {x:0,y:0}` when
       `store.getMeta().slideSize` is set, else `(0,0)`. Copy `width`,
       `height` and `rotation`, deleting each key the source lacks.
     Emit `replaceVisual` only when the new visual differs from the target
     (sorted-key JSON compare). Return `[]` when nothing changes.
2. `SlideLinkSection.tsx` (props `{ editor: Editor; element: Element }`):
   - render nothing when there is no `linkId`;
   - a "Linked on N pages" text (`page` when N is 1);
   - a checkbox "Include position and size" (default off, local signal);
   - an "Apply to linked shapes" button, disabled when N < 2;
   - an "Unlink" button.
   Each button calls `editor.apply(commands)` only when the list is
   non-empty. Read the revision with `createEditorSignals` (see
   `../adapter.ts`) so the count stays current.

## Pitfalls

- Do not include the selected element itself among the targets.
- A target page with the link twice: update both. Ambiguity only matters
  for animation matching.
- Do not copy `linkId`, `componentKey`, `hidden` or `locked`.
- Guard `getPage`, map and array reads (`noUncheckedIndexedAccess`).

## Tests (`slide-link-edits.test.ts`; `makeEditor`, `document`, `element` from `../../../core/src/test-helpers.ts`)

- three pages, link L on pages 1 and 3 -> `linkedPages` returns [p1, p3]
  in tab order; no link -> []
- `planUnlink` + apply -> the element has no `linkId`; the others keep
  theirs; one `undo` restores it
- style apply: the source fill is red and the target blue -> the target
  becomes red; the source has no `textStyle` but the target does -> it is
  removed; a different-type target is untouched
- geometry apply with `slideSize` set and origins (0,0) and (2000,0): source
  x=100 -> target x=2100; with no `slideSize` -> x=100
- `geometry: false` leaves x/y/width/height unchanged
- an identical target -> `[]`
- apply over two targets on two pages then one `undo` -> both restored
  (one undo step)

## Verification (each must exit 0)

1. `bun test packages/ui-solid/src/inspector/slide-link-edits.test.ts`
2. `bun run typecheck`
3. `bun .agents/scripts/strict-index-gate.ts capture-baseline --ref ccac2d3 --out target/strict-index/baseline.log`
4. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slk-06-link-inspector.log -- packages/ui-solid/src/inspector/slide-link-edits.ts packages/ui-solid/src/inspector/slide-link-edits.test.ts packages/ui-solid/src/inspector/SlideLinkSection.tsx`
5. `bunx biome check --diagnostic-level=warn packages/ui-solid/src/inspector/slide-link-edits.ts packages/ui-solid/src/inspector/slide-link-edits.test.ts packages/ui-solid/src/inspector/SlideLinkSection.tsx`

Evidence: logs under `tmp/slk-s855/slk-06-link-inspector/`.

## Acceptance criteria

- The tests above pass.
- Only `replaceVisual` commands are emitted.
- The strict gate exits 0.
