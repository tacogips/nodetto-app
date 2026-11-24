# car1-f desktop transport progress

Implemented raw scene requests with format and quality headers, framed binary replies, and focused transport and renderer-parity tests. This plan did not edit export-handlers.ts. Formal reviews and integration are downstream.

Pre-edit SHA-256: backend.ts `70436ca8ce866e15be5d322122b2b44b0a65592980392043a8c25a182b04f290`; capture.rs `325ceec1f57dad613539301d6f0eb260d0c8bf535f5886a2ada3229a93c001cf`; plan `4ab8bc87a5de84de940b8198e996edef6448138a2ff4fbd862e27d32b20ae756`; backend.test.ts and this progress file absent.

Post-edit SHA-256: backend.ts `ffc0a873f93b8d560d68deea0e2c1268c2d8574bcbdb8ef433fe7ebebba06134`; backend.test.ts `afca760039236539bd34cb4ffbd07e1bc3459f8bdcb9307c6804404cba6651c8`; capture.rs `d0428d65543e2d37245fb2db0d7a21a86b75c7cdbc961fc64097674602630bd6`; plan `0704f615859207f8cf50ffbbb24a8cf359f649601c638e4faa2eecd14f7c8638`.

Moving-tree verification logs, also copied under `target/car1-f/logs/`:

- `PATH="$PWD/node_modules/.bin:$PATH" biome check apps/desktop/src/file/backend.ts apps/desktop/src/file/backend.test.ts && bun test apps/desktop/src/file/backend.test.ts apps/desktop/src/shell/export-handlers.test.ts`: exit 0, 12 passed, `ts-tests-final.log`. Initial attempt used a nonconfigured biome shim and exited 1, `ts-tests.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-f cargo fmt -p app -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-f cargo test -p app capture`: exit 0, 2 passed, `rust-tests.log`.
- `bun run typecheck && bun test apps/desktop/src/file/backend.test.ts`: exit 2, `typecheck-tests-final.log`; sibling `packages/ui-solid/src/test-dom/cad-inspector.dom.tsx` has TypeScript errors. Earlier attempts: `typecheck-tests.log` (other concurrent CAD test errors), `typecheck-tests-rerun.log` (same inspector errors). Retry after sibling repair; focused test already passed above.
- Negative control on eb7d8c9 backend: `bun test target/car1-f/negative/backend.test.ts`: exit 1, 2 failed as expected, `negative-behavior.log`. First setup attempt had missing module resolution, `negative.log`.

Complete evidence and per-edit snapshots: `tmp/car1-r1/car1-f-desktop-transport/`. Final integration verification is deferred to the serial workflow.

## Current-source retry

The previously reported sibling typecheck blocker is resolved on the current shared tree. Source hashes remain identical to the post-edit hashes above. All gates below exited 0; full logs are under `tmp/car1-r1/car1-f-desktop-transport/` and copies are under `target/car1-f/logs/`.

- `PATH="$PWD/node_modules/.bin:$PATH" biome check apps/desktop/src/file/backend.ts apps/desktop/src/file/backend.test.ts && bun test apps/desktop/src/file/backend.test.ts apps/desktop/src/shell/export-handlers.test.ts`: 12 passed, `current-ts-gate.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-f cargo fmt -p app -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-f cargo test -p app capture`: 2 passed, `current-rust-gate.log`.
- `bun run typecheck && bun test apps/desktop/src/file/backend.test.ts`: 2 passed, `current-typecheck-gate.log`.

Formal review and combined-tree integration remain downstream.
