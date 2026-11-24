# car2-a1-rust-decoder progress

Status: done (implementation; formal review and integration pending).

Plan and design aligned: R2-D and F1, with no prerequisites. Added accessor-based closure, budgeted validation, eligibility, bounds, packet and regression tests. Existing `decode_inline` and `InlineMesh::to_packet` remain unchanged.

SHA-256 before -> after:
- `crates/capture/src/nmesh.rs`: `6365450709864bee2ba8efae7ae33adfd9bccf9125c0ab5713975d066a5d7932` -> `364016472eb15288b77728f23797c573bf0dd815b92ca44d12b3b774e29503ce`
- `crates/capture/src/mesh.rs`: `31d47fd3743d6b8f87a2aeb345d16afe7f25c489463e0739a99bc5f1ea3ffeb7` -> `7d5bd24461d3166dbffc85452e0f52de55b4e6176b0f5e75cb262712bf6e9bc8`
- This progress file: absent before; its final hash is recorded in the evidence directory.

Evidence root: `tmp/car2-r2b/car2-a1-rust-decoder/attempt-1/`; copies of logs also under `target/car2-a1-rust-decoder/logs/`.

- Baseline API negative control: `rustc --edition 2021 tmp/car2-r2b/car2-a1-rust-decoder/attempt-1/baseline-probe.rs -o target/car2-a1-rust-decoder/baseline-probe` exited 1; `baseline-api.log` shows the new API absent in 3cd2401.
- `rustfmt --edition 2021 --check crates/capture/src/nmesh.rs crates/capture/src/mesh.rs`: exit 0, `fmt-final2.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a1-rust-decoder cargo clippy -p nodetto-capture --all-targets`: exit 0, `clippy-final2.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a1-rust-decoder cargo test -p nodetto-capture`: exit 0, 138 passed, 0 failed, `test-final2.log`.
- Initial test invocation ran successfully but its shell wrapper exited 1 due to a read-only zsh variable; final test was rerun directly.

## Review revision F-A1-CLIPPY-1

The attempt-1 Clippy command exited 0 but emitted four warnings; its earlier passing characterization was incorrect. Replaced four constant-size chunk iterators with `as_chunks`, preserving assertions and arithmetic. Revision diff: `tmp/car2-r2b/car2-a1-rust-decoder/attempt-2/revision.diff`. Status: done, pending independent review.

- `rustfmt --edition 2021 --check crates/capture/src/nmesh.rs crates/capture/src/mesh.rs`: exit 0; `attempt-2/fmt.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a1-rust-decoder cargo clippy -p nodetto-capture --all-targets -- -D warnings`: exit 0; 0 warnings in nmesh.rs/mesh.rs; `attempt-2/clippy.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a1-rust-decoder cargo test -p nodetto-capture`: exit 0; 138 passed, 0 failed; `attempt-2/test.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a1-rust-decoder cargo test -p nodetto-capture --lib nmesh -- --list`: exit 0; five tests listed, including all three new cases; `attempt-2/test-list.log`.

`attempt-2` denotes `tmp/car2-r2b/car2-a1-rust-decoder/attempt-2`; copies of logs are under `target/car2-a1-rust-decoder/logs/attempt-2/`. The pre-revision nmesh SHA-256 was `1bfc1b7c86f8fb50d93532b8fccda6c04dcd5494f9667d7b5b85b468785bad6c`; post-revision is `364016472eb15288b77728f23797c573bf0dd815b92ca44d12b3b774e29503ce`. `decode_inline` and `InlineMesh::to_packet` match 3cd2401 (`attempt-2/preservation.log`).

## Attempt 3: INT-A1R-01 verification

Status: done (implementation; independent test-integrity and adversarial reviews pending). No Rust source was changed in this attempt. Before and after verification, `nmesh.rs` SHA-256 was `364016472eb15288b77728f23797c573bf0dd815b92ca44d12b3b774e29503ce` and `mesh.rs` SHA-256 was `7d5bd24461d3166dbffc85452e0f52de55b4e6176b0f5e75cb262712bf6e9bc8`, matching the recorded post-hashes.

All logs are under `tmp/car2-r2b/car2-a1-rust-decoder/attempt-3/` and mirrored under `target/car2-a1-rust-decoder/logs/attempt-3/`.

- `rustfmt --edition 2021 --check crates/capture/src/nmesh.rs crates/capture/src/mesh.rs`: exit 0; `fmt.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a1-rust-decoder cargo clippy -p nodetto-capture --all-targets`: exit 0; `clippy.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a1-rust-decoder cargo clippy -p nodetto-capture --all-targets -- -D warnings`: exit 0; `clippy-strict.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a1-rust-decoder cargo test -p nodetto-capture`: exit 0; 138 passed, 0 failed; `test.log`.

The attempt-2 revision and unchanged legacy decoder evidence remain in `attempt-2/revision.diff` and `attempt-2/preservation.log`; the independent review decisions belong to the subsequent review gates.
