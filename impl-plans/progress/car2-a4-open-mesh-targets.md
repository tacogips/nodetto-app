# car2-a4-open-mesh-targets progress

Status: done

The construction walk preserves display-only meshes while rejecting their Boolean targets. Capture and real worker cover nine eligibility fixtures and dependent sketches; native routing and image parity cover triangle and tetrahedron. No cad check or wireframe sources changed by this plan. Formal review and integration remain downstream.

## SHA-256 before

```
2945561250d9260dba1b102a4e179bafe29e4760dca809686696b13de5d0139b  packages/core/src/cad/construction.ts
4f6984f0bc9fc54d48d19c49eeb4a67a93f6d8a75a847f4e1f4c847d8a0d079d  packages/core/src/capture/scene.ts
ebb50bfbcc03eeaade6cc32b81b44678462341b7e5db038b3b0b98da4ab8966c  packages/core/src/capture/scene.test.ts
4d9f4da40aa5aa1eddf04b21a56177b9ca6e5c9a09b1daf109e141a638c89197  packages/cad-kernel/src/worker-host.test.ts
063fb45b89d2913d207e22470a6d7434f69bc6447f3c72d03d59a8ec04b0031e  apps/cli/native/src/engine_tests.rs
a7a3aa53df48e6a96871f9b0c69f94f9014e7efad25cfd6cf206fb5e8b536905  apps/cli/src/native-parity/capture.test.ts
```

## SHA-256 after

```
460118d66518dc2c0035ea7f69e89b00a019e974550a8adfad849025349edfaf  packages/core/src/cad/construction.ts
339d48711ae3dce38e3c331285efd5ec318147c08b8ce63a7385c36cfafb9e98  packages/core/src/capture/scene.ts
71314150665f6070a6522e9b0bfb2d70dcf622358a1ecaf2bbefcb1c6f44903c  packages/core/src/capture/scene.test.ts
f8ab0c3f26d472906b3576eb55a909f0dbab09e2621562dc825c55dd301deffa  packages/cad-kernel/src/worker-host.test.ts
9b4bcc57ac2910fbbb8e56b4dfdf07d2746d208027368c000aea23b8802cb6ec  apps/cli/native/src/engine_tests.rs
53b9bb64ac3e147d44a4a706adc55a445b265beb7541c72be57a5bf69a392190  apps/cli/src/native-parity/capture.test.ts
```

## Verification

Complete logs are under `tmp/car2-r2b/car2-a4-open-mesh-targets/attempt-1/` and mirrored under `target/car2-a4-open-mesh-targets/logs/attempt-1/`.

- `bunx biome check --diagnostic-level=warn packages/core/src/cad/construction.ts packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts packages/cad-kernel/src/worker-host.test.ts apps/cli/src/native-parity/capture.test.ts`: exit 0 (`biome-final.log`).
- `bun test packages/core/src/capture packages/core/src/cad packages/cad-kernel/src/worker-host.test.ts`: exit 0, 331 passed (`bun-retry.log`); first attempt under concurrent Rust compilation had two deadline failures (`bun-final.log`).
- `rustfmt --edition 2021 --check apps/cli/native/src/engine_tests.rs`: exit 0 (`rustfmt.log`).
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a4-open-mesh-targets cargo test -p nodetto-cli`: exit 0, 33 passed (`cargo.log`).
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a4-open-mesh-targets cargo build --release -p nodetto-cli`: exit 0 (`build.log`).
- `NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a4-open-mesh-targets/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/native-parity/cad.test.ts`: exit 0, 17 passed (`parity-retry-2.log`); earlier attempts had timing failures (`parity.log`, `parity-retry.log`).
- Negative control: temporarily restore unconditional mesh admission and run `bun test packages/core/src/capture/scene.test.ts -t 'targeted mesh eligibility rejects the entire shared cut'`: exit 1, one expected failing test (`negative.log`); original source hash restored.
