# breadboard-14-ui-problems progress

## Implementation

- Added `breadboardProblemRows` to map `lintBreadboardPage` results in lint order, retaining element IDs, optional pin, reported reference, message, severity and part-reference chips.
- Added `canFixBreadboardReferences` for duplicate or trailing-`?` part references.
- Added `focusBreadboardProbe`: it validates the target page and surviving element IDs, changes page before setting selection and probe, frames only with a positive viewport, and returns false without changing selection when nothing survives.
- Added `BreadboardProblemsPanel` with a 300 ms editor debounce, breadboard-page guard, import warnings before findings, row and part-chip cross-probing, and the Fix references action.
- Exported the panel, props, row helper, fix eligibility helper, probe helper and row type from `packages/ui-solid/src/index.ts`.
- `BpmnProblemsPanel.tsx` and `bpmn-problems.ts` remain unchanged.

## Completion criteria

- Contract and public exports are present; verified by `grep -n 'BreadboardProblemsPanel' packages/ui-solid/src/index.ts` (exit 0, lines 124-126).
- ERC duplicate-reference and rail-short findings and parity missing-connection findings map to rows and part chips; focused test passes 6/6 with 18 assertions.
- Probe page switching, selection, pin retention, and deleted-ID false return are covered by focused tests.
- Focused behavioral verification: `bun test packages/ui-solid/src/breadboard-problems.test.ts` (exit 0; 6 tests passed, 0 failed; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/focused-final.log`).
- Owned-file typecheck gate: `! grep -E '^packages/ui-solid/src/(BreadboardProblemsPanel|breadboard-problems)|^packages/ui-solid/src/index\\.ts' tmp/breadboard-mode-s485/breadboard-14-ui-problems/typecheck-final.log` (exit 0; no plan-14 diagnostics).
- Style: `bunx biome check packages/ui-solid/src/BreadboardProblemsPanel.tsx packages/ui-solid/src/BreadboardProblemsPanel.css packages/ui-solid/src/breadboard-problems.ts packages/ui-solid/src/breadboard-problems.test.ts packages/ui-solid/src/index.ts` (exit 0; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/biome-final.log`).
- BPMN preservation: `git diff --quiet -- packages/ui-solid/src/BpmnProblemsPanel.tsx packages/ui-solid/src/bpmn-problems.ts` (exit 0).
- ASCII whole-file gate over the four new authored files and this progress record exits 0; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/ascii-files.log`.
- ASCII added-line gate for the `index.ts` export exits 0; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/ascii-index-added.log`.
- BPMN unchanged gate exits 0; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/bpmn-unchanged.log`.
- Progress-file existence gate exits 0; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/progress-exists.log`.

## Sibling diagnostics

- `bun test packages/ui-solid` exits 1 (206 tests reported, 197 passed, 9 failed). Failures are module-load errors in other files: five unresolved `breadboardPinAt` exports in plan-12 UI interaction consumers and four `jsxDEV` export errors in existing component suites. Full log: `tmp/breadboard-mode-s485/breadboard-14-ui-problems/ui-final.log`.
- `bun run typecheck` exits 2 from sibling CLI and plan-12 interaction diagnostics. No plan-14 path is reported by the owned-file grep. Full log: `tmp/breadboard-mode-s485/breadboard-14-ui-problems/typecheck-final.log`.
- These diagnostics are outside this plan's write paths and are not treated as plan-14 failures.

## Scope

Only plan-14 write paths were modified. Formal review, desktop mounting and inspector integration remain downstream workflow work.

## Step 6 current-source verification refresh

- Toolchain: `mise exec -- bun --version` prints `1.4.0`; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/toolchain-rerun.log` (exit 0).
- Focused behavioral test: `mise exec -- bun test packages/ui-solid/src/breadboard-problems.test.ts` passes 6 tests, 0 failures, 18 assertions; complete log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/focused-rerun.log` (exit 0).
- Plan G2 suite: `mise exec -- bun test packages/ui-solid` passes 499 tests across 51 files, 0 failures, 3675 assertions; complete log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/ui-rerun.log` (exit 0).
- Typecheck: `mise exec -- bun run typecheck` exits 0; complete log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/typecheck-rerun.log`. G1 own-path grep and unscoped TypeScript diagnostic grep are clean; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/g1-rerun.log` (exit 0).
- Biome: the focused five-file command exits 0 with no fixes; complete log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/biome-rerun.log`.
- Export contract: `grep -n 'BreadboardProblemsPanel' packages/ui-solid/src/index.ts` prints lines 124-126; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/export-grep.log` (exit 0).
- BPMN preservation: the diff check exits 0; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/bpmn-unchanged-rerun.log`.
- ASCII checks pass for all four new authored files and this progress log, and for added `index.ts` lines; logs `ascii-files-rerun.log` and `ascii-index-rerun.log` in this plan's evidence directory (both exit 0).
- The earlier sibling failures above describe an earlier moving-tree run. This source-current whole-package rerun and typecheck supersede those outcomes; the historical records are retained.
- Progress file existence check exits 0; log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/progress-exists-rerun.log`.

## Test-integrity repair: TI-S14-PAGESWITCH-01

- Corrected only the cross-page probe test in `packages/ui-solid/src/breadboard-problems.test.ts`: the resistor stays on `PAGE`; the fixture explicitly switches the editor to `otherPage` and asserts that starting page and a null probe before calling `focusBreadboardProbe`; the existing final page, selection and probe-with-pin assertions remain.
- The first attempt relied on page array order and failed because the editor still started on `PAGE`; preserved log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/pageswitch-focused.log` (5 pass, 1 fail). The explicit page switch corrected this assumption.
- Current-source focused suite: `mise exec -- bun test packages/ui-solid/src/breadboard-problems.test.ts` passes 6/6, 0 failures, 20 assertions; complete log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/review-focused-final.log`.
- Current-source ui-solid suite: `mise exec -- bun test packages/ui-solid` passes 500/500 across 51 files, 0 failures, 3680 assertions; complete log `tmp/breadboard-mode-s485/breadboard-14-ui-problems/review-ui-final.log`.
- Typecheck and G1 pass: complete log `review-typecheck-final.log`; G1 grep log `review-g1-final.log`; both are in this plan's evidence directory.
- Biome passes on the five owned TypeScript/CSS files; complete log `review-biome-final.log`.
- Negative control: temporarily moving `setBreadboardProbe` before `setCurrentPage` makes the corrected focused test fail because the resulting probe is null (5 pass, 1 fail). This was expected; complete log `pageswitch-mutation-negative.log`. The implementation was restored unchanged; `packages/ui-solid/src/breadboard-problems.ts` sha256 is `03532ae1372da54a4cba36672407c2797e5f60fb897958cb49c9dbb9dcf93877`.
- Independent integrity re-review of the correction is pending; no acceptance decision is claimed here.
