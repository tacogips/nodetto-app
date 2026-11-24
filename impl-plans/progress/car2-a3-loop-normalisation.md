# car2-a3-loop-normalisation

Status: done (implementation; formal review and integration pending).

R2-4: depth buckets preserve the greatest selected containing depth; the only production change is inside `normaliseToolLoops`. Tests cover the production loop builder, probe scaling, identity and order against the original oracle, partial and nested selections, and capture bytes. The plan's recorded pre-fix probe measurements are 252,002 / 1,004,002 / 4,008,002; a temporary counter on this plan’s fixture measured 250,500 / 1,001,000 / 4,002,000 (the historical measurements use a different fixture); `tmp/car2-r2b/car2-a3-loop-normalisation/attempt-1/baseline-probes.log`. The baseline regression in `baseline.log` independently fails because the old function does not count probes. Baseline NCS1 SHA-256 on 3cd2401: `f66e95cd114f0cb905c75c6382dd9795d435bc745d85545aa7a70c994177c531`; the final test matches it. The baseline digest placeholder also intentionally failed in that measurement run.

| File | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| packages/core/src/capture/scene.ts | a188421847cd9202d3f83f9740358095fa344ab0852d56366eb7cb4e25f2ea4d | 3b8e77d48c2095842b37b26ed9f23d760fa9e92441ccdd00871937c50f97c594 |
| packages/core/src/capture/scene.test.ts | 6f4e0807d11996583035fb55fedb6a16dec11056ad230cde471d70903f6c1f35 | 3ffb3ae9ee1ce8aa2ee35b48fa22c45e0571cf8c4d3aa1f3922a6ca4feed3b75 |
| impl-plans/progress/car2-a3-loop-normalisation.md | absent | See evidence post-progress-sha256.txt (self-hash cannot be embedded). |

Commands and logs (shared working tree):

- `bun test packages/core/src/capture/scene.test.ts` on baseline with new tests and digest placeholder: exit 1, 25 passed, 2 expected failures; `target/car2-car2-a3-loop-normalisation/logs/baseline.log`.
- `bun test packages/core/src/capture/scene.test.ts packages/core/src/capture/cad-request.test.ts packages/core/src/capture/determinism.test.ts`: exit 0, 44 passed, 0 failed; `target/car2-car2-a3-loop-normalisation/logs/tests.log`.
- `bunx biome check --diagnostic-level=warn packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts`: exit 0; `target/car2-car2-a3-loop-normalisation/logs/biome.log`.

Workspace typecheck and integration verification are deferred to the serial integration step as required by the dispatch. Per-edit intentions and copies of logs are under `tmp/car2-r2b/car2-a3-loop-normalisation/attempt-1/`.
