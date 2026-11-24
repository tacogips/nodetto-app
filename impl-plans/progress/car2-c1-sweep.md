# car2-c1-sweep progress

Status: done (implementation; formal reviews and integration remain downstream).

The sweep selects the axis with the fewest relaxed overlaps, retains the smallest body-order pairs in a bounded heap, and computes weights only for retained pairs. Tests compare dense, mixed, and tolerance-boundary fixtures against the original exhaustive pair calculation and assert sparse row/grid comparison counts. The test oracle copies the original all-pairs loop and reproduces the crate-private validity and active-step checks using public tool bounds.

SHA-256 (before -> after):
- `crates/capture/src/interference.rs`: `29096f7ae0bd5e0c029099a8bba81283ad114f450aeb02a9ac33f14987313646` -> `05c052f8d0ac5d2f0e3c9a7ca58bd82873dee21936266e727c81d18b663697e7`
- `crates/capture/tests/interference.rs`: `b34200ea55a7bd29c0dc2a68776110eb8d44a29bf6d8afe10ac13d8709c9fdb0` -> `040f170587cd28aea01be201951d44909632e078dd960223932d68c70a44876c`
- `impl-plans/progress/car2-c1-sweep.md`: absent before; post-write SHA-256 recorded in `tmp/car2-r2b/car2-c1-sweep/attempt-1/progress.sha256` to avoid self-reference.

Commands and complete logs (mirrored under `target/car2-c1-sweep/logs/`; canonical logs under `tmp/car2-r2b/car2-c1-sweep/attempt-1/`):
- Negative control on unchanged baseline algorithm plus a temporary count hook: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c1-sweep cargo test -p nodetto-capture --test interference sweep_sparse_comparison_counts`: exit 101, 1 failed; `negative.log` (500 separated boxes compared 124750 pairs).
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c1-sweep cargo test -p nodetto-capture`: exit 0, 138 passed, 0 failed; `cargo-test-final.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c1-sweep cargo clippy -p nodetto-capture --all-targets`: exit 0; `clippy-final.log`. Four warnings concern sibling-owned `nmesh.rs`; none concern interference.
- `rustfmt --edition 2021 --check crates/capture/src/interference.rs crates/capture/tests/interference.rs`: exit 0; `rustfmt-final.log`.

The tests and clippy ran on the shared moving tree. The existing 2,000-body test passed without edits. Workspace-wide verification and independent reviews are owned by subsequent workflow steps.
