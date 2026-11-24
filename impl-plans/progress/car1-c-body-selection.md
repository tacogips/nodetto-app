# car1-c-body-selection progress

Implemented exact-ID precedence, indexed name/prefix lookup, duplicate elimination, ascending results and lazy error names. The 5,000-body regression bounds lookup counts. Existing tests remain unchanged. The preimplementation resolver fails the new exact-ID test (exit 1; `tmp/car1-r1/car1-c-body-selection/negative-control.log`).

Pre-edit SHA-256: see `tmp/car1-r1/car1-c-body-selection/pre-sha256.txt`. Post-edit hashes: see `tmp/car1-r1/car1-c-body-selection/post-sha256.txt`.

- `biome check packages/core/src/capture/cad-request.ts packages/core/src/capture/cad-request.test.ts && bun test packages/core/src/capture/cad-request.test.ts`: exit 0, 16 passed; `target/car1-c-body-selection/logs/gate1-passing.log`.
- `bun test packages/core/src/capture apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts`: exit 0, 144 passed; `target/car1-c-body-selection/logs/capture-tests.log`.
- `bun run typecheck && bun test packages/core/src/capture apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts`: initial exit 1, shared-tree sibling inspector files have type errors; `target/car1-c-body-selection/logs/gate2.log`. Retry exit 1: `packages/ui-solid/src/test-dom/cad-inspector.dom.tsx` remains in progress; `target/car1-c-body-selection/logs/gate2-retry.log`. Rerun the combined gate after the sibling errors are resolved.

Formal review and final integration remain downstream. No cargo commands were needed.

## Redispatch verification

- Focused Biome and test gate: exit 0, 16 passed, 0 failed; `tmp/car1-r1/car1-c-body-selection/resume-gate1-complete.log`.
- `bun run typecheck && bun test packages/core/src/capture apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts`: exit 0, 144 passed, 0 failed; `tmp/car1-r1/car1-c-body-selection/resume-gate2.log`. The earlier sibling typecheck failures are superseded by this run.
- Source and plan hashes before this progress update: `tmp/car1-r1/car1-c-body-selection/resume-pre-sha256.txt`; final hashes: `tmp/car1-r1/car1-c-body-selection/resume-post-sha256.txt`.
