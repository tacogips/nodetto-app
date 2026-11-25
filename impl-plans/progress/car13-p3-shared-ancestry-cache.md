# car13-p3-shared-ancestry-cache progress

Status: done (implementation phase). Formal reviews and integrated workspace checks remain downstream.

The accepted R13-3 design is implemented with a lazy, walk-local identity map and a 4096-unit admission threshold. `makeTool` copies points and faces, `chargeTool` consumes point counts, and `sweptBounds` reads coordinates; none mutates the normalized loops. Per-tool bounds and charges remain independent.

- `packages/core/src/capture/scene.ts`: pre-edit SHA-256 `9175c3da1a77486d776db45ed3d3d5fb79db245724e54ae26162e9a3fa7a52ee`; final `7565b26c4fcdd1406faf110d9625990285d3839bb1ea430bbf5957b3b6f6299c`.
- `packages/core/src/capture/scene.test.ts`: pre-edit and intermediate hashes in `tmp/car13-r13/car13-p3-shared-ancestry-cache/*sha256`; final `cf94976567e508eb32f2e71c95944f4226f91d4ee76e7316793fb47a7f304208`.
- Fail-before regression: `bun test packages/core/src/capture/scene.test.ts --test-name-pattern 'shared whole profiles|ordinary capture avoids'`, exit 1, `tmp/car13-r13/car13-p3-shared-ancestry-cache/fail-before.log`: 16,539,104 versus 516,847 ancestry units.
- An intermediate fixture incorrectly selected only holes; its failed run is in `focused-attempt.log`. Selecting complete rim/hole pairs corrected it; `focused-second.log` exited 0.
- `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts`: exit 0, `biome.log`.
- `bun test packages/core/src/capture/scene.test.ts packages/core/src/cad/loop-forest.test.ts`: exit 0, 46 passed, `tests.log`.
- Prepared coordinates: slanted 16,384; sparse 32,840. Ordinary maximum direct work: 775; ancestor probes 5,000, index entries 5,500, forest fallbacks 0. Shared scenes match the oracle; explicit subsets avoid cache activity.

Evidence paths above are relative to `tmp/car13-r13/car13-p3-shared-ancestry-cache/` where abbreviated. Typecheck, workspace lint and `mise run verify` are assigned to integration by the dispatch.
