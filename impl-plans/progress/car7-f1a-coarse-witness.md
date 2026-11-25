# car7-f1a-coarse-witness progress

Status: in-progress. Assigned Rust producer and native parity implementation is present; the required full Rust gate remains failed.

Per-edit pre/post SHA-256 hashes, fresh before-images and intentions are recorded in `tmp/car7-r7/car7-f1a-coarse-witness/edit-*-intent.txt` and corresponding before-images. Existing concurrent changes were preserved.

- Coarse casts are counted separately from refinement. Buffered successful casts are accumulated once on exhaustion, and capped unwitnessed pairs without a complete axis are emitted in optional `analysis.incomplete`.
- Regression `cropped_dense_pair_keeps_buffered_witness` failed before the implementation (0 pairs, expected 1) in `pre-fix-regression.log`. The exact one-cell unit regression yields 0.25 mm3. Cropped buffered-hit and abandoned-miss tests compare report and PNG at one and five threads; a refinement-only control also compares them.
- `scan-tests-01.log`: 7 passed. `focused-dense.log`: 2 passed. These precede the final test-only edit.
- Rust full gate: `rust-gate-01.log`, `rust-gate-02.log`, and `rust-gate-03.log` exit 101 on the existing 1000 ms tile deadline (1793, 1069, and 1142 ms respectively). Three attempts exhausted. Exact isolated comparison `tile-isolated.log` passed 1 test at 768 ms; it does not make the full gate pass.
- `cli-gate-01.log` exit 1: 15 passed, 1 failed, existing 2D parity timed out. `cli-gate-02.log` exit 0: 16 passed, including the release-native cropped pair in text and JSON.
- Final source: `interference-final.log` exit 0, 29 passed; `render-final.log` exit 0, 16 passed; Rust gate 03 exit 101, 88 passed and 1 failed.
- Formal review, integration verification, and any commit remain downstream.

## Integration review repair

- IR7-1: `Analysis` now implements Debug manually, preserving the original fields and order and appending `incomplete` only when nonempty. JSON serialization is unchanged. `ir7-boundary.log` exits 0, 7/7; `git diff -- crates/capture/tests/boundary_fold.rs` is empty.
- IR7-2 remains open: `ir7-rust-gate-01.log`, `ir7-rust-gate-02.log`, and `ir7-rust-gate-03.log` exit 101 on the unchanged tile deadline at 1313, 1758, and 1728 ms. Each ran 89 tests, 88 passed. `ir7-tile-isolated.log` exits 0, 1/1 at 566 ms; it is not an aggregate pass.
- Current source: `ir7-interference.log` 29/29, `ir7-render.log` 16/16, and `ir7-cli-gate.log` 16/16, all exit 0. The release CLI was rebuilt after the Rust change. Aggregate gate and done criterion remain unsatisfied; formal review and integration are downstream.
