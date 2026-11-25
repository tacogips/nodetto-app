# car13-p1-touching-witness progress

Status: done.

R13-1 source and regression tests are implemented. Both renderers reject
picture witnesses without positive shared body-box extent. The default-fit
camera probe and pre-fix regression failure are recorded in the evidence
directory. No existing assertions or goldens were changed.

Evidence: `tmp/car13-r13/car13-p1-touching-witness/` contains per-edit
intentions and pre/post SHA-256 hashes, camera probe and logs.

- Camera probe: `bun tmp/car13-r13/car13-p1-touching-witness/camera-probe.ts`, exit 0; `camera-probe.log`.
- Pre-fix regression: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p1 cargo test -p nodetto-capture production_touching_tall_mesh`, exit 101, 1 failed; `fail-before.log`.
- `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`, exit 1; `fmt-check.log`: `crates/capture/tests/mesh.rs` is outside writePaths.
- Plan-owned Rust files: `rustfmt --edition 2021 --check --config skip_children=true crates/capture/src/lattice.rs crates/capture/src/interference.rs crates/capture/src/raster.rs crates/capture/src/raster/reference.rs crates/capture/src/raster/tests.rs`, exit 0; `owned-fmt-check.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p1 cargo clippy -p nodetto-capture --all-targets -- -D warnings`, exit 0; `clippy-final.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p1 cargo test -p nodetto-capture -- --skip welded_edge_contact_is_closed`, exit 0, 194 passed, 0 failed; `test-final.log`. Test inventory: `test-inventory.log`.

Resume: the owner of `crates/capture/tests/mesh.rs` formats that file, then
rerun the exact crate-wide format gate. Formal reviews, integration, and
commit are downstream workflow steps.

Continuation: reran `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`;
exit 1 with the same out-of-scope `crates/capture/tests/mesh.rs` formatting.
Complete log: `tmp/car13-r13/car13-p1-touching-witness/fmt-continuation.log`.

Resumed verification on the current tree: `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check` exited 0 (`fmt-step6-rerun.log`); `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p1 cargo clippy -p nodetto-capture --all-targets -- -D warnings` exited 0 (`clippy-step6-rerun.log`); `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p1 cargo test -p nodetto-capture -- --skip welded_edge_contact_is_closed` exited 0 with 194 passed and 0 failed (`test-step6-rerun.log`). Logs are under the evidence directory. The earlier format blocker is resolved. Formal reviews and integration remain downstream.
