# slk-04-transition-planner

- planId: slk-04-transition-planner
- planPath: impl-plans/active/slk-04-transition-planner.md
- progressPath: impl-plans/progress/slk-04-transition-planner.md
- wave: 2; dependsOn: slk-00-strict-index-gate, slk-01-link-field, slk-02-transition-contract
- Design: sections 4.2 and 9 of `design-docs/specs/design-slide-link-animation.md`.
- writePaths: `packages/core/src/presentation/slide-transition.ts` (new),
  `packages/core/src/presentation/slide-transition.test.ts` (new),
  `packages/core/src/presentation/index.ts`,
  `impl-plans/progress/slk-04-transition-planner.md`,
  `tmp/slk-s855/slk-04-transition-planner`, `target`
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

`planSlideTransition` is a pure, DOM-free function. It turns two pages and
their slide view boxes into a JSON-serialisable plan (signature and types:
`slk-overview.md`). Reference patterns:

- `packages/core/src/prototype.ts:smartPlan`: duplicate-key exclusion and
  the edge/group skip;
- `smartAppearance`: the opacity default of 1;
- `packages/core/src/svg-export/document.ts:renderElementsSvg`: the skip
  filters (prototype edges, `visual.hidden`, `context.isHidden`,
  `context.isMaskSource`, groups).

## Non-goals

- No DOM, no Editor (Store + registry only), no keyframe strings.
- No change to `prototype.ts` or `svg-export`.

## Rules (implement exactly; design section 4.2)

1. Plannable elements of a page:
   - from `store.getPageElements(page)`;
   - skip `type === "group"`;
   - skip `edge.generic` whose semantic has `prototype`;
   - skip `visual.hidden`, `context.isHidden?.(id)` and
     `context.isMaskSource?.(id)`, with
     `context = createShapeContext(store, registry, 1)` from `../hit-test.ts`;
   - skip elements with null `registry.getOrFallback(type).getBounds(element, context)`.
   Sort by `compareFractional(index) || compareFractional(id)`.
2. `|Δwidth| > 0.5` or `|Δheight| > 0.5` between the rects ->
   `{kind:"cut", reason:"size-mismatch"}`. Both pages with no plannable
   element -> `{kind:"cut", reason:"empty"}`.
3. Link key = `visual.linkId?.trim()`; an empty key means no link. A key
   that occurs more than once among one page's plannable elements is
   ambiguous on that page.
4. A pair is (`a` outgoing, `b` incoming) with the same key, unique on both
   pages.
   - Different types: no pair.
   - Edge category (`getElementTypeDefinition(type)?.category === "edge"`
     from `@nodetto/ir`) -> `crossfade` `{from: a.id, to: b.id}`.
   - Otherwise `transform`:
     - `fromBox`/`toBox` = bounds minus the rect `x`/`y`, plus
       `rotation: visual.rotation ?? 0`;
     - appearance = `{ opacity: style?.opacity ?? 1, fill, stroke, strokeWidth }`,
       optional keys only when defined;
     - `appearanceChanged` = the canonical sorted-key JSON of
       `{style, semantic, colorTokens, textStyle}` differs between `a` and
       `b`. Write a small local `canonicalJson` that sorts keys
       recursively. `JSON.stringify` key order is not reliable.
5. Unpaired outgoing -> `fade-out {from}`. Unpaired incoming entrance:
   edge -> `grow`; `text.note` or `image.raster` -> `fade-in`; else
   `draw-on` (`{to}`).
6. Timing:
   - fade-out: start 0, duration `SLIDE_FADE_OUT_MS`;
   - transform/crossfade: rank in incoming paint order,
     `start = staggerStart(rank, n)`, duration `SLIDE_MOVE_MS`;
   - entrances: `offset + staggerStart(rank, n)`, where offset is
     `SLIDE_ENTRANCE_OFFSET_MS` if there is any fade-out/transform/crossfade
     step, else 0; duration `SLIDE_ENTRANCE_MS`;
   - easing `"ease-in-out"`;
   - plan `duration` = the maximum of `start + duration`.
7. Step order: fade-outs (outgoing paint order), then transform/crossfade,
   then entrances.
8. Two empty-but-explicit pages are already handled by rule 2. One empty
   page gives only fade-outs or only entrances.

`index.ts`: append `export * from "./slide-transition.ts";`.

## Pitfalls

- Count duplicates among plannable elements only (a hidden duplicate does
  not make a visible one ambiguous).
- Never put `undefined` values in the plan (keep it JSON-stable): omit the
  keys instead.
- Do not import from `../index.ts` (cycles); import modules directly.
- Under `noUncheckedIndexedAccess`, guard every map and array read.

## Tests (`slide-transition.test.ts`; build stores with `makeEditor` from `../test-helpers.ts`)

- two pages, rect `L` at different x/y/width -> one `transform` whose
  boxes are slide-relative (rects with different origins give relative
  coordinates)
- the same linked rect with a fill change -> `appearanceChanged: true`;
  with no change -> `false`
- linked connectors -> `crossfade`
- a new rect -> `draw-on`, a new connector -> `grow`, new `text.note` ->
  `fade-in`, a removed shape -> `fade-out`
- `L` twice on the incoming page -> no transform for `L`; the outgoing
  copy fades out and both incoming copies get entrances
- linked rect vs linked ellipse of a different type (if a type differs,
  for example `shape.geo` vs `text.note`) -> fade-out + entrance
- three new shapes -> entrance starts strictly increase in paint order
  (index order, not insertion order)
- rects 1920x1080 vs 1000x1000 -> `cut/size-mismatch`; two empty pages ->
  `cut/empty`
- reverse: `plan(B -> A)` pairs the same elements with from/to swapped
- `JSON.parse(JSON.stringify(plan))` deep-equals `plan`
- a group container is never a step target; its children are planned

## Verification (each must exit 0)

1. `bun test packages/core/src/presentation`
2. `bun run typecheck`
3. `bun .agents/scripts/strict-index-gate.ts capture-baseline --ref ccac2d3 --out target/strict-index/baseline.log`
4. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slk-04-transition-planner.log -- packages/core/src/presentation/slide-transition.ts packages/core/src/presentation/slide-transition.test.ts packages/core/src/presentation/index.ts`
5. `bunx biome check --diagnostic-level=warn packages/core/src/presentation/slide-transition.ts packages/core/src/presentation/slide-transition.test.ts packages/core/src/presentation/index.ts`

Evidence: logs under `tmp/slk-s855/slk-04-transition-planner/`.

## Acceptance criteria

- Every rule above is covered by a passing test.
- `planSlideTransition` is exported from `@nodetto/core`.
- The strict gate exits 0.
