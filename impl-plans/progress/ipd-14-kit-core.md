# ipd-14-kit-core progress

Partial implementation: added the kit interfaces in `packages/core/src/kits/ios/types.ts` and the empty downstream content registry in `content.ts`. The six bar components, insertion and property machinery, CLI wiring, tests and visual evidence remain outstanding. The plan is not complete.

`rg -n 'IOS_CONTENT_COMPONENTS' packages/core/src/kits/ios/content.ts` found one line. Scoped Biome check passed for the two new files. `bun run typecheck` exited 2 on the moving shared tree: missing `packages/core/src/prototype-links.ts` and a type error in `apps/cli/src/edit/operations/connect.ts`; complete output is in `tmp/ipd-s772/ipd-14-kit-core/typecheck.log`. These files are outside this plan's scope. Re-run all plan gates after completing implementation and after the sibling changes settle.

## Step 6 continuation, 2026-11-10

Added `packages/core/src/kits/ios/style.ts` with generic iOS color and typography constants, the 44-point touch-target constant, and a proportional, zero-padding text-layer builder. The accepted design's Decision 5 matches this scope. The six components, insertion, property handling, CLI wiring, behavioral tests and CLI PNG inspection remain outstanding; the plan is not complete.

`bun run typecheck` exited 2 on `packages/ui-solid/src/PrototypePreview.tsx` lines 212 and 224 (outside this plan's scope); see `tmp/ipd-s772/ipd-14-kit-core/step6-current/typecheck.log`. Scoped Biome on `style.ts` exited 0, and the content registry check found one match. Resume after the shared-tree typecheck errors are resolved, then implement the remaining plan and run all required verification on the final source.

## Step 6 rerun, 2026-11-10

Implemented a provisional six-component registry, instance insertion, typed property handling and CLI integration, with focused core and CLI tests. The CLI produced `tmp/ipd-s772/ipd-14-kit-core/step6-rerun/kit-bars.png` at scale 2; inspection found slot labels left-aligned, which was subsequently corrected in `bars.ts`. A fresh image must be generated and inspected after the remaining edits.

The implementation is not complete: full-width descendant reflow and independent updates of active slot colors require verification and potential repair, and the final gates must run after the source settles. The last focused aggregate recorded 45 passing tests and zero failures in `tmp/ipd-s772/ipd-14-kit-core/step6-rerun/aggregate.log`; it predates ongoing bar edits and is not final evidence. Formal review and commit remain downstream.

Final-source checks: focused aggregate 45 pass / 0 fail, full TypeScript check exit 0, scoped Biome exit 0, and the content registry has one match; logs are under `tmp/ipd-s772/ipd-14-kit-core/final/`. The CLI-generated `final/kit-bars.png` was inspected: icons render and tab labels are centered. A 402-point status-bar regression verifies the trailing battery position.

Still incomplete: slot frames are absolutely positioned and hidden slots do not reflow to fill the available width; independent active/color updates infer state from rendered colors and can lose earlier custom selections or colors; the tab badge is plain text rather than the specified badge treatment. These require fixes and regressions before acceptance. The test suite does not yet cover all required CLI status-bar insertion and badge/slot behavior. Formal review, integration and commit remain downstream.

## Step 6 continuation 1

The prior incomplete items are addressed: visible slots distribute across the full component width with half-point rounding and centered content; selection markers preserve active state across independent color and selection updates; tab badges use red rounded backgrounds and centered white text, with both layers hidden when cleared. Core and CLI regression tests cover these behaviors and status-bar placement in an iPhone frame. The scale-2 `tmp/ipd-s772/ipd-14-kit-core/continuation-1/kit-bars-final.png` was inspected: three tabs span the frame, icons and labels remain centered, and the badge is adjacent to its icon. Export reported a note-overflow warning for the deliberately overlapping icon badge.

Current-source verification logs are in `tmp/ipd-s772/ipd-14-kit-core/continuation-1/`: focused aggregate 50 pass and 0 fail, full TypeScript check exit 0, content registry one match, and scoped Biome check is rerun after formatting. Formal test-integrity, adversarial and integration review remain downstream.

## Adversarial review repair: S7-ipd14-navbar-trailing-icon-fullwidth

Flattened the trailing icon into the navigation component root, after the empty 44x44 button, and applied end constraints to both. The 390/402 regression reproduces the former 12-point drift before the fix and checks icon/button centering, right edge and title after it. CLI export `tmp/ipd-s772/ipd-14-kit-core/review-nav-fix/nav-390-402.png` was inspected: both trailing icons align with the right edge; the test verifies their positions inside the invisible hit areas. Current verification logs are in `review-nav-fix/`. Independent review remains pending.
