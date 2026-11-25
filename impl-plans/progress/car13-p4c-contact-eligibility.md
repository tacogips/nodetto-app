# car13-p4c-contact-eligibility progress

Status: done (implementation); formal review and downstream native parity pending.

The accepted p4b dependency was present. The nmesh.rs initial SHA-256 was 1382859805c9d7a5c768fbf7c272a2f519fc7cce69cec04275f02f9f90fa3792, matching p4a review evidence. Per-edit hashes and intentions are in tmp/car13-r13/car13-p4c-contact-eligibility/. The encoder follows the decoder format without deviations. The closure fixture literals are independent of target eligibility. Nine decoder fixtures round-trip and classify as specified.

- Negative control: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p4c cargo test -p nodetto-capture --lib contact_decoder_target_eligibility`, exit 101, `fail-before-actual.log`, edge contact rejected before the production edit.
- `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`: exit 0, `fmt.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p4c cargo clippy -p nodetto-capture --all-targets -- -D warnings`: exit 0, `clippy.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p4c cargo test -p nodetto-capture`: exit 0, 199 passed, `test.log`.
- `bun test packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts`: exit 0, 7 passed, `bun.log`.
- `cargo test ... --lib nmesh::tests -- --list`: exit 0, `test-list.log` identifies the round-trip, eligibility and existing fixture tests; the full crate run covered them.

Evidence directory: `tmp/car13-r13/car13-p4c-contact-eligibility/`. Full workspace and release parity gates belong to integration and p5.
