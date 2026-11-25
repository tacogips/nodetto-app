# car9-p4-mcp-native progress

Status: done (implementation; formal reviews and integration remain downstream).

The accepted design section 27.1 R9-2 matches this plan; no dependencies are required.
The native host retains its own successful inline write, bounded at 1 MiB, and MCP
uses that record after the existing output-path validation. CommandResult is unchanged.
The two-context equal-length regression demonstrated A receiving B before the fix.

Evidence: `tmp/car9-r9/car9-p4-mcp-native/` contains per-edit intentions, fresh
snapshots and SHA-256 hashes, and complete test logs.

- Stage 1: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car9-p4 cargo test -p nodetto-cli inline_capture_attaches_each_calls_own_write` failed as expected: 1 test, A's bytes were B's; `stage1.log`. The surrounding zsh wrapper also reported its reserved `status` variable after the test completed; the cargo log records the test failure.
- Initial gate: clippy exited 101 for an unnecessary cast; corrected before final gate; `prior-gate.log`.
- Final: `CARGO_TERM_QUIET=true cargo fmt -p nodetto-cli -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car9-p4 cargo clippy -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car9-p4 cargo test -p nodetto-cli` exited 0; 41 passed, 0 failed; `gate-final.log`.
- Final SHA-256: engine.rs `35226cf1ac89de7fb7229dc998b1413586d446e0c51ab1a82073866d80cb58ea`; mcp.rs `c11af4e766f8874d95b880f2661c22ea5c0a7835fca93bc5f5d3106a16cb4694`; engine_tests.rs `91348aa3316248a2e01599c5dab7c59c504a618b7762cabde13c3a945ebebe4e`.

`read_inline_image` is absent and the CommandResult definition is unchanged.

Initial SHA-256: engine.rs `b0809304e139702b8a460a1660b56477003eaaf6f4aad1f3d896ceccc1850112`; mcp.rs `2347e5d5c8d3278474a8d71a9a2775a481028b29ccd4eb8e5af2c569fe106ab2`; engine_tests.rs `4ebabc2fbc194b49070224dc9d2b0070e2a73aa01cc9b4f5baef5107f9179792`. The active plan initially had SHA-256 `2b08d9ea42b156fa69292c4b7273910b73a4ce7891e4be913b1cfb6c648e47f7`; its updated hash and the progress record hash are recorded in `progress-after.sha256` (progress hash before this appended initial-hash note).
