# slt-07-wiring

- planId: slt-07-wiring; wave 3 (serial, last); dependsOn: slt-01 ... slt-06
- Design: sections 7, 8 and 10 (`slt-07` and final) of
  `design-docs/specs/design-slide-transition-settings.md`.
- writePaths: `packages/ui-solid/src/presentation/controller.ts`, new
  `packages/ui-solid/src/presentation/controller-navigation.test.ts`,
  `packages/core/src/presentation/index.ts`, `packages/core/src/index.ts`
  (only if an export is missing), `packages/ui-solid/src/index.ts` (only if
  needed), `packages/ui-solid/src/Inspector.tsx`, `docs/editing.md`,
  `README.md`, progress file, `tmp/slt-s856/slt-07-wiring`, `target`
- artifactRoots: `target`.

## Intent and context

Connect the finished pieces and own the shared registration files:
- the controller tells the planner the navigation direction;
- the core barrel exports the settings module;
- the Inspector mounts both sections;
- the docs describe the feature;
- then run the union gates.

## Non-goals

- No behaviour change beyond wiring. Do not edit feature modules owned by
  slt-01..06. Send defects back as findings rather than editing those
  files.
- No CSS, no new tokens. Jumps, black screen and reduced motion stay cuts.

## File-level changes

1. `controller.ts` (the `planSlideTransition` call near line 99): pass
   `navigation: state.index > before.index ? "forward" : "backward"`.
   Nothing else in the adjacency, black or reduced-motion logic changes.
2. `packages/core/src/presentation/index.ts`: add
   `export * from "./slide-transition-settings.ts";`. Check for export-name
   collisions with `typecheck`.
3. `packages/core/src/index.ts`: edit only if a needed name is not
   reachable from `@nodetto/core` (record the check).
4. `Inspector.tsx`:
   - mount `<SlideTransitionSection editor pageId={current().id} />` right
     after `<PresentationSection ...>` in the no-selection block (line
     ~431);
   - mount `<SlideAnimationSection editor elements={[element()]} />` right
     after `<SlideLinkSection ...>` for a single selection;
   - for multi-selection (the `selectedIds().length > 1` block near line
     476), mount it with the selected elements, read from the store and
     excluding `presentation.slide`.
   - Imitate the existing direct imports of `SlideLinkSection`.
5. `packages/ui-solid/src/index.ts`: export the sections only if the
   package exports sibling sections the same way (check how
   `SlideLinkSection` is handled and match it).
6. `docs/editing.md`: under "Slide links and animated transitions" (line
   ~256), add a "Slide transition and slide animation" subsection covering:
   - modes, duration, stagger, Reset;
   - per-shape effects, sides, delay, duration, order;
   - slide N owning both directions and the mirrored effects going back;
   - the fact that settings live on the page itself, survive deleting
     shapes and work on empty slides;
   - Duplicate page keeping them and copy/paste never transferring them.
   No mention of private infrastructure. `README.md`: one feature bullet
   next to the slide-link bullet.

## Tests (`controller-navigation.test.ts`, pattern `controller-transition.test.ts`)

- next from slide 1 to 2 with a `mode: "fade"` carrier on slide 2 -> the
  transition plan is one `slide-fade` step;
- prev from 2 to 1 -> the planner uses slide 2's settings (fade);
- prev with a `mode: "cut"` carrier on slide 2 -> no transition descriptor
  (instant switch);
- a document without settings -> the same descriptors as Phase 1 (the
  existing `controller-transition.test.ts` passes unchanged).

## Verification (exit 0; complete logs in `tmp/slt-s856/slt-07-wiring/`)

1. `bun run typecheck`
2. `bun test packages/ir packages/io packages/collab packages/core/src/presentation packages/ui-solid/src/presentation packages/ui-solid/src/inspector packages/core/src/visual-animation-command.test.ts packages/core/src/slide-settings-carrier.test.ts apps/cli/src/edit/label-field.test.ts`
3. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slt-07-union.log -- <union>`. The union is every `.ts`/`.tsx` file in the writePaths of slt-01..slt-07 that exists, listed explicitly in the log.
4. `mise run lint`
5. `mise run verify`. Retry policy: up to 3 attempts in total, only when
   an attempt fails solely on deadline-sensitive tests under machine load.
   Record each attempt's exit code and complete log. Never relax a
   deadline.
6. `git diff --exit-code a9abe26 -- packages/core/src/presentation/slide-transition.test.ts`
   exits 0.
7. Recorded evidence (not an exit-0 gate): save `git diff a9abe26 --
   packages/core/src/commands.ts` to
   `tmp/slt-s856/slt-07-wiring/commands-diff.log` and confirm it holds only
   the slt-01 validation wiring (import plus one filtered call), with no
   `Command` union or `updateDocument` change.
8. The union gate list in step 3 must include
   `packages/io/src/jsonl/golden.test.ts` and every pre-authorised optional
   `.ts`/`.tsx` file that slt-03 or slt-05 actually edited (check their
   progress logs).

## Done criteria

- All commands exit 0, with complete logs.
- Both sections appear in the Inspector, disabled when read-only.
- The docs are updated.
- Only writePaths changed.
