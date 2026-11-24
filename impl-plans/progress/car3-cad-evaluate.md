# car3-cad-evaluate progress

Status: done for implementation; formal review and integration remain downstream.

- Finding: performance-cad-intermediate-solid-retention (R3-4).
- Implemented LRU triangle accounting, held active/current/final solids, atomic staged updates, bounded incremental eviction, and test-only usage counters.
- Added deterministic peak, nested, empty-result, multi-target, many-body, zero-entry failure/success, release, and independent accounting tests.
- Pre-fix tests recorded 601 peak handles, 12,100,000 peak charged triangles, 23 nested handles, and 6,200,000 triangles for empty Adds. Logs: `tmp/car3-r3/car3-cad-evaluate/baseline-peaks.log` and `tmp/car3-r3/car3-cad-evaluate/baseline-nested-empty.log` (both exit 1 as expected).
- Source hashes (SHA-256): `packages/core/src/cad/evaluate.ts` before `266ebfeb7e8183629d3f22880425800e8e62cd6ac2e84d33ffb639dd42dfdea4`, after `faeacaad2aa8e056899bdeb9c12eaec9426c749f601aafcfb82acd5c24b06edd`; `packages/core/src/cad/evaluate.test.ts` before `6ddffffd374a67af68d333f60cdb4c725e445b77a11e5108cc2372e649bcac4a`, after `2cee13ecc2a4709d043770372518e3d610c17e883756ba6cc2400eb4d5c1359f`. Per-edit intentions and intermediate hashes are under `tmp/car3-r3/car3-cad-evaluate/`.
- Verification: `bunx biome check --diagnostic-level=warn packages/core/src/cad/evaluate.ts packages/core/src/cad/evaluate.test.ts packages/core/src/cad/testing/recording-kernel.ts && bun test packages/core/src/cad/evaluate.test.ts packages/core/src/cad/check.test.ts packages/cad-kernel/src` exited 0, 96 passed, 0 failed. Complete log: `tmp/car3-r3/car3-cad-evaluate/final-verification.log`.
- Workspace-wide typecheck, lint and integration verification are assigned to the serial integration step. Formal review and subsequent finalization remain pending.
- Scoped typecheck: `bunx tsc --noEmit -p target/car3-cad-evaluate/tsconfig.json` exited 0; complete log `tmp/car3-r3/car3-cad-evaluate/typecheck.log`. The generated config extends the repository config and includes the two changed TypeScript files.
- Active plan SHA-256 before `ea1617594102b5657e814ba990b8941048fed9bcf7b183703cf867d8c5686060`, after `60417f98496e52fbf1a6d17d06be3289f339d7084d0f174260a64fe034db79d1`; progress file initially absent.
