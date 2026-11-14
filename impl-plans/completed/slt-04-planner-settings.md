# slt-04-planner-settings

- planId: slt-04-planner-settings; wave 2; dependsOn: slt-01-settings-fields, slt-02-plan-contract
- Design: sections 2, 4, 5.1-5.4 and 10 (`slt-04`) of
  `design-docs/specs/design-slide-transition-settings.md`.
- writePaths: new `packages/core/src/presentation/slide-transition-settings.ts`,
  new `packages/core/src/presentation/slide-transition-settings.test.ts`,
  new `packages/core/src/presentation/slide-transition-phase1-pin.test.ts`,
  `packages/core/src/presentation/slide-transition.ts`, progress file,
  `tmp/slt-s856/slt-04-planner-settings`, `target`
- artifactRoots: `target`.

## Intent and context

Make the pure planner honour slide settings (read from the owner page's
`presentation.slide` carrier) and per-shape `visual.animation`. Results
for documents without settings must stay byte-for-byte Phase 1. The
existing planner is `packages/core/src/presentation/slide-transition.ts:
planSlideTransition`. Read it fully first.

## Non-goals

- Do not edit `slide-transition.test.ts` (Phase 1 expectations stay).
- Do not edit `presentation/index.ts` (slt-07 exports the new module).
- No DOM, no Editor, no ui-solid.

## Step 0 (mandatory, before editing `slide-transition.ts`)

1. Write `slide-transition-phase1-pin.test.ts` with one fixture built with
   `Store` and `test-helpers.ts`. Two pages, 800x600 rects. It contains: a
   linked `shape.geo` with changed geometry; a linked connector; a removed
   shape; a new shape; a new connector; a new `text.note`; and two linked
   pairs A and B whose paint order is A,B on page 1 and B,A on page 2
   (indexes chosen so).
2. Run the UNMODIFIED planner forward (p1 -> p2) and backward (p2 -> p1),
   save `JSON.stringify(plan, null, 2)` to
   `tmp/slt-s856/slt-04-planner-settings/phase1-pin-capture.log`, and paste
   both as literal expected objects in the test (`toEqual`).
3. Sanity check: backward, A's pair starts at 0 and B's at 60. Commit
   nothing; record the capture in the progress log.
4. Never regenerate these literals from the modified planner.

## `slide-transition-settings.ts` (pure)

- `slideTiming(durationMs?: number): SlideTiming`. When `undefined`, return
  `PHASE1_TIMING` itself (no multiplication). Otherwise scale every field
  by `durationMs / 700`, without rounding.
- `mirrorEnter(effect, side)` -> exit effect and side, and `mirrorExit`
  the reverse (design section 2 table). `auto` -> `auto`, `none` ->
  `none`, `grow` -> `undraw`, `undraw` -> `draw-on`.
- `resolveEntrance(element, effect)` returns a step kind:
  - edge category allows `none|fade-in|grow`; others allow
    `none|fade-in|draw-on|scale-in|slide-in`;
  - anything else, and `auto`, gives the Phase 1 entrance (`grow` for an
    edge, `fade-in` for `text.note`/`image.raster`, otherwise `draw-on`);
  - `none` -> `appear`.
- `resolveExit(element, effect)`: edge allows `none|fade-out|undraw`,
  others allow all; otherwise and `auto` -> `fade-out`; `none` ->
  `disappear`.
- `resolveLinked(motion, isEdge)`: `auto` -> `isEdge ? "crossfade" :
  "transform"`; `crossfade` -> `crossfade`; `cut` -> `swap`.
- `slideOffset(box, rect, side)` returns `{x, y}`:
  - first compute the rotated AABB of `box` (rotate the 4 corners about the
    centre by `box.rotation` degrees);
  - `left` -> `x = -maxX`; `right` -> `x = rect.width - minX`; `top` ->
    `y = -maxY`; `bottom` -> `y = rect.height - minY`; the other axis is 0.

## `slide-transition.ts` changes (rules, design 5.3)

1. Input gains `navigation?: SlideNavigation` (default `"forward"`). The
   owner page is `to` when forward and `from` when backward. Settings =
   `readSlideSettings(store.getPageElements(ownerPage))` (from
   `@nodetto/ir`).
2. Rule order:
   1. size mismatch -> cut `size-mismatch`;
   2. owner `mode === "cut"` -> cut `setting`;
   3. no plannable element on either page -> cut `empty`;
   4. `mode === "fade"` -> the single `slide-fade` step, `start 0`,
      `duration = durationMs ?? SLIDE_MOVE_MS`, and the same plan
      `duration`;
   5. otherwise auto.
3. Auto mode, `T = slideTiming(settings?.durationMs)`. Stagger offsets are
   0 when `settings?.stagger === false`, else `staggerStart(rank, count,
   T)`.
   - Exits:
     - effect: forward = the element's own `exit` (+`exitTo`); backward =
       `mirrorEnter` of its own `enter` (+`enterFrom`);
     - `start = delayMs ?? 0`;
     - duration: `durationMs` ?? (`fade-out` T.fadeOut;
       `undraw`/`scale-out`/`slide-out` T.move); `disappear` is always 0;
     - `scale-out` carries `fromBox`; `slide-out` carries `offset` from the
       outgoing rect;
     - not staggered; outgoing paint order.
   - Pairs:
     - the owner element is `to` when forward and `from` when backward;
     - kind = `resolveLinked(owner.animation?.linked, isEdge)`;
     - `transform` keeps all Phase 1 fields;
     - rank = stable sort of pairs (already in INCOMING paint order) by
       `owner.animation?.order ?? 0`;
     - `start = stagger(rank) + (owner delayMs ?? 0)`; duration
       `owner durationMs ?? T.move`; `swap` duration 0.
     - Pitfall: never use owner paint order.
   - Entrances:
     - effect: forward = own `enter` (+`enterFrom`); backward =
       `mirrorExit` of own `exit` (+`exitTo`);
     - rank = stable sort (incoming paint order) by `order ?? 0`;
     - `start = offset + stagger(rank) + delayMs` with `offset =
       T.entranceOffset` when any exit or pair step exists, else 0;
     - duration `durationMs ?? T.entrance`; `appear` is always 0;
     - `scale-in` carries `toBox`; `slide-in` carries `offset` from the
       incoming rect.
   - Step order is unchanged (exits, pairs, entrances); plan `duration` =
     max(start + duration), and `0` is valid when all steps are instant.
4. Pitfall: when no setting is present anywhere, every arithmetic path
   must be the Phase 1 one (no `+ 0` on floats changes values; reuse the
   Phase 1 constants through `PHASE1_TIMING`). New step fields (`offset`,
   boxes on scale steps) appear only on new kinds.
5. The carrier never becomes an item. Add an explicit skip of `type ===
   SLIDE_SETTINGS_TYPE` to the plannable filter. Do not rely on the null
   bounds: the shape util is registered by the sibling plan slt-03 in the
   same wave. This changes nothing for Phase 1 documents. Assert it in a
   test.

## Tests (`slide-transition-settings.test.ts`)

- `mode: "cut"` on the owner -> `{kind:"cut",reason:"setting"}` in both
  directions; a cut on the non-owner page -> no effect;
- `fade` -> exactly one `slide-fade` step; `durationMs: 1400` -> duration
  1400;
- `durationMs: 1400` in auto -> move 1400, fade-out 600, entrance offset
  600, stagger doubled;
- `stagger: false` -> all pair starts equal;
- `enter: "scale-in"` -> scale-in with `toBox`; `"slide-in"` with
  `enterFrom: "left"` -> offset x = -(maxX), y = 0;
- `exit: "slide-out"`, `exitTo: "right"` -> `x = rect.width - minX`;
- `enter: "grow"` on a rect -> draw-on; `exit: "undraw"` on a connector ->
  undraw; `enter: "draw-on"` on a connector -> grow;
- `none` -> `appear`/`disappear` with duration 0, `delayMs` applied;
- `linked: "cut"` -> swap; `"crossfade"` on a rect -> crossfade;
- `order` on the slide N members overrides incoming paint order in both
  directions;
- backward: an N-only element with `enter: "draw-on"` -> `undraw`;
  `slide-in` from `left` -> `slide-out` to `left`; an N-1-only element with
  `exit: "scale-out"` -> `scale-in`;
- the owner page is used for settings in each direction;
- the carrier on a page creates no step;
- `JSON.parse(JSON.stringify(plan))` equals the plan.

## Verification (exit 0; logs in `tmp/slt-s856/slt-04-planner-settings/`)

1. `bun test packages/core/src/presentation`. All Phase 1 tests, the pin
   and the new tests pass.
2. `bun run typecheck`
3. `bunx biome check --diagnostic-level=warn packages/core/src/presentation/slide-transition-settings.ts packages/core/src/presentation/slide-transition-settings.test.ts packages/core/src/presentation/slide-transition-phase1-pin.test.ts packages/core/src/presentation/slide-transition.ts`
4. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slt-04-planner-settings.log -- packages/core/src/presentation/slide-transition-settings.ts packages/core/src/presentation/slide-transition-settings.test.ts packages/core/src/presentation/slide-transition-phase1-pin.test.ts packages/core/src/presentation/slide-transition.ts`
5. `git diff --exit-code a9abe26 -- packages/core/src/presentation/slide-transition.test.ts` exits 0.

## Done criteria

- The pin capture log exists and the pin passes.
- The commands above exit 0.
- Only writePaths changed.
