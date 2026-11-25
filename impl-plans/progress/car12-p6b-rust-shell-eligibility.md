# car12-p6b-rust-shell-eligibility progress

Status: in-progress.

- Dependency car12-p1 is accepted by dispatch; mesh.rs matches its supplied SHA-256.
- Added a welded edge-contact closure regression in crates/capture/tests/mesh.rs. Pre- and post-edit SHA-256 values are recorded in tmp/car12-r12/car12-p6b-rust-shell-eligibility/{pre,post}-test-01.sha256; intent is in intent-test-01.txt.
- Fail-before: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p6b cargo test -p nodetto-capture --test mesh welded_edge_contact_is_closed` exited 101, one test failed as expected. Complete log: tmp/car12-r12/car12-p6b-rust-shell-eligibility/fail-before.log.
- Outstanding: implement exact C1-C6 contact classification and eligibility, remaining fixtures and decoder parity tests; format and run all plan gates. This regression is intentionally failing until implementation.
