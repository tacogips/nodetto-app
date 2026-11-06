# crl-09 parity and end-to-end progress

- Plan hash: d23d1ea9fb80b5815d61039c1b7504d8c5079c53. The accepted crl-08 dependency is present; this plan aligns with the design's fixture, parity and timing sections.
- Per-edit snapshots, intentions and hashes: `tmp/crl-s754/crl-09-parity-e2e/edits/`, `e2e/`, and `parity/`. Existing crl-08 edits were preserved.
- A new layered manual-routing test exposed changed stored waypoints after node moves; `e2e/manual-probe.log` records the failure. `apps/cli/src/arrange-modes.ts` now restores the original manual semantic before route planning unless reset is requested.
- The first current native fixture timing exceeded the plan's few-seconds threshold. Repair obstacle intersection now rejects disjoint bounding boxes before exact clipping, matching the existing greedy check. Further timing is required on the final binary.

## Baseline audit

- Commit: `1e8f43d224d7b43e200eb2229e7be17b39ca033c`; external directory `/tmp/crl09-baseline.vzXGql`, outside the checkout.
- `git archive 1e8f43d | tar -x -C "$BASE/src"`: exit 0; `bun install --frozen-lockfile` in `$BASE/src`: exit 0; `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli --manifest-path "$BASE/src/Cargo.toml" --target-dir "$BASE/build"`: exit 0. Logs: `tmp/crl-s754/crl-09-parity-e2e/baseline/audit.log` and `baseline/build.log`.
- Bun 1.4.4; cargo 1.98.1. Baseline binary SHA-256 `c8f5c9049d8877d9e277e55c97ec4f76012b6adf6f7201a3440368f1aad2afa0`.
- Preliminary three-run user-second means baseline/current and ratio (current binary SHA-256 `c5fc5d7e1df4b160372b7c2722f5d5573268e870e24e6f9cd4ca1220dff352b4`): layered 1.050/7.127/6.787; route 0.837/3.530/4.219; lint metrics 0.763/0.737/0.965; lint fix 0.630/0.950/1.508; batch 0.953/0.653/0.685; mixed 1.690/1.517/0.897. All 36 commands exited 0; commands and individual times in `baseline/timing.sh` and `baseline/timing.log`. These precede the bounding-box edit and must not be represented as final-source measurements.

## Carried coverage

- Second layered write and check: `arrange-modes.test.ts` two-frame tests. Strict improvement: `arrange-modes.test.ts` two-frame selection test. Manual semantic: same file, manual routing test.
- Non-endpoint state clearance and zero loop-label score: `connector-arrange.test.ts` fixture metrics test. Input check exit 1 without Moved and arranged check exit 0: same test.
- Forced fixture collision JSON fixes and repeat, and architecture label collision removal: `connector-arrange.test.ts`.
- Combined wrap and label fixes, one write, repeat no-op and failing batch atomicity: `lint-diagram.test.ts`.
- BPMN fix rejection: `lint-diagram.test.ts` and CLI wiring tests. Per-page and summary segment metrics: `lint-metrics.test.ts`, `cli-wiring.test.ts` and native parity metrics.
- W4 and native parity: `connector-routing-e2e.test.ts`, `native-parity/connect-routing.test.ts`, `native-parity/connector-arrange.test.ts`.

## Verification

- Final targeted CLI suite: exit 0, 30 pass, 0 fail; `final/cli.log`.
- `bun run typecheck`: exit 0, `final/typecheck.log`. Scoped Biome check: exit 0, `final/biome.log`.
- Fixture diff and baseline-path absence checks: exit 0, `final/fixture-diff.log` and `final/baseline-absent.log`.
- Native release build and parity/deadline suite: exit 0, 11 pass, 0 fail, 0 skip; `final/native.log`. Core lane and label suite: exit 0, 29 pass, `attempt-1/core.log`. Fixture and assertion remain unchanged.
- Final native timing: `bash tmp/crl-s754/crl-09-parity-e2e/baseline/timing.sh` exit 0, all 36 operations exit 0, `baseline/timing-final.log`. Binary SHA-256 `52f2d14b5ccd195ff29cf5af5351a33501a7f6149dffa50fd7083c376fa2db64`. Three-run means in user seconds, baseline/current/ratio: layered 1.553/7.127/4.588; route 1.233/4.267/3.459; lint metrics 0.990/1.130/1.141; lint fix 0.750/1.473/1.964; batch 0.960/0.923/0.962; mixed 1.530/1.373/0.898. Other tests ran during part of the timing, so contention may affect the samples.
- Performance remains unresolved: layered plus route averaged 11.394 user seconds, above the plan's few-seconds repair threshold despite the bounding-box guard. Bun CPU profile `/tmp/crl09-baseline.vzXGql/bun-profile.md` indicates repeated label text layout as a candidate hot spot; native profiling cannot attribute Boa bytecode to TypeScript functions. No unmeasured optimization is claimed. Formal reviews remain downstream.

## Continuation 1

- `connector-label-placement.ts` caches each non-BPMN edge's text layout within a placement pass. Candidate anchors and extents retain the original arithmetic; BPMN and null extents use the original path. Per-edit snapshots and hashes are in `tmp/crl-s754/crl-09-parity-e2e/continuation-1/`.
- Focused label and fixture tests: exit 0, 24 pass; assigned CLI suite: exit 0, 30 pass; typecheck and scoped Biome: exit 0; release native parity/deadline suite: exit 0, 11 pass, 0 skip. Full logs are in `continuation-1/`. Fixture diff and baseline absence checks exit 0.
- Uncontended three-run timing (`baseline/timing.sh`, exit 0; all 36 operations exit 0) is in `continuation-1/timing.log`. Current binary SHA-256 `694a4b73763a6e10c165b1e2b4e79950ebb4dfeb9922cce861dee5a72a1a421a`. Mean user seconds baseline/current/ratio: layered 0.850/4.873/5.733; route 0.700/3.890/5.557; lint metrics 0.613/0.840/1.370; lint fix 0.503/1.007/2.000; batch 0.707/0.700/0.991; mixed 1.193/1.113/0.933.
- Layered plus route now averages 8.763 user seconds, reduced from the prior 11.394 but still above the plan's few-seconds repair threshold. Further measured repair is outstanding; the earlier comparison was potentially contended.

## Continuation 2

- Tested allocation reductions in label-gap and obstacle-routing loops. Focused suite passed 29 tests and native parity passed 11 without skips, but a three-run timing (`continuation-2/timing.log`, all 36 operations exit 0) measured layered 6.753 and route 3.257 user seconds, totaling 10.010. Baseline means were 1.347 and 1.073 respectively. The two experimental hunks were removed because improvement was not demonstrated; `cmp` confirms both source files match their continuation-2 pre-edit snapshots exactly. Prior continuation-1 final-source checks and timing therefore apply again.
- The required performance repair remains unresolved: the retained source's recorded layered plus route mean is 8.763 user seconds, above the plan's few-seconds threshold. Logs and per-edit evidence are in `tmp/crl-s754/crl-09-parity-e2e/continuation-2/`.

## Continuation 3 (session 759)

- The owner decision is final: each native arrange command on the shared fixture uses at most 6 user seconds when uncontended; combined layered plus route is not a gate. The uncontended three-run means were layered 4.873 and route 3.890 user seconds, recorded in `tmp/crl-s754/crl-09-parity-e2e/continuation-1/timing.log`. The 17-state, 47-edge page measured 2.71 and 2.41 seconds respectively. Earlier unresolved and outstanding performance notes are superseded; no performance work or deadline changes are authorized.
- `git diff --name-only 00542c5 -- packages/core/src apps/cli/src` produced no paths (`tmp/crl-s759/crl-09-parity-e2e/final/source-diff.log`), so the recorded timings carry forward without repetition. Plan hash at start: `1633e196428e97765bb2c7cf4fda1797f1761a68`.
- Verification 1: exit 0, 30 pass, 0 fail, `tmp/crl-s759/crl-09-parity-e2e/final/cli.log`. Verification 2 and 3: exit 0, `final/typecheck.log` and `final/biome.log` under the same evidence directory. Verification 4: exit 0, 11 pass, 0 fail, 0 skip, `final/native.log`.
- Verification 5–10: each exit 0, respectively `final/baseline-absent.log`, `final/fixture-diff.log`, `final/assertion.log`, `final/plan-threshold.log`, `final/design-threshold.log`, and `final/progress-threshold.log`. Additional done-criteria checks: `grep -c 'moved label' apps/cli/src/native-parity/connector-arrange.test.ts` and `grep -n 'connectorRouting' apps/cli/src/native-parity/connect-routing.test.ts` exit 0, `final/moved-label.log` and `final/connector-routing.log`.
