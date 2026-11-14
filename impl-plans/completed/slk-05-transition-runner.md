# slk-05-transition-runner

- planId: slk-05-transition-runner
- planPath: impl-plans/active/slk-05-transition-runner.md
- progressPath: impl-plans/progress/slk-05-transition-runner.md
- wave: 2; dependsOn: slk-00-strict-index-gate, slk-02-transition-contract
- Design: sections 5.2-5.5, 6.2 and 9 of `design-docs/specs/design-slide-link-animation.md`.
- writePaths (all new, in `packages/ui-solid/src/presentation/`):
  `transition-keyframes.ts`, `transition-keyframes.test.ts`, `transition-dom.ts`,
  `transition-dom.test.ts`, `transition-runner.ts`, `transition-runner.test.ts`,
  `TransitionLayer.tsx`, `slide-render.ts`, `slide-render.test.ts`; plus
  `impl-plans/progress/slk-05-transition-runner.md`,
  `tmp/slk-s855/slk-05-transition-runner`, `target`
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

This plan executes an animate plan from slk-02's contract with the Web
Animations API. It only executes; it never plans. Model it on
`packages/ui-solid/src/prototype-transition.ts:PrototypeAnimation`
(cancel-before-play, `animations` array, reduced-motion short circuit) and
its tests (`prototype-transition.test.ts`, which uses fake `animate`
targets). The integration into controller and view belongs to slk-07; do
not edit `controller.ts`, `PresentationView.tsx` or `Presentation.css`.

## Non-goals

- No planner logic, no matching, no reduced-motion detection (slk-07
  decides when to play).
- No new dev dependency. `happy-dom` is already a dependency; tests import
  `Window` from it directly, without global registration.
- No exporter change.

## File-level changes

1. `transition-keyframes.ts` (pure, no DOM):
   - `shortestDelta(from, to)`: the same formula as `rotationDelta` in
     `packages/core/src/prototype.ts` (copy it; that one is not exported).
   - `poseTransform(asBox, ofBox, origin)` returns the CSS transform string
     `translate(cA) rotate(rA'deg) scale(sx, sy) rotate(-rBdeg) translate(-cB)`
     (design 5.2). Centers are `box center + origin`. `sx = A.w / B.w`, or
     1 when `B.w <= 0`; the same for `sy`.
     `rA' = rB + shortestDelta(rA, rB)`. Identity uses the same function list
     with A = B.
   - `stepKeyframes(step, origins)` returns
     `{ incoming?: {keyframes, options}, outgoing?: {keyframes, options} }`
     per design 5.2. The options are always
     `{ delay: start, duration, easing: "ease-in-out", fill: "both" }`.
     - `transform`: the incoming keyframes run `pose(toBox as fromBox)` to
       identity in incoming-SVG user space (origin = the to-rect x/y). With
       `appearanceChanged`, add `opacity 0 -> 1` to the incoming keyframes,
       and give the outgoing node identity -> `pose(fromBox as toBox)` plus
       `opacity 1 -> 0` (origin = the from-rect x/y).
     - `crossfade`, `fade-in`, `fade-out`: the opacity frames.
   - `DrawOnProbe = { tag; fill: string; stroke: string; strokeWidth: number; dasharray: string | null; fillOpacity: number; length: number | null }`
   - `DrawOnClass = "outline" | "fill" | "other" | "none"`
   - `classifyDrawOn(probes)`: implement the design 5.3 table.
   - `drawOnKeyframes(cls, probe, kind: "draw-on" | "grow")`: the per-class
     keyframe arrays with offsets. For outline, the dash runs over
     `[0, 0.6]` for draw-on and `[0, 1]` for grow. Fill and other hold 0
     until offset 0.5. Fill ends at `probe.fillOpacity`.
2. `transition-dom.ts` (DOM, but takes roots as parameters):
   - `prepareTransition(outgoingSvg: Element, incomingSvg: Element, plan)`:
     1. Find `g[data-id="<id>"]` for each step's from/to. Missing -> skip
        the step.
     2. Wrap each animated element node in a new `<g>` with style
        `transform-box: view-box; transform-origin: 0 0`. The wrapper takes
        the transform; never overwrite the node's own `transform` attribute.
     3. Hide (`visibility: hidden`) ONLY the outgoing nodes of `transform`
        steps with `appearanceChanged === false`. Never hide
        `g[data-type="group"]` or nodes without a step.
     4. For draw-on/grow, collect painted descendants:
        - include `path, rect, circle, ellipse, line, polyline, polygon,
          text, image, foreignObject, use`;
        - exclude anything with an ancestor (up to the node) among `defs,
          clipPath, mask, marker, pattern, linearGradient, radialGradient,
          filter, symbol`;
        - probe each with the nearest `fill`/`stroke`/`stroke-width`/
          `stroke-dasharray`/`fill-opacity` attribute walking up to the
          element node, defaulting to the SVG initial values (fill
          `black`, stroke `none`, width 1, fillOpacity 1);
        - `length` = `getTotalLength()` when it is a function returning a
          finite value > 0, else `null`.
     5. For grow, remove `marker-start`, `marker-mid` and `marker-end` and
        return a `restore()` that puts them back.
   - Return a `SlideNodeLookup`: a list of
     `{ target: { animate }, keyframes, options, onFinish? }` jobs.
3. `transition-runner.ts`: `SlideTransitionRunner`.
   - `play(jobs)` cancels the previous play and increments `generation`.
     It starts every job, then awaits all `finished` promises (catch ->
     cancelled).
   - It resolves `"finished"` only if its generation is still current and
     nothing was cancelled; otherwise `"cancelled"`.
   - `cancel()` is idempotent and cancels all animations.
   - Each job's optional `onFinish` is called exactly once when that play
     settles, whether finished or cancelled. The grow-step marker
     `restore()` from `prepareTransition` is delivered through `onFinish`
     (Step 5 SLK-PLAN-L02); the pinned job shape is unchanged. Test: a
     cancelled play still calls `onFinish` once.
4. `TransitionLayer.tsx`:
   - a Solid component, absolutely positioned (`inset: 0`), with
     `pointer-events: none`. Use inline styles only; slk-07 owns the CSS
     file.
   - It sets `innerHTML` of two child containers to
     `scopeSvgIds(svg, "nodetto-slide-<n>-")`, with a module-level counter
     `n` that increments per SVG. The outgoing container comes first, so
     it sits beneath. Each SVG gets the style `width:100%;height:100%`.
   - On mount it calls `prepareTransition`, then `runner.play`, then
     `onDone(result)`. On cleanup it calls `runner.cancel()`.
5. `slide-render.ts` `renderSlide(editor, page)`: the same branches as
   `controller.ts:slide()` lines 75-106, returning the raw svg plus the
   rect:
   - explicit `slideSize`: rect = `resolveSlideRect(...)`, mapped to
     `{x,y,width,height}`; svg = viewport export, or null for an empty page;
   - otherwise: svg = artboard ?? `exportPageSvgOf(page, {padding: 0})`;
     rect = `svg ? svgViewBox(svg) : null`.
   Do not modify the controller; slk-07 refactors it to call this.

## Pitfalls

- A wrapper `<g>` must preserve the DOM order and parent of the wrapped
  node.
- `fill: "both"` on every animation, so delayed entrances are invisible
  before their start.
- Never animate or rewrite nodes inside definition subtrees.
- A stale play (older generation) must not call `onDone("finished")`.

## Tests

- `transition-keyframes.test.ts`:
  - identity pose for A = B
  - translate-only move -> pose centers differ by the delta
  - zero-width B -> sx 1
  - rotation 350 -> 10 gives a +20 delta
  - classify table: outline / fill / other / none / dashed -> other;
    no outline anywhere -> the caller falls back (see the dom test)
- `transition-dom.test.ts` (happy-dom `Window`, real core exports through
  `makeEditor` from `../../../core/src/test-helpers.ts`):
  - a new geo rect with a fill and `style.strokeAlign: "inside"`: the
    `renderPageSvg` output has separate fill and border paths;
    `getTotalLength` is stubbed to 400 on geometry nodes. The fill path is
    classed `fill`, the border is `outline`, and the fill keyframes hold
    `fillOpacity` 0 through offset 0.5 and end at the exported value. Every
    job has `delay = start` and `fill: "both"`. No node inside
    `clipPath`/`defs`/`marker` is in a job.
  - without the stub -> one whole-node opacity job
  - an outgoing group holding a removed child (fade-out) and a linked child
    with changed fill (`appearanceChanged`), plus a linked child with no
    change: only the unchanged child is `visibility: hidden`; the group
    and the other two children are visible and have jobs
  - grow removes markers; `restore()` puts them back
- `transition-runner.test.ts` (fake targets as in
  `prototype-transition.test.ts`):
  - all finish -> `"finished"`
  - `cancel()` mid-play -> `"cancelled"` and every fake is cancelled
  - a second `play` cancels the first; the first resolves `"cancelled"`
  - `cancel()` twice does not throw
- `slide-render.test.ts`: explicit slide size -> rect `{100,-50,1920,1080}`
  (same fixture as `slide-clip.test.ts`); unset -> rect equals
  `svgViewBox(svg)`; empty unset -> `{svg:null, rect:null}`; empty explicit
  -> `{svg:null, rect}`.

## Verification (each must exit 0)

1. `bun test packages/ui-solid/src/presentation`: new and existing
   presentation tests pass.
2. `bun run typecheck`
3. `bun .agents/scripts/strict-index-gate.ts capture-baseline --ref ccac2d3 --out target/strict-index/baseline.log`
4. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slk-05-transition-runner.log -- packages/ui-solid/src/presentation/transition-keyframes.ts packages/ui-solid/src/presentation/transition-keyframes.test.ts packages/ui-solid/src/presentation/transition-dom.ts packages/ui-solid/src/presentation/transition-dom.test.ts packages/ui-solid/src/presentation/transition-runner.ts packages/ui-solid/src/presentation/transition-runner.test.ts packages/ui-solid/src/presentation/TransitionLayer.tsx packages/ui-solid/src/presentation/slide-render.ts packages/ui-solid/src/presentation/slide-render.test.ts`
5. `bunx biome check --diagnostic-level=warn` on the nine owned files

Evidence: logs under `tmp/slk-s855/slk-05-transition-runner/`.

## Acceptance criteria

- The tests above pass; `controller.test.ts` and `slide-clip.test.ts` pass
  unchanged.
- `git diff ccac2d3 -- packages/ui-solid/src/presentation/controller.ts packages/ui-solid/src/presentation/PresentationView.tsx` is empty.
- The strict gate exits 0.
