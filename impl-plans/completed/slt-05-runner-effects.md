# slt-05-runner-effects

- planId: slt-05-runner-effects; wave 2; dependsOn: slt-02-plan-contract
- Design: sections 4 and 6 of
  `design-docs/specs/design-slide-transition-settings.md`; Phase 1 runner
  sections 5.2-5.5 of `design-docs/specs/design-slide-link-animation.md`.
- writePaths: `packages/ui-solid/src/presentation/transition-keyframes.ts`,
  `packages/ui-solid/src/presentation/transition-keyframes.test.ts`,
  `packages/ui-solid/src/presentation/transition-dom.ts`,
  `packages/ui-solid/src/presentation/transition-dom.test.ts`;
  pre-authorised only if a test proves it necessary:
  `packages/ui-solid/src/presentation/transition-runner.ts`,
  `packages/ui-solid/src/presentation/transition-runner.test.ts`,
  `packages/ui-solid/src/presentation/TransitionLayer.tsx`; progress file,
  `tmp/slt-s856/slt-05-runner-effects`, `target`
- artifactRoots: `target`.

## Intent and context

The runner only executes plans. Teach it every new step kind from slt-02.
Read `transition-keyframes.ts` (`stepKeyframes`, `poseTransform`,
`drawOnKeyframes`, `classifyDrawOn`) and `transition-dom.ts`
(`prepareTransition`, `wrap`, `removeMarkers`, `findNode`) fully first.
Tests use fake targets as in `transition-runner.test.ts` and happy-dom as
in `transition-dom.test.ts` (no new dependency).

## Non-goals

- No planner logic, no settings reading, no controller or CSS change.
- Do not change keyframes or DOM handling of any Phase 1 kind; existing
  tests must pass unchanged.

## `transition-keyframes.ts`

- In `stepKeyframes(step, origins)` add the following. All use the
  existing options (`delay = start`, `duration`, `easing: "ease-in-out"`,
  `fill: "both"`).
  - `scale-in` (`toBox`, incoming): centre `c` = box centre + `origins.to`.
    Keyframes `{transform: "translate(cpx, cpx) scale(0) translate(-c...)",
    opacity: 0}` -> the same with `scale(1)` and `opacity: 1`. Use the same
    function list in both keyframes so the browser interpolates function by
    function (pattern: `poseTransform`).
  - `scale-out` (`fromBox`, outgoing, `origins.from`): the reverse.
  - `slide-in` (`offset`, incoming): `translate(xpx, ypx)` ->
    `translate(0px, 0px)`.
  - `slide-out` (outgoing): `translate(0px, 0px)` -> `translate(xpx, ypx)`.
  - `appear`: incoming `[{opacity:0},{opacity:1}]`; `disappear`: outgoing
    `[{opacity:1},{opacity:0}]`; `swap`: both. These have `duration` 0, so
    with `fill: "both"` the switch happens exactly at `delay`.
  - `slide-fade`: return both `incoming` (0 -> 1) and `outgoing` (1 -> 0)
    opacity frames. The DOM layer decides the targets.
  - A step missing its required field (box or offset) returns `{}` (no
    animation), like Phase 1's transform guard.
- `undrawKeyframes(cls, probe, isConnector)`: `drawOnKeyframes(cls, probe,
  isConnector ? "grow" : "draw-on")` reversed. Reverse the array order and
  map `offset -> 1 - offset`; keep each keyframe's properties. `"none"` ->
  `[]`.

## `transition-dom.ts` `prepareTransition`

- `undraw`: like the draw-on branch, but on the OUTGOING node (`findNode(outgoingSvg,
  step.from)`), with `undrawKeyframes`.
  - Treat it as a connector when the node has any `marker-start`,
    `marker-mid` or `marker-end` attribute in its subtree.
  - Call `removeMarkers(outgoing)` at prepare time, so markers vanish from
    the step start because the layer is built at start.
  - Restore markers via `onFinish` of the first job, as the grow branch
    does.
  - With no `outline` class, fade the wrapper `[{opacity:1},{opacity:0}]`.
- `slide-fade`: target the two SVG roots, `outgoingSvg` (1 -> 0) and
  `incomingSvg` (0 -> 1), not element nodes and not `wrap()`.
- Every other new kind goes through `stepKeyframes` + `wrap()` like Phase
  1.
- Keep the outgoing-hiding rule exactly: only `transform` with
  `appearanceChanged === false` hides its outgoing node.
- Cancel: the layer is discarded by the existing lifecycle. Do not add
  state outside the layer. Markers are restored on finish; on cancel the
  whole layer, with its marker-less copies, is removed.

## Tests

`transition-keyframes.test.ts` (pure):
- scale-in -> first frame scale(0)/opacity 0, last scale(1)/opacity 1, with
  the same function list; the centre includes the origin;
- scale-out -> the reverse with `origins.from`;
- slide-in `{x:-120,y:0}` -> `translate(-120px, 0px)` -> `translate(0px,
  0px)`; slide-out the reverse;
- appear, disappear and swap -> duration 0, delay = start, fill both;
- slide-fade -> incoming and outgoing frames;
- `undrawKeyframes` for outline, fill and other -> the exact reversal of
  `drawOnKeyframes` (offsets 1 - o), for both draw-on and grow;
- a step missing a box or offset -> `{}`.

`transition-dom.test.ts` (happy-dom):
- undraw on an outgoing connector with `marker-end`: markers are removed
  after prepare and restored when the first job's `onFinish` runs;
- undraw on a rect without `getTotalLength` -> one wrapper fade-out job;
- slide-fade -> exactly two jobs targeting the two root `svg` elements;
- swap -> one outgoing and one incoming job, both duration 0;
- a Phase 1 plan produces the same jobs as before (existing tests
  unchanged).

## Verification (exit 0; logs in `tmp/slt-s856/slt-05-runner-effects/`)

1. `bun test packages/ui-solid/src/presentation`
2. `bun run typecheck`
3. `bunx biome check --diagnostic-level=warn packages/ui-solid/src/presentation/transition-keyframes.ts packages/ui-solid/src/presentation/transition-keyframes.test.ts packages/ui-solid/src/presentation/transition-dom.ts packages/ui-solid/src/presentation/transition-dom.test.ts`
4. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slt-05-runner-effects.log -- packages/ui-solid/src/presentation/transition-keyframes.ts packages/ui-solid/src/presentation/transition-keyframes.test.ts packages/ui-solid/src/presentation/transition-dom.ts packages/ui-solid/src/presentation/transition-dom.test.ts`

## Done criteria

- [x] Every new kind has a keyframe test and a DOM test where it touches the
  DOM.
- [x] All Phase 1 presentation tests pass unchanged.
- [x] Only writePaths changed by this plan.

Implementation complete; formal review and combined-tree verification remain
in the downstream workflow. See `impl-plans/progress/slt-05-runner-effects.md`.
