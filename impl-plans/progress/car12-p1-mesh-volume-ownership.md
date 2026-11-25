# car12-p1 progress

Status: done (implementation phase; formal review and integration pending).

R12-1 uses canonical edge values and world-space tie ownership for volume;
facet shading remains unchanged. Near-tie membership disagreement triggers
rechecks. Front/back contact, overlap, corner and oblique tests were added.
Native parity belongs to p7; closure eligibility belongs to p6b.

Evidence and pre/post SHA-256 records are under
`tmp/car12-r12/car12-p1-mesh-volume-ownership/`. Final source hashes:

- mesh.rs: 289e03a515fca754c762edb8ea4df717acf681ad9bb7908c8a40fd320b1212a8
- prism.rs: 5a07601fc63fe4f4dc861b426b96e07ec13b64ab0297feb7441a5974a800f8c3
- raster/reference.rs: e5db0a137c20273c52decb9aa30437d062f6e6eacc2673afb61110fb334d65f3
- raster/tests.rs: 1e68c2fa78acc071cad9c0dd02db4750c005ddce22642e871386179359b4c459

- Pre-fix contact regression: exit 101, `fail-before.log`, one failure as expected.
- `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`: exit 0, `fmt-final.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p1 cargo clippy -p nodetto-capture --all-targets -- -D warnings`: exit 0, `clippy-final.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p1 cargo test -p nodetto-capture`: exit 0, `test-final.log`, 182 passed, 0 failed, 26 ignored.
- Initial clippy found a test iterator lint; corrected and reran all final gates.

The shared tree contained concurrent sibling changes; no sibling file was edited.
