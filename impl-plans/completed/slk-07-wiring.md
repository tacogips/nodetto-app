# slk-07-wiring

- planId: slk-07-wiring
- planPath: impl-plans/active/slk-07-wiring.md
- progressPath: impl-plans/progress/slk-07-wiring.md
- wave: 3; dependsOn: slk-00-strict-index-gate, slk-03-copy-links,
  slk-04-transition-planner, slk-05-transition-runner, slk-06-link-inspector
- Design: sections 6.1-6.3, 7, 9 and 9.1 of `design-docs/specs/design-slide-link-animation.md`.
- writePaths: `packages/ui-solid/src/presentation/controller.ts`,
  `packages/ui-solid/src/presentation/PresentationView.tsx`,
  `packages/ui-solid/src/presentation/Presentation.css`,
  `packages/ui-solid/src/presentation/controller-transition.test.ts` (new),
  `packages/ui-solid/src/Inspector.tsx`, `packages/ui-solid/src/index.ts`,
  `packages/core/src/index.ts`, `docs/editing.md`, `README.md`,
  `impl-plans/progress/slk-07-wiring.md`, `tmp/slk-s855/slk-07-wiring`, `target`
  (the two index files only if an export is missing; currently none is
  expected)
- sharedPaths (wave-1 files, already landed; edit ONLY to fix a
  diagnostic that the strict-index union gate attributes to that file,
  without changing behaviour or tests' intent):
  `packages/ir/src/validate.ts`, `packages/ir/src/link-id.test.ts`,
  `packages/io/src/jsonl/link-id.test.ts`, `packages/collab/src/link-id.test.ts`,
  `packages/core/src/presentation/slide-transition-types.ts`,
  `packages/core/src/presentation/slide-transition-types.test.ts`.
  artifactRoots: `target`.

## Intent and context

This plan connects the planner (slk-04) and the runner (slk-05) to the
presentation view, mounts the inspector section (slk-06), documents the
feature, and runs the final gates.

## Non-goals

- No change to `keys.ts`, the navigation reducer, `commands.ts`, the
  exporter, or `apps/desktop` (no desktop change is needed).
- Jumps (goto/first/last) are not animated. No document setting.

## File-level changes

1. `controller.ts`:
   - Refactor `slide()` to use `renderSlide` from `./slide-render.ts`. Keep
     the `{src, size}` contract, the data-URL encoding and the
     `(page, revision)` cache exactly: `size` = rect width/height for an
     explicit slide size, else `svgSize(svg)`.
   - Add `transition(): { fromPage; toPage; fromSvg; toSvg; plan } | null`,
     set by `dispatch`. It is non-null only when all of these hold:
     - the action is `next`, `prev`, or `enter` with empty digits;
     - the index moved by exactly 1;
     - `black` is false both before and after;
     - both rects are non-null;
     - `planSlideTransition(...)` returns `kind: "animate"`.
     Any other state-changing dispatch (slide or black change, or exit)
     clears it. Digit and `clearDigits` actions leave it unchanged.
   - Add `clearTransition()`.
2. `PresentationView.tsx`:
   - Own one `SlideTransitionRunner`.
   - After each dispatch, if `controller.transition()` is non-null and
     `window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true`,
     set a `transition` signal and mount `<TransitionLayer>` inside
     `.presentation-slide`. Otherwise call `runner.cancel()` and clear the
     signal.
   - Every new dispatch, revision change (`rev()` effect) and unmount
     cancels the runner and clears the signal before anything else.
   - `onDone` clears the signal only if it still holds the same transition
     object (identity check).
   - While the signal is set, the `<img>` gets the class
     `transitioning`.
3. `Presentation.css`: `.presentation-slide img.transitioning { visibility: hidden; }`
   and a layer rule (`position:absolute; inset:0; pointer-events:none`).
   Add no colours and no tokens.
4. `Inspector.tsx`: inside the `single()` block next to "Containing frame"
   (line ~485), add
   `<details class="nodetto-inspector-details"><summary>Slide link</summary><SlideLinkSection .../></details>`,
   shown only when `element().visual.linkId` is set.
5. `docs/editing.md` `## Presentation` (line ~210): add a subsection "Slide
   links and animated transitions". It covers:
   - links created by Duplicate page and Copy shapes from page;
   - paste never links;
   - next/prev animation behaviour; jumps cut;
   - reduced motion; slide size mismatch cuts;
   - the inspector Unlink and Apply actions.
   `README.md`: extend the presentation feature bullet with one clause.
6. Index files: add exports only if `@nodetto/ui-solid` consumers need a
   new name (none expected); otherwise leave them untouched.

## Pitfalls

- The final slide must always be `currentSlide(state)`, because the
  resting `<img>` always renders the current state; the layer only
  overlays it.
- Rapid `next next`: the second dispatch cancels the first layer, and the
  new transition goes from the first target to the second (the controller
  computes it from the state before the second action).
- Do not leave `transitioning` on the img after cancel.

## Tests (`controller-transition.test.ts`, controller-level, no DOM)

- next between two linked slides -> `transition()` is non-null with an
  animate plan
- `goto`/`first`/`last` -> null
- `toggleBlack`, then next -> null
- next, next quickly -> the second transition's `fromPage` equals the
  first's `toPage`, and `currentSlide` equals the third slide
- a digit keeps the transition; exit -> no transition, and `onExit` gets
  the correct page
- size mismatch (no `slideSize`, different content bounds) -> null
- existing `controller.test.ts` and `slide-clip.test.ts` pass unchanged

## Verification (each must exit 0; verify gets up to 3 attempts for deadline tests, deadlines never relaxed)

1. `bun test packages/ui-solid/src/presentation packages/core/src/presentation`
2. `bun test packages/ir packages/io packages/collab packages/core/src/presentation packages/core/src/copy-page-elements.test.ts packages/ui-solid/src/presentation`
3. `bun run typecheck`
4. `bun .agents/scripts/strict-index-gate.ts capture-baseline --ref ccac2d3 --out target/strict-index/baseline.log`
5. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slk-07-union.log -- <union>`.
   The union is every TypeScript file in the writePaths of slk-01 through
   slk-07: packages/ir/src/types.ts, packages/ir/src/validate.ts,
   packages/ir/src/keyOrder.ts, packages/ir/src/link-id.test.ts,
   packages/io/src/jsonl/link-id.test.ts, packages/collab/src/link-id.test.ts,
   packages/core/src/presentation/slide-transition-types.ts and its test,
   packages/core/src/presentation/index.ts, packages/core/src/clipboard.ts,
   packages/core/src/editor/pages.ts, packages/core/src/link-id-copy.test.ts,
   packages/core/src/copy-page-elements.test.ts,
   packages/core/src/presentation/slide-transition.ts and its test, the nine
   slk-05 files, the three slk-06 files, controller.ts,
   PresentationView.tsx, controller-transition.test.ts, Inspector.tsx, plus
   any other pre-authorised test that `git diff --name-only ccac2d3` shows
   as changed.
6. `git diff --exit-code ccac2d3 -- packages/core/src/commands.ts packages/core/src/svg-export`
7. `mise run lint`
8. `mise run verify`

Evidence: complete logs and exit codes under `tmp/slk-s855/slk-07-wiring/`;
strict union log at `target/strict-index/slk-07-union.log`.

## Acceptance criteria

- Every command above exits 0.
- Next/prev animate per design 6.1; reduced motion and jumps switch
  instantly; cancellation leaves no layer.
- The inspector section is mounted; the docs and README are updated.
