# car14-p5-pcb-profile-cache

Status: done (implementation); formal reviews and integration are downstream.

- Finding: performance-capture-shared-pcb-outline-ancestry-rebuilds.
- Per-edit SHA-256 hashes, snapshots and intentions: `tmp/car14-r14/car14-p5-pcb-profile-cache/` (`pre-edit.sha256`, `test-post.sha256`, `test-format-pre.sha256`, `test-format-post.sha256`, `production-pre.sha256`, `production-post.sha256`, `production-format-pre.sha256`, `production-format-post.sha256`, `plan-pre.sha256`, `plan-post.sha256`).
- Fail-before: `bun test packages/core/src/capture/scene.test.ts -t 'shared PCB outlines reuse ancestry and preserve scene bytes'`, exit 1, one failure; `tmp/car14-r14/car14-p5-pcb-profile-cache/fail-before.log`. Work 1,057,160 versus 132,145 for one reference.
- Final: `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts`, exit 0; `tmp/car14-r14/car14-p5-pcb-profile-cache/biome-final.log`.
- Final: `bun test packages/core/src/capture/scene.test.ts packages/core/src/cad/loop-forest.test.ts`, exit 0, 47 passed; `tmp/car14-r14/car14-p5-pcb-profile-cache/tests-final.log`.
- Work for (256,8), (512,16), (1024,32): 132145, 245219, 517559 respectively, each equal to the single-reference control. Index entries 512, 1024, 2048; forest fallbacks 1 each; prepared 4096, 8192, 16384.
- Initial Biome check exited 1 due to predicate wrapping; fixed and reran. `tmp/car14-r14/car14-p5-pcb-profile-cache/biome.log`.
- Workspace typecheck, lint and verification are assigned to serial integration in the overview. Tests ran on the shared moving tree; final integration confirms stable tree.
