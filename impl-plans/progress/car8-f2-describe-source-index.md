# car8-f2-describe-source-index progress

Status: done (implementation; formal review and integration remain downstream).

- `packages/core/src/capture/describe.ts`: before `825c3247541b33d59694ac9e22c9594ecea8729dbde6c509648bd9e394c33515`; after `3ec6305e5728f5594f58518c6e05d256e31bf87057ce4f04c8d02df6476f60c4`. Added two-source index and ordered single walk.
- `packages/core/src/capture/describe.test.ts`: before `b6faec5564aaa6126413db8e03d70470c4a6bdf51f067f0845ef8141efa61c94`; after `d1156a06d1c5fb4b0465c34f9e7296d2af51a8585aab3d65476910353ebb6551`. Appended work-count, no-source and self-exclusion checks; existing tests unchanged.
- `impl-plans/active/car8-f2-describe-source-index.md`: before `a034a69cb04150cf812749303e721ad613439ae7437f3cde2b509e306ae72a03`; appended status. Progress file newly created.
- Pre-fix `bun test packages/core/src/capture/describe.test.ts`: 9 pass, 1 fail; reads 394241, 1574913, 6295553; complete test output `tmp/car8-r8/car8-f2-describe-source-index/pre-fix.log`. The surrounding shell exited 1 after a zsh readonly `status` assignment; the test output itself confirms the expected regression failure.
- Final `bunx biome check packages/core/src/capture/describe.ts packages/core/src/capture/describe.test.ts && bun test packages/core/src/capture/describe.test.ts`: exit 0, 10 pass, 0 fail; reads 2565, 5125, 10245; complete log `tmp/car8-r8/car8-f2-describe-source-index/final-gate.log`.
- An intermediate Biome check failed on two global `Infinity` references; corrected to `Number.POSITIVE_INFINITY` before the final gate.
- Per-edit intents and intermediate hashes are under `tmp/car8-r8/car8-f2-describe-source-index/`. Integration owns workspace typecheck, lint, verification and native determinism.
