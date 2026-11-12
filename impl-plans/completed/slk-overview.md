# slk overview: slide links and animated slide transitions (Phase 1)

- taskId: slk-s855 (workflowExecutionId opus-terra-design-and-implement-review-loop-session-855)
- Issue: none. The session 855 runtime workflowInput is authoritative.
- Design (accepted at Step 3, comm-020082; SLK-DESIGN-001..003 resolved):
  `design-docs/specs/design-slide-link-animation.md`. Baselines:
  `design-docs/specs/design-presentation.md` and
  `design-docs/specs/design-slide-area-copy-shapes.md`. Owner Q&A:
  `design-docs/user-qa/slide-link-animation.md` (Q1-Q6, defaults applied).
- Branch: `feat/slide-link-animation`, local only (gitPush false). No
  worktrees, no private branches, no git operations by workers.
- Evidence root: `tmp/slk-s855/<planId>/`. Progress logs:
  `impl-plans/progress/<planId>.md` (each worker edits only its own).
- Strict-index logs: `target/strict-index/` (artifact root `target`).

## Waves

| Wave | Plan | Depends on |
| --- | --- | --- |
| 1 | slk-00-strict-index-gate: `.agents/scripts/strict-index-gate.ts` | none |
| 1 | slk-01-link-field: `Visual.linkId` in IR, validation, key order; JSONL/Yjs tests | none |
| 1 | slk-02-transition-contract: plan types, timing constants, `staggerStart`, `scopeSvgIds`, `svgViewBox` | none |
| 2 | slk-03-copy-links: paste strips links; cross-page copy assigns links | 00, 01 |
| 2 | slk-04-transition-planner: `planSlideTransition` | 00, 01, 02 |
| 2 | slk-05-transition-runner: keyframes, `classifyDrawOn`, runner, layer, `renderSlide` | 00, 02 |
| 2 | slk-06-link-inspector: `slide-link-edits.ts`, `SlideLinkSection.tsx` | 00, 01 |
| 3 | slk-07-wiring: controller, view, CSS, Inspector mount, docs, README, final gates | 00, 03, 04, 05, 06 |

Every file has exactly one owner per wave.
`packages/core/src/presentation/index.ts` is appended by slk-02 (wave 1)
and slk-04 (wave 2) only.

## Pinned contracts (exact names; do not rename)

- IR (slk-01): `Visual.linkId?: string`, declared right after `componentKey`
  in `packages/ir/src/types.ts`. `"linkId"` comes right after
  `"componentKey"` in `packages/ir/src/keyOrder.ts`.
- Core presentation types (slk-02, `slide-transition-types.ts`):
  - `interface SlideViewBox { readonly x: number; readonly y: number; readonly width: number; readonly height: number }`
    Do NOT name a new type `SlideRect`; `slide-rect.ts` already exports
    one. The existing `SlideRect` is structurally assignable to
    `SlideViewBox`.
  - `interface SlideBox extends SlideViewBox { readonly rotation: number }`
  - `interface SlideAppearance { readonly opacity: number; readonly fill?: string; readonly stroke?: string; readonly strokeWidth?: number }`
  - `type SlideStepKind = "transform" | "crossfade" | "draw-on" | "grow" | "fade-in" | "fade-out"`
  - `interface SlideTransitionStep { kind; from?: ElementId; to?: ElementId; start: number; duration: number; easing: "ease-in-out"; fromBox?: SlideBox; toBox?: SlideBox; fromAppearance?: SlideAppearance; toAppearance?: SlideAppearance; appearanceChanged?: boolean }`
    (all fields readonly)
  - `type SlideTransitionPlan = { readonly kind: "cut"; readonly reason: "size-mismatch" | "empty" } | { readonly kind: "animate"; readonly duration: number; readonly steps: readonly SlideTransitionStep[] }`
  - Constants: `SLIDE_MOVE_MS = 700`, `SLIDE_FADE_OUT_MS = 300`,
    `SLIDE_ENTRANCE_MS = 700`, `SLIDE_ENTRANCE_OFFSET_MS = 300`,
    `SLIDE_STAGGER_MS = 60`, `SLIDE_STAGGER_BUDGET_MS = 480`
  - `staggerStart(rank: number, count: number): number`
  - `scopeSvgIds(svg: string, prefix: string): string`
  - `svgViewBox(svg: string): SlideViewBox | null`
- Planner (slk-04, `slide-transition.ts`):
  `planSlideTransition(store: Store, registry: ShapeUtilRegistry, input: { readonly from: { readonly page: PageId; readonly rect: SlideViewBox }; readonly to: { readonly page: PageId; readonly rect: SlideViewBox } }): SlideTransitionPlan`
- Runner (slk-05, `packages/ui-solid/src/presentation/`):
  - `renderSlide(editor: Editor, page: PageId): { readonly svg: string | null; readonly rect: SlideViewBox | null }` (`slide-render.ts`)
  - `classifyDrawOn(nodes: readonly DrawOnProbe[]): readonly DrawOnClass[]` (`transition-keyframes.ts`)
  - `prepareTransition(outgoingSvg: Element, incomingSvg: Element, plan: <animate plan>): SlideNodeLookup`
    (`transition-dom.ts`; `SlideNodeLookup` = readonly list of jobs
    `{ target: Pick<Element, "animate">; keyframes: Keyframe[]; options: KeyframeAnimationOptions; onFinish?: () => void }`)
  - `class SlideTransitionRunner { play(jobs: SlideNodeLookup): Promise<"finished" | "cancelled">; cancel(): void }` (`transition-runner.ts`)
  - `TransitionLayer` component (`TransitionLayer.tsx`), props
    `{ fromSvg: string | null; toSvg: string | null; plan: <animate plan>; runner: SlideTransitionRunner; onDone: (result: "finished" | "cancelled") => void }`
- Inspector (slk-06, `packages/ui-solid/src/inspector/slide-link-edits.ts`):
  `linkedPages(store: Store, element: Element): PageId[]`,
  `planUnlink(element: Element): Command[]`,
  `planApplyToLinked(store: Store, element: Element, options: { readonly geometry: boolean }): Command[]`;
  component `SlideLinkSection(props: { editor: Editor; element: Element })`.
- Strict gate (slk-00): see `slk-00-strict-index-gate.md` for the CLI.

## Global invariants

- `packages/core/src/commands.ts` is not edited by any plan
  (`git diff --exit-code ccac2d3 -- packages/core/src/commands.ts`).
- The exporter (`packages/core/src/svg-export/*`) and golden fixtures are
  not edited.
- No new dev dependency. No server, auth or deployment code. No Rust.
- Strict TypeScript, no `any`. Check every indexed access for `undefined`.
- Workers never run git commands that change state (no commit, stash,
  checkout or reset).

## Strict-index baseline (Step 5 SLK-PLAN-001)

`capture-baseline` extracts `ccac2d3` into a per-invocation
`target/strict-index/base-tree-<pid>-<timestamp>` directory and always
removes it in `finally`, so `bun test` filters and `mise run verify` never
discover stale test copies. Only `baseline.log`, `.exit` and `.ref` persist.

## Concurrency protocol (every plan)

Wave-2 plans run the repo-wide `bun run typecheck` while siblings edit
other files (Step 5 SLK-PLAN-L01). If it fails only in a sibling's
file, record the output, re-run once after a short wait, and on a second
failure log the drift for serial repair after the wave joins. Never edit
files outside writePaths to make it pass.


Before each edit, re-read the file. Record `shasum -a 256` before and after
in the progress log. If a file outside the plan's `writePaths` changed, or an
owned file changed unexpectedly between reads, stop editing that file, log
the drift, and leave it for serial repair after the wave joins. Workspace-wide
format, lint and full test gates run only in slk-07 and in reconciliation.
