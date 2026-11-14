# Progress: breadboard-pcb-03-core-export

Issue: `local-input:feat/breadboard-gerber@431bfdb` (workflow: `opus-luna-design-and-implement-review-loop-session-501`). This worker owns only the core exporter, Gerber/Excellon writer, core tests, and this progress file. Dependencies were accepted in runtime `acceptedPlanIds`: `breadboard-pcb-01-validator`, `breadboard-pcb-02-legend-clip`.

## Intent and evidence

- Read assigned plan `impl-plans/active/breadboard-pcb-03-core-export.md` and design `design-docs/specs/design-breadboard-pcb.md` before editing.
- Intent snapshots: `tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/intent-001.md` through `intent-008.md`; per-edit source hashes accompany snapshots.
- Step 0 protected source comparison: `git diff --quiet 431bfdb -- packages/core/src/breadboard/pcb.ts packages/core/src/breadboard/gerber.ts`, exit 0 before edits.
- Baseline example CLI export and unzip both exit 0. Baseline hashes are recorded by the original `shasum` output; baseline files are in `tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/baseline/`.
- Baseline fixture export exit 0; fixture script SHA-256 `4a070908dae13bda556e130a8a442a47f4bf6730accd30885213f3494a01ce8c`. Step 0 outputs are in `baseline-fixture/`.
- Final source hashes: `pcb.ts` `be947c82218087319feec30903db465663dfc05539b1ad4378335190c9775387`; `gerber.ts` `ee1815531967634c80061465e2d6c91e735ba34aad5ccd5a512fb60620d52f0e`; `pcb.test.ts` `85d99bfa0208b0906cbcc0fa2d7c1fde3be58587193d8619cd73a1024686e47f`.

## Implemented

- Added the three pinned design-rule keys and `outline?: "board" | "used"`.
- Clipped legend label, mark, outline, reference and jumper strokes against per-pad keepouts and the full-board legend rectangle. Reference placement checks keepouts. Polarity marks try five deterministic directions and warn when no clear position is available. Removed `markBeside`.
- Updated drill header to the pinned self-authored comment and formatted every hit with three decimals.
- Implemented used outline trimming, outward 0.01 mm bounds, translated output geometry/drills, trimmed profile/note dimensions, and whole-group board-label inclusion checks. Board-mode copper, mask and profile files stay byte-identical to baseline.
- Test helper validates every generated Gerber and Excellon file. Added R1, R2, R3, R4, R5 clear/blocked, F1, default/used, and rotated-used cases. Existing tests remain and were updated only for intended DRL/GTO changes.

## Verification

Each log below is complete and under this plan's evidence directory.

- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/breadboard` — exit 0; 136 passed, 0 failed; log `tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/tests-final.log`.
- `bunx biome check packages/core/src/breadboard/pcb.ts packages/core/src/breadboard/gerber.ts packages/core/src/breadboard/pcb.test.ts --diagnostic-level=warn` — exit 0; log `biome-check-final.log`.
- `bun run typecheck` — exit 0; log `typecheck-final2.log`.
- `bunx tsc -p tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/tsconfig.nuia.json` — exit 2 due unrelated existing diagnostics in BPMN, ERC, connector-policy, frame-membership, sequence-authoring, and stroke-drag tests. Filter for `breadboard/(pcb|gerber|pcb-legend)\\.ts` is empty (exit 0); full log `nuia-final2.log`.
- Example CLI final-source export: `bun apps/cli/src/main.ts breadboard gerber examples/breadboard/led-button.jsonl --output tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after/led-button.zip` — exit 0; complete log `after-cli-final.log`. `unzip -o tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after/led-button.zip -d tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after` — exit 0; complete log `after-unzip-final.log`.
- Fixture final-source export: `bun tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/fixture-export.ts tmp/breadboard-pcb-s501/breadboard-pcb-03-core-export/after-fixture` — exit 0; complete log `after-fixture-final.log`; script SHA-256 remains the Step 0 hash above.
- Ten baseline comparisons (GTL, GBL, GTS, GBS, GKO for example and fixture) — all exit 0. Commands were the plan's `for ext in GTL GBL GTS GBS GKO; do cmp ...; done`; output summary `ten_cmp_exit=0`.
- Example GTO and DRL `diff -u` exit 1 as expected; complete diffs `gto-diff.log` and `drl-diff.log`.
- Constraint checks: `Math.(hypot|sin|cos|atan2)` has exactly one existing match (routing-only distance comparison); `markBeside` count 0; no fabrication validator import in `pcb.ts`; all checks pass.

## Pre-fix test evidence limitation

The assigned contract requires each R1-R5 and F1 regression to have a recorded failing run on 431bfdb before the fix. The original-source snapshot and output baselines were captured before edits, but the complete new regression suite was not run against the original source. `early-tests.log` records failures while the changed implementation still had old test expectations (DRL decimal, jumper clipping, and updated mark warning), not a valid pre-fix run for every new case. This evidence requirement remains incomplete for R1, R2, R5 and F1. Do not treat the early run as satisfying it.

## Handoff

Implementation behavior and final-source plan gates pass except the pre-fix regression-evidence requirement above and the whole-core `noUncheckedIndexedAccess` command's unrelated diagnostics. The filtered plan-owned files are clean. Downstream CLI parity, golden/docs integration, whole-repository final verification, and formal reviews remain owned by later plans/workflow steps.

## Pre-fix evidence (recorded after the workflow)

The plan's tests were run with `431bfdb`'s `pcb.ts` and `gerber.ts` swapped in
and the current tests unchanged. The first run showed that R1 passed
vacuously, because the old rules have no `legendPadClearance` (design 11.3,
F2). After the clearance check was fixed to reject non-finite rules, these
tests fail on `431bfdb`: R1, R2, R3/R4, R5 (omitted mark) and the outline
modes, as do the two pre-existing tests whose expectations the fixes changed
(the strip/pad test and the jumper test). F1 and the R5 kept-mark case pass
there as guards. All pass on the result.
