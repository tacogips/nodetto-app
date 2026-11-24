# car2-a2-core-wiring progress

Status: done

The structural capture decoder, copied decoder bounds, CLI and desktop routing, test fakes, routing tests and asymmetric digest test are implemented. Accepted sibling changes were preserved. No eligibility or point charging was added.

Pre-edit source hashes (native fanout snapshot; progress log absent):
```
0780c58258e3de33789b8857f2fe4d4c5c087f5bb0a363c0b33bf1acfa74e734  apps/desktop/src/shell/export-handlers.test.ts
34b2f3512486535cfd0dbe54b4c2722a8bef3bc2074224cd34cc512d3e29c7fa  apps/desktop/src/shell/export-handlers.ts
3b8e77d48c2095842b37b26ed9f23d760fa9e92441ccdd00871937c50f97c594  packages/core/src/capture/scene.ts
3ffb3ae9ee1ce8aa2ee35b48fa22c45e0571cf8c4d3aa1f3922a6ca4feed3b75  packages/core/src/capture/scene.test.ts
56fb9fd41dc8ef3cce656c657aae292e8e2758a8ac29fd12e8029005361c39ed  impl-plans/active/car2-a2-core-wiring.md
59f6f1419675e04ed25f069f3c16b5207381718d1ce580998d31502f454701ba  apps/cli/src/capture-cad.ts
70f5ffa7c1681057f707ab974866a29e06334087547f3f937ea7fef3b2ae664d  packages/core/src/capture/cad-request.test.ts
815245513b7862a96a378a1e6df81535acd9ac6e2fcdc57e090b54370aacb861  apps/cli/src/capture-command.test.ts
8908fc4960210158153fa83ecb930a08539df7f432cdb265cbd0ff933902ac13  tmp/capture/m23/timing.json
8f90c462e38c230ef567060b680cea09e6837df5bf6334e9d0361b318a802229  apps/cli/src/capture-command.ts
95b6ba4f59310c74927d5df74ae1dd116c5ce94dd84d95ef753a4206abe79de0  apps/cli/native/src/engine_tests.rs
a81b45f74a496e1a7fd16df6dbf192054b4c2599a479c24cf2fc891803382f45  apps/cli/src/capture-cad.test.ts
e71c4542ceaeeac67c13c75a7ea8842cb41daae13e7626982481f46f7bd8cc3c  tmp/capture/m09/timing.json
eaedbdcdb25a73f80305e39e0c15921d73fb80ae8e707664d03c2e023f104d1c  packages/core/src/capture/cad-request.ts
```
Post-edit source hashes:
```
298d3d95ea31e2348f9d92b4f7496851fe6e3dd46a67586a2adf44d0495ccfb3  packages/core/src/capture/cad-request.ts
9b5e9cfdd5a530f983e2c945a30c3a762250b7e1f1d102569245fcd254ee35e5  packages/core/src/capture/cad-request.test.ts
4f6984f0bc9fc54d48d19c49eeb4a67a93f6d8a75a847f4e1f4c847d8a0d079d  packages/core/src/capture/scene.ts
ebb50bfbcc03eeaade6cc32b81b44678462341b7e5db038b3b0b98da4ab8966c  packages/core/src/capture/scene.test.ts
5c51952bcbec83957f5e77686def7d11907632c5916a0e2bd8277027d05688b0  apps/cli/src/capture-command.ts
49421aa6f59b79655e85246b69b5a20bb408836d35f72e6a0af08354be35c183  apps/cli/src/capture-command.test.ts
294f6a9401dd1e64da7ecb5ed6e42d5a7105ad39fdd831dc7d5d8b7b89f679b2  apps/cli/src/capture-cad.ts
984a3ab74d899bbb1d7921101124f32e8bd2b6c3acc6e386f8f4771cbfddc89d  apps/cli/src/capture-cad.test.ts
b0cc2d136aa34ef677e7563c7f1af2c6958e0be2f859f8473c2785e52290f6eb  apps/desktop/src/shell/export-handlers.ts
759fdd7c4b62c64640a665165d3ab4369155207119167859da41ca217578e2a0  apps/desktop/src/shell/export-handlers.test.ts
063fb45b89d2913d207e22470a6d7434f69bc6447f3c72d03d59a8ec04b0031e  apps/cli/native/src/engine_tests.rs
```

Verification, all exit 0 on final source identity:
- Biome on all ten touched TypeScript files and `bun test packages/core/src/capture apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts apps/desktop/src/shell/export-handlers.test.ts`: 212 passed, 0 failed. `target/car2-a2-core-wiring/logs/attempt-1/final-bun-2.log`.
- `rustfmt --edition 2021 --check apps/cli/native/src/engine_tests.rs`: `target/car2-a2-core-wiring/logs/attempt-1/rustfmt.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-core-wiring cargo test -p nodetto-cli`: 32 passed, 0 failed. `target/car2-a2-core-wiring/logs/attempt-1/cargo-test.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-core-wiring cargo build --release -p nodetto-cli` then `NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a2-core-wiring/release/nodetto-cli" bun test apps/cli/src/native-parity/cad.test.ts apps/cli/src/native-parity/capture.test.ts`: 16 passed, 0 failed. `target/car2-a2-core-wiring/logs/attempt-1/parity.log`.
- Negative control: temporarily restored the original `io.decodeMesh` argument; `bun test apps/cli/src/capture-command.test.ts -t 'CAD capture routes mesh decoding through the capture decoder'` exited 1, 1 failed. `tmp/car2-r2b/car2-a2-core-wiring/attempt-1/negative-routing.log`. The restored source hash equals post-sha256.
- Initial focused test exited 1 due to test fixture resolution and invalid mesh; corrected and rerun successfully. `tmp/car2-r2b/car2-a2-core-wiring/attempt-1/bun-test.log`.

Attempt 2: the literal 3cd2401 source was extracted by `git archive 3cd2401 packages tsconfig.json tsconfig.base.json package.json` into the plan-local evidence directory, excluding test files. Git blob verification matched all 883 extracted files (tree `ec8bfb2876620faeb7d2b69b3873302bb9849fe4`); `target/car2-a2-core-wiring/logs/attempt-2/archive-identity.log`. The archived source was run with `bun --tsconfig-override tmp/car2-r2b/car2-a2-core-wiring/attempt-2/baseline-tsconfig.json tmp/car2-r2b/car2-a2-core-wiring/attempt-2/baseline-probe.ts`, exit 0. The original decoder gives frame `complete`, scene SHA-256 `9cc84237cb037857c7a9065bb7e68df6873d037c8c346837dc47fbe604438161`, and the camera asserted by `apps/cli/src/capture-cad.test.ts`; `target/car2-a2-core-wiring/logs/attempt-2/baseline-probe-2.log`. The external polygon-clipping dependency was linked from the existing local installation; workspace module aliases resolve to the archived source. No Git worktree was created.

Final stable-tree verification after the sibling export plan finished:
- `bunx biome check --diagnostic-level=warn packages/core/src/capture/cad-request.ts packages/core/src/capture/cad-request.test.ts packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts apps/cli/src/capture-command.ts apps/cli/src/capture-command.test.ts apps/cli/src/capture-cad.ts apps/cli/src/capture-cad.test.ts apps/desktop/src/shell/export-handlers.ts apps/desktop/src/shell/export-handlers.test.ts && bun test packages/core/src/capture apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts apps/desktop/src/shell/export-handlers.test.ts`: exit 0, 212 passed, `target/car2-a2-core-wiring/logs/attempt-2/bun.log`.
- `rustfmt --edition 2021 --check apps/cli/native/src/engine_tests.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-core-wiring cargo test -p nodetto-cli`: exit 0, 32 passed, `target/car2-a2-core-wiring/logs/attempt-2/cargo.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-core-wiring cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a2-core-wiring/release/nodetto-cli" bun test apps/cli/src/native-parity/cad.test.ts apps/cli/src/native-parity/capture.test.ts`: exit 0, 16 passed, `target/car2-a2-core-wiring/logs/attempt-2/parity.log`.

Workspace typecheck, lint and verify are integration gates per dispatch. Formal reviews remain downstream.
