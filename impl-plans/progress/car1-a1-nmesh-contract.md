# car1-a1-nmesh-contract progress

Status: incomplete; shared-tree verification blocked by concurrent changes.

- Added the `decodeNmesh` options overload, allocation hooks and a streaming
  over-limit validation path in `packages/nmesh/src/decode.ts`. This partial
  seam has not yet received its required regression tests.
- SHA-256 before: `e7a9afb4b20cedfd951e2898e717452b7daeeced234f195320ca46f96e85203b`;
  after: `2eee6f9808ae0ce0481f9fc03ae2348202d6dd1474c36f0489302bf5596a4847`.
- `node_modules/.bin/biome format --write packages/nmesh/src/decode.ts`: exit 0;
  `tmp/car1-r1/car1-a1-nmesh-contract/local-format.log`.
- `node_modules/.bin/biome check packages/nmesh/src/decode.ts`: exit 0;
  `tmp/car1-r1/car1-a1-nmesh-contract/biome-final.log`.
- `bun test packages/nmesh/src/codec.test.ts`: exit 1, 0 passed, 1 failed;
  `tmp/car1-r1/car1-a1-nmesh-contract/codec.log`. The concurrent changes to
  `packages/nmesh/src/canonical.ts` and `encode.ts` produce a module
  initialization cycle before tests load.
- `bun run typecheck`: exit 2; `tmp/car1-r1/car1-a1-nmesh-contract/typecheck.log`.
  Diagnostics are in concurrently edited inspector tests.
- Remaining: Rust and capture decoder contracts, eight fixtures, parity and
  allocation tests, baseline negative controls, and all required final gates.
  Re-run after sibling changes are stable; review, integration, and commit
  remain downstream workflow responsibilities.

## Redispatch

- Generated the eight planned fixtures using `bun tmp/car1-r1/car1-a1-nmesh-contract/fixtures-generator.ts` (exit 0; `tmp/car1-r1/car1-a1-nmesh-contract/fixtures-generator.log`). Their post-generation SHA-256 values and the current decoder hash are in `tmp/car1-r1/car1-a1-nmesh-contract/redispatch-sha256.txt`; the fixtures were absent before generation.
- `bun test packages/nmesh/src/codec.test.ts` exited 1 before tests loaded: sibling-owned `packages/nmesh/src/canonical.ts` accesses `MIN_NMESH_FIXED_BYTES` before initialization. Log: `tmp/car1-r1/car1-a1-nmesh-contract/codec-redispatch.log`. Repair belongs to plan car1-m-stl-refusal; rerun the required gates after it lands.
- Rust and capture decoder contracts, worker parity, regression tests and baseline controls remain incomplete. The Rust closure API requires owned floating-point mesh positions; reconcile the no-millimetres allocation requirement before implementing the over-limit target path.

- A partial edit to `packages/io/src/nmesh/capture-decoder.ts` is unformatted and unverified; its post-edit hash is in `redispatch-sha256.txt`. The fixture tests and parity review remain outstanding.

## Subsequent redispatch

- The codec initialization failure no longer reproduces: `bun test packages/nmesh/src/codec.test.ts` exited 0 with 25 passing tests on the current shared tree (console observation).
- Formatted the existing partial capture decoder; intent: `tmp/car1-r1/car1-a1-nmesh-contract/ts-edit-intent.txt`. It remains incomplete and lacks required fixture and allocation tests.
- Added the real worker nine-fixture parity test. `bun test packages/cad-kernel/src/worker-host.test.ts --test-name-pattern 'the real worker agrees with capture mesh eligibility fixtures'` exited 0, 1 passed, 0 failed; `tmp/car1-r1/car1-a1-nmesh-contract/worker-parity-final.log`. Intent: `worker-edit-intent.txt` and `worker-format-intent.txt` in the same evidence directory.
- Blocked: `crate::mesh::is_closed` takes `scene::Mesh`, whose positions are an owned `Vec<f64>`, but the plan requires calling it while allocating no millimetre positions on the over-limit `need_target` path. `mesh.rs` and `scene.rs` are outside writePaths. Resolve the design or scope before the Rust decoder can satisfy both requirements.
- The exact worker verification gate writes `tmp/cad3d/m7/roundtrip.log`, outside the authorized artifact roots and evidence directory. A checkpoint amendment authorizing that output is required before running it. Rust and TypeScript fixture/allocation regressions, negative controls, and all exact gates remain outstanding.
- Pre/post hashes for this redispatch are in `tmp/car1-r1/car1-a1-nmesh-contract/resume-pre-sha256.txt` and `resume-post-sha256.txt`. Review and integration remain downstream.
