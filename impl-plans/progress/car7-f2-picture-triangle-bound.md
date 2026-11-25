# car7-f2-picture-triangle-bound progress

Status: in-progress; required release gate unresolved. Chosen limit: 768,000,000.

Implemented shared atomic full-bin reservations before all three mesh traversal sites;
rejected bins are not traversed. Added request and actual-visit counters and three
release regressions. The pre-limit measurement admitted the audit fixture with
2,029,192,704 visited entries (measurement.log; runner passed 1 test, but shell
wrapper exited 1 due to zsh's read-only `status` variable after the runner finished).
Focused final-source tests passed 3/3 (focused.log); admitted control visited
159,750,144 at both thread counts; audit and five-worker cases stayed below limit.

File pre/post SHA-256 and edit intentions are preserved under
`tmp/car7-r7/car7-f2-picture-triangle-bound/` in pre-*.sha256, post-*.sha256 and
intent-*.txt. Final hashes:
- raster.rs: f43644211e9173760e018286ab5604d235378671c319ad3601c10938139bf1ae
- raster/budget.rs: 2d25e9f4f0c58881417b1b18bf2086e010b5476e9b2f542847a3d7be51608ef9
- raster/tests.rs: ff669160c19a18825396299af1b29656a96f921c322fba47954cc07b6b426832

Gate: `rustfmt --edition 2021 crates/capture/src/raster.rs crates/capture/src/raster/budget.rs crates/capture/src/raster/tests.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f2 cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f2 cargo test --release -p nodetto-capture`.
Three runs exited 101, each 86 passed, 1 failed; tile deadline measured 2206 ms
(gate.log), 1204 ms (gate-retry.log), and 1901 ms (gate-serial.log; harness
serialized via RUST_TEST_THREADS=1). Clippy passed in these runs. Exact isolated
`CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f2 cargo test --release -p nodetto-capture --lib tiles::tests::many_tools_exceed_limit_within_budget -- --exact --nocapture` exited 101, 0 passed, 1 failed, 1039 ms (tile-isolated.log). No deadline changed. All logs are under the evidence directory above. Earlier first lint attempt also exposed a now-corrected PNG import and transient sibling lattice warnings; its terminal output is not a complete log.

Full gate and formal downstream reviews remain pending. Do not mark done until the
required deadline and full crate gate pass under the workflow's retry policy.

## IR7-3 redispatch

The three source hashes above matched before and after the prescribed rustfmt; no
source drift. No cargo or rustc process was active at gate start. Three serial gate
attempts exited 101: attempt 1 passed the 89 library tests including the tile deadline,
but interference timing tests `release_pin_budget` (533 ms / 500 ms) and
`release_many_holes_budget` (2070 ms / 2000 ms) failed; attempts 2 and 3 failed
only the library tile deadline at 1500 ms and 2045 ms respectively (88/89 passed).
Logs: `redispatch-gate-01.log`, `redispatch-gate-02.log`, `redispatch-gate-03.log`.
The exact isolated tile test passed in 577 ms (`redispatch-tile-isolated.log`); it
does not resolve the failed aggregate. Clippy passed before each test invocation.

Fresh `redispatch-focused.log` passed all three regressions. At threads 1 and 5,
respectively: audit visited 767,976,732 / 767,976,732 and reserved 768,025,888 /
768,075,044 (workers 1 / 2); five-worker case visited 767,993,132 / 767,993,104
and reserved 768,025,904 / 768,156,960 (workers 1 / 5); admitted control visited
and reserved 159,750,144 at both counts (workers 1 / 5). The limit remains
768,000,000. Aggregate verification remains unresolved; formal reviews are downstream.
