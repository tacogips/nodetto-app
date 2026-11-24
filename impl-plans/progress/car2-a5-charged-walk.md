# car2-a5-charged-walk progress

Status: done

The builder charges prism counts before allocation, budgets mesh decoding, and retains bounds, body metadata, and tool indices after the first excess. The request checks writer headers before raising the pending limit. Focused tests cover metadata tails, targeted scratch, mixed meshes, hidden-only overflow and query precedence.

Evidence: `tmp/car2-r2b/car2-a5-charged-walk/attempt-1/` contains pre/post hashes, edit intentions and logs, mirrored under `target/car2-a5-charged-walk/logs/attempt-1/`.

- `bunx biome check --diagnostic-level=warn packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts packages/core/src/capture/cad-request.ts packages/core/src/capture/cad-request.test.ts apps/cli/src/native-parity/capture.test.ts`: exit 0, `biome.log`.
- `bun test packages/core/src/capture packages/core/src/cad`: exit 0, 325 passed, `bun-retry.log`; `bun-final.log` failed one timing deadline under build load.
- `rustfmt --edition 2021 --check apps/cli/native/src/engine_tests.rs`: exit 0, `rustfmt.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a5-charged-walk cargo test -p nodetto-cli`: exit 0, 33 passed, `cargo-final.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a5-charged-walk cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a5-charged-walk/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/native-parity/cad.test.ts`: exit 0, 17 passed, `build-retry.log` and `parity-retry.log`. Earlier `parity.log` and `parity-final.log` contain timing failures.

## Continuation attempt 2

The 3cd2401 archive oracle produces 80,288,176 NCS1 bytes with SHA-256 `82d5ae99cce242a6503702b85e0e508cb2a1ff6b5b5a644f07d31907f43933b3` for 2,000 extrusions and 4,000,000 points; the current test matches and records zero metadata visits. `baseline-oracle-final.log` records the archive run. The baseline negative control (`baseline-negative.log`, exit 1) allocates 2,001 tools instead of the required 2,000. Targeted mesh status matches the admitted walk; the header test checks supersample precedence.

The 3cd2401 archived native release probe (`baseline-native-release.log`, exit 0, 1 test) recorded admitted NCS1 FNV `3d2b86dc1d7c4be6` and PNG FNV `783ff56857da9294`. The current Rust test asserts both, verifies exit 2 and zero captureSolid calls for overflow. Native parity asserts the baseline PNG FNV and SHA-256 `6dbaebe1560218804831f5a48b387414ae40a5bce4b4cc491b9081dc10ef4d99`; final durations were 1,496 ms admitted and 1,169 ms overflow. Baseline debug probe was interrupted after several minutes (exit 130); two earlier archive builds failed on missing package links, which were corrected within the archive only.

Final source gates, logs under `tmp/car2-r2b/car2-a5-charged-walk/attempt-2/` and mirrored under `target/car2-a5-charged-walk/logs/attempt-2/`:

- `bunx biome check --diagnostic-level=warn packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts packages/core/src/capture/cad-request.ts packages/core/src/capture/cad-request.test.ts apps/cli/src/native-parity/capture.test.ts` exit 0 (`biome-final-3.log`).
- `bun test packages/core/src/capture packages/core/src/cad` exit 0, 327 passed (`bun-final.log`).
- `rustfmt --edition 2021 apps/cli/native/src/engine_tests.rs` and `rustfmt --edition 2021 --check apps/cli/native/src/engine_tests.rs` exit 0 (`rustfmt-final.log`).
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a5-charged-walk cargo test -p nodetto-cli` exit 0, 34 passed (`cargo-final.log`).
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a5-charged-walk cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a5-charged-walk/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/native-parity/cad.test.ts` exit 0, 18 passed (`build-retry.log`, `parity-retry.log`). The prior `parity-final.log` had one CAD timing failure under load; the retry passed.

Pre-edit SHA-256 values are in attempt-1 `pre-sha256.txt`; final values are in attempt-2 `post-sha256.txt`. The progress file was absent before implementation; its final digest is in attempt-2 `progress-sha256.txt`. Edit intentions and the immutable dispatch snapshot preserve the handoff. Formal test-integrity, adversarial and integration reviews remain downstream.
