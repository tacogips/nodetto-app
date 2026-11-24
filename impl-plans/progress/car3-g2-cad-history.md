# car3-g2-cad-history progress

Status: done for implementation; formal review and integration remain downstream.

- history.ts original: b26f331269d74eb5e12302771d85cfde8b4a5aeb535c66350713d5196b19da16; current: 6ad06ed3cbb5656e978491ffbdbec15a5b0378cb1c17d3b9f63015f413064223. Increment-only baseline reverted to original hash before implementation.
- history.test.ts original: 7342f65d9ab1babb422c1af367ac5e3fe0575119dda0e8c4391f49048c4fe959; current: b2ddaa2e0aee90f50a1edafbff51ee32d03eea3bbba8c9ab4c7c5f538f8c224e.
- active plan pre-edit: 347bffacace7252da163386377e4ea6cae16cb2e705cd9a474c9cff066150e3b; current: 3463c40f67d1f4b1bd2985ab068c111a3af2842b8be836dce9ba263552edc225. Per-edit snapshots and intentions are under tmp/car3-r3/car3-g2-cad-history.
- Baseline command `bun test packages/core/src/cad/history.test.ts`: exit 1, 10 passed, 4 expected failures, log `tmp/car3-r3/car3-g2-cad-history/baseline.log`. Profile builds 780/3160; status visits and loop probes 62500/250000.
- Candidate counts: profile builds 39/79, status visits 250/500, loop probes 500/1000.
- Focused tests: `bun test packages/core/src/cad/history.test.ts packages/core/src/cad/frames.test.ts packages/core/src/capture` exit 0, 150 tests, log `tmp/car3-r3/car3-g2-cad-history/focused.log` (before final test type narrowing; rerun required).
- Strict scoped check: `bunx tsc --noEmit -p tmp/car3-r3/car3-g2-cad-history/tsconfig.json` exit 0, log `tmp/car3-r3/car3-g2-cad-history/typecheck-final.log`.
- Biome: `bunx biome check --diagnostic-level=warn packages/core/src/cad/history.ts packages/core/src/cad/history.test.ts` exit 0, log `tmp/car3-r3/car3-g2-cad-history/biome-final.log`.
- Required aggregate currently fails in concurrent `packages/core/src/cad/evaluate.test.ts`: 339 passed, 2 failed; log `tmp/car3-r3/car3-g2-cad-history/gate-attempt.log`. Rerun the exact plan gate after the sibling plan is done. Workspace-wide gates and formal reviews are downstream.

- Final-source focused tests: exit 0, 150 passed, 0 failed; `tmp/car3-r3/car3-g2-cad-history/focused-final.log`.
- Full plan gate rerun on moving shared tree: exit 0, 342 passed, 0 failed; `tmp/car3-r3/car3-g2-cad-history/gate-final.log`. At that time the sibling progress had not been published; the required subsequent rerun is recorded below.

- After `car3-cad-evaluate` reported implementation done, the exact plan gate exited 0 with 342 passed and 0 failed. Complete log: `tmp/car3-r3/car3-g2-cad-history/gate-post-sibling.log`.
