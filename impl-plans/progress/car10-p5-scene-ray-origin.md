# car10-p5-scene-ray-origin progress

Status: done (implementation; formal review pending).

- `scene.ts` calls `crossingParity` with nanometre grid x and y and the existing exact predicate; lazy index construction is preserved.
- Removed the unused `forEachEdgeAtY` from `edge-y-index.ts` after confirming its definition was the sole remaining reference.
- Added the independent slotted-rim scene fixture and serialization helper; existing detailed-rim assertions remain unchanged.
- Negative control: `tmp/car10-r10/car10-p5-scene-ray-origin/pre-fix.log`, exit 1, 1 test failed with q=398592 against 40983.038.
- Final focused gate: `tmp/car10-r10/car10-p5-scene-ray-origin/gate.log`, exit 0, 50 tests passed, zero failed, Biome clean.
- Workspace typecheck, lint, `mise run verify` and native release parity are integration-owned per dispatch. Formal integrity and adversarial review remain downstream.
