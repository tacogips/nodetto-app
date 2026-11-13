# slt-s856 overview: slide transition and slide animation settings (Phase 2)

- Task: `slk-s855-phase2` (workflow session 856), branch
  `feat/slide-link-animation`, base head `a9abe26`.
- Design (source of truth): `design-docs/specs/design-slide-transition-settings.md`
  (accepted at Step 3, comm-020164). Baseline:
  `design-docs/specs/design-slide-link-animation.md`. Owner defaults:
  `design-docs/user-qa/slide-link-animation.md` Q7-Q11.
- Manifest: `impl-plans/active/slt-s856-dispatch.json`. Evidence root:
  `tmp/slt-s856/<planId>/`. Progress: `impl-plans/progress/<planId>.md`.

## User intent

Authors choose how each slide comes in (auto / cut / fade, duration,
stagger) and how each shape enters, exits or moves when linked (effect,
side, delay, duration, order). With no settings everything plays exactly
as Phase 1.

## Waves

| Wave | Plan | Depends on |
| --- | --- | --- |
| 1 | `slt-01-settings-fields` (IR fields, carrier type, validation, command wiring) | none |
| 1 | `slt-02-plan-contract` (step kinds, navigation, timing-aware stagger) | none |
| 2 | `slt-03-settings-plumbing` (carrier shape util, copy rules, selectAll, exporters, round trips) | 01 |
| 2 | `slt-04-planner-settings` (settings resolution, planner rules, Phase 1 pin) | 01, 02 |
| 2 | `slt-05-runner-effects` (keyframes and DOM preparation for new kinds) | 02 |
| 2 | `slt-06-inspector-sections` (edit helpers and two sections) | 01 |
| 3 | `slt-07-wiring` (controller navigation, barrels, Inspector mounting, docs) | 01-06 |

## Pinned contracts (exact names; other plans import these)

IR (`@nodetto/ir`, owned by slt-01):

```text
type SlideSide = "left" | "right" | "top" | "bottom";
type SlideMode = "auto" | "cut" | "fade";
type SlideEnterEffect = "auto" | "none" | "fade-in" | "draw-on" | "grow" | "scale-in" | "slide-in";
type SlideExitEffect = "auto" | "none" | "fade-out" | "undraw" | "scale-out" | "slide-out";
type SlideLinkedMotion = "auto" | "cut" | "crossfade";
interface SlideSettings { readonly mode?: SlideMode; readonly durationMs?: number; readonly stagger?: boolean }
interface ElementAnimation {
  readonly enter?: SlideEnterEffect; readonly enterFrom?: SlideSide;
  readonly exit?: SlideExitEffect;   readonly exitTo?: SlideSide;
  readonly linked?: SlideLinkedMotion;
  readonly delayMs?: number; readonly durationMs?: number; readonly order?: number;
  readonly slide?: SlideSettings;
}
Visual.animation?: ElementAnimation            // declared right after linkId
const SLIDE_SETTINGS_TYPE = "presentation.slide";
const ANIMATION_LIMITS: { slideDurationMs: [100, 5000]; durationMs: [50, 5000]; delayMs: [0, 5000]; order: [-999, 999] }
function validateElementAnimation(value: unknown, path: string): ValidationIssue[];
function readSlideSettings(pageElements: readonly Element[]): SlideSettings | undefined;
```

Core plan contract (`@nodetto/core`, owned by slt-02, already re-exported
through `packages/core/src/presentation/index.ts`):

```text
SlideStepKind adds "undraw" | "scale-in" | "scale-out" | "slide-in" | "slide-out" | "appear" | "disappear" | "swap" | "slide-fade"
SlideTransitionStep adds: readonly offset?: { readonly x: number; readonly y: number }
cut reason: "size-mismatch" | "empty" | "setting"
type SlideNavigation = "forward" | "backward";
interface SlideTiming { move; fadeOut; entrance; entranceOffset; stagger; staggerBudget }   // all number, ms
staggerStart(rank: number, count: number, timing?: Pick<SlideTiming, "stagger" | "staggerBudget">): number
```

Planner input (slt-04): `planSlideTransition(store, registry, { from, to,
navigation? })`, `navigation` defaulting to `"forward"`.

Inspector helpers (slt-06, exported by slt-07 only if needed):
`planSlideSettingsEdit(editor, pageId, patch)`,
`planAnimationEdit(elements, patch)`, `sharedAnimationValue(elements, key)`.

## Rules for every worker

- Edit only your plan's `writePaths` plus your own progress file and
  evidence directory. Before each edit, read the file fresh and record its
  `git hash-object` before and after in the progress log. If the pre-hash
  differs from your last read, or a file outside your writePaths changed in
  a way that breaks you, stop and record it as drift. Never revert another
  plan's edits.
- No git state changes (no commit, stash, checkout, reset). No new
  dependencies. No `any`. No emojis.
- Strict-index gate (Phase 1 tool, baseline `target/strict-index/baseline.log`
  at ccac2d3, already present): `bun .agents/scripts/strict-index-gate.ts
  check --baseline target/strict-index/baseline.log --log
  target/strict-index/<planId>.log -- <your TypeScript writePaths>`. It
  must exit 0. If the baseline file is missing, do not capture it
  concurrently; record a blocker.
- `bun run typecheck` checks the whole repository. If it fails only in a
  sibling plan's file during the same wave, record the exact diagnostic
  and re-run after the wave. Never edit the sibling's file.
- Progress log: what changed per file, the commands run, exit codes and log
  paths (`tmp/slt-s856/<planId>/*.log`), deviations, and open issues.
